import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { Kinesis } from "@aws-sdk/client-kinesis";
import { S3 } from "@aws-sdk/client-s3";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

/**
 * Is this application running locally, or in AWS?
 *
 * Heuristics:
 *  – if require.main is the current module, this file was run directly by node.
 *  – if jest is available globally, we're running in a test.
 */
export const isRunningLocally =
  !process.env.LAMBDA_TASK_ROOT && !process.env.AWS_EXECUTION_ENV;

const awsOptions = isRunningLocally
  ? {
      // We use localstack to mock AWS services if we are running locally.
      credentials: {
        accessKeyId: "xyz",
        secretAccessKey: "qwe",
      },
      forcePathStyle: true,
      region: "eu-west-1",
      endpoint: "http://localhost:4566"
    }
  : { credentials: fromNodeProviderChain()};

export const s3 = new S3(awsOptions);
export const kinesis = new Kinesis(awsOptions);
export const secretManager = new SecretsManager(awsOptions);
