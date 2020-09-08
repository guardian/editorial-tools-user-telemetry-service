import { IUserTelemetryEvent } from "../../../../definitions/IUserTelemetryEvent";
import { convertEventsToNDJSON, convertNDJSONToEvents } from "../util";
import { events, eventsAsNDJSON } from "../../__tests__/fixtures";

describe("utils", () => {
  describe("NDJSON conversion", () => {
    describe("convertEventsToNDJSON", () => {
      it("should convert an array of event data to a single NDJSON string", () => {
        expect(convertEventsToNDJSON(events)).toBe(eventsAsNDJSON);
      });
    });
    describe("convertNDJS", () => {
      it("should convert an NDJSON string to an array of event data", () => {
        expect(convertNDJSONToEvents(eventsAsNDJSON)).toEqual(events);
      });
    });
  });
});
