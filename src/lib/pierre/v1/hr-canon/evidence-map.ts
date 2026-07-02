// src/lib/pierre/v1/hr-canon/evidence-map.ts
// PHASE 8.10 — the evidence layer: what proves each capability + what is still needed to certify
// it. Derived from the registry. The core honesty invariant lives here: a VERIFIED_EXISTING
// capability MUST carry ≥1 evidence reference; anything else lists its certification criteria as
// the outstanding proof P8.11/P8.12 must produce.

import type { HrCapabilityDefinition, HrEvidenceReference, HrCertificationCriterion } from "./types";
import { HR_CAPABILITIES } from "./capability-registry";

export type EvidenceEntry = {
  id: string;
  domain: string;
  status: string;
  evidence: HrEvidenceReference[];
  hasEvidence: boolean;
  certification: HrCertificationCriterion[];
  certified: boolean; // all criteria met
  outstandingCriteria: string[];
};

export const EVIDENCE_MAP: readonly EvidenceEntry[] = HR_CAPABILITIES.map((c: HrCapabilityDefinition) => ({
  id: c.id, domain: c.domain, status: c.implementation,
  evidence: c.evidence, hasEvidence: c.evidence.length > 0,
  certification: c.certificationCriteria,
  certified: c.certificationCriteria.every((k) => k.met) && c.certificationCriteria.length > 0,
  outstandingCriteria: c.certificationCriteria.filter((k) => !k.met).map((k) => k.id),
}));

/** VERIFIED_EXISTING capabilities missing evidence — MUST be empty (validator also enforces). */
export function verifiedWithoutEvidence(): EvidenceEntry[] {
  return EVIDENCE_MAP.filter((e) => e.status === "VERIFIED_EXISTING" && !e.hasEvidence);
}

export function certifiedCount(): number { return EVIDENCE_MAP.filter((e) => e.certified).length; }
