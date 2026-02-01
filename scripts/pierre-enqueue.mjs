// scripts/pierre-enqueue.mjs
import crypto from "crypto";

const BASE = process.env.CLONESTORE_BASE_URL || "http://127.0.0.1:3000";
const SECRET = process.env.ROUTER_HMAC_SECRET;
const CLIENT_ID = process.env.PIERRE_CLIENT_ID || "clonestore_demo";

const mission = process.argv[2]; // doc | email | hris
if (!mission || !["doc", "email", "hris"].includes(mission)) {
  console.log("Usage: node --env-file .env.local scripts/pierre-enqueue.mjs doc|email|hris");
  process.exit(1);
}

if (!SECRET) {
  console.error("❌ Missing ROUTER_HMAC_SECRET");
  console.error("➡️ Fix: node --env-file .env.local scripts/pierre-enqueue.mjs doc");
  process.exit(1);
}

function sign(clientId, timestamp, rawBody) {
  return crypto.createHmac("sha256", SECRET).update(`${clientId}.${timestamp}.${rawBody}`).digest("hex");
}

// payloads exemples (tu peux mettre ce que tu veux)
function buildPayload(m) {
  if (m === "doc") {
    return {
      request_id: `rq_${Date.now()}`,
      html: "<h1>Document Pierre</h1><p>Test enqueue</p>",
      filename: "document_pierre.pdf",
      title: "Document Pierre",
    };
  }
  if (m === "email") {
    return {
      request_id: `rq_${Date.now()}`,
      to: ["gaelhommet7@gmail.com"],
      subject: "Test Pierre enqueue",
      body_html: "<p>Test email depuis la queue</p>",
    };
  }
  return {
    request_id: `rq_${Date.now()}`,
    vendor: "demo",
    mode: "import",
    payload: { hello: "world" },
  };
}

const bodyObj = {
  client_id: CLIENT_ID,
  mission,
  payload: buildPayload(mission),
  // run_at optionnel : sinon c’est now()
  // run_at: new Date(Date.now() + 60_000).toISOString(),
};

const raw = JSON.stringify(bodyObj);
const timestamp = String(Date.now());
const signature = sign(CLIENT_ID, timestamp, raw);

const res = await fetch(`${BASE}/api/pierre/enqueue`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-client-id": CLIENT_ID,
    "x-timestamp": timestamp,
    "x-signature": signature,
  },
  body: raw,
});

const text = await res.text();

console.log("BASE:", BASE);
console.log("CLIENT_ID:", CLIENT_ID);
console.log("Mission:", mission);
console.log("Status:", res.status);
console.log(text);


