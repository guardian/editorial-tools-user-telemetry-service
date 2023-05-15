export const telemetryBucketName =
  process.env.TELEMETRY_BUCKET_NAME || "user-telemetry-service";
export const telemetryStreamName =
  process.env.TELEMETRY_STREAM_NAME || "user-telemetry-stream";
export const pandaSettingsKey =
  process.env.PANDA_SETTINGS_KEY || "local.dev-gutools.co.uk.settings.public";
// TODO: The app should not have a default value, and should fail if one is not set
export const hmacSecretKey =
    process.env.HMAC_SECRET_KEY || "changeme";
export const hmacAllowedDateOffsetInMillis =
    process.env.HMAC_DATE_OFFSET_IN_MILLIS || 5000;
