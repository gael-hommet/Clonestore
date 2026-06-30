#!/usr/bin/env node
// scripts/p87-provider-diagnostic.mjs — P8.7.3 provider diagnostics + Stripe sandbox webhook completion.
// READ-ONLY by default; --apply-stripe-events updates the EXISTING Stripe (test) webhook endpoint to cover the
// 5 required events (no duplicate, no payment, signing secret never printed). Resend 400 diagnosis + DNS (DoH)
// are read-only. Never prints a secret value.
const REQUIRED = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"];
const APPLY_STRIPE = process.argv.includes("--apply-stripe-events");
const CANON = (process.env.CANONICAL_URL || "https://www.clonestore.pro").replace(/\/$/, "");
const WANT_URL = `${CANON}/api/webhooks/stripe`;
const out = { stripe: {}, resend: {}, dns: {} };

// ── Stripe ──
const sk = process.env.STRIPE_SECRET_KEY || "";
out.stripe.key_mode = sk.startsWith("sk_live_") ? "live" : sk.startsWith("sk_test_") ? "test" : "missing/invalid";
async function stripe(path, init = {}) {
  return fetch(`https://api.stripe.com${path}`, { ...init, headers: { authorization: `Bearer ${sk}`, ...(init.headers || {}) } });
}
if (sk) {
  const lr = await stripe("/v1/webhook_endpoints?limit=100");
  if (lr.ok) {
    const data = (await lr.json()).data || [];
    const ep = data.find((e) => e.url === WANT_URL);
    out.stripe.endpoint_found = !!ep;
    if (ep) {
      out.stripe.endpoint_status = ep.status;
      const have = new Set(ep.enabled_events || []);
      const covered = have.has("*") || REQUIRED.every((e) => have.has(e));
      out.stripe.events_before = ep.enabled_events;
      out.stripe.covered_before = covered;
      out.stripe.missing = REQUIRED.filter((e) => !have.has(e) && !have.has("*"));
      if (APPLY_STRIPE && !covered) {
        const union = Array.from(new Set([...(ep.enabled_events || []).filter((e) => e !== "*"), ...REQUIRED]));
        const body = new URLSearchParams();
        union.forEach((e, i) => body.append(`enabled_events[${i}]`, e));
        const up = await stripe(`/v1/webhook_endpoints/${ep.id}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString() });
        out.stripe.update_http = up.status;
        if (up.ok) {
          const re = await stripe("/v1/webhook_endpoints?limit=100");
          const ep2 = ((await re.json()).data || []).find((e) => e.url === WANT_URL);
          const have2 = new Set(ep2.enabled_events || []);
          out.stripe.events_after = ep2.enabled_events;
          out.stripe.covered_after = have2.has("*") || REQUIRED.every((e) => have2.has(e));
        }
      }
    }
  } else { out.stripe.list_http = lr.status; }
}

// ── Resend diagnosis (read-only) ──
const rk = process.env.RESEND_API_KEY || "";
out.resend.key_present = !!rk;
if (rk) {
  for (const [name, path] of [["domains", "/domains"], ["api_keys", "/api-keys"]]) {
    try {
      const r = await fetch(`https://api.resend.com${path}`, { headers: { authorization: `Bearer ${rk}` } });
      let body = null; try { body = await r.json(); } catch { /* */ }
      out.resend[name] = { status: r.status, code: body?.name || body?.statusCode || null, message: body?.message || null };
    } catch (e) { out.resend[name] = { status: 0, error: e.message }; }
  }
}

// ── DNS via DoH (read-only) ──
async function doh(name, type) {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" } });
    const j = await r.json();
    return (j.Answer || []).map((a) => a.data);
  } catch { return null; }
}
const spf = await doh("clonestore.pro", "TXT");
out.dns.spf = spf == null ? "UNKNOWN" : (spf.some((t) => /v=spf1/i.test(t)) ? "PRESENT" : "MISSING");
const dmarc = await doh("_dmarc.clonestore.pro", "TXT");
out.dns.dmarc = dmarc == null ? "UNKNOWN" : (dmarc.some((t) => /v=DMARC1/i.test(t)) ? "PRESENT" : "MISSING");
const dkimResend = await doh("resend._domainkey.clonestore.pro", "TXT");
const dkimSend = await doh("send.clonestore.pro", "TXT");
out.dns.dkim_resend = dkimResend == null ? "UNKNOWN" : (dkimResend.length ? "PRESENT" : "MISSING");
out.dns.dkim_send_subdomain = dkimSend == null ? "UNKNOWN" : (dkimSend.length ? "PRESENT" : "MISSING");
const mx = await doh("send.clonestore.pro", "MX");
out.dns.mx_send_subdomain = mx == null ? "UNKNOWN" : (mx.length ? "PRESENT" : "MISSING");

console.log(JSON.stringify(out, null, 2));
