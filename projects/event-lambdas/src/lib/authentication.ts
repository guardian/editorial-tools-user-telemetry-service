import {
  PanDomainAuthentication,
  guardianValidation,
  AuthenticationStatus,
} from "@guardian/pan-domain-node";
import { Request, Response } from "express";

import { pandaSettingsKey } from "./constants";
import { applyErrorResponse } from "../event-api-lambda/util";

export const panda = new PanDomainAuthentication(
  "gutoolsAuth-assym", // cookie name
  "eu-west-1", // AWS region
  "pan-domain-auth-settings", // Settings bucket
  pandaSettingsKey, // Settings file
  guardianValidation
);

export async function authenticated(
  panda: PanDomainAuthentication,
  req: Request,
  res: Response,
  handler: () => Promise<void>
): Promise<void> {
  console.log("auth");
  const cookie = Array.isArray(req.headers["Cookie"])
    ? req.headers["Cookie"][0]
    : req.headers["Cookie"] || "";

  if (!cookie) {
    const message =
      "No pan-domain authentication cookie present in the request";
    applyErrorResponse(res, 403, message);
    return;
  }

  return panda.verify(cookie).then(({ status }) => {
    switch (status) {
      case AuthenticationStatus.AUTHORISED:
        return handler().catch((error) => {
          applyErrorResponse(res, 500, "Internal server error", error);
          return;
        });

      default:
        applyErrorResponse(res, 403, "Invalid credentials");
        return;
    }
  });
}
