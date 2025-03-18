import { createApp } from "../application";
import chai from "chai";
import chaiHttp from "chai-http";
import MockDate from "mockdate";
import { PandaHmacAuthentication } from "../../lib/panda-hmac";
import {AuthenticationStatus, User} from "@guardian/pan-domain-node";

jest.mock("uuid", () => ({
  v4: () => "mock-uuid",
}));

import { s3 } from "../../lib/aws";
import { telemetryBucketName } from "../../lib/constants";

chai.use(chaiHttp);
chai.should();

describe("Event API lambda", () => {
  const constantDate = "Tue, 16 May 2023 10:36:38 GMT";

  const fakePerson: User = {
    authenticatedIn: ["TOOL_A"],
    authenticatingSystem: "TOOL_A",
    email: "fake.person@guardian.com",
    expires: 0,
    firstName: "fake",
    lastName: "person",
    multifactor: false

  }

  const panDomainAuthentication = {
    verify: (requestCookies: string) =>
      Promise.resolve({ status: AuthenticationStatus.AUTHORISED, user: fakePerson }),
  };

  beforeAll(async () => {
    try {
      await s3.listObjects({ Bucket: telemetryBucketName }).promise();
    } catch (e) {
      throw new Error(
        `Error with localstack – the tests require localstack to be running with an S3 bucket named '${telemetryBucketName}' available. Is localstack running? The error was: ${e.message}`
      );
    }

    MockDate.set(constantDate);
  });

  afterAll(() => {
    MockDate.reset();
  });

  // Simulates having AWSCURRENT & AWSPREVIOUS versions of a secret
  const pandaHmacAuthentication = new PandaHmacAuthentication(5000, [
    "changeme",
    "updated",
  ]);

  const testApp = createApp({
    pandaHmacAuthentication,
    panDomainAuthentication,
  });

  describe("/healthcheck", () => {
    it("should return 200 from healthcheck", () => {
      chai
        .request(testApp)
        .get("/healthcheck")
        .then((res) => {
          expect(res.status).toBe(200);
        });
    });
  });

  describe("/event", () => {
    it("should not accept an empty request", () => {
      const response = {
        data: [
          {
            dataPath: "",
            keyword: "type",
            message: "should be array",
            params: { type: "array" },
            schemaPath: "#/type",
          },
        ],
        message: "Incorrect event format",
        status: "error",
      };

      return chai
        .request(testApp)
        .post("/event")
        .set("Cookie", "some_value")
        .then((res) => {
          expect(res.status).toBe(400);
          expect(res.body).toEqual(response);
        });
    });

    it("should not accept a malformed request", () => {
      const request = [
        {
          app: "example-app",
          stage: "PROD",
          type: "USER_ACTION_1",
          value: 1,
          eventTime: "this-is-not-a-datetime",
        },
      ];

      const response = {
        data: [
          {
            dataPath: "[0].eventTime",
            keyword: "format",
            message: 'should match format "date-time"',
            params: {
              format: "date-time",
            },
            schemaPath:
              "#/definitions/IUserTelemetryEvent/properties/eventTime/format",
          },
        ],
        message: "Incorrect event format",
        status: "error",
      };

      return chai
        .request(testApp)
        .post("/event")
        .set("Cookie", "some_value")
        .send(request)
        .then((res) => {
          expect(res.status).toBe(400);
          expect(res.body).toEqual(response);
        });
    });

    it("should not accept a request with a missing value", () => {
      const request = [
        {
          stage: "PROD",
          type: "USER_ACTION_1",
          value: 1,
        },
      ];

      const response = {
        data: [
          {
            dataPath: "[0]",
            keyword: "required",
            message: "should have required property 'app'",
            params: {
              missingProperty: "app",
            },
            schemaPath: "#/definitions/IUserTelemetryEvent/required",
          },
        ],
        message: "Incorrect event format",
        status: "error",
      };

      return chai
        .request(testApp)
        .post("/event")
        .set("Cookie", "some_value")
        .send(request)
        .then((res) => {
          expect(res.status).toBe(400);
          expect(res.body).toEqual(response);
        });
    });

    it("should accept a valid request", () => {
      const request = [
        {
          app: "example-app",
          stage: "PROD",
          type: "USER_ACTION_1",
          value: 1,
          eventTime: "2020-09-04T10:37:24.480Z",
        },
      ];

      return chai
        .request(testApp)
        .post("/event")
        .set("Cookie", "some_value")
        .send(request)
        .then((res) => {
          expect(res.status).toBe(201);
        });
    });

    it("should return a 403 with no cookie header set", () => {
      const request = [
        {
          app: "example-app",
          stage: "PROD",
          type: "USER_ACTION_1",
          value: 1,
          eventTime: "2020-09-04T10:37:24.480Z",
        },
      ];

      return chai
        .request(testApp)
        .post("/event")
        .send(request)
        .then((res) => {
          expect(res.status).toBe(403);
        });
    });

    describe("should accept a HMAC authenticated request", () => {
      it("where the secret version is the first available (AWSCURRENT)", () => {
        const request = [
          {
            app: "example-app",
            stage: "PROD",
            type: "USER_ACTION_1",
            value: 1,
            eventTime: "2020-09-04T10:37:24.480Z",
          },
        ];

        // Secret value "changeme" used to generate this token
        return chai
          .request(testApp)
          .post("/event")
          .set(
            "X-Gu-Tools-HMAC-Token",
            "HMAC jKYKl/BNhd/l1Erpps6kL7kQIq3mGgztNQhbHaq0XP8="
          )
          .set("X-Gu-Tools-HMAC-Date", constantDate)
          .send(request)
          .then((res) => {
            expect(res.status).toBe(201);
          });
      });

      it("where the secret version is the next available (AWSPREVIOUS)", () => {
        const request = [
          {
            app: "example-app",
            stage: "PROD",
            type: "USER_ACTION_1",
            value: 1,
            eventTime: "2020-09-04T10:37:24.480Z",
          },
        ];

        // Secret value "updated" used to generate this token
        return chai
          .request(testApp)
          .post("/event")
          .set(
            "X-Gu-Tools-HMAC-Token",
            "HMAC m+LeUv0AH9d67Je4dmVXpGKcZ29/6unB9OTqa6WQcfA="
          )
          .set("X-Gu-Tools-HMAC-Date", constantDate)
          .send(request)
          .then((res) => {
            expect(res.status).toBe(201);
          });
      });
    });

    it("should return a 403 for an invalid HMAC authenticated request", () => {
      const request = [
        {
          app: "example-app",
          stage: "PROD",
          type: "USER_ACTION_1",
          value: 1,
          eventTime: "2020-09-04T10:37:24.480Z",
        },
      ];

      return chai
        .request(testApp)
        .post("/event")
        .set("X-Gu-Tools-HMAC-Token", "bad-token")
        .set("X-Gu-Tools-HMAC-Date", constantDate)
        .send(request)
        .then((res) => {
          expect(res.status).toBe(403);
        });
    });

    it("should write well-formed requests to S3 as NDJSON, and return the file key for easy retrieval", async () => {
      const request = [
        {
          app: "example-app",
          stage: "PROD",
          type: "USER_ACTION_1",
          value: 1,
          eventTime: "2020-09-03T11:39:42.936Z",
        },
      ];

      const res = await chai
        .request(testApp)
        .post("/event")
        .set("Cookie", "some_value")
        .send(request);

      const expectedResponse = {
        message: "data/example-app/PROD/USER_ACTION_1/2023-05-16/2023-05-16T10:36:38.000Z-mock-uuid",
        status: "ok",
      };

      expect(res.status).toBe(201);
      expect(res.body).toEqual(expectedResponse);

      const params = {
        Bucket: telemetryBucketName,
        Key: res.body.message,
      };
      const writtenFile = await s3.getObject(params).promise();

      // We expect the file to contain our request as NDJSON
      const expectedFileContents = `${JSON.stringify(request[0])}\n`;
      expect(writtenFile.Body?.toString()).toBe(expectedFileContents);
    });
  });

  describe("/tracking-pixel", () => {
    it("should return a 403 without an auth cookie", () => {
      return chai
          .request(testApp)
          .get("/tracking-pixel")
          .send()
          .then((res) => {
            expect(res.status).toBe(403);
          });
    });

    it("should return a 400 without all the necessary params", () => {
      return chai
          .request(testApp)
          .get("/tracking-pixel")
          .set("Cookie", "some_value")
          .send()
          .then((res) => {
            expect(res.status).toBe(400);
          });
    });

    it("should return a 200 for valid request", () => {
      return chai
          .request(testApp)
          .get("/tracking-pixel?app=TOOL_A&stage=DEV&path=/content")
          .set("Cookie", "some_value")
          .send()
          .then((res) => {
            expect(res.status).toBe(204);
          });
    });
  });
});
