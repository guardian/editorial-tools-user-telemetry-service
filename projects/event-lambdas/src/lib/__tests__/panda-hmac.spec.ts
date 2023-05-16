import { PandaHmacAuthentication } from "../panda-hmac";

import MockDate from "mockdate";

describe("panda-hmac", () => {
  const serverDate = "Tue, 16 May 2023 10:36:38 GMT";
  const requestPath = "/example/path";
  const hmacAllowedDateOffsetInMillis = 5000;
  const pandaHmac = new PandaHmacAuthentication(
    hmacAllowedDateOffsetInMillis,
    "changeme"
  );

  beforeAll(() => {
    MockDate.set(serverDate);
  });

  describe("verify", () => {
    it("verifies a valid token", () => {
      const expectedRequestToken =
        "HMAC UbTSeObvzrH6xb2oIcn0yAoCQY5ErNSddMDk8rsp/Bs=";

      const verified = pandaHmac.verify(
        serverDate,
        requestPath,
        expectedRequestToken
      );
      expect(verified).toBe(true);
    });
    it("fails to verify an invalid token", () => {
      const requestPath = "/example/path";

      const invalidRequestToken =
        "HMAC XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Bs=";

      const verified = pandaHmac.verify(
        serverDate,
        requestPath,
        invalidRequestToken
      );
      expect(verified).toBe(false);
    });
    it("verifies a token within the allowed time window", () => {
      const requestDateWithinWindow = new Date(
        Date.parse(serverDate) + 1000
      ).toUTCString();

      const expectedRequestToken =
        "HMAC W3nDyRgctNHkNFJZtLGdKhHH/yYJzgX3xYyg2xU4Kbk=";

      const verified = pandaHmac.verify(
        requestDateWithinWindow,
        requestPath,
        expectedRequestToken
      );
      expect(verified).toBe(true);
    });
    it("fails to verify a token outside the allowed time window", () => {
      const requestDateOutsideWindow = new Date(
        Date.parse(serverDate) + 5000
      ).toUTCString();

      const expectedRequestToken =
        "HMAC 30mef5QEOg9o8DNWkxyzKhAKtCMKuKYly7LsNGM5TR8=";

      const verified = pandaHmac.verify(
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
