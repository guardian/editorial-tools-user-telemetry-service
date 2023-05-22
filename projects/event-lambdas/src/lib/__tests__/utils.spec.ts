import { IUserTelemetryEvent } from "../../../../definitions/IUserTelemetryEvent";
import {
  convertEventsToNDJSON,
  convertNDJSONToEvents,
  putEventsIntoS3Bucket,
} from "../util";
import { events, eventsAsNDJSON } from "../../__tests__/fixtures";
import MockDate from "mockdate";
import { s3 } from "../../lib/aws";
import { telemetryBucketName } from "../../lib/constants";

jest.mock("uuid", () => ({
  v4: () => "mock-uuid",
}));

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

  describe("putEventsIntoS3Bucket", () => {
    const constantDate = "Tue, 16 May 2023 10:36:38 GMT";

    const testCases = [
      {
        appEvents: [
          {
            app: "app-1",
            stage: "CODE",
            type: "USER_ACTION_1",
            value: 1,
            eventTime: "2020-09-03T07:51:27.669Z",
          },
          {
            app: "app-1",
            stage: "CODE",
            type: "USER_ACTION_1",
            value: 2,
            eventTime: "2020-09-03T07:51:27.669Z",
          },
        ],
        expectedLocation:
          "data/app-1/CODE/USER_ACTION_1/2023-05-16/2023-05-16T10:36:38.000Z-mock-uuid",
      },
      {
        appEvents: [
          {
            app: "app-2",
            stage: "PROD",
            type: "USER_ACTION_2",
            value: 1,
            eventTime: "2020-09-03T07:51:27.669Z",
          },
        ],
        expectedLocation:
          "data/app-2/PROD/USER_ACTION_2/2023-05-16/2023-05-16T10:36:38.000Z-mock-uuid",
      },
      {
        appEvents: [
          {
            app: "",
            stage: "",
            type: "",
            value: 1,
            eventTime: "2020-09-03T07:51:27.669Z",
          },
        ],
        expectedLocation:
          "data/UNDEFINED/UNDEFINED/UNDEFINED/2023-05-16/2023-05-16T10:36:38.000Z-mock-uuid",
      },
    ];

    beforeAll(() => {
      MockDate.set(constantDate);
    });

    const listDataObjects = async () => {
      const dataListing = await s3.listObjects({Bucket: telemetryBucketName, Prefix: 'data'}).promise();
      return (dataListing.Contents ?? []).map(({Key}) => Key as string)
    }

    beforeEach(async () => {
      // Clear S3 objects
      const dataObjects = await listDataObjects();

      await Promise.all(dataObjects.map(async (objectLocation) => {
        await s3.deleteObject({
          Bucket: telemetryBucketName,
          Key: objectLocation,
        }).promise();
      }))
    });

    it("writes the expected data to the expected locations", async () => {
      const testExpectations: {
        events: IUserTelemetryEvent[];
        locations: {
          expectedLocation: string;
          expectedContents: string;
        }[];
      } = testCases.reduce(
        (acc, { appEvents, expectedLocation }) => {
          const expectedContents = convertEventsToNDJSON(appEvents);

          return {
            events: acc.events.concat(appEvents),
            locations: acc.locations.concat([
              { expectedLocation, expectedContents },
            ]),
          };
        },
        {
          events: [] as IUserTelemetryEvent[],
          locations: [] as {
            expectedLocation: string;
            expectedContents: string;
          }[],
        }
      );

      const locationsWritten = await putEventsIntoS3Bucket(testExpectations.events);
      const expectedLocations = testExpectations.locations.map((l) => l.expectedLocation);

      // Check the function returns the expected paths
      expect(locationsWritten).toEqual(expectedLocations);

      // Check the locations stated exist and have the expected data
      await Promise.all(testExpectations.locations.map(async ({expectedLocation, expectedContents}) => {
        const writtenFile = await s3
        .getObject({
          Bucket: telemetryBucketName,
          Key: expectedLocation,
        })
        .promise();

        await expect(writtenFile.Body?.toString()).toBe(expectedContents);
      }));

      // Check we have only the expected files
      const dataObjects = await listDataObjects();
      expect(dataObjects.sort()).toEqual(expectedLocations.sort());
    });

    afterAll(() => {
      MockDate.reset();
    });
  });
});
