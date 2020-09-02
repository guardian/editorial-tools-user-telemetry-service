import express from "express";
import { Request, Response } from "express";

const logEndpoint = "/event";

export const createApp = (): express.Application => {
  const app = express();

  app.get("/healthcheck", (_: Request, res: Response) => {
    res.send("This is the Event API app.");
  });

  app.post(
    logEndpoint,
    express.json({ limit: "1mb" }),
    (req: Request, res: Response) => {
      if (!req.body) {
        res.status(400).send("Missing request body");
        return;
      }

      // @todo – do something with the log data
      res.status(204);
    }
  );

  return app;
};
