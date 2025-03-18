import {createHmac} from "crypto";
import {GuAuthMiddleware} from "../TelemetryService";

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

export function hmacAuthentication(hmacSecretKey: string): GuAuthMiddleware {
    return (requestInit: RequestInit) => {
        return {
            ...requestInit,
            headers: new Headers({
                "Content-Type": "application/json",
                ...generateHmacHeaders(new Date(), "/event", hmacSecretKey)
            })
        };
    }
}
