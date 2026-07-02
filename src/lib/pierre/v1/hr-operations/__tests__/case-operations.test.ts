// src/lib/pierre/v1/hr-operations/__tests__/case-operations.test.ts
// PHASE 8.11 — the case operations layer is a real governed lifecycle: the state machine refuses
// illegal jumps, a case advances through a pack, completion is gated by criteria, and an ambiguous
// external return is never treated as success.

import { describe, it, expect } from "vitest";
import { transition, legalEvents } from "../case-state-machine";
import { openCase, advanceCase, nextStep, canComplete } from "../case-service";
import { emptyEvidence } from "../../hr-mission-packs/completion-evidence";
import { reconcile } from "../reconciliation";
import { getMissionPack } from "../../hr-mission-packs/registry";
import { buildChecklist } from "../checklist";
import { approvalFor } from "../approvals";

describe("case state machine", () => {
  it("allows a legal transition and refuses an illegal one (fail-closed)", () => {
    expect(transition("intake", "subject_resolved").ok).toBe(true);
    expect(transition("intake", "completed").ok).toBe(false);
    expect(transition("awaiting_approval", "completed").ok).toBe(false); // must be granted first
    expect(transition("awaiting_approval", "approval_granted").next).toBe("executing");
  });
  it("terminal states accept no events", () => {
    expect(transition("completed", "step_executed").ok).toBe(false);
    expect(legalEvents("completed")).toEqual([]);
  });
});

describe("case service", () => {
  const pack = getMissionPack("absence.request_to_decision")!;
  it("opens + advances a case governed by the pack", () => {
    let c = openCase(pack, { caseId: "c1", companyId: "co1", correlationId: "corr1", subjectRef: "emp1" });
    expect(c.state).toBe("intake");
    c = advanceCase(c, "subject_resolved").case;
    expect(c.state).toBe("resolving_subject");
    const step = nextStep(c, pack);
    expect(step).toBeTruthy();
  });
  it("cannot complete until completion criteria are met", () => {
    const c = openCase(pack, { caseId: "c2", companyId: "co1", correlationId: "corr2" });
    const empty = canComplete({ ...c, state: "executing" }, pack, emptyEvidence());
    expect(empty.ok).toBe(false);
    expect(empty.unmet.length).toBeGreaterThan(0);
    // with the required evidence, it may close
    const ev = { artifacts: ["x"], mutations: ["absence"], communications: ["d1"], approvals: ["a1"], humanDecisions: [], externalReconciliations: [], state: "completed" };
    expect(canComplete({ ...c, state: "executing" }, pack, ev).ok).toBe(true);
  });
  it("builds a checklist + resolves approvals for a human-decision pack", () => {
    const disc = getMissionPack("disciplinary.case_governance")!;
    const items = buildChecklist(disc);
    expect(items.length).toBeGreaterThan(0);
    const humanStep = disc.steps.find((s) => s.binding.type === "human_decision")!;
    expect(approvalFor(disc, humanStep).required).toBe(true);
  });
});

describe("reconciliation", () => {
  it("is idempotent and never treats ambiguous as success", () => {
    expect(reconcile({ stepKey: "s", correlationId: "c", outcome: "success", alreadyReconciled: true }).apply).toBe(false);
    expect(reconcile({ stepKey: "s", correlationId: "c", outcome: "success", alreadyReconciled: false }).nextEvent).toBe("reconciled");
    expect(reconcile({ stepKey: "s", correlationId: "c", outcome: "ambiguous", alreadyReconciled: false }).nextEvent).toBe("blocked");
  });
});
