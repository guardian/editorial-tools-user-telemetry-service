import * as cdk from '@aws-cdk/core';
import { TelemetryStack } from '../lib/telemetry-stack';

test('Stack runs without errors', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new TelemetryStack(app, 'TelemetryTestStack');
    // THEN
    expect(stack instanceof TelemetryStack).toBe(true)
});
