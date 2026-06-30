// PHASE 8.4.20 — real route handlers: authenticated tenant communication surfaces + the public
// provider webhook. Tenant is server-resolved; no HTML/secret/object-key/address is exposed; the
// webhook is fail-closed (503 unconfigured, 401 on a bad signature).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, provisionActiveCompany, type Harness } from "./harness";
import { type SqlExecutor } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";

let mockUser: { id: string } | null = null;
let mockDb: SqlExecutor;
let webhookDb: SqlExecutor;
vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => ({ auth: { getUser: async () => ({ data: { user: mockUser } }) } }) }));
vi.mock("@/lib/pierre/v1/db", () => ({ getRuntimeDb: async () => mockDb }));
// R1.1/R1.3 — the dispatch + webhook routes use the DEDICATED least-privilege executors; here they
// resolve to the harness DB (the role isolation itself is proven in p84-r1-worker/webhook-db-role).
vi.mock("@/lib/pierre/v1/communication-worker-db", () => ({ createCommunicationWorkerExecutor: async () => mockDb, CommunicationWorkerDbError: class extends Error {} }));
vi.mock("@/lib/pierre/v1/communication-webhook-db", () => ({ createCommunicationWebhookExecutor: async () => webhookDb, CommunicationWebhookDbError: class extends Error {} }));

const { GET: listComms } = await import("@/app/api/pierre/v1/communications/route");
const { POST: dispatchRoute } = await import("@/app/api/pierre/v1/communications/dispatch/route");
const { POST: webhook } = await import("@/app/api/webhooks/pierre/communications/route");

let h: Harness; let owner: TenantContext;
beforeEach(async () => {
  h = await createHarness(); mockDb = h.db; mockUser = { id: h.userA };
  await provisionActiveCompany(h, h.companyA);
  await provisionActiveCompany(h, h.companyB);
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  await configureSignatory(h, h.companyA);
  webhookDb = { async query(t: string, p?: readonly unknown[]) { await h.pg.exec("set role pierre_rt_communication_webhook"); try { const r = await h.pg.query(t, p ? [...p] : undefined); return { rows: r.rows as never[] }; } finally { await h.pg.exec("reset role"); } }, transaction(fn: (tx: unknown) => unknown) { return fn(webhookDb); } } as never;
});
afterEach(async () => { await h.close(); vi.unstubAllEnvs(); });
const hdr = (company: string) => ({ headers: { "x-pierre-company": company } });

describe("P8.4.20 communication routes", () => {
  it("GET /communications lists the tenant's deliveries with NO html/secret/address fields", async () => {
    const doc = await seedDocument(h, owner);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
    await Comm.createCommunicationIntents(h.db, owner);
    const res = await listComms(new Request("http://x/api/pierre/v1/communications", hdr(h.companyA)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    const item = body.items[0];
    expect(item).toHaveProperty("status"); expect(item).toHaveProperty("channel");
    expect(JSON.stringify(item)).not.toMatch(/<html|object_key|resolved_email|re_[A-Za-z0-9]|secret/i);
  });
  it("POST /communications/dispatch is SYSTEM-only: an ordinary request (no secret) is refused", async () => {
    // R1.2 — without the system secret configured/presented, the dispatch trigger is NOT usable.
    vi.stubEnv("PIERRE_COMMUNICATION_SYSTEM_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    const unconfigured = await dispatchRoute(new Request("http://x/api/pierre/v1/communications/dispatch", { method: "POST", body: JSON.stringify({ company_id: h.companyA }) }));
    expect(unconfigured.status).toBe(503);
    vi.stubEnv("PIERRE_COMMUNICATION_SYSTEM_SECRET", "sys-secret");
    const noSecret = await dispatchRoute(new Request("http://x/api/pierre/v1/communications/dispatch", { method: "POST", body: JSON.stringify({ company_id: h.companyA }) }));
    expect(noSecret.status).toBe(403); // ordinary (document.read) caller has no secret → refused
  });
  it("POST /communications/dispatch with the system secret triggers intent creation + dispatch", async () => {
    vi.stubEnv("PIERRE_COMMUNICATION_SYSTEM_SECRET", "sys-secret");
    const doc = await seedDocument(h, owner);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
    const res = await dispatchRoute(new Request("http://x/api/pierre/v1/communications/dispatch", { method: "POST", headers: { authorization: "Bearer sys-secret", "content-type": "application/json" }, body: JSON.stringify({ company_id: h.companyA }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intents.created).toBe(1);
    expect(body.dispatched.delivered).toBeGreaterThanOrEqual(1); // the in-app message was delivered
  });
  it("an unauthenticated list is denied", async () => {
    mockUser = null;
    const res = await listComms(new Request("http://x/api/pierre/v1/communications", hdr(h.companyA)));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
  it("the webhook route is fail-closed: 503 without a secret; 401 on a bad signature", async () => {
    vi.stubEnv("CLONESTORE_EMAIL_WEBHOOK_SECRET", "");
    const noSecret = await webhook(new Request("http://x/api/webhooks/pierre/communications", { method: "POST", body: "{}" }));
    expect(noSecret.status).toBe(503);
    vi.stubEnv("CLONESTORE_EMAIL_WEBHOOK_SECRET", "whsec_" + Buffer.from("secret").toString("base64"));
    const bad = await webhook(new Request("http://x/api/webhooks/pierre/communications", { method: "POST", headers: { "svix-id": "m1", "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,AAAA" }, body: JSON.stringify({ type: "email.delivered", data: { email_id: "x" } }) }));
    expect(bad.status).toBe(401);
  });
});
