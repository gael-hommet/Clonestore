// src/lib/pierre/v1/cognitive-runtime/plan-generator.ts
// PHASE 8.14 — THE KEYSTONE. Turns a free-language instruction into a compiled, fingerprinted mission
// plan by: (1) asking a PROPOSER (LLM in prod, deterministic in tests) for candidate steps, (2) DROPPING
// any step whose action_key is not in the closed RUNTIME_ACTION_REGISTRY (invented-action defense),
// (3) compiling through the EXISTING compileMissionPlan (the safety proof: cycles, unknown deps,
// approval gates, bounds, fingerprint). The model PROPOSES; the deterministic compiler DECIDES. Nothing
// here executes — the returned compiled plan is handed to the real run engine downstream.

import { compileMissionPlan, type RuntimePlanInput, type CompiledPlan } from "../runtime-plan-compiler";
import { getRuntimeActionDefinition } from "../runtime-action-registry";
import type { PlanProposer, ProposedPlan } from "./types";
import { CognitiveError } from "./errors";

// Per-step governance derived from the AUTHORITATIVE registry (not from LLM-supplied metadata): the model
// picks an action_key, but its risk/approval requirement comes from RUNTIME_ACTION_REGISTRY, so the LLM
// can never downgrade a step's risk. This is the planning-path safety floor (closes the "safety floor only
// in analysis" gap): sensitive/controlled steps are surfaced as approval-required + non-autonomous.
export type StepGovernance = {
  readonly stepKey: string;
  readonly actionKey: string;
  readonly risk: string;                 // registry risk: read_only | low | controlled | sensitive
  readonly mode: "AUTONOMOUS" | "CONFIRMATION_REQUIRED" | "HUMAN_DECISION_REQUIRED";
  readonly requiresApproval: boolean;
};

export type GeneratedPlan = {
  readonly ok: boolean;
  readonly objective: string;
  readonly source: ProposedPlan["source"];
  readonly planInput: RuntimePlanInput;
  readonly compiled: CompiledPlan;
  readonly investedActions: number;   // steps the proposer emitted
  readonly acceptedActions: number;   // steps that survived the registry filter
  readonly inventedActions: number;   // steps dropped because the action_key is unknown (must be 0 to trust)
  readonly droppedStepKeys: readonly string[];
  readonly stepGovernance: readonly StepGovernance[]; // registry-derived per-step autonomy/approval
  readonly requiresApproval: boolean;  // any step needs human approval
  readonly executableNowAutonomously: boolean; // every step is autonomous (no approval/human decision)
  readonly blockers: readonly string[];
};

function governStep(stepKey: string, actionKey: string): StepGovernance {
  const def = getRuntimeActionDefinition(actionKey);
  const risk = def?.risk ?? "sensitive"; // unknown → treat as most sensitive (fail-closed)
  let mode: StepGovernance["mode"];
  let requiresApproval: boolean;
  if (risk === "sensitive") { mode = "HUMAN_DECISION_REQUIRED"; requiresApproval = true; }
  else if (risk === "controlled") { mode = "CONFIRMATION_REQUIRED"; requiresApproval = true; }
  else { mode = "AUTONOMOUS"; requiresApproval = false; }
  return { stepKey, actionKey, risk, mode, requiresApproval };
}

/** List of currently-registered action keys (the ONLY actions a plan may contain). */
export const ALLOWED_ACTION_KEYS: readonly string[] = [
  "mission.noop", "mission.complete", "mission.block",
  "employee.read", "contract.read", "document.read",
  "wait.until_time", "wait.for_event",
  "approval.request", "communication.create_intent", "follow_up.schedule", "signature.prepare",
];

function isRegistered(actionKey: string): boolean {
  return getRuntimeActionDefinition(actionKey) !== null;
}

/**
 * Generate a compiled plan from a free-language instruction.
 * @throws CognitiveError on empty instruction / proposer failure / no steps.
 */
export async function generateCognitivePlan(args: {
  instruction: string;
  companyId: string;
  actorId: string;
  nowIso: string;
  proposer: PlanProposer;
}): Promise<GeneratedPlan> {
  const instruction = (args.instruction ?? "").trim();
  if (!instruction) throw new CognitiveError("EMPTY_INSTRUCTION");

  const proposed = await args.proposer({
    instruction,
    companyId: args.companyId,
    actorId: args.actorId,
    allowedActionKeys: ALLOWED_ACTION_KEYS,
    nowIso: args.nowIso,
  });
  if (!proposed) throw new CognitiveError("PROPOSER_FAILED");
  const invested = proposed.steps.length;
  if (invested === 0) throw new CognitiveError("NO_STEPS_PROPOSED");

  // Invented-action defense: drop any step whose action_key is not in the closed registry. We never
  // silently execute a hallucinated action; we record how many were dropped so the caller can refuse a
  // plan that leaned on invented actions.
  const dropped: string[] = [];
  const accepted = proposed.steps.filter((s) => {
    const ok = typeof s.action_key === "string" && isRegistered(s.action_key);
    if (!ok) dropped.push(s.step_key);
    return ok;
  });

  const planInput: RuntimePlanInput = {
    schema_version: "1",
    steps: accepted.map((s) => ({
      step_key: s.step_key,
      action_key: s.action_key,
      input: s.input ?? {},
      depends_on: [...(s.depends_on ?? [])],
    })),
  };

  // The EXISTING compiler is the safety proof. If accepted is empty, compile still runs and returns
  // blockers:["empty_plan"], keeping ok=false — we never fabricate a passing plan.
  const compiled = compileMissionPlan(planInput);

  // Registry-derived per-step governance (the LLM can never downgrade a step's risk).
  const stepGovernance = planInput.steps.map((s) => governStep(s.step_key, s.action_key));
  const requiresApproval = stepGovernance.some((g) => g.requiresApproval);
  const executableNowAutonomously = compiled.ok && dropped.length === 0 && stepGovernance.every((g) => g.mode === "AUTONOMOUS");

  return {
    ok: compiled.ok && dropped.length === 0,
    objective: proposed.objective || instruction,
    source: proposed.source,
    planInput,
    compiled,
    investedActions: invested,
    acceptedActions: accepted.length,
    inventedActions: dropped.length,
    droppedStepKeys: dropped,
    stepGovernance,
    requiresApproval,
    executableNowAutonomously,
    blockers: compiled.blockers,
  };
}
