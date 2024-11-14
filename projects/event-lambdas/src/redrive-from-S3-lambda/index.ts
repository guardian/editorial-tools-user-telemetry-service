import {getEventsFromS3File, putEventsToKinesisStream} from "../lib/util";
import {s3} from "../lib/aws";
import {telemetryBucketName} from "../lib/constants";
import {Marker} from "aws-sdk/clients/s3";

const tenMinsInMillis = 10 * 60 * 1000;

type MarkerDone = null;

export const handler = async (
  event: { Payload?: Marker | unknown }
): Promise<Marker | MarkerDone> => {

  const startTimeEpoch = new Date().getTime();

  if(typeof event?.Payload !== "undefined" && typeof event?.Payload !== "string") {
    console.error("Invalid input.", event)
    throw Error("Invalid input. Expected string, got " + typeof event.Payload);
  }

  const maybeStartingMarker = event?.Payload;

  const processPageOfFiles = async (maybeMarker: Marker | undefined): Promise<Marker | MarkerDone> => {

    // we could instead turn on bucket inventory, and work through that
    // (this would mean we could start with latest, working back through time, as more recent is probably most useful/urgent)
    const pageOfFilesResponse = await s3.listObjects({
      Bucket: telemetryBucketName,
      Marker: maybeMarker,
      MaxKeys: 1000, // max allowed
    }).promise();

    const pageOfFiles = pageOfFilesResponse.Contents;

    if(!pageOfFiles || pageOfFiles.length === 0) {
      console.log("No files to process")
      return null;
    }


    console.log(`page of files: ${pageOfFiles.length}, starting at ${pageOfFilesResponse.Marker}`);

    const eventsArrays = await Promise.all(pageOfFiles.map(async (file) => {
      const Key = file.Key;

      if(!Key) {
        console.error("No key found in file", file);
        return [];
      }

      const position = pageOfFiles.indexOf(file) + 1;

      console.log(`Attempting to read from file (${position} of ${pageOfFiles.length}) at s3://${telemetryBucketName}/${Key}`);

      const maybeEvents = await getEventsFromS3File(Key);

      if (maybeEvents.error) {
        console.error(`Invalid data in file with key ${Key}`, maybeEvents.error);
        return [];
      }

      return maybeEvents.value;
    }));

    const events = eventsArrays.flat();

    for(let i = 0; i < Math.ceil(events.length / 50); i++) {
      const chunk = events.slice(i * 50, (i + 1) * 50);
      chunk.length > 0 && await putEventsToKinesisStream(chunk);
      console.log(`Written ${chunk.length} of ${events.length} events to Kinesis`);
      // one batch of records per second to avoid kinesis throttling
      await (new Promise(resolve => setTimeout(resolve, 1000)));
    }

    if(!pageOfFilesResponse.IsTruncated) {
      console.log("No more files to process. Re-drive complete 🎉")
      return null;
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

