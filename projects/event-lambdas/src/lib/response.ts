import { APIGatewayProxyResult } from "aws-lambda";

export const createErrorResponse = (message: string, data?: Object) => ({
  status: "error",
  message,
  data,
});

export const createOkResponse = (message: string) => ({
  status: "ok",
  message,
});
