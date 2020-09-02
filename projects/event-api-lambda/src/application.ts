import express from "express";
import { Request, Response } from "express";
import Ajv from "ajv";

import eventApiInputSchema from "./schema/eventApiInput.schema.json";
import { createErrorResponse } from "./response";

export const createApp = (): express.Application => {
  const app = express();
  const ajv = new Ajv();
  const validateEventApiInput = ajv.compile(eventApiInputSchema);

  app.get("/healthcheck", (_: Request, res: Response) => {
    res.send("This is the Event API app.");
  });

  app.post(
    "/event",
    express.json({ limit: "1mb" }),
    (req: Request, res: Response) => {
      if (!req.body) {
        res.status(400).send("Missing request body");
        return;
      }

      const isInputValid = validateEventApiInput(req.body);
      if (!isInputValid) {
        res.status(400);
        res.send(
          createErrorResponse("Incorrect event format", validateEventApiInput.errors!)
        );
        return;
      }

      res.status(204);
    }
  );

  return app;
};
