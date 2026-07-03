// src/lib/pierre/v1/cognitive-runtime/__tests__/cognitive-proactive-learning.test.ts
// PHASE 8.14 (D5 + D6 + D8) — REAL Postgres integration (PGlite). Proactive detection from live company
// state with durable dedup across ticks; continuation that resumes a durable operation via the real
// worker; learning from corrections persisted company-scoped and retrievable. NOT mocks.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "../../__integration__/harness";
import { seedMission } from "../../__integration__/p85-helpers";
import { newUuid } from "../../sql";
import { runProactiveDetectionTick, type Detector } from "../proactive-detection";
import { runIntelligenceRequest } from "../intelligence-service";
import { recordCorrection, retrieveCompanyPreferences } from "../learning-store";
import { continueCognitiveOperation } from "../continuation";
import { createPgMemoryStore } from "../operational-memory";
import { generateCognitivePlan } from "../plan-generator";
import { startCognitiveExecution } from "../execution-controller";
import { runPierreRuntimeJobs } from "../../runtime-service";
import type { PlanProposer } from "../types";

let h: Harness;
beforeEach(async () => { h = await createHarness(); }, 60000);
afterEach(async () => { await h.close(); });
const NOW = "2026-07-03T10:00:00.000Z";

async function seedOverdueValidation(companyId: string, missionId: string) {
  // a pending validation created 30 days ago → overdue
  await h.db.query(
    `insert into pierre_rt_validations (id, company_id, mission_id, validator_role, required_count, status, reason, created_at)
       values ($1,$2,$3,'hr_manager',1,'pending','old approval', now() - interval '30 days')`,
    [newUuid(), companyId, missionId],
  );
}

describe("D5 — proactive detection from live company state (durable dedup)", () => {
  it("detects overdue approvals, persists signals, and is idempotent across ticks", async () => {
    const ctx = h.ctx("A");
    const m = await seedMission(h, ctx, "op");
    await seedOverdueValidation(ctx.company_id, m);
    await seedOverdueValidation(ctx.company_id, m);

    const t1 = await runProactiveDetectionTick(h.db, ctx, NOW);
    expect(t1.detected).toBe(2);
    expect(t1.persisted).toBe(2);
    expect(t1.outcomes[0].priority).toBeGreaterThan(0);

    // Re-tick: same state → 0 new signals (unique dedup_key), no alert spam / duplicate work.
    const t2 = await runProactiveDetectionTick(h.db, ctx, NOW);
    expect(t2.persisted).toBe(0);
    const count = (await h.db.query<{ c: string }>(`select count(*)::text c from pierre_rt_proactive_signals where company_id=$1`, [ctx.company_id])).rows[0].c;
    expect(Number(count)).toBe(2);
  }, 60000);

  it("is tenant-isolated: company B detection sees none of company A's overdue items", async () => {
    const ctxA = h.ctx("A"); const ctxB = h.ctx("B");
    const m = await seedMission(h, ctxA, "op");
    await seedOverdueValidation(ctxA.company_id, m);
    const tB = await runProactiveDetectionTick(h.db, ctxB, NOW);
    expect(tB.detected).toBe(0); // B's tenant-scoped query sees nothing of A
  }, 60000);

  it("OPENS a real governed mission for a fresh signal with a governed pack (idempotent)", async () => {
    const ctx = h.ctx("A");
    // a signal key that maps to a real mission pack → decideProactive returns decision='mission'
    const detector: Detector = async () => [{ key: "recruitment.decision_overdue", companyId: ctx.company_id, subjectRef: "cand-1", detectedAt: NOW, severity: "warning", dedupKey: "recruitment.decision_overdue:cand-1" }];
    const t = await runProactiveDetectionTick(h.db, ctx, NOW, [detector]);
    expect(t.missionsOpened).toBe(1);
    const sig = (await h.db.query<{ status: string; mission_id: string }>(`select status, mission_id from pierre_rt_proactive_signals where company_id=$1 and dedup_key=$2`, [ctx.company_id, "recruitment.decision_overdue:cand-1"])).rows[0];
    expect(sig.status).toBe("handled");
    expect(sig.mission_id).toBeTruthy();
    const m = (await h.db.query<{ c: string }>(`select count(*)::text c from pierre_rt_missions where id=$1 and company_id=$2`, [sig.mission_id, ctx.company_id])).rows[0];
    expect(Number(m.c)).toBe(1); // a REAL persisted mission was opened proactively
    // re-tick → the signal already exists → no duplicate mission
    const t2 = await runProactiveDetectionTick(h.db, ctx, NOW, [detector]);
    expect(t2.missionsOpened).toBe(0);
  }, 60000);
});

