// src/lib/pierre/v1/hr-operations/case-service.ts
// PHASE 8.11 — the pure case orchestrator. Opens a case from a mission pack, advances it through the
// governed state machine, computes the next mandatory step, and decides whether it may close (via
// completion criteria). It NEVER touches the DB/runtime — it returns the governed decision the
// verified runtime then enacts (createMission/transitionTask/approval/etc.).

import type { HrCase, CaseState } from "./case-types";
import { isTerminal } from "./case-types";
import { transition, type CaseEvent } from "./case-state-machine";
import { remainingItems, type ChecklistItem } from "./checklist";
import { evaluateCompletion, type CaseEvidence } from "../hr-mission-packs/completion-evidence";
import type { HrMissionPackDefinition } from "../hr-mission-packs/types";

export function openCase(pack: HrMissionPackDefinition, opts: { caseId: string; companyId: string; correlationId: string; subjectRef?: string | null }): HrCase {
  return { caseId: opts.caseId, packId: pack.id, companyId: opts.companyId, subjectRef: opts.subjectRef ?? null, state: "intake", completedStepKeys: [], blockedReason: null, correlationId: opts.correlationId };
}

export type AdvanceResult = { ok: boolean; case: HrCase; error?: string };

/** Apply an event to a case (governed transition). completedStepKey optionally marks a step done. */
export function advanceCase(c: HrCase, event: CaseEvent, completedStepKey?: string): AdvanceResult {
  const t = transition(c.state, event);
  if (!t.ok) return { ok: false, case: c, error: t.error };
  const next: HrCase = {
    ...c, state: t.next,
    completedStepKeys: completedStepKey && !c.completedStepKeys.includes(completedStepKey) ? [...c.completedStepKeys, completedStepKey] : c.completedStepKeys,
    blockedReason: t.next === "blocked" ? (c.blockedReason ?? "blocked by governance") : c.blockedReason,
  };
  return { ok: true, case: next };
}

/** The next mandatory step to execute (dependencies satisfied), or null if none remain. */
export function nextStep(c: HrCase, pack: HrMissionPackDefinition): ChecklistItem | null {
  const done = new Set(c.completedStepKeys);
  const remaining = remainingItems(pack, c.completedStepKeys);
  return remaining.find((i) => (i.dependsOn ?? []).every((d) => done.has(d))) ?? null;
}

/** May the case close? Only when the state machine allows completion AND completion criteria are met. */
export function canComplete(c: HrCase, pack: HrMissionPackDefinition, evidence: CaseEvidence): { ok: boolean; unmet: string[]; reason: string } {
  if (isTerminal(c.state)) return { ok: false, unmet: [], reason: `already ${c.state}` };
  const completion = evaluateCompletion(pack, evidence);
  if (!completion.ok) return { ok: false, unmet: completion.unmet, reason: "completion criteria unmet" };
  return { ok: true, unmet: [], reason: "criteria met" };
}

export function summarizeCase(c: HrCase, pack: HrMissionPackDefinition): { state: CaseState; done: number; total: number; blocked: boolean } {
  return { state: c.state, done: c.completedStepKeys.length, total: pack.steps.length, blocked: c.state === "blocked" };
}
