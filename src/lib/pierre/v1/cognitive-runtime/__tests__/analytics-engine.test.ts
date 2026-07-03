// src/lib/pierre/v1/cognitive-runtime/__tests__/analytics-engine.test.ts
// PHASE 8.14 (D10 engines) — REAL integration: the optimization + monitoring engines compute grounded
// findings over real tenant-scoped state, separating fact / inference / recommendation. NOT labels.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "../../__integration__/harness";
import { seedMission } from "../../__integration__/p85-helpers";
import { newUuid } from "../../sql";
import { runOptimizationAnalysis, runMonitoringSnapshot } from "../analytics-engine";

let h: Harness;
beforeEach(async () => { h = await createHarness(); }, 60000);
afterEach(async () => { await h.close(); });

async function seedOverdue(companyId: string, missionId: string) {
  await h.db.query(
    `insert into pierre_rt_validations (id, company_id, mission_id, validator_role, required_count, status, reason, created_at)
       values ($1,$2,$3,'hr_manager',1,'pending','x', now() - interval '30 days')`,
    [newUuid(), companyId, missionId]);
}

describe("D10 optimization engine (grounded, fact vs inference)", () => {
  it("computes real bottleneck findings from live state", async () => {
    const ctx = h.ctx("A");
    const m = await seedMission(h, ctx, "op");
    await seedOverdue(ctx.company_id, m); await seedOverdue(ctx.company_id, m);
    const r = await runOptimizationAnalysis(h.db, ctx);
    const overdue = r.findings.find((f) => f.metric === "overdue_validations")!;
    expect(overdue.kind).toBe("fact");
    expect(Number(overdue.value)).toBe(2);
    // an inference/recommendation is present and NOT labelled as fact
    expect(r.findings.some((f) => f.kind === "inference")).toBe(true);
    expect(r.findings.some((f) => f.kind === "recommendation")).toBe(true);
  }, 60000);

  it("is tenant-scoped (company B sees zero of A's overdue approvals)", async () => {
    const ctxA = h.ctx("A"); const ctxB = h.ctx("B");
    const m = await seedMission(h, ctxA, "op"); await seedOverdue(ctxA.company_id, m);
    const rB = await runOptimizationAnalysis(h.db, ctxB);
    expect(Number(rB.findings.find((f) => f.metric === "overdue_validations")!.value)).toBe(0);
  }, 60000);
});

describe("D10 monitoring engine (watch list)", () => {
  it("surfaces current risks without executing follow-up", async () => {
    const ctx = h.ctx("A");
    const m = await seedMission(h, ctx, "op"); await seedOverdue(ctx.company_id, m);
    const r = await runMonitoringSnapshot(h.db, ctx);
    expect(r.findings.every((f) => f.kind === "fact")).toBe(true);
    expect(r.watch.some((w) => /overdue/.test(w))).toBe(true);
  }, 60000);
});
