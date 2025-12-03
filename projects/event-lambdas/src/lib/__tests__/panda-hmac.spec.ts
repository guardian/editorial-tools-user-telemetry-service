import { PandaHmacAuthentication } from "../panda-hmac";

import MockDate from "mockdate";

describe("panda-hmac", () => {
  const constantDate = "Tue, 16 May 2023 10:36:38 GMT";
  const requestPath = "/example/path";
  const hmacAllowedDateOffsetInMillis = 300000;
  const pandaHmac = new PandaHmacAuthentication(hmacAllowedDateOffsetInMillis, () => Promise.resolve([
    "changeme",
  ]));

  beforeAll(() => {
    MockDate.set(constantDate);
  });

  describe("verify", () => {
    it("verifies a valid token", async () => {
      const expectedRequestToken =
        "HMAC UbTSeObvzrH6xb2oIcn0yAoCQY5ErNSddMDk8rsp/Bs=";

      const verified = await pandaHmac.verify(
        constantDate,
        requestPath,
        expectedRequestToken
      );
      expect(verified).toBe(true);
    });
    it("fails to verify an invalid token", async () => {
      const requestPath = "/example/path";

      const invalidRequestToken =
        "HMAC XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Bs=";

      const verified = await pandaHmac.verify(
        constantDate,
        requestPath,
        invalidRequestToken
      );
      expect(verified).toBe(false);
    });
    it("verifies a token within the allowed time window", async () => {
      const requestDateWithinWindow = new Date(
        Date.parse(constantDate) + 1000
      ).toUTCString();

      const expectedRequestToken =
        "HMAC W3nDyRgctNHkNFJZtLGdKhHH/yYJzgX3xYyg2xU4Kbk=";

      const verified = await pandaHmac.verify(
        requestDateWithinWindow,
        requestPath,
        expectedRequestToken
      );
      expect(verified).toBe(true);
    });
    it("fails to verify a token outside the allowed time window", async () => {
      const requestDateOutsideWindow = new Date(
        Date.parse(constantDate) + 300000
      ).toUTCString();

      const expectedRequestToken =
        "HMAC 30mef5QEOg9o8DNWkxyzKhAKtCMKuKYly7LsNGM5TR8=";

      const verified = await pandaHmac.verify(
        requestDateOutsideWindow,
        requestPath,
        expectedRequestToken
      );
      expect(verified).toBe(false);
    });
  });

  afterAll(() => {
    MockDate.reset();
  });
});
