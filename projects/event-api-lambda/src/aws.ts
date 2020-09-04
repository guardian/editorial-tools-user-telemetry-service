import AWS from "aws-sdk";

/**
 * Is this application running locally, or in AWS?
 *
 * Heuristics:
 *  – if require.main is the current module, this file was run directly by node.
 *  – if jest is available globally, we're running in a test.
 */
export const isRunningLocally =
  !process.env.LAMBDA_TASK_ROOT && !process.env.AWS_EXECUTION_ENV;

// We use localstack to mock AWS services if we are running locally.
if (isRunningLocally) {
  AWS.config.update({
    accessKeyId: "xyz",
    secretAccessKey: "qwe",
    s3ForcePathStyle: true
  });
}

const awsOptions = isRunningLocally
  ? {
      endpoint: "http://localhost:4566",
    }
  : undefined;

export const s3 = new AWS.S3(awsOptions);
