// src/lib/pierre/v1/hr-operations/checklist.ts
// PHASE 8.11 — derive a governed checklist from a mission pack. The checklist is what a case must
// complete, with each item's binding type + governance flags — a human-readable + machine-checkable
// projection of the pack's steps.
import type { HrMissionPackDefinition } from "../hr-mission-packs/types";

export type ChecklistItem = {
  key: string;
  label: string;
  kind: string;
  bindingType: string;
  target: string;
  requiresApproval: boolean;
  optional: boolean;
  dependsOn: string[];
};

export function buildChecklist(pack: HrMissionPackDefinition): ChecklistItem[] {
  return pack.steps.map((s) => ({
    key: s.key, label: s.label, kind: s.kind, bindingType: s.binding.type,
    target: s.binding.type === "runtime_action" ? s.binding.actionKey : s.binding.type === "governed_service" ? s.binding.capabilityId : s.binding.type === "human_decision" ? s.binding.role : String((s.binding as { system?: string }).system),
    requiresApproval: !!s.requiresApproval || s.kind === "request_approval" || s.binding.type === "human_decision",
    optional: !!s.optional, dependsOn: s.dependsOn ?? [],
  }));
}

/** Remaining (mandatory, not-yet-completed) checklist items given completed keys. */
export function remainingItems(pack: HrMissionPackDefinition, completed: string[]): ChecklistItem[] {
  const done = new Set(completed);
  return buildChecklist(pack).filter((i) => !i.optional && !done.has(i.key));
}
