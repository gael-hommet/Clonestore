// P-FINAL 02 — Proof Fixtures
// Test-only fixtures. Never use as real proofs.
// Pure: no Supabase, no Next, no async, no throw.

import type { VerifiedProof, GoLiveProofFile } from "./types";
import { getRequiredPublicLaunchProofs, getRequiredPrivatePilotProofs } from "./proof-registry";

const FIXTURE_DATE = "2026-05-29T12:00:00.000Z";
const FIXTURE_VERIFIER = "Test Suite";

function makeVerifiedProof(id: string): VerifiedProof {
  return {
    proof_id: id,
    status: "verified",
    verified_at: FIXTURE_DATE,
    verified_by: FIXTURE_VERIFIER,
    evidence_type: "test_log",
    evidence_ref: `go-live-evidence/test/${id.toLowerCase()}.json`,
    notes: "Fixture proof for testing purposes only",
  };
}

function makePendingProof(id: string): VerifiedProof {
  return {
    proof_id: id,
    status: "pending",
    verified_at: "",
    verified_by: "",
    evidence_type: "manual_attestation",
    evidence_ref: "",
    notes: "",
  };
}

// All public launch proofs verified — ideal state
export const FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED: VerifiedProof[] = getRequiredPublicLaunchProofs().map(
  (p) => makeVerifiedProof(p.id)
);

// All private pilot proofs verified
export const FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED: VerifiedProof[] = getRequiredPrivatePilotProofs().map(
  (p) => makeVerifiedProof(p.id)
);

// Empty proofs — no-go state
export const FIXTURE_NO_PROOFS: VerifiedProof[] = [];

// Only legal proofs missing
export const FIXTURE_LEGAL_MISSING: VerifiedProof[] = getRequiredPublicLaunchProofs()
  .filter((p) => p.category !== "legal")
  .map((p) => makeVerifiedProof(p.id));

// Only Stripe proofs missing
export const FIXTURE_STRIPE_MISSING: VerifiedProof[] = getRequiredPublicLaunchProofs()
  .filter((p) => p.category !== "stripe")
  .map((p) => makeVerifiedProof(p.id));

// Only Supabase proofs missing
export const FIXTURE_SUPABASE_MISSING: VerifiedProof[] = getRequiredPublicLaunchProofs()
  .filter((p) => p.category !== "supabase")
  .map((p) => makeVerifiedProof(p.id));

// Only paid customer proofs missing
export const FIXTURE_PAID_CUSTOMER_MISSING: VerifiedProof[] = getRequiredPublicLaunchProofs()
  .filter((p) => p.category !== "paid_customer")
  .map((p) => makeVerifiedProof(p.id));

// Only demo proofs missing
export const FIXTURE_DEMO_MISSING: VerifiedProof[] = getRequiredPublicLaunchProofs()
  .filter((p) => p.category !== "demo")
  .map((p) => makeVerifiedProof(p.id));

// Only copy proofs missing
export const FIXTURE_COPY_MISSING: VerifiedProof[] = getRequiredPublicLaunchProofs()
  .filter((p) => p.category !== "copy")
  .map((p) => makeVerifiedProof(p.id));

// Private pilot ready (subset)
export const FIXTURE_PRIVATE_PILOT_READY: VerifiedProof[] = getRequiredPrivatePilotProofs().map(
  (p) => makeVerifiedProof(p.id)
);

// Proof missing required evidence_ref (fake proof)
export const FIXTURE_FAKE_PROOF: VerifiedProof = {
  proof_id: "LEGAL_CGU_VALIDATED",
  status: "verified",
  verified_at: FIXTURE_DATE,
  verified_by: FIXTURE_VERIFIER,
  evidence_type: "document",
  evidence_ref: "", // empty — should be rejected
  notes: "fake",
};

// Proof with suspicious evidence_ref
export const FIXTURE_SUSPICIOUS_PROOF: VerifiedProof = {
  proof_id: "LEGAL_CGU_VALIDATED",
  status: "verified",
  verified_at: FIXTURE_DATE,
  verified_by: FIXTURE_VERIFIER,
  evidence_type: "document",
  evidence_ref: "todo-fill-this-later",
  notes: "placeholder",
};

// All public launch proofs pending
export const FIXTURE_ALL_PENDING: VerifiedProof[] = getRequiredPublicLaunchProofs().map(
  (p) => makePendingProof(p.id)
);

// Valid proof file with all public launch proofs
export const FIXTURE_PROOF_FILE_ALL_VERIFIED: GoLiveProofFile = {
  generated_at: FIXTURE_DATE,
  environment: "production",
  verified_by: FIXTURE_VERIFIER,
  proofs: FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED,
};

// Empty proof file
export const FIXTURE_PROOF_FILE_EMPTY: GoLiveProofFile = {
  generated_at: FIXTURE_DATE,
  environment: "staging",
  verified_by: "Gael Hommet",
  proofs: [],
};

// Proof file missing generated_at (invalid)
export const FIXTURE_PROOF_FILE_MISSING_DATE: Record<string, unknown> = {
  environment: "production",
  verified_by: "Gael Hommet",
  proofs: [],
};

// Proof file missing verified_by (invalid)
export const FIXTURE_PROOF_FILE_MISSING_VERIFIER: Record<string, unknown> = {
  generated_at: FIXTURE_DATE,
  environment: "production",
  verified_by: "",
  proofs: [],
};
