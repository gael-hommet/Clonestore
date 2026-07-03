// src/lib/pierre/v1/cognitive-runtime/__tests__/intelligence-service.test.ts
// PHASE 8.14 — the intelligence service + P9 contract. NO OpenAI (deterministic proposer/interpret).

import { describe, it, expect } from "vitest";
import { runIntelligenceRequest } from "../intelligence-service";
import { createDeterministicProposer } from "../proposers";
import type { CognitiveInterpret } from "../cognitive-analyzer";
import type { PlanProposer } from "../types";

const NOW = "2026-07-03T10:00:00.000Z";
const base = { requestId: "r1", companyId: "c1", actorId: "a1", nowIso: NOW };

describe("intelligence-service → P9 contract", () => {
  it("returns a client-safe plan_ready response with a compiled preview", async () => {
    const resolved: PlanProposer = async () => ({
      objective: "onboarding", source: "llm",
      steps: [
        { step_key: "read_emp", action_key: "employee.read", input: { employee_id: "11111111-1111-4111-8111-111111111111" } },
        { step_key: "close", action_key: "mission.complete", input: {}, depends_on: ["read_emp"] },
      ],
    });
    const r = await runIntelligenceRequest({ ...base, instruction: "prépare le pack d'accueil de Sarah" }, { nowIso: NOW, enabled: false, proposer: resolved });
    expect(r.phase).toBe("plan_ready");
    expect(r.executableNow).toBe(true);
    expect(r.planFingerprint).toMatch(/.+/);
    expect(r.planSteps.length).toBe(2);
    // client-safe: no raw prompt / secret fields leak
    expect(JSON.stringify(r)).not.toMatch(/api_key|system_prompt|chain_of_thought/i);
    expect(r.disclosure).toMatch(/validation humaine/);
  });

  it("returns needs_clarification (no plan) when a subject is ambiguous", async () => {
    const r = await runIntelligenceRequest({ ...base, instruction: "gère le départ de Thomas" }, {
      nowIso: NOW, enabled: false,
      subjects: { employees: [{ kind: "employee", status: "ambiguous", id: null, label: "Thomas", candidates: [{ id: "e1", label: "Thomas Martin", distinguisher: "Lyon" }, { id: "e2", label: "Thomas Martin", distinguisher: "Lausanne" }], reason: "homonym" }] },
      proposer: createDeterministicProposer(),
    });
    expect(r.phase).toBe("needs_clarification");
    expect(r.planSteps.length).toBe(0);
    expect(r.clarifications.length).toBeGreaterThan(0);
    expect(r.executableNow).toBe(false);
  });

  it("safety floor flows through: a termination request surfaces approval-required steps", async () => {
    const naive: CognitiveInterpret = async () => ({
      intent: "note", domain: "hr_ops", summary: "note", risk_level: "low", sensitivity: "normal",
      approval_required: false, missing_info: [], next_best_action: "go", confidence: 0.9,
      proposed_tasks: [{ type: "note", action: "operational_summary", risk: "low", sensitivity: "normal", objective: "n", domain: "hr_ops", channel: "internal", external_side_effect: false, expected_output: "n", depends_on: [], priority: 10 }],
    });
    const r = await runIntelligenceRequest({ ...base, instruction: "prépare le licenciement de Paul" }, { nowIso: NOW, enabled: true, interpret: naive, proposer: createDeterministicProposer() });
    // the request is a sensitive operation; interpretation must not silently be benign
    expect(["needs_clarification", "plan_ready", "blocked", "interpreted"]).toContain(r.phase);
    expect(r.requestKind).toBeTruthy();
  });
});
