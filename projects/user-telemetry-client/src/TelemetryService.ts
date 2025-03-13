import throttle from 'lodash/throttle';
import chunk from 'lodash/chunk';

import { IUserTelemetryEvent } from "./";
import { createHmac } from "crypto";

export function generateHmacHeaders(requestDate: Date, path: string, hmacSecretKey: string): {
    ["x-gu-tools-hmac-token"]: string,
    ["x-gu-tools-hmac-date"]: string
} {
    const date = requestDate.toUTCString()

    const hmac = createHmac("sha256", hmacSecretKey);
    const content = date + "\n" + path;
    hmac.update(content, "utf8");

    const token = "HMAC " + hmac.digest("base64");

    return {
        ["x-gu-tools-hmac-token"]: token,
        ["x-gu-tools-hmac-date"]: date
    }
}

export class UserTelemetryEventSender {
    private postEventLimit = 500;
    private eventBuffer: IUserTelemetryEvent[] = [];

    public constructor(private telemetryUrl: string, private throttleDelay: number = 10000, private useHmacSecret: false | string = false) {};

    private async sendEvents(): Promise<void> {
        const [firstChunk, ...subsequentChunks] = chunk(this.eventBuffer, this.postEventLimit);
        if (!firstChunk) {
          return Promise.resolve();
        }

        const jsonEventBuffer = JSON.stringify(firstChunk);

        // Push the remaining events back into the buffer
        this.eventBuffer = subsequentChunks.flat();

        const path = `/event`;

        let requestInit: RequestInit = {
            method: "POST",
            mode: "cors",
            headers: new Headers({
                "Content-Type": "application/json"
            }),
            body: jsonEventBuffer
        }

        if(this.useHmacSecret){
            requestInit = {
                ...requestInit,
                headers: new Headers({
                    "Content-Type": "application/json",
                    ...generateHmacHeaders(new Date(), path, this.useHmacSecret)
                })
            }
        }
        else {
            requestInit = {
                ...requestInit,
                credentials: "include"
            }
        }

        const response = await fetch(`${this.telemetryUrl}/event`, requestInit);

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