import "@aws-cdk/assert/jest";
import { SynthUtils } from "@aws-cdk/assert";
import { App } from "@aws-cdk/core";
import { TelemetryStack } from "./telemetry-stack";

describe("The telemetry stack", () => {
    it("matches the snapshot", () => {
        const app = new App();
        const stack = new TelemetryStack(app, "telemetry");

        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    })
})
