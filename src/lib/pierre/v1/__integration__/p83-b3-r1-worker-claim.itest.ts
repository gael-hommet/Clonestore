// PHASE 8.3-B3-R1.10 — worker lease / concurrency. The governed claim function
// (pierre_rt_claim_signature_events) uses FOR UPDATE SKIP LOCKED so two workers claiming the same
// company get DISJOINT batches; an expired lease is reclaimable; and the completed-event
// finalization runs exactly once (no double download / version / evidence). NOTE: PGlite is a
// single in-process connection, so "concurrency" here is proven LOGICALLY (claim exclusivity +
// lease semantics), not via OS-level parallel connections — an honest, documented caveat.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, ingestWebhookEvent } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>; let provider: FakeSignatureProvider;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });
const deps = () => ({ provider, storage: sd.storage, scanner: sd.scanner });

async function submitted(): Promise<{ reqId: string; provReqId: string }> {
  const cid = await readyForSignatureContract(h, owner, sd, emp);
  const sub = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, deps());
  return { reqId: sub.signature_request_id, provReqId: sub.provider_request_id };
}
// R2.4 — the claim is tenant-bound: it derives the tenant from app.current_company, so the
// caller MUST bind the session tenant. A bare call (no binding) is refused by the function.
async function claim(worker: string, limit = 10, lease = 60): Promise<string[]> {
  return h.db.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [h.companyA]);
    const r = await tx.query<{ id: string }>(`select id from pierre_rt_claim_signature_events($1,$2,$3,$4)`, [h.companyA, limit, worker, lease]);
    return r.rows.map((x) => x.id);
  });
}

describe("B3-R1.10 worker lease + concurrency", () => {
  it("two workers claiming the same company get DISJOINT batches (one wins each event)", async () => {
    const { reqId, provReqId } = await submitted();
    provider.__sign(provReqId);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "evt-a", eventType: "recipient.signed", requestId: reqId });
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "evt-b", eventType: "request.completed", requestId: reqId });

    const w1 = await claim("worker-1");
    const w2 = await claim("worker-2");
    expect(w1.length).toBeGreaterThan(0);
    expect(w2.length).toBe(0); // worker-2 sees nothing — worker-1 holds the lease
    expect(new Set([...w1, ...w2]).size).toBe(w1.length + w2.length); // disjoint
  });

  it("an EXPIRED lease becomes reclaimable by another worker", async () => {
    const { reqId, provReqId } = await submitted();
    provider.__sign(provReqId);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "evt-x", eventType: "request.completed", requestId: reqId });
    const w1 = await claim("worker-1", 10, 60);
    expect(w1.length).toBe(1);
    // worker-1 crashes; force its lease into the past
    await h.db.query(`update pierre_rt_signature_events set lease_expires_at = now() - interval '1 minute' where company_id=$1`, [h.companyA]);
    const w2 = await claim("worker-2", 10, 60);
    expect(w2).toEqual(w1); // worker-2 reclaims the same (expired) event
    const lockedBy = (await h.db.query<{ locked_by: string }>(`select locked_by from pierre_rt_signature_events where company_id=$1 and id=$2`, [h.companyA, w1[0]])).rows[0].locked_by;
    expect(lockedBy).toBe("worker-2");
  });

  it("finalization of the completed event runs exactly ONCE (no double download / version / evidence)", async () => {
    const { reqId, provReqId } = await submitted();
    provider.__sign(provReqId);
    // count real downloads through the provider
    let downloads = 0;
    const origDl = provider.downloadSignedDocument.bind(provider);
    provider.downloadSignedDocument = async (id: string) => { downloads += 1; return origDl(id); };
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "done-1", eventType: "request.completed", requestId: reqId });

    // worker A drains the queue; worker B then finds nothing pending
    const a = await S.processPendingSignatureEvents(h.db, owner, { worker: "A" }, deps());
    const b = await S.processPendingSignatureEvents(h.db, owner, { worker: "B" }, deps());
    expect(a.finalized).toBe(1);
    expect(b.processed).toBe(0); // B claims nothing — A already applied + released as 'done'
    expect(downloads).toBe(1); // exactly one signed-document download

    // exactly one signed version + one evidence row + the request is completed once
    const versions = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_versions dv join pierre_rt_signature_requests sr on sr.signed_document_version_id=dv.id where sr.company_id=$1 and sr.id=$2`, [h.companyA, reqId])).rows[0].n;
    expect(versions).toBe(1);
    const evRows = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_evidence where company_id=$1 and signature_request_id=$2`, [h.companyA, reqId])).rows[0].n;
    expect(evRows).toBe(1);
    const status = (await h.db.query<{ status: string }>(`select status from pierre_rt_signature_requests where company_id=$1 and id=$2`, [h.companyA, reqId])).rows[0].status;
    expect(status).toBe("completed");
  });

  it("a processed event is marked done and released (processing_status=done, lease cleared)", async () => {
    const { reqId, provReqId } = await submitted();
    provider.__sign(provReqId);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "done-2", eventType: "request.completed", requestId: reqId });
    await S.processPendingSignatureEvents(h.db, owner, { worker: "A" }, deps());
    const row = (await h.db.query<{ processing_status: string; locked_by: string | null; lease_expires_at: string | null }>(`select processing_status, locked_by, lease_expires_at from pierre_rt_signature_events where company_id=$1 and signature_request_id=$2 order by occurred_at desc limit 1`, [h.companyA, reqId])).rows[0];
    expect(row.processing_status).toBe("done");
    expect(row.locked_by).toBeNull();
    expect(row.lease_expires_at).toBeNull();
  });
});
