# Event API Lambda

A service that receives events of the type `ITelemetryEvent` and writes them to S3. Invoked by posting JSON data to the `event` endpoint in that format.

Deployed as part of this project – see the README in the project root for details.

## Running locally

Run `npm i` to install.

Run `npm run start`. The app should then be accessible on port 3132.
