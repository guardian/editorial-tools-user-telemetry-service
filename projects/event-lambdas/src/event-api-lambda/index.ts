import awsServerlessExpress from "aws-serverless-express";
import { Handler } from "aws-lambda";

import { createApp } from "./application";
import { isRunningLocally, secretManager } from "../lib/aws";
import { hmacSecretLocation } from "../lib/constants";
import { getValidSecrets } from "../lib/secrets";

export type InitConfig = {
  hmacSecrets: string[];
};

// Runs during the Lambda initialisation phase
// See https://docs.aws.amazon.com/lambda/latest/operatorguide/static-initialization.html
async function initialise(): Promise<InitConfig> {
  // Get valid secrets for the HMAC key
  const validSecrets = await getValidSecrets(hmacSecretLocation);
  const hmacSecrets = validSecrets.reduce(
    (acc, curr) => (curr.value ? acc.concat([curr.value]) : acc),
    [] as string[]
  );

  return {
    hmacSecrets
  };
}

export const handler: Handler = async (event, context) => {
  const initConfig = await initialise();
  const app = createApp(initConfig);

  awsServerlessExpress.proxy(
    awsServerlessExpress.createServer(app),
    event,
    context
  );
};

if (isRunningLocally) {
  const port = 3132;

  initialise().then((initConfig) => {
    const app = createApp(initConfig);

    app.listen(port, async () => {
      console.log(`Event API app listening on port ${port}`);
    });
  });
}
