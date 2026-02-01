import crypto from "crypto";

export function signRequest({ secret, clientId, timestamp, rawBody }) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${clientId}.${timestamp}.${rawBody}`)
    .digest("hex");
}

