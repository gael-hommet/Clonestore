// src/lib/pierre/v1/live-infrastructure-contract.mjs
// PHASE 8.7.1 — the SINGLE CANONICAL source of truth for Pierre's live external-infrastructure contract.
//
// It is authored once, in plain ESM, so BOTH the preflight script (node) and the tests (vitest, via the
// sibling .d.mts) consume the exact same variable list, formats, aliases, placeholder patterns, and the
// ONE central redaction. Nothing here reads or prints a value; it only DESCRIBES the contract and provides
// pure classification/redaction helpers. Live/test detection of provider keys reuses prefix rules that
// match the existing analyzers (stripe-env-analyzer); the expected price mirrors stripe-activation.ts and
// is kept in sync by an anti-drift test.

export const HTTPS_URL = /^https:\/\/[^\s]+$/;
export const POSTGRES_DSN = /^postgres(ql)?:\/\/[^\s]+$/;
export const EMAILISH = /.+@.+\..+/;

// expected Stripe price (cents) + currency — MUST equal EXPECTED_PIERRE_PRICE_AMOUNT in
// src/lib/billing/stripe-activation.ts (asserted by p87 anti-drift test).
export const EXPECTED_PIERRE_PRICE_AMOUNT = 44900;
export const EXPECTED_PIERRE_CURRENCY = "eur";

export const ALL_DOMAINS = ["database", "runtime", "billing", "communications", "signature", "storage", "application"];

// ── central placeholder + redaction (defined ONCE) ───────────────────────────────────────────
export const PLACEHOLDER_PATTERNS = [
  /^$/, /your[-_ ]?/i, /placeholder/i, /changeme/i, /change[-_ ]?this/i, /example/i, /xxx+/i, /todo/i, /dummy/i, /<.*>/, /\.\.\./, /^(test|fake|sample)$/i,
];
export function looksLikePlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(String(value).trim()));
}
/** A present secret NEVER reaches a log: it becomes "REDACTED"; absent → "MISSING". */
export function redactSecret(value) {
  if (value === undefined || value === null || String(value).trim() === "") return "MISSING";
  return "REDACTED";
}
/** Normalise ANY provider/network/DB error to a safe short string (strips DSN creds + key-like tokens). */
export function redactError(err) {
  let m = err instanceof Error ? err.message : String(err ?? "unknown error");
  m = m.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1***@");                  // DSN user:pw@host
  m = m.replace(/([?&](?:password|pwd|pass)=)[^&\s]+/gi, "$1***");                // DSN password as a query param
  m = m.replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, "***");     // JWT (header.payload.sig — Supabase keys)
  m = m.replace(/\b(sk|pk|whsec|re|rk|key)_(?:test_|live_)?[A-Za-z0-9]{6,}/gi, "$1_***"); // provider keys
  m = m.replace(/\b[A-Za-z0-9_-]{32,}\b/g, "***");                                // any long opaque token
  m = m.replace(/bearer\s+[^\s]+/gi, "Bearer ***");                               // Authorization: Bearer ...
  return m.slice(0, 200);
}

