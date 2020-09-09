import {
  PanDomainAuthentication,
  guardianValidation,
  AuthenticationStatus,
} from "@guardian/pan-domain-node";
import { APIGatewayProxyResult } from "aws-lambda";
import { Request } from "express";

import { pandaSettingsKey } from "./constants";
import { createErrorResponse } from "./response";

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
  handler: () => Promise<APIGatewayProxyResult>
): Promise<APIGatewayProxyResult> {
  const cookie = Array.isArray(req.headers["Cookie"])
    ? req.headers["Cookie"][0]
    : req.headers["Cookie"] || "";

  if (!cookie) {
    return Promise.resolve(
      createErrorResponse(403, "No pan-domain cookie present in the request")
    );
  }

  return panda.verify(cookie).then(({ status }) => {
    switch (status) {
      case AuthenticationStatus.AUTHORISED:
        return handler().catch((error) => {
          console.error(JSON.stringify(error));
          return createErrorResponse(500, "Internal server error", error);
        });

      default:
        return createErrorResponse(403, "Invalid credentials");
    }
  });
}
