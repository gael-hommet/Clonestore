// src/lib/pierre/v1/cognitive-runtime/proposers.ts
// PHASE 8.14 — plan PROPOSERS. Two implementations behind the one PlanProposer interface:
//   • createDeterministicProposer() — a real rule-based fallback (mirrors the codebase's aiMode==="off"
//     pattern). Always available, no network, no OpenAI. Used as the safety fallback AND as the test
//     driver, so the whole cognitive pipeline is unit-testable without burning tokens (owner §29).
//   • createLlmProposer() — wraps runCloneAIContract (real Anthropic/OpenAI). Maps the model's proposed
//     steps to REGISTERED action_keys and drops anything else. Exercised only by the bounded real-OpenAI
//     smoke (owner §28), never by normal tests. The model PROPOSES; the registry + compiler DECIDE.

import { runCloneAIContract } from "../../../cloneos/ai/runtime";
import type { PlanProposer, ProposedPlan, ProposedPlanStep, PlanProposerInput } from "./types";

// The deterministic proposer is the SAFE DEGRADED MODE (no LLM / budget exhausted / provider down).
// Honest truth proven by the compiler: a real, executable HR plan requires resolved entity ids
// (employee_id, document_id, object_id …) which a rule-based fallback cannot obtain from raw text. So the
// fallback classifies the intent (for observability) and emits a single compiler-valid, side-effect-free
// `mission.noop` — it acknowledges and defers rather than guessing. Real multi-domain planning is the
// LLM proposer's job (post entity/temporal/amount resolution).
function deterministicSteps(instruction: string): { objective: string; steps: ProposedPlanStep[] } {
  const t = instruction.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const isOnboarding = /(onboard|arriv|commence|embauch|nouvelle recrue|nouveau salari)/.test(t);
  const isOffboarding = /(offboard|depart|quitte|part|licenci|demission)/.test(t);
  const isChange = /(change|augment|promotion|mutation|avenant|salaire|poste|site)/.test(t);
  const objective = isOnboarding ? "onboarding" : isOffboarding ? "offboarding" : isChange ? "employee_change" : "general_hr";
  return { objective, steps: [{ step_key: "acknowledge", action_key: "mission.noop", input: {} }] };
}

export function createDeterministicProposer(): PlanProposer {
  return async (input: PlanProposerInput): Promise<ProposedPlan> => {
    const { objective, steps } = deterministicSteps(input.instruction);
    // Never emit an action outside the allowlist the caller advertised.
    const allowed = new Set(input.allowedActionKeys);
    return { objective, steps: steps.filter((s) => allowed.has(s.action_key)), source: "deterministic_fallback" };
  };
}

// ── Real LLM proposer ───────────────────────────────────────────────────────
// Maps the model's proposed step "action_key" strings to registered keys. Anything unrecognized is left
// as-is and dropped downstream by the plan-generator's registry filter (invented-action defense).
function coerceSteps(json: unknown): ProposedPlanStep[] {
  if (!json || typeof json !== "object") return [];
  const arr = (json as { steps?: unknown }).steps;
  if (!Array.isArray(arr)) return [];
  const out: ProposedPlanStep[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const step_key = typeof o.step_key === "string" ? o.step_key : "";
    const action_key = typeof o.action_key === "string" ? o.action_key : "";
    if (!step_key || !action_key) continue;
    out.push({
      step_key,
      action_key,
      input: (o.input && typeof o.input === "object") ? (o.input as Record<string, unknown>) : {},
      depends_on: Array.isArray(o.depends_on) ? o.depends_on.filter((d): d is string => typeof d === "string") : [],
    });
  }
  return out;
}

export function createLlmProposer(): PlanProposer {
  return async (input: PlanProposerInput): Promise<ProposedPlan | null> => {
    const response = await runCloneAIContract({
      useCase: "pierre.brain.task_plan",
      variables: {
        brain_interpretation: input.instruction,
        execution_contract: `Emit ONLY steps whose action_key is one of: ${input.allowedActionKeys.join(", ")}. Each step: {step_key, action_key, input, depends_on}. A sensitive action requires an upstream approval.request step referenced via input.approval_gate.`,
      },
    });
    if (!response.ok || !response.json) return null;
    const steps = coerceSteps(response.json);
    if (steps.length === 0) return null;
    return { objective: input.instruction, steps, source: "llm" };
  };
}
