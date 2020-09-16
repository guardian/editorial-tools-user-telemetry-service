import {
  Stack,
  Construct,
  StackProps,
  CfnOutput,
  Duration,
  Tag,
  CfnParameter,
  RemovalPolicy,
} from "@aws-cdk/core";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as lambda from "@aws-cdk/aws-lambda";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3n from "@aws-cdk/aws-s3-notifications";
import * as kinesis from "@aws-cdk/aws-kinesis";
import * as iam from "@aws-cdk/aws-iam";
import * as acm from "@aws-cdk/aws-certificatemanager";
import { BucketEncryption, BlockPublicAccess, Bucket } from "@aws-cdk/aws-s3";

export class TelemetryStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /**
     * Parameters
     */

    const stackParameter = new CfnParameter(this, "Stack", {
      type: "String",
      description: "Stack",
    });

    const stageParameter = new CfnParameter(this, "Stage", {
      type: "String",
      description: "Stage",
    });

    const telemetryHostName = new CfnParameter(this, "Hostname", {
      type: "String",
      description: "Hostname for telemetry endpoint",
    });

    const telemetryCertificateArn = new CfnParameter(this, "CertificateArn", {
      type: "String",
      description: "ARN of ACM certificate for telemetry endpoint",
    });

    const kinesisStreamArn = new CfnParameter(this, "KinesisArn", {
      type: "String",
      description: "ARN of the Kinesis stream to post event data",
    });

    const maxLogSize = new CfnParameter(this, "MaxLogSize", {
      type: "String",
      description:
        "Maximum size (in bytes) of log data from an individual request",
    });

    const pandaSettingsKey = new CfnParameter(this, "PandaSettingsKey", {
      type: "String",
      description:
        "The location of the pan-domain authentication settings file",
    });

    /**
     * S3 bucket – where our telemetry data is persisted
     */

    const telemetryDataBucket = new Bucket(this, "user-telemetry-data-bucket", {
      versioned: false,
      bucketName: "user-telemetry-data",
      encryption: BucketEncryption.KMS_MANAGED,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Lambda
     */

    const deployBucket = s3.Bucket.fromBucketName(
      this,
      "composer-dist",
      "composer-dist"
    );

    const commonLambdaParams = {
      runtime: lambda.Runtime.NODEJS_12_X,
      memorySize: 128,
      timeout: Duration.seconds(5),
      handler: "index.handler",
      environment: {
        STAGE: stageParameter.valueAsString,
        STACK: stackParameter.valueAsString,
        APP: "tools-telemetry",
        MAX_LOG_SIZE: maxLogSize.valueAsString,
        LOG_ENDPOINT_ENABLED: "true",
        TELEMETRY_BUCKET_NAME: telemetryDataBucket.bucketName,
      },
    };

    /**
     * API Lambda
     */

    const createTelemetryAPIFunction = () => {
      const fn = new lambda.Function(this, `EventApiLambda`, {
        ...commonLambdaParams,
        environment: {
          ...commonLambdaParams.environment,
          PANDA_SETTINGS_KEY: pandaSettingsKey.valueAsString
        },
        functionName: `event-api-lambda-${stageParameter.valueAsString}`,
        code: lambda.Code.bucket(
          deployBucket,
          `${stackParameter.valueAsString}/${stageParameter.valueAsString}/event-api-lambda/event-api-lambda.zip`
        ),
      });
      Tag.add(fn, "App", "tools-telemetry");
      Tag.add(fn, "Stage", stageParameter.valueAsString);
      Tag.add(fn, "Stack", stackParameter.valueAsString);
      return fn;
    };

    const telemetryAPIFunction = createTelemetryAPIFunction();

    const telemetryBackendPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:PutObject"],
      resources: [
        telemetryDataBucket.bucketArn,
        `${telemetryDataBucket.bucketArn}/*`,
      ],
    });

    telemetryAPIFunction.addToRolePolicy(telemetryBackendPolicyStatement);

    /**
     * S3 event handler lambda
     */

    const kinesisStream = kinesis.Stream.fromStreamArn(
      this,
      "user-telemetry-kinesis-stream",
      kinesisStreamArn.valueAsString
    );

    const createTelemetryS3Function = () => {
      const fn = new lambda.Function(this, `EventS3Lambda`, {
        ...commonLambdaParams,
        functionName: `event-s3-lambda-${stageParameter.valueAsString}`,
        code: lambda.Code.bucket(
          deployBucket,
          `${stackParameter.valueAsString}/${stageParameter.valueAsString}/event-api-lambda/event-api-lambda.zip`
        ),
        environment: {
          ...commonLambdaParams.environment,
          TELEMETRY_STREAM_NAME: kinesisStream.streamName,
        },
      });
      Tag.add(fn, "App", "tools-telemetry");
      Tag.add(fn, "Stage", stageParameter.valueAsString);
      Tag.add(fn, "Stack", stackParameter.valueAsString);

      // Notify our lambda when new objects are added to the telemetry bucket
      telemetryDataBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        new s3n.LambdaDestination(fn)
      );

      return fn;
    };

    const telemetryS3Function = createTelemetryS3Function();

    const telemetryS3FunctionS3PolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:GetObject"],
      resources: [
        telemetryDataBucket.bucketArn,
        `${telemetryDataBucket.bucketArn}/*`,
      ],
    });
    const telemetryS3FunctionKinesisPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["kinesis:PutRecords"],
      resources: [kinesisStreamArn.valueAsString],
    });

    telemetryS3Function.addToRolePolicy(telemetryS3FunctionS3PolicyStatement);
    telemetryS3Function.addToRolePolicy(
      telemetryS3FunctionKinesisPolicyStatement
    );

    /**
     * API Gateway
     */

    const telemetryApiPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources: ["*"],
    });
    telemetryApiPolicyStatement.addAnyPrincipal();

    const telemetryApi = new apigateway.LambdaRestApi(this, "tools-telemetry", {
      handler: telemetryAPIFunction,
      endpointTypes: [apigateway.EndpointType.EDGE],
      policy: new iam.PolicyDocument({
        statements: [telemetryApiPolicyStatement],
      }),
      defaultMethodOptions: {
        apiKeyRequired: false,
      },
    });

    const telemetryCertificate = acm.Certificate.fromCertificateArn(
      this,
      "user-telemetry-certificate",
      telemetryCertificateArn.valueAsString
    );

    const telemetryDomainName = new apigateway.DomainName(
      this,
      "user-telemetry-domain-name",
      {
        domainName: telemetryHostName.valueAsString,
        certificate: telemetryCertificate,
        endpointType: apigateway.EndpointType.EDGE,
      }
    );

    telemetryDomainName.addBasePathMapping(telemetryApi, { basePath: "" });

    new CfnOutput(this, "user-telemetry-api-target-hostname", {
      description: "hostname",
      value: `${telemetryDomainName.domainNameAliasDomainName}`,
    });
  }
}
