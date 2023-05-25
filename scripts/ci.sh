#!/usr/bin/env bash

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..

EVENT_API_LAMBDA_DIR="$ROOT_DIR/projects/event-lambdas"
EVENT_API_LAMBDA_BUCKET_NAME=user-telemetry-service

function setupNvm {
  export NVM_DIR="$HOME/.nvm"
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"  # This loads nvm

  nvm install
  nvm use
}

function setupEventApiLambda {
  pushd $EVENT_API_LAMBDA_DIR
  docker-compose up -d
  # Ensure localstack is up, and relevant resources have been created
  for attempt in {1..5}
  do
    AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local aws s3 ls $EVENT_API_LAMBDA_BUCKET_NAME --endpoint-url http://localhost:4566 \
      && break
    sleep 5
  done

  setupNvm
  npm i
  npm run test
  npm run build
  npm run deploy
  popd
}

function teardownEventApiLambda {
  pushd $EVENT_API_LAMBDA_DIR
  docker-compose down
  popd
}

function setup {
  setupEventApiLambda
}

function teardown {
  teardownEventApiLambda
}

function cdk {
  pushd cdk
  npm ci
  npm test
  popd
}

trap teardown EXIT

setup
teardown
cdk
