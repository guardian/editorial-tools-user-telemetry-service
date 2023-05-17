import {
  PanDomainAuthentication,
  guardianValidation,
  AuthenticationStatus,
} from "@guardian/pan-domain-node";
import { Request, Response } from "express";
import { PandaHmacAuthentication } from './panda-hmac'

// TODO: We may wish to configure multiple keys for different clients
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
  hmac: PandaHmacAuthentication,
  req: Request,
  res: Response,
  handler: () => Promise<void>
): Promise<void> {
  if(
      req.headers["x-gu-tools-hmac-token"] !== undefined &&
      req.headers["x-gu-tools-hmac-date"] !== undefined) {
    // Check if we are doing HMAC Authentication, if so check the token & date given

    // TODO: identify and log caller via X-Gu-Tools-Service-Name
    const requestToken = req.headers["x-gu-tools-hmac-token"] as string;
    const requestDate = req.headers["x-gu-tools-hmac-date"] as string;

    if(hmac.verify(requestDate, req.path, requestToken)) {
      return handler();
    } else {
      const message =
          "Invalid HMAC authenticated request!";
      applyErrorResponse(res, 403, message);
      return;
    }
  } else {
    // No HMAC authentication headers so assume we need to do regular panda auth

    const cookie = Array.isArray(req.headers["cookie"])
        ? req.headers["cookie"][0]
        : req.headers["cookie"] || "";

    if (!cookie) {
      const message =
          "No pan-domain authentication cookie present in the request";
      applyErrorResponse(res, 403, message);
      return;
    }

    return panda.verify(cookie).then(({status}) => {
      switch (status) {
        case AuthenticationStatus.AUTHORISED:
          return handler();
        default:
          applyErrorResponse(res, 403, "Invalid credentials");
          return;
      }
    });
  }
}
