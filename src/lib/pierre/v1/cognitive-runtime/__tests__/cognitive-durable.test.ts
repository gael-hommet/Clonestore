// src/lib/pierre/v1/cognitive-runtime/__tests__/cognitive-durable.test.ts
// PHASE 8.14 (D2 + D3-full) — REAL Postgres integration on in-process PGlite (PostgreSQL 16), NOT mocks.
// D2: durable cognitive memory survives a fresh store instance ("restart"), is tenant-isolated (app-layer
// + RLS), versions on update, and fails closed in production without a DB. D3-full: a COMPILED cognitive
// plan actually executes through the real P8 run engine (createMissionRunFromPlan → runPierreRuntimeJobs),
// persisting mission_run + step_runs, with no duplicate effects on re-tick — the compiled plan is NOT
// discarded.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "../../__integration__/harness";
import { seedMission } from "../../__integration__/p85-helpers";
import { createPgMemoryStore, resolveMemoryStore, type CognitiveOperationRecord } from "../operational-memory";
import { generateCognitivePlan } from "../plan-generator";
import { startCognitiveExecution } from "../execution-controller";
import { runPierreRuntimeJobs } from "../../runtime-service";
import type { PlanProposer } from "../types";

let h: Harness;
beforeEach(async () => { h = await createHarness(); }, 60000);
afterEach(async () => { await h.close(); });

const NOW = "2026-07-03T10:00:00.000Z";

function record(companyId: string, opId: string, over: Partial<CognitiveOperationRecord> = {}): CognitiveOperationRecord {
  return {
    operationId: opId, companyId, actorId: h.userA, missionId: null, originalRequest: "gère l'onboarding de Sarah",
    normalizedObjective: "onboarding", resolvedEntities: { Sarah: "emp-1" }, confirmedFacts: ["start lundi"],
    rejectedAssumptions: [], planVersion: 1, terminalState: "AWAITING_APPROVAL", nextExpectedEvent: "approval",
    updatedAtIso: NOW, activePlanFingerprint: "fp1", blockers: ["awaiting_human"], approvals: ["v1"], ...over,
  };
}

describe("D2 — durable Postgres cognitive memory", () => {
  it("persists across a fresh store instance (restart) and recovers fully", async () => {
    const opId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const store = createPgMemoryStore(h.db);
    await store.save(record(h.companyA, opId));
    // A brand-new store object (no shared JS state) reads it back → proves it is in the DB, not memory.
    const fresh = createPgMemoryStore(h.db);
    const got = await fresh.get(h.companyA, opId);
    expect(got).not.toBeNull();
    expect(got!.normalizedObjective).toBe("onboarding");
    expect(got!.resolvedEntities.Sarah).toBe("emp-1");
    expect(got!.terminalState).toBe("AWAITING_APPROVAL");
    expect(got!.activePlanFingerprint).toBe("fp1");
    expect(got!.blockers).toContain("awaiting_human");
  });

  it("is tenant-isolated: another company cannot read the operation (app-layer)", async () => {
    const opId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const store = createPgMemoryStore(h.db);
    await store.save(record(h.companyA, opId));
    expect(await store.get(h.companyA, opId)).not.toBeNull();
    expect(await store.get(h.companyB, opId)).toBeNull(); // no cross-tenant existence leak
  });

  it("RLS blocks a foreign tenant role from seeing the row", async () => {
    const opId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await createPgMemoryStore(h.db).save(record(h.companyA, opId));
    // Bind companyB's tenant GUC under the restricted role → RLS must hide companyA's row.
    const rowsB = await h.asTenantRole(h.companyB, (q) => q(`select operation_id from pierre_rt_cognitive_operations`));
    expect(rowsB.rows.length).toBe(0);
    const rowsA = await h.asTenantRole(h.companyA, (q) => q(`select operation_id from pierre_rt_cognitive_operations`));
    expect(rowsA.rows.length).toBe(1);
  });

  it("bumps the optimistic version on update (no duplicate row)", async () => {
    const opId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const store = createPgMemoryStore(h.db);
    await store.save(record(h.companyA, opId, { terminalState: "AWAITING_APPROVAL" }));
    await store.save(record(h.companyA, opId, { terminalState: "COMPLETED", nextExpectedEvent: null }));
    const rows = await h.db.query<{ version: number; terminal_state: string; n: string }>(`select version, terminal_state from pierre_rt_cognitive_operations where operation_id=$1`, [opId]);
    expect(rows.rows.length).toBe(1);        // upsert, not duplicate
    expect(rows.rows[0].version).toBe(2);    // incremented
    expect(rows.rows[0].terminal_state).toBe("COMPLETED");
  });

  it("fails closed in production without a durable DB", () => {
    expect(() => resolveMemoryStore(null, { productionMode: true })).toThrow();
    expect(resolveMemoryStore(null, { productionMode: false })).toBeTruthy(); // tests may use in-memory
    expect(resolveMemoryStore(h.db)).toBeTruthy();
  });
});

