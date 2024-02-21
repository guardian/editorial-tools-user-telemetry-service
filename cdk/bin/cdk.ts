#!/usr/bin/env node
import 'source-map-support/register';
import { RiffRaffYamlFile } from '@guardian/cdk/lib/riff-raff-yaml-file';
import { App } from 'aws-cdk-lib';
import { TelemetryStack } from '../lib/telemetry-stack';

const app = new App(); // note not `GuRoot` since we're adding additional deployments to the riff-raff yaml further down this file

const env = {
	region: 'eu-west-1',
};
const stack = 'flexible';

new TelemetryStack(app, 'TelemetryStackPROD', {
	env,
	stack,
	stage: 'PROD',
});
new TelemetryStack(app, 'TelemetryStackCODE', {
	env,
	stack,
	stage: 'CODE',
});

export const riffRaff = new RiffRaffYamlFile(app);
const {
	riffRaffYaml: { deployments },
} = riffRaff;

// FIXME remove this semi-manual riff-raff.yaml generation
// once we've migrated the lambdas to GuLambda in telemetry-stack.ts
// and we're using GuRoot on line 7
['event-api-lambda', 'event-s3-lambda'].forEach((lambdaName) => {
	deployments.set(lambdaName, {
		type: 'aws-lambda',
		app: lambdaName,
		contentDirectory: lambdaName,
		parameters: {
			prefixStack: false,
			fileName: `${lambdaName}.zip`,
			// @ts-expect-error -- this is to ensure it's an array in the riff-raff.yaml
			functionNames: [`${lambdaName}-`],
		},
		regions: new Set([env.region]),
		stacks: new Set([stack]),
	});
});

// Write the riff-raff.yaml file to the output directory.
// Must be explicitly called.
riffRaff.synth();
