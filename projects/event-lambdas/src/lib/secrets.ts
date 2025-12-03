import fetch from "node-fetch";
import { secretManager } from "../lib/aws";

const availableStages = ["AWSPREVIOUS", "AWSCURRENT"] as const;
export type SecretStage = (typeof availableStages)[number];
export type SecretValue = {
  stage: SecretStage;
  value?: string;
  createdDate?: Date;
};

export type GetSecret = (
  secretArn: string,
  stage: SecretStage
) => Promise<SecretValue>;

const getSecretFromAws: GetSecret = async (
  secretArn: string,
  stage: SecretStage
): Promise<SecretValue> => {
  try {
    const response = await fetch(`http://localhost:2773/secretsmanager/get?secretId=${secretArn}&versionStage=${stage}`,
        {headers: {'X-AWS-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN!}})
    const responseBody = await response.json() as unknown as { SecretString: string, CreatedDate: string, VersionStages: string[] };
    if (response.ok && responseBody.SecretString && responseBody.CreatedDate) {
      console.log(`Successfully retrieved secret for stage ${stage} CreatedDate: ${responseBody.CreatedDate} VersionStages: ${responseBody.VersionStages.join(", ")}`);
      return {
        stage,
        value: responseBody.SecretString,
        createdDate: new Date(responseBody.CreatedDate)
      };
    } else {
      console.log(`Error: failed to get secret for stage ${stage} response ${response.status} ${response.statusText} CreatedDate: ${responseBody.CreatedDate}`);
      return { stage };
    }
  } catch (e) {
    console.log(`Error: failed to get secret for stage ${stage}`, e);
    return {
      stage,
    };
  }
};      

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
  secretArn: string,
  maxAgeInSeconds: number = defaultMaxAgeInSeconds,
  getSecret: GetSecret = getSecretFromAws
) =>
  (
    await Promise.all(
      availableStages.map((stage) => getSecret(secretArn, stage))
    )
  ).filter((secretValue) => isValidSecret(secretValue, maxAgeInSeconds));
