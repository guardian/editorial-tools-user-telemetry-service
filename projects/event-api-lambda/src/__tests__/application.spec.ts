import { createApp } from "../application";
import chai from "chai";
import chaiHttp from "chai-http";

chai.use(chaiHttp);
chai.should();

describe("Event API lambda", () => {
  const testApp = createApp();

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
        .send(request)
        .then((res) => {
          expect(res.status).toBe(400);
          expect(res.body).toEqual(response);
        });
    });
  });
});
