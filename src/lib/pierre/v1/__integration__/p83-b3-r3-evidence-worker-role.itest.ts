// PHASE 8.3-B3-R3.3 — only the specialized worker role records a proof. The general application
// role can neither raw-INSERT an artifact NOR execute the governed function; the dedicated
// pierre_rt_signature_worker role can execute it.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import { newUuid } from "../sql";
import * as C from "../contracts";

let h: Harness; let ownerA: TenantContext; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
beforeEach(async () => {
  h = await createHarness();
  ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
});
afterEach(async () => { await h.close(); });

async function signed(): Promise<{ requestId: string; fileId: string; evidenceId: string }> {
  const emp = await seedEmployee(h, h.companyA, { email: `e${newUuid().slice(0, 6)}@acme.test` });
  await publishContractTemplate(h, ownerA); await configureSignatory(h, h.companyA);
  const c = await C.createGovernedContract(h.db, ownerA, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  const { signature_request_id } = await signExistingContract(h, ownerA, { storage, scanner }, provider, c.id);
  const sd = (await h.db.query<{ file_id: string }>(`select file_id from pierre_rt_signature_evidence_artifacts where company_id=$1 and signature_request_id=$2 and artifact_type='signed_document'`, [h.companyA, signature_request_id])).rows[0];
  const ev = (await h.db.query<{ id: string }>(`select id from pierre_rt_signature_evidence where company_id=$1 and signature_request_id=$2`, [h.companyA, signature_request_id])).rows[0];
  return { requestId: signature_request_id, fileId: sd.file_id, evidenceId: ev.id };
}

describe("B3-R3.3 evidence write role", () => {
  it("the app role canNOT raw-INSERT an artifact", async () => {
    const s = await signed();
    await h.pg.exec("set role pierre_rt_app");
    try {
      await expect(h.pg.query(`insert into pierre_rt_signature_evidence_artifacts (id, company_id, signature_request_id, artifact_type, file_id, sha256) values (gen_random_uuid(),$1,$2,'certificate',$3,$4)`, [h.companyA, s.requestId, s.fileId, "a".repeat(64)])).rejects.toThrow(/permission denied/i);
    } finally { await h.pg.exec("reset role"); }
  });
  it("the app role canNOT EXECUTE the governed record function", async () => {
    const s = await signed();
    await h.pg.exec("set role pierre_rt_app");
    try {
      await h.pg.query(`select set_config('app.current_company',$1,true)`, [h.companyA]);
      await expect(h.pg.query(`select pierre_rt_record_signature_evidence_artifact($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, s.requestId, s.evidenceId, "certificate", null, s.fileId, null])).rejects.toThrow(/permission denied/i);
    } finally { await h.pg.exec("reset role"); }
  });
  it("the specialized pierre_rt_signature_worker role CAN execute the governed record function", async () => {
    const s = await signed();
    const out = await h.db.transaction(async (tx) => {
      await tx.query("set local role pierre_rt_signature_worker");
      await tx.query(`select set_config('app.current_company',$1,true)`, [h.companyA]);
      return (await tx.query<{ status: string }>(`select status from pierre_rt_record_signature_evidence_artifact($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, s.requestId, s.evidenceId, "certificate", null, s.fileId, null])).rows[0].status;
    });
    expect(out).toBe("recorded");
  });
});
