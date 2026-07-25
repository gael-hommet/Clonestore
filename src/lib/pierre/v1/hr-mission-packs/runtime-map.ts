// src/lib/pierre/v1/hr-mission-packs/runtime-map.ts
// PHASE 8.11 — binds mission-pack steps to the ALREADY-VERIFIED runtime. This is the only place
// that connects packs to real primitives: the closed runtime action registry (P8.5) and the canon
// capabilities (P8.10). It exposes binding resolution + a translator that turns a pack's
// runtime_action steps into a RuntimePlanInput for the REAL compileMissionPlan().

import { isKnownRuntimeAction, getRuntimeActionDefinition } from "../runtime-action-registry";
import type { RuntimePlanInput, RuntimePlanStepInput } from "../runtime-plan-compiler";
import { getCapability } from "../hr-canon/capability-registry";
import type { HrMissionPackDefinition, HrMissionPackStep, StepBinding } from "./types";

export type BindingResolution = { ok: boolean; kind: StepBinding["type"]; detail: string; error?: string };

/** Resolve a step binding against the real primitives. The single gate that forbids inventing
 *  an action / calling an unknown capability / handing off to a non-system. */
export function resolveBinding(b: StepBinding): BindingResolution {
  switch (b.type) {
    case "runtime_action":
      return isKnownRuntimeAction(b.actionKey)
        ? { ok: true, kind: b.type, detail: b.actionKey }
        : { ok: false, kind: b.type, detail: b.actionKey, error: `unregistered runtime action '${b.actionKey}'` };
    case "governed_service":
      return getCapability(b.capabilityId)
        ? { ok: true, kind: b.type, detail: b.capabilityId }
        : { ok: false, kind: b.type, detail: b.capabilityId, error: `unknown capability '${b.capabilityId}'` };
    case "human_decision":
      return b.role ? { ok: true, kind: b.type, detail: b.role } : { ok: false, kind: b.type, detail: "", error: "human_decision requires a role" };
    case "external_handoff":
      return b.system && b.system !== "none" ? { ok: true, kind: b.type, detail: b.system } : { ok: false, kind: b.type, detail: String(b.system), error: "external_handoff requires a real system" };
  }
}

export function isRuntimeActionStep(s: HrMissionPackStep): boolean { return s.binding.type === "runtime_action"; }

// Compile-time placeholder inputs that satisfy each action's input contract. The REAL runtime binds
// real values at execution; the compiler only proves the plan SHAPE compiles on the verified
// compiler. Nil-uuid + neutral strings keep the plan structurally valid without inventing data.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
function defaultActionInput(actionKey: string): Record<string, unknown> {
  switch (actionKey) {
    case "approval.request": return { reason: "governed mission-pack approval" };
    case "communication.create_intent": return { event_kind: "hr.mission_notification", object_type: "mission", object_id: NIL_UUID };
    case "follow_up.schedule": return { reason: "governed mission-pack follow-up", delay_seconds: 86400 };
    case "signature.prepare": return { contract_id: NIL_UUID };
    case "analytics.compute": return { metric: "executive_report" }; // default; packs override with the capability-appropriate metric
    case "document.generate": return { document_type: "generic_hr_document", title: "Document RH" }; // packs override with the concrete type/title
    case "hr.record.append": return { record_type: "hr.step" }; // packs override with the concrete record_type
    case "hr.data.collect": return {}; // packs override with required_fields/provided
    case "absence.record.create": return { employee_id: NIL_UUID, absence_type: "unspecified", start_date: "2026-01-01", end_date: "2026-01-01" }; // runtime binds real values
    case "employee.timeline.append": return { employee_id: NIL_UUID, entry_type: "record" }; // runtime binds real values
    case "hr.reconcile.apply": return { reconcile_kind: "external_return" }; // runtime supplies external_return when present
    case "workforce.plan.create": return { period: "unspecified" }; // runtime binds real period/headcounts
    case "recruitment.candidate.ingest": return { full_name: "unspecified" }; // runtime binds the real candidate
    case "hr.request.create": return { subject: "HR request" }; // runtime binds the real subject/body
    case "country.pack.bind": return { country_code: "FR", pack_key: "unspecified" }; // runtime binds the real pack
    default: return {};
  }
}

/** Translate a pack into a RuntimePlanInput (only its runtime_action steps). Sensitive actions
 *  (e.g. signature.prepare) get their approval_gate wired to the nearest upstream approval step. */
export function packToRuntimePlan(pack: HrMissionPackDefinition): RuntimePlanInput {
  const rtSteps = pack.steps.filter(isRuntimeActionStep);
  const rtKeys = new Set(rtSteps.map((s) => s.key));
  const approvalStepKeys = rtSteps.filter((s) => s.binding.type === "runtime_action" && (s.binding).actionKey === "approval.request").map((s) => s.key);
  const steps: RuntimePlanStepInput[] = rtSteps.map((s) => {
    const bind = s.binding as Extract<StepBinding, { type: "runtime_action" }>;
    const actionKey = bind.actionKey;
    const depends_on = (s.dependsOn ?? []).filter((d) => rtKeys.has(d)); // only deps that are runtime steps
    const input: Record<string, unknown> = { ...defaultActionInput(actionKey), ...(bind.input ?? {}) }; // pack-declared input overrides defaults
    const dfn = getRuntimeActionDefinition(actionKey);
    if (dfn?.risk === "sensitive") {
      // pick an upstream approval step this step depends on (transitively via declared deps)
      const gate = (s.dependsOn ?? []).find((d) => approvalStepKeys.includes(d)) ?? approvalStepKeys[0];
      if (gate) { input.approval_gate = gate; if (!depends_on.includes(gate)) depends_on.push(gate); }
    }
    return { step_key: s.key, action_key: actionKey, depends_on, input };
  });
  return { schema_version: "1", steps };
}

/** The set of registered runtime action keys a pack may use (for docs/coverage). */
export function registeredActionKeysUsed(pack: HrMissionPackDefinition): string[] {
  return [...new Set(pack.steps.filter(isRuntimeActionStep).map((s) => (s.binding as Extract<StepBinding, { type: "runtime_action" }>).actionKey))];
}
