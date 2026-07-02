// Types for controlled-live-journey-check.mjs (P8.7.4 STAGE 2 controlled-live-journey verifier).
export const KNOWN_OLD_RUN_IDS: string[];
export const CANONICAL_SCOPE: string;
export const GOVERNED_CORE_SCOPE_MARKER: string;
export const DOC_ENGINE: string;
export const EXPECTED_PRICE_AMOUNT: number;
export const EXPECTED_CURRENCY: string;
export const REQUIRED_PROOFS: string[];

export interface JourneyStep {
  key: string;
  ok: boolean;
  detail: string;
}

export interface JourneyRefusal {
  rule: string;
  reason: string;
}

export interface ControlledJourneyReport {
  phase: string;
  stage: string;
  generated_at: string;
  run_id: string | null;
  verdict: "VERIFIED" | "REFUSED" | "PROOF_REQUIRED";
  ok: boolean;
  steps: JourneyStep[];
  refusals: JourneyRefusal[];
  missing: string[];
  human_signature_action_required: boolean;
  summary: string;
  load_error?: string;
}

export interface ProofBundle {
  run_id: string;
  files: Record<string, any>;
  present?: string[];
  missing?: string[];
}

export interface ControlledJourneyDeps {
  loadBundle?: () => ProofBundle | null;
  knownOldRunIds?: string[];
  now?: string | null;
}

export function runControlledLiveJourneyCheck(deps?: ControlledJourneyDeps): ControlledJourneyReport;
