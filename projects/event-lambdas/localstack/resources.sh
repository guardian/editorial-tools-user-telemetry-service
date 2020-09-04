#!/bin/bash

# Create our telemetry bucket for localstack
awslocal s3 mb s3://user-telemetry-service
awslocal kinesis create-stream --shard-count 1 --stream-name user-telemetry-stream
