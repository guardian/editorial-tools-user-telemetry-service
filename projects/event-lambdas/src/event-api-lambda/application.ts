import express from "express";
import { Request, Response } from "express";

import { putEventsIntoS3Bucket, parseEventJson } from "../lib/util";
import { panda, authenticated } from "../lib/authentication";
import { applyErrorResponse, applyOkResponse } from "./util";
import type { InitConfig } from "./index";
import { hmacAllowedDateOffsetInMillis } from "../lib/constants";
import { PandaHmacAuthentication } from "../lib/panda-hmac";

export const createApp = (initConfig: InitConfig): express.Application => {
  const app = express();

  const hmac = new PandaHmacAuthentication(
    hmacAllowedDateOffsetInMillis,
    initConfig.hmacSecrets
  );

  app.use((req, res, next) => {
    const host = req.get("origin") || "";
    if (
      host.endsWith(".gutools.co.uk") ||
      host.endsWith(".dev-gutools.co.uk")
    ) {
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Origin", req.get("origin"));
      res.header("Access-Control-Allow-Methods", "OPTIONS,POST,GET");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    next();
  });

  app.get("/healthcheck", (_: Request, res: Response) => {
    applyOkResponse(res, 200, "This is the Event API app.");
  });

  app.post(
    "/event",
    express.json({ limit: "1mb" }),
    async (req: Request, res: Response) =>
      authenticated(panda, hmac, req, res, async () => {
        if (!req.body) {
          applyErrorResponse(res, 401, "Missing request body");
          return;
        }

        const maybeEventData = parseEventJson(req.body);

        if (maybeEventData.error) {
          applyErrorResponse(
            res,
            400,
            "Incorrect event format",
            maybeEventData.error
          );
          return;
        }

        const fileKey = await putEventsIntoS3Bucket(maybeEventData.value);
        console.log(
          `Added ${maybeEventData.value.length} telemetry event(s) to S3 at key ${fileKey}`
        );

        applyOkResponse(res, 201, fileKey);
      })
  );

  return app;
};
