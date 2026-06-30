// src/lib/pierre/v1/__integration__/p86-product-gate-behavior.itest.ts
// PHASE 8.6 — the product gate's RUNTIME behaviour. Part 1 asserts the §19 policy matrix directly
// (productAccessPermits). Part 2 drives the REAL gated route handlers through the harness and proves the
// gate's HTTP outcomes: allowed+permission → success, allowed-without-permission → 403, suspended → reads
// continue / costly writes refused, onboarding_required → mission refused, cross-tenant → 403, suspended
// membership → 403. Exact statuses only.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, provisionActiveCompany, type Harness } from "./harness";
import { newUuid, type SqlExecutor } from "../sql";
import { productAccessPermits } from "@/app/api/pierre/v1/_runtime";
import type { ProductAccess } from "../entitlements";

const acc = (decision: ProductAccess["decision"]): ProductAccess => ({ decision, product_key: "pierre", entitlement_status: null, onboarding_status: null, can_use: false, can_read: true, reason: "x" });

describe("P8.6 product-gate policy matrix (§19)", () => {
  it("allowed: everything; grace: no new costly; onboarding_required: read/onboarding only; suspended/read_only: read only; denied: nothing", () => {
    expect(productAccessPermits(acc("allowed"), "write_costly")).toBe(true);
    expect(productAccessPermits(acc("allowed"), "admin")).toBe(true);
    expect(productAccessPermits(acc("grace"), "read")).toBe(true);
    expect(productAccessPermits(acc("grace"), "write_standard")).toBe(true);
    expect(productAccessPermits(acc("grace"), "write_costly")).toBe(false);
    expect(productAccessPermits(acc("onboarding_required"), "onboarding")).toBe(true);
    expect(productAccessPermits(acc("onboarding_required"), "read")).toBe(true);
    expect(productAccessPermits(acc("onboarding_required"), "write_standard")).toBe(false);
    expect(productAccessPermits(acc("onboarding_required"), "write_costly")).toBe(false);
    expect(productAccessPermits(acc("suspended"), "read")).toBe(true);
    expect(productAccessPermits(acc("suspended"), "write_standard")).toBe(false);
    expect(productAccessPermits(acc("suspended"), "write_costly")).toBe(false);
    expect(productAccessPermits(acc("read_only"), "read")).toBe(true);
    expect(productAccessPermits(acc("read_only"), "write_costly")).toBe(false);
    expect(productAccessPermits(acc("denied"), "read")).toBe(false);
    expect(productAccessPermits(acc("denied"), "onboarding")).toBe(false);
  });
});

let mockUser: { id: string } | null = null;
let mockDb: SqlExecutor;
vi.mock("@/lib/supabase-server", () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: mockUser } }) } }) }));
vi.mock("@/lib/pierre/v1/db", () => ({ getRuntimeDb: async () => mockDb }));
const { GET: listMissions, POST: createMission } = await import("@/app/api/pierre/v1/missions/route");

let h: Harness; let viewer: string;
beforeEach(async () => {
  h = await createHarness(); mockDb = h.db;
  await provisionActiveCompany(h, h.companyA);
  await provisionActiveCompany(h, h.companyB);
  viewer = newUuid();
  await h.db.query(`insert into pierre_rt_members (id, company_id, user_id, role) values ($1,$2,$3,'viewer')`, [newUuid(), h.companyA, viewer]);
});
afterEach(async () => { await h.close(); });

const post = (company: string, user: string | null) => { mockUser = user ? { id: user } : null; return createMission(new Request("http://x/api/pierre/v1/missions", { method: "POST", headers: { "content-type": "application/json", "x-pierre-company": company }, body: JSON.stringify({ instruction: "Vérifier les documents RH" }) })); };
const get = (company: string, user: string | null) => { mockUser = user ? { id: user } : null; return listMissions(new Request("http://x/api/pierre/v1/missions", { headers: { "x-pierre-company": company } })); };
const setEntitlement = (status: string) => h.db.query(`update pierre_rt_product_entitlements set status=$2 where company_id=$1`, [h.companyA, status]);

describe("P8.6 product gate — real route HTTP outcomes", () => {
  it("allowed + permission → mission created (200)", async () => {
    expect((await post(h.companyA, h.userA)).status).toBe(200);
  });
  it("allowed WITHOUT permission (viewer) → 403", async () => {
    expect((await post(h.companyA, viewer)).status).toBe(403);
  });
  it("suspended → reads continue (200), new costly write refused (403)", async () => {
    await setEntitlement("suspended");
    expect((await get(h.companyA, h.userA)).status).toBe(200);
    expect((await post(h.companyA, h.userA)).status).toBe(403);
  });
  it("onboarding_required (onboarding incomplete) → costly mission refused (403)", async () => {
    await h.db.query(`update pierre_rt_onboarding_sessions set status='in_progress' where company_id=$1`, [h.companyA]);
    expect((await post(h.companyA, h.userA)).status).toBe(403);
  });
  it("cross-tenant (owner of A targeting B via header) → 403", async () => {
    expect((await post(h.companyB, h.userA)).status).toBe(403);
  });
  it("suspended MEMBERSHIP → 403", async () => {
    const gone = newUuid();
    await h.db.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'hr_manager','suspended')`, [newUuid(), h.companyA, gone]);
    expect((await post(h.companyA, gone)).status).toBe(403);
  });
});
