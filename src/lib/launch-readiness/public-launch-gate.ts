// P-FINAL 01 — Phase 9 — Public launch gate.
// Aggregates all P-FINAL 01 proofs + B48 flags into a go/no-go decision.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: is_go can NEVER be true if any blocking proof is unverified.

import type { ManualVerificationFlags } from "./types";
import { getDefaultManualFlags, evaluateManualFlags } from "./production-flags";
import {
  MANUAL_PROOF_REGISTRY,
  getBlockingProofs,
  areAllBlockingProofsVerified,
} from "./manual-proof-registry";

export interface LaunchGateInput {
  // B48 manual flags
  b48_flags?: Partial<ManualVerificationFlags>;
  // P-FINAL 01 verified proof ids
  verified_proof_ids?: string[];
}

export interface LaunchGateResult {
  is_go: boolean;
  b48_flags_all_blocking_done: boolean;
  pfinal01_blocking_proofs_verified: boolean;
  blockers: string[];
  warnings: string[];
  verified_proof_count: number;
  total_blocking_proof_count: number;
  evaluated_at: string;
}

export function buildPublicLaunchGate(input: LaunchGateInput): LaunchGateResult {
  const b48Flags = { ...getDefaultManualFlags(), ...(input.b48_flags ?? {}) };
  const flagEval = evaluateManualFlags(b48Flags);
  const verifiedIds = input.verified_proof_ids ?? [];

  const blockingProofs = getBlockingProofs();
  const pfinal01_blocking_proofs_verified = areAllBlockingProofsVerified(verifiedIds);

  const blockers: string[] = [
    ...flagEval.blocking_unverified,
    ...blockingProofs
      .filter((p) => !verifiedIds.includes(p.id))
      .map((p) => p.label),
  ];

  const warnings: string[] = [
    ...flagEval.non_blocking_unverified,
    ...MANUAL_PROOF_REGISTRY.filter(
      (p) => !p.blocks_public_launch && !verifiedIds.includes(p.id)
    ).map((p) => p.label),
  ];

  const b48_flags_all_blocking_done = flagEval.all_blocking_done;

  // is_go only true when BOTH B48 flags AND P-FINAL 01 proofs are all verified
  const is_go =
    b48_flags_all_blocking_done &&
    pfinal01_blocking_proofs_verified &&
    blockers.length === 0;

  return {
    is_go,
    b48_flags_all_blocking_done,
    pfinal01_blocking_proofs_verified,
    blockers,
    warnings,
    verified_proof_count: verifiedIds.filter((id) =>
      MANUAL_PROOF_REGISTRY.some((p) => p.id === id)
    ).length,
    total_blocking_proof_count: blockingProofs.length,
    evaluated_at: new Date().toISOString(),
  };
}

export function isPublicLaunchGo(input: LaunchGateInput): boolean {
  return buildPublicLaunchGate(input).is_go;
}

export function getLaunchGateBlockers(input: LaunchGateInput): string[] {
  return buildPublicLaunchGate(input).blockers;
}
