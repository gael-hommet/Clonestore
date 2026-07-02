// src/lib/pierre/v1/hr-mission-packs/index.ts
// PHASE 8.11 — public API for the Total HR Mission Packs.
export * from "./types";
export * from "./schema";
export * from "./runtime-map";
export * from "./validator";
export * from "./compiler";
export * from "./completion-evidence";
export * from "./registry";
export { ALL_DOMAIN_PACKS } from "./domains";

import { HR_MISSION_PACKS, computePackCoverage, danglingPackCapabilities } from "./registry";
import { validatePackRegistry } from "./validator";
import { compileAll } from "./compiler";

export function buildMissionPackSummary() {
  const validation = validatePackRegistry([...HR_MISSION_PACKS]);
  const coverage = computePackCoverage();
  const compiled = compileAll([...HR_MISSION_PACKS]);
  const byStatus: Record<string, number> = {};
  for (const p of HR_MISSION_PACKS) byStatus[p.runtimeStatus] = (byStatus[p.runtimeStatus] ?? 0) + 1;
  return {
    packs: HR_MISSION_PACKS.length,
    valid: validation.ok,
    validationErrors: validation.errors.length,
    duplicateIds: validation.duplicateIds,
    dangling: danglingPackCapabilities(),
    coverage,
    compileOk: compiled.ok,
    compileFailed: compiled.failed,
    byRuntimeStatus: byStatus,
  };
}
