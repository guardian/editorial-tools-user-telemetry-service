import { getValidSecrets } from "../secrets";
import type { GetSecret, SecretStage, SecretValue } from "../secrets";

import MockDate from "mockdate";

describe("secrets", () => {
  const constantDate = "Tue, 16 May 2023 10:36:38 GMT";
  const maxSecretAgeInSeconds = 5000;
  const noCurrentSecret = { stage: "AWSCURRENT" } as SecretValue;
  const noPreviousSecret = { stage: "AWSPREVIOUS" } as SecretValue;

  const buildGetSecret =
    (currentValue?: SecretValue, previousValue?: SecretValue): GetSecret =>
    async (secretId: string, stage: SecretStage) =>
      stage === "AWSCURRENT"
        ? currentValue ?? noCurrentSecret
        : previousValue ?? noPreviousSecret;

  beforeAll(() => {
    MockDate.set(constantDate);
  });

  describe("getValidSecrets", () => {
    describe("when NO current OR previous secret is available", () => {
      const fakeGetSecret = jest.fn(buildGetSecret());

      it("returns an empty current secret", async () => {
        const actualCurrentSecret = await getValidSecrets(
          "secretId",
          maxSecretAgeInSeconds,
          fakeGetSecret
        );

        expect(actualCurrentSecret).toStrictEqual([noCurrentSecret]);
        // The function is called 3 times for each stage (AWSCURRENT and AWSPREVIOUS)
        expect(fakeGetSecret).toHaveBeenCalledTimes(6);
      });
    });

    describe("when ONLY a current secret is available", () => {
      const currentSecret: SecretValue = {
        stage: "AWSCURRENT",
        value: "somevalue",
        createdDate: new Date(constantDate),
      };

      const fakeGetSecret = jest.fn(buildGetSecret(currentSecret));

      it("returns a current secret", async () => {
        const actualCurrentSecret = await getValidSecrets(
          "secretId",
          maxSecretAgeInSeconds,
          fakeGetSecret
        );

        expect(actualCurrentSecret).toStrictEqual([currentSecret]);
        // The function is called once for AWSCURRENT and 3 times for AWSPREVIOUS
        expect(fakeGetSecret).toHaveBeenCalledTimes(4);
      });
    });

    describe("when BOTH a VALID current and previous secret are available", () => {
      const currentSecret: SecretValue = {
        stage: "AWSCURRENT",
        value: "somevalue",
        createdDate: new Date(constantDate),
      };

      const secretInDate = new Date(
        new Date(constantDate).getTime() - (maxSecretAgeInSeconds - 1 * 1000)
      );

      const previousSecret: SecretValue = {
        stage: "AWSPREVIOUS",
        value: "somevalue",
        createdDate: secretInDate,
      };

      const fakeGetSecret = jest.fn(buildGetSecret(currentSecret, previousSecret));

      it("returns both secret values", async () => {
        const actualCurrentSecret = await getValidSecrets(
          "secretId",
          maxSecretAgeInSeconds,
          fakeGetSecret
        );

        expect(actualCurrentSecret).toStrictEqual([
          previousSecret,
          currentSecret,
        ]);
        // The function is called once for each stage (AWSCURRENT and AWSPREVIOUS)
        expect(fakeGetSecret).toHaveBeenCalledTimes(2);
      });
    });

    describe("when a VALID current and previous INVALID secret are available", () => {
      const currentSecret: SecretValue = {
        stage: "AWSCURRENT",
        value: "somevalue",
        createdDate: new Date(constantDate),
      };

      const secretTooOldDate = new Date(
        new Date(constantDate).getTime() - maxSecretAgeInSeconds * 1000
      );

      const previousSecret: SecretValue = {
        stage: "AWSPREVIOUS",
        value: "somevalue",
        createdDate: secretTooOldDate,
      };

      const fakeGetSecret = jest.fn(buildGetSecret(currentSecret, previousSecret));

      it("returns only the current secret value", async () => {
        const actualCurrentSecret = await getValidSecrets(
          "secretId",
          maxSecretAgeInSeconds,
          fakeGetSecret
        );

        expect(actualCurrentSecret).toStrictEqual([currentSecret]);
        // The function is called once for AWSCURRENT and once times for AWSPREVIOUS
        // the previous secret is invalid only due to age instead of missing value
        expect(fakeGetSecret).toHaveBeenCalledTimes(2);
      });
    });
  });

  afterAll(() => {
    MockDate.reset();
  });
});
