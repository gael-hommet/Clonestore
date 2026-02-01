import "dotenv/config";
import crypto from "crypto";

const BASE = process.env.CLONESTORE_BASE_URL || "http://localhost:3000";
const CLIENT_ID = process.env.PIERRE_CLIENT_ID || "clonestore_demo";
const SECRET = process.env.ROUTER_HMAC_SECRET;

if (!SECRET) throw new Error("Missing ROUTER_HMAC_SECRET");

const limit = Number(process.argv[2] || 5);

const bodyObj = { client_id: CLIENT_ID, limit };
const body = JSON.stringify(bodyObj);

const timestamp = String(Date.now());
const signature = crypto
  .createHmac("sha256", SECRET)
  .update(`${CLIENT_ID}.${timestamp}.${body}`)
  .digest("hex");

const res = await fetch(`${BASE}/api/pierre/tick`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-client-id": CLIENT_ID,
    "x-timestamp": timestamp,
    "x-signature": signature,
  },
  body,
});

const text = await res.text();
console.log("Status:", res.status);
console.log(text);





