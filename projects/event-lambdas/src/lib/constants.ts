export const telemetryBucketName =
  process.env.TELEMETRY_BUCKET_NAME || "user-telemetry-service";
export const telemetryStreamName =
  process.env.TELEMETRY_STREAM_NAME || "user-telemetry-stream";
export const pandaSettingsKey =
  process.env.PANDA_SETTINGS_KEY || "local.dev-gutools.co.uk.settings.public";
export const hmacSecretKeyArn = process.env.HMAC_SECRET_KEY_ARN;
export const hmacAllowedDateOffsetInMillis = 300000;
export const app =
    process.env.APP || "user-telemetry";
export const stage =
    process.env.STAGE || "DEV";