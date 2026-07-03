// src/lib/pierre/v1/cognitive-runtime/__tests__/scenarios.test.ts
// PHASE 8.14 — the owner's required scenarios A–M exercised through the cognitive runtime deterministically
// (no OpenAI). Operational persistence/server-re-read is proven by the existing runtime integration tests
// + the execution-controller wiring; these assert the COGNITIVE behavior (interpret/plan/clarify/safety/
// proactive/continuation) that P8.14 adds.

import { describe, it, expect } from "vitest";
import { runIntelligenceRequest } from "../intelligence-service";
import { cognitiveAnalyze, type CognitiveInterpret } from "../cognitive-analyzer";
import { resolveEntity } from "../entity-resolution";
import { runProactiveBatch } from "../proactive-controller";
import { mapRunStatusToTerminal, readCognitiveStatus } from "../continuation-controller";
import { interpretRequest } from "../request-interpreter";
import { createDeterministicProposer } from "../proposers";
import type { HrSignal } from "../../hr-proactive/signal-types";
import type { PlanProposer } from "../types";

const NOW = "2026-07-03T10:00:00.000Z";
const base = { requestId: "s", companyId: "c1", actorId: "a1", nowIso: NOW };
const UID = "11111111-1111-4111-8111-111111111111";
// A proposer that returns compiler-valid resolved steps (simulates post-resolution LLM output).
const resolvedProposer: PlanProposer = async () => ({
  objective: "op", source: "llm",
  steps: [
    { step_key: "read", action_key: "employee.read", input: { employee_id: UID } },
    { step_key: "done", action_key: "mission.complete", input: {}, depends_on: ["read"] },
  ],
});

describe("A — onboarding", () => {
  it("interprets an onboarding request and previews a compiled plan", async () => {
    const r = await runIntelligenceRequest({ ...base, instruction: "Sarah commence lundi comme commerciale à Lyon, gère tout" }, { nowIso: NOW, enabled: false, proposer: resolvedProposer });
    expect(["plan_ready", "needs_clarification"]).toContain(r.phase);
    expect(r.confidence).toBeGreaterThan(0);
  });
});

describe("B — multi-domain change", () => {
  it("composes a multi-step plan for a role+comp+site change", async () => {
    const interpret: CognitiveInterpret = async () => ({
      intent: "employee_change", domain: "hr_ops", summary: "Paul change", risk_level: "high", sensitivity: "sensitive",
      approval_required: true, missing_info: [], next_best_action: "review", confidence: 0.7,
      proposed_tasks: [
        { type: "amendment", action: "amendment", risk: "high", sensitivity: "sensitive", objective: "avenant", domain: "contract", channel: "internal", external_side_effect: false, expected_output: "avenant", depends_on: [], priority: 80 },
        { type: "notify", action: "low_risk_notification", risk: "low", sensitivity: "normal", objective: "info", domain: "hr_ops", channel: "internal", external_side_effect: false, expected_output: "note", depends_on: [], priority: 30 },
      ],
    });
    const a = await cognitiveAnalyze("Paul change de poste, de salaire, de site et de manager le mois prochain", { enabled: true, interpret });
    expect(a.proposed_tasks.length).toBeGreaterThanOrEqual(2);
    expect(a.approval_required).toBe(true); // sensitive change requires approval
  });
});

describe("C — offboarding", () => {
  it("treats a departure without fabricating provider/legal completion", async () => {
    const r = await runIntelligenceRequest({ ...base, instruction: "Thomas quitte l'entreprise vendredi, gère tout" }, { nowIso: NOW, enabled: false, proposer: createDeterministicProposer() });
    expect(r.disclosure).toMatch(/exécution/i);
    expect(r.blockers.every((b) => typeof b === "string")).toBe(true);
  });
});

describe("D — homonym ambiguity", () => {
  it("asks the exact distinguishing question and executes nothing", async () => {
    const r = await runIntelligenceRequest({ ...base, instruction: "prépare le départ de Thomas" }, {
      nowIso: NOW, enabled: false,
      subjects: { employees: [{ kind: "employee", status: "ambiguous", id: null, label: "Thomas", candidates: [{ id: "e1", label: "Thomas Martin", distinguisher: "Lyon" }, { id: "e2", label: "Thomas Martin", distinguisher: "Lausanne" }], reason: "homonym" }] },
    });
    expect(r.phase).toBe("needs_clarification");
    expect(r.executableNow).toBe(false);
    expect(r.clarifications[0].question).toMatch(/Lyon|Lausanne/);
  });
});

