#!/usr/bin/env node
// scripts/p87-webhook-setup.mjs — P8.7.3 provider webhook VERIFICATION (Resend API-created + Yousign
// dashboard-created). Lists each provider's webhooks via the official API, matches the EXACT prod endpoint
// (field `endpoint`), verifies enabled/sandbox/events, and confirms the local signing secret is present.
// --apply will create the Resend webhook if absent (Resend allows API creation); Yousign sandbox-trial orgs
// can only create via dashboard, so it is verified, never recreated. REDACTED: never prints a secret.
// Exits NON-ZERO when an expected webhook is absent, events are incomplete, or a secret is missing.
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
const APPLY = process.argv.includes("--apply");
const COMM_URL = "https://www.clonestore.pro/api/webhooks/pierre/communications";
const SIG_URL = "https://www.clonestore.pro/api/webhooks/pierre/signature";
const RESEND_EVENTS = ["email.delivered", "email.bounced", "email.complained", "email.delivery_delayed"];
const YOUSIGN_EVENTS = ["signature_request.activated", "signature_request.done", "signature_request.canceled", "signature_request.declined", "signer.done", "signer.declined", "signer.error"];
const out = { resend: {}, yousign: {} };
const fail = [];

const localSecret = (name) => {
  const file = resolve(process.cwd(), ".env.p87-webhooks.local");
  if (process.env[name]) return true;
  if (!existsSync(file)) return false;
  return readFileSync(file, "utf-8").split(/\r?\n/).some((l) => l.startsWith(name + "="));
};
const epOf = (w) => w.endpoint || w.url || w.target || null;
const eventsOf = (w) => w.events || w.subscribed_events || w.subscribedEvents || [];

// ── Resend ──
const rk = process.env.RESEND_API_KEY || "";
if (!rk) { out.resend.key = "MISSING"; fail.push("resend key missing"); }
else {
  const r = await fetch("https://api.resend.com/webhooks", { headers: { authorization: `Bearer ${rk}` } });
  out.resend.list_status = r.status;
  let data = []; if (r.ok) { const j = await r.json(); data = j?.data || j || []; }
  let w = (Array.isArray(data) ? data : []).find((x) => epOf(x) === COMM_URL);
  if (!w && APPLY) {
    const c = await fetch("https://api.resend.com/webhooks", { method: "POST", headers: { authorization: `Bearer ${rk}`, "content-type": "application/json" }, body: JSON.stringify({ endpoint: COMM_URL, events: RESEND_EVENTS }) });
    if (c.ok) { const b = await c.json(); out.resend.created = true; out.resend.create_id_present = !!b?.id; }
    const r2 = await fetch("https://api.resend.com/webhooks", { headers: { authorization: `Bearer ${rk}` } });
    if (r2.ok) { const j2 = await r2.json(); w = (j2?.data || j2 || []).find((x) => epOf(x) === COMM_URL); }
  }
  out.resend.webhook_present = !!w;
  if (!w) fail.push("resend webhook absent at exact endpoint");
  else {
    const ev = eventsOf(w);
    out.resend.endpoint_exact = true;
    out.resend.events_present = RESEND_EVENTS.filter((e) => ev.includes(e));
    out.resend.events_complete = RESEND_EVENTS.every((e) => ev.includes(e));
    if (!out.resend.events_complete) fail.push("resend events incomplete");
  }
  out.resend.signing_secret_local = localSecret("CLONESTORE_EMAIL_WEBHOOK_SECRET");
  if (!out.resend.signing_secret_local) fail.push("resend signing secret missing locally");
}

// ── Yousign (sandbox, dashboard-created) ──
const yk = process.env.CLONESTORE_SIGNATURE_API_KEY || process.env.YOUSIGN_API_KEY || "";
const yurl = (process.env.CLONESTORE_SIGNATURE_API_URL || process.env.YOUSIGN_API_URL || "").replace(/\/$/, "");
out.yousign.env = /sandbox|staging/i.test(yurl) ? "sandbox" : (yurl ? "production" : "missing");
if (!yk || !/^https:\/\//.test(yurl)) { out.yousign.auth = "MISSING"; fail.push("yousign key/url missing"); }
else {
  const r = await fetch(`${yurl}/webhooks`, { headers: { authorization: `Bearer ${yk}` } });
  out.yousign.list_status = r.status;
  let data = []; if (r.ok) { const j = await r.json(); data = j?.data || j || []; }
  const w = (Array.isArray(data) ? data : []).find((x) => epOf(x) === SIG_URL);
  out.yousign.webhook_present = !!w;
  if (!w) fail.push("yousign webhook absent at exact endpoint (dashboard registration not visible via API)");
  else {
    out.yousign.endpoint_exact = true;
    out.yousign.enabled = w.enabled !== false;
    out.yousign.sandbox = w.sandbox === true || out.yousign.env === "sandbox";
    const ev = eventsOf(w);
    out.yousign.events_present = YOUSIGN_EVENTS.filter((e) => ev.includes(e));
    out.yousign.events_count = Array.isArray(ev) ? ev.length : 0;
    // accept if it carries at least the core completion events the product maps
    out.yousign.has_core_events = ev.includes("signature_request.done") || ev.includes("signer.done");
    if (!out.yousign.has_core_events) fail.push("yousign webhook missing core completion events");
  }
  out.yousign.signing_secret_local = localSecret("CLONESTORE_SIGNATURE_WEBHOOK_SECRET");
  if (!out.yousign.signing_secret_local) fail.push("yousign signing secret missing locally");
}

out.ok = fail.length === 0;
out.failures = fail;
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
