#!/usr/bin/env node
// scripts/p87-prelaunch-gate.mjs — P8.7.3 pre-launch capability gate. REAL auth probes, REDACTED (statuses
// only, never a secret). Decides per provider whether the (owner-supplied) credentials are actually valid.
const out = { vercel: {}, resend: {}, yousign: {}, stripe: {}, storage: {} };

// ── Vercel ──
out.vercel.VERCEL_TOKEN = process.env.VERCEL_TOKEN ? "PRESENT" : "MISSING";

// ── Resend ──
const rk = process.env.RESEND_API_KEY || "";
out.resend.key = rk ? "PRESENT" : "MISSING";
const fromDomain = ((process.env.CLONESTORE_EMAIL_FROM || process.env.PIERRE_DEFAULT_SENDER_EMAIL || "pierre@clonestore.pro").split("@")[1] || "").toLowerCase();
if (rk) {
  try {
    const r = await fetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${rk}` } });
    out.resend.domains_api = r.status === 200 ? "VALID" : r.status === 401 ? "INVALID" : `HTTP_${r.status}`;
    if (r.ok) {
      const list = (await r.json())?.data || [];
      const dom = (Array.isArray(list) ? list : []).find((d) => String(d.name).toLowerCase() === fromDomain);
      out.resend.domain = dom ? `${dom.name}:${dom.status}` : `${fromDomain}:ABSENT`;
      if (dom?.records) for (const rec of dom.records) out.resend[`dns_${(rec.record || rec.type || "?").toLowerCase()}`] = rec.status || "?";
    } else { let b = null; try { b = await r.json(); } catch {} out.resend.error = b?.message || null; }
  } catch (e) { out.resend.domains_api = "FETCH_FAIL"; }
  try { const w = await fetch("https://api.resend.com/webhooks", { headers: { authorization: `Bearer ${rk}` } }); out.resend.webhooks_api = w.status === 200 ? "VALID" : `HTTP_${w.status}`; if (w.ok) { const wl = (await w.json())?.data || []; out.resend.webhook_count = Array.isArray(wl) ? wl.length : 0; } } catch { out.resend.webhooks_api = "FETCH_FAIL"; }
}

// ── Yousign ──
const yk = process.env.CLONESTORE_SIGNATURE_API_KEY || process.env.YOUSIGN_API_KEY || process.env.CLONESTORE_YOUSIGN_API_KEY || "";
const yurl = (process.env.CLONESTORE_SIGNATURE_API_URL || process.env.YOUSIGN_API_URL || "").replace(/\/$/, "");
out.yousign.key = yk ? "PRESENT" : "MISSING";
out.yousign.api_url = yurl ? (/sandbox|staging/i.test(yurl) ? "SANDBOX" : "LIVE") : "MISSING";
if (yk && /^https:\/\//.test(yurl)) {
  try {
    const r = await fetch(`${yurl}/users`, { headers: { authorization: `Bearer ${yk}` } });
    out.yousign.auth = r.status === 200 ? "VALID" : (r.status === 401 || r.status === 403) ? "INVALID" : `HTTP_${r.status}`;
  } catch (e) { out.yousign.auth = "FETCH_FAIL"; }
}

// ── Stripe (stays TEST) ──
const sk = process.env.STRIPE_SECRET_KEY || "";
out.stripe.key_mode = sk.startsWith("sk_live_") ? "LIVE" : sk.startsWith("sk_test_") ? "TEST" : "MISSING";
if (sk) {
  try {
    const w = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", { headers: { authorization: `Bearer ${sk}` } });
    if (w.ok) { const ep = ((await w.json()).data || []).find((e) => e.url === "https://www.clonestore.pro/api/webhooks/stripe"); out.stripe.endpoint = ep ? `${ep.status}:${(ep.enabled_events || []).length}ev` : "ABSENT"; }
  } catch { out.stripe.endpoint = "FETCH_FAIL"; }
}

// ── Storage (persisted proof) ──
try {
  const { readFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");
  const p = resolve(process.cwd(), ".p87-proofs/step3/storage-proof.json");
  out.storage.proof = existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")).ok === true ? "VALID" : "INVALID") : "MISSING";
} catch { out.storage.proof = "ERROR"; }

console.log(JSON.stringify(out, null, 2));
