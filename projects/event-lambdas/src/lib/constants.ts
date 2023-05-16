export const telemetryBucketName =
  process.env.TELEMETRY_BUCKET_NAME || "user-telemetry-service";
export const telemetryStreamName =
  process.env.TELEMETRY_STREAM_NAME || "user-telemetry-stream";
export const pandaSettingsKey =
  process.env.PANDA_SETTINGS_KEY || "local.dev-gutools.co.uk.settings.public";
export const hmacSecretLocation =
  process.env.HMAC_SECRET_LOCATION ||
  "/DEV/flexible/user-telemetry-service/hmacSecret";
export const hmacAllowedDateOffsetInMillis = 5000;
