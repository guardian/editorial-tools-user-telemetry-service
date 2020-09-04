require("dotenv").config();

import awsServerlessExpress from "aws-serverless-express";
import { Handler } from "aws-lambda";

import { createApp } from "./application";
import { isRunningLocally } from "./aws";

const app = createApp();

export const handler: Handler = (event, context) => {
  awsServerlessExpress.proxy(
    awsServerlessExpress.createServer(app),
    event,
    context
  );
};

if (isRunningLocally) {
  const port = 3132;

  app.listen(port, () => {
    console.log(`Event API app listening on port ${port}`);
  });
}
