import { createHmac } from "crypto";

function isHMACValid(
  hmacSecretKey: string,
  date: string,
  path: string,
  requestToken: string
) {
  const hmac = createHmac("sha256", hmacSecretKey);
  const content = date + "\n" + path;
  hmac.update(content, "utf8");

  const expectedToken = "HMAC " + hmac.digest("base64");
  console.log("isHMACValid ", expectedToken, requestToken);
  return expectedToken === requestToken;
}

function isDateValid(
  hmacAllowedDateOffsetInMillis: number,
  requestDate: string
) {
  const parsedDate = Date.parse(requestDate);

  if (Number.isNaN(parsedDate)) {
    return false;
  }

  const currentDate = new Date().getTime();
  const dateDelta = Math.abs(parsedDate - currentDate);
  console.log("isDateValid ", currentDate, parsedDate, hmacAllowedDateOffsetInMillis);
  return dateDelta < hmacAllowedDateOffsetInMillis;
}

export class PandaHmacAuthentication {
  hmacAllowedDateOffsetInMillis: number;
  hmacSecretKeys: string[];

  constructor(hmacAllowedDateOffsetInMillis: number, hmacSecretKeys: string[]) {
    this.hmacAllowedDateOffsetInMillis = hmacAllowedDateOffsetInMillis;
    this.hmacSecretKeys = hmacSecretKeys;
  }

  verify(requestDate: string, path: string, requestToken: string): boolean {
    console.log("Verifying HMAC authentication ", this.hmacSecretKeys.length, " keys available");
    return this.hmacSecretKeys.some(
      (secretKey) =>
        // Is the date in the header within the allowable range?
        isDateValid(this.hmacAllowedDateOffsetInMillis, requestDate) &&
        // Check the HMAC head
        isHMACValid(secretKey, requestDate, path, requestToken)
    );
  }
}
