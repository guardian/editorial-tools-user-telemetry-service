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
  events: IUserTelemetryEvent[],
  key?: string
): Promise<string[]> => {
  if (!telemetryBucketName) {
    throw new Error(
      `Configuration error: no value provided for environment variable TELEMETRY_BUCKET_NAME`
    );
  }

  // Group records by app/stage/type for writing to S3
  // 
  // This function is unlikely to receive batched records  
  // from multiple sources at present, but account for this
  // now to prevent possible future issues.
  const recordBatchesToWrite = events.reduce(
    (
      recordsByPrefix: Record<string, IUserTelemetryEvent[]>, 
      currentEvent: IUserTelemetryEvent
    ) => {
      const eventPathPrefix = [
        currentEvent.app || "UNDEFINED",
        currentEvent.stage || "UNDEFINED",
        currentEvent.type || "UNDEFINED",
      ].join("/");

      return eventPathPrefix in recordsByPrefix ? {...recordsByPrefix,
        [eventPathPrefix]: recordsByPrefix[eventPathPrefix].concat([currentEvent])
      } : {...recordsByPrefix,
        [eventPathPrefix]: [currentEvent]
      }
    },
    {} as Record<string, IUserTelemetryEvent[]>
  );

  const keysWritten = await Promise.all(Object.entries(recordBatchesToWrite).map(([pathPrefix, eventBatch]) => {
    // Data is partitioned by app, stage, type and day, in format YYYY-MM-DD. 
    // The filename contains an ISO date to aid discovery, and a uuid to ensure uniqueness.
    const now = new Date();
    const telemetryBucketKey =
      key || `data/${pathPrefix}/${getYYYYmmddDate(now)}/${now.toISOString()}-${uuidv4()}`;
    const eventBatchJSON = convertEventsToNDJSON(eventBatch);

    const params = {
      Bucket: telemetryBucketName,
      Key: telemetryBucketKey,
      Body: eventBatchJSON,
      ContentType: "application/json",
    };

    return s3.putObject(params).promise().then((_) => telemetryBucketKey)
  }))

  return keysWritten;
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
  const Records = events.map((event) => ({
    Data: JSON.stringify(event),
    // Ordering doesn't matter
    PartitionKey: uuidv4(),
  }));
  const params = {
    Records,
    StreamName: telemetryStreamName,
  };
  return kinesis.putRecords(params).promise();
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
