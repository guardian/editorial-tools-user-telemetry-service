import { v4 } from 'uuid';
import { UserTelemetryEventSender } from '.';

// Send generic page view data for a tool, using an existing UserTelemetryEventSender.
//
// Trigger 'sendPageViewTelemetry' for each page view in a tool to gather page view data.
//
// For non-standard apps (e.g. nested apps or browser extensions) - you may want to override certain values 
// that won't be available (storage) or that can't be accurately deduced from the page (stage, path)

const getStoredId = (storage: Storage, key: string): string => {
    const existingId = storage.getItem(key);
    if (existingId) {
        return existingId;
    } else {
        const id = v4();
        storage.setItem(key, id);
        return id;
    }
};

const getStage = (): string => {
    const url = window.location.hostname;
    if (url.includes("local.dev-gutools.co.uk")) { return "LOCAL"; }
    if (url.includes("test.dev-gutools.co.uk")) { return "TEST"; }
    if (url.includes("code.dev-gutools.co.uk")) { return "CODE"; }
    if (url.includes(".gutools.co.uk")) { return "PROD"; }
    return "";
};

export class PageViewTelemetryService {
    public constructor(
        private userTelemetryEventSender: UserTelemetryEventSender, 
        private app: string,
        private stageOverride?: string, // Set this if we know that the environment is DEV or PROD, but it can't be
        // deduced from the current page hostname.
        private browserStorageOverride?: Storage, // We may want to override for browser extensions
        private sessionStorageOverride?: Storage  // We may want to override for browser extensions
    ){};
    private getBrowserId = () => getStoredId(this.browserStorageOverride || localStorage, `${this.app}BrowserUuid`);

    private getSessionId = () => getStoredId(this.sessionStorageOverride || sessionStorage, `${this.app}SessionUuid`);

    public sendViewTelemetry(
        pathOverride?: string, // We may way to override this value in, for instance, a browser extension,
        // where we can identify which tab of an extension the viewer is viewing, not the web page path.
    ): void {
        this.userTelemetryEventSender.addEvent({ 
            app: this.app,
            stage: this.stageOverride || getStage(),
            eventTime: new Date().toISOString(),
            type: "TELEMETRY_PAGE_VIEW",
            value: 1,
            tags: {
                filterType: "inclusion", 
                browserUuid: this.getBrowserId(), 
                sessionUuid: this.getSessionId(),
                path: pathOverride || window.location.pathname
            }
        });
    }
}
