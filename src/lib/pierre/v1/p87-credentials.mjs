// src/lib/pierre/v1/p87-credentials.mjs
// PHASE 8.7.2 — credential generation for the dedicated runtime/billing identities + internal system
// secrets. CSPRNG only; every secret distinct + high-entropy; NEVER derived from one another; the public
// API returns a value bundle for INSTALLATION plus a REDACTED manifest for reporting (values never appear
// in the manifest, logs, or git). Pure + injectable (randomBytes) so tests are deterministic + leak-proof.

import { randomBytes as nodeRandomBytes } from "crypto";

/** The seven dedicated DSN env vars ↔ their exact PostgreSQL roles. */
export const ROLE_DSN_VARS = [
  ["PIERRE_RUNTIME_WORKER_DATABASE_URL", "pierre_rt_runtime_worker"],
  ["PIERRE_RUNTIME_SCHEDULER_DATABASE_URL", "pierre_rt_runtime_scheduler"],
  ["PIERRE_RUNTIME_PLANNER_DATABASE_URL", "pierre_rt_runtime_planner"],
  ["PIERRE_COMMUNICATION_WORKER_DATABASE_URL", "pierre_rt_communication_worker"],
  ["PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL", "pierre_rt_communication_webhook"],
  ["PIERRE_BILLING_WEBHOOK_DATABASE_URL", "pierre_rt_billing_webhook"],
  ["PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL", "pierre_rt_customer_activation_worker"],
];

/** Internal system secrets (each distinct, never derived). */
export const SYSTEM_SECRET_VARS = [
  "PIERRE_RUNTIME_SYSTEM_SECRET",
  "PIERRE_COMMUNICATION_SYSTEM_SECRET",
  "PIERRE_HANDOFF_TOKEN_SECRET",
  "CLONESTORE_COMMUNICATION_LINK_SECRET",
];

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** A DSN password: url-safe, no '@' ':' '/' so it never breaks the DSN; ~32 bytes of entropy. */
export function generateRolePassword(randomBytes = nodeRandomBytes) { return b64url(randomBytes(32)); }
/** A system secret: ~48 bytes of entropy. */
export function generateSystemSecret(randomBytes = nodeRandomBytes) { return b64url(randomBytes(48)); }

/** Build a dedicated DSN from an admin DSN template, substituting the role identity + password + TLS. */
export function buildRoleDsn(adminDsn, role, password) {
  const u = new URL(adminDsn.replace(/^postgres(ql)?:/, "http:"));
  u.username = role;
  u.password = password;
  const sp = u.searchParams;
  // TLS REQUIRED, cert NOT verified: Supabase presents a self-signed chain, and the newer pg driver aliases
  // sslmode=require/verify-ca to verify-full (which rejects it). `no-verify` negotiates TLS without cert
  // verification (matches ssl:{rejectUnauthorized:false} in the connection code); pg_stat_ssl.ssl stays true.
  sp.set("sslmode", "no-verify");
  const auth = `${encodeURIComponent(role)}:${encodeURIComponent(password)}`;
  const qs = sp.toString();
  return `postgresql://${auth}@${u.host}${u.pathname}${qs ? `?${qs}` : ""}`;
}

/**
 * Produce the full credential bundle. `values` is for INSTALLATION ONLY (write to a gitignored env file /
 * secret manager — never log). `manifest` is safe to report: it carries presence + role mapping, never a value.
 * Distinctness is guaranteed (CSPRNG); asserted by the caller's tests.
 */
export function buildCredentialBundle(adminDsn, opts = {}) {
  const randomBytes = opts.randomBytes || nodeRandomBytes;
  const env = opts.environment || "staging";
  const values = {};
  const manifest = { phase: "P8.7.2", environment: env, generated_at: opts.now || null, entries: [] };
  for (const [varName, role] of ROLE_DSN_VARS) {
    const pw = generateRolePassword(randomBytes);
    values[varName] = buildRoleDsn(adminDsn, role, pw);
    manifest.entries.push({ variable: varName, role, kind: "dedicated_dsn", tls: "no-verify", status: "REDACTED" });
  }
  for (const varName of SYSTEM_SECRET_VARS) {
    values[varName] = generateSystemSecret(randomBytes);
    manifest.entries.push({ variable: varName, role: null, kind: "system_secret", status: "REDACTED" });
  }
  return { values, manifest };
}

/** Render a gitignored .env fragment for the bundle (the ONLY place values are written). */
export function renderEnvFragment(values) {
  return Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}
