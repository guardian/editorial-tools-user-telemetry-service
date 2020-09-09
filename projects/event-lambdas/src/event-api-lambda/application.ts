import express from "express";
import { Request, Response } from "express";

import { createErrorResponse, createOkResponse } from "../lib/response";
import { putEventsIntoS3Bucket, parseEventJson } from "../lib/util";

import { panda, authenticated } from "../lib/authentication";

export const createApp = (): express.Application => {
  const app = express();

  app.use((req, res, next) => {
    const host = req.get('origin') || '';
    if (host.endsWith(".gutools.co.uk") || host.endsWith(".dev-gutools.co.uk")) {
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Origin", req.get('origin'));
      res.header("Access-Control-Allow-Methods", "OPTIONS,POST,GET");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    next();
  });

  app.get("/healthcheck", (_: Request, res: Response) => {
    res.send(createOkResponse(200, "This is the Event API app."));
  });

  app.post(
    "/event",
    express.json({ limit: "1mb" }),
    async (req: Request, res: Response) =>
      authenticated(panda, req, async () => {
        if (!req.body) {
          return createErrorResponse(401, "Missing request body");
        }

        const maybeEventData = parseEventJson(req.body);

        if (maybeEventData.error) {
          return createErrorResponse(
            400,
            "Incorrect event format",
            maybeEventData.error
          );
        }

        const fileKey = await putEventsIntoS3Bucket(maybeEventData.value);
        console.log(
          `Added ${maybeEventData.value.length} telemetry event(s) to S3 at key ${fileKey}`
        );

        return createOkResponse(201, fileKey);
      })
  );

  return app;
};
