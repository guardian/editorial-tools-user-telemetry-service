import { getValidSecrets } from "../secrets";
import type { GetSecret, SecretStage, SecretValue } from "../secrets";

import MockDate from "mockdate";

describe("secrets", () => {
  const serverDate = "Tue, 16 May 2023 10:36:38 GMT";
  const maxSecretAgeInSeconds = 5000;
  const noCurrentSecret = { stage: "AWSCURRENT" } as SecretValue;
  const noPreviousSecret = { stage: "AWSPREVIOUS" } as SecretValue;

  const buildGetSecret =
    (currentValue?: SecretValue, previousValue?: SecretValue): GetSecret =>
    async (secretId: string, stage: SecretStage) =>
      stage === "AWSCURRENT"
        ? currentValue ?? noCurrentSecret
        : previousValue ?? noPreviousSecret;

  const fakeGetSecretFromAws: GetSecret = async (
    secretId: string,
    stage: SecretStage
  ) =>
    Promise.resolve({
      stage: "AWSCURRENT",
    });

  beforeAll(() => {
    MockDate.set(serverDate);
  });

  describe("getValidSecrets", () => {
    describe("when no current or previous secret is available", () => {
      it("returns an empty current secret", async () => {
        const actualCurrentSecret = await getValidSecrets(
          "secretId",
          maxSecretAgeInSeconds,
          buildGetSecret()
        );

        expect(actualCurrentSecret).toStrictEqual([noCurrentSecret]);
      });
    });
  });

  afterAll(() => {
    MockDate.reset();
  });
});