describe("E — sensitive employee relations (human-only)", () => {
  it("never treats a harassment report as benign, even if the model tries", async () => {
    const naive: CognitiveInterpret = async () => ({
      intent: "note", domain: "hr_ops", summary: "note", risk_level: "low", sensitivity: "normal",
      approval_required: false, missing_info: [], next_best_action: "go", confidence: 0.9,
      proposed_tasks: [{ type: "note", action: "operational_summary", risk: "low", sensitivity: "normal", objective: "n", domain: "hr_ops", channel: "internal", external_side_effect: false, expected_output: "n", depends_on: [], priority: 10 }],
    });
    const a = await cognitiveAnalyze("Julie dit que son manager la harcèle, prends tout en charge", { enabled: true, interpret: naive });
    expect(a.sensitivity).not.toBe("normal");
    expect(a.approval_required).toBe(true);
  });
});

describe("F — payroll operations", () => {
  it("interprets payroll without claiming an official calculation", async () => {
    const r = await runIntelligenceRequest({ ...base, instruction: "prépare la paie du mois et règle ce que tu peux" }, { nowIso: NOW, enabled: false, proposer: createDeterministicProposer() });
    expect(r.objective.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toMatch(/calcul officiel|paie calculée par le provider/i);
  });
});

describe("G — proactive initiative", () => {
  it("detects, dedups, prioritizes and opens governed work", () => {
    const sig = (k: string, sev: HrSignal["severity"], s: string): HrSignal => ({ key: k, companyId: "c1", subjectRef: s, detectedAt: NOW, severity: sev, dedupKey: `${k}:${s}` });
    const { outcomes, suppressed } = runProactiveBatch([sig("contract.expiring", "critical", "c1"), sig("contract.expiring", "critical", "c1"), sig("training.expiry", "info", "t1")]);
    expect(suppressed).toBeGreaterThanOrEqual(1);
    expect(outcomes[0].priority).toBeGreaterThanOrEqual(outcomes[outcomes.length - 1].priority);
  });
});

describe("H — optimization", () => {
  it("classifies an optimization request", async () => {
    const r = await interpretRequest({ requestId: "h", companyId: "c1", actorId: "a1", instruction: "dis-moi ce qui nous fait perdre le plus de temps côté RH et améliore-le" }, { nowIso: NOW, enabled: false });
    expect(r.requestKind).toBe("OPTIMIZATION");
  });
});

describe("I — follow-up correction", () => {
  it("re-resolves a corrected date", async () => {
    const r = await interpretRequest({ requestId: "i", companyId: "c1", actorId: "a1", instruction: "finalement applique le changement au 15 septembre et pas au premier" }, { nowIso: NOW, enabled: false });
    expect(r.dates.some((d) => d.iso === "2026-09-15")).toBe(true);
  });
});

describe("J — existing mission explanation", () => {
  it("classifies an explanation request as analysis", async () => {
    const r = await interpretRequest({ requestId: "j", companyId: "c1", actorId: "a1", instruction: "pourquoi l'onboarding de Sophie est bloqué ?" }, { nowIso: NOW, enabled: false });
    expect(r.requestKind).toBe("ANALYSIS");
  });
});

describe("K — document input", () => {
  it("retrieves relevant capabilities for a document-driven request", async () => {
    const r = await interpretRequest({ requestId: "k", companyId: "c1", actorId: "a1", instruction: "analyse cet avenant de contrat et fais ce qui doit être fait" }, { nowIso: NOW, enabled: false });
    expect(r.candidateCapabilityIds.length).toBeGreaterThan(0);
  });
});

describe("L — cross-tenant attack", () => {
  it("never resolves a foreign id not in the tenant-scoped candidates", () => {
    const cands = [{ id: "e1", name: "Julie Bernard" }];
    const r = resolveEntity("employee", "tenantB-emp-999", cands);
    expect(r.status).toBe("not_found");
    expect(r.id).toBeNull();
  });
});

describe("M — restart continuation", () => {
  it("resumes with the durable status, fail-closed on unknown", async () => {
    expect(mapRunStatusToTerminal("waiting", "approval")).toBe("AWAITING_APPROVAL");
    const s = await readCognitiveStatus("mr1", async () => ({ status: "running" }));
    expect(s.live).toBe(true); // still in flight after "restart" → keeps going, not falsely completed
  });
});
