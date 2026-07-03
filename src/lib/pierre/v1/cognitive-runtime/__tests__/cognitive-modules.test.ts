// src/lib/pierre/v1/cognitive-runtime/__tests__/cognitive-modules.test.ts
// PHASE 8.14 — deterministic tests for the cognitive modules wired to the live path. NO OpenAI.

import { describe, it, expect } from "vitest";
import { cognitiveAnalyze, type CognitiveInterpret } from "../cognitive-analyzer";
import { retrieveCapabilities, isKnownCapability } from "../capability-retrieval";
import { classifyStepAutonomy } from "../autonomy-policy";
import { computeClarifications } from "../clarification-engine";
import { createInMemoryMemoryStore, assertNoHiddenReasoning } from "../operational-memory";
import type { ResolvedReference } from "../types";

describe("cognitive-analyzer (live-path planner)", () => {
  it("uses the deterministic fallback when the planner is disabled", async () => {
    const a = await cognitiveAnalyze("relance le manager de Julie", { enabled: false });
    expect(a.planner_source).toBe("deterministic_fallback");
    expect(a.proposed_tasks.length).toBeGreaterThan(0);
  });

  it("becomes LLM-authoritative when enabled with an injected interpreter", async () => {
    const interpret: CognitiveInterpret = async () => ({
      intent: "onboarding", domain: "hr_ops", summary: "LLM plan", risk_level: "low", sensitivity: "normal",
      approval_required: false, missing_info: [], next_best_action: "go", confidence: 0.8,
      proposed_tasks: [
        { type: "welcome_pack", action: "operational_summary", risk: "low", sensitivity: "normal", objective: "prep", domain: "hr_ops", channel: "internal", external_side_effect: false, expected_output: "pack", depends_on: [], priority: 50 },
      ],
    });
    const a = await cognitiveAnalyze("Sarah commence lundi, prépare son arrivée", { enabled: true, interpret });
    expect(a.planner_source).toBe("llm");
    expect(a.summary).toBe("LLM plan");
  });

  it("SAFETY FLOOR: the LLM can never downgrade a detected sensitive verdict", async () => {
    // The model tries to treat a termination as a benign summary. The regex floor must re-escalate it.
    const naive: CognitiveInterpret = async () => ({
      intent: "note", domain: "hr_ops", summary: "benign", risk_level: "low", sensitivity: "normal",
      approval_required: false, missing_info: [], next_best_action: "go", confidence: 0.9,
      proposed_tasks: [
        { type: "note", action: "operational_summary", risk: "low", sensitivity: "normal", objective: "note", domain: "hr_ops", channel: "internal", external_side_effect: false, expected_output: "note", depends_on: [], priority: 10 },
      ],
    });
    const a = await cognitiveAnalyze("Prépare le licenciement de Paul Durand", { enabled: true, interpret: naive });
    expect(a.planner_source).toBe("llm");
    // floor re-applied: sensitive/restricted + high/critical risk preserved, approval required
    expect(["sensitive", "restricted"]).toContain(a.sensitivity);
    expect(["high", "critical"]).toContain(a.risk_level);
    expect(a.approval_required).toBe(true);
    // a sensitive task is present even though the model omitted it
    expect(a.proposed_tasks.some((t) => t.sensitivity !== "normal")).toBe(true);
  });

  it("falls back to regex when the interpreter fails", async () => {
    const boom: CognitiveInterpret = async () => { throw new Error("provider down"); };
    const a = await cognitiveAnalyze("classe ces documents", { enabled: true, interpret: boom });
    expect(a.planner_source).toBe("deterministic_fallback");
  });
});

describe("capability-retrieval", () => {
  it("retrieves relevant, bounded capabilities from the real canon", () => {
    const r = retrieveCapabilities("créer un contrat de travail", { limit: 8 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(8);
    expect(r[0].score).toBeGreaterThan(0);
  });
  it("rejects invented capability ids", () => {
    expect(isKnownCapability("totally.invented.capability")).toBe(false);
  });
});

describe("autonomy-policy", () => {
  it("routes termination to HUMAN_DECISION_REQUIRED regardless of mode", () => {
    const d = classifyStepAutonomy({ action: "termination", risk: "critical", sensitivity: "restricted", externalSideEffect: false, objective: "x", mode: "enterprise_autonomous" });
    expect(d.mode).toBe("HUMAN_DECISION_REQUIRED");
    expect(d.executableNow).toBe(false);
  });
  it("allows a low-risk operational action to be autonomous in normal mode", () => {
    const d = classifyStepAutonomy({ action: "reminder", risk: "low", sensitivity: "normal", externalSideEffect: false, objective: "relance", mode: "normal" });
    expect(d.mode).toBe("AUTONOMOUS");
    expect(d.executableNow).toBe(true);
  });
  it("requires confirmation for a compensation change", () => {
    const d = classifyStepAutonomy({ action: "compensation", risk: "high", sensitivity: "sensitive", externalSideEffect: false, objective: "augmentation", mode: "normal" });
    expect(["CONFIRMATION_REQUIRED", "HUMAN_DECISION_REQUIRED"]).toContain(d.mode);
    expect(d.requiresApproval).toBe(true);
  });
});

describe("clarification-engine", () => {
  it("asks a precise disambiguation question for a homonym and blocks execution", () => {
    const ambiguous: ResolvedReference = {
      kind: "employee", status: "ambiguous", id: null, label: "Thomas Martin",
      candidates: [{ id: "e1", label: "Thomas Martin", distinguisher: "site Lyon" }, { id: "e2", label: "Thomas Martin", distinguisher: "site Lausanne" }],
      reason: "homonym",
    };
    const r = computeClarifications({ entities: [ambiguous], dates: [], amounts: [], ambiguities: [], missingInformation: [] });
    expect(r.nextStep).toBe("ASK_CLARIFICATION");
    expect(r.blocksExecution).toBe(true);
    expect(r.questions[0].question).toMatch(/Lyon|Lausanne/);
  });
  it("proceeds to plan when nothing blocks", () => {
    const r = computeClarifications({ entities: [], dates: [], amounts: [], ambiguities: [], missingInformation: [] });
    expect(r.nextStep).toBe("PREPARE_PLAN");
    expect(r.blocksExecution).toBe(false);
  });
});

describe("operational-memory", () => {
  it("is tenant-safe: another tenant cannot read the record", async () => {
    const store = createInMemoryMemoryStore();
    await store.save({
      operationId: "op1", companyId: "A", actorId: "u1", missionId: "m1", originalRequest: "x", normalizedObjective: "x",
      resolvedEntities: { Julie: "e3" }, confirmedFacts: [], rejectedAssumptions: [], planVersion: 1,
      terminalState: "AWAITING_APPROVAL", nextExpectedEvent: "approval", updatedAtIso: NOW_ISO,
    });
    expect(await store.get("A", "op1")).not.toBeNull();
    expect(await store.get("B", "op1")).toBeNull(); // no cross-tenant leak
  });
  it("rejects hidden chain-of-thought / secrets", () => {
    expect(() => assertNoHiddenReasoning({ operationId: "x", ["chain_of_thought" as unknown as "originalRequest"]: "..." } as never)).toThrow();
  });
});

const NOW_ISO = "2026-07-03T10:00:00.000Z";
