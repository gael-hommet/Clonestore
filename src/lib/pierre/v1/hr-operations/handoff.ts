// src/lib/pierre/v1/hr-operations/handoff.ts
// PHASE 8.11 — external/human handoff descriptors. When a pack step cannot be executed by Pierre
// (a legally-reserved human decision, or a not-yet-integrated provider), it becomes a governed
// handoff: a durable record of what is expected back, so the case can wait + reconcile. NO provider
// is ever contacted here; this only describes the handoff.
import type { HrMissionPackDefinition, HrMissionPackStep } from "../hr-mission-packs/types";

export type Handoff = {
  stepKey: string;
  type: "human" | "external";
  target: string;            // role, or provider system
  expectedReturn: string;    // what must come back to resume the case
  blocked: boolean;          // external provider not integrated / signature blocked
};

export function handoffsFor(pack: HrMissionPackDefinition): Handoff[] {
  const out: Handoff[] = [];
  for (const s of pack.steps) {
    if (s.binding.type === "human_decision") out.push({ stepKey: s.key, type: "human", target: s.binding.role, expectedReturn: "recorded human decision", blocked: false });
    if (s.binding.type === "external_handoff") {
      const req = pack.integrationRequirements.find((r) => r.system === (s.binding as { system: string }).system);
      out.push({ stepKey: s.key, type: "external", target: String((s.binding as { system: string }).system), expectedReturn: "provider result to reconcile", blocked: req?.status === "blocked" || req?.status === "not_integrated" });
    }
  }
  return out;
}

export function isExternallyBlocked(pack: HrMissionPackDefinition): boolean {
  return handoffsFor(pack).some((h) => h.type === "external" && h.blocked);
}
