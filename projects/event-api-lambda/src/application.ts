import express from "express";
import { Request, Response } from "express";
import Ajv from "ajv";

import { createErrorResponse, createOkResponse } from "./response";
import { putEventsIntoS3Bucket, createParseEventJson } from "./util";

export const createApp = (): express.Application => {
  const app = express();
  const parseEventJson = createParseEventJson();

  app.get("/healthcheck", (_: Request, res: Response) => {
    res.send(createOkResponse("This is the Event API app."));
  });

  app.post(
    "/event",
    express.json({ limit: "1mb" }),
    async (req: Request, res: Response) => {
      if (!req.body) {
        return res.status(400).send("Missing request body");
      }

      const maybeEventData = parseEventJson(req.body);

      if (maybeEventData.error) {
        return res
          .status(400)
          .send(
            createErrorResponse("Incorrect event format", maybeEventData.error)
          );
      }

      const fileKey = await putEventsIntoS3Bucket(maybeEventData.value);
      console.log(
        `Added ${maybeEventData.value.length} telemetry event(s) to S3 at key ${fileKey}`
      );

      const response = createOkResponse(fileKey);
      res.status(201).send(response);
    }
  );

  return app;
};
