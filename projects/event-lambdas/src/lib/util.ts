import ndjson from "ndjson";
import Ajv from "ajv";
import { v4 as uuidv4 } from "uuid";

import eventApiInputSchema from "../schema/eventApiInput.schema.json";
import { IUserTelemetryEvent } from "../../../definitions/IUserTelemetryEvent";
import { Either } from "./types";
import { s3, kinesis } from "./aws";
import { telemetryBucketName, telemetryStreamName } from "./constants";

const ajv = new Ajv();
const validateEventApiInput = ajv.compile(eventApiInputSchema);

export const parseEventJson = (
  maybeEventJson: unknown
): Either<IUserTelemetryEvent[], Ajv.ErrorObject[]> => {
  const isInputValid = validateEventApiInput(maybeEventJson);
  if (!isInputValid) {
    const error = validateEventApiInput.errors!;
    return left(error);
  }
  return right(maybeEventJson as IUserTelemetryEvent[]);
};

/**
 * @return The key of the file that's been added.
 */
export const putEventsIntoS3Bucket = async (
  events: IUserTelemetryEvent[]
): Promise<string> => {
  if (!telemetryBucketName) {
    throw new Error(
      `Configuration error: no value provided for environment variable TELEMETRY_BUCKET_NAME`
    );
  }

  // Data is partitioned by day, in format YYYY-MM-DD. The filename
  // contains an ISO date to aid discovery, and a uuid to ensure uniqueness.
  const now = new Date();
  const telemetryBucketKey = `data/${getYYYYmmddDate(
    now
  )}/${now.toISOString()}-${uuidv4()}`;
  const eventsJSON = convertEventsToNDJSON(events);

  const params = {
    Bucket: telemetryBucketName,
    Key: telemetryBucketKey,
    Body: eventsJSON,
    ContentType: "application/json",
  };

  await s3.putObject(params).promise();
  return telemetryBucketKey;
};

export const getEventsFromS3File = async (
  Key: string
): Promise<Either<IUserTelemetryEvent[], Ajv.ErrorObject[]>> => {
  const params = {
    Bucket: telemetryBucketName,
    Key,
  };
  const file = await s3.getObject(params).promise();
  const fileBuffer = file.Body?.toString() || "";
  const maybeEventsObject = convertNDJSONToEvents(fileBuffer);
  return parseEventJson(maybeEventsObject);
};

export const convertEventsToNDJSON = (events: IUserTelemetryEvent[]) => {
  const stringify = ndjson.stringify();
  let buffer = "";
  stringify.on("data", (line) => (buffer += line));
  events.forEach((event) => stringify.write(event));
  stringify.end();
  return buffer;
};

export const convertNDJSONToEvents = (json: string) => {
  const parse = ndjson.parse();
  const events: IUserTelemetryEvent[] = [];
  parse.on("data", (line) => events.push(line));
  parse.write(json);
  parse.end();
  return events;
};

export const putEventsToKinesisStream = (events: IUserTelemetryEvent[]) => {
  const params = {
    Data: convertEventsToNDJSON(events),
    PartitionKey: uuidv4(),
    StreamName: telemetryStreamName,
  };
  return kinesis.putRecord(params).promise();
};

export const getEventsFromKinesisStream = async () => {
  const streamDescription = await kinesis
    .describeStream({ StreamName: telemetryStreamName })
    .promise();
  const shardIterator = await kinesis
    .getShardIterator({
      ShardId: streamDescription.StreamDescription.Shards[0].ShardId,
      StreamName: telemetryStreamName,
      ShardIteratorType: "TRIM_HORIZON",
    })
    .promise();
  return await kinesis
    .getRecords({
      ShardIterator: shardIterator.ShardIterator!,
    })
    .promise();
};

export const getYYYYmmddDate = (date: Date) => date.toISOString().split("T")[0];

/**
 * Constructors for the Either type.
 */
export const left = <Value, Error>(error: Error): Either<Value, Error> => ({
  value: undefined,
  error,
});
export const right = <Value, Error>(value: Value): Either<Value, Error> => ({
  value,
  error: undefined,
});
