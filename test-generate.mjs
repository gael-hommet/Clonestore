import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = "http://localhost:3000/api/pierre/generate";
const clientId = "clonestore";
const timestamp = Date.now();

const body = {
  client_id: clientId,
  agent_key: "pierre",
  input: "Écris un email pro pour demander un rendez-vous de 15 minutes à un candidat.",
  context: { language: "fr" },
  request_id: "gen_test_001"
};

const rawBody = JSON.stringify(body);

const secret = process.env.ROUTER_HMAC_SECRET;
if (!secret) {
  console.error('ROUTER_HMAC_SECRET manquant dans .env.local');
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
