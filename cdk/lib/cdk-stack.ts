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
    const stackParameter = new CfnParameter(this, "tools-telemetry-stack", {
      type: "String",
      description: "Stack",
    });

    const stageParameter = new CfnParameter(this, "tools-telemetry-stage", {
      type: "String",
      description: "Stage",
    });

    const telemetryCertificateArn = new CfnParameter(
      this,
      "tools-telemetry-certificate-arn",
      {
        type: "String",
        description: "ARN of ACM certificate for telemetry endpoint",
      }
    );

    const telemetryHostName = new CfnParameter(this, "tools-telemetry-hostname", {
      type: "String",
      description: "Hostname for telemetry endpoint",
    });

    const maxLogSize = new CfnParameter(this, "max-log-size", {
      type: "String",
      description:
        "Maximum size (in bytes) of log data from an individual request",
    });

    const telemetryCertificate = acm.Certificate.fromCertificateArn(
      this,
      "tools-telemetry-certificate",
      telemetryCertificateArn.valueAsString
    );

    const deployBucket = s3.Bucket.fromBucketName(
      this,
      "composer-dist",
      "composer-dist"
    );

    const telemetryFunction = () => {
      const fn = new lambda.Function(this, `ToolsTelemetry`, {
        functionName: `tools-telemetry-${stageParameter.valueAsString}`,
        runtime: lambda.Runtime.NODEJS_10_X,
        memorySize: 128,
        timeout: Duration.seconds(5),
        code: lambda.Code.bucket(
          deployBucket,
          `${stackParameter.valueAsString}/${stageParameter.valueAsString}/tools-telemetry/tools-telemetry.zip`
        ),
        handler: "index.handler",
        environment: {
          STAGE: stageParameter.valueAsString,
          STACK: stackParameter.valueAsString,
          APP: "tools-telemetry",
          MAX_LOG_SIZE: maxLogSize.valueAsString,
          LOG_ENDPOINT_ENABLED: "true",
        },
      });
      Tag.add(fn, "App", `tools-telemetry`);
      Tag.add(fn, "Stage", stageParameter.valueAsString);
      Tag.add(fn, "Stack", stackParameter.valueAsString);
      return fn;
    };

    const telemetryBackend = telemetryFunction();

    const telemetryApiPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources: ["*"],
    });
    telemetryApiPolicyStatement.addAnyPrincipal();

    const telemetryApi = new apigateway.LambdaRestApi(this, "tools-telemetry", {
      handler: telemetryBackend,
      endpointTypes: [apigateway.EndpointType.EDGE],
      policy: new iam.PolicyDocument({
        statements: [telemetryApiPolicyStatement],
      }),
      defaultMethodOptions: {
        apiKeyRequired: false,
      },
    });

    // const usagePlan = new apigateway.UsagePlan(
    //   this,
    //   "tools-telemetry-usage-plan",
    //   {
    //     name: `tools-telemetry-usage-plan-${stageParameter.valueAsString}`,
    //     apiStages: [
    //       {
    //         stage: telemetryApi.deploymentStage,
    //         api: telemetryApi,
    //       },
    //     ],
    //     // max of 50,000 requests a day
    //     quota: {
    //       period: apigateway.Period.DAY,
    //       limit: 50000,
    //     },
    //   }
    // );

    const telemetryDomainName = new apigateway.DomainName(
      this,
      "tools-telemetry-domain-name",
      {
        domainName: telemetryHostName.valueAsString,
        certificate: telemetryCertificate,
        endpointType: apigateway.EndpointType.EDGE,
      }
    );

    telemetryDomainName.addBasePathMapping(telemetryApi, { basePath: "" });

    new CfnOutput(this, "tools-telemetry-api-target-hostname", {
      description: "hostname",
      value: `${telemetryDomainName.domainNameAliasDomainName}`,
    });
  }
}
