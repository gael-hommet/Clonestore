import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: ".env.local" });

const BASE_URL = process.env.CLONESTORE_BASE_URL || "http://localhost:3000";
const SECRET = process.env.ROUTER_HMAC_SECRET;

if (!SECRET) {
  console.error("❌ ROUTER_HMAC_SECRET manquant dans .env.local");
  process.exit(1);
}

const client_id = "clonestore";
const mission = (process.argv[2] || "doc").toLowerCase(); // doc | email | hris

const request_id = `run_${Date.now()}`;

let payload = {};
if (mission === "doc") {
  payload = {
    title: "Doc via RUN",
    html: "<h1>RUN Pierre</h1><p>Doc généré via /run → /generate → /execute</p>",
    filename: "run-pierre.pdf",
    doc_type: "document",
  };
}
if (mission === "email") {
  payload = {
    to: ["candidat@example.com"],
    subject: "Email via RUN",
    body_html: "<p>Email envoyé via /run → /generate → /execute</p>",
  };
}
if (mission === "hris") {
  payload = {
    vendor: "sap",
    mode: "import",
    payload: { note: "HRIS via RUN" },
  };
}

const bodyObj = {
  client_id,
  request_id,
  mission,
  payload,
};

const rawBody = JSON.stringify(bodyObj);
const ts = String(Date.now());

const sig = crypto
  .createHmac("sha256", SECRET)
  .update(`${client_id}.${ts}.${rawBody}`)
  .digest("hex");

const url = `${BASE_URL}/api/pierre/run`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-client-id": client_id,
    "x-timestamp": ts,
    "x-signature": sig,
  },
  body: rawBody,
});

const text = await res.text();
let json;
try {
  json = text ? JSON.parse(text) : null;
} catch {
  json = text;
}

console.log("Mission:", mission);
console.log("Status:", res.status);
console.log(JSON.stringify(json, null, 2));
