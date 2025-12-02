import {
  AuthenticationResult,
  PanDomainAuthentication,
  User,
} from "@guardian/pan-domain-node";
import { Request, Response } from "express";
import { PandaHmacAuthentication } from './panda-hmac'
import { applyErrorResponse } from "../event-api-lambda/util";


function getPandaCookie(req: Request): string {
  return Array.isArray(req.headers["cookie"])
      ? req.headers["cookie"][0]
      : req.headers["cookie"] || "";
}

export async function authenticated(
  panda: Pick<PanDomainAuthentication,'verify'>,
  hmac: Pick<PandaHmacAuthentication,'verify'>,
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
      console.log(message, requestDate, requestToken, req.path);
      applyErrorResponse(res, 403, message);
      return;
    }
  } else {
    // No HMAC authentication headers so assume we need to do regular panda auth
    const cookie = getPandaCookie(req);

    if (!cookie) {
      const message =
          "No pan-domain authentication cookie present in the request";
      applyErrorResponse(res, 403, message);
      return;
    }

    return panda.verify(cookie).then((result: AuthenticationResult) => {
      if (result.success) {
        console.log('Authentication succeeded for ' + result.user.email);
        return handler();
      } else {
        console.log('Authentication failed - reason: ' + result.reason);
        res.status(403).render('signin', {
          title: 'Invalid credentials'
        });
      }
    });
  }
}

export async function authenticatePandaUser(
    panda: Pick<PanDomainAuthentication, 'verify'>,
    req: Request,
    res: Response,
    handler: (user: User) => Promise<void>
): Promise<void> {
    const cookie = getPandaCookie(req);

    if (!cookie) {
      const message =
          "No pan-domain authentication cookie present in the request";
      applyErrorResponse(res, 403, message);
      return;
    }

    return panda.verify(cookie).then((result) => {
      if (result.success && result.user) {
        console.log('Authentication succeeded for ' + result.user.email);
        return handler(result.user);
      } else {
        applyErrorResponse(res, 403, "Invalid credentials");
        return;
      }
    });
}
