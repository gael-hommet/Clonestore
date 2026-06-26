// PHASE 8.3-B2G-R1.5 — real signature recipients from real data; fail closed when an email is
// missing; never an employee_id as a recipient; no PII leaked into audit/outbox.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory } from "./b2g-helpers";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  await publishContractTemplate(h, owner); // also configures a signatory
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

async function readyContract(empOver: Record<string, string | null> = {}): Promise<string> {
  const emp = await seedEmployee(h, h.companyA, empOver);
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  await C.submitContractForReview(h.db, owner, c.id);
  await C.approveContract(h.db, owner, c.id);
  await C.finalizeContract(h.db, owner, c.id);
  return c.id;
}

describe("R1.5 real signature recipients", () => {
  it("creates two real recipients (employer + employee) with real emails and signing order", async () => {
    const id = await readyContract({ email: "ada@acme.test" });
    const prep = await C.prepareContractSignature(h.db, owner, id);
    expect(prep.recipients.map((r) => r.email).sort()).toEqual(["ada@acme.test", "hr@acme.test"]);
    expect(prep.recipients.find((r) => r.role === "employee")!.email).toBe("ada@acme.test");
    expect(prep.recipients.find((r) => r.role === "employer")!.email).toBe("hr@acme.test");
    // real rows persisted, tenant-scoped
    const rows = (await h.db.query<{ email: string; role: string; signing_order: number }>(`select email, role, signing_order from pierre_rt_signature_recipients where company_id=$1 and signature_request_id=$2 order by signing_order`, [h.companyA, prep.signature_request_id])).rows;
    expect(rows.length).toBe(2);
    expect(rows[0].role).toBe("employer");
    // NEVER an employee_id used as a recipient identifier
    for (const r of rows) expect(r.email).toMatch(/@/);
  });

  it("fails closed when the employee has no valid email", async () => {
    const id = await readyContract({ email: null });
    await expect(C.prepareContractSignature(h.db, owner, id)).rejects.toMatchObject({ code: "validation_failed" });
    const n = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_recipients where company_id=$1`, [h.companyA])).rows[0].n;
    expect(n).toBe(0); // nothing created
  });

  it("fails closed when the employer signatory is not configured", async () => {
    await configureSignatory(h, h.companyA, null); // clear the employer signatory
    const id = await readyContract({ email: "ada@acme.test" });
    await expect(C.prepareContractSignature(h.db, owner, id)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("the audit/outbox carry no recipient PII (only ids + status)", async () => {
    const id = await readyContract({ email: "ada@acme.test" });
    await C.prepareContractSignature(h.db, owner, id);
    const audit = JSON.stringify((await h.db.query(`select detail from pierre_rt_document_access_log where company_id=$1 and action='contract.signature_prepared'`, [h.companyA])).rows);
    const outbox = JSON.stringify((await h.db.query(`select payload from pierre_rt_outbox where company_id=$1 and kind='contract.signature_prepared'`, [h.companyA])).rows);
    expect(audit).not.toContain("ada@acme.test");
    expect(outbox).not.toContain("ada@acme.test");
    expect(outbox).not.toContain("hr@acme.test");
  });
});
