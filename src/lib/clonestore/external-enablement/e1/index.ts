// src/lib/clonestore/external-enablement/e1/index.ts
// E1 — External Enablement / Go-Live Dependency Closure. Public surface.
// A TRUTH-CLOSURE layer only: it recovers, computes and documents everything required to move from
// P16C (INTEGRATION LOCALLY VERIFIED / EXTERNAL LIVE BLOCKED) to an owner-authorized production.
// It enables NOTHING: no production, no payment, no live provider, no deployment.

export * from "./e1-types";
export {
  E1_ENVIRONMENT_CONTRACT, envShape, computeEnvPresence, evaluateSecretBoundary,
  evaluateEnvironmentContract,
  type E1SecretBoundaryResult, type E1EnvContractReadiness,
} from "./e1-environment-contract";
export {
  buildE1DependencyLedger, summarizeE1Ledger, type E1LedgerSummary,
} from "./e1-external-dependency-ledger";
export {
  auditMigrations, evaluateSupabaseLocalReadiness,
  type E1MigrationAudit, type E1SupabaseLocalReadiness,
} from "./e1-supabase-readiness";
export {
  computeE1CommandCenter, type E1CommandCenter, type E1Verdict,
} from "./e1-command-center";
