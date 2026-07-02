// src/lib/pierre/v1/hr-canon/index.ts
// PHASE 8.10 — the single canonical API for the Complete HR Capability Canon. Everything that
// consumes the canon (verify script, coverage report, P8.11/P8.12, docs generators) imports from
// here. `buildCanonSummary()` produces the machine-readable summary written to .p810-proofs.

export * from "./types";
export * from "./domains";
export * from "./capability-schema";
export * from "./capability-validator";
export * from "./capability-registry";
export * from "./implementation-map";
export * from "./evidence-map";
export * from "./coverage";
export * from "./gap-registry";
export * from "./public-promise-map";
export * as CountryPacks from "./country-packs";

import { HR_CAPABILITIES } from "./capability-registry";
import { HR_DOMAINS } from "./domains";
import { validateRegistry } from "./capability-validator";
import { computeCoverage } from "./coverage";
import { gapSummary } from "./gap-registry";
import { PROMISE_TRACEABILITY, danglingPromises } from "./public-promise-map";
import { verifiedWithoutEvidence, certifiedCount } from "./evidence-map";
import { referencelessImplemented } from "./implementation-map";
import { validateAllPacks } from "./country-packs";

export type CanonSummary = ReturnType<typeof buildCanonSummary>;

export function buildCanonSummary() {
  const validation = validateRegistry([...HR_CAPABILITIES]);
  const coverage = computeCoverage(HR_CAPABILITIES);
  const packs = validateAllPacks();
  return {
    canonVersion: 1,
    generated: "P8.10",
    domains: HR_DOMAINS.length,
    capabilities: HR_CAPABILITIES.length,
    registryValid: validation.ok,
    registryErrors: validation.errors.length,
    registryWarnings: validation.warnings.length,
    duplicateIds: validation.duplicateIds,
    coverage,
    gaps: gapSummary(),
    promises: {
      total: PROMISE_TRACEABILITY.length,
      fullyBacked: PROMISE_TRACEABILITY.filter((p) => p.backing === "fully_backed").length,
      partiallyBacked: PROMISE_TRACEABILITY.filter((p) => p.backing === "partially_backed").length,
      aspirational: PROMISE_TRACEABILITY.filter((p) => p.backing === "aspirational").length,
      dangling: danglingPromises().length,
    },
    integrity: {
      verifiedWithoutEvidence: verifiedWithoutEvidence().length,
      referencelessImplemented: referencelessImplemented().length,
      certifiedCapabilities: certifiedCount(),
    },
    countryPacks: {
      ok: packs.ok,
      jurisdictions: packs.packs.map((p) => p.jurisdiction),
      packs: packs.packs,
    },
  };
}
