import { set, flow } from "lodash/fp";
import { S3Event } from "aws-lambda";
import { IUserTelemetryEvent } from "../../../definitions/IUserTelemetryEvent";

export const events: IUserTelemetryEvent[] = [
  {
    app: "example-app",
    stage: "PROD",
    type: "USER_ACTION_1",
    value: 1,
    eventTime: "2020-09-03T07:51:27.669Z"
  },
  {
    app: "example-app",
    stage: "PROD",
    type: "USER_ACTION_2",
    value: 1,
    eventTime: "2020-09-03T07:51:27.669Z"
  },
];

export const eventsAsNDJSON = `{\"app\":\"example-app\",\"stage\":\"PROD\",\"type\":\"USER_ACTION_1\",\"value\":1,\"eventTime\":\"2020-09-03T07:51:27.669Z\"}
{\"app\":\"example-app\",\"stage\":\"PROD\",\"type\":\"USER_ACTION_2\",\"value\":1,\"eventTime\":\"2020-09-03T07:51:27.669Z\"}
`;

export const s3PutObjectEvent: S3Event = {
  Records: [
    {
      eventVersion: "2.0",
      eventSource: "aws:s3",
      awsRegion: "us-east-1",
      eventTime: "1970-01-01T00:00:00.000Z",
      eventName: "ObjectCreated:Put",
      userIdentity: {
        principalId: "EXAMPLE",
      },
      requestParameters: {
        sourceIPAddress: "127.0.0.1",
      },
      responseElements: {
        "x-amz-request-id": "EXAMPLE123456789",
        "x-amz-id-2":
          "EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH",
      },
      s3: {
        s3SchemaVersion: "1.0",
        configurationId: "testConfigRule",
        bucket: {
          name: "example-bucket",
          ownerIdentity: {
            principalId: "EXAMPLE",
          },
          arn: "arn:aws:s3:::example-bucket",
        },
        object: {
          key: "test/key",
          size: 1024,
          eTag: "0123456789abcdef0123456789abcdef",
          sequencer: "0A1B2C3D4E5F678901",
        },
      },
    },
  ],
};

export const getApiGatewayEventForPutEvent = (
  bucketName: string,
  key: string
): S3Event =>
  flow(
    set("Records[0].s3.bucket", {
      name: bucketName,
      ownerIdentity: {
        principalId: "EXAMPLE",
      },
      arn: `arn:aws:s3:::${bucketName}`,
    }),
    set("Records[0].s3.object", {
      key,
      size: 1024,
      eTag: "0123456789abcdef0123456789abcdef",
      sequencer: "0A1B2C3D4E5F678901",
    })
  )(s3PutObjectEvent);
