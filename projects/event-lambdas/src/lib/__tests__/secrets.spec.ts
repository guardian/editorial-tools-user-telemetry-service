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

  beforeAll(() => {
    MockDate.set(serverDate);
  });

  describe("getValidSecrets", () => {
    describe("when NO current OR previous secret is available", () => {
      const fakeGetSecret = buildGetSecret();

      it("returns an empty current secret", async () => {
        const actualCurrentSecret = await getValidSecrets(
          "secretId",
          maxSecretAgeInSeconds,
          fakeGetSecret
        );

        expect(actualCurrentSecret).toStrictEqual([noCurrentSecret]);
      });
    });

    describe("when ONLY a current secret is available", () => {
      const currentSecret: SecretValue = {
        stage: "AWSCURRENT",
        value: "somevalue",
        createdDate: new Date(serverDate),
      };

      const fakeGetSecret = buildGetSecret(currentSecret);

      it("returns an empty current secret", async () => {
        const actualCurrentSecret = await getValidSecrets(
          "secretId",
          maxSecretAgeInSeconds,
          fakeGetSecret
        );

        expect(actualCurrentSecret).toStrictEqual([currentSecret]);
      });
    });

    describe("when BOTH a VALID current and previous secret are available", () => {
      const currentSecret: SecretValue = {
        stage: "AWSCURRENT",
        value: "somevalue",
        createdDate: new Date(serverDate),
      };

      const secretInDate = new Date(
        new Date(serverDate).getTime() - (maxSecretAgeInSeconds - 1 * 1000)
      );

      const previousSecret: SecretValue = {
        stage: "AWSPREVIOUS",
        value: "somevalue",
        createdDate: secretInDate,
      };

      const fakeGetSecret = buildGetSecret(currentSecret, previousSecret);

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
      });
    });

    describe("when a VALID current and previous INVALID secret are available", () => {
      const currentSecret: SecretValue = {
        stage: "AWSCURRENT",
        value: "somevalue",
        createdDate: new Date(serverDate),
      };

      const secretTooOldDate = new Date(
        new Date(serverDate).getTime() - maxSecretAgeInSeconds * 1000
      );

      const previousSecret: SecretValue = {
        stage: "AWSPREVIOUS",
        value: "somevalue",
        createdDate: secretTooOldDate,
      };

      const fakeGetSecret = buildGetSecret(currentSecret, previousSecret);

      it("returns only the current secret value", async () => {
        const actualCurrentSecret = await getValidSecrets(
          "secretId",
          maxSecretAgeInSeconds,
          fakeGetSecret
        );

        expect(actualCurrentSecret).toStrictEqual([currentSecret]);
      });
    });
  });

  afterAll(() => {
    MockDate.reset();
  });
});
