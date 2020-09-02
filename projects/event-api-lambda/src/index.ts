require("dotenv").config();

import awsServerlessExpress from "aws-serverless-express";
import { Handler } from "aws-lambda";
import { createApp } from "./application";

const app = createApp();

export const handler: Handler = (event, context) => {
  awsServerlessExpress.proxy(
    awsServerlessExpress.createServer(app),
    event,
    context
  );
};

// If require.main is the current module, this file was run
// directly by node, and we should start the app immediately –
// it's running locally.
if (require.main === module) {
  const port = 3132;

  app.listen(port, () => {
    console.log(`Event API app listening on port ${port}`);
  });
}
