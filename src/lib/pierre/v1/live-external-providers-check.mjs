// src/lib/pierre/v1/live-external-providers-check.mjs
// PHASE 8.7.3 — dependency-injectable LIVE external-providers check (read-only verifier). Per domain
// (application, stripe, communications, signature, storage) it reports a status derived from REAL evidence
// (live provider API responses + persisted proofs), NEVER from mere variable presence, and NEVER turns a
// SKIPPED/sandbox result into a live PASS. It never prints a secret value. Injected deps (env, fetchJson,
// readProof, now) let tests exercise every branch without a real account.
import { redactError, EXPECTED_PIERRE_PRICE_AMOUNT, EXPECTED_PIERRE_CURRENCY } from "./live-infrastructure-contract.mjs";

export const STRIPE_REQUIRED_EVENTS = [
  "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "invoice.payment_failed",
];
const isReady = (s) => s === "READY_LIVE" || s === "READY_SANDBOX";
const canonical = (env) => env.NEXT_PUBLIC_APP_URL || env.CLONESTORE_PUBLIC_APP_URL || env.CLONESTORE_BASE_URL || "";

const WEBHOOK_ROUTES = ["/api/webhooks/stripe", "/api/webhooks/pierre/communications", "/api/webhooks/pierre/signature"];
// a route is "configured" when an unsigned POST reaches cryptographic validation (400/401/403) — NOT a
// missing-config 503, NOT absent (404) or crashing (500).
async function routeConfigured(d, env, path) {
  const url = canonical(env);
  if (!/^https:\/\//.test(url)) return "no_canonical_url";
  const res = await d.fetchJson(`${url.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  if (res.status === 0) return "unreachable";
  if ([400, 401, 403].includes(res.status)) return "ok";
  if (res.status === 503) return "unconfigured_503";
  return `http_${res.status}`;
}
async function checkApplication(d, env) {
  const url = canonical(env);
  if (!/^https:\/\//.test(url)) return { status: "BLOCKED_CONFIGURATION", detail: "no canonical https public URL (localhost/empty)" };
  const base = url.replace(/\/$/, "");
  const bad = [];
  for (const r of WEBHOOK_ROUTES) {
    const res = await d.fetchJson(`${base}${r}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (res.status === 0) return { status: "BLOCKED_NETWORK", detail: `cannot reach ${r}` };
    // a deployed, fail-closed route answers 400/401/403/405/503 to an unsigned body; 404 (absent) / 500 (crash) are failures.
    if (res.status === 404 || res.status === 500) bad.push(`${r}:${res.status}`);
  }
  if (bad.length) return { status: "BLOCKED_CONFIGURATION", detail: `webhook route(s) not deployed/fail-closed: ${bad.join(", ")}` };
  return { status: "READY_LIVE", detail: `canonical ${new URL(url).host} + ${WEBHOOK_ROUTES.length} webhook routes deployed & fail-closed` };
}

async function checkStripe(d, env) {
  const sk = env.STRIPE_SECRET_KEY || "";
  if (!sk) return { status: "BLOCKED_MISSING_SECRET", detail: "STRIPE_SECRET_KEY missing" };
  const mode = sk.startsWith("sk_live_") ? "live" : sk.startsWith("sk_test_") ? "test" : "invalid";
  if (mode === "invalid") return { status: "BLOCKED_CONFIGURATION", detail: "STRIPE_SECRET_KEY is not a recognized key" };
  const priceId = env.STRIPE_PRICE_PIERRE || env.NEXT_PUBLIC_STRIPE_PRICE_ID || "";
  if (!priceId) return { status: "BLOCKED_MISSING_SECRET", detail: "Stripe price id missing" };
  const pr = await d.fetchJson(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`, { headers: { authorization: `Bearer ${sk}` } });
  if (pr.status === 401 || pr.status === 403) return { status: "BLOCKED_PERMISSION", detail: "Stripe rejected the key" };
  if (!pr.ok) return { status: "BLOCKED_CONFIGURATION", detail: `Stripe price http ${pr.status}` };
  const p = pr.json || {};
  if (p.unit_amount !== EXPECTED_PIERRE_PRICE_AMOUNT || p.currency !== EXPECTED_PIERRE_CURRENCY || !p.active || !(p.product && p.product.active)) {
    return { status: "BLOCKED_CONFIGURATION", detail: `Stripe price not the expected ${EXPECTED_PIERRE_PRICE_AMOUNT} ${EXPECTED_PIERRE_CURRENCY} active product` };
  }
  // webhook endpoint at the canonical url covering the required events
  const url = canonical(env);
  const wantUrl = /^https:\/\//.test(url) ? `${url.replace(/\/$/, "")}/api/webhooks/stripe` : null;
  const wr = await d.fetchJson("https://api.stripe.com/v1/webhook_endpoints?limit=100", { headers: { authorization: `Bearer ${sk}` } });
  let webhookOk = false, webhookDetail = "no canonical https URL to match the webhook";
  if (wantUrl && wr.ok) {
    const ep = (wr.json?.data || []).find((e) => e.url === wantUrl && e.status === "enabled");
    if (!ep) webhookDetail = `no enabled Stripe webhook at ${wantUrl}`;
    else {
      const evset = new Set(ep.enabled_events || []);
      const covered = evset.has("*") || STRIPE_REQUIRED_EVENTS.every((e) => evset.has(e));
      webhookOk = covered; webhookDetail = covered ? "webhook endpoint + required events present" : "webhook endpoint missing required events";
    }
  }
  // live readiness requires a LIVE key + a covered webhook; otherwise it is at best sandbox — and a sandbox
  // with an INCOMPLETE webhook is NOT ready either (it must cover the 5 required events).
  if (mode === "test") {
    if (!webhookOk) return { status: "BLOCKED_CONFIGURATION", detail: `TEST mode: price valid but webhook incomplete — ${webhookDetail}` };
    return { status: "READY_SANDBOX", detail: "TEST mode: price valid + webhook covers the 5 required events; live key required for READY_LIVE" };
  }
  if (!webhookOk) return { status: "BLOCKED_CONFIGURATION", detail: `live key, price valid, but ${webhookDetail}` };
  return { status: "READY_LIVE", detail: "live key + price + webhook with required events" };
}

async function checkCommunications(d, env) {
  const provider = env.CLONESTORE_COMMUNICATION_PROVIDER || env.PIERRE_EMAIL_PROVIDER || "";
  const key = env.RESEND_API_KEY || "";
  if (!key) return { status: "BLOCKED_MISSING_SECRET", detail: "RESEND_API_KEY missing" };
  const from = env.CLONESTORE_EMAIL_FROM || env.PIERRE_DEFAULT_SENDER_EMAIL || "";
  const domain = from.includes("@") ? from.split("@")[1].replace(/[>\s]/g, "").toLowerCase() : null;
  if (!domain) return { status: "BLOCKED_CONFIGURATION", detail: "sender has no domain" };
  const r = await d.fetchJson("https://api.resend.com/domains", { headers: { authorization: `Bearer ${key}` } });
  if (r.status === 401) return { status: "BLOCKED_PERMISSION", detail: "Resend rejected the key" };
  if (r.status === 400 && /invalid/i.test(r.json?.message || "")) return { status: "BLOCKED_PERMISSION", detail: "Resend API key is invalid (provider rejected it)" };
  if (r.status === 400 || r.status === 403) return { status: "BLOCKED_CONFIGURATION", detail: "Resend key lacks domain-read scope — domain verification unprovable" };
  if (!r.ok) return { status: "BLOCKED_CONFIGURATION", detail: `Resend http ${r.status}` };
  const list = r.json?.data || r.json || [];
  const dom = (Array.isArray(list) ? list : []).find((x) => String(x.name).toLowerCase() === domain);
  if (!dom) return { status: "BLOCKED_CONFIGURATION", detail: `domain ${domain} not present in Resend` };
  if (dom.status !== "verified") return { status: "BLOCKED_CONFIGURATION", detail: `domain ${domain} not verified (status=${dom.status})` };
  if (provider && provider !== "resend") return { status: "BLOCKED_CONFIGURATION", detail: `communication provider '${provider}' is not resend` };
  const rc = await routeConfigured(d, env, "/api/webhooks/pierre/communications");
  if (rc !== "ok") return { status: "BLOCKED_CONFIGURATION", detail: `resend domain verified but webhook route ${rc}` };
  return { status: "READY_LIVE", detail: `resend domain ${domain} verified + webhook route configured (unsigned→4xx)` };
}

async function checkSignature(d, env) {
  const key = env.YOUSIGN_API_KEY || env.CLONESTORE_SIGNATURE_API_KEY || env.CLONESTORE_YOUSIGN_API_KEY || "";
  if (!key) return { status: "BLOCKED_MISSING_SECRET", detail: "no signature provider API key (Yousign) configured" };
  const apiUrl = env.YOUSIGN_API_URL || env.CLONESTORE_SIGNATURE_API_URL || "";
  if (!/^https:\/\//.test(apiUrl)) return { status: "BLOCKED_CONFIGURATION", detail: "no Yousign API URL configured" };
  const sandbox = /sandbox|staging/i.test(apiUrl);
  const r = await d.fetchJson(`${apiUrl.replace(/\/$/, "")}/users`, { headers: { authorization: `Bearer ${key}` } });
  if (r.status === 401 || r.status === 403) return { status: "BLOCKED_PERMISSION", detail: "Yousign rejected the key" };
  if (!r.ok && r.status !== 200) return { status: "BLOCKED_CONFIGURATION", detail: `Yousign http ${r.status}` };
  const rc = await routeConfigured(d, env, "/api/webhooks/pierre/signature");
  if (rc !== "ok") return { status: "BLOCKED_CONFIGURATION", detail: `Yousign authenticated but webhook route ${rc}` };
  return { status: sandbox ? "READY_SANDBOX" : "READY_LIVE", detail: `Yousign ${sandbox ? "sandbox" : "production"} authenticated + webhook route configured (unsigned→4xx)` };
}

async function checkStorage(d, env) {
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const srk = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !srk) return { status: "BLOCKED_MISSING_SECRET", detail: "Supabase URL/service-role missing" };
  const bucket = env.SUPABASE_STORAGE_BUCKET || "pierre-private-documents";
  const r = await d.fetchJson(`${url}/storage/v1/bucket`, { headers: { authorization: `Bearer ${srk}`, apikey: srk } });
  if (r.status === 401 || r.status === 403) return { status: "BLOCKED_PERMISSION", detail: "service-role rejected by storage API" };
  if (!r.ok) return { status: "BLOCKED_CONFIGURATION", detail: `storage list http ${r.status}` };
  const b = (Array.isArray(r.json) ? r.json : []).find((x) => x.name === bucket || x.id === bucket);
  if (!b) return { status: "BLOCKED_CONFIGURATION", detail: `bucket ${bucket} absent` };
  if (b.public !== false) return { status: "BLOCKED_PERMISSION", detail: `bucket ${bucket} is PUBLIC (must be private)` };
  // require a recent passed round-trip proof artifact (real evidence, not just bucket presence)
  const proof = d.readProof ? d.readProof() : null;
  if (!proof || proof.ok !== true) return { status: "BLOCKED_CONFIGURATION", detail: `bucket ${bucket} private but no passed round-trip proof` };
  return { status: "READY_LIVE", detail: `bucket ${bucket} private + signed-URL round-trip proof passed` };
}

export async function runExternalProvidersCheck(deps) {
  const d = { env: {}, fetchJson: async () => ({ status: 0, ok: false, json: null }), readProof: () => null, now: null, ...deps };
  const domains = {};
  try { domains.application = await checkApplication(d, d.env); } catch (e) { domains.application = { status: "BLOCKED_CONFIGURATION", detail: redactError(e) }; }
  try { domains.stripe = await checkStripe(d, d.env); } catch (e) { domains.stripe = { status: "BLOCKED_CONFIGURATION", detail: redactError(e) }; }
  try { domains.communications = await checkCommunications(d, d.env); } catch (e) { domains.communications = { status: "BLOCKED_CONFIGURATION", detail: redactError(e) }; }
  try { domains.signature = await checkSignature(d, d.env); } catch (e) { domains.signature = { status: "BLOCKED_CONFIGURATION", detail: redactError(e) }; }
  try { domains.storage = await checkStorage(d, d.env); } catch (e) { domains.storage = { status: "BLOCKED_CONFIGURATION", detail: redactError(e) }; }
  const blockers = Object.entries(domains).filter(([, v]) => !isReady(v.status)).map(([area, v]) => ({ area, status: v.status, reason: v.detail }));
  const st = (k) => domains[k]?.status;
  const okOrSandbox = (k) => ["READY_LIVE", "READY_SANDBOX"].includes(st(k));
  // base = everything except the Stripe-live flip: app/storage/communications must be LIVE; signature live-or-sandbox.
  const base = st("application") === "READY_LIVE" && st("storage") === "READY_LIVE" && st("communications") === "READY_LIVE" && okOrSandbox("signature");
  const prelaunch_ready = base && okOrSandbox("stripe");
  const live_ready = base && st("stripe") === "READY_LIVE";
  const stripe_live_flip_required = st("stripe") === "READY_SANDBOX";
  return {
    phase: "P8.7.3",
    generated_at: d.now || new Date().toISOString(),
    domains, blockers,
    prelaunch_ready, live_ready, stripe_live_flip_required,
    ready: live_ready, // the strict LIVE gate stays red until the Stripe live flip
  };
}
