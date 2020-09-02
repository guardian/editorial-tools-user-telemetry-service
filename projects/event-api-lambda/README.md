# Event API Lambda

A service that receives events of the type `ITelemetryEvent` and writes them to S3. Invoked by posting JSON data to the `event` endpoint in that format.

Deployed as part of this project – see the README in the project root for details.

## Running locally

Run `npm i` to install.

Run `npm run start`. The app should then be accessible on port 3132.

## Testing

Run `npm run test` to run the tests. The tests use [chai-http](https://www.chaijs.com/plugins/chai-http/) to allow us to mock HTTP requests.

## Deploying

This tool uses the Guardian's in-house deployment tool, [riff-raff](https://github.com/guardian/riff-raff), to deploy. Projects are listed under `Editorial Tools::Telemetry Service`.
