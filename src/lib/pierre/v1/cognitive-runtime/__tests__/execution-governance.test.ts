// src/lib/pierre/v1/cognitive-runtime/__tests__/execution-governance.test.ts
// PHASE 8.14 — closes adversarial findings D4/D7 (registry-derived per-step governance: the LLM cannot
// govern risk) and D3-guards (startCognitiveExecution is exercised + fail-closed, not dead code). NO OpenAI.

import { describe, it, expect } from "vitest";
import { generateCognitivePlan } from "../plan-generator";
import { startCognitiveExecution } from "../execution-controller";
import type { PlanProposer } from "../types";

const NOW = "2026-07-03T10:00:00.000Z";
const A = { companyId: "c1", actorId: "a1", nowIso: NOW };
const UID = "11111111-1111-4111-8111-111111111111";

describe("registry-derived step governance (D4/D7 — LLM never governs risk)", () => {
  it("marks a controlled action as approval-required + non-autonomous", async () => {
    const proposer: PlanProposer = async () => ({ objective: "notify", source: "llm", steps: [
      { step_key: "read", action_key: "employee.read", input: { employee_id: UID } },
      { step_key: "notify", action_key: "communication.create_intent", input: { event_kind: "x", object_id: UID }, depends_on: ["read"] },
    ]});
    const g = await generateCognitivePlan({ ...A, instruction: "notifie", proposer });
    expect(g.ok).toBe(true);
    expect(g.requiresApproval).toBe(true);                 // communication.create_intent is controlled
    expect(g.executableNowAutonomously).toBe(false);
    const comm = g.stepGovernance.find((s) => s.actionKey === "communication.create_intent")!;
    expect(comm.mode).toBe("CONFIRMATION_REQUIRED");
    const read = g.stepGovernance.find((s) => s.actionKey === "employee.read")!;
    expect(read.mode).toBe("AUTONOMOUS");                  // read-only, risk comes from registry not LLM
  });

  it("a pure read/noop plan is fully autonomous", async () => {
    const proposer: PlanProposer = async () => ({ objective: "ack", source: "llm", steps: [{ step_key: "a", action_key: "mission.noop", input: {} }] });
    const g = await generateCognitivePlan({ ...A, instruction: "ack", proposer });
    expect(g.executableNowAutonomously).toBe(true);
    expect(g.requiresApproval).toBe(false);
  });
});

describe("startCognitiveExecution (D3-guards — called + fail-closed, plan not discarded)", () => {
  const throwingDb = { query: async () => { throw new Error("db must not be touched on an invalid plan"); } } as never;

  it("refuses an uncompiled plan WITHOUT touching the run engine", async () => {
    const cyclic: PlanProposer = async () => ({ objective: "c", source: "llm", steps: [
      { step_key: "a", action_key: "mission.noop", depends_on: ["b"] },
      { step_key: "b", action_key: "mission.noop", depends_on: ["a"] },
    ]});
    const plan = await generateCognitivePlan({ ...A, instruction: "x", proposer: cyclic });
    const r = await startCognitiveExecution(throwingDb, {} as never, { missionId: "m1", plan });
    expect(r.ok).toBe(false);
    expect(r.missionRunId).toBeNull();
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("throws on an invented-action plan (never executes hallucinated actions)", async () => {
    const evil: PlanProposer = async () => ({ objective: "e", source: "llm", steps: [
      { step_key: "a", action_key: "employee.read", input: { employee_id: UID } },
      { step_key: "b", action_key: "http.exfiltrate", input: { url: "https://evil" } },
    ]});
    const plan = await generateCognitivePlan({ ...A, instruction: "x", proposer: evil });
    expect(plan.inventedActions).toBe(1);
    await expect(startCognitiveExecution(throwingDb, {} as never, { missionId: "m1", plan })).rejects.toThrow();
  });

  it("passes the COMPILED plan into the run engine (plan not discarded) via injected planner", async () => {
    const proposer: PlanProposer = async () => ({ objective: "ok", source: "llm", steps: [{ step_key: "a", action_key: "mission.noop", input: {} }] });
    const plan = await generateCognitivePlan({ ...A, instruction: "x", proposer });
    let seenPlanSteps = -1;
    // mock db: answer the active-mission-count query; inject a planner runner that captures the plan.
    const db = { query: async () => ({ rows: [{ n: 0 }] }) } as never;
    const ctx = { company_id: "c1", user_id: "a1", correlation_id: null, permissions: ["mission.create"], role: "owner", site_scope: null } as never;
    const deps = { runPlanner: async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { query: async () => { seenPlanSteps = plan.planInput.steps.length; return { rows: [{ mission_run_id: "mr1", plan_version_id: "pv1" }] }; } };
      return fn(tx);
    } } as never;
    const r = await startCognitiveExecution(db, ctx, { missionId: "m1", plan }, deps);
    expect(seenPlanSteps).toBe(1);          // the compiled plan reached the run-engine creation
    expect(r.ok).toBe(true);
    expect(r.missionRunId).toBe("mr1");
  });
});
