// PHASE 8.5-R4 §R4.5 — NON-FORGEABLE plan identity. The database derives the canonical content hash
// ITSELF (md5 over a collation-free canonical string) and pins it to the plan fingerprint: the stored
// hash matches the TS compiler's reproduction byte-for-byte, and re-using a fingerprint with DIFFERENT
// compiled steps — a forged plan — is REFUSED by the trusted DB.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission } from "./p85-helpers";
import { createMissionRunFromPlan } from "../runtime-service";
import { compileMissionPlan, canonicalPlanContent, planContentMd5 } from "../runtime-plan-compiler";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

const plan = { steps: [
  { step_key: "a", action_key: "mission.noop" },
  { step_key: "b", action_key: "mission.noop", depends_on: ["a"] },
] };

describe("P8.5-R4 canonical plan hash (non-forgeable)", () => {
  it("the canonical content string is identical in TS and in the DB", async () => {
    const compiled = compileMissionPlan(plan);
    const tsContent = canonicalPlanContent(compiled.schema_version, compiled.steps);
    const dbContent = (await h.db.query<{ c: string }>(
      `select pierre_rt_canonical_plan_content($1, $2::jsonb) c`,
      [compiled.schema_version, JSON.stringify(compiled.steps)])).rows[0].c;
    expect(dbContent).toBe(tsContent);
    expect(createHash("md5").update(Buffer.from(dbContent, "utf8")).digest("hex")).toBe(planContentMd5(compiled.schema_version, compiled.steps));
  });

  it("the DB stores its OWN derived content hash on the plan version", async () => {
    const m = await seedMission(h, owner);
    const r = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan });
    expect(r.ok).toBe(true);
    const compiled = compileMissionPlan(plan);
    const stored = (await h.db.query<{ plan_content_md5: string; plan_fingerprint: string }>(
      `select plan_content_md5, plan_fingerprint from pierre_rt_mission_plan_versions where id=$1`, [r.plan_version_id])).rows[0];
    expect(stored.plan_content_md5).toBe(planContentMd5(compiled.schema_version, compiled.steps));
    expect(stored.plan_fingerprint).toBe(compiled.plan_fingerprint);
  });

  it("re-using a fingerprint with DIFFERENT steps is refused (forged plan)", async () => {
    const m = await seedMission(h, owner);
    const compiled = compileMissionPlan(plan);
    // honest creation first
    await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan });
    // now forge: call the governed creator directly under the planner role, same fingerprint, DIFFERENT steps
    const forgedSteps = JSON.stringify([{ step_key: "x", action_key: "mission.noop", action_version: "1", step_ordinal: 0, input: {}, input_hash: "deadbeef", dependency_count: 0 }]);
    const attempt = h.db.transaction(async (tx) => {
      await tx.query(`set local role pierre_rt_runtime_planner`);
      await tx.query(`select set_config('app.current_company', $1, true)`, [owner.company_id]);
      return tx.query(
        `select * from pierre_rt_create_compiled_mission_run($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,null,'normal')`,
        [owner.company_id, m, compiled.schema_version, compiled.plan_fingerprint, JSON.stringify(plan), "{}", forgedSteps, "[]", owner.user_id]);
    });
    await expect(attempt).rejects.toThrow(/content hash mismatch|forged/i);
  });

  it("re-using the SAME fingerprint with the SAME steps is idempotent (not a forge)", async () => {
    const m = await seedMission(h, owner);
    const r1 = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan });
    const r2 = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan });
    expect(r2.ok).toBe(true);
    expect(r2.plan_version_id).toBe(r1.plan_version_id); // same immutable version, no forge raised
  });
});
