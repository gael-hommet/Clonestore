// PHASE 8.3-B2G-R1.10 — behavioural proof of the storage compensation: a failure after the
// artifacts are persisted but before the DB link commits rolls back the DB and removes the
// orphaned objects; no usable artifact, no document version, no `contract.generated` event. A
// failure DURING compensation still surfaces the primary error and audits the incident.
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
const fresh = async () => (await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" })).id;

describe("R1.10 storage compensation", () => {
  it("a failure before commit rolls back the DB and deletes the orphaned artifacts", async () => {
    const id = await fresh();
    await expect(C.generateContract(h.db, owner, id, { field_values: { "employment.weekly_hours": "35" } }, { ...sd.deps(), __failBeforeCommit: true })).rejects.toThrow(/before commit/);
    // no document version linked, contract unchanged
    const dv = (await h.db.query<{ document_version_id: string | null }>(`select document_version_id from pierre_rt_employee_contract_versions where contract_id=$1`, [id])).rows[0].document_version_id;
    expect(dv).toBeNull();
    const docs = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_versions where company_id=$1`, [h.companyA])).rows[0].n;
    expect(docs).toBe(0);
    // files are marked deleted and their objects removed from storage → no usable artifact
    const files = (await h.db.query<{ id: string; object_key: string; upload_status: string }>(`select id, object_key, upload_status from pierre_rt_files where company_id=$1`, [h.companyA])).rows;
    for (const f of files) {
      expect(f.upload_status).toBe("deleted");
      expect(await sd.storage.objectExists(f.object_key)).toBe(false);
    }
    // no contract.generated event in audit / outbox
    const gen = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.generated'`, [id])).rows[0].n;
    const ob = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='contract.generated'`, [h.companyA])).rows[0].n;
    expect(gen).toBe(0);
    expect(ob).toBe(0);
  });

  it("a failure DURING compensation still throws the primary error and audits the incident", async () => {
    const id = await fresh();
    await expect(C.generateContract(h.db, owner, id, { field_values: { "employment.weekly_hours": "35" } }, { ...sd.deps(), __failBeforeCommit: true, __failCompensation: true })).rejects.toThrow(/before commit/);
    // the incident is audited (best-effort), never a false success
    const incident = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.generation_blocked' and reason like 'storage_compensation_failed%'`, [id])).rows[0].n;
    expect(incident).toBeGreaterThanOrEqual(1);
    // still no usable generated contract
    const gen = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.generated'`, [id])).rows[0].n;
    expect(gen).toBe(0);
  });
});
