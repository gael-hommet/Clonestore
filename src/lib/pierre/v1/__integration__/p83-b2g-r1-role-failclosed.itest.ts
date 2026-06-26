// PHASE 8.3-B2G-R1.2 — contract role checks are fail-closed: absent/empty/unknown role refused;
// permission and role are BOTH required and neither substitutes the other.
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
const create = (ctx: TenantContext) => C.createGovernedContract(h.db, ctx, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });

describe("R1.2 contract role fail-closed", () => {
  it("an empty role set is refused", async () => {
    await expect(create({ ...owner, role_keys: [] })).rejects.toMatchObject({ code: "forbidden" });
  });
  it("an undefined role set is refused", async () => {
    await expect(create({ ...owner, role_keys: undefined as never })).rejects.toMatchObject({ code: "forbidden" });
  });
  it("an unknown / ineligible role is refused even WITH the base permission", async () => {
    await expect(create({ ...owner, role_keys: ["AUDITOR"] })).rejects.toMatchObject({ code: "forbidden" });
  });
  it("a valid create role WITHOUT the base permission is refused", async () => {
    await expect(create({ ...owner, role_keys: ["HR_OPERATOR"], permissions: ["document.read"] })).rejects.toMatchObject({ code: "forbidden" });
  });
  it("a valid role AND permission is accepted", async () => {
    const c = await create({ ...owner, role_keys: ["HR_OPERATOR"] });
    expect(c.id).toBeTruthy();
  });
  it("approval is fail-closed too: empty role refused; permission alone is not enough", async () => {
    const c = await create(owner);
    await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c.id);
    await expect(C.approveContract(h.db, { ...owner, role_keys: [] }, c.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(C.approveContract(h.db, { ...owner, role_keys: ["HR_OPERATOR"] }, c.id)).rejects.toMatchObject({ code: "forbidden" }); // HR_OPERATOR can't approve
  });
});
