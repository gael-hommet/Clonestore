// PHASE 8.3-B3.7 — out-of-order provider events never regress the local state; unknown events
// are kept and not applied; an event for the wrong request has no effect.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, ingestWebhookEvent } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>; let provider: FakeSignatureProvider; let reqId: string; let provReqId: string; let contractId: string;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
  contractId = await readyForSignatureContract(h, owner, sd, emp);
  const sub = await S.submitContractToSignatureProvider(h.db, owner, contractId, {}, { provider, storage: sd.storage, scanner: sd.scanner });
  reqId = sub.signature_request_id; provReqId = sub.provider_request_id;
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });
const deps = () => ({ provider, storage: sd.storage, scanner: sd.scanner });
const reqStatus = async () => (await h.db.query<{ status: string }>(`select status from pierre_rt_signature_requests where id=$1`, [reqId])).rows[0].status;

describe("B3.7 event ordering", () => {
  it("a lower-rank event after a higher state is ignored (no regression)", async () => {
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "o1", eventType: "recipient.signed", requestId: reqId });
    await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(await reqStatus()).toBe("in_progress");
    // a 'recipient.sent' (lower rank) arriving late must NOT regress
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "o2", eventType: "recipient.sent", requestId: reqId });
    const r = await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(r.ignored).toBeGreaterThanOrEqual(1);
    expect(await reqStatus()).toBe("in_progress");
  });

  it("a declined arriving after a completed/signed is ignored (no regression)", async () => {
    provider.__sign(provReqId);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "o3", eventType: "request.completed", requestId: reqId });
    await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(await reqStatus()).toBe("completed");
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "o4", eventType: "request.declined", requestId: reqId });
    const r = await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(r.ignored).toBeGreaterThanOrEqual(1);
    expect(await reqStatus()).toBe("completed"); // never regressed to declined
    const c = (await h.db.query<{ ws: string }>(`select workflow_status ws from pierre_rt_employee_contracts where id=$1`, [contractId])).rows[0].ws;
    expect(c).toBe("signed");
  });

  it("an unknown provider event is kept as unknown and NOT applied", async () => {
    // 'recipient.delivered' is canonical; use a provider type that maps to nothing for fake_provider
    await h.db.query(`insert into pierre_rt_signature_events (id, company_id, signature_request_id, event_type, provider_event_id, application_status) values (gen_random_uuid(),$1,$2,'totally.unknown','u1','pending')`, [h.companyA, reqId]);
    const r = await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(r.unknown).toBeGreaterThanOrEqual(1);
    const ev = (await h.db.query<{ application_status: string }>(`select application_status from pierre_rt_signature_events where provider_event_id='u1'`)).rows[0];
    expect(ev.application_status).toBe("unknown");
    expect(await reqStatus()).toBe("submitted"); // untouched
  });
});
