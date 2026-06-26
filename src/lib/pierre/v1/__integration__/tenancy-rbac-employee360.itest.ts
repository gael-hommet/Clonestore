// src/lib/pierre/v1/__integration__/tenancy-rbac-employee360.itest.ts
// PHASE 8.2 — Enterprise Tenancy / RBAC / Sites / Employee 360 against real
// Postgres (PGlite): idempotent backfill, default-company resolution, site-scoped
// RBAC, RLS cross-tenant under a non-owner role, Employee 360, v1-only writes.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { runTenancyBackfill, isAccountMigrated } from "../backfill";
import { resolveTenantContext, resolveDefaultCompanyId } from "../tenant-context";
import { createSite, listSites } from "../sites";
import { createEmployee, listEmployees, getEmployee360, EmployeeRepo } from "../employees";
import { apiCreateMission } from "../api";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

async function seedLegacy(owners: Array<{ userId: string; status: string; email?: string; fullName?: string }>) {
  await h.db.query(`create table if not exists orders (id uuid default gen_random_uuid(), user_id uuid, status text, email text)`);
  await h.db.query(`create table if not exists profiles (id uuid primary key, full_name text, email text)`);
  await h.db.query(`create table if not exists agents_owned (client_id uuid, agent_key text)`);
  for (const o of owners) {
    await h.db.query(`insert into orders (user_id, status, email) values ($1,$2,$3)`, [o.userId, o.status, o.email ?? null]);
    if (o.fullName) await h.db.query(`insert into profiles (id, full_name, email) values ($1,$2,$3) on conflict do nothing`, [o.userId, o.fullName, o.email ?? null]);
  }
}

describe("Backfill (legacy → canonical tenancy)", () => {
  it("idempotent: active owners → 1 company + 1 owner member each, no duplication", async () => {
    const u1 = newUuid(), u2 = newUuid(), u3 = newUuid();
    await seedLegacy([
      { userId: u1, status: "active", fullName: "Acme RH", email: "a@acme.test" },
      { userId: u2, status: "trialing", email: "b@beta.test" },
      { userId: u3, status: "pending" }, // NOT an owner (not active/trialing)
    ]);
    const r1 = await runTenancyBackfill(h.db);
    expect(r1.companies_created).toBeGreaterThanOrEqual(2);
    expect(r1.members_created).toBeGreaterThanOrEqual(2);

    // deterministic company_id == user id; owner membership exists
    const c1 = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_companies where id=$1", [u1]);
    expect(c1.rows[0].n).toBe(1);
    const m1 = await h.db.query<{ role: string }>("select role from pierre_rt_members where company_id=$1 and user_id=$1", [u1]);
    expect(m1.rows[0].role).toBe("owner");
    // pending user is not an owner
    const c3 = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_companies where id=$1", [u3]);
    expect(c3.rows[0].n).toBe(0);

    // re-run is a no-op (no duplication)
    const r2 = await runTenancyBackfill(h.db);
    expect(r2.companies_created).toBe(0);
    expect(r2.members_created).toBe(0);
    const total = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_members where company_id=$1", [u1]);
    expect(total.rows[0].n).toBe(1);
  });

  it("default company resolves for a migrated single-company user", async () => {
    const u = newUuid();
    await seedLegacy([{ userId: u, status: "active" }]);
    await runTenancyBackfill(h.db);
    expect(await isAccountMigrated(h.db, u)).toBe(true);
    expect(await resolveDefaultCompanyId(h.db, u)).toBe(u);
    // un-migrated user → null (cockpit falls back to legacy, not broken)
    expect(await resolveDefaultCompanyId(h.db, newUuid())).toBeNull();
  });
});

