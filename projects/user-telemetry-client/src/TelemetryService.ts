import throttle from 'lodash/throttle';
import chunk from 'lodash/chunk';

import { IUserTelemetryEvent } from "./";

export class UserTelemetryEventSender {
    private postEventLimit = 500;
    private eventBuffer: IUserTelemetryEvent[] = [];

    public constructor(private telemetryUrl: string, private throttleDelay: number = 10000) {};

    private async sendEvents(): Promise<void> {
        const [firstChunk, ...subsequentChunks] = chunk(this.eventBuffer, this.postEventLimit);
        if (!firstChunk) {
          return Promise.resolve();
        }

        const jsonEventBuffer = JSON.stringify(firstChunk);

        // Push the remaining events back into the buffer
        this.eventBuffer = subsequentChunks.flat();

        const response = await fetch(`${this.telemetryUrl}/event`, {
          method: "POST",
          mode: "cors",
          credentials: "include",
          headers: new Headers({
            "Content-Type": "application/json"
          }),
          body: jsonEventBuffer
        });

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