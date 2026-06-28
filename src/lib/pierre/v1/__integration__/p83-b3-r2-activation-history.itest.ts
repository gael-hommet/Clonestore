// PHASE 8.3-B3-R2.10 — applying an amendment writes an APPEND-ONLY structured effect-history row
// per allowlisted change (previous → new value), linked to the signed amendment. The history is
// tenant-safe and append-only (update/delete refused). No free clause is ever interpreted.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as C from "../contracts";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
const sdLike = () => ({ storage, scanner });
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await h.close(); });

async function activatedAmendment(effects: Record<string, string | null>): Promise<{ amendmentId: string; employeeId: string }> {
  const employeeId = await seedEmployee(h, h.companyA, { email: `e${Math.random().toString(36).slice(2, 8)}@acme.test`, role_title: "Ingénieure" });
  const parent = await C.createGovernedContract(h.db, owner, { employee_id: employeeId, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, parent.id);
  const amd = await C.createContractAmendment(h.db, owner, parent.id, { reason: "raise", effective_from: "2026-03-01", effects });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  await S.activateSignedAmendment(h.db, owner, amd.id, { as_of: "2026-06-27" }); // past-dated → applied now
  return { amendmentId: amd.id, employeeId };
}

describe("B3-R2.10 append-only effect history", () => {
  it("records one history row per allowlisted change with previous → new values", async () => {
    const { amendmentId, employeeId } = await activatedAmendment({ "employment.role_title": "Lead Engineer", "employment.weekly_hours": "39" });
    const rows = (await h.db.query<{ field_key: string; previous_value: string | null; new_value: string | null; amendment_contract_id: string; employee_id: string }>(`select field_key, previous_value, new_value, amendment_contract_id, employee_id from pierre_rt_contract_effect_history where company_id=$1 and amendment_contract_id=$2 order by field_key`, [h.companyA, amendmentId])).rows;
    expect(rows.length).toBe(2);
    const role = rows.find((r) => r.field_key === "employment.role_title");
    expect(role).toMatchObject({ previous_value: "Ingénieure", new_value: "Lead Engineer", amendment_contract_id: amendmentId, employee_id: employeeId });
    const hours = rows.find((r) => r.field_key === "employment.weekly_hours");
    expect(hours).toMatchObject({ previous_value: null, new_value: "39" }); // no prior structured value
  });
  it("the history is append-only (update/delete refused, any role)", async () => {
    const { amendmentId } = await activatedAmendment({ "employment.role_title": "Architect" });
    await expect(h.db.query(`update pierre_rt_contract_effect_history set new_value='hacked' where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amendmentId])).rejects.toThrow(/append-only/i);
    await expect(h.db.query(`delete from pierre_rt_contract_effect_history where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amendmentId])).rejects.toThrow(/append-only/i);
  });
  it("only allowlisted fields are ever written (a free clause is never recorded)", async () => {
    const { amendmentId } = await activatedAmendment({ "employment.salary": "62000", "clause.free": "a pony" });
    const fields = (await h.db.query<{ field_key: string }>(`select field_key from pierre_rt_contract_effect_history where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amendmentId])).rows.map((r) => r.field_key);
    expect(fields).toEqual(["employment.salary"]);
  });
});
