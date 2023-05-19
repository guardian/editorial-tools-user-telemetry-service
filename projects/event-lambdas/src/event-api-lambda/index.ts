import awsServerlessExpress from "aws-serverless-express";
import { Handler } from "aws-lambda";

import { createApp } from "./application";
import { isRunningLocally } from "../lib/aws";
import { hmacSecretLocation, pandaSettingsKey } from "../lib/constants";
import { getValidSecrets } from "../lib/secrets";

import { PandaHmacAuthentication } from "../lib/panda-hmac";
import { hmacAllowedDateOffsetInMillis } from "../lib/constants";

import {
  PanDomainAuthentication,
  guardianValidation,
} from "@guardian/pan-domain-node";

export type AppConfig = {
  pandaHmacAuthentication: Pick<PandaHmacAuthentication, "verify">;
  panDomainAuthentication: Pick<PanDomainAuthentication, "verify">;
};

// Runs during the Lambda initialisation phase
// See https://docs.aws.amazon.com/lambda/latest/operatorguide/static-initialization.html
async function initialise(): Promise<AppConfig> {
  console.log("Running initialisation phase");

  // Get valid secrets for the HMAC key
  const validSecrets = await getValidSecrets(hmacSecretLocation);
  const hmacSecrets = validSecrets.reduce(
    (acc, curr) => (curr.value ? acc.concat([curr.value]) : acc),
    [] as string[]
  );

  const pandaHmacAuthentication = new PandaHmacAuthentication(
    hmacAllowedDateOffsetInMillis,
    hmacSecrets
  );

  const panDomainAuthentication = new PanDomainAuthentication(
    "gutoolsAuth-assym", // cookie name
    "eu-west-1", // AWS region
    "pan-domain-auth-settings", // Settings bucket
    pandaSettingsKey, // Settings file
    guardianValidation
  );

  return {
    pandaHmacAuthentication,
    panDomainAuthentication,
  };
}

const appConfig = initialise();

export const handler: Handler = async (event, context) => {
  console.log("Lambda handler called, processing request.");

  const app = createApp(await appConfig);

  return await awsServerlessExpress.proxy(
    awsServerlessExpress.createServer(app),
    event,
    context,
    "PROMISE"
  ).promise;
};

if (isRunningLocally) {
  const port = 3132;

  appConfig.then((initConfig) => {
    const app = createApp(initConfig);

    app.listen(port, async () => {
      console.log(`Event API app listening on port ${port}`);
    });
  });
}
