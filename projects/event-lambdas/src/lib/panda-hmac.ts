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

  return expectedToken === requestToken;
}

function isDateValid(hmacAllowedDateOffsetInMillis: number, requestDate: string) {
  const parsedDate = Date.parse(requestDate);
  if (Number.isNaN(parsedDate)) {
    return false;
  }

  const currentDate = new Date().getTime();
  const dateDelta = Math.abs(parsedDate - currentDate);

  return dateDelta < hmacAllowedDateOffsetInMillis;
}

export class PandaHmacAuthentication {
  hmacAllowedDateOffsetInMillis: number;
  hmacSecretKey: string;

  constructor(hmacAllowedDateOffsetInMillis: number, hmacSecretKey: string) {
    this.hmacAllowedDateOffsetInMillis = hmacAllowedDateOffsetInMillis;
    this.hmacSecretKey = hmacSecretKey;
  }

  verify(requestDate: string, path: string, requestToken: string): boolean {
    return (
      isDateValid(this.hmacAllowedDateOffsetInMillis, requestDate) &&
      isHMACValid(this.hmacSecretKey, requestDate, path, requestToken)
    );
  }
}
