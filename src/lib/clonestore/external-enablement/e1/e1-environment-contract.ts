// src/lib/clonestore/external-enablement/e1/e1-environment-contract.ts
// E1 §5 — Canonical TYPED environment/secret contract. Enumerates every environment variable the
// application relies on for go-live, classified by category, with server/public separation, required
// stages, validation rule (SHAPE only), safe default and failure behavior.
//
// HARD RULES (enforced by the secret-boundary evaluator + tests):
//  - a server SECRET is NEVER exposed through NEXT_PUBLIC_*.
//  - secret VALUES are NEVER read/printed/returned — only presence + coarse shape.
//  - unknown/missing production secrets fail closed.
//  - malformed boolean flags fail closed.
//  - production authorization is NEVER inferred from NODE_ENV.
//  - payment live is NEVER inferred from Stripe key shape alone.
//  - provider readiness requires explicit independent proof (not a name in this registry).

import type { E1Env, E1EnvVar, E1EnvPresence } from "./e1-types";

const val = (env: E1Env, name: string): string => (env[name] ?? "").trim();

/** Placeholder tokens shipped in .env.example that must NOT count as a configured secret. */
const PLACEHOLDER_TOKENS = [
  "your-", "sk-ant-...", "sk-...", "sk_test_...", "pk_test_...", "whsec_...", "re_...",
  "price_...", "...", "example.com", "your-internal-secret-here", "noreply@example.com",
  "sandbox@yourteam.com",
];

function isPlaceholder(v: string): boolean {
  if (!v) return false;
  const low = v.toLowerCase();
  return PLACEHOLDER_TOKENS.some((t) => low === t.toLowerCase() || low.startsWith(t.toLowerCase()) && t.endsWith("..."))
    || /^your[-_]/.test(low)
    || low.endsWith("...");
}

