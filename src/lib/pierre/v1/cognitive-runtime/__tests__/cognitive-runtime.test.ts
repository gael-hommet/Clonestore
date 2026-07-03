// src/lib/pierre/v1/cognitive-runtime/__tests__/cognitive-runtime.test.ts
// PHASE 8.14 — deterministic tests for the cognitive runtime slice. NO OpenAI, NO live provider (owner
// §29). Covers temporal/amount/entity resolution + the keystone plan-generator pipeline: real compiler
// integration, invented-action defense, and honest failure modes.

import { describe, it, expect } from "vitest";
import { resolveTemporal } from "../temporal-resolution";
import { resolveAmount } from "../amount-resolution";
import { resolveEntity } from "../entity-resolution";
import { generateCognitivePlan, ALLOWED_ACTION_KEYS } from "../plan-generator";
import { createDeterministicProposer } from "../proposers";
import type { PlanProposer } from "../types";
import { CognitiveError } from "../errors";

const NOW = "2026-07-03T10:00:00.000Z"; // a Friday

describe("temporal-resolution", () => {
  it("resolves relative days FR/EN", () => {
    expect(resolveTemporal("aujourd'hui", NOW).iso).toBe("2026-07-03");
    expect(resolveTemporal("demain", NOW).iso).toBe("2026-07-04");
    expect(resolveTemporal("après-demain", NOW).iso).toBe("2026-07-05");
    expect(resolveTemporal("hier", NOW).iso).toBe("2026-07-02");
  });
  it("resolves 'dans N jours/semaines/mois'", () => {
    expect(resolveTemporal("dans 30 jours", NOW).iso).toBe("2026-08-02");
    expect(resolveTemporal("in 2 weeks", NOW).iso).toBe("2026-07-17");
  });
  it("resolves next week (upcoming Monday) and next month (1st)", () => {
    expect(resolveTemporal("la semaine prochaine", NOW).iso).toBe("2026-07-06");
    expect(resolveTemporal("le mois prochain", NOW).iso).toBe("2026-08-01");
  });
  it("resolves absolute FR '1er août' and iso/dmy", () => {
    expect(resolveTemporal("1er août", NOW).iso).toBe("2026-08-01");
    expect(resolveTemporal("2026-09-15", NOW).iso).toBe("2026-09-15");
    expect(resolveTemporal("15/09/2026", NOW).iso).toBe("2026-09-15");
  });
  it("resolves a weekday to the upcoming instance", () => {
    // Friday NOW → next Monday
    expect(resolveTemporal("lundi", NOW).iso).toBe("2026-07-06");
  });
  it("fails closed on garbage", () => {
    const r = resolveTemporal("quelque part bientôt", NOW);
    expect(r.status).toBe("unresolved");
    expect(r.iso).toBeNull();
  });
});

describe("amount-resolution", () => {
  it("parses plain and grouped integers", () => {
    expect(resolveAmount("2500").amountCents).toBe(250000);
    expect(resolveAmount("2 500").amountCents).toBe(250000);
    expect(resolveAmount("2 500 EUR").currency).toBe("EUR");
  });
  it("parses decimal comma (FR) and decimal dot", () => {
    expect(resolveAmount("2500,50").amountCents).toBe(250050);
    expect(resolveAmount("2500.50").amountCents).toBe(250050);
  });
  it("parses mixed EU grouping '2.500,50'", () => {
    expect(resolveAmount("2.500,50 €").amountCents).toBe(250050);
    expect(resolveAmount("2.500,50 €").currency).toBe("EUR");
  });
  it("detects CHF", () => {
    expect(resolveAmount("CHF 4200").currency).toBe("CHF");
  });
  it("fails closed on ambiguous separator", () => {
    expect(resolveAmount("2,5").status).not.toBe("resolved"); // could be 2.5 or 25 → ambiguous
  });
  it("fails closed when currency required but absent", () => {
    expect(resolveAmount("2500", { requireCurrency: true }).status).toBe("unresolved");
  });
});

describe("entity-resolution", () => {
  const cands = [
    { id: "e1", name: "Thomas Martin", site: "Lyon", status: "active" },
    { id: "e2", name: "Thomas Martin", site: "Lausanne", status: "active" },
    { id: "e3", name: "Julie Bernard", site: "Lyon", status: "active" },
    { id: "e4", name: "Paul Durand", site: "Paris", status: "former" },
  ];
  it("resolves a unique name", () => {
    const r = resolveEntity("employee", "Julie Bernard", cands);
    expect(r.status).toBe("resolved");
    expect(r.id).toBe("e3");
  });
  it("returns ambiguous with distinguishers for homonyms", () => {
    const r = resolveEntity("employee", "Thomas Martin", cands);
    expect(r.status).toBe("ambiguous");
    expect(r.id).toBeNull();
    expect(r.candidates.map((c) => c.distinguisher).join("|")).toContain("Lyon");
  });
  it("resolves by exact id", () => {
    expect(resolveEntity("employee", "e1", cands).id).toBe("e1");
  });
  it("not_found for unknown", () => {
    expect(resolveEntity("employee", "Sarah Nguyen", cands).status).toBe("not_found");
  });
  it("forbidden when only match is forbidden", () => {
    const r = resolveEntity("employee", "Secret Person", [{ id: "x", name: "Secret Person", forbidden: true }]);
    expect(r.status).toBe("forbidden");
    expect(r.id).toBeNull();
  });
  it("never leaks: resolves only within the provided tenant-scoped candidates", () => {
    // "Thomas from Lyon" is not directly resolvable by name alone here, but an id from ANOTHER tenant
    // (not in candidates) must be not_found, never resolved.
    expect(resolveEntity("employee", "tenantB-emp-999", cands).status).toBe("not_found");
  });
});

