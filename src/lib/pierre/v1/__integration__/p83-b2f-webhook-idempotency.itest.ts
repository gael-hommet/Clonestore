// src/lib/pierre/v1/__integration__/p83-b2f-webhook-idempotency.itest.ts
// PHASE 8.3-B2F §3 — webhook idempotency & replay protection. The same (provider, event id)
// with the same payload is idempotent (one row, status "duplicate"); the same event id with
// a DIFFERENT payload is a replay attack and is rejected; a distinct event id is a new row.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import type { SqlExecutor } from "../sql";
import { ingestSignatureWebhook, WebhookError } from "../signature-webhooks";

let h: Harness; let reqA: string;
const SECRET = "test-webhook-secret";
beforeEach(async () => {
  h = await createHarness();
  const doc = newUuid(), ver = newUuid(); reqA = newUuid();
  await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'work_certificate','T')`, [doc, h.companyA]);
  await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number) values ($1,$2,$3,1)`, [ver, h.companyA, doc]);
  await h.db.query(`insert into pierre_rt_signature_requests (id, company_id, document_id, document_version_id, status, idempotency_key) values ($1,$2,$3,$4,'submitted',$5)`, [reqA, h.companyA, doc, ver, newUuid()]);
});
afterEach(async () => { if (h) await h.close(); });

function ingressExecutor(): SqlExecutor {
  const exec: SqlExecutor = {
    async query(text: string, params?: readonly unknown[]) {
      await h.pg.exec("set role pierre_rt_webhook_ingress");
      try { const r = await h.pg.query(text, params ? [...params] : undefined); return { rows: r.rows as never[] }; }
      finally { await h.pg.exec("reset role"); }
    },
    transaction: (fn) => fn(exec),
  };
  return exec;
}
const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
const send = (eventId: string, body: string) => ingestSignatureWebhook(ingressExecutor(), { provider: "internal_sandbox", event_id: eventId, event_type: "signature.completed", raw_body: body, signature_header: sign(body), secret: SECRET, signature_request_id: reqA });

describe("§3 webhook idempotency & replay", () => {
  it("the same event with the same payload is idempotent (one row, duplicate)", async () => {
    const body = JSON.stringify({ a: 1 });
    const first = await send("evt-dup", body);
    const second = await send("evt-dup", body);
    expect(first.status).toBe("received");
    expect(second.status).toBe("duplicate");
    expect(second.webhook_id).toBe(first.webhook_id);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_webhooks where provider_event_id='evt-dup'`);
    expect(n.rows[0].n).toBe(1);
  });

  it("the same event id with a different payload is rejected as a replay (409)", async () => {
    await send("evt-replay", JSON.stringify({ a: 1 }));
    await expect(send("evt-replay", JSON.stringify({ a: 2 }))).rejects.toMatchObject({ code: "webhook_replay_conflict", status: 409 });
    expect(WebhookError).toBeDefined();
  });

  it("a distinct event id creates a new row", async () => {
    await send("evt-A", JSON.stringify({ a: 1 }));
    await send("evt-B", JSON.stringify({ a: 1 }));
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_webhooks`);
    expect(n.rows[0].n).toBe(2);
  });
});
