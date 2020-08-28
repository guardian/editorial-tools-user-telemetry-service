#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { TelemetryStack } from '../lib/cdk-stack';

const app = new cdk.App();
new TelemetryStack(app, 'TelemetryStack');
