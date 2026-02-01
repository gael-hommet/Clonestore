import crypto from "crypto";
import fetch from "node-fetch";

const clientId = "clonestore";
const timestamp = Date.now();
const secret = process.env.ROUTER_HMAC_SECRET;

const body = {
  client_id: clientId,
  action: "email.send",
  payload: {
    request_id: "email_test_001",
    to: ["tonemail@exemple.com"],
    subject: "Test Pierre",
    body_html: "<p>Email envoyé par Pierre.</p>",
    reply_to: "contact@clonestore.pro"
  }
};

const raw = JSON.stringify(body);

const signature = crypto
  .createHmac("sha256", secret)
  .update(`${clientId}.${timestamp}.${raw}`)
  .digest("hex");

const res = await fetch("http://localhost:3000/api/pierre/execute", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-client-id": clientId,
    "x-timestamp": String(timestamp),
    "x-signature": signature
  },
  body: raw
});

console.log(await res.json());
