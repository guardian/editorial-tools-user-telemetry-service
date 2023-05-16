#!/bin/bash

export AWS_DEFAULT_REGION=eu-west-1

# Add a hmac secret
awslocal secretsmanager create-secret \
  --name /DEV/flexible/user-telemetry-service/hmacSecret \
  --secret-string changeme

# Create our telemetry bucket for localstack
awslocal s3 mb s3://user-telemetry-service

# Create our kinesis stream
awslocal kinesis create-stream \
  --shard-count 1 \
  --stream-name user-telemetry-stream