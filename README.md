# editorial-tools-user-telemetry-service

A service to receive telemetry events and pass them on to a kinesis stream. Designed to be used across the Guardian's Editorial Tools to help the team gather data about tool usage.

![User telemetry stack](https://user-images.githubusercontent.com/7767575/93306939-6401a180-f7f8-11ea-8851-0d875940e728.jpeg)

## Creating the stack

In `/cdk`, run `npm i` to install dependencies, and `npm run synth` to generate cloudformation for the stack.

## Deploying the stack

To release changes, deploy the `editorial-tools-user-telemetry-service` project in Riffraff.

## Creating and deploying the package

To create and deploy the associated npm package update the version number and then run `npm deploy`.
