// P-FINAL 02 — Proof Validator
// Validates a set of VerifiedProof instances against the registry.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: Must reject any proof missing evidence_ref, verified_by, or verified_at.

import type {
  VerifiedProof,
  ProofValidationResult,
} from "./types";
import {
  getRequiredPublicLaunchProofs,
  getRequiredPrivatePilotProofs,
  getProofById,
} from "./proof-registry";

// Fields required in any verified proof — cannot be missing or empty
const REQUIRED_VERIFIED_FIELDS: (keyof VerifiedProof)[] = [
  "proof_id",
  "verified_at",
  "verified_by",
  "evidence_type",
  "evidence_ref",
  "notes",
];

// Checks that look obviously fake
const FAKE_INDICATORS = [
  "todo",
  "placeholder",
  "dummy",
  "test123",
  "fake",
  "example.com/fake",
  "tbd",
  "fixme",
  "[à remplir]",
  "à compléter",
];

export function validateSingleProof(proof: VerifiedProof): string[] {
  const errors: string[] = [];

  for (const field of REQUIRED_VERIFIED_FIELDS) {
    const val = proof[field];
    if (!val || (typeof val === "string" && val.trim().length === 0)) {
      errors.push(`Missing or empty field: ${field} on proof ${proof.proof_id}`);
    }
  }

  // Reject fake evidence references
  if (proof.evidence_ref) {
    const lower = proof.evidence_ref.toLowerCase();
    for (const indicator of FAKE_INDICATORS) {
      if (lower.includes(indicator)) {
        errors.push(`Suspicious evidence_ref on proof ${proof.proof_id}: "${proof.evidence_ref}"`);
      }
    }
  }

  // Reject unknown proof IDs
  if (proof.proof_id && !getProofById(proof.proof_id)) {
    errors.push(`Unknown proof ID: ${proof.proof_id}`);
  }

  // verified_at must be parseable as a date
  if (proof.verified_at) {
    const d = new Date(proof.verified_at);
    if (isNaN(d.getTime())) {
      errors.push(`Invalid verified_at date on proof ${proof.proof_id}: "${proof.verified_at}"`);
    }
  }

  return errors;
}

export function assertNoFakeProofs(proofs: VerifiedProof[]): { has_fake: boolean; fake_ids: string[] } {
  const fake_ids: string[] = [];

  for (const proof of proofs) {
    if (proof.status !== "verified") continue;
    const errors = validateSingleProof(proof);
    if (errors.length > 0) {
      fake_ids.push(proof.proof_id);
    }
  }

  return { has_fake: fake_ids.length > 0, fake_ids };
}

export function validateProofSet(proofs: VerifiedProof[]): ProofValidationResult {
  const errors: string[] = [];
  const fake_proof_ids: string[] = [];

  // Check for duplicates
  const seenIds = new Set<string>();
  for (const proof of proofs) {
    if (seenIds.has(proof.proof_id)) {
      errors.push(`Duplicate proof ID: ${proof.proof_id}`);
    }
    seenIds.add(proof.proof_id);
  }

  // Validate each proof
  for (const proof of proofs) {
    if (proof.status === "verified") {
      const proofErrors = validateSingleProof(proof);
      if (proofErrors.length > 0) {
        errors.push(...proofErrors);
        fake_proof_ids.push(proof.proof_id);
      }
    }
  }

  const verifiedSet = new Set(
    proofs.filter((p) => p.status === "verified" && !fake_proof_ids.includes(p.proof_id)).map((p) => p.proof_id)
  );

  const publicLaunchProofs = getRequiredPublicLaunchProofs();
  const privatePilotProofs = getRequiredPrivatePilotProofs();

  const missing_public_launch = publicLaunchProofs
    .filter((p) => !verifiedSet.has(p.id))
    .map((p) => p.id);

  const missing_private_pilot = privatePilotProofs
    .filter((p) => !verifiedSet.has(p.id))
    .map((p) => p.id);

  const verified_count = proofs.filter((p) => p.status === "verified").length;
  const pending_count = proofs.filter((p) => p.status === "pending").length;
  const failed_count = proofs.filter((p) => p.status === "failed").length;

  return {
    verified_count,
    pending_count,
    failed_count,
    missing_public_launch,
    missing_private_pilot,
    has_fake_proofs: fake_proof_ids.length > 0,
    fake_proof_ids,
    is_public_launch_ready: missing_public_launch.length === 0 && fake_proof_ids.length === 0,
    is_private_pilot_ready: missing_private_pilot.length === 0 && fake_proof_ids.length === 0,
    errors,
  };
}

export function buildMissingProofsReport(proofs: VerifiedProof[]): {
  public_launch_missing: Array<{ id: string; label: string; category: string; owner: string }>;
  private_pilot_missing: Array<{ id: string; label: string; category: string; owner: string }>;
  total_missing_public: number;
  total_missing_private: number;
} {
  const verifiedSet = new Set(proofs.filter((p) => p.status === "verified").map((p) => p.proof_id));

  const publicLaunchProofs = getRequiredPublicLaunchProofs();
  const privatePilotProofs = getRequiredPrivatePilotProofs();

  const public_launch_missing = publicLaunchProofs
    .filter((p) => !verifiedSet.has(p.id))
    .map((p) => ({ id: p.id, label: p.label, category: p.category, owner: p.owner }));

  const private_pilot_missing = privatePilotProofs
    .filter((p) => !verifiedSet.has(p.id))
    .map((p) => ({ id: p.id, label: p.label, category: p.category, owner: p.owner }));

  return {
    public_launch_missing,
    private_pilot_missing,
    total_missing_public: public_launch_missing.length,
    total_missing_private: private_pilot_missing.length,
  };
}
