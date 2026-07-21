// src/lib/clonestore/cloneos/canonical/cloneos-orchestrator.ts
// P19 — CLONEOS CANONICAL ORCHESTRATOR. CloneOS answers "how do we turn a request into organised, governed
// work?". Before P19 the T2 CloneOS contract was advisory metadata bolted onto a chat reply. This module is
// the real orchestration: it segments intent, applies the CANONICAL governance (Guard+Policy+Trust,
// strictest-wins), builds a mission/task plan with dependencies + multi-employee routing, and emits canonical
// trace events. It is UNIVERSAL (not a second HR brain) — it produces the SAME mission input the V1
// mission-service already consumes and DELEGATES execution to it; it never executes and never re-implements
// the runtime. Pierre stays the HR specialist that executes HR tasks. Pure, deterministic.

import { decideCanonicalGovernance, type CanonicalGovernanceDecision } from "../../../pierre/v1/governance/canonical-decision";
import type { ActionKind, AutonomyMode, RiskLevel, Sensitivity } from "../../../pierre/v1/autonomy";
import { buildCanonicalTraceEvent, type CanonicalTraceEvent } from "../../../pierre/v1/trace/canonical-event";

/** A worker the orchestrator can route work to (multi-employee-ready — today: Pierre + a review controller). */
export type EmployeeDescriptor = {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly string[];          // domain tags, e.g. ["hr", "document", "review"]
  readonly countrySupport: readonly string[] | "all"; // ISO-2 list or "all"
};

export type CloneOsRequest = {
  readonly company_id: string;
  readonly entity_id?: string | null;
  readonly user_id: string;
  readonly legalCountry: string | null;              // from geo resolver (server)
  readonly adnVersion?: string | null;
  readonly policyVersion?: string | null;
  readonly mode: AutonomyMode;
  readonly instruction: string;
  readonly employees: readonly EmployeeDescriptor[];
  readonly nowIso: string;                            // passed in — pure
  readonly correlationId: string;
};

export type CloneOsTaskPlan = {
  readonly index: number;
  readonly phrase: string;
  readonly action: ActionKind;
  readonly domain: string;
  readonly jurisdictional: boolean;
  readonly dependsOn: readonly number[];
  readonly assignedEmployeeId: string | null;
  readonly governance: CanonicalGovernanceDecision;
};

export type CloneOsPlan = {
  readonly version: "cloneos-1";
  readonly company_id: string;
  readonly missionTitle: string;
  readonly actions: readonly string[];
  readonly tasks: readonly CloneOsTaskPlan[];
  readonly finalOwnerEmployeeId: string | null;
  readonly requiresValidation: boolean;
  readonly blocked: boolean;
  readonly traceEvents: readonly CanonicalTraceEvent[];
};

const SPLIT_RE = /\s*(?:;|\n|\bpuis\b|\bensuite\b|\bapr[eè]s quoi\b|\bet aussi\b|\bpuis ensuite\b)\s*/i;

