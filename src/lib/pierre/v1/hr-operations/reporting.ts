// src/lib/pierre/v1/hr-operations/reporting.ts
// PHASE 8.11 — operational reporting over mission packs: governance + runtime-status rollups used by
// the coverage matrix and cockpit. Pure aggregation.
import type { HrMissionPackDefinition } from "../hr-mission-packs/types";
import { approversInvolved } from "./approvals";
import { handoffsFor } from "./handoff";

export type GovernanceSummary = {
  packs: number;
  packsWithApprovals: number;
  packsWithHumanDecision: number;
  packsWithExternalHandoff: number;
  distinctApprovers: string[];
  byRuntimeStatus: Record<string, number>;
  externalSystems: string[];
};

export function governanceSummary(packs: readonly HrMissionPackDefinition[]): GovernanceSummary {
  const approvers = new Set<string>(); const systems = new Set<string>();
  const byRuntimeStatus: Record<string, number> = {};
  let withApprovals = 0, withHuman = 0, withExternal = 0;
  for (const p of packs) {
    byRuntimeStatus[p.runtimeStatus] = (byRuntimeStatus[p.runtimeStatus] ?? 0) + 1;
    if (p.approvals.length > 0) withApprovals++;
    const hs = handoffsFor(p);
    if (hs.some((h) => h.type === "human")) withHuman++;
    if (hs.some((h) => h.type === "external")) withExternal++;
    for (const a of approversInvolved(p)) approvers.add(a);
    for (const r of p.integrationRequirements) if (r.system !== "none") systems.add(r.system);
  }
  return {
    packs: packs.length, packsWithApprovals: withApprovals, packsWithHumanDecision: withHuman,
    packsWithExternalHandoff: withExternal, distinctApprovers: [...approvers], byRuntimeStatus, externalSystems: [...systems],
  };
}