describe("D3-full — compiled cognitive plan executes through the REAL run engine", () => {
  const proposer: PlanProposer = async () => ({
    objective: "onboarding", source: "llm",
    steps: [
      { step_key: "start", action_key: "mission.noop", input: {} },
      { step_key: "finish", action_key: "mission.complete", input: {}, depends_on: ["start"] },
    ],
  });

  it("persists mission_run + step_runs from the compiled plan and completes via the worker", async () => {
    const ctx = h.ctx("A");
    const missionId = await seedMission(h, ctx, "gère l'onboarding");
    // NL → compiled fingerprinted plan (deterministic proposer standing in for the LLM).
    const plan = await generateCognitivePlan({ instruction: "gère l'onboarding", companyId: ctx.company_id, actorId: ctx.user_id, nowIso: NOW, proposer });
    expect(plan.ok).toBe(true);
    expect(plan.compiled.plan_fingerprint).toMatch(/.+/);

    // The COMPILED plan is what executes (not a regenerated one).
    const started = await startCognitiveExecution(h.db, ctx, { missionId, plan });
    expect(started.ok).toBe(true);
    const runId = started.missionRunId!;
    expect(runId).toMatch(/.+/);

    // Real persisted run + steps. The step_keys equal the COMPILED plan's steps → the compiled plan
    // executed verbatim (it was not discarded / regenerated).
    const runRow = await h.db.query<{ status: string }>(`select status from pierre_rt_mission_runs where id=$1 and company_id=$2`, [runId, ctx.company_id]);
    expect(runRow.rows.length).toBe(1);
    const stepKeys = (await h.db.query<{ step_key: string }>(`select step_key from pierre_rt_step_runs where mission_run_id=$1 order by step_key`, [runId])).rows.map((r) => r.step_key);
    expect(stepKeys).toEqual(["finish", "start"]);

    // Drive the real durable worker to completion.
    for (let i = 0; i < 5; i++) await runPierreRuntimeJobs(h.db, ctx, { worker: "w" });
    const finalStatus = (await h.db.query<{ status: string }>(`select status from pierre_rt_mission_runs where id=$1`, [runId])).rows[0].status;
    expect(finalStatus).toBe("completed");
    const stepStatuses = (await h.db.query<{ step_key: string; status: string }>(`select step_key, status from pierre_rt_step_runs where mission_run_id=$1`, [runId])).rows;
    expect(stepStatuses.every((s) => s.status === "succeeded")).toBe(true);
  }, 60000);

  it("re-ticking the worker creates no duplicate effect (idempotent)", async () => {
    const ctx = h.ctx("A");
    const missionId = await seedMission(h, ctx, "op");
    const plan = await generateCognitivePlan({ instruction: "op", companyId: ctx.company_id, actorId: ctx.user_id, nowIso: NOW, proposer });
    const started = await startCognitiveExecution(h.db, ctx, { missionId, plan });
    const runId = started.missionRunId!;
    for (let i = 0; i < 8; i++) await runPierreRuntimeJobs(h.db, ctx, { worker: "w" });
    // step_runs count is fixed (2) — no duplicate steps/effects from repeated ticks.
    const n = (await h.db.query<{ c: string }>(`select count(*)::text c from pierre_rt_step_runs where mission_run_id=$1`, [runId])).rows[0].c;
    expect(Number(n)).toBe(2);
  }, 60000);
});
