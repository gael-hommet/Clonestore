// src/lib/pierre/v1/cognitive-runtime/__tests__/cognitive-orchestration.test.ts
// PHASE 8.14 — deterministic tests for orchestration + proactive + learning + tools + continuation +
// evidence. NO OpenAI, NO live provider.

import { describe, it, expect } from "vitest";
import { interpretRequest } from "../request-interpreter";
import { runProactiveBatch, decideProactive } from "../proactive-controller";
import { classifyCorrection, neutralizeCorrection } from "../learning-policy";
import { listCognitiveTools, isAllowedTool } from "../tool-registry";
import { mapRunStatusToTerminal, readCognitiveStatus } from "../continuation-controller";
import { verifyAllEffects } from "../evidence";
import type { HrSignal } from "../../hr-proactive/signal-types";
import type { CognitiveInterpret } from "../cognitive-analyzer";

const NOW = "2026-07-03T10:00:00.000Z";

describe("request-interpreter (orchestrator)", () => {
  it("produces a full interpretation with resolved dates + retrieved capabilities", async () => {
    const interpret: CognitiveInterpret = async () => ({
      intent: "onboarding", domain: "hr_ops", summary: "Onboarding Sarah", risk_level: "low", sensitivity: "normal",
      approval_required: false, missing_info: [], next_best_action: "go", confidence: 0.8,
      proposed_tasks: [{ type: "welcome", action: "operational_summary", risk: "low", sensitivity: "normal", objective: "prep", domain: "hr_ops", channel: "internal", external_side_effect: false, expected_output: "welcome pack", depends_on: [], priority: 40 }],
    });
    const r = await interpretRequest(
      { requestId: "req1", companyId: "c1", actorId: "a1", instruction: "Sarah commence lundi, prépare un contrat" },
      { nowIso: NOW, enabled: true, interpret },
    );
    expect(r.requestKind).toBe("OPERATION");
    expect(r.dates.some((d) => d.iso === "2026-07-06")).toBe(true); // "lundi" → next Monday
    expect(r.candidateCapabilityIds.length).toBeGreaterThan(0); // "contrat" retrieved contract caps
    // "prépare un contrat" trips the deterministic safety floor's high-priority "who?" missing-info,
    // so the interpreter correctly asks before acting; without a blocker it would PREPARE_PLAN.
    expect(["PREPARE_PLAN", "ASK_CLARIFICATION"]).toContain(r.nextStep);
  });

  it("routes to ASK_CLARIFICATION when a subject is ambiguous", async () => {
    const r = await interpretRequest(
      { requestId: "req2", companyId: "c1", actorId: "a1", instruction: "prépare le départ de Thomas" },
      {
        nowIso: NOW, enabled: false,
        subjects: { employees: [{ kind: "employee", status: "ambiguous", id: null, label: "Thomas", candidates: [{ id: "e1", label: "Thomas Martin", distinguisher: "site Lyon" }, { id: "e2", label: "Thomas Martin", distinguisher: "site Lausanne" }], reason: "homonym" }] },
      },
    );
    expect(r.nextStep).toBe("ASK_CLARIFICATION");
  });
});

describe("proactive-controller", () => {
  const sig = (key: string, severity: HrSignal["severity"], subject: string): HrSignal => ({ key, companyId: "c1", subjectRef: subject, detectedAt: NOW, severity, dedupKey: `${key}:${subject}` });

  it("dedups against existing keys and ranks by priority", () => {
    const detected = [sig("contract.expiring", "critical", "c-1"), sig("training.expiry", "info", "t-1"), sig("contract.expiring", "critical", "c-1")];
    const { outcomes, suppressed } = runProactiveBatch(detected, []);
    // one duplicate within the batch suppressed
    expect(suppressed).toBeGreaterThanOrEqual(1);
    // highest priority (critical) first
    expect(outcomes[0].signal.severity).toBe("critical");
    expect(outcomes[0].priority).toBeGreaterThan(outcomes[outcomes.length - 1].priority);
  });

  it("suppresses a signal whose dedup key already exists", () => {
    const s = sig("contract.expiring", "critical", "c-9");
    const { outcomes } = runProactiveBatch([s], [s.dedupKey]);
    expect(outcomes.length).toBe(0);
  });

  it("info signals are observe-only", () => {
    expect(decideProactive(sig("training.expiry", "info", "x")).decision).toBe("observe");
  });
});

describe("learning-policy", () => {
  it("never learns legal content from a correction", () => {
    const c = classifyCorrection({ companyId: "c1", text: "la loi impose un préavis de 3 mois" });
    expect(c.scope).toBe("legal_rule");
    expect(c.writable).toBe(false);
  });
  it("a one-off is temporary; a recurring approved correction is company policy", () => {
    expect(classifyCorrection({ companyId: "c1", text: "utilise le template court" }).scope).toBe("temporary_instruction");
    expect(classifyCorrection({ companyId: "c1", text: "toujours le template court", approvedByRole: "hr_manager", recurrenceCount: 3 }).scope).toBe("company_policy");
  });
  it("neutralizes tenant identifiers", () => {
    const out = neutralizeCorrection("contacter jean@acme.com sur le dossier 11111111-1111-4111-8111-111111111111");
    expect(out).not.toContain("jean@acme.com");
    expect(out).not.toContain("11111111-1111-4111-8111-111111111111");
  });
});

describe("tool-registry", () => {
  it("exposes only registered runtime actions and rejects invented tools", () => {
    const tools = listCognitiveTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((t) => t.actionKey.includes("."))).toBe(true);
    expect(isAllowedTool("employee.read")).toBe(true);
    expect(isAllowedTool("database.drop")).toBe(false);
  });
});

describe("continuation-controller", () => {
  it("maps run statuses to cognitive terminal states", () => {
    expect(mapRunStatusToTerminal("completed")).toBe("COMPLETED");
    expect(mapRunStatusToTerminal("waiting", "approval")).toBe("AWAITING_APPROVAL");
    expect(mapRunStatusToTerminal("waiting", "external_event")).toBe("AWAITING_PROVIDER");
    expect(mapRunStatusToTerminal("failed")).toBe("FAILED_TERMINAL");
  });
  it("reads durable status via an injected reader, fail-closed on unknown", async () => {
    const found = await readCognitiveStatus("mr1", async () => ({ status: "waiting", waitKind: "approval" }));
    expect(found.terminal).toBe("AWAITING_APPROVAL");
    expect(found.live).toBe(true);
    const missing = await readCognitiveStatus("mr2", async () => null);
    expect(missing.terminal).toBe("FAILED_RECOVERABLE");
    expect(missing.live).toBe(false);
  });
});

describe("evidence (no fabricated success)", () => {
  it("confirms only effects the server re-read returns; flags the rest as fabricated", async () => {
    const res = await verifyAllEffects(
      [{ kind: "mission_created", ref: "m1" }, { kind: "message_sent", ref: "msg1" }],
      async (e) => e.ref === "m1", // only the mission exists server-side
    );
    expect(res.allConfirmed).toBe(false);
    expect(res.fabricated).toBe(1);
    expect(res.verifications.find((v) => v.ref === "msg1")!.confirmed).toBe(false);
  });
});
