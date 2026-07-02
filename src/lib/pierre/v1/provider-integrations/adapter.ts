// src/lib/pierre/v1/provider-integrations/adapter.ts
// PHASE 8.12 — the provider adapter builder. Every provider is declared through here so it always
// carries required env vars, an optional external-blocker, a governed manual handoff, and webhook
// config. No adapter ships a live network implementation in P8.12.
import type { ProviderAdapter, ProviderId, ManualHandoffPath } from "./types";

export function defineProvider(p: {
  id: ProviderId; displayName: string; requiredEnvVars: string[];
  blockedByExternalBlocker?: string | null; manualSteps: string[]; manualEvidence: string;
  webhookSignatureHeader?: string | null; webhookSecretEnvVar?: string | null;
}): ProviderAdapter {
  const manualHandoff: ManualHandoffPath = { provider: p.id, available: true, steps: p.manualSteps, producesEvidence: p.manualEvidence };
  return {
    id: p.id, displayName: p.displayName, requiredEnvVars: p.requiredEnvVars,
    blockedByExternalBlocker: p.blockedByExternalBlocker ?? null, manualHandoff,
    webhookSignatureHeader: p.webhookSignatureHeader ?? null, webhookSecretEnvVar: p.webhookSecretEnvVar ?? null,
  };
}
