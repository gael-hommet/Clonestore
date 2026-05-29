// P-FINAL 01 — Phase 9 — Final go-live verdict.
// Combines B48 verdict + P-FINAL 01 legal pages + Stripe + RLS + copy scan.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: verdict can never be "go" without all blocking proofs verified.

import type { ManualVerificationFlags } from "./types";
import { buildB48FinalVerdict } from "./launch-verdict";
import { buildPublicLaunchGate, type LaunchGateInput } from "./public-launch-gate";
import { MANUAL_PROOF_REGISTRY, getBlockingProofs } from "./manual-proof-registry";

export type GoLiveStatus =
  | "go"                     // All clear — public launch approved
  | "no_go_b48_incomplete"   // B48 technical checks not done
  | "no_go_manual_proofs"    // Manual proofs not verified
  | "no_go_flags_missing"    // B48 manual flags not set
  | "no_go_blockers";        // Multiple blockers

export interface FinalGoLiveVerdict {
  status: GoLiveStatus;
  is_go: boolean;
  b48_status: string;
  b48_is_technically_complete: boolean;
  b48_all_manual_flags_done: boolean;
  pfinal01_proofs_verified: number;
  pfinal01_proofs_required: number;
  all_blocking_proofs_done: boolean;
  blockers: string[];
  warnings: string[];
  evaluated_at: string;
}

export function buildFinalGoLiveVerdict(
  input: LaunchGateInput & { b48_flags?: Partial<ManualVerificationFlags> }
): FinalGoLiveVerdict {
  const b48Verdict = buildB48FinalVerdict(input.b48_flags);
  const gate = buildPublicLaunchGate(input);

  const blockingProofs = getBlockingProofs();
  const verifiedIds = new Set(input.verified_proof_ids ?? []);
  const pfinal01_proofs_verified = blockingProofs.filter((p) => verifiedIds.has(p.id)).length;

  const all_blocking_proofs_done = pfinal01_proofs_verified === blockingProofs.length;

  // Determine status
  let status: GoLiveStatus;
  if (gate.is_go) {
    status = "go";
  } else if (!b48Verdict.is_technically_complete) {
    status = "no_go_b48_incomplete";
  } else if (!gate.b48_flags_all_blocking_done) {
    status = "no_go_flags_missing";
  } else if (!all_blocking_proofs_done) {
    status = "no_go_manual_proofs";
  } else {
    status = "no_go_blockers";
  }

  const blockers: string[] = [
    ...gate.blockers,
    ...(b48Verdict.blocking_items.filter((b) => !gate.blockers.includes(b))),
  ];

  const warnings: string[] = [
    ...gate.warnings,
    ...b48Verdict.warnings.filter((w) => !gate.warnings.includes(w)),
  ];

  return {
    status,
    is_go: status === "go",
    b48_status: b48Verdict.status,
    b48_is_technically_complete: b48Verdict.is_technically_complete,
    b48_all_manual_flags_done: gate.b48_flags_all_blocking_done,
    pfinal01_proofs_verified,
    pfinal01_proofs_required: blockingProofs.length,
    all_blocking_proofs_done,
    blockers,
    warnings,
    evaluated_at: new Date().toISOString(),
  };
}

export function isFinalGoLive(input: LaunchGateInput): boolean {
  return buildFinalGoLiveVerdict(input).is_go;
}

// All proof ids — useful for fixtures
export function getAllBlockingProofIds(): string[] {
  return getBlockingProofs().map((p) => p.id);
}

export function getAllProofIds(): string[] {
  return MANUAL_PROOF_REGISTRY.map((p) => p.id);
}
