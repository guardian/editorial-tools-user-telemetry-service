import fetch from "node-fetch";
import { secretManager } from "../lib/aws";
import { get } from "lodash";

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
    const responseBody = await response.json() as unknown as { SecretString: string, CreatedDate: string };
    if (response.ok && responseBody.SecretString && responseBody.CreatedDate) {
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
    return { stage };
  }
};

const delay = (delayInMs: number) => new Promise(resolve => setTimeout(resolve, delayInMs));
const retry = async (
  getSecretFn: () => Promise<SecretValue>,
  maxAttempts: number,
  retryDelayMs: number
): Promise<SecretValue> => {

  const secretValue = await getSecretFn();
  if (secretValue.value) {
    return secretValue;
  }
  else {
    if (maxAttempts <= 1) {
      console.log(`Error: failed to get secret.  Maximum number of attempts reached.`);
      return secretValue;
    }
    else {
      console.log(`Error: failed to get secret.  Retrying in ${retryDelayMs} ms.  Attempt ${maxAttempts - 1}`);
      return delay( retryDelayMs ).then(() => retry(getSecretFn, maxAttempts - 1, retryDelayMs));
    }
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
      availableStages.map((stage) => retry(() => getSecret(secretArn, stage), 3, 500))
    )
  ).filter((secretValue) => isValidSecret(secretValue, maxAgeInSeconds));
