import express from "express";
import { Request, Response } from "express";

import { putEventsIntoS3Bucket, parseEventJson } from "../lib/util";
import {authenticated, authenticatePandaUser} from "../lib/authentication";
import { applyErrorResponse, applyOkResponse } from "./util";
import type { AppConfig } from "./index";
import {User} from "@guardian/pan-domain-node";
import {IUserTelemetryEvent} from "../../../definitions/IUserTelemetryEvent";
import * as url from "url";

export const createApp = (initConfig: AppConfig): express.Application => {
  const app = express();

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
      res.header("Access-Control-Max-Age", "86400");
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
      authenticated(
        initConfig.panDomainAuthentication,
        initConfig.pandaHmacAuthentication,
        req,
        res,
        async () => {
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

          applyOkResponse(res, 201, fileKey.join(","));
        }
      )
  );

  app.get("/tracking-pixel",
    async (req: Request, res: Response) =>
      authenticatePandaUser(
        initConfig.panDomainAuthentication,
        req,
        res,
        async ({email}: User) => {
          const {app, stage, path} = req.query;
          const referrer = url.parse(req.header("referrer") || "");

          if (!email ||
              !app || typeof app !== "string" ||
              !stage || typeof stage !== "string" ||
              !path || typeof path !== "string"
          ) {
            applyErrorResponse(
                res,
                400,
                "Incorrect event format"
            );
            return;
            }

            const viewEvent: IUserTelemetryEvent = {
              app: "tools-audit",
              stage: "INFRA",
              type: "GUARDIAN_TOOL_ACCESSED",
              value: true,
              eventTime: new Date().toISOString(),
              tags: {
                email,
                stage,
                app,
                path,
                ...(referrer.hostname && {
                    ["referrer-hostname"]: referrer.hostname
                }),
                ...(referrer.pathname && {
                    ["referrer-pathname"]: referrer.pathname
                })
              }
            }

            const fileKey = await putEventsIntoS3Bucket([viewEvent]);
            console.log(
                `Added telemetry tool view event to S3 at key ${fileKey}`
            );

            res.header("Cache-Control", "no-store")
            applyOkResponse(res, 204, fileKey.join(","));
        }
    )
  );

  return app;
};
