// src/lib/pierre/v1/hr-canon/implementation-map.ts
// PHASE 8.10 — the traceability layer: for each capability, where it is (or must be) implemented,
// and the honest status. Derived from the registry so it can never drift from it.

import type { HrCapabilityDefinition, HrImplementationStatus, HrImplementationReference } from "./types";
import { HR_CAPABILITIES } from "./capability-registry";

export type ImplementationEntry = {
  id: string;
  domain: string;
  label: string;
  status: HrImplementationStatus;
  references: HrImplementationReference[];
  hasReferences: boolean;
  targetPhase: string;
};

export const IMPLEMENTATION_MAP: readonly ImplementationEntry[] = HR_CAPABILITIES.map((c: HrCapabilityDefinition) => ({
  id: c.id, domain: c.domain, label: c.label, status: c.implementation,
  references: c.implementationReferences, hasReferences: c.implementationReferences.length > 0, targetPhase: c.targetPhase,
}));

export function implementedElsewhere(status: HrImplementationStatus): ImplementationEntry[] {
  return IMPLEMENTATION_MAP.filter((e) => e.status === status);
}

// Integrity: a capability claiming code (VERIFIED_EXISTING / IMPLEMENTED_UNVERIFIED / PARTIAL)
// should point at least one implementation reference. Returns offenders (should be empty for
// VERIFIED_EXISTING; PARTIAL/IMPLEMENTED_UNVERIFIED referenceless are flagged as warnings).
export function referencelessImplemented(): ImplementationEntry[] {
  return IMPLEMENTATION_MAP.filter((e) => ["VERIFIED_EXISTING", "IMPLEMENTED_UNVERIFIED", "PARTIAL"].includes(e.status) && !e.hasReferences);
}
