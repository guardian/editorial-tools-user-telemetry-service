import { APIGatewayProxyResult } from "aws-lambda";

export const createErrorResponse = (
  statusCode: number,
  message: string,
  data?: Object
): APIGatewayProxyResult => ({
  statusCode,
  body: JSON.stringify({
    status: "error",
    message,
    data,
  }),
});

export const createOkResponse = (
  statusCode: number,
  message: string
): APIGatewayProxyResult => ({
  statusCode,
  body: JSON.stringify({ status: "ok", message }),
});