describe("coverage — OPTIMIZATION/MONITORING dispatched to the real analytics engine (not a plan)", () => {
  it("routes an optimization request to grounded findings", async () => {
    const ctx = h.ctx("A");
    const m = await seedMission(h, ctx, "op"); await seedOverdueValidation(ctx.company_id, m);
    const r = await runIntelligenceRequest(
      { requestId: "r", companyId: ctx.company_id, actorId: ctx.user_id, instruction: "dis-moi ce qui nous fait perdre le plus de temps et améliore-le", nowIso: NOW },
      { nowIso: NOW, enabled: false, db: h.db },
    );
    expect(r.phase).toBe("analysis");
    expect(r.analysis).not.toBeNull();
    expect(r.analysis!.kind).toBe("optimization");
    expect(r.analysis!.findings.length).toBeGreaterThan(0);
    expect(r.planSteps.length).toBe(0); // an analysis request does not produce an execution plan
  }, 60000);

  it("routes a monitoring request to a watch list", async () => {
    const ctx = h.ctx("A");
    const m = await seedMission(h, ctx, "op"); await seedOverdueValidation(ctx.company_id, m);
    const r = await runIntelligenceRequest(
      { requestId: "r2", companyId: ctx.company_id, actorId: ctx.user_id, instruction: "surveille les risques RH et préviens-moi", nowIso: NOW },
      { nowIso: NOW, enabled: false, db: h.db },
    );
    expect(r.phase).toBe("analysis");
    expect(r.analysis!.kind).toBe("monitoring");
  }, 60000);
});

describe("D6 — continuation resumes a durable operation via the real worker", () => {
  const proposer: PlanProposer = async () => ({ objective: "op", source: "llm", steps: [
    { step_key: "start", action_key: "mission.noop", input: {} },
    { step_key: "finish", action_key: "mission.complete", input: {}, depends_on: ["start"] },
  ]});

  it("reloads the op, drives the worker, and persists the advanced terminal state", async () => {
    const ctx = h.ctx("A");
    const missionId = await seedMission(h, ctx, "op");
    const plan = await generateCognitivePlan({ instruction: "op", companyId: ctx.company_id, actorId: ctx.user_id, nowIso: NOW, proposer });
    const started = await startCognitiveExecution(h.db, ctx, { missionId, plan });
    const runId = started.missionRunId!;

    // durable cognitive op linked to the run, not yet advanced
    const store = createPgMemoryStore(h.db);
    const opId = newUuid();
    await store.save({ operationId: opId, companyId: ctx.company_id, actorId: ctx.user_id, missionId, originalRequest: "op", normalizedObjective: "op", resolvedEntities: {}, confirmedFacts: [], rejectedAssumptions: [], planVersion: 1, terminalState: "AWAITING_INFORMATION", nextExpectedEvent: "worker", updatedAtIso: NOW, missionRunId: runId });

    // continue → drives the real worker → run completes → op reconciled + persisted
    const r = await continueCognitiveOperation(h.db, ctx, opId, { runWorker: async () => { for (let i = 0; i < 5; i++) await runPierreRuntimeJobs(h.db, ctx, { worker: "w" }); }, nowIso: "2026-07-03T11:00:00.000Z" });
    expect(r.found).toBe(true);
    expect(r.resumed).toBe(true);
    expect(r.terminalState).toBe("COMPLETED");

    // persisted: a fresh read sees the advanced state (survives "restart")
    const reread = await createPgMemoryStore(h.db).get(ctx.company_id, opId);
    expect(reread!.terminalState).toBe("COMPLETED");
  }, 60000);

  it("fails closed on an unknown operation", async () => {
    const ctx = h.ctx("A");
    const r = await continueCognitiveOperation(h.db, ctx, newUuid(), { runWorker: async () => {}, nowIso: NOW });
    expect(r.found).toBe(false);
    expect(r.terminalState).toBe("FAILED_RECOVERABLE");
  }, 60000);
});

describe("D8 — learning from corrections (company-scoped, retrievable, safe)", () => {
  it("persists an approved recurring correction as company policy and retrieves it", async () => {
    const ctx = h.ctx("A");
    const rec = await recordCorrection(h.db, ctx, { text: "toujours utiliser le template court pour les attestations", approvedByRole: "hr_manager", recurrenceCount: 3 });
    expect(rec.persisted).toBe(true);
    expect(rec.scope).toBe("company_policy");
    const prefs = await retrieveCompanyPreferences(h.db, ctx);
    expect(prefs.some((p) => p.text.includes("template court"))).toBe(true);
  }, 60000);

  it("NEVER learns legal content from a correction", async () => {
    const ctx = h.ctx("A");
    const rec = await recordCorrection(h.db, ctx, { text: "la loi impose un préavis de 3 mois" });
    expect(rec.persisted).toBe(false);
    expect(rec.scope).toBe("legal_rule");
    const count = (await h.db.query<{ c: string }>(`select count(*)::text c from pierre_rt_cognitive_learning where company_id=$1`, [ctx.company_id])).rows[0].c;
    expect(Number(count)).toBe(0);
  }, 60000);

  it("does not leak learning across companies", async () => {
    const ctxA = h.ctx("A"); const ctxB = h.ctx("B");
    await recordCorrection(h.db, ctxA, { text: "préférence A", approvedByRole: "hr_manager", recurrenceCount: 2 });
    const prefsB = await retrieveCompanyPreferences(h.db, ctxB);
    expect(prefsB.length).toBe(0); // B sees nothing of A
  }, 60000);
});