describe("Sites + RBAC site scope", () => {
  it("site-scoped member only sees employees of their site", async () => {
    const ctxOwner = h.ctx("A");
    const siteX = await createSite(h.db, ctxOwner, { name: "Paris", code: "PAR" });
    const siteY = await createSite(h.db, ctxOwner, { name: "Lyon", code: "LYO" });
    await createEmployee(h.db, ctxOwner, { first_name: "Jean", last_name: "Paris", site_id: siteX.id });
    await createEmployee(h.db, ctxOwner, { first_name: "Marie", last_name: "Lyon", site_id: siteY.id });

    // create a real hr_operator member scoped to siteX
    const opUser = newUuid();
    const memberId = newUuid();
    await h.db.query(`insert into pierre_rt_members (id, company_id, user_id, role) values ($1,$2,$3,'hr_operator')`, [memberId, h.companyA, opUser]);
    await h.db.query(`insert into pierre_rt_member_sites (company_id, member_id, site_id) values ($1,$2,$3)`, [h.companyA, memberId, siteX.id]);

    const scoped = await resolveTenantContext(h.db, { user_id: opUser, company_id: h.companyA });
    expect(scoped.site_ids).toEqual([siteX.id]);

    const list = await listEmployees(h.db, scoped, { limit: 50 });
    expect(list.items.length).toBe(1);
    expect(list.items[0].site_id).toBe(siteX.id);

    // owner (no scope) sees both
    const all = await listEmployees(h.db, ctxOwner, { limit: 50 });
    expect(all.items.length).toBe(2);
  });

  it("viewer cannot write employees (RBAC)", async () => {
    await expect(createEmployee(h.db, h.ctx("A", "viewer"), { first_name: "x", last_name: "y" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("RLS — employees/sites isolation under restricted role", () => {
  it("tenant A cannot read tenant B employees via the app role", async () => {
    await createEmployee(h.db, h.ctx("A"), { first_name: "Alice", last_name: "A" });
    await createEmployee(h.db, h.ctx("B"), { first_name: "Bob", last_name: "B" });
    const seenByA = await h.asTenantRole(h.companyA, (q) => q("select id from pierre_rt_employees"));
    expect(seenByA.rows.length).toBe(1);
    const crossed = await h.asTenantRole(h.companyB, (q) => q("select first_name from pierre_rt_employees where first_name='Alice'"));
    expect(crossed.rows.length).toBe(0);
  });
});

describe("Employee 360", () => {
  it("aggregates employee + events + documents + absences", async () => {
    const ctx = h.ctx("A");
    const emp = await createEmployee(h.db, ctx, { first_name: "Sophie", last_name: "Durand", role_title: "Dev", contract_type: "cdi" });
    await EmployeeRepo.addDocument(h.db, h.companyA, emp.id, { kind: "contract", title: "CDI Sophie" });
    await EmployeeRepo.addAbsence(h.db, h.companyA, emp.id, { type: "conges_payes", start_date: "2026-07-01", end_date: "2026-07-15" });
    const v = await getEmployee360(h.db, ctx, emp.id);
    expect(v.employee.id).toBe(emp.id);
    expect(v.events.some((e) => (e as { type: string }).type === "employee_created")).toBe(true);
    expect(v.documents.length).toBe(1);
    expect(v.absences.length).toBe(1);
  });

  it("sites list is RBAC-gated and tenant-scoped", async () => {
    await createSite(h.db, h.ctx("A"), { name: "HQ" });
    const sites = await listSites(h.db, h.ctx("A"));
    expect(sites.length).toBe(1);
    await expect(listSites(h.db, { ...h.ctx("A"), permissions: [] })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("Single canonical write path", () => {
  it("a new mission writes only to pierre_rt_* (canonical runtime)", async () => {
    const ctx = h.ctx("A");
    const m = await apiCreateMission(h.db, ctx, { instruction: "Relancer le manager du site" });
    const inV1 = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_missions where id=$1", [m.mission_id]);
    expect(inV1.rows[0].n).toBe(1);
    // there is no legacy pierre_missions table in the canonical test DB — the
    // runtime never touches it. Assert the canonical row is the source of truth.
    const legacyExists = await h.db.query<{ reg: string | null }>("select to_regclass('public.pierre_missions')::text as reg");
    expect(legacyExists.rows[0].reg).toBeNull();
  });
});
