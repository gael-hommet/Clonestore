import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = "http://localhost:3000/api/pierre/execute";

// 1) PARAMS
const clientId = "clonestore";
const timestamp = Date.now();

const body = {
  client_id: clientId,
  action: "email.send",
  payload: {
    request_id: "email_test_001",
    to: ["clonestore@clonestore.pro"],
    subject: "Test Pierre",
    body_html: "<p>Email envoyé par Pierre (Postmark).</p>",
    reply_to: "contact@clonestore.pro"
  }
};

const rawBody = JSON.stringify(body);

// 2) SECRET
const secret = process.env.ROUTER_HMAC_SECRET;
if (!secret) {
  console.error('ERREUR: ROUTER_HMAC_SECRET manquant dans .env.local (ex: ROUTER_HMAC_SECRET="...")');
  process.exit(1);
}

// 3) SIGNATURE HMAC
const signature = crypto
  .createHmac("sha256", secret)
  .update(`${clientId}.${timestamp}.${rawBody}`)
  .digest("hex");

// 4) SEND
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

// 5) Read body ONCE, then parse if possible
const text = await res.text();
let parsed = null;
try {
  parsed = text ? JSON.parse(text) : null;
} catch {
  parsed = null;
}

console.log("Status:", res.status);
if (parsed) {
  console.log(JSON.stringify(parsed, null, 2));
} else {
  console.log(text);
}

