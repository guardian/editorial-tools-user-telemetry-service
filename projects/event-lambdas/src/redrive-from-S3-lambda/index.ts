import {
  getEventsFromS3File,
  putEventsToKinesisStream,
  commenceScaleKinesisShardCount, augmentWithId,
} from "../lib/util";
import {s3} from "../lib/aws";
import {telemetryBucketName} from "../lib/constants";

const oneMinInMillis = 60 * 1000;
const tenMinsInMillis = 10 * oneMinInMillis;
const thirteenMinsInMillis = 13 * oneMinInMillis;

const SCALING_DOWN_KINESIS = "SCALING_DOWN_KINESIS" as const;
type MarkerDone = null;

export const handler = async (
  event: { Payload?: string | typeof SCALING_DOWN_KINESIS | unknown }
): Promise<string | MarkerDone | typeof SCALING_DOWN_KINESIS> => {

  const startTimeEpoch = new Date().getTime();

  if(event?.Payload === SCALING_DOWN_KINESIS) {
    while(new Date().getTime() - startTimeEpoch < thirteenMinsInMillis) {
      const targetShardCount = await commenceScaleKinesisShardCount("half");
      if(targetShardCount === 1) {
        console.log("Kinesis has scaled back down to 1 shard. Re-drive complete 🎉")
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, oneMinInMillis));
    }
    return SCALING_DOWN_KINESIS; // too close to timing out, so finish the lambda and allow the step function to loop
  }

  if(typeof event?.Payload !== "undefined" && typeof event?.Payload !== "string") {
    console.error("Invalid input.", event)
    throw Error("Invalid input. Expected string, got " + typeof event.Payload);
  }

  const maybeStartingMarker = event?.Payload;

  const processPageOfFiles = async (maybeMarker: string | undefined): Promise<string | MarkerDone> => {

    // we could instead turn on bucket inventory, and work through that
    // (this would mean we could start with latest, working back through time, as more recent is probably most useful/urgent)
    const pageOfFilesResponse = await s3.listObjects({
      Bucket: telemetryBucketName,
      Marker: maybeMarker,
      MaxKeys: 500, // although max is 1000, we want to ensure the lambda can send all the events before timing out and some event files are massive
    });

    const pageOfFiles = pageOfFilesResponse.Contents;

    if(!pageOfFiles || pageOfFiles.length === 0) {
      console.log("No files to process")
      return null;
    }

    console.log(`page of files: ${pageOfFiles.length}, starting at ${pageOfFilesResponse.Marker}`);

    const eventsArrays = await Promise.all(pageOfFiles.map(async (file, index) => {
      const Key = file.Key;

      if(!Key) {
        console.error("No key found in file", file);
        return [];
      }

      console.log(`Attempting to read from file (${index + 1} of ${pageOfFiles.length}) at s3://${telemetryBucketName}/${Key}`);

      const maybeEvents = await getEventsFromS3File(Key);

      if (maybeEvents.error) {
        console.error(`Invalid data in file with key ${Key}`, maybeEvents.error);
        return [];
      }

      return maybeEvents.value.map(augmentWithId(Key));
    }));

    const events = eventsArrays.flat();

    await putEventsToKinesisStream(events, {shouldThrowOnError: true, shouldScaleOnDemand: true });

    if(!pageOfFilesResponse.IsTruncated) {
      console.log("No more files to process.")
      return SCALING_DOWN_KINESIS;
    }

    const nextMarker = pageOfFilesResponse.NextMarker || pageOfFiles[pageOfFiles.length - 1].Key!;

    // so long as we have at least five mins before 15min timeout, do another page
    if(new Date().getTime() - startTimeEpoch < tenMinsInMillis) {
      return await processPageOfFiles(nextMarker);
    }

    return nextMarker; // too close to timing out, so finish the lambda and allow the step function to loop
  };

  return await processPageOfFiles(maybeStartingMarker || undefined); // coerce empty string etc to undefined, i.e. not starting marker;
}


