// P-FINAL 02 — Proof File Format
// Defines parsing, validation, and redaction of go-live-proofs.local.json.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: Never commit go-live-proofs.local.json. Never expose evidence_ref in client responses.

import type { GoLiveProofFile, VerifiedProof, ProofFileSummary } from "./types";
import { summarizeProofFile } from "./proof-status";

// Sensitive fields that must be redacted when exposing proof data client-side
const SENSITIVE_FIELDS_TO_REDACT: (keyof VerifiedProof)[] = ["evidence_ref", "notes"];

export function parseGoLiveProofFile(raw: unknown): { file: GoLiveProofFile | null; errors: string[] } {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("Proof file must be a JSON object");
    return { file: null, errors };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.generated_at || typeof obj.generated_at !== "string") {
    errors.push("Missing or invalid 'generated_at' field");
  }

  if (!obj.verified_by || typeof obj.verified_by !== "string" || (obj.verified_by as string).trim().length === 0) {
    errors.push("Missing or empty 'verified_by' field");
  }

  const env = obj.environment;
  if (!env || (env !== "staging" && env !== "production" && env !== "unknown")) {
    errors.push("Invalid 'environment' field — must be staging | production | unknown");
  }

  if (!Array.isArray(obj.proofs)) {
    errors.push("Missing or invalid 'proofs' array");
    return { file: null, errors };
  }

  const proofs: VerifiedProof[] = [];
  for (let i = 0; i < obj.proofs.length; i++) {
    const p = obj.proofs[i] as Record<string, unknown>;
    if (!p || typeof p !== "object") {
      errors.push(`Proof at index ${i} is not an object`);
      continue;
    }

    if (!p.proof_id || typeof p.proof_id !== "string") {
      errors.push(`Proof at index ${i} missing 'proof_id'`);
      continue;
    }

    const proof: VerifiedProof = {
      proof_id: String(p.proof_id),
      status: (p.status as VerifiedProof["status"]) ?? "pending",
      verified_at: typeof p.verified_at === "string" ? p.verified_at : "",
      verified_by: typeof p.verified_by === "string" ? p.verified_by : "",
      evidence_type: (p.evidence_type as VerifiedProof["evidence_type"]) ?? "manual_attestation",
      evidence_ref: typeof p.evidence_ref === "string" ? p.evidence_ref : "",
      notes: typeof p.notes === "string" ? p.notes : "",
    };

    proofs.push(proof);
  }

  if (errors.length > 0) {
    return { file: null, errors };
  }

  return {
    file: {
      generated_at: String(obj.generated_at),
      environment: (env as GoLiveProofFile["environment"]),
      verified_by: String(obj.verified_by),
      proofs,
    },
    errors: [],
  };
}

export function validateGoLiveProofFile(file: GoLiveProofFile): string[] {
  const errors: string[] = [];

  if (!file.generated_at) errors.push("Missing generated_at");
  if (!file.verified_by || file.verified_by.trim().length === 0) {
    errors.push("Missing or empty verified_by");
  }

  for (const proof of file.proofs) {
    if (proof.status === "verified") {
      if (!proof.evidence_ref || proof.evidence_ref.trim().length === 0) {
        errors.push(`Proof ${proof.proof_id}: evidence_ref required for verified status`);
      }
      if (!proof.verified_by || proof.verified_by.trim().length === 0) {
        errors.push(`Proof ${proof.proof_id}: verified_by required for verified status`);
      }
      if (!proof.verified_at || proof.verified_at.trim().length === 0) {
        errors.push(`Proof ${proof.proof_id}: verified_at required for verified status`);
      }
    }
  }

  return errors;
}

// Remove sensitive fields before exposing to client (API routes, pages)
export function redactProofFileForClient(file: GoLiveProofFile): GoLiveProofFile {
  return {
    ...file,
    proofs: file.proofs.map((proof) => {
      const redacted = { ...proof };
      for (const field of SENSITIVE_FIELDS_TO_REDACT) {
        if (field in redacted) {
          (redacted as Record<string, unknown>)[field] = "[redacted]";
        }
      }
      return redacted;
    }),
  };
}

export function summarizeGoLiveProofFile(file: GoLiveProofFile): ProofFileSummary & {
  environment: string;
  verified_by: string;
  generated_at: string;
} {
  const summary = summarizeProofFile(file.proofs);
  return {
    ...summary,
    environment: file.environment,
    verified_by: file.verified_by,
    generated_at: file.generated_at,
  };
}

// Template for go-live-proofs.local.json — ready to fill in
export function buildProofFileTemplate(): GoLiveProofFile {
  return {
    generated_at: new Date().toISOString(),
    environment: "production",
    verified_by: "Gael Hommet",
    proofs: [],
  };
}
