import awsServerlessExpress from "aws-serverless-express";
import { Handler } from "aws-lambda";

import { createApp } from "./application";
import { isRunningLocally } from "../lib/aws";
import { hmacSecretLocation } from '../lib/constants'
import { secretManager } from '../lib/aws';


export interface InitConfig {
  hmacSecret: string
}

// Runs during the Lambda initialisation phase
// See https://docs.aws.amazon.com/lambda/latest/operatorguide/static-initialization.html
async function initialise(): Promise<InitConfig> {
  // TODO: Pull current and previous stage for secret, and handle stale previous
  const hmacSecret = (
    await secretManager.getSecretValue({SecretId: hmacSecretLocation}).promise()
  ).SecretString as string

  return {
    hmacSecret
  }
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

  initialise().then((initConfig) =>{
    const app = createApp(initConfig);

    app.listen(port, async () => {
      console.log(`Event API app listening on port ${port}`);
    });
  })
}
