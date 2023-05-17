import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TelemetryStack } from './telemetry-stack';

describe('The telemetry stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new TelemetryStack(app, 'telemetry', {
			stack: 'flexible',
			stage: 'CODE',
		});

		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
