// src/lib/pierre/v1/provider-integrations/evidence.ts
// PHASE 8.12 — provider interaction evidence (PII-free): preflight status, submission outcome,
// reconciliation. Records honestly whether it was a real submission or a governed manual handoff.
import type { PreflightResult, SubmissionResult } from "./types";

export type ProviderEvidence = {
  provider: string;
  status: string;
  usable: boolean;
  outcome: string;
  reference: string | null;
  manualHandoffId: string | null;
  recordedAt: string;
};

export function buildProviderEvidence(pf: PreflightResult, sub: SubmissionResult, recordedAt: string): ProviderEvidence {
  return { provider: pf.provider, status: pf.status, usable: pf.usable, outcome: sub.outcome, reference: sub.reference, manualHandoffId: sub.manualHandoffId, recordedAt };
}
