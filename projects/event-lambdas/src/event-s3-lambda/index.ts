import AWS from "aws-sdk";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  S3Event,
} from "aws-lambda";

import { s3 } from "../lib/aws";
import { createOkResponse, createErrorResponse } from "../lib/response";
import { getEventsFromS3File, putEventsToKinesisStream } from "../lib/util";

export const lambdaHandler = async (
  event: S3Event
): Promise<APIGatewayProxyResult> => {
  const Bucket = event?.Records[0].s3.bucket.name;
  const Key = event?.Records[0].s3.object.key;

  if (!Bucket || !Key) {
    const message = "S3 data not present in received event";
    console.error(message, event);
    return {
      statusCode: 400,
      body: JSON.stringify(createErrorResponse(message, event)),
    };
  }

  const maybeEvents = await getEventsFromS3File(Key);

  if (maybeEvents.error) {
    const message = `Invalid data in file with key ${Key}`;
    console.error(message, maybeEvents.error);
    return {
      statusCode: 400,
      body: JSON.stringify(createErrorResponse(message, maybeEvents.error)),
    };
  }

  await putEventsToKinesisStream(maybeEvents.value);

  const message = `Written ${maybeEvents.value.length} events to Kinesis`;
  console.log(message);
  return {
    statusCode: 201,
    body: JSON.stringify(createOkResponse(message)),
  };
};