describe("plan-generator (keystone)", () => {
  const det = createDeterministicProposer();
  const args = { instruction: "Sarah commence lundi, gère son onboarding", companyId: "c1", actorId: "a1", nowIso: NOW };
  const UID = "11111111-1111-4111-8111-111111111111";
  const UID2 = "22222222-2222-4222-8222-222222222222";

  it("deterministic fallback yields a safe, compiler-valid no-op plan (degraded mode)", async () => {
    const g = await generateCognitivePlan({ ...args, proposer: det });
    expect(g.source).toBe("deterministic_fallback");
    expect(g.ok).toBe(true);
    expect(g.compiled.ok).toBe(true);
    expect(g.compiled.plan_fingerprint).toMatch(/.+/);
    expect(g.planInput.steps.map((s) => s.action_key)).toEqual(["mission.noop"]);
  });

  it("compiles a real multi-step plan when the proposer supplies resolved ids (via the REAL compiler)", async () => {
    // Simulates LLM output AFTER entity resolution: concrete uuids + typed inputs.
    const resolved: PlanProposer = async () => ({
      objective: "onboarding", source: "llm",
      steps: [
        { step_key: "read_employee", action_key: "employee.read", input: { employee_id: UID } },
        { step_key: "read_docs", action_key: "document.read", input: { document_id: UID2 }, depends_on: ["read_employee"] },
        { step_key: "notify", action_key: "communication.create_intent", input: { event_kind: "onboarding.welcome", object_id: UID }, depends_on: ["read_docs"] },
        { step_key: "follow_up", action_key: "follow_up.schedule", input: { reason: "onboarding_checkpoint", delay_seconds: 604800 }, depends_on: ["notify"] },
      ],
    });
    const g = await generateCognitivePlan({ ...args, proposer: resolved });
    expect(g.ok).toBe(true);
    expect(g.compiled.ok).toBe(true);
    expect(g.compiled.plan_fingerprint).toMatch(/.+/);
    expect(g.inventedActions).toBe(0);
    expect(g.acceptedActions).toBe(g.investedActions);
    expect(g.compiled.steps.length).toBe(4);
    for (const s of g.planInput.steps) expect(ALLOWED_ACTION_KEYS).toContain(s.action_key);
  });

  it("drops invented actions and refuses to certify the plan (ok=false)", async () => {
    const evil: PlanProposer = async () => ({
      objective: "attack",
      source: "llm",
      steps: [
        { step_key: "s1", action_key: "employee.read", input: {} },
        { step_key: "s2", action_key: "database.dropAllTables", input: { sql: "DROP TABLE employees" }, depends_on: ["s1"] },
        { step_key: "s3", action_key: "http.get", input: { url: "https://evil.example" } },
      ],
    });
    const g = await generateCognitivePlan({ ...args, proposer: evil });
    expect(g.inventedActions).toBe(2);
    expect(g.droppedStepKeys).toEqual(["s2", "s3"]);
    expect(g.ok).toBe(false); // invented actions present → never certified
    // the surviving step is the only registered one
    expect(g.planInput.steps.map((s) => s.action_key)).toEqual(["employee.read"]);
  });

  it("fails closed when the proposer returns no steps", async () => {
    const empty: PlanProposer = async () => ({ objective: "x", source: "llm", steps: [] });
    await expect(generateCognitivePlan({ ...args, proposer: empty })).rejects.toBeInstanceOf(CognitiveError);
  });

  it("rejects an empty instruction", async () => {
    await expect(generateCognitivePlan({ ...args, instruction: "  ", proposer: det })).rejects.toBeInstanceOf(CognitiveError);
  });

  it("compiler rejects a cyclic plan proposed by the model (safety proof)", async () => {
    const cyclic: PlanProposer = async () => ({
      objective: "cycle", source: "llm",
      steps: [
        { step_key: "a", action_key: "mission.noop", input: {}, depends_on: ["b"] },
        { step_key: "b", action_key: "mission.noop", input: {}, depends_on: ["a"] },
      ],
    });
    const g = await generateCognitivePlan({ ...args, proposer: cyclic });
    expect(g.compiled.ok).toBe(false);
    expect(g.ok).toBe(false);
    expect(g.blockers.join(",")).toMatch(/cycle|depend/i);
  });
});
