// src/lib/pierre/v1/hr-mission-packs/registry.ts
// PHASE 8.11 — the mission-pack registry + coverage engine. Loads the P8.10 canon DYNAMICALLY
// (P811_GAPS) and computes whether every P8.11-targeted capability is realized by a pack. The
// number 102 is never hardcoded — it comes from the canon; if the canon changes, coverage follows.

import type { HrMissionPackDefinition } from "./types";
import { ALL_DOMAIN_PACKS } from "./domains";
import { P811_GAPS, HUMAN_ONLY_GAPS } from "../hr-canon/gap-registry";
import { getCapability } from "../hr-canon/capability-registry";

export const HR_MISSION_PACKS: readonly HrMissionPackDefinition[] = ALL_DOMAIN_PACKS;
export const MISSION_PACK_IDS: readonly string[] = HR_MISSION_PACKS.map((p) => p.id);
export function getMissionPack(id: string): HrMissionPackDefinition | undefined { return HR_MISSION_PACKS.find((p) => p.id === id); }
export function packsForCapability(capId: string): HrMissionPackDefinition[] { return HR_MISSION_PACKS.filter((p) => p.capabilityIds.includes(capId)); }

// The set of capabilities realized by ANY pack.
export function realizedCapabilityIds(): Set<string> {
  const s = new Set<string>();
  for (const p of HR_MISSION_PACKS) for (const c of p.capabilityIds) s.add(c);
  return s;
}

export type CoverageReport = {
  targetedGapCount: number;           // P8.11 gaps from the canon (dynamic)
  coveredGapCount: number;
  uncoveredGapIds: string[];          // MUST be empty for a green verdict
  extraCapabilityIds: string[];       // pack-realized caps that are not P8.11 gaps (verified/other — allowed)
  humanOnlyNotAutomated: string[];    // HUMAN_ONLY caps that must NOT have an executing pack (info)
  byDomain: Record<string, { targeted: number; covered: number }>;
};

/** Compute coverage of the DYNAMIC P8.11 gap set by the mission packs. */
export function computePackCoverage(): CoverageReport {
  const targeted = P811_GAPS.map((g) => g.id);
  const realized = realizedCapabilityIds();
  const covered = targeted.filter((id) => realized.has(id));
  const uncovered = targeted.filter((id) => !realized.has(id));
  const targetedSet = new Set(targeted);
  const extra = [...realized].filter((id) => !targetedSet.has(id));
  const byDomain: Record<string, { targeted: number; covered: number }> = {};
  for (const g of P811_GAPS) {
    const d = g.domain; byDomain[d] ??= { targeted: 0, covered: 0 };
    byDomain[d].targeted++; if (realized.has(g.id)) byDomain[d].covered++;
  }
  // HUMAN_ONLY caps must not be realized by an EXECUTING pack (they may only be referenced by a
  // human_decision step inside a governance pack — but never as the pack's sole automated realization).
  const humanOnlyNotAutomated = HUMAN_ONLY_GAPS.map((g) => g.id).filter((id) => {
    const packs = packsForCapability(id);
    return packs.length > 0; // report any HUMAN_ONLY cap directly listed as a pack capability (should be none)
  });
  return { targetedGapCount: targeted.length, coveredGapCount: covered.length, uncoveredGapIds: uncovered, extraCapabilityIds: extra, humanOnlyNotAutomated, byDomain };
}

/** Sanity: every pack capability id must exist in the canon. */
export function danglingPackCapabilities(): { packId: string; capabilityId: string }[] {
  const out: { packId: string; capabilityId: string }[] = [];
  for (const p of HR_MISSION_PACKS) for (const c of p.capabilityIds) if (!getCapability(c)) out.push({ packId: p.id, capabilityId: c });
  return out;
}
