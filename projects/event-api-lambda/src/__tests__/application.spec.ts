import { createApp } from "../application";
import chai from "chai";
import chaiHttp from "chai-http";

chai.use(chaiHttp);
chai.should();

describe("Event API lambda", () => {
  const testApp = createApp();

  describe("/healthcheck", () => {
    it("should return 200 from healthcheck", (done) => {
      chai
        .request(testApp)
        .get("/healthcheck")
        .end((_, res) => {
          expect(res.status).toBe(200);
          done();
        });
    });
  });

  describe("/event", () => {
    it("should not accept malformed data", (done) => {
      chai
        .request(testApp)
        .post("/event")
        .end((_, res) => {
          expect(res.status).toBe(400);
          expect(res.body).toEqual({
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
          });
          done();
        });
    });
  });
});
