// PHASE 8.3-B2G-R1.9 — exercise the REAL Next.js route handlers (POST/GET), with auth + runtime
// DB injected, proving 401/403/404/200, forged-tenant rejection and forged-body-company ignored.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, provisionActiveCompany, type Harness } from "./harness";
import { newUuid, type SqlExecutor } from "../sql";
import { seedEmployee } from "./b2g-helpers";

// Inject the authenticated user + runtime DB used by withTenant.
let mockUser: { id: string } | null = null;
let mockDb: SqlExecutor;
vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => ({ auth: { getUser: async () => ({ data: { user: mockUser } }) } }) }));
vi.mock("@/lib/pierre/v1/db", () => ({ getRuntimeDb: async () => mockDb }));

// Imported AFTER the mocks (vi.mock is hoisted).
const { POST: createContract } = await import("@/app/api/pierre/v1/contracts/route");
const { GET: getContract } = await import("@/app/api/pierre/v1/contracts/[id]/route");

let h: Harness; let emp: string; let userC: string;
beforeEach(async () => {
  h = await createHarness();
  mockDb = h.db;
  // PHASE 8.6 — the real handlers are now product-gated; bring both tenants to an active+onboarded
  // entitlement so the gate permits (RBAC/tenant checks remain the assertions under test).
  await provisionActiveCompany(h, h.companyA);
  await provisionActiveCompany(h, h.companyB);
  emp = await seedEmployee(h, h.companyA);
  // a low-privilege member of company A (no document.write) for the permission case
  userC = newUuid();
  await h.db.query(`insert into pierre_rt_members (id, company_id, user_id, role) values ($1,$2,$3,'viewer')`, [newUuid(), h.companyA, userC]);
});
afterEach(async () => { if (h) await h.close(); });

const reqJson = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://local/api/pierre/v1/contracts", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const goodBody = { employee_id: "", contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" };

describe("R1.9 real route handlers", () => {
  it("unauthenticated → 4xx", async () => {
    mockUser = null;
    const res = await createContract(reqJson({ ...goodBody, employee_id: emp }, { "x-pierre-company": h.companyA }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/at Object|\.ts:\d+|password|service_role/i); // no stack/secret
  });

  it("a forged active-tenant header (user not a member of it) → 403", async () => {
    mockUser = { id: h.userA }; // owner of company A only
    const res = await createContract(reqJson({ ...goodBody, employee_id: emp }, { "x-pierre-company": h.companyB }));
    expect(res.status).toBe(403);
  });

  it("insufficient permission (viewer) → 403", async () => {
    mockUser = { id: userC };
    const res = await createContract(reqJson({ ...goodBody, employee_id: emp }, { "x-pierre-company": h.companyA }));
    expect(res.status).toBe(403);
  });

  it("a forged company_id in the BODY is ignored (tenant comes from the header) → 200 in company A", async () => {
    mockUser = { id: h.userA };
    const res = await createContract(reqJson({ ...goodBody, employee_id: emp, company_id: h.companyB }, { "x-pierre-company": h.companyA }));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.company_id).toBe(h.companyA); // created in A, not the forged B
  });

  it("a cross-tenant GET → 404", async () => {
    mockUser = { id: h.userA };
    const created = await (await createContract(reqJson({ ...goodBody, employee_id: emp }, { "x-pierre-company": h.companyA }))).json();
    // now read it as user B (company B)
    mockUser = { id: h.userB };
    const res = await getContract(new Request(`http://local/api/pierre/v1/contracts/${created.id}`, { headers: { "x-pierre-company": h.companyB } }), { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(404);
  });

  it("a real success returns 200 with the contract", async () => {
    mockUser = { id: h.userA };
    const res = await createContract(reqJson({ ...goodBody, employee_id: emp }, { "x-pierre-company": h.companyA }));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.id).toBeTruthy();
    expect(out.workflow_status).toBe("draft");
  });
});
