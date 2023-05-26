#!/bin/bash

export AWS_DEFAULT_REGION=eu-west-1

awslocal secretsmanager delete-secret \
  --secret-id "/DEV/flexible/user-telemetry-service/hmacSecret" \
  --force-delete-without-recovery || true

# Add a hmac secret
awslocal secretsmanager create-secret \
  --name /DEV/flexible/user-telemetry-service/hmacSecret \
  --secret-string changeme 

# Update hmac secret
awslocal secretsmanager put-secret-value \
  --secret-id /DEV/flexible/user-telemetry-service/hmacSecret \
  --secret-string updated 

# Create our telemetry bucket for localstack
awslocal s3 mb s3://user-telemetry-service  || true

# Create our kinesis stream
awslocal kinesis create-stream \
  --shard-count 1 \
  --stream-name user-telemetry-stream  || true