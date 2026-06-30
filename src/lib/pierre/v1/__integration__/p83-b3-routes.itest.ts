// PHASE 8.3-B3.12 — real route handlers: authenticated signature routes + the public webhook.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, provisionActiveCompany, type Harness } from "./harness";
import { newUuid, type SqlExecutor } from "../sql";
import { resolveTenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, signExistingContract } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";

let mockUser: { id: string } | null = null;
let mockDb: SqlExecutor;
vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => ({ auth: { getUser: async () => ({ data: { user: mockUser } }) } }) }));
vi.mock("@/lib/pierre/v1/db", () => ({ getRuntimeDb: async () => mockDb }));
// the webhook route builds an ingress-bound executor — bind it to the harness pg as the ingress role
let ingressDb: SqlExecutor;
vi.mock("@/lib/pierre/v1/signature-webhooks", async (orig) => {
  const actual = await orig() as Record<string, unknown>;
  return { ...actual, createWebhookExecutor: async () => ingressDb };
});

const { GET: getSignature } = await import("@/app/api/pierre/v1/contracts/[id]/signature/route");
const { POST: reconcile } = await import("@/app/api/pierre/v1/signatures/reconcile/route");
const { POST: webhook } = await import("@/app/api/webhooks/pierre/signature/route");

let h: Harness; let provider: FakeSignatureProvider; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness(); mockDb = h.db;
  await provisionActiveCompany(h, h.companyA);
  await provisionActiveCompany(h, h.companyB);
  provider = new FakeSignatureProvider({ providerKey: "fake_provider", secret: "wh-secret" });
  sd = storageDeps();
  ingressDb = { async query(t: string, p?: readonly unknown[]) { await h.pg.exec("set role pierre_rt_webhook_ingress"); await h.pg.exec("select set_config('app.allow_test_provider','true',false)"); try { const r = await h.pg.query(t, p ? [...p] : undefined); return { rows: r.rows as never[] }; } finally { await h.pg.exec("reset role"); } }, transaction(fn) { return fn(this); } };
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); vi.unstubAllEnvs?.(); });

describe("B3.12 signature routes", () => {
  it("GET signature: unauthenticated → 4xx; forged tenant → 403; cross-tenant → 404; owner → 200", async () => {
    const owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
    await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
    const cid = await readyForSignatureContract(h, owner, sd, emp);
    const mk = (id: string, company: string) => new Request(`http://x/api/pierre/v1/contracts/${id}/signature`, { headers: { "x-pierre-company": company } });

    mockUser = null;
    expect((await getSignature(mk(cid, h.companyA), { params: Promise.resolve({ id: cid }) })).status).toBeGreaterThanOrEqual(400);
    mockUser = { id: h.userA };
    expect((await getSignature(mk(cid, h.companyB), { params: Promise.resolve({ id: cid }) })).status).toBe(403);
    mockUser = { id: h.userB };
    expect((await getSignature(mk(cid, h.companyB), { params: Promise.resolve({ id: cid }) })).status).toBe(404);
    mockUser = { id: h.userA };
    const ok = await getSignature(mk(cid, h.companyA), { params: Promise.resolve({ id: cid }) });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.contract_id).toBe(cid);
  });

  it("POST reconcile returns a structured result for the owner", async () => {
    mockUser = { id: h.userA };
    const res = await reconcile(new Request("http://x/api/pierre/v1/signatures/reconcile", { method: "POST", headers: { "x-pierre-company": h.companyA, "content-type": "application/json" }, body: "{}" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("scanned");
  });

  it("the public webhook route accepts a verified event and refuses a bad signature, with no secret leak", async () => {
    process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET = "wh-secret";
    const owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
    await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
    const cid = await readyForSignatureContract(h, owner, sd, emp);
    const S = await import("../signatures");
    const sub = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, { provider, storage: sd.storage, scanner: sd.scanner });
    const ev = provider.__makeWebhookBody({ event_id: "wh1", event_type: "request.activated", request_id: sub.provider_request_id });

    // valid → 200 (the route resolves a fresh fake provider; same secret verifies)
    const good = await webhook(new Request("http://x/api/webhooks/pierre/signature", { method: "POST", headers: { "x-webhook-provider": "fake_provider", "x-webhook-signature": ev.signature, "content-type": "application/json" }, body: ev.body }));
    expect(good.status).toBe(200);
    // invalid signature → 401
    const bad = await webhook(new Request("http://x/api/webhooks/pierre/signature", { method: "POST", headers: { "x-webhook-provider": "fake_provider", "x-webhook-signature": "sha256=bad", "content-type": "application/json" }, body: ev.body }));
    expect(bad.status).toBe(401);
    expect(JSON.stringify(await bad.json())).not.toMatch(/wh-secret|service_role|password/);
    delete process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET;
    void signExistingContract;
  });
});