/** Coarse shape of a value — NEVER reveals the value itself. */
export function envShape(env: E1Env, v: E1EnvVar): E1EnvPresence["shape"] {
  const raw = val(env, v.name);
  if (!raw) return "absent";
  if (isPlaceholder(raw)) return "placeholder";
  if (/^sk_live_|^pk_live_|^rk_live_/.test(raw)) return "live";
  if (/^sk_test_|^pk_test_|^rk_test_/.test(raw)) return "test";
  if (/^whsec_/.test(raw)) return "webhook_secret";
  if (/^https?:\/\//.test(raw)) return "url";
  return "value";
}

// ── The canonical environment contract ──────────────────────────────────────────────────
// requiredIn lists the lifecycle stages where the variable MUST be present. `secret:true` means it
// must stay server-only and never be logged/exposed.
export const E1_ENVIRONMENT_CONTRACT: readonly E1EnvVar[] = [
  // ── App / public URLs ──
  { name: "NEXT_PUBLIC_APP_URL", serverOnly: false, requiredIn: ["production"], owner: "owner", provider: null, category: "app_url", validationRule: "https URL of the production domain (not localhost).", safeDefault: "http://localhost:3000", failureBehavior: "Absolute links fall back to localhost — safe for dev, wrong for prod checkout/return URLs.", feature: "Checkout return URLs, absolute links, emails.", secret: false, shapePrefixes: ["http"] },
  { name: "NEXT_PUBLIC_SITE_URL", serverOnly: false, requiredIn: [], owner: "owner", provider: null, category: "app_url", validationRule: "https URL used by founder/partner emails and links.", safeDefault: null, failureBehavior: "Links fall back to NEXT_PUBLIC_APP_URL where used.", feature: "Founder/partner program links.", secret: false, shapePrefixes: ["http"] },

  // ── Supabase ──
  { name: "NEXT_PUBLIC_SUPABASE_URL", serverOnly: false, requiredIn: ["production"], owner: "owner", provider: "Supabase", category: "supabase", validationRule: "https URL of the production Supabase project.", safeDefault: null, failureBehavior: "No DB connection — server data operations fail.", feature: "Database, auth.", secret: false, shapePrefixes: ["http"] },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", serverOnly: false, requiredIn: ["production"], owner: "owner", provider: "Supabase", category: "supabase", validationRule: "Public anon JWT (RLS-restricted; safe for client).", safeDefault: null, failureBehavior: "Client auth fails.", feature: "Client auth, RLS-scoped reads.", secret: false },
  { name: "SUPABASE_SERVICE_ROLE_KEY", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: "Supabase", category: "supabase", validationRule: "Server-only service-role JWT. NEVER exposed to the client.", safeDefault: null, failureBehavior: "Server-privileged operations (webhooks, admin) fail closed.", feature: "Webhooks, server writes, cost ledger.", secret: true },

  // ── Auth ──
  { name: "PIERRE_INTERNAL_DIAGNOSTICS_SECRET", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: null, category: "auth", validationRule: "Server-only secret for /api/pierre/observability diagnostics.", safeDefault: null, failureBehavior: "Diagnostics routes deny access (fail-closed).", feature: "Internal observability endpoints.", secret: true },

  // ── OpenAI / Anthropic ──
  { name: "OPENAI_API_KEY", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: "OpenAI", category: "openai", validationRule: "sk-… server-only. Only used when AI_RUNTIME_MODE=production.", safeDefault: null, failureBehavior: "AI runtime stays in mock mode; real calls blocked by cost shield.", feature: "CloneChat / Pierre reasoning (governed).", secret: true, shapePrefixes: ["sk-"] },
  { name: "ANTHROPIC_API_KEY", serverOnly: true, requiredIn: [], owner: "owner", provider: "Anthropic", category: "anthropic", validationRule: "sk-ant-… server-only. Disabled until explicit budget allocation (AI_ANTHROPIC_ENABLED).", safeDefault: null, failureBehavior: "Anthropic provider disabled; OpenAI-only path used.", feature: "Premium document generation (deferred).", secret: true, shapePrefixes: ["sk-ant-"] },

  // ── Stripe (test / live / webhook) ──
  { name: "STRIPE_SECRET_KEY", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: "Stripe", category: "stripe_test", validationRule: "sk_test_ in dev/test; sk_live_ ONLY in production after owner setup. Server-only.", safeDefault: null, failureBehavior: "Checkout returns 503 STRIPE_NOT_CONFIGURED; no session created.", feature: "Checkout, billing.", secret: true, shapePrefixes: ["sk_test_", "sk_live_", "rk_test_", "rk_live_"] },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", serverOnly: false, requiredIn: ["production"], owner: "owner", provider: "Stripe", category: "stripe_test", validationRule: "pk_test_/pk_live_ — publishable, safe for client.", safeDefault: null, failureBehavior: "Client Stripe UI unavailable.", feature: "Client checkout redirect.", secret: false, shapePrefixes: ["pk_test_", "pk_live_"] },
  { name: "STRIPE_WEBHOOK_SECRET", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: "Stripe", category: "stripe_webhook", validationRule: "whsec_… from the registered live webhook endpoint. Server-only.", safeDefault: null, failureBehavior: "Webhook signature cannot be verified → events rejected (fail-closed).", feature: "Payment activation via verified webhook.", secret: true, shapePrefixes: ["whsec_"] },
  { name: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: "Stripe", category: "stripe_live", validationRule: "price_… for 449 EUR/month (FR/BE/LU). Legacy STRIPE_PRICE_PIERRE accepted (same currency).", safeDefault: null, failureBehavior: "EUR checkout fail-closed (no cross-currency fallback).", feature: "FR/BE/LU pricing.", secret: false, shapePrefixes: ["price_"] },
  { name: "STRIPE_PRICE_PIERRE_CHF_MONTHLY", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: "Stripe", category: "stripe_live", validationRule: "price_… for 499 CHF/month (CH). NO alias — strict fail-closed.", safeDefault: null, failureBehavior: "CH checkout fail-closed (never uses EUR).", feature: "CH pricing.", secret: false, shapePrefixes: ["price_"] },
  { name: "STRIPE_COUNTRY_PRICING_ENABLED", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: null, category: "stripe_live", validationRule: "Boolean flag. Must be enabled to serve country-aware pricing + checkout guard.", safeDefault: "false", failureBehavior: "Country-aware checkout inactive (fail-closed to single-price flow).", feature: "Country pricing + reconciliation.", secret: false },
  { name: "STRIPE_COUNTRY_RECONCILIATION_ENABLED", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: null, category: "stripe_live", validationRule: "Boolean flag. Enables CH/EUR mismatch enforcement on activation paths.", safeDefault: "false", failureBehavior: "Conflicts audited, not enforced (default OFF).", feature: "Billing-country reconciliation.", secret: false },

  // ── Email provider + sending domain ──
  { name: "EMAIL_RUNTIME_MODE", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "email_provider", validationRule: "mock|dry_run|sandbox|live. live requires EMAIL_SEND_LIVE=true + RESEND_API_KEY + paid customer.", safeDefault: "mock", failureBehavior: "Defaults to mock — no real send.", feature: "Transactional email.", secret: false },
  { name: "EMAIL_SEND_LIVE", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "email_provider", validationRule: "Boolean. Must be explicitly true for real delivery.", safeDefault: "false", failureBehavior: "No live send (fail-closed).", feature: "Email delivery gate.", secret: false },
  { name: "RESEND_API_KEY", serverOnly: true, requiredIn: [], owner: "owner", provider: "Resend", category: "email_provider", validationRule: "re_… server-only. Never logged.", safeDefault: null, failureBehavior: "Email provider stays mock; no real send.", feature: "Resend delivery.", secret: true, shapePrefixes: ["re_"] },
  { name: "EMAIL_PROVIDER", serverOnly: true, requiredIn: [], owner: "owner", provider: "Resend", category: "email_provider", validationRule: "Set to 'resend' to activate the provider adapter.", safeDefault: "mock", failureBehavior: "Mock provider used.", feature: "Provider selection.", secret: false },
  { name: "RESEND_DEFAULT_FROM", serverOnly: true, requiredIn: [], owner: "owner", provider: "Resend", category: "email_domain", validationRule: "From identity on a verified sending domain.", safeDefault: null, failureBehavior: "Sender rejected if domain unverified.", feature: "Sender identity.", secret: false },
  { name: "RESEND_ALLOWED_FROM_DOMAINS", serverOnly: true, requiredIn: [], owner: "owner", provider: "Resend", category: "email_domain", validationRule: "Comma-separated verified from-domains (SPF/DKIM/DMARC set externally).", safeDefault: null, failureBehavior: "Send blocked if from-domain not allow-listed.", feature: "Domain allow-list.", secret: false },

  // ── Signature ──
  { name: "CLONESTORE_SIGNATURE_LIVE_VERIFIED", serverOnly: true, requiredIn: [], owner: "owner", provider: "Yousign", category: "signature", validationRule: "Owner attestation flag — only true after real Yousign live verification.", safeDefault: "false", failureBehavior: "Signature stays prepared-not-signed (fail-closed).", feature: "Live e-signature.", secret: false },
  { name: "CLONESTORE_SIGNATURE_FALLBACK_APPROVED", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "signature", validationRule: "Owner flag approving the 'document prepared, signed manually outside CloneStore' fallback.", safeDefault: "false", failureBehavior: "No signature claim at all until approved.", feature: "Signature fallback.", secret: false },

  // ── Voice / telephony ──
  { name: "CLONEVOICE_RUNTIME_MODE", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "voice", validationRule: "disabled|mock|sandbox|production. Live voice is roadmap (B47+).", safeDefault: "disabled", failureBehavior: "Voice disabled; text authoritative.", feature: "CloneVoice.", secret: false },

  // ── Monitoring ──
  { name: "CLONESTORE_MONITORING_ROLLBACK_VERIFIED", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "monitoring", validationRule: "Owner attestation after rehearsing rollback + deploying health route.", safeDefault: "false", failureBehavior: "Monitoring gate fails closed.", feature: "Go-live monitoring.", secret: false },
  { name: "PIERRE_OBSERVABILITY_ENABLED", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: null, category: "monitoring", validationRule: "Boolean. true = observability active.", safeDefault: "true", failureBehavior: "No events recorded if false.", feature: "Observability.", secret: false },

  // ── Deployment ──
  { name: "CLONESTORE_DEPLOY_PROOF", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "deployment", validationRule: "Owner-set only AFTER a real deployment + health verification.", safeDefault: "false", failureBehavior: "Launch status never reaches LAUNCHED (fail-closed).", feature: "Deploy proof.", secret: false },

  // ── Rate-limit / budget ──
  { name: "AI_COST_SHIELD_MODE", serverOnly: true, requiredIn: ["production"], owner: "owner", provider: null, category: "rate_limit_budget", validationRule: "disabled|observe|enforce. Production MUST be enforce.", safeDefault: "enforce", failureBehavior: "Enforce by default — non-paying users get 0€ AI.", feature: "AI cost shield.", secret: false },
  { name: "AI_GLOBAL_MONTHLY_CAP_CENTS", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "rate_limit_budget", validationRule: "Integer cents — global monthly AI budget cap.", safeDefault: "1000", failureBehavior: "Falls back to conservative default.", feature: "Budget cap.", secret: false },

  // ── Emergency kill switches ──
  { name: "CLONECHAT_ENABLED", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "kill_switch", validationRule: "Leave UNSET for active. Set to false/0/off/disabled/no as EMERGENCY shutdown only.", safeDefault: "(unset = active)", failureBehavior: "Set false → CloneChat page + /api/assistant/chat fail-close (503).", feature: "CloneChat kill switch.", secret: false },
  { name: "AI_EMERGENCY_SHUTDOWN", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "kill_switch", validationRule: "Boolean. true = block ALL AI calls globally.", safeDefault: "false", failureBehavior: "Set true → all AI calls blocked.", feature: "Global AI kill switch.", secret: false },

  // ── Production authorization ──
  // NOTE: there is NO env var that can authorize production. PRODUCTION_AUTHORIZED is a code const
  // (p10-production-gate.ts) that requires a deliberate code change. Env owner-approval flags feed the
  // go-live gates but can NEVER lift the P10 hard floor. This entry documents that boundary.
  { name: "CLONESTORE_OWNER_GOLIVE_APPROVED", serverOnly: true, requiredIn: [], owner: "owner", provider: null, category: "production_authorization", validationRule: "Owner sign-off flag. Feeds gate G; NEVER lifts the P10 hard floor by itself.", safeDefault: "false", failureBehavior: "Owner-approval gate fails closed.", feature: "Go-live owner approval.", secret: false },
];

/** Compute presence/shape for every contract var (NEVER returns values). Pure. */
export function computeEnvPresence(env: E1Env = process.env): E1EnvPresence[] {
  return E1_ENVIRONMENT_CONTRACT.map((v) => {
    const shape = envShape(env, v);
    return {
      name: v.name,
      present: shape !== "absent" && shape !== "placeholder",
      shape,
      serverOnly: v.serverOnly,
      secret: v.secret,
      requiredInProduction: v.requiredIn.includes("production"),
    };
  });
}

export interface E1SecretBoundaryResult {
  readonly ok: boolean;
  /** Every secret var must be server-only (never NEXT_PUBLIC_). */
  readonly secretsAreServerOnly: boolean;
  /** No NEXT_PUBLIC_ variable may be marked secret. */
  readonly noPublicSecret: boolean;
  /** No secret is exposed by name shape as a public var. */
  readonly violations: string[];
  /** Vars whose VALUE this contract reads — must be empty (we only read presence/shape). */
  readonly valueReadingVars: string[];
  readonly note: string;
}

/**
 * Secret boundary invariant: a server SECRET must never be exposed via NEXT_PUBLIC_*, and no
 * NEXT_PUBLIC_* var may be a secret. Pure — reads only the contract definitions, never env values.
 */
export function evaluateSecretBoundary(): E1SecretBoundaryResult {
  const violations: string[] = [];
  for (const v of E1_ENVIRONMENT_CONTRACT) {
    const isPublicName = v.name.startsWith("NEXT_PUBLIC_");
    if (v.secret && isPublicName) violations.push(`${v.name}: secret exposed via NEXT_PUBLIC_ prefix.`);
    if (v.secret && !v.serverOnly) violations.push(`${v.name}: secret not marked server-only.`);
    if (isPublicName && v.secret) violations.push(`${v.name}: public var flagged secret.`);
  }
  const secretsAreServerOnly = E1_ENVIRONMENT_CONTRACT.filter((v) => v.secret).every((v) => v.serverOnly && !v.name.startsWith("NEXT_PUBLIC_"));
  const noPublicSecret = E1_ENVIRONMENT_CONTRACT.filter((v) => v.name.startsWith("NEXT_PUBLIC_")).every((v) => !v.secret);
  return {
    ok: violations.length === 0 && secretsAreServerOnly && noPublicSecret,
    secretsAreServerOnly,
    noPublicSecret,
    violations,
    valueReadingVars: [], // this contract reads presence/shape only, never values
    note: "Secret boundary is a STATIC invariant of the contract. Presence/shape checks never read secret values; secrets never carry a NEXT_PUBLIC_ prefix.",
  };
}

export interface E1EnvContractReadiness {
  readonly totalVars: number;
  readonly serverOnlyCount: number;
  readonly publicCount: number;
  readonly secretCount: number;
  readonly requiredInProductionCount: number;
  readonly presentByShape: number;
  readonly missingRequiredForProduction: string[];
  readonly secretBoundary: E1SecretBoundaryResult;
  readonly contractReady: boolean;
  readonly presence: E1EnvPresence[];
}

/** Overall environment-contract readiness. Pure (reads presence/shape only). */
export function evaluateEnvironmentContract(env: E1Env = process.env): E1EnvContractReadiness {
  const presence = computeEnvPresence(env);
  const secretBoundary = evaluateSecretBoundary();
  const requiredProd = E1_ENVIRONMENT_CONTRACT.filter((v) => v.requiredIn.includes("production"));
  const missingRequiredForProduction = requiredProd
    .filter((v) => { const p = presence.find((x) => x.name === v.name); return !p || !p.present; })
    .map((v) => v.name);
  return {
    totalVars: E1_ENVIRONMENT_CONTRACT.length,
    serverOnlyCount: E1_ENVIRONMENT_CONTRACT.filter((v) => v.serverOnly).length,
    publicCount: E1_ENVIRONMENT_CONTRACT.filter((v) => !v.serverOnly).length,
    secretCount: E1_ENVIRONMENT_CONTRACT.filter((v) => v.secret).length,
    requiredInProductionCount: requiredProd.length,
    presentByShape: presence.filter((p) => p.present).length,
    missingRequiredForProduction,
    secretBoundary,
    // The contract itself is "ready" when it is complete and the secret boundary holds. It does NOT
    // claim the secrets are configured — that requires external owner action (see the ledger).
    contractReady: secretBoundary.ok && E1_ENVIRONMENT_CONTRACT.length > 0,
    presence,
  };
}
