// src/lib/pierre/v1/final-certification/evidence-validator.ts
// PHASE 8.13 — validate that a certification entry carries real evidence. A CERTIFIED_* state must
// point at a proof (a prior-P8 test/proof, a pack that compiles, or the country/provider governed
// mechanism). No evidence ⇒ the certification is not trustworthy.
import type { CapabilityCertification } from "./types";
import { isCertified } from "./types";

export function validateEvidence(entry: CapabilityCertification): string[] {
  const e: string[] = [];
  if (isCertified(entry.state) && entry.evidenceRefs.length === 0) e.push(`${entry.capabilityId}: ${entry.state} without evidence`);
  if (entry.state === "NOT_CERTIFIED" && entry.evidenceRefs.length > 0) e.push(`${entry.capabilityId}: NOT_CERTIFIED should carry no evidence`);
  return e;
}

export function validateAllEvidence(entries: CapabilityCertification[]): { ok: boolean; errors: string[] } {
  const errors = entries.flatMap(validateEvidence);
  return { ok: errors.length === 0, errors };
}
