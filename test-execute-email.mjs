import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = "http://localhost:3000/api/pierre/execute";
const clientId = "clonestore";
const timestamp = Date.now();

// Mets TON email à toi pour tester la réception
const TO_EMAIL = "clonestore@clonestore.pro";

const body = {
  client_id: clientId,
  action: "email.send",
  payload: {
    request_id: "email_test_001",
    to: [TO_EMAIL],
    subject: "Test Pierre (Router -> Execute -> Make)",
    body_html: "<p>Salut, ceci est un test d'envoi email depuis Pierre via Make.</p>",
    reply_to: "contact@clonestore.pro"
  }
};

const rawBody = JSON.stringify(body);

const secret = process.env.ROUTER_HMAC_SECRET;
if (!secret) {
  console.error("ROUTER_HMAC_SECRET manquant dans .env.local");
  process.exit(1);
}

const signature = crypto
  .createHmac("sha256", secret)
  .update(`${clientId}.${timestamp}.${rawBody}`)
  .digest("hex");

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-client-id": clientId,
    "x-timestamp": String(timestamp),
    "x-signature": signature
  },
  body: rawBody
});

const text = await res.text();
let parsed = null;
try { parsed = JSON.parse(text); } catch { parsed = null; }

console.log("Status:", res.status);
console.log(parsed ? JSON.stringify(parsed, null, 2) : text);
