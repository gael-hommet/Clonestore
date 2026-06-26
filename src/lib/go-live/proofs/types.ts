// P-FINAL 02 — Go-Live Manual Proofs — Types
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: A proof can NEVER be "verified" without real human evidence.

export type ProofCategory =
  | "legal"
  | "supabase"
  | "stripe"
  | "email"
  | "demo"
  | "paid_customer"
  | "copy"
  | "build";

export type ProofOwner = "gael" | "lawyer" | "developer" | "ops";

export type ProofMode = "manual" | "automated" | "hybrid";

export type ProofStatus =
  | "verified"   // real human evidence provided
  | "pending"    // not yet verified
  | "failed"     // verified and found to fail
  | "skipped"    // explicitly skipped (rare — must be justified)
  | "not_applicable"; // does not apply to this deployment

export type EvidenceType =
  | "document"
  | "screenshot"
  | "dashboard"
  | "test_log"
  | "manual_attestation"
  | "email"
  | "sql_output"
  | "script_output";

// A proof entry in the registry — defines what must be verified
export interface GoLiveProof {
  id: string;
  label: string;
  category: ProofCategory;
  required_for_public_launch: boolean;
  required_for_private_pilot: boolean;
  manual_or_automated: ProofMode;
  expected_evidence: string;
  verification_steps: string[];
  blocking_if_missing: boolean;
  owner: ProofOwner;
  description: string;
}

// A verified proof instance — real evidence attached by a human
export interface VerifiedProof {
  proof_id: string;
  status: ProofStatus;
  verified_at: string;        // ISO date
  verified_by: string;        // human name
  evidence_type: EvidenceType;
  evidence_ref: string;       // path, URL, or reference — never a real secret
  notes: string;
}

// A parsed go-live proof file
export interface GoLiveProofFile {
  generated_at: string;
  environment: "staging" | "production" | "unknown";
  verified_by: string;
  proofs: VerifiedProof[];
}

// Result of validating a set of proofs against the registry
export interface ProofValidationResult {
  verified_count: number;
  pending_count: number;
  failed_count: number;
  missing_public_launch: string[];  // proof IDs missing for public launch
  missing_private_pilot: string[];  // proof IDs missing for private pilot
  has_fake_proofs: boolean;
  fake_proof_ids: string[];
  is_public_launch_ready: boolean;
  is_private_pilot_ready: boolean;
  errors: string[];
}

// Summary of a proof file
export interface ProofFileSummary {
  total: number;
  verified: number;
  pending: number;
  failed: number;
  skipped: number;
  not_applicable: number;
  public_launch_ready: boolean;
  private_pilot_ready: boolean;
  missing_critical: string[];
}
