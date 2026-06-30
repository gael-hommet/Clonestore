// PHASE 8.5-R1 §R1.7 — a sensitive action must be gated by a REAL approval step located UPSTREAM in the
// DAG (the sensitive step transitively depends on it). The compiler refuses a sensitive action with no
// gate, a gate that is not an approval, or a gate that is not upstream — there is no path to a sensitive
// effect that bypasses its approval.
import { describe, it, expect } from "vitest";
import { compileMissionPlan } from "../runtime-plan-compiler";
import { newUuid } from "../sql";

const sig = (extra: Record<string, unknown> = {}) => ({ step_key: "sign", action_key: "signature.prepare", input: { contract_id: newUuid(), ...extra } });

describe("P8.5-R1 sensitive-action approval gate (compiler)", () => {
  it("a sensitive action with NO approval gate is refused", () => {
    const r = compileMissionPlan({ steps: [sig()] });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.startsWith("sensitive_action_without_approval_gate"))).toBe(true);
  });

  it("a gate that is not an approval step is refused", () => {
    const r = compileMissionPlan({ steps: [
      { step_key: "g", action_key: "mission.noop" },
      { ...sig({ approval_gate: "g" }), depends_on: ["g"] },
    ] });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.startsWith("approval_gate_not_approval"))).toBe(true);
  });

  it("an approval gate that is NOT upstream of the sensitive action is refused", () => {
    const r = compileMissionPlan({ steps: [
      { step_key: "appr", action_key: "approval.request", input: { reason: "ok" } },
      sig({ approval_gate: "appr" }), // declares the gate but does NOT depend on it → bypassable
    ] });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.startsWith("approval_gate_not_upstream"))).toBe(true);
  });

  it("a sensitive action gated by a real UPSTREAM approval compiles", () => {
    const r = compileMissionPlan({ steps: [
      { step_key: "appr", action_key: "approval.request", input: { reason: "Valider la signature" } },
      { ...sig({ approval_gate: "appr" }), depends_on: ["appr"] },
    ] });
    expect(r.ok).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it("the approval gate holds transitively (sensitive → mid → approval)", () => {
    const r = compileMissionPlan({ steps: [
      { step_key: "appr", action_key: "approval.request", input: { reason: "ok" } },
      { step_key: "mid", action_key: "mission.noop", depends_on: ["appr"] },
      { ...sig({ approval_gate: "appr" }), depends_on: ["mid"] },
    ] });
    expect(r.ok).toBe(true);
  });
});
