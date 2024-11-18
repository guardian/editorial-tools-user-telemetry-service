import ndjson from "ndjson";
import Ajv from "ajv";
import { v4 as uuidv4 } from "uuid";

import eventApiInputSchema from "../schema/eventApiInput.schema.json";
import { IUserTelemetryEvent } from "../../../definitions/IUserTelemetryEvent";
import { Either } from "./types";
import { s3, kinesis } from "./aws";
import { telemetryBucketName, telemetryStreamName } from "./constants";
import {PutRecordsRequestEntryList} from "aws-sdk/clients/kinesis";

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

const fiveMegabyteInBytes = 5 * 1024 * 1024;
export const putEventsToKinesisStream = async (events: IUserTelemetryEvent[], options?: { shouldThrowOnError?: boolean }) => {
  const chunkedRecords: PutRecordsRequestEntryList[] = events.reduce((acc, event) => {
    const record = {
      Data: JSON.stringify({
        "@timestamp": event.eventTime,
        ...event,
        tags: undefined, // 'tags' is a reserved field name since logstash v8...
        _tags: event.tags, // ... so now we re-write to _tags
      }),
      // Ordering doesn't matter
      PartitionKey: uuidv4(),
    };
    const currentChunk = acc[acc.length - 1];
    if(!currentChunk){
      return [[record]]
    }
    // we no longer care about the 1MB/s limit, since we're using ON_DEMAND capacity mode
    else if(currentChunk.length < 500 && Buffer.byteLength(JSON.stringify(currentChunk) + JSON.stringify(record)) < fiveMegabyteInBytes){
      return [...acc.slice(0, -1), [...currentChunk, record]];
    }
    else {
      return [...acc, [record]];
    }
  }, [] as PutRecordsRequestEntryList[]);

  for (const Records of chunkedRecords) {
    const putRecordsResult = await kinesis.putRecords({
      Records,
      StreamName: telemetryStreamName,
    }).promise();

    const recordsWithErrors = putRecordsResult.Records.filter(_ => !!_.ErrorCode);
    if(recordsWithErrors.length > 0) {
      console.error("Failed to write some records to Kinesis", recordsWithErrors)
      if(options?.shouldThrowOnError){
        throw new Error(`Failed to write ${recordsWithErrors.length} records to Kinesis. Terminating.`)
      }
    }

    console.log(`Written ${Records.length} of ${events.length} events to Kinesis`);
  }
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
