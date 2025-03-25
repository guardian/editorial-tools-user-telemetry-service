# User Telemetry Client

The Telemetry Client is an NPM package available as `@guardian/user-telemetry-client` to make sending events to the
backend simple.

## Usage

The package provides two benefits, type safety for the events format and a mechanism for sending events featuring a
buffer, throttle and retry mechanism.

### Example usage:

Initalisation:

```TypeScript
const telemetrySender = new UserTelemetryEventSender(url, 100);
```

Example event:

```TypeScript
const exampleEvent: IUserTelemetryEvent = {
    app: "example-app",
    stage: "PROD",
    type: "EXAMPLE_EVENT_TYPE",
    value: 1,
    eventTime: "2020-09-03T07:51:27.669Z",
    tags: {
        ruleId: "id",
        suggestion: "suggestion",
        matchId: "matchId",
        matchedText: "some matched text",
        matchContext: "matchContext",
        documentUrl: "documentUrl"
    }
};
```

Sending events:

```TypeScript
// Add event to buffer to be sent
telemetrySender.addEvent(exampleEvent);

// Send all events immediately
await telemetrySender.flushEvents()
```

## Authentication

Authentication can be handled in several ways:

## AuthCookie (default)

By default, the client will apply `credentials: "include"` to outgoing telemetry event requests. This uses the standard
browser features to provide authentication cookies and headers in requests.

The Telemetry client backend is designed to expect
a [Panda Auth Cookie](https://github.com/guardian/pan-domain-authentication).

## HMAC Headers

An alternative is to use HMAC headers. This is useful when the client may be running in an environment with no request
cookies available. It also provides the means for machine-to-machine authentication.

### Caveat

The HMAC headers middleware makes use of the `crypto` Node package, which is not available in the browser. Therefore, it
can only be used in a Node environment.

To avoid issues with attempt to import a Node only module, the middleware is made available specifically
on `@guardian/user-telemetry-client/authentication/node`.

## Custom

It is possible to provide your own middleware for any custom requirements.

Format: 

```TypeScript
type GuAuthMiddleware = (requestInit: RequestInit) => RequestInit
```