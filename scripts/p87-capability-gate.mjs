#!/usr/bin/env node
// scripts/p87-capability-gate.mjs — P8.7.3 fast capability gate. READ-ONLY, REDACTED (prints statuses only,
// never a secret value). Classifies provider credentials + makes real read-only API probes to decide, per
// domain, whether P8.7.3 can be completed now. No writes to any provider. Run with the relevant env injected.
const red = (k) => { const v = process.env[k]; return v && v.length ? "PRESENT" : "MISSING"; };
const out = { stripe: {}, resend: {}, yousign: {}, storage: {}, application: {} };

// ── Stripe ──
const sk = process.env.STRIPE_SECRET_KEY || "";
out.stripe.STRIPE_SECRET_KEY = sk ? (sk.startsWith("sk_live_") ? "LIVE" : sk.startsWith("sk_test_") ? "TEST" : "INVALID_KEY") : "MISSING";
out.stripe.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = (() => { const v = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""; return v ? (v.startsWith("pk_live_") ? "LIVE" : v.startsWith("pk_test_") ? "TEST" : "INVALID_KEY") : "MISSING"; })();
out.stripe.NEXT_PUBLIC_STRIPE_PRICE_ID = red("NEXT_PUBLIC_STRIPE_PRICE_ID");
out.stripe.STRIPE_PRICE_PIERRE = red("STRIPE_PRICE_PIERRE");
out.stripe.STRIPE_WEBHOOK_SECRET = red("STRIPE_WEBHOOK_SECRET");
const priceId = process.env.STRIPE_PRICE_PIERRE || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "";
if (sk && priceId) {
  try {
    const r = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`, { headers: { authorization: `Bearer ${sk}` } });
    out.stripe.api = r.status === 200 ? "VALID" : (r.status === 401 ? "INVALID_KEY" : `HTTP_${r.status}`);
    if (r.ok) { const p = await r.json(); out.stripe.price = `${p.unit_amount} ${p.currency} /${p.recurring?.interval} active=${p.active}`; }
  } catch (e) { out.stripe.api = "FETCH_FAIL"; }
  try {
    const r = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", { headers: { authorization: `Bearer ${sk}` } });
    if (r.ok) { const d = await r.json(); out.stripe.webhooks = (d.data || []).map((e) => `${(()=>{try{return new URL(e.url).host}catch{return "?"}})()}|${e.status}|${(e.enabled_events||[]).length}ev`); }
  } catch { /* */ }
}

// ── Resend ──
const rk = process.env.RESEND_API_KEY || "";
out.resend.RESEND_API_KEY = rk ? "PRESENT" : "MISSING";
if (rk) {
  try {
    const r = await fetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${rk}` } });
    out.resend.domains_api = r.status === 200 ? "VALID" : (r.status === 401 ? "INVALID_KEY" : r.status === 400 || r.status === 403 ? "INVALID_SCOPE" : `HTTP_${r.status}`);
    if (r.ok) { const d = await r.json(); const list = d.data || []; out.resend.domains = (Array.isArray(list) ? list : []).map((x) => `${x.name}:${x.status}`); }
  } catch { out.resend.domains_api = "FETCH_FAIL"; }
}

// ── Yousign ──
out.yousign.YOUSIGN_API_KEY = red("YOUSIGN_API_KEY");
out.yousign.CLONESTORE_SIGNATURE_API_KEY = red("CLONESTORE_SIGNATURE_API_KEY");
out.yousign.CLONESTORE_YOUSIGN_API_KEY = red("CLONESTORE_YOUSIGN_API_KEY");

// ── Storage (Supabase) ──
const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const srk = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
out.storage.NEXT_PUBLIC_SUPABASE_URL = sbUrl ? "PRESENT" : "MISSING";
out.storage.SUPABASE_SERVICE_ROLE_KEY = srk ? "PRESENT" : "MISSING";
out.storage.FILE_STORAGE_PROVIDER = red("FILE_STORAGE_PROVIDER");
out.storage.SUPABASE_STORAGE_BUCKET = red("SUPABASE_STORAGE_BUCKET");
if (sbUrl && srk) {
  try {
    const r = await fetch(`${sbUrl}/storage/v1/bucket`, { headers: { authorization: `Bearer ${srk}`, apikey: srk } });
    out.storage.list_api = r.status === 200 ? "VALID" : (r.status === 401 || r.status === 403 ? "INVALID_KEY" : `HTTP_${r.status}`);
    if (r.ok) { const b = await r.json(); out.storage.buckets = (Array.isArray(b) ? b : []).map((x) => `${x.name}:${x.public ? "public" : "private"}`); }
  } catch (e) { out.storage.list_api = "FETCH_FAIL"; }
}

// ── Application URLs ──
out.application.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "MISSING";
out.application.CLONESTORE_PUBLIC_APP_URL = process.env.CLONESTORE_PUBLIC_APP_URL || "MISSING";
out.application.CLONESTORE_BASE_URL = process.env.CLONESTORE_BASE_URL || "MISSING";

console.log(JSON.stringify(out, null, 2));
