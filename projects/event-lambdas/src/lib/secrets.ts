import { secretManager } from "../lib/aws";

const availableStages = ["AWSPREVIOUS", "AWSCURRENT"] as const;
export type SecretStage = (typeof availableStages)[number];
export type SecretValue = {
  stage: SecretStage;
  value?: string;
  createdDate?: Date;
};

export type GetSecret = (
  secretId: string,
  stage: SecretStage
) => Promise<SecretValue>;

const getSecretFromAws: GetSecret = (
  secretId: string,
  stage: SecretStage
): Promise<SecretValue> =>
  secretManager
    .getSecretValue({
      SecretId: secretId,
      VersionStage: stage,
    })
    .promise()
    .then((secret) => ({
      stage,
      value: secret.SecretString,
      createdDate: secret.CreatedDate,
    }))
    .catch((_) => ({
      stage,
    }));

function isYoungerThanInSeconds(date: Date, maxAgeInSeconds: number) {
  const currentTimeInMillis = Date.now();
  const dateInMillis = date.getTime();
  const ageInMillis = currentTimeInMillis - dateInMillis;

  return ageInMillis < maxAgeInSeconds * 1000;
}

const isValidSecret = (secretValue: SecretValue, maxAgeInSeconds: number) =>
  secretValue.stage === "AWSCURRENT" ||
  (secretValue.stage === "AWSPREVIOUS" &&
    secretValue.value !== undefined &&
    secretValue.createdDate !== undefined &&
    isYoungerThanInSeconds(secretValue.createdDate, maxAgeInSeconds));

// Default maximum age is 5 days (5 * 24 * 60 * 60)
export const defaultMaxAgeInSeconds = 432000;

export const getValidSecrets = async (
  secretId: string,
  maxAgeInSeconds: number = defaultMaxAgeInSeconds,
  getSecret: GetSecret = getSecretFromAws
) =>
  (
    await Promise.all(
      availableStages.map((stage) => getSecret(secretId, stage))
    )
  ).filter((secretValue) => isValidSecret(secretValue, maxAgeInSeconds));
