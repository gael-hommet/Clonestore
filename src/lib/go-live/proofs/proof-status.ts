// P-FINAL 02 — Proof Status Helpers
// Pure: no Supabase, no Next, no async, no throw.

import type { VerifiedProof, ProofStatus, ProofFileSummary } from "./types";
import { getRequiredPublicLaunchProofs, getRequiredPrivatePilotProofs } from "./proof-registry";

export function isProofVerified(proof: VerifiedProof): boolean {
  return proof.status === "verified";
}

export function getVerifiedProofIds(proofs: VerifiedProof[]): string[] {
  return proofs.filter((p) => p.status === "verified").map((p) => p.proof_id);
}

export function getPendingProofIds(proofs: VerifiedProof[]): string[] {
  return proofs.filter((p) => p.status === "pending").map((p) => p.proof_id);
}

export function getFailedProofIds(proofs: VerifiedProof[]): string[] {
  return proofs.filter((p) => p.status === "failed").map((p) => p.proof_id);
}

export function countByStatus(proofs: VerifiedProof[], status: ProofStatus): number {
  return proofs.filter((p) => p.status === status).length;
}

export function summarizeProofFile(proofs: VerifiedProof[]): ProofFileSummary {
  const verifiedIds = new Set(getVerifiedProofIds(proofs));

  const publicLaunchProofs = getRequiredPublicLaunchProofs();
  const privatePilotProofs = getRequiredPrivatePilotProofs();

  const missingPublic = publicLaunchProofs.filter((p) => !verifiedIds.has(p.id)).map((p) => p.id);
  const missingPrivate = privatePilotProofs.filter((p) => !verifiedIds.has(p.id)).map((p) => p.id);

  return {
    total: proofs.length,
    verified: countByStatus(proofs, "verified"),
    pending: countByStatus(proofs, "pending"),
    failed: countByStatus(proofs, "failed"),
    skipped: countByStatus(proofs, "skipped"),
    not_applicable: countByStatus(proofs, "not_applicable"),
    public_launch_ready: missingPublic.length === 0,
    private_pilot_ready: missingPrivate.length === 0,
    missing_critical: missingPublic,
  };
}

export function getProofCoveragePercent(proofs: VerifiedProof[]): number {
  const total = getRequiredPublicLaunchProofs().length;
  if (total === 0) return 100;
  const verified = getVerifiedProofIds(proofs);
  const requiredIds = getRequiredPublicLaunchProofs().map((p) => p.id);
  const covered = requiredIds.filter((id) => verified.includes(id)).length;
  return Math.round((covered / total) * 100);
}
