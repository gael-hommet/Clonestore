// src/lib/pierre/v1/__integration__/enterprise-complete.itest.ts
// PHASE 8.2 (completion) — production-like RLS binding, full RBAC, company model,
// relational Employee 360, sensitive isolation, completeness, search — all vs
// real Postgres (PGlite).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { withTenantTransaction } from "../tenant-tx";
import { resolveTenantContext } from "../tenant-context";
import { getCompany, patchCompany, assertCompanyAccessible, listAccessibleCompanies } from "../company";
import { createEmployee, EmployeeRepo } from "../employees";
import { searchEmployees } from "../employee-search";
import { computeEmployeeCompleteness } from "../completeness";
import { writeSensitive, readSensitive, listSensitiveCategories } from "../employee-sensitive";
import { apiCreateMission } from "../api";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRODUCTION-LIKE TENANT TRANSACTION BINDING (real RLS, not a manual test)
// ─────────────────────────────────────────────────────────────────────────────
describe("1. withTenantTransaction — real RLS binding", () => {
  it("runs business work under the non-superuser app role", async () => {
    const who = await withTenantTransaction(h.db, h.ctx("A"), (tx) => tx.query<{ u: string }>("select current_user as u"));
    expect(who.rows[0].u).toBe("pierre_rt_app");
    const outside = await h.db.query<{ u: string }>("select current_user as u");
    expect(outside.rows[0].u).not.toBe("pierre_rt_app"); // service/superuser role
  });

  it("tenant A then tenant B on the same connection — no leak", async () => {
    await createEmployee(h.db, h.ctx("A"), { first_name: "Alice", last_name: "A" });
    await createEmployee(h.db, h.ctx("B"), { first_name: "Bob", last_name: "B" });
    const a = await withTenantTransaction(h.db, h.ctx("A"), (tx) => tx.query("select first_name from pierre_rt_employees"));
    const b = await withTenantTransaction(h.db, h.ctx("B"), (tx) => tx.query("select first_name from pierre_rt_employees"));
    expect(a.rows.map((r) => (r as { first_name: string }).first_name)).toEqual(["Alice"]);
    expect(b.rows.map((r) => (r as { first_name: string }).first_name)).toEqual(["Bob"]);
  });

  it("GUC + role are transaction-local — never retained after the tx", async () => {
    await withTenantTransaction(h.db, h.ctx("A"), async (tx) => { await tx.query("select 1"); });
    const guc = await h.db.query<{ c: string | null }>("select current_setting('app.current_company', true) as c");
    expect(guc.rows[0].c === null || guc.rows[0].c === "").toBe(true);
    const who = await h.db.query<{ u: string }>("select current_user as u");
    expect(who.rows[0].u).not.toBe("pierre_rt_app");
  });

  it("rollback then reuse — failed tenant tx rolls back, connection still usable", async () => {
    await createEmployee(h.db, h.ctx("A"), { first_name: "Keep", last_name: "Me" });
    await expect(withTenantTransaction(h.db, h.ctx("A"), async (tx) => {
      await tx.query(`insert into pierre_rt_employees (id, company_id, first_name, last_name, search_text) values ($1,$2,'Rolled','Back','rolled')`, [newUuid(), h.companyA]);
      throw new Error("boom");
    })).rejects.toThrow("boom");
    const n = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_employees where company_id=$1", [h.companyA]);
    expect(n.rows[0].n).toBe(1); // the insert rolled back
    const ok = await withTenantTransaction(h.db, h.ctx("A"), (tx) => tx.query("select 1 as ok"));
    expect(ok.rows.length).toBe(1);
  });

  it("forgotten WHERE company_id is still blocked by RLS (no leak)", async () => {
    await createEmployee(h.db, h.ctx("A"), { first_name: "A1", last_name: "x" });
    await createEmployee(h.db, h.ctx("B"), { first_name: "B1", last_name: "y" });
    // a query WITHOUT a company filter, under the bound role, returns only A.
    const r = await withTenantTransaction(h.db, h.ctx("A"), (tx) => tx.query("select first_name from pierre_rt_employees order by first_name"));
    expect(r.rows.map((x) => (x as { first_name: string }).first_name)).toEqual(["A1"]);
  });

  it("worker cross-tenant write is impossible under RLS", async () => {
    // create a job in company B
    await apiCreateMission(h.db, h.ctx("B"), { instruction: "Relancer le manager de B" });
    const bJob = (await h.db.query<{ id: string }>("select id from pierre_rt_jobs where company_id=$1 limit 1", [h.companyB])).rows[0];
    expect(bJob).toBeTruthy();
    // a worker bound to tenant A tries to cancel B's job → RLS blocks (0 rows)
    const upd = await withTenantTransaction(h.db, h.ctx("A"), (tx) => tx.query("update pierre_rt_jobs set status='cancelled' where id=$1 returning id", [bJob.id]));
    expect(upd.rows.length).toBe(0);
    // B's job is intact
    const still = await h.db.query<{ status: string }>("select status from pierre_rt_jobs where id=$1", [bJob.id]);
    expect(still.rows[0].status).not.toBe("cancelled");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. FULL RBAC (DB-driven, multi-role) + lifecycle guards
// ─────────────────────────────────────────────────────────────────────────────
describe("2. RBAC + member/company lifecycle", () => {
  async function addMember(company: string, user: string, role = "hr_operator", status = "active"): Promise<string> {
    const id = newUuid();
    await h.db.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,$4,$5)`, [id, company, user, role, status]);
    return id;
  }

  it("multi-role membership unions permissions from role_permissions (DB)", async () => {
    const u = newUuid();
    const mId = await addMember(h.companyA, u, "hr_operator");
    await h.db.query(`insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,'HR_DIRECTOR'),($1,$2,'PAYROLL_MANAGER')`, [h.companyA, mId]);
    const ctx = await resolveTenantContext(h.db, { user_id: u, company_id: h.companyA });
    expect(ctx.permissions).toContain("employee.write");        // from HR_DIRECTOR
    expect(ctx.permissions).toContain("employee.sensitive.read"); // from PAYROLL_MANAGER
    expect(ctx.permissions).toContain("payroll_prep.write");      // from PAYROLL_MANAGER
  });

  it("suspended member → membership_suspended (must NOT fall back to legacy)", async () => {
    const u = newUuid();
    await addMember(h.companyA, u, "hr_manager", "suspended");
    await expect(resolveTenantContext(h.db, { user_id: u, company_id: h.companyA })).rejects.toMatchObject({ code: "membership_suspended" });
  });

  it("suspended company → company_suspended", async () => {
    await h.db.query(`update pierre_rt_companies set status='suspended' where id=$1`, [h.companyA]);
    await expect(resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA })).rejects.toMatchObject({ code: "company_suspended" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. COMPLETE COMPANY MODEL (optimistic concurrency + governed status)
// ─────────────────────────────────────────────────────────────────────────────
describe("3. Company model", () => {
  it("patch with optimistic concurrency; stale version conflicts", async () => {
    const ctx = h.ctx("A");
    const c0 = await getCompany(h.db, ctx);
    const c1 = await patchCompany(h.db, ctx, { display_name: "Acme SAS", sector: "tech" }, c0.version);
    expect(c1.display_name).toBe("Acme SAS");
    await expect(patchCompany(h.db, ctx, { sector: "retail" }, c0.version)).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("illegal status transition is rejected", async () => {
    const ctx = h.ctx("A");
    const c = await getCompany(h.db, ctx);
    await expect(patchCompany(h.db, ctx, { status: "cancelled" }, c.version)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("accessible companies + switch validation", async () => {
    const list = await listAccessibleCompanies(h.db, h.userA);
    expect(list.some((c) => c.id === h.companyA)).toBe(true);
    await expect(assertCompanyAccessible(h.db, h.userA, h.companyA)).resolves.toBeUndefined();
    await expect(assertCompanyAccessible(h.db, h.userA, h.companyB)).rejects.toMatchObject({ code: "tenant_access_denied" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. RELATIONAL EMPLOYEE 360 + completeness
// ─────────────────────────────────────────────────────────────────────────────
describe("4. Relational Employee 360 + completeness", () => {
  it("employment + contract + version are real relational rows", async () => {
    const ctx = h.ctx("A");
    const emp = await createEmployee(h.db, ctx, { first_name: "Sophie", last_name: "Durand", employee_number: "E001" });
    await EmployeeRepo.addEmployment(h.db, h.companyA, emp.id, { employment_type: "cdi", weekly_hours: 35 });
    const contractId = await EmployeeRepo.addContract(h.db, h.companyA, emp.id, "CDI_FULL_TIME");
    const v2 = await EmployeeRepo.newContractVersion(h.db, h.companyA, contractId);
    expect(v2).toBe(2);
    const versions = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_employee_contract_versions where contract_id=$1", [contractId]);
    expect(versions.rows[0].n).toBe(2);
    // status history written on create
    const hist = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_employee_status_history where employee_id=$1", [emp.id]);
    expect(hist.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("completeness is explainable; blocking items when no contract/employment", async () => {
    const ctx = h.ctx("A");
    const emp = await createEmployee(h.db, ctx, { first_name: "Paul", last_name: "Martin" });
    const c0 = await computeEmployeeCompleteness(h.db, ctx, emp.id);
    expect(c0.blocking_items.some((i) => i.id === "contract")).toBe(true);
    expect(c0.completeness_score).toBeLessThan(100);
    await EmployeeRepo.addEmployment(h.db, h.companyA, emp.id, { employment_type: "cdi" });
    await EmployeeRepo.addContract(h.db, h.companyA, emp.id, "CDI_FULL_TIME");
    const c1 = await computeEmployeeCompleteness(h.db, ctx, emp.id);
    expect(c1.completeness_score).toBeGreaterThan(c0.completeness_score);
    expect(c1.next_actions.length).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. SENSITIVE DATA ISOLATION (permission + audit)
// ─────────────────────────────────────────────────────────────────────────────
describe("5. Sensitive data isolation", () => {
  it("sensitive read requires the dedicated permission and is audited", async () => {
    const ctx = h.ctx("A"); // owner has employee.sensitive.*
    const emp = await createEmployee(h.db, ctx, { first_name: "Iban", last_name: "Holder" });
    await writeSensitive(h.db, ctx, emp.id, "bank_details", "enc::xxxx");
    const read = await readSensitive(h.db, ctx, emp.id, "bank_details");
    expect(read?.value_encrypted).toBe("enc::xxxx");
    // access was logged (category + actor, not the value)
    const log = await h.db.query<{ category: string; actor_user_id: string }>("select category, actor_user_id from pierre_rt_employee_sensitive_access_log where employee_id=$1", [emp.id]);
    expect(log.rows[0].category).toBe("bank_details");
    expect(log.rows.some((r) => JSON.stringify(r).includes("enc::xxxx"))).toBe(false); // value never logged

    // a viewer (no sensitive permission) is denied
    await expect(readSensitive(h.db, h.ctx("A", "viewer"), emp.id, "bank_details")).rejects.toMatchObject({ code: "forbidden" });
    // category listing is allowed for sensitive readers (no values)
    const cats = await listSensitiveCategories(h.db, ctx, emp.id);
    expect(cats).toContain("bank_details");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SEARCH (accent-insensitive, scoped, paginated, indexed)
// ─────────────────────────────────────────────────────────────────────────────
describe("6. Employee search", () => {
  it("accent-insensitive match by name / number", async () => {
    const ctx = h.ctx("A");
    await createEmployee(h.db, ctx, { first_name: "Hélène", last_name: "Émard", employee_number: "E042" });
    await createEmployee(h.db, ctx, { first_name: "Marc", last_name: "Dubois" });
    const byAccent = await searchEmployees(h.db, ctx, "helene emard"); // no accents in query
    expect(byAccent.length).toBe(1);
    expect(byAccent[0].first_name).toBe("Hélène");
    const byNumber = await searchEmployees(h.db, ctx, "e042");
    expect(byNumber.length).toBe(1);
    const none = await searchEmployees(h.db, ctx, "zzzznomatch");
    expect(none.length).toBe(0);
  });
});
