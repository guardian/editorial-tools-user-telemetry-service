import fetchMock, {MockCall, MockMatcherFunction} from "fetch-mock";

import {UserTelemetryEventSender} from "../src/TelemetryService";
import {IUserTelemetryEvent} from "../../definitions/IUserTelemetryEvent"
import {hmacAuthentication} from "../src/authentication/node/HmacRequest";

const url = "http://endpoint";
const endpoint = `${url}/event`;
const telemetryService = new UserTelemetryEventSender(url, 100);

const mockCallToTelemetryEvent = (call: MockCall): IUserTelemetryEvent[] | undefined => {
  const requestJsonBody = call[1]?.body?.toString();
  return requestJsonBody ? JSON.parse(requestJsonBody) as IUserTelemetryEvent[] : undefined;
}

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

describe("TelemetryService", () => {
  afterEach(() => {
    fetchMock.reset();
  });

  it("should send events to a remote service", done => {
    fetchMock.post(endpoint, {
      body: JSON.stringify([exampleEvent]),
      status: 201
    });
    telemetryService.addEvent(exampleEvent);

    setTimeout(() => {
      const calls = fetchMock.calls(endpoint);
      expect(calls.length).toBe(1);
      done();
    }, 150);
  });

  it("should send events to a remote service with HMAC headers when a secret is provided", done => {
    const requestMatcher: MockMatcherFunction = (url, request) =>
        url === endpoint &&
        request.headers!! &&
        (request.headers as Headers).has("x-gu-tools-hmac-token") &&
        (request.headers as Headers).has("x-gu-tools-hmac-date")

    fetchMock.post(
        requestMatcher,
        {
          body: JSON.stringify([exampleEvent]),
          status: 201
        }
    );

    const hmacTelemetryService = new UserTelemetryEventSender(url, 100, [hmacAuthentication("SECRET")]);

    hmacTelemetryService.addEvent(exampleEvent);

    setTimeout(() => {
      const calls = fetchMock.calls(requestMatcher);
      expect(calls.length).toBe(1);
      done();
    }, 150);
  });

it("should not send events to a remote service with HMAC headers when a secret is not provided", done => {
    const requestMatcher: MockMatcherFunction = (url, request) =>
        url === endpoint &&
        request.headers!! &&
        !(request.headers as Headers).has("x-gu-tools-hmac-token") &&
        !(request.headers as Headers).has("x-gu-tools-hmac-date")

    fetchMock.post(
        requestMatcher,
        {
          body: JSON.stringify([exampleEvent]),
          status: 201
        }
    );

    const hmacTelemetryService = new UserTelemetryEventSender(url, 100);

    hmacTelemetryService.addEvent(exampleEvent);

    setTimeout(() => {
      const calls = fetchMock.calls(requestMatcher);
      expect(calls.length).toBe(1);
      done();
    }, 150);
  });

  describe("when passed a value", () => {

    it("should convert true values to 1", done => {

      const booleanValueEvent = {
        ...exampleEvent,
        value: true
      }

      fetchMock.post(endpoint, {
        status: 201
      });
      telemetryService.addEvent(booleanValueEvent);

      setTimeout(() => {
        const calls = fetchMock.calls(endpoint);
        expect(calls.length).toBe(1);
        const eventValue = mockCallToTelemetryEvent(calls[0])?.[0].value;
        expect(eventValue).toBe(1);
        done();
      }, 150);
    });

    it("should convert false values to 0", done => {

      const booleanValueEvent = {
        ...exampleEvent,
        value: false
      }

      fetchMock.post(endpoint, {
        status: 201
      });
      telemetryService.addEvent(booleanValueEvent);

      setTimeout(() => {
        const calls = fetchMock.calls(endpoint);
        expect(calls.length).toBe(1);
        const eventValue = mockCallToTelemetryEvent(calls[0])?.[0].value;
        expect(eventValue).toBe(0);
        done();
      }, 150);
    });

    it("should leave numeric values", done => {

      const booleanValueEvent = {
        ...exampleEvent,
        value: 100
      }

      fetchMock.post(endpoint, {
        status: 201
      });
      telemetryService.addEvent(booleanValueEvent);

      setTimeout(() => {
        const calls = fetchMock.calls(endpoint);
        expect(calls.length).toBe(1);
        const eventValue = mockCallToTelemetryEvent(calls[0])?.[0].value;
        expect(eventValue).toBe(100);
        done();
      }, 150);
    });
  });

  it("should only send one event for each throttle window", done => {
    fetchMock.post(endpoint, {
      body: JSON.stringify([exampleEvent]),
      status: 201
    });
    telemetryService.addEvent(exampleEvent);
    telemetryService.addEvent(exampleEvent);
    telemetryService.addEvent(exampleEvent);

    // Ensure no calls are sent before end of throttle window
    expect(fetchMock.calls(endpoint).length).toBe(0);

    setTimeout(() => {
      const calls = fetchMock.calls(endpoint);
      expect(calls.length).toBe(1);
      done();
    }, 150);
  });

  it("should batch events within the throttle window", done => {
    fetchMock.post(endpoint, {
      body: JSON.stringify([exampleEvent]),
      status: 201
    });
    telemetryService.addEvent(exampleEvent);

    // After the first window
    setTimeout(() => {
      const calls = fetchMock.calls(endpoint);
      expect(calls.length).toBe(1);
      telemetryService.addEvent(exampleEvent);
      telemetryService.addEvent(exampleEvent);
    }, 150);

    // After the second window
    setTimeout(() => {
      const calls = fetchMock.calls(endpoint);
      expect(calls.length).toBe(2);
      done();
    }, 300);
  });

  it("should flush all events when flushEvents is called", () => {
    fetchMock.post(endpoint, {
      body: JSON.stringify([exampleEvent]),
      status: 201
    });

    telemetryService.addEvent(exampleEvent);
    telemetryService.flushEvents();

    const calls = fetchMock.calls(endpoint);
    expect(calls.length).toBe(1);
  });

  it("should group events into batches of 500, sending one batch per throttle window", done => {
    fetchMock.post(endpoint, {
      body: JSON.stringify([exampleEvent]),
      status: 201
    });
    const events = Array(501)
      .fill(exampleEvent)
      .map((event, index) => ({
        ...event,
        tags: { ...event.tags, ruleId: index.toString() }
      }));
    events.forEach(event => telemetryService.addEvent(event));

    setTimeout(() => {
      const calls = fetchMock.calls(
        (_, opts) => opts.body === JSON.stringify(events.slice(0, 500))
      );
      expect(calls.length).toBe(1);
    }, 150);

    setTimeout(() => {
      const calls = fetchMock.calls(
        (_, opts) => opts.body === JSON.stringify(events.slice(500, 501))
      );
      expect(calls.length).toBe(1);
      done();
    }, 300);
  });

  it("should retry event sending when a request fails", done => {
    fetchMock.once(
      endpoint,
      {
        body: JSON.stringify([exampleEvent]),
        status: 400
      },
      { method: "POST" }
    );
    fetchMock.once(
      endpoint,
      {
        body: JSON.stringify([exampleEvent]),
        status: 200
      },
      { method: "POST", overwriteRoutes: false }
    );

    telemetryService.addEvent(exampleEvent);
    telemetryService.flushEvents();

    expect(fetchMock.calls(endpoint).length).toBe(1);

    setTimeout(() => {
      expect(fetchMock.calls(endpoint).length).toBe(2);
      done();
    }, 150);
  });
});