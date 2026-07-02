// src/lib/pierre/v1/provider-integrations/types.ts
// PHASE 8.12 — provider integration types. A provider is only usable when LIVE-configured (real
// credentials present + not blocked). Absent config → not_configured; a blocked provider (e.g.
// Yousign, external blocker P8.7.4) is never live regardless of config. Submission NEVER simulates
// success: an unusable provider routes to the governed manual handoff.

export type ProviderId = "yousign" | "payroll" | "identity" | "time_attendance" | "benefits" | "training";

export type ProviderStatus = "not_configured" | "sandbox_configured" | "live_configured" | "blocked";

export type PreflightResult = {
  provider: ProviderId;
  status: ProviderStatus;
  configured: boolean;
  missingCredentials: string[];
  blockedReason: string | null;
  usable: boolean;               // true only if live_configured and not blocked
};

export type SubmissionOutcome = "submitted" | "refused_not_usable" | "routed_to_manual";
export type SubmissionResult = {
  provider: ProviderId;
  outcome: SubmissionOutcome;
  reference: string | null;      // provider ref if actually submitted (never fabricated)
  manualHandoffId: string | null;
  reason: string;
};

export type ManualHandoffPath = {
  provider: ProviderId;
  available: boolean;
  steps: string[];               // the governed manual steps a human follows
  producesEvidence: string;      // what proof the manual path yields
};

export type ProviderAdapter = {
  id: ProviderId;
  displayName: string;
  requiredEnvVars: string[];
  blockedByExternalBlocker: string | null;  // e.g. "P8.7.4 Yousign"
  manualHandoff: ManualHandoffPath;
  // webhook signature header + env secret name (for governed inbound verification)
  webhookSignatureHeader: string | null;
  webhookSecretEnvVar: string | null;
};
