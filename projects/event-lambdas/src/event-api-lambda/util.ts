import { Response } from "express";
import { createErrorResponse, createOkResponse } from "../lib/response";

export const applyErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: Object
) => res.status(statusCode).json(createErrorResponse(message, data));

export const applyOkResponse = (
  res: Response,
  statusCode: number,
  message: string
) => res.status(statusCode).json(createOkResponse(message));
