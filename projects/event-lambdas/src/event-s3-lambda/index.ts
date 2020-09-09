import { APIGatewayProxyResult, S3Event } from "aws-lambda";

import { createOkResponse, createErrorResponse } from "../lib/response";
import { getEventsFromS3File, putEventsToKinesisStream } from "../lib/util";

export const handler = async (
  event: S3Event
): Promise<APIGatewayProxyResult> => {
  const Bucket = event?.Records[0]?.s3?.bucket.name;
  const Key = decodeURIComponent(event?.Records[0]?.s3?.object.key);

  console.log(`Attempting to read from file at s3://${Bucket}/${Key}`);

  if (!Bucket || !Key) {
    const message = "S3 data not present in received event";
    console.error(message, event);
    return createErrorResponse(400, message, event);
  }

  const maybeEvents = await getEventsFromS3File(Key);

  if (maybeEvents.error) {
    const message = `Invalid data in file with key ${Key}`;
    console.error(message, maybeEvents.error);
    return createErrorResponse(400, message, maybeEvents.error);
  }

  await putEventsToKinesisStream(maybeEvents.value);

  const message = `Written ${maybeEvents.value.length} events to Kinesis`;
  console.log(message);
  return createOkResponse(201, message);
};
