import { Stack, Construct, StackProps, CfnOutput, Duration, Tag, CfnParameter } from "@aws-cdk/core";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as lambda from "@aws-cdk/aws-lambda";
import * as s3 from "@aws-cdk/aws-s3";
import * as iam from "@aws-cdk/aws-iam";
import * as acm from "@aws-cdk/aws-certificatemanager";

export class TelemetryStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const stackParameter = new CfnParameter(this, "stack", {
      type: "String",
      description: "Stack",
    });

    const stageParameter = new CfnParameter(this, "stage", {
      type: "String",
      description: "Stage",
    });

    const loggingCertificateArn = new CfnParameter(
      this,
      "logging-certificate-arn",
      {
        type: "String",
        description: "ARN of ACM certificate for logging endpoint",
      }
    );

    const loggingHostName = new CfnParameter(this, "logging-hostname", {
      type: "String",
      description: "Hostname for logging endpoint",
    });

    const maxLogSize = new CfnParameter(this, "max-log-size", {
      type: "String",
      description:
        "Maximum size (in bytes) of log data from an individual request",
    });

    const loggingCertificate = acm.Certificate.fromCertificateArn(
      this,
      "logging-certificate",
      loggingCertificateArn.valueAsString
    );

    const deployBucket = s3.Bucket.fromBucketName(
      this,
      "editions-dist",
      "editions-dist"
    );
    const loggingFunction = () => {
      const fn = new lambda.Function(this, `EditionsLogging`, {
        functionName: `editions-logging-${stageParameter.valueAsString}`,
        runtime: lambda.Runtime.NODEJS_10_X,
        memorySize: 128,
        timeout: Duration.seconds(1),
        code: lambda.Code.bucket(
          deployBucket,
          `${stackParameter.valueAsString}/${stageParameter.valueAsString}/logging/logging.zip`
        ),
        handler: "index.handler",
        environment: {
          STAGE: stageParameter.valueAsString,
          STACK: stackParameter.valueAsString,
          APP: "editions-logging",
          MAX_LOG_SIZE: maxLogSize.valueAsString,
          LOG_ENDPOINT_ENABLED: "true",
        },
      });
      Tag.add(fn, "App", `editions-logging`);
      Tag.add(fn, "Stage", stageParameter.valueAsString);
      Tag.add(fn, "Stack", stackParameter.valueAsString);
      return fn;
    };

    const loggingBackend = loggingFunction();

    const loggingApiPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources: ["*"],
    });
    loggingApiPolicyStatement.addAnyPrincipal();

    const loggingApi = new apigateway.LambdaRestApi(this, "editions-logging", {
      handler: loggingBackend,
      endpointTypes: [apigateway.EndpointType.EDGE],
      policy: new iam.PolicyDocument({
        statements: [loggingApiPolicyStatement],
      }),
      defaultMethodOptions: {
        apiKeyRequired: false,
      },
    });

    const usagePlan = new apigateway.UsagePlan(
      this,
      "editions-logging-usage-plan",
      {
        name: `editions-logging-usage-plan-${stageParameter.valueAsString}`,
        apiStages: [
          {
            stage: loggingApi.deploymentStage,
            api: loggingApi,
          },
        ],
        // max of 5 million requests a day (100 log messages per user)
        quota: {
          period: apigateway.Period.DAY,
          limit: 5000000,
        },
      }
    );

    const apiKey = new apigateway.ApiKey(this, `editions-logging-apikey`, {
      apiKeyName: `editions-logging-${stageParameter.valueAsString}`,
    });
    usagePlan.addApiKey(apiKey);

    const loggingDomainName = new apigateway.DomainName(
      this,
      "logging-domain-name",
      {
        domainName: loggingHostName.valueAsString,
        certificate: loggingCertificate,
        endpointType: apigateway.EndpointType.EDGE,
      }
    );

    loggingDomainName.addBasePathMapping(loggingApi, { basePath: "" });

    new CfnOutput(this, "Logging-Api-Target-Hostname", {
      description: "hostname",
      value: `${loggingDomainName.domainNameAliasDomainName}`,
    });
  }
}
