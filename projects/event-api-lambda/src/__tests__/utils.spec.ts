import { IUserTelemetryEvent } from "../../../definitions/IUserTelemetryEvent";
import { convertEventsToNDJSON } from "../util";

describe("utils", () => {
  describe("convertEventsToNDJSON", () => {
    it("should convert an array of event data to a single NDJSON string", () => {
      const events: IUserTelemetryEvent[] = [
        {
          app: "example-app",
          stage: "PROD",
          type: "USER_ACTION_1",
          value: 1,
          eventTime: "2020-09-03T07:51:27.669Z",
        },
        {
          app: "example-app",
          stage: "PROD",
          type: "USER_ACTION_2",
          value: 1,
          eventTime: "2020-09-03T07:51:27.669Z",
        },
      ];

      const expected = `{\"app\":\"example-app\",\"stage\":\"PROD\",\"type\":\"USER_ACTION_1\",\"value\":1,\"eventTime\":\"2020-09-03T07:51:27.669Z\"}
{\"app\":\"example-app\",\"stage\":\"PROD\",\"type\":\"USER_ACTION_2\",\"value\":1,\"eventTime\":\"2020-09-03T07:51:27.669Z\"}
`;

      expect(convertEventsToNDJSON(events)).toBe(expected);
    });
  });
});
