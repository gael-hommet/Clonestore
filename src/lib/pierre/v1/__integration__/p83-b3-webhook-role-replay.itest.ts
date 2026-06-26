// PHASE 8.3-B3.5 — the signature webhook path is least-privilege + anti-replay. The ingress
// role can only call the governed functions (no raw business writes); replays are idempotent;
// the same event id with a different payload is a conflict.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import type { SqlExecutor } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import { receiveSignatureWebhook } from "../signatures";
import { WebhookError } from "../signature-webhooks";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>; let provider: FakeSignatureProvider; let reqId: string; let provReqId: string;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps(); provider = new FakeSignatureProvider({ providerKey: "fake_provider", secret: "wh-secret" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
  const cid = await readyForSignatureContract(h, owner, sd, emp);
  const sub = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, { provider, storage: sd.storage, scanner: sd.scanner });
  reqId = sub.signature_request_id; provReqId = sub.provider_request_id;
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

// An executor bound to the minimal webhook-ingress role.
function ingressExec(): SqlExecutor {
  const exec: SqlExecutor = {
    async query(text: string, params?: readonly unknown[]) { await h.pg.exec("set role pierre_rt_webhook_ingress"); await h.pg.exec("select set_config('app.allow_test_provider','true',false)"); try { const r = await h.pg.query(text, params ? [...params] : undefined); return { rows: r.rows as never[] }; } finally { await h.pg.exec("reset role"); } },
    transaction: (fn) => fn(exec),
  };
  return exec;
}

describe("B3.5 webhook role + replay", () => {
  it("the ingress role cannot raw-write signature_events / signature_requests / documents", async () => {
    const ex = ingressExec();
    await expect(ex.query(`insert into pierre_rt_signature_events (id, company_id, signature_request_id, event_type) values ($1,$2,$3,'x')`, [newUuid(), h.companyA, reqId])).rejects.toThrow(/permission denied/i);
    await expect(ex.query(`update pierre_rt_signature_requests set status='completed' where id=$1`, [reqId])).rejects.toThrow(/permission denied/i);
    await expect(ex.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'employment_contract','T')`, [newUuid(), h.companyA])).rejects.toThrow(/permission denied/i);
  });

  it("a verified webhook is ingested via the governed path and enqueues exactly one event; a replay is idempotent", async () => {
    const ev = provider.__makeWebhookBody({ event_id: "e-1", event_type: "request.activated", request_id: provReqId });
    const r1 = await receiveSignatureWebhook(ingressExec(), { provider: "fake_provider", raw_body: ev.body, signature_header: ev.signature, secret: "wh-secret", providerInstance: provider });
    expect(r1.status).toBe("received");
    const r2 = await receiveSignatureWebhook(ingressExec(), { provider: "fake_provider", raw_body: ev.body, signature_header: ev.signature, secret: "wh-secret", providerInstance: provider });
    expect(r2.status).toBe("duplicate");
    const n = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_events where signature_request_id=$1 and provider_event_id='e-1'`, [reqId])).rows[0].n;
    expect(n).toBe(1);
  });

  it("an invalid signature is refused before any DB write", async () => {
    const ev = provider.__makeWebhookBody({ event_id: "e-2", event_type: "request.activated", request_id: provReqId });
    await expect(receiveSignatureWebhook(ingressExec(), { provider: "fake_provider", raw_body: ev.body, signature_header: "sha256=bad", secret: "wh-secret", providerInstance: provider })).rejects.toThrow(/invalid signature/);
    const n = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_webhooks where company_id=$1`, [h.companyA])).rows[0].n;
    expect(n).toBe(0);
  });

  it("the same event id with a DIFFERENT payload is a conflict", async () => {
    const a = provider.__makeWebhookBody({ event_id: "e-3", event_type: "request.activated", request_id: provReqId });
    await receiveSignatureWebhook(ingressExec(), { provider: "fake_provider", raw_body: a.body, signature_header: a.signature, secret: "wh-secret", providerInstance: provider });
    const b = provider.__makeWebhookBody({ event_id: "e-3", event_type: "recipient.signed", request_id: provReqId });
    await expect(receiveSignatureWebhook(ingressExec(), { provider: "fake_provider", raw_body: b.body, signature_header: b.signature, secret: "wh-secret", providerInstance: provider })).rejects.toMatchObject({ code: "webhook_replay_conflict" });
    expect(WebhookError).toBeDefined();
  });
});
