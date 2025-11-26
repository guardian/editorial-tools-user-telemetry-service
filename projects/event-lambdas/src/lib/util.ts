import ndjson from "ndjson";
import Ajv from "ajv";
import { v4 as uuidv4 } from "uuid";
import cyrpto from "crypto";
import { TextEncoder } from "util";

import eventApiInputSchema from "../schema/eventApiInput.schema.json";
import { IUserTelemetryEvent } from "../../../definitions/IUserTelemetryEvent";
import { Either } from "./types";
import { s3, kinesis } from "./aws";
import { telemetryBucketName, telemetryStreamName } from "./constants";
import { PutRecordsRequestEntry } from "@aws-sdk/client-kinesis";
import {IUserTelemetryEventWithId} from "../../../definitions/IUserTelemetryEventWithId";

const ajv = new Ajv();
const validateEventApiInput = ajv.compile(eventApiInputSchema);

/**
 * Determines the stage (environment) from a hostname
 * @param hostname The hostname to extract stage from
 * @returns The extracted stage (uppercase) or undefined if stage cannot be determined
 */
export const determineStageFromHostname = (hostname: string): string | undefined => {
  if (!hostname) {
    return undefined;
  }
  
  const stageMatch = /^.*\.(?<environment>local|code)\.dev-gutools\.co\.uk$|^.*\.gutools\.co\.uk$/.exec(hostname);
  if (stageMatch) {
    return (stageMatch.groups?.environment || "PROD").toUpperCase();
  }
  
  return undefined;
};

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

    return (
      s3.putObject(params).then((_) => telemetryBucketKey)
    );
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
  const file = await s3.getObject(params);
  const fileBuffer = await file.Body?.transformToString() || "";
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

export const augmentWithId = (bucketKey: string) => (event: IUserTelemetryEvent): IUserTelemetryEventWithId => {
  const eventHash = cyrpto.createHash("sha1").update(JSON.stringify(event)).digest("hex");
  return {
    ...event,
    id: `${bucketKey.substring(bucketKey.lastIndexOf("/") + 1)}-${eventHash}`
  }
};

const oneMegabyteInBytes = 1024 * 1024;
const fiveMegabytesInBytes = 5 * oneMegabyteInBytes;
export const putEventsToKinesisStream = async (events: IUserTelemetryEventWithId[], options?: { shouldThrowOnError?: boolean, shouldScaleOnDemand?: boolean }) => {
  const mbPerSecondLimit = options?.shouldScaleOnDemand ? await commenceScaleKinesisShardCount("double") : 1;
  const chunkedRecords: PutRecordsRequestEntry[][] = events.reduce((acc, event) => {
    const dataString = JSON.stringify({
      "@timestamp": event.eventTime,
      ...event,
      tags: undefined, // 'tags' is a reserved field name since logstash v8...
      _tags: event.tags, // ... so now we re-write to _tags
    });
    const record: PutRecordsRequestEntry = {
      Data: new TextEncoder().encode(dataString),
      // Ordering doesn't matter
      PartitionKey: uuidv4(),
    };
    const currentChunk = acc[acc.length - 1];
    if(!currentChunk){
      return [[record]]
    }
    else if(currentChunk.length < 500 && Buffer.byteLength(JSON.stringify(currentChunk) + JSON.stringify(record)) < fiveMegabytesInBytes){
      return [...acc.slice(0, -1), [...currentChunk, record]];
    }
    else {
      return [...acc, [record]];
    }
  }, [] as PutRecordsRequestEntry[][]);

  for (const Records of chunkedRecords) {
    const chunkStartTime = new Date().getTime();
    const putRecordsResult = await kinesis.putRecords({
      Records,
      StreamName: telemetryStreamName,
    });

    const recordsWithErrors = putRecordsResult.Records?.filter(_ => !!_.ErrorCode);
    if(recordsWithErrors && recordsWithErrors.length > 0) {
      console.error("Failed to write some records to Kinesis", recordsWithErrors)
      if(options?.shouldThrowOnError){
        throw new Error(`Failed to write ${recordsWithErrors.length} records to Kinesis. Terminating.`)
      }
    }

    console.log(`Written ${Records.length} of ${events.length} events to Kinesis`);

    const chunkEndTime = new Date().getTime();
    const chunkDurationInMillis = chunkEndTime - chunkStartTime;
    const spacingMillisBasedOnMbPerSecondLimit = 1000 / mbPerSecondLimit;

    if(chunkedRecords.length > 1 && chunkDurationInMillis < spacingMillisBasedOnMbPerSecondLimit){
      await new Promise(resolve => setTimeout(resolve, spacingMillisBasedOnMbPerSecondLimit - chunkDurationInMillis));
    }
  }
};

export const getEventsFromKinesisStream = async () => {
  const streamDescription = await kinesis
    .describeStream({ StreamName: telemetryStreamName });
  const shardIterator = await kinesis
    .getShardIterator({
      ShardId: streamDescription.StreamDescription?.Shards?.[0]?.ShardId!,
      StreamName: telemetryStreamName,
      ShardIteratorType: "TRIM_HORIZON",
    });
  return await kinesis
    .getRecords({
      ShardIterator: shardIterator.ShardIterator!,
    });
};

export const commenceScaleKinesisShardCount = async (operation: "double" | "half"): Promise<number> => {
  const streamStatus = await kinesis.describeStream({ StreamName: telemetryStreamName })
    .then(_ => _.StreamDescription?.StreamStatus);
  // if lots of scaling has taken place in the retention period of the stream, there are too may shards returned in the describeStream result, so we need to count shards explicitly
  const activeShards = await kinesis.listShards({ StreamName: telemetryStreamName, ShardFilter: { Type: "AT_LATEST" }})
    .then(_ => _.Shards!.filter(_ => !_.SequenceNumberRange?.EndingSequenceNumber));
  const currentShardCount = activeShards.length;

  if(streamStatus === "UPDATING"){
    console.log("Kinesis stream is already updating");
    return currentShardCount;
  }
  else if(operation === "half" && currentShardCount === 1){
    console.log("Kinesis stream is already at 1 shard");
    return currentShardCount;
  }
  else if(operation === "half"){
    const desiredShards = Math.ceil(currentShardCount / 2);
    console.log("Scaling down Kinesis stream to", desiredShards, "shards...");
    await kinesis.updateShardCount({
      StreamName: telemetryStreamName,
      TargetShardCount: desiredShards,
      ScalingType: "UNIFORM_SCALING",
    });
    return desiredShards; // when scaling down we can return the desired number of shards, so that if we're still sending messages we don't send too many once the reduced shard count kicks in
  }
  else if(operation === "double" && currentShardCount >= 32){
    // we can only reach 32 shards and scale back down in the same 24-hour period, so do nothing
    console.log("Kinesis stream is already at 32 shards, not scaling up further");
    return currentShardCount;
  }
  else {
    const desiredShards = currentShardCount * 2;
    console.log("Scaling up Kinesis stream to", desiredShards, "shards...");
    await kinesis.updateShardCount({
      StreamName: telemetryStreamName,
      TargetShardCount: desiredShards,
      ScalingType: "UNIFORM_SCALING",
    });
    return currentShardCount; //  return current shard count since it takes a few mins to update, and we don't want to get throttled
  }
}

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
