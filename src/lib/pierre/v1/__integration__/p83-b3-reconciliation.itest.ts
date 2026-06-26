// PHASE 8.3-B3.11 — reconciliation recovers missed webhooks (never creating a second provider
// request) and dead-letters after the retry bound.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
const sd = () => ({ storage, scanner, deps: () => ({ storage, scanner }) });
const deps = () => ({ provider, storage, scanner });
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await h.close(); });
async function submitted() { const cid = await readyForSignatureContract(h, owner, sd() as never, emp); const sub = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, deps()); return { cid, reqId: sub.signature_request_id, provReqId: sub.provider_request_id }; }

describe("B3.11 reconciliation", () => {
  it("a missed 'completed' webhook is recovered by reconciliation (and signs the contract)", async () => {
    const { cid, provReqId } = await submitted();
    provider.__sign(provReqId); // provider completed, but NO webhook arrived
    const r = await S.reconcileSignatureRequests(h.db, owner, {}, deps());
    expect(r.finalized).toBe(1);
    const c = (await h.db.query<{ ws: string }>(`select workflow_status ws from pierre_rt_employee_contracts where id=$1`, [cid])).rows[0].ws;
    expect(c).toBe("signed");
  });

  it("reconciliation NEVER creates a second provider request", async () => {
    const { reqId } = await submitted();
    const before = (await h.db.query<{ prid: string }>(`select provider_request_id prid from pierre_rt_signature_requests where id=$1`, [reqId])).rows[0].prid;
    await S.reconcileSignatureRequests(h.db, owner, {}, deps());
    const after = (await h.db.query<{ prid: string }>(`select provider_request_id prid from pierre_rt_signature_requests where id=$1`, [reqId])).rows[0].prid;
    expect(after).toBe(before); // unchanged — no new request
  });

  it("repeated finalization failure dead-letters after the retry bound", async () => {
    const { reqId, provReqId } = await submitted();
    provider.__sign(provReqId); provider.__corruptSigned(provReqId); // provider 'done' but the signed doc is infected
    let dead = false;
    for (let i = 0; i < 6 && !dead; i++) {
      await S.reconcileSignatureRequests(h.db, owner, {}, deps());
      const row = (await h.db.query<{ reconcile_status: string; retry_count: number }>(`select reconcile_status, retry_count from pierre_rt_signature_requests where id=$1`, [reqId])).rows[0];
      dead = row.reconcile_status === "dead_letter";
    }
    const row = (await h.db.query<{ reconcile_status: string; dead_letter_reason: string }>(`select reconcile_status, dead_letter_reason from pierre_rt_signature_requests where id=$1`, [reqId])).rows[0];
    expect(row.reconcile_status).toBe("dead_letter");
    expect(row.dead_letter_reason).toBe("max_retries_exceeded");
    const c = (await h.db.query<{ ws: string }>(`select c.workflow_status ws from pierre_rt_employee_contracts c join pierre_rt_signature_requests sr on sr.document_id=c.document_id where sr.id=$1`, [reqId])).rows[0];
    expect(c.ws).not.toBe("signed"); // never falsely signed
  });
});