// ── the contract ─────────────────────────────────────────────────────────────────────────────
/** @type {import("./live-infrastructure-contract.mjs").EnvVarSpec[]} */
export const LIVE_INFRA_CONTRACT = [
  // database
  { name: "DATABASE_URL", domain: "database", required_for: "application DB access (app role pool)", environments: ["production"], secret: true, format: POSTGRES_DSN, aliases: ["SUPABASE_DB_URL"], blocks: "all governed server data access" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", domain: "database", required_for: "Supabase project endpoint (auth + storage)", environments: ["production"], secret: false, format: HTTPS_URL, blocks: "auth + storage REST" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", domain: "database", required_for: "client auth (anon)", environments: ["production"], secret: false, blocks: "client authentication" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", domain: "database", required_for: "server-side Supabase admin (storage signing)", environments: ["production"], secret: true, aliases: ["SUPABASE_SERVICE_KEY"], blocks: "storage signing + admin reads" },

  // runtime (dedicated least-privilege role DSNs)
  { name: "PIERRE_RUNTIME_WORKER_DATABASE_URL", domain: "runtime", required_for: "P8.5 runtime worker (role pierre_rt_runtime_worker)", environments: ["production"], secret: true, format: POSTGRES_DSN, role: "pierre_rt_runtime_worker", blocks: "autonomous mission execution" },
  { name: "PIERRE_RUNTIME_SCHEDULER_DATABASE_URL", domain: "runtime", required_for: "P8.5 scheduler (role pierre_rt_runtime_scheduler)", environments: ["production"], secret: true, format: POSTGRES_DSN, role: "pierre_rt_runtime_scheduler", blocks: "wait resolution / lease recovery" },
  { name: "PIERRE_RUNTIME_PLANNER_DATABASE_URL", domain: "runtime", required_for: "P8.5 planner (role pierre_rt_runtime_planner)", environments: ["production"], secret: true, format: POSTGRES_DSN, role: "pierre_rt_runtime_planner", blocks: "plan/run creation" },
  { name: "PIERRE_COMMUNICATION_WORKER_DATABASE_URL", domain: "runtime", required_for: "P8.4 communication worker (role pierre_rt_communication_worker)", environments: ["production"], secret: true, format: POSTGRES_DSN, role: "pierre_rt_communication_worker", blocks: "email/in-app dispatch" },
  { name: "PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL", domain: "runtime", required_for: "P8.4 delivery webhook ingestion (role pierre_rt_communication_webhook)", environments: ["production"], secret: true, format: POSTGRES_DSN, role: "pierre_rt_communication_webhook", blocks: "delivery status ingestion" },
  { name: "PIERRE_RUNTIME_SYSTEM_SECRET", domain: "runtime", required_for: "autonomous runtime trigger auth (cron/queue)", environments: ["production"], secret: true, blocks: "system-triggered runtime ticks" },

  // billing (Stripe + billing/activation role DSNs + handoff)
  { name: "STRIPE_SECRET_KEY", domain: "billing", required_for: "Stripe API (server)", environments: ["production"], secret: true, format: /^sk_(test|live)_[A-Za-z0-9]+$/, blocks: "checkout + billing API" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", domain: "billing", required_for: "Stripe.js (client checkout)", environments: ["production"], secret: false, format: /^pk_(test|live)_[A-Za-z0-9]+$/, blocks: "client checkout form" },
  { name: "STRIPE_WEBHOOK_SECRET", domain: "billing", required_for: "Stripe webhook signature verification", environments: ["production"], secret: true, format: /^whsec_[A-Za-z0-9]+$/, blocks: "commercial event ingestion" },
  { name: "NEXT_PUBLIC_STRIPE_PRICE_ID", domain: "billing", required_for: "the 449 EUR/mo subscription price", environments: ["production"], secret: false, format: /^price_[A-Za-z0-9]+$/, blocks: "subscription checkout" },
  { name: "PIERRE_BILLING_WEBHOOK_DATABASE_URL", domain: "billing", required_for: "billing webhook ingestion (role pierre_rt_billing_webhook)", environments: ["production"], secret: true, format: POSTGRES_DSN, role: "pierre_rt_billing_webhook", blocks: "commercial event truth writes" },
  { name: "PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL", domain: "billing", required_for: "customer activation worker (role pierre_rt_customer_activation_worker)", environments: ["production"], secret: true, format: POSTGRES_DSN, role: "pierre_rt_customer_activation_worker", blocks: "fenced customer provisioning" },
  { name: "PIERRE_HANDOFF_TOKEN_SECRET", domain: "billing", required_for: "signed commercial->activation handoff token", environments: ["production"], secret: true, blocks: "secure activation handoff" },

  // communications (Resend)
  { name: "CLONESTORE_COMMUNICATION_PROVIDER", domain: "communications", required_for: "selecting the live email provider", environments: ["production"], secret: false, format: /^resend$/, aliases: ["EMAIL_PROVIDER"], blocks: "live email provider selection" },
  { name: "RESEND_API_KEY", domain: "communications", required_for: "Resend API auth", environments: ["production"], secret: true, format: /^re_[A-Za-z0-9]+$/, dependencies: ["CLONESTORE_COMMUNICATION_PROVIDER"], blocks: "outbound email" },
  { name: "CLONESTORE_EMAIL_FROM", domain: "communications", required_for: "verified sender address", environments: ["production"], secret: false, format: EMAILISH, aliases: ["CLONESTORE_FOUNDER_EMAIL_FROM", "RESEND_DEFAULT_FROM"], blocks: "outbound email (no From)" },
  { name: "CLONESTORE_EMAIL_WEBHOOK_SECRET", domain: "communications", required_for: "Resend (Svix) webhook verification", environments: ["production"], secret: true, format: /^whsec_/, blocks: "delivery/bounce webhook ingestion" },
  { name: "CLONESTORE_PUBLIC_APP_URL", domain: "communications", required_for: "absolute links in emails", environments: ["production"], secret: false, format: HTTPS_URL, aliases: ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL"], blocks: "secure links in communications" },
  { name: "CLONESTORE_COMMUNICATION_LINK_SECRET", domain: "communications", required_for: "HMAC for secure email links", environments: ["production"], secret: true, aliases: ["CLONESTORE_SECURE_LINK_SECRET", "CLONESTORE_SIGNATURE_WEBHOOK_SECRET"], blocks: "secure document links" },
  { name: "PIERRE_COMMUNICATION_SYSTEM_SECRET", domain: "communications", required_for: "communication dispatch trigger auth", environments: ["production"], secret: true, aliases: ["CRON_SECRET"], blocks: "system-triggered dispatch" },

  // signature (Yousign)
  { name: "CLONESTORE_SIGNATURE_PROVIDER", domain: "signature", required_for: "selecting the live signature provider", environments: ["production"], secret: false, format: /^yousign$/, blocks: "live signature provider selection" },
  { name: "CLONESTORE_SIGNATURE_API_URL", domain: "signature", required_for: "Yousign API base URL (sandbox/live)", environments: ["production"], secret: false, format: HTTPS_URL, dependencies: ["CLONESTORE_SIGNATURE_PROVIDER"], blocks: "signature requests" },
  { name: "CLONESTORE_SIGNATURE_API_KEY", domain: "signature", required_for: "Yousign API auth", environments: ["production"], secret: true, dependencies: ["CLONESTORE_SIGNATURE_API_URL"], blocks: "signature requests" },
  { name: "CLONESTORE_SIGNATURE_WEBHOOK_SECRET", domain: "signature", required_for: "Yousign webhook verification", environments: ["production"], secret: true, blocks: "signature event ingestion" },

  // storage (Supabase Storage)
  { name: "FILE_STORAGE_PROVIDER", domain: "storage", required_for: "selecting the production storage backend", environments: ["production"], secret: false, format: /^supabase$/, blocks: "document/evidence storage" },
  { name: "SUPABASE_STORAGE_BUCKET", domain: "storage", required_for: "the private documents bucket", environments: ["production"], secret: false, blocks: "document storage" },
  { name: "SUPABASE_STORAGE_PUBLIC", domain: "storage", required_for: "enforcing a PRIVATE bucket (absent or 'false')", environments: [], secret: false, format: /^(false)?$/, blocks: "private-bucket enforcement" },

  // application (public URL + secrets)
  { name: "NEXT_PUBLIC_APP_URL", domain: "application", required_for: "public app/callback base URL", environments: ["production"], secret: false, format: HTTPS_URL, blocks: "redirects + callbacks" },
];

export const LIVE_SMOKE_OPT_INS = {
  signature: ["CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED", "CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL"],
  communications: ["CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED", "CLONESTORE_COMMUNICATION_TEST_RECIPIENT", "CLONESTORE_COMMUNICATION_TEST_CONSENT"],
  runtime: ["PIERRE_RUNTIME_INFRA_SMOKE", "PIERRE_RUNTIME_WORKER_DATABASE_URL"],
  billing: ["PIERRE_BILLING_INFRA_SMOKE", "PIERRE_BILLING_WEBHOOK_DATABASE_URL", "PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL"],
};

export const LEGACY_CHECK_MAP = {
  "check:p83-b3-live-signature": { domain: "signature", optIns: LIVE_SMOKE_OPT_INS.signature },
  "check:p84-live-communications": { domain: "communications", optIns: LIVE_SMOKE_OPT_INS.communications },
  "check:p85-runtime-infrastructure": { domain: "runtime", optIns: LIVE_SMOKE_OPT_INS.runtime },
  "check:p86-billing-infrastructure": { domain: "billing", optIns: LIVE_SMOKE_OPT_INS.billing },
};

const aliasesOf = (spec) => [spec.name, ...(spec.aliases ?? [])];

/** Classify a variable's presence WITHOUT exposing its value. */
export function classifyEnv(spec, env, required) {
  const raw = aliasesOf(spec).map((n) => env[n]).find((v) => v !== undefined && v !== "");
  if (raw === undefined) return required ? "MISSING" : "NOT_REQUIRED";
  if (looksLikePlaceholder(raw)) return "INVALID_FORMAT";
  if (spec.format && !spec.format.test(String(raw).trim())) return "INVALID_FORMAT";
  return spec.secret ? "REDACTED" : "PRESENT";
}

/** Resolve the first-present value across a spec's aliases — for INTERNAL probe use, NEVER logged. */
export function resolveValue(spec, env) {
  for (const n of aliasesOf(spec)) { const v = env[n]; if (v !== undefined && v !== "") return v; }
  return undefined;
}

/** Find a spec by name (exact). */
export function specByName(name) {
  return LIVE_INFRA_CONTRACT.find((s) => s.name === name) ?? null;
}

// ── requireEnv: the ONE gate used by every domain (MISSING and INVALID_FORMAT both block) ─────
/** @returns {{ ok: boolean, presence: string, reason: string|null }} */
export function requireEnv(name, env) {
  const spec = specByName(name);
  if (!spec) return { ok: false, presence: "MISSING", reason: `${name} is not in the contract` };
  const presence = classifyEnv(spec, env, true);
  if (presence === "MISSING") return { ok: false, presence, reason: `${name} missing` };
  if (presence === "INVALID_FORMAT") return { ok: false, presence, reason: `${name} present but invalid/placeholder` };
  return { ok: true, presence, reason: null };
}

// ── ordered .env files per environment (lowest → highest priority; process.env always wins) ───
export function envFileOrder(environment) {
  const e = environment === "production" || environment === "staging" ? environment : "development";
  // lowest priority first; a later file overrides an earlier one; process.env overrides them all.
  // `.env.p87-runtime.local` (highest-priority FILE) holds the P8.7.2-generated dedicated role DSNs +
  // system secrets, written atomically by scripts/p87-activate-remote.mjs (gitignored, never committed).
  return [".env", ".env.local", `.env.${e}`, `.env.${e}.local`, ".env.p87-runtime.local"];
}

// ── official Yousign base URLs the real adapter accepts (no arbitrary HTTPS) ───────────────────
export const YOUSIGN_BASE_URLS = {
  sandbox: "https://api-sandbox.yousign.app/v3",
  live: "https://api.yousign.app/v3",
};
/** Recognise a Yousign base URL → 'sandbox' | 'live' | null (trailing slash tolerated). */
export function recognizeYousignUrl(url) {
  const u = String(url || "").replace(/\/$/, "");
  if (u === YOUSIGN_BASE_URLS.sandbox) return "sandbox";
  if (u === YOUSIGN_BASE_URLS.live) return "live";
  return null;
}

// ── webhook routes: source files (diagnostic) + BUILD artifacts (authoritative) + paths/events ─
export const EXPECTED_WEBHOOK_ROUTES = {
  billing: "src/app/api/webhooks/stripe/route.ts",
  communications: "src/app/api/webhooks/pierre/communications/route.ts",
  signature: "src/app/api/webhooks/pierre/signature/route.ts",
};
/** the compiled App-Router route handler each webhook produces — proof it actually ships in the build. */
export const BUILD_ROUTE_ARTIFACTS = {
  billing: ".next/server/app/api/webhooks/stripe/route.js",
  communications: ".next/server/app/api/webhooks/pierre/communications/route.js",
  signature: ".next/server/app/api/webhooks/pierre/signature/route.js",
};
export const WEBHOOK_PATHS = {
  billing: "/api/webhooks/stripe",
  communications: "/api/webhooks/pierre/communications",
  signature: "/api/webhooks/pierre/signature",
};
/** events the REAL Stripe webhook handler switches on (src/app/api/webhooks/stripe/route.ts). */
export const STRIPE_REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "invoice.payment_failed",
];
/** Resend delivery events the communication pipeline depends on. */
export const RESEND_REQUIRED_WEBHOOK_EVENTS = ["email.delivered", "email.bounced", "email.complained"];

// ── opt-in specs: EXACT values required by the 4 historical live-smoke scripts (no invention) ──
// (derived verbatim from scripts/check-p83-b3-live-signature-provider.mjs, check-p84-live-communications.mjs,
//  check-p85-runtime-infrastructure.mjs, check-p86-billing-infrastructure.mjs)
export const OPT_IN_SPECS = {
  CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED: { equals: "true" },
  CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL: { format: EMAILISH },
  CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED: { equals: "true" },
  CLONESTORE_COMMUNICATION_TEST_RECIPIENT: { format: EMAILISH },
  CLONESTORE_COMMUNICATION_TEST_CONSENT: { equals: "true" },
  PIERRE_RUNTIME_INFRA_SMOKE: { equals: "1" },
  PIERRE_BILLING_INFRA_SMOKE: { equals: "1" },
  PIERRE_RUNTIME_WORKER_DATABASE_URL: { format: POSTGRES_DSN },
  PIERRE_BILLING_WEBHOOK_DATABASE_URL: { format: POSTGRES_DSN },
  PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL: { format: POSTGRES_DSN },
};
/** Evaluate ONE opt-in against its exact spec (not merely non-empty). */
export function evaluateOptIn(name, env) {
  const v = env[name];
  if (v === undefined || v === "") return { ok: false, reason: `${name} missing` };
  if (looksLikePlaceholder(v)) return { ok: false, reason: `${name} is a placeholder` };
  const spec = OPT_IN_SPECS[name];
  if (!spec) return { ok: true, reason: null };
  if (spec.equals !== undefined && String(v) !== spec.equals) return { ok: false, reason: `${name} must equal '${spec.equals}'` };
  if (spec.format && !spec.format.test(String(v).trim())) return { ok: false, reason: `${name} has an invalid format` };
  return { ok: true, reason: null };
}

// ── per-role least-privilege matrix (verified via has_*_privilege + pg_roles attributes) ──────
export const FORBIDDEN_ROLE_ATTRS = ["rolsuper", "rolbypassrls", "rolcreaterole", "rolcreatedb", "rolreplication"];
export const FORBIDDEN_DIRECT_SELECT = ["public.pierre_rt_employees", "public.pierre_rt_documents", "public.pierre_rt_missions"];
export const ROLE_PERMISSION_MATRIX = {
  pierre_rt_runtime_worker: { mustExecute: ["pierre_rt_runtime_claim", "pierre_rt_claim_runtime_tenant_leases"] },
  pierre_rt_runtime_scheduler: { mustExecute: ["pierre_rt_claim_runtime_tenant_leases", "pierre_rt_complete_tenant_lease"] },
  pierre_rt_runtime_planner: { mustExecute: ["pierre_rt_create_compiled_mission_run"] },
  pierre_rt_communication_worker: { mustExecute: ["pierre_rt_create_internal_message"] },
  pierre_rt_communication_webhook: { mustExecute: ["pierre_rt_ingest_communication_provider_event"] },
  pierre_rt_billing_webhook: { mustExecute: ["pierre_rt_ingest_commercial_event"] },
  pierre_rt_customer_activation_worker: { mustExecute: ["pierre_rt_apply_entitlement_event"] },
};

// ── PostgreSQL error classification (never a blanket BLOCKED_NETWORK) ─────────────────────────
/** Map a pg error to the precise blocker status. */
export function classifyPgError(err) {
  const code = err && err.code ? String(err.code) : "";
  const msg = (err && err.message ? String(err.message) : "").toLowerCase();
  // 28000/28P01 invalid auth; 42501 insufficient privilege; 3D000 db missing; 42P01 undefined table; 42883 undefined function
  if (code === "28000" || code === "28P01" || /password authentication|authentication failed|no pg_hba/.test(msg)) return "BLOCKED_PERMISSION";
  if (code === "42501" || /permission denied|insufficient privilege/.test(msg)) return "BLOCKED_PERMISSION";
  if (code === "3D000" || code === "42P01" || code === "42883" || /does not exist|undefined table|undefined function/.test(msg)) return "BLOCKED_CONFIGURATION";
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "EAI_AGAIN" || /timeout|getaddrinfo|connect econnrefused|terminat/.test(msg)) return "BLOCKED_NETWORK";
  return "BLOCKED_NETWORK";
}
