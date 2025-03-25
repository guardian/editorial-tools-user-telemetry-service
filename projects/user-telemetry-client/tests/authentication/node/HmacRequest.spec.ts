import {generateHmacHeaders} from "../../../src/authentication/node/HmacRequest";

describe("generateHmacHeaders", () => {
    it("should generate hmac headers values", () => {
        const date = new Date("2025-03-06T11:00:00");
        const headers = generateHmacHeaders(date, "/events", "SECRET");
        expect(headers["x-gu-tools-hmac-date"]).toBe("Thu, 06 Mar 2025 11:00:00 GMT");
        expect(headers["x-gu-tools-hmac-token"]).toBe("HMAC NFf9RzMFFA0ux7WpSQPuhSNRWm+yeuf/bSorRoRnZNk=");
    });

    it("should generate different hmac header value for different dates", () => {
        const date = new Date("2025-03-07T11:00:00");
        const headers = generateHmacHeaders(date, "/events", "SECRET");
        expect(headers["x-gu-tools-hmac-date"]).toBe("Fri, 07 Mar 2025 11:00:00 GMT");
        expect(headers["x-gu-tools-hmac-token"]).toBe("HMAC wPTYGZGhJPRLY80eSdKvuYjZ4j0cOqnkBersNP7GL2k=");
    });

    it("should generate different hmac header values for different paths", () => {
        const date = new Date("2025-03-06T11:00:00");
        const headers = generateHmacHeaders(date, "/test-event", "SECRET");
        expect(headers["x-gu-tools-hmac-date"]).toBe("Thu, 06 Mar 2025 11:00:00 GMT");
        expect(headers["x-gu-tools-hmac-token"]).toBe("HMAC pclG8LqPns67rtJ/F9JRf9Y5NMxD9iJUTiZ/ZU8ZuHc=");
    });

    it("should generate different hmac header values for different keys", () => {
        const date = new Date("2025-03-06T11:00:00");
        const headers = generateHmacHeaders(date, "/events", "OTHER_SECRET");
        expect(headers["x-gu-tools-hmac-date"]).toBe("Thu, 06 Mar 2025 11:00:00 GMT");
        expect(headers["x-gu-tools-hmac-token"]).toBe("HMAC 2ip8vnsh0Ei2kutuyfjguuQSn8HvAHKTbi1kbEVOtH0=");
    });
});