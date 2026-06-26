// src/lib/pierre/v1/__integration__/p83-b2f-webhook-runtime-role.itest.ts
// PHASE 8.3-B2F §3 — a public signature webhook is verified (HMAC), provider/size checked,
// and ingested ONLY through the governed SECURITY DEFINER function via the minimal-privilege
// pierre_rt_webhook_ingress role. The role cannot raw-write any table; the general app role
// cannot call the function; the tenant is DERIVED from the request, never from the payload.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import type { SqlExecutor } from "../sql";
import { ingestSignatureWebhook, WebhookSignatureError, WebhookProviderError, WebhookPayloadError } from "../signature-webhooks";

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

// An executor bound to the minimal-privilege webhook role (single PGlite connection ⇒ role
// is set per query and reset afterwards).
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

describe("§3 webhook runtime-role path", () => {
  it("a valid signed webhook is ingested through the governed function; tenant is derived from the request", async () => {
    const body = JSON.stringify({ event: "signature.completed", company_id: "FORGED-DOES-NOT-MATTER" });
    const res = await ingestSignatureWebhook(ingressExecutor(), {
      provider: "internal_sandbox", event_id: "evt-1", event_type: "signature.completed",
      raw_body: body, signature_header: sign(body), secret: SECRET, signature_request_id: reqA,
    });
    expect(res.status).toBe("received");
    expect(res.company_id).toBe(h.companyA); // derived from reqA, NOT the forged payload value
  });

  it("an unsigned or wrongly-signed webhook is refused before any DB write", async () => {
    const body = JSON.stringify({ event: "signature.completed" });
    await expect(ingestSignatureWebhook(ingressExecutor(), { provider: "internal_sandbox", event_id: "e2", event_type: "signature.completed", raw_body: body, signature_header: null, secret: SECRET, signature_request_id: reqA }))
      .rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(ingestSignatureWebhook(ingressExecutor(), { provider: "internal_sandbox", event_id: "e2", event_type: "signature.completed", raw_body: body, signature_header: "sha256=deadbeef", secret: SECRET, signature_request_id: reqA }))
      .rejects.toBeInstanceOf(WebhookSignatureError);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_webhooks`);
    expect(n.rows[0].n).toBe(0); // nothing written
  });

  it("an unknown provider and an oversize payload are refused", async () => {
    const body = JSON.stringify({ event: "x" });
    await expect(ingestSignatureWebhook(ingressExecutor(), { provider: "evilcorp", event_id: "e3", event_type: "x", raw_body: body, signature_header: sign(body), secret: SECRET, signature_request_id: reqA }))
      .rejects.toBeInstanceOf(WebhookProviderError);
    const huge = "x".repeat(1024 * 1024 + 10);
    await expect(ingestSignatureWebhook(ingressExecutor(), { provider: "internal_sandbox", event_id: "e4", event_type: "signature.completed", raw_body: huge, signature_header: sign(huge), secret: SECRET, signature_request_id: reqA }))
      .rejects.toBeInstanceOf(WebhookPayloadError);
  });

  it("the webhook role cannot raw-write the webhook table or any business table", async () => {
    const ex = ingressExecutor();
    await expect(ex.query(`insert into pierre_rt_signature_webhooks (id, provider, provider_event_id) values ($1,'x','y')`, [newUuid()])).rejects.toThrow(/permission denied/i);
    await expect(ex.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'work_certificate','T')`, [newUuid(), h.companyA])).rejects.toThrow(/permission denied/i);
  });

  it("the general application role cannot execute the governed function", async () => {
    const appExec: SqlExecutor = {
      async query(text: string, params?: readonly unknown[]) {
        await h.pg.exec("set role pierre_rt_app");
        try { const r = await h.pg.query(text, params ? [...params] : undefined); return { rows: r.rows as never[] }; }
        finally { await h.pg.exec("reset role"); }
      },
      transaction(fn) { return fn(this); },
    };
    await expect(appExec.query(`select pierre_rt_ingest_signature_webhook($1,$2,$3,$4,$5,$6,$7,$8,$9)`, ["internal_sandbox", "e9", "signature.completed", "h", 10, reqA, null, true, null]))
      .rejects.toThrow(/permission denied/i);
  });
});
