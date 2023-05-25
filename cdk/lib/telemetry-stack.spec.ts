import "@aws-cdk/assert/jest";
import { App } from "aws-cdk-lib";
import { TelemetryStack } from "./telemetry-stack";
import { Template } from "aws-cdk-lib/assertions";

describe("The telemetry stack", () => {
  it("matches the snapshot", () => {
    const app = new App();
    const stack = new TelemetryStack(app, "telemetry", {
      stack: "flexible",
      stage: 'TEST',
    });

    const template = Template.fromStack(stack);

    expect(template.toJSON()).toMatchSnapshot();
  });
});
