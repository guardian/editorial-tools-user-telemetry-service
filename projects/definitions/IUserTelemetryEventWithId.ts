import {IUserTelemetryEvent} from "./IUserTelemetryEvent";

export interface IUserTelemetryEventWithId extends IUserTelemetryEvent {
  /**
   * The unique id of this event, such that it can be written (and overwritten) in ELK.
   */
  id: string;
}
