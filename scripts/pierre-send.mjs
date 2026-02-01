import dotenv from "dotenv";
import { signRequest } from "./sign.mjs";

dotenv.config({ path: ".env.local" }); // ✅ force .env.local

const BASE_URL = process.env.CLONESTORE_BASE_URL || "http://localhost:3000";
const SECRET = process.env.ROUTER_HMAC_SECRET;

if (!SECRET) {
  console.error("❌ ROUTER_HMAC_SECRET manquant dans .env.local");
  process.exit(1);
}

const client_id = "clonestore";
const mode = (process.argv[2] || "doc").toLowerCase(); // doc | email | hris

let bodyObj;

if (mode === "email") {
  bodyObj = {
    client_id,
    action: "email.send",
    payload: {
      request_id: "email_test_001",
      to: ["candidat@example.com"],
      subject: "Test Pierre - Email",
      body_html: "<p>Bonjour, ceci est un test d’envoi email via Pierre.</p>",
    },
  };
} else if (mode === "hris") {
  bodyObj = {
    client_id,
    action: "hris.sync",
    payload: {
      request_id: "hris_test_001",
      vendor: "sap",
      mode: "import",
      payload: { note: "test" },
    },
  };
} else {
  // doc (format simple html/filename, accepté par execute)
  bodyObj = {
    client_id,
    action: "doc.generate",
    payload: {
      request_id: "doc_test_001",
      title: "Document Pierre",
      html: "<h1>Document Pierre</h1><p>Test génération PDF via execute.</p>",
      filename: "document-pierre.pdf",
      doc_type: "document",
    },
  };
}

const rawBody = JSON.stringify(bodyObj);
const timestamp = String(Date.now());
const signature = signRequest({
  secret: SECRET,
  clientId: client_id,
  timestamp,
  rawBody,
});

const url = `${BASE_URL}/api/pierre/execute`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-client-id": client_id,
    "x-timestamp": timestamp,
    "x-signature": signature,
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

console.log("Mode:", mode);
console.log("Status:", res.status);
console.log(JSON.stringify(json, null, 2));
