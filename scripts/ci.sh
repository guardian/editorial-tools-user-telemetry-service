#!/bin/sh -e

(cd projects/event-api-lambda && npm i && npm run build && npm run deploy)
