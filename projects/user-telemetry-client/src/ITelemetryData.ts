export interface ITelemetryEvent {
  /**
   * The application sending the event
   */
  app: string;

  /**
   * The application stage, e.g. 'CODE' | 'PROD'
   */
  stage: string;

  /**
   * The type of event we're sending, e.g. 'USER_ACTION_1' | 'USER_ACTION_2'
   */
  type: string;

  /**
   * The value of the event in question
   */
  value: number;

  /**
   * The time the event occurred (not the time it was queued, or sent), in ISO-8601 date format
   * @format date-time
   */
  eventTime: string;

  /**
   * The event metadata – any additional context we'd like to provide.
   */
  tags?: {
    [key: string]: string | number | boolean;
  };
}

