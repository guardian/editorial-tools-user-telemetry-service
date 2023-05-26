#!/usr/bin/env bash

# Usage: ./update-event-api-hmac-secret.sh [CODE | PROD]
# This script expects developer credentials set from Janus for composer

set -e

STACK_ENV=${1:-CODE}

export AWS_PROFILE=composer
export AWS_REGION=eu-west-1
export STACK_NAME=user-telemetry-$STACK_ENV
export STACK_OUTPUT_SECRET_ARN=EventApiHmacSecretArn

# Get the secret ARN from the output of the CloudFormation stack
SECRET_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?starts_with(OutputKey,'$STACK_OUTPUT_SECRET_ARN')].OutputValue" \
    --output text)

# Generate random secret key
NEW_SECRET_KEY=$(head /dev/urandom | LC_ALL=C tr -dc A-Za-z0-9 | head -c50)

# Gather previous dates keys were updated so we can inform the user
PREVIOUS_KEY_CREATED_AT=$(aws secretsmanager get-secret-value \
    --secret-id $SECRET_ARN \
    --version-stage "AWSPREVIOUS" \
    --query "CreatedDate" \
    --output text || true)

CURRENT_KEY_CREATED_AT=$(aws secretsmanager get-secret-value \
    --secret-id $SECRET_ARN \
    --version-stage "AWSCURRENT" \
    --query "CreatedDate" \
    --output text)

# Check we're happy to proceed
echo "Preparing to update HMAC key for machine clients in AWS SecretsManager."
echo ""
echo "Previous key version created at: $PREVIOUS_KEY_CREATED_AT"
echo "Current key version created at: $CURRENT_KEY_CREATED_AT"
echo ""
echo "WARNING: Changing this key may prevent machine clients from sending metrics!"
echo "~~ Machine client keys will need to be updated manually."
echo "~~ Be aware the previous key will continue to work for 5 days, unless rotated again."
echo ""
read -p "Are you sure you want to do this? [Yy]" -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]
then
    aws secretsmanager put-secret-value \
        --secret-id $SECRET_ARN \
        --secret-string $NEW_SECRET_KEY \
        --output table

    echo "Done!"
else
    echo "Stopping!"
fi

