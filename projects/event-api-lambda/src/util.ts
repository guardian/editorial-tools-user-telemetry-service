import ndjson from "ndjson";
import Ajv from "ajv";
import { v4 as uuidv4 } from 'uuid';

import eventApiInputSchema from "./schema/eventApiInput.schema.json";
import { IUserTelemetryEvent } from "../../definitions/IUserTelemetryEvent";
import { Either } from "./types";
import { s3 } from "./aws";
import { telemetryBucketName } from "./constants";

/**
 * @return The key of the file that's been added.
 */
export const putEventsIntoS3Bucket = async (events: IUserTelemetryEvent[]): Promise<string> => {
  if (!telemetryBucketName) {
    throw new Error(
      `Configuration error: no value provided for environment variable TELEMETRY_BUCKET_NAME`
    );
  }

  // Data is partitioned by day, in format YYYY-MM-DD. The filename
  // contains an ISO date to aid discovery, and a uuid to ensure uniqueness.
  const now = new Date();
  const telemetryBucketKey = `data/${getYYYYmmddDate(now)}/${now.toISOString()}-${uuidv4()}`;
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

export const convertEventsToNDJSON = (events: IUserTelemetryEvent[]) => {
  const stringify = ndjson.stringify();
  let buffer = "";
  stringify.on("data", (line) => (buffer += line));
  events.forEach((event) => stringify.write(event));
  stringify.end();
  return buffer;
};

export const createParseEventJson = () => {
  const ajv = new Ajv();
  const validateEventApiInput = ajv.compile(eventApiInputSchema);

  return (
    maybeEventJson: unknown
  ): Either<IUserTelemetryEvent[], Ajv.ErrorObject[]> => {
    const isInputValid = validateEventApiInput(maybeEventJson);
    if (!isInputValid) {
      const error = validateEventApiInput.errors!;
      return left(error);
    }
    return right(maybeEventJson as IUserTelemetryEvent[]);
  };
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
