import { GuStack, GuStringParameter } from '@guardian/cdk/lib/constructs/core';
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuCname } from '@guardian/cdk/lib/constructs/dns';
import { GuRole } from '@guardian/cdk/lib/constructs/iam';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import type { App } from 'aws-cdk-lib';
import { CfnOutput, CfnParameter, Duration, Tags } from 'aws-cdk-lib';
import {
	DomainName,
	EndpointType,
	LambdaRestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
	ArnPrincipal,
	Effect,
	PolicyDocument,
	PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Stream } from 'aws-cdk-lib/aws-kinesis';
import type { FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Code, Function, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
	Choice,
	Condition,
	DefinitionBody,
	Pass,
	StateMachine,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';

export class TelemetryStack extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);

		const appName = 'user-telemetry';

		/**
		 * Parameters
		 */
		const telemetryHostName = new CfnParameter(this, 'Hostname', {
			type: 'String',
			description: 'Hostname for telemetry endpoint',
		});

		const telemetryCert = new CfnParameter(this, 'Cert', {
			type: 'String',
			description: 'Certificate ARN for telemetry endpoint',
		});

		const bucketName = new CfnParameter(this, 'BucketName', {
			type: 'String',
			description: 'Name of the bucket to persist event data',
		});

		const kinesisStreamArn = new CfnParameter(this, 'KinesisArn', {
			type: 'String',
			description: 'ARN of the Kinesis stream to post event data',
		});

		const maxLogSize = new CfnParameter(this, 'MaxLogSize', {
			type: 'String',
			description:
				'Maximum size (in bytes) of log data from an individual request',
		});

		const pandaSettingsKey = new CfnParameter(this, 'PandaSettingsKey', {
			type: 'String',
			description:
				'The location of the pan-domain authentication settings file',
		});

		/**
		 * Secrets
		 */
		const hmacSecret = new Secret(this, 'EventApiHmacSecret', {
			secretName: `/${this.stage}/${this.stack}/event-api-lambda/hmacSecret`,
			description:
				'The HMAC secret key used to authenticate machine clients with the event-api-lambda',
		});

		const allowOphanAccessToHmac = new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ['secretsmanager:GetSecretValue'],
			resources: [hmacSecret.secretArn],
		});

		const ophanRoleArn = new GuStringParameter(this, 'ophanRoleArn', {
			default: `/${this.stage}/${this.stack}/event-api-lambda/ophanRoleArn`,
			fromSSM: true,
			description:
				'ARN of Ophan dashboard role that assumes the hmacSecretAccessRoleForOphan',
		}).valueAsString;

		const hmacSecretRoleForOphan = new GuRole(
			this,
			'hmac-secret-access-role-for-ophan',
			{
				roleName: `hmacSecretAccessRoleForOphan-${this.stage}`,
				assumedBy: new ArnPrincipal(ophanRoleArn),
			},
		);
		hmacSecretRoleForOphan.addToPolicy(allowOphanAccessToHmac);

		/**
		 * S3 bucket – where our telemetry data is persisted
		 */
		const telemetryDataBucket = Bucket.fromBucketName(
			this,
			'telemetry-bucket',
			bucketName.valueAsString,
		);

		/**
		 * Lambda
		 */
		const deployBucket = Bucket.fromBucketName(
			this,
			'composer-dist',
			'composer-dist',
		);

		const commonLambdaParams: Omit<FunctionProps, 'code'> = {
			runtime: Runtime.NODEJS_20_X,
			memorySize: 128,
			timeout: Duration.seconds(10),
			handler: 'index.handler',
			environment: {
				STAGE: this.stage,
				STACK: this.stack,
				APP: appName,
				MAX_LOG_SIZE: maxLogSize.valueAsString,
				LOG_ENDPOINT_ENABLED: 'true',
				TELEMETRY_BUCKET_NAME: telemetryDataBucket.bucketName,
				HMAC_SECRET_LOCATION: hmacSecret.secretName,
			},
			reservedConcurrentExecutions: this.stage === 'PROD' ? 25 : 5,
		};

		/**
		 * API Lambda
		 */
		const createTelemetryAPIFunction = () => {
			const fn = new Function(this, `EventApiLambda`, {
				...commonLambdaParams,
				environment: {
					...commonLambdaParams.environment,
					PANDA_SETTINGS_KEY: pandaSettingsKey.valueAsString,
				},
				functionName: `event-api-lambda-${this.stage}`,
				code: Code.fromBucket(
					deployBucket,
					`${this.stack}/${this.stage}/event-api-lambda/event-api-lambda.zip`,
				),
			});
			const fnTags = Tags.of(fn);
			fnTags.add('App', appName);
			fnTags.add('Stage', this.stage);
			fnTags.add('Stack', this.stack);
			return fn;
		};

		const telemetryAPIFunction = createTelemetryAPIFunction();

		const s3PutTelemetryBackendPolicyStatement = new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ['s3:PutObject'],
			resources: [
				telemetryDataBucket.bucketArn,
				`${telemetryDataBucket.bucketArn}/*`,
			],
		});

		const hmacSecretReadTelemetryBackendPolicyStatement = new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ['secretsmanager:GetSecretValue'],
			resources: [hmacSecret.secretArn],
		});
		const pandaConfigAndKeyPolicyStatement = new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ['s3:GetObject'],
			resources: [`arn:aws:s3:::pan-domain-auth-settings/*`],
		});
		telemetryAPIFunction.addToRolePolicy(s3PutTelemetryBackendPolicyStatement);
		telemetryAPIFunction.addToRolePolicy(
			hmacSecretReadTelemetryBackendPolicyStatement,
		);
		telemetryAPIFunction.addToRolePolicy(pandaConfigAndKeyPolicyStatement);

		/**
		 * S3 event handler lambda
		 */
		const kinesisStream = Stream.fromStreamArn(
			this,
			'user-telemetry-kinesis-stream',
			kinesisStreamArn.valueAsString,
		);

		const createTelemetryS3Function = () => {
			const fn = new Function(this, `EventS3Lambda`, {
				...commonLambdaParams,
				functionName: `event-s3-lambda-${this.stage}`,
				code: Code.fromBucket(
					deployBucket,
					`${this.stack}/${this.stage}/event-s3-lambda/event-s3-lambda.zip`,
				),
				environment: {
					...commonLambdaParams.environment,
					TELEMETRY_STREAM_NAME: kinesisStream.streamName,
				},
			});
			const fnTags = Tags.of(fn);
			fnTags.add('App', appName);
			fnTags.add('Stage', this.stage);
			fnTags.add('Stack', this.stack);

			// Notify our lambda when new objects are added to the telemetry bucket
			telemetryDataBucket.addEventNotification(
				EventType.OBJECT_CREATED,
				new LambdaDestination(fn),
			);

			return fn;
		};

		const telemetryS3Function = createTelemetryS3Function();

		const telemetryS3FunctionS3PolicyStatement = new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ['s3:GetObject'],
			resources: [
				telemetryDataBucket.bucketArn,
				`${telemetryDataBucket.bucketArn}/*`,
			],
		});
		const telemetryS3FunctionKinesisPolicyStatement = new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ['kinesis:PutRecords'],
			resources: [kinesisStreamArn.valueAsString],
		});

		telemetryS3Function.addToRolePolicy(telemetryS3FunctionS3PolicyStatement);
		telemetryS3Function.addToRolePolicy(
			telemetryS3FunctionKinesisPolicyStatement,
		);

		/**
		 * API Gateway
		 */
		const telemetryApiPolicyStatement = new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ['execute-api:Invoke'],
			resources: ['*'],
		});
		telemetryApiPolicyStatement.addAnyPrincipal();

		const telemetryApi = new LambdaRestApi(this, appName, {
			handler: telemetryAPIFunction,
			endpointTypes: [EndpointType.EDGE],
			policy: new PolicyDocument({
				statements: [telemetryApiPolicyStatement],
			}),
			defaultMethodOptions: {
				apiKeyRequired: false,
			},
		});

		const telemetryCertificate = Certificate.fromCertificateArn(
			this,
			`telemetry-cert-${this.stage}`,
			telemetryCert.valueAsString,
		);

		const telemetryDomainName = new DomainName(
			this,
			`user-telemetry-domain-name-${this.stage}`,
			{
				domainName: telemetryHostName.valueAsString,
				certificate: telemetryCertificate,
				endpointType: EndpointType.EDGE,
			},
		);

		telemetryDomainName.addBasePathMapping(telemetryApi, { basePath: '' });

		new GuCname(this, `telemetry-dns-record-${this.stage}`, {
			domainName: telemetryHostName.valueAsString,
			app: 'user-telemetry-service',
			resourceRecord: telemetryDomainName.domainNameAliasDomainName,
			ttl: Duration.seconds(3600),
		});

		/**
		 * Re-drive lambda and step-function
		 */

		const reDriveFromS3Lambda = new GuLambdaFunction(
			this,
			'ReDriveFromS3Lambda',
			{
				app: `${appName}-redrive-from-s3-lambda`,
				functionName: `${this.stack}-${this.stage}-${appName}-redrive-from-s3-lambda`,
				...commonLambdaParams,
				environment: {
					...commonLambdaParams.environment,
					TELEMETRY_STREAM_NAME: kinesisStream.streamName,
				},
				memorySize: 1024,
				timeout: Duration.minutes(15), // maximum allowed by AWS
				reservedConcurrentExecutions: 1,
				fileName: 'redrive-from-S3-lambda.zip',
				loggingFormat: LoggingFormat.TEXT,
			},
		);

		telemetryDataBucket.grantRead(reDriveFromS3Lambda);
		kinesisStream.grantWrite(reDriveFromS3Lambda);
		kinesisStream.grant(
			reDriveFromS3Lambda,
			'kinesis:UpdateShardCount',
			'kinesis:DescribeStream',
			'kinesis:ListShards',
		);

		const lambdaInvokeStep = new LambdaInvoke(
			this,
			'ReDriveFromS3StepFunctionLambdaCall',
			{
				lambdaFunction: reDriveFromS3Lambda,
			},
		);

		new StateMachine(this, 'ReDriveFromS3StepFunction', {
			stateMachineName: `${this.stack}-${this.stage}-${appName}-redrive-from-s3-step-function`,
			definitionBody: DefinitionBody.fromChainable(
				lambdaInvokeStep.next(
					new Choice(this, 'ReDriveFromS3StepFunctionIsDoneChoice')
						.when(Condition.isNotNull('$.Payload'), lambdaInvokeStep)
						.otherwise(new Pass(this, 'ReDriveFromS3StepFunctionIsDone')),
				),
			),
		});

		/**
		 * Stack Outputs
		 */
		new CfnOutput(this, 'EventApiHmacSecretArn', {
			value: hmacSecret.secretArn,
		});
	}
}
