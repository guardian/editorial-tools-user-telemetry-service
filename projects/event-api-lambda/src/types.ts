import { IUserTelemetryEvent } from "../../definitions/IUserTelemetryEvent";

export type IEventApiInput = IUserTelemetryEvent[];

export type Either<Left, Right> =
  | { value: Left; error: undefined }
  | { error: Right; value: undefined };
