import throttle from 'lodash/throttle';
import chunk from 'lodash/chunk';

import { IUserTelemetryEvent } from "./";
import { cookieAuthentication } from "./authentication/AuthCookie";

export type GuAuthMiddleware = (requestInit: RequestInit) => RequestInit

export class UserTelemetryEventSender {
    private postEventLimit = 500;
    private eventBuffer: IUserTelemetryEvent[] = [];

    /*
    * Constructs a User Telemetry Event Sender for sending Telemetry events to a backend on the `/event` path.
    *
    * @param {string} telemetryUrl - Backend URL including protocol for the Telemetry service
    * @param {number} [throttleDelay=10000] - Number of milliseconds to throttle sending events to
    * @param {GuAuthMiddleware} [authenticators=[cookieAuthentication]] - Middleware which applies any authentication
    *   to outgoing fetch requests.
    *
    *   Provided implementations are `cookieAuthentication` and `hmacAuthentication` (requires an HMAC key).
    *
    *   HMAC is only available in Node environments and is intended to be used on the backend only, to avoid any leaking of keys.
    *   The Middleware can be found under `@guardian/user-telemetry-client/authentication/node`.
    *
    * @returns {UserTelemetryEventSender}
    */
    public constructor(private telemetryUrl: string, private throttleDelay: number = 10000, private authenticators: GuAuthMiddleware[] = [cookieAuthentication]) {};

    private async sendEvents(): Promise<void> {
        const [firstChunk, ...subsequentChunks] = chunk(this.eventBuffer, this.postEventLimit);
        if (!firstChunk) {
          return Promise.resolve();
        }

        const jsonEventBuffer = JSON.stringify(firstChunk);

        // Push the remaining events back into the buffer
        this.eventBuffer = subsequentChunks.flat();

        let requestInit: RequestInit = {
            method: "POST",
            mode: "cors",
            headers: new Headers({
                "Content-Type": "application/json"
            }),
            body: jsonEventBuffer
        }

        const requestInitWithAuthentication = this.authenticators.reduce((request, middleware) => {
            return middleware(request);
        }, requestInit);

        const response = await fetch(`${this.telemetryUrl}/event`, requestInitWithAuthentication);

        if (!response.ok) {
          this.eventBuffer = this.eventBuffer.concat(firstChunk);
        }

        if (this.eventBuffer.length) {

          this.throttledSendEvents();
        }
    }

    private throttledSendEvents = throttle(this.sendEvents, this.throttleDelay, { trailing: true, leading: false })

    public addEvent(event: IUserTelemetryEvent): void {
      const value = + event.value 
      this.eventBuffer.push({ ...event, value });
      this.throttledSendEvents();
    }

    public flushEvents(): Promise<void> {
        return this.sendEvents();
    }
}