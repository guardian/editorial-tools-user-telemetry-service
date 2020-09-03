#!/bin/sh -e

(cd projects/event-api-lambda && npm i && npm run test && npm run build && npm run deploy)
