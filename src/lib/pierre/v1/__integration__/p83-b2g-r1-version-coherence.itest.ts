// PHASE 8.3-B2G-R1.7 — a new contract version is only allowed while the contract is modifiable;
// no contract can be `final` (etc.) with a `draft` current version.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

async function mk(status: "draft" | "under_review" | "approved" | "final"): Promise<string> {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  if (status === "draft") return c.id;
  await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  await C.submitContractForReview(h.db, owner, c.id);
  if (status === "under_review") return c.id;
  await C.approveContract(h.db, owner, c.id);
  if (status === "approved") return c.id;
  await C.finalizeContract(h.db, owner, c.id);
  return c.id;
}

describe("R1.7 version coherence", () => {
  it("a new version is allowed on draft and changes_requested only", async () => {
    const draft = await mk("draft");
    const v = await C.createContractVersion(h.db, owner, draft, { effective_from: "2026-02-01" });
    expect(v.version).toBe(2);
  });

  it("a new version is refused on under_review / approved / final", async () => {
    for (const s of ["under_review", "approved", "final"] as const) {
      const id = await mk(s);
      await expect(C.createContractVersion(h.db, owner, id, { effective_from: "2026-02-01" })).rejects.toMatchObject({ code: "conflict" });
    }
  });

  it("no contract is ever `final` with a `draft` current version", async () => {
    const id = await mk("final");
    const row = (await h.db.query<{ ws: string; cv: number }>(`select c.workflow_status ws, c.current_version cv from pierre_rt_employee_contracts c where c.id=$1`, [id])).rows[0];
    const headStatus = (await h.db.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contract_versions where contract_id=$1 and version=$2`, [id, row.cv])).rows[0].workflow_status;
    expect(row.ws).toBe("final");
    expect(headStatus).toBe("final"); // never draft
  });

  it("reopening (request-changes) then a new version resets the contract to draft", async () => {
    const id = await mk("approved");
    await C.requestContractChanges(h.db, owner, id);
    await C.createContractVersion(h.db, owner, id, { effective_from: "2026-02-01" });
    const ws = (await h.db.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where id=$1`, [id])).rows[0].workflow_status;
    expect(ws).toBe("draft");
  });
});
