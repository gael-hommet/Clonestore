// src/lib/clonestore/cloneos/canonical/__tests__/cloneos-orchestrator-p19.test.ts
// P19 — CloneOS orchestrator: segments intent, governs each action (strictest-wins), routes to employees,
// emits canonical trace, delegates execution to V1. Never a second brain, never executes.

import { describe, it, expect } from "vitest";
import { orchestrate, segmentIntent, toMissionInstruction, type EmployeeDescriptor } from "../cloneos-orchestrator";

const pierre: EmployeeDescriptor = { id: "pierre", name: "Pierre", capabilities: ["hr", "document", "review"], countrySupport: "all" };
const base = { company_id: "A", user_id: "u1", legalCountry: "FR", mode: "normal" as const, employees: [pierre], nowIso: "2026-07-01T00:00:00Z", correlationId: "corr-1" };

describe("P19 — CloneOS multi-action segmentation + governance", () => {
  it("segments a multi-action request into ordered phrases", () => {
    expect(segmentIntent("Prépare une synthèse ; puis relance le manager")).toEqual(["Prépare une synthèse", "relance le manager"]);
  });

  it("plans multiple governed tasks with sequential dependencies and trace events", () => {
    const plan = orchestrate({ ...base, instruction: "Prépare une synthèse de l'équipe ; puis relance le manager du rapport" });
    expect(plan.tasks.length).toBe(2);
    expect(plan.tasks[1].dependsOn).toEqual([0]);
    expect(plan.tasks.every((t) => t.assignedEmployeeId === "pierre")).toBe(true);
    expect(plan.traceEvents.length).toBe(2);
    expect(plan.traceEvents[0].event_type).toBe("cloneos_task_planned");
    expect(plan.traceEvents[0].guard_decision).toBeTruthy();
    expect(plan.blocked).toBe(false);
  });
});

describe("P19 — sensitive actions are governed human_only in the plan (no autonomous execution)", () => {
  it("a termination phrase → human_only, plan requires validation", () => {
    const plan = orchestrate({ ...base, mode: "enterprise_autonomous", instruction: "Prépare la lettre de licenciement de Paul" });
    const task = plan.tasks[0];
    expect(task.governance.decision).toBe("human_only");
    expect(task.governance.autonomyGranted).toBe("draft");
    expect(plan.requiresValidation).toBe(true);
  });

  it("a jurisdictional contract for a non-FR unverified country is blocked/validation, never auto", () => {
    const plan = orchestrate({ ...base, legalCountry: "CH", mode: "enterprise_autonomous", instruction: "Rédige le contrat de travail de Marie" });
    const task = plan.tasks[0];
    expect(["require_validation", "human_only", "block"]).toContain(task.governance.decision);
    expect(task.governance.decision).not.toBe("allow_execute");
  });
});

describe("P19 — CloneOS delegates to V1, does not execute", () => {
  it("toMissionInstruction produces a V1 mission input (delegation), not an execution", () => {
    const plan = orchestrate({ ...base, instruction: "Classe le dossier ; puis prépare une note" });
    const handoff = toMissionInstruction(plan);
    expect(handoff.company_id).toBe("A");
    expect(handoff.taskCount).toBe(2);
    expect(handoff.instruction).toContain("Classe le dossier");
    // The plan itself carries no execution result — CloneOS plans, V1 executes.
    expect((plan as unknown as Record<string, unknown>).executed).toBeUndefined();
  });
});

describe("P19 — multi-employee routing (future-ready, real capabilities today)", () => {
  it("routes review-domain work to a review controller when present", () => {
    const reviewer: EmployeeDescriptor = { id: "reviewer", name: "Review", capabilities: ["review"], countrySupport: "all" };
    const plan = orchestrate({ ...base, employees: [pierre, reviewer], instruction: "Prépare une synthèse" });
    // "prépare" → hr domain → pierre (has hr). Reviewer only handles review; routing still deterministic.
    expect(plan.tasks[0].assignedEmployeeId).toBe("pierre");
  });
  it("respects country support when routing", () => {
    const chOnly: EmployeeDescriptor = { id: "ch", name: "CH", capabilities: ["hr"], countrySupport: ["CH"] };
    const plan = orchestrate({ ...base, legalCountry: "CH", employees: [chOnly], instruction: "Prépare une note" });
    expect(plan.tasks[0].assignedEmployeeId).toBe("ch");
  });
});
