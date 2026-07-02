// src/lib/pierre/v1/hr-mission-packs/compiler.ts
// PHASE 8.11 — the mission-pack compiler. Turns a declarative pack into a concrete governed plan by
// (1) validating it, (2) translating its runtime_action steps into a RuntimePlanInput and running
// the REAL P8.5 compileMissionPlan() to PROVE the runtime portion actually compiles (0 blockers),
// and (3) emitting the governed operational steps (service mutations / human decisions / external
// handoffs) with their governance. This is the "compile canon → verified runtime" bridge — it never
// executes anything; it proves the pack is buildable on the existing runtime.

import type { HrMissionPackDefinition, HrMissionPackStep } from "./types";
import { validateMissionPack } from "./validator";
import { packToRuntimePlan } from "./runtime-map";
import { compileMissionPlan, type CompiledPlan } from "../runtime-plan-compiler";

export type OperationalStep = {
  key: string;
  kind: HrMissionPackStep["kind"];
  bindingType: string;
  target: string;
  autonomy: string;
  requiresApproval: boolean;
};

export type CompiledMissionPack = {
  id: string;
  ok: boolean;
  blockers: string[];
  runtimePlan: { steps: number };
  compiled: CompiledPlan;            // the REAL compiled runtime plan
  runtimeStepCount: number;
  operationalSteps: OperationalStep[];
  runtimeStatus: HrMissionPackDefinition["runtimeStatus"];
};

export function compileMissionPack(pack: HrMissionPackDefinition): CompiledMissionPack {
  const issues = validateMissionPack(pack);
  const validatorErrors = issues.filter((i) => i.severity === "error").map((i) => `${i.field}:${i.message}`);

  const runtimePlan = packToRuntimePlan(pack);
  // Only compile if there is at least one runtime_action step (every real pack has intake/close).
  const compiled = runtimePlan.steps.length > 0
    ? compileMissionPlan(runtimePlan)
    : ({ ok: false, schema_version: "1", plan_fingerprint: "", steps: [], blockers: ["no_runtime_action_steps"] } as CompiledPlan);

  const operationalSteps: OperationalStep[] = pack.steps
    .filter((s) => s.binding.type !== "runtime_action")
    .map((s) => ({
      key: s.key, kind: s.kind, bindingType: s.binding.type,
      target: s.binding.type === "governed_service" ? s.binding.capabilityId : s.binding.type === "human_decision" ? s.binding.role : s.binding.type === "external_handoff" ? String(s.binding.system) : "",
      autonomy: s.autonomy, requiresApproval: !!s.requiresApproval,
    }));

  const blockers = [...validatorErrors, ...compiled.blockers.map((b) => `runtime:${b}`)];
  return {
    id: pack.id,
    ok: blockers.length === 0 && compiled.ok,
    blockers,
    runtimePlan: { steps: runtimePlan.steps.length },
    compiled,
    runtimeStepCount: runtimePlan.steps.length,
    operationalSteps,
    runtimeStatus: pack.runtimeStatus,
  };
}

export function compileAll(packs: HrMissionPackDefinition[]): { ok: boolean; results: CompiledMissionPack[]; failed: string[] } {
  const results = packs.map(compileMissionPack);
  const failed = results.filter((r) => !r.ok).map((r) => r.id);
  return { ok: failed.length === 0, results, failed };
}
