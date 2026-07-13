// src/lib/clonestore/external-enablement/e1/e1-types.ts
// E1 — External Enablement / Go-Live Dependency Closure. SHARED TYPES.
//
// E1 is NOT another product architecture layer. It is a TRUTH-CLOSURE layer: it recovers, computes
// and documents everything required to move from P16C (INTEGRATION LOCALLY VERIFIED / EXTERNAL LIVE
// BLOCKED) to a production environment that the owner MAY later explicitly authorize.
//
// ABSOLUTE DOCTRINE (never collapsed):
//   1. LOCAL_READY        — code/contracts/schemas/validation/fallback/tests exist locally.
//   2. TEST_READY         — a provider can be exercised via an official test/sandbox env, no real effect.
//   3. EXTERNALLY_CONFIGURED — the owner supplied valid credentials/domains/legal identity/accounts.
//   4. PRODUCTION_AUTHORIZED — the owner explicitly authorized production after all gates pass.
//
// Code can PROVE (1) and sometimes (2). Code can NEVER prove (3) or (4). Missing external proof
// MUST surface as OWNER_ACTION_REQUIRED / PROVIDER_ACTION_REQUIRED / LEGAL_ACTION_REQUIRED / etc.
// No hardcoded green status. Secrets are NEVER printed — only presence/shape.

/** Injectable env (never read secret VALUES out of it — only presence/shape). */
export type E1Env = Record<string, string | undefined>;

/** The four never-collapsed readiness concepts. */
export type E1ReadinessConcept =
  | "LOCAL_READY"
  | "TEST_READY"
  | "EXTERNALLY_CONFIGURED"
  | "PRODUCTION_AUTHORIZED";

/** Final canonical status for a dependency ledger entry. */
export type E1DependencyStatus =
  | "LOCAL_READY"
  | "TEST_READY"
  | "OWNER_ACTION_REQUIRED"
  | "PROVIDER_ACTION_REQUIRED"
  | "LEGAL_ACTION_REQUIRED"
  | "CREDENTIAL_REQUIRED"
  | "DOMAIN_DNS_REQUIRED"
  | "DEPLOYMENT_REQUIRED"
  | "PRODUCTION_AUTHORIZATION_REQUIRED"
  | "NOT_REQUIRED_FOR_LAUNCH"
  | "BLOCKED";

export const E1_DEPENDENCY_STATUSES: readonly E1DependencyStatus[] = [
  "LOCAL_READY", "TEST_READY", "OWNER_ACTION_REQUIRED", "PROVIDER_ACTION_REQUIRED",
  "LEGAL_ACTION_REQUIRED", "CREDENTIAL_REQUIRED", "DOMAIN_DNS_REQUIRED", "DEPLOYMENT_REQUIRED",
  "PRODUCTION_AUTHORIZATION_REQUIRED", "NOT_REQUIRED_FOR_LAUNCH", "BLOCKED",
] as const;

/** Per-concept status of a dependency (fail-closed defaults). */
export type E1LocalStatus = "LOCAL_READY" | "PARTIAL" | "NOT_STARTED" | "NOT_APPLICABLE";
export type E1SandboxStatus = "TEST_READY" | "SANDBOX_AVAILABLE_NOT_CONFIGURED" | "NOT_APPLICABLE" | "BLOCKED";
export type E1ExternalConfigStatus = "CONFIGURED" | "NOT_CONFIGURED" | "PARTIALLY_CONFIGURED_BY_SHAPE" | "NOT_APPLICABLE";
export type E1ProductionAuthStatus = "AUTHORIZED" | "NOT_AUTHORIZED";

export type E1Severity = "blocker" | "warning" | "info";
export type E1LaunchCriticality = "launch_critical" | "launch_optional" | "later_roadmap";
export type E1Owner = "engineering" | "owner" | "provider" | "legal" | "external";

/** One external dependency in the canonical ledger. */
export interface E1DependencyEntry {
  readonly id: string;
  readonly name: string;
  /** Where in the real repo this blocker is recovered from. */
  readonly canonicalSource: string;
  readonly localStatus: E1LocalStatus;
  readonly sandboxStatus: E1SandboxStatus;
  readonly externalConfigStatus: E1ExternalConfigStatus;
  readonly productionAuthStatus: E1ProductionAuthStatus;
  /** Required external provider / account (null when purely local). */
  readonly requiredProvider: string | null;
  /** Env variable NAMES required (never values). */
  readonly requiredCredentialNames: readonly string[];
  readonly requiredDnsDomainAction: string | null;
  readonly requiredLegalOwnerAction: string | null;
  /** Work Claude can safely complete inside the repo. */
  readonly locallyImplementableWork: string;
  /** Dashboard/legal/domain/provider action the owner must perform. */
  readonly externalOwnerAction: string;
  /** Exact proof required AFTER the external action (never satisfiable by code). */
  readonly validationMethod: string;
  readonly blockingSeverity: E1Severity;
  readonly launchCriticality: E1LaunchCriticality;
  readonly safeFallback: string;
  /** The claim that must NOT be made until real external proof exists. */
  readonly forbiddenClaim: string;
  readonly currentOwner: E1Owner;
  readonly finalStatus: E1DependencyStatus;
}

/** A single environment variable in the typed environment contract. */
export interface E1EnvVar {
  readonly name: string;
  readonly serverOnly: boolean;
  /** Which lifecycle stages REQUIRE this variable. */
  readonly requiredIn: readonly ("local" | "test" | "staging" | "production")[];
  readonly owner: E1Owner;
  readonly provider: string | null;
  readonly category: E1EnvCategory;
  /** Human validation rule (shape only — never a value assertion). */
  readonly validationRule: string;
  readonly safeDefault: string | null;
  readonly failureBehavior: string;
  readonly feature: string;
  /** Is this variable a SECRET (must never be exposed client-side / logged)? */
  readonly secret: boolean;
  /** Optional expected key-shape prefix used to sanity-check presence WITHOUT reading the value. */
  readonly shapePrefixes?: readonly string[];
}

export type E1EnvCategory =
  | "app_url"
  | "supabase"
  | "auth"
  | "openai"
  | "anthropic"
  | "stripe_test"
  | "stripe_live"
  | "stripe_webhook"
  | "email_provider"
  | "email_domain"
  | "signature"
  | "voice"
  | "telephony"
  | "monitoring"
  | "deployment"
  | "rate_limit_budget"
  | "kill_switch"
  | "production_authorization";

/** Presence/shape verdict for one env var — NEVER contains the value. */
export interface E1EnvPresence {
  readonly name: string;
  readonly present: boolean;
  readonly shape: "absent" | "placeholder" | "test" | "live" | "webhook_secret" | "url" | "value";
  readonly serverOnly: boolean;
  readonly secret: boolean;
  readonly requiredInProduction: boolean;
}