/** Segment an instruction into ordered action phrases (multi-action detection). Pure. */
export function segmentIntent(instruction: string): string[] {
  return (instruction ?? "")
    .split(SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const CLASSIFY: Array<{ re: RegExp; action: ActionKind; domain: string; jurisdictional: boolean; risk: RiskLevel; sensitivity: Sensitivity; external: boolean }> = [
  { re: /licenci|renvoy|rupture/, action: "termination", domain: "hr", jurisdictional: true, risk: "high", sensitivity: "restricted", external: true },
  { re: /sanction|avertissement|mise à pied/, action: "sanction", domain: "hr", jurisdictional: true, risk: "high", sensitivity: "restricted", external: true },
  { re: /avenant/, action: "amendment", domain: "hr", jurisdictional: true, risk: "medium", sensitivity: "sensitive", external: true },
  { re: /contrat|embauch|cdi|cdd/, action: "contract", domain: "hr", jurisdictional: true, risk: "medium", sensitivity: "sensitive", external: true },
  { re: /salaire|rémunérat|augmentation|prime/, action: "compensation", domain: "hr", jurisdictional: true, risk: "high", sensitivity: "restricted", external: true },
  { re: /convocation|entretien/, action: "standard_report", domain: "hr", jurisdictional: false, risk: "low", sensitivity: "normal", external: true },
  { re: /relance|rappel|reminder/, action: "reminder", domain: "hr", jurisdictional: false, risk: "low", sensitivity: "normal", external: true },
  { re: /synth[èe]se|rapport|r[ée]sum[ée]|briefing/, action: "standard_report", domain: "hr", jurisdictional: false, risk: "low", sensitivity: "normal", external: false },
  { re: /classe|range|archive/, action: "classification", domain: "hr", jurisdictional: false, risk: "low", sensitivity: "normal", external: false },
  { re: /pr[ée]pare|r[ée]dige|cr[ée]e|note/, action: "operational_summary", domain: "hr", jurisdictional: false, risk: "low", sensitivity: "normal", external: false },
];

function classifyPhrase(phrase: string): { action: ActionKind; domain: string; jurisdictional: boolean; risk: RiskLevel; sensitivity: Sensitivity; external: boolean } {
  const p = phrase.toLowerCase();
  for (const c of CLASSIFY) if (c.re.test(p)) return { action: c.action, domain: c.domain, jurisdictional: c.jurisdictional, risk: c.risk, sensitivity: c.sensitivity, external: c.external };
  return { action: "operational_summary", domain: "hr", jurisdictional: false, risk: "low", sensitivity: "normal", external: false };
}

function selectEmployee(employees: readonly EmployeeDescriptor[], domain: string, country: string | null): string | null {
  const eligible = employees.filter((e) => (e.countrySupport === "all" || (country != null && e.countrySupport.includes(country))));
  const byDomain = eligible.find((e) => e.capabilities.includes(domain));
  return (byDomain ?? eligible[0] ?? employees[0])?.id ?? null;
}

/**
 * Build a governed CloneOS plan from a request. Composes canonical governance per action, routes to an
 * employee, wires sequential dependencies, and emits a canonical trace event per planned task. Delegates:
 * the plan converts to V1 mission-service input via `toMissionInstruction`. Pure.
 */
export function orchestrate(req: CloneOsRequest): CloneOsPlan {
  const phrases = segmentIntent(req.instruction);
  const tasks: CloneOsTaskPlan[] = [];
  const traceEvents: CanonicalTraceEvent[] = [];

  phrases.forEach((phrase, index) => {
    const c = classifyPhrase(phrase);
    const governance = decideCanonicalGovernance({
      action: c.action, risk: c.risk, sensitivity: c.sensitivity, mode: req.mode,
      external_side_effect: c.external, text: phrase,
      country: c.jurisdictional ? { legalCountry: req.legalCountry, jurisdictional: true, verified: false } : undefined,
      policyVersion: req.policyVersion, cloneadnVersion: req.adnVersion,
    });
    const assignedEmployeeId = selectEmployee(req.employees, c.domain, req.legalCountry);

    tasks.push({
      index, phrase, action: c.action, domain: c.domain, jurisdictional: c.jurisdictional,
      dependsOn: index > 0 ? [index - 1] : [],   // conservative sequential dependency
      assignedEmployeeId, governance,
    });

    traceEvents.push(buildCanonicalTraceEvent({
      event_id: `${req.correlationId}:plan:${index}`, event_type: "cloneos_task_planned", occurred_at: req.nowIso,
      company_id: req.company_id, entity_id: req.entity_id ?? null, legal_country: req.legalCountry,
      user_id: req.user_id, mission_id: null, task_id: `${req.correlationId}:${index}`,
      action: c.action, guard_decision: governance.decision, correlation_id: req.correlationId,
      policy_version: req.policyVersion ?? null, cloneadn_version: req.adnVersion ?? null,
      new_state: "planned", provenance: "cloneos_orchestrator",
      redacted_metadata: { domain: c.domain, jurisdictional: c.jurisdictional, assignedEmployeeId, autonomyGranted: governance.autonomyGranted },
    }));
  });

  const requiresValidation = tasks.some((t) => t.governance.validationsRequired);
  const blocked = tasks.some((t) => t.governance.decision === "block" || t.governance.decision === "refuse");
  const finalOwnerEmployeeId = tasks[0]?.assignedEmployeeId ?? null;
  const missionTitle = phrases.length > 0 ? phrases[0].slice(0, 80) : "Mission";

  return {
    version: "cloneos-1", company_id: req.company_id, missionTitle,
    actions: phrases, tasks, finalOwnerEmployeeId, requiresValidation, blocked, traceEvents,
  };
}

/** The canonical hand-off to the V1 runtime: the instruction the mission-service will create+govern+execute.
 *  CloneOS plans; the V1 mission-service (queue/worker/executors) executes. No second runtime. Pure. */
export function toMissionInstruction(plan: CloneOsPlan): { company_id: string; instruction: string; taskCount: number } {
  return { company_id: plan.company_id, instruction: plan.actions.join(" ; "), taskCount: plan.tasks.length };
}
