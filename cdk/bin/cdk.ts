#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import 'source-map-support/register';
import { TelemetryStack } from '../lib/telemetry-stack';

const app = new App();

new TelemetryStack(app, 'TelemetryStackPROD', {
	stack: 'flexible',
	stage: 'PROD',
});
new TelemetryStack(app, 'TelemetryStackCODE', {
	stack: 'flexible',
	stage: 'CODE',
});
