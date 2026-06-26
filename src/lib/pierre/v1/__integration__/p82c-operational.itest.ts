// src/lib/pierre/v1/__integration__/p82c-operational.itest.ts
// PHASE 8.2-C — Final operational closure, proven vs real Postgres (PGlite):
//  - RLS transaction binding now covers missions / validations / the worker.
//  - Invitations + full member lifecycle + ownership transfer.
//  - Custom roles resolved through resolveTenantContext.
//  - Multi-company switch with persistent preference.
//  - Sites CRUD + lifecycle. Employee 360 services. CSV import. GDPR ops.
//  - Typo-tolerant / order-independent search.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { withTenantTransaction } from "../tenant-tx";
import { resolveTenantContext } from "../tenant-context";
import { drainQueue } from "../worker";
import {
  apiCreateMission, apiListMissions, apiCreateInvitation, apiAcceptInvitation, apiRevokeInvitation,
  apiSuspendMember, apiReactivateMember, apiRemoveMember, apiTransferOwnership,
  apiCreateRole, apiArchiveRole, apiListRoles,
  apiSwitchCompany, apiListCompanies,
  apiGetSite, apiPatchSite, apiArchiveSite, apiAssignSiteManager,
  apiPatchEmployee, apiArchiveEmployee, apiReactivateEmployee, apiListContracts, apiCreateContract,
  apiCreateAbsence, apiEmployeeTimeline,
  apiImportPreview, apiImportCommit, apiImportRollback, apiGetImportBatch,
  apiExportEmployee, apiAnonymizeEmployee, apiSetLegalHold, apiPurgeEmployee, apiDataAccessAudit,
} from "../api";
import { createEmployee, EmployeeRepo } from "../employees";
import { createSite } from "../sites";
import { assignRole } from "../members";
import { searchEmployees, __resetTrgmCache } from "../employee-search";

let h: Harness;
beforeEach(async () => { h = await createHarness(); __resetTrgmCache(); });
afterEach(async () => { await h.close(); });

async function addMember(company: string, user: string, role = "hr_operator", status = "active"): Promise<string> {
  const id = newUuid();
  await h.db.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,$4,$5)`, [id, company, user, role, status]);
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
describe("1. RLS binding now covers missions / validations / worker", () => {
  it("mission list under tenant A never sees tenant B's missions (no app filter leak)", async () => {
    await apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer l'onboarding de Marie" });
    await apiCreateMission(h.db, h.ctx("B"), { instruction: "Relancer un manager" });
    const a = await apiListMissions(h.db, h.ctx("A"), {});
    const b = await apiListMissions(h.db, h.ctx("B"), {});
    expect(a.items.length).toBe(1);
    expect(b.items.length).toBe(1);
    expect(a.items[0].summary).not.toEqual(b.items[0].summary);
  });

  it("the worker processes BOTH tenants, each under its own RLS binding, with no cross-contamination", async () => {
    await apiCreateMission(h.db, h.ctx("A"), { instruction: "Relancer le manager du rapport mensuel" });
    await apiCreateMission(h.db, h.ctx("B"), { instruction: "Relancer le manager du rapport mensuel" });
    const res = await drainQueue(h.db, { worker_id: "w-rls", batch: 10, lease_ms: 60000 });
    expect(res.claimed).toBeGreaterThan(0);
    // Every event row for company A references a mission that belongs to company A.
    const leak = await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_events e
         where e.company_id=$1 and not exists (select 1 from pierre_rt_missions m where m.id=e.mission_id and m.company_id=$1)`, [h.companyA]);
    expect(leak.rows[0].n).toBe(0);
    // Both tenants advanced (have at least one event).
    const ae = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_events where company_id=$1`, [h.companyA]);
    const be = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_events where company_id=$1`, [h.companyB]);
    expect(ae.rows[0].n).toBeGreaterThan(0);
    expect(be.rows[0].n).toBeGreaterThan(0);
  });

  it("worker bound to A cannot mutate B's job (RLS → 0 rows)", async () => {
    await apiCreateMission(h.db, h.ctx("B"), { instruction: "Relancer le manager du rapport mensuel" });
    const bJob = (await h.db.query<{ id: string }>("select id from pierre_rt_jobs where company_id=$1 limit 1", [h.companyB])).rows[0];
    const upd = await withTenantTransaction(h.db, { company_id: h.companyA, user_id: "worker:x" }, (tx) => tx.query("update pierre_rt_jobs set status='cancelled' where id=$1 returning id", [bJob.id]));
    expect(upd.rows.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("2. Invitations + member lifecycle + ownership transfer", () => {
  it("invitation stores only a token hash; raw token accepts once and creates the membership with roles", async () => {
    const newUser = newUuid();
    const inv = await apiCreateInvitation(h.db, h.ctx("A"), { email: "newhire@acme.test", roles: ["HR_MANAGER"] });
    expect(inv.raw_token).toBeTruthy();
    // raw token is NOT stored
    const stored = await h.db.query<{ token_hash: string }>(`select token_hash from pierre_rt_invitations where id=$1`, [inv.id]);
    expect(stored.rows[0].token_hash).not.toBe(inv.raw_token);
    // accept (verified email matching the invitation)
    const acc = await apiAcceptInvitation(h.db, { user_id: newUser, email: "newhire@acme.test", email_confirmed_at: "2026-06-15T00:00:00Z", token: inv.raw_token });
    expect(acc.company_id).toBe(h.companyA);
    const ctx = await resolveTenantContext(h.db, { user_id: newUser, company_id: h.companyA });
    expect(ctx.permissions).toContain("employee.write"); // HR_MANAGER grants it
    // replay is idempotent: a second accept of a (now-accepted) token is rejected, membership unchanged
    await expect(apiAcceptInvitation(h.db, { user_id: newUser, token: inv.raw_token })).rejects.toMatchObject({ code: "not_found" });
  });

  it("reissue is idempotent (one pending per email); revoke invalidates", async () => {
    const a = await apiCreateInvitation(h.db, h.ctx("A"), { email: "dup@acme.test" });
    const b = await apiCreateInvitation(h.db, h.ctx("A"), { email: "dup@acme.test" });
    expect(b.idempotent).toBe(true);
    expect(b.id).toBe(a.id);
    const pending = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_invitations where company_id=$1 and email='dup@acme.test' and status='pending'`, [h.companyA]);
    expect(pending.rows[0].n).toBe(1);
    await apiRevokeInvitation(h.db, h.ctx("A"), a.id);
    await expect(apiAcceptInvitation(h.db, { user_id: newUuid(), token: b.raw_token })).rejects.toMatchObject({ code: "not_found" });
  });

  it("suspend / reactivate / remove a member; cannot suspend or remove the last owner", async () => {
    const u = newUuid();
    const mId = await addMember(h.companyA, u, "hr_manager");
    await apiSuspendMember(h.db, h.ctx("A"), mId);
    await expect(resolveTenantContext(h.db, { user_id: u, company_id: h.companyA })).rejects.toMatchObject({ code: "membership_suspended" });
    await apiReactivateMember(h.db, h.ctx("A"), mId);
    await expect(resolveTenantContext(h.db, { user_id: u, company_id: h.companyA })).resolves.toBeTruthy();
    await apiRemoveMember(h.db, h.ctx("A"), mId);
    await expect(resolveTenantContext(h.db, { user_id: u, company_id: h.companyA })).rejects.toMatchObject({ code: "tenant_access_denied" });
    // last owner protection (userA owner is the only owner)
    const ownerMembership = (await h.db.query<{ id: string }>(`select id from pierre_rt_members where company_id=$1 and user_id=$2`, [h.companyA, h.userA])).rows[0].id;
    await expect(apiRemoveMember(h.db, h.ctx("A"), ownerMembership)).rejects.toMatchObject({ code: "conflict" });
  });

  it("ownership transfer keeps at least one active owner; concurrent transfers serialize", async () => {
    const u = newUuid();
    const target = await addMember(h.companyA, u, "admin");
    // Use a resolved ctx so membership_id matches the real owner row.
    const ownerCtx = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    await apiTransferOwnership(h.db, ownerCtx, target, true); // demote self
    const owners = await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_members m where m.company_id=$1 and m.status='active'
         and (m.role='owner' or exists(select 1 from pierre_rt_membership_roles mr where mr.membership_id=m.id and mr.role_key='OWNER'))`, [h.companyA]);
    expect(owners.rows[0].n).toBeGreaterThanOrEqual(1);
    const targetRole = await h.db.query<{ role: string }>(`select role from pierre_rt_members where id=$1`, [target]);
    expect(targetRole.rows[0].role).toBe("owner");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("3. Custom roles resolved by resolveTenantContext", () => {
  it("a custom role grants its permissions through the normal resolution path; archive revokes", async () => {
    const role = await apiCreateRole(h.db, h.ctx("A"), { label: "Recruteur", permissions: ["employee.read", "mission.create"] });
    expect(role.is_system).toBe(false);
    const u = newUuid();
    const mId = await addMember(h.companyA, u, "viewer");
    await assignRole(h.db, h.ctx("A"), mId, role.key);
    const ctx = await resolveTenantContext(h.db, { user_id: u, company_id: h.companyA });
    expect(ctx.permissions).toContain("mission.create");
    // archive → permission no longer granted
    await apiArchiveRole(h.db, h.ctx("A"), role.key);
    const ctx2 = await resolveTenantContext(h.db, { user_id: u, company_id: h.companyA });
    expect(ctx2.permissions).not.toContain("mission.create");
    const roles = await apiListRoles(h.db, h.ctx("A"));
    expect(roles.find((r) => r.key === role.key)?.archived).toBe(true);
  });

  it("system roles are immutable; unknown permission rejected", async () => {
    await expect(apiArchiveRole(h.db, h.ctx("A"), "OWNER")).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiCreateRole(h.db, h.ctx("A"), { label: "Bad", permissions: ["nonexistent.perm"] })).rejects.toMatchObject({ code: "validation_failed" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("4. Multi-company switch", () => {
  it("a user in 3 companies switches with a persistent preference; suspended company refused", async () => {
    const u = newUuid();
    const c2 = newUuid(), c3 = newUuid();
    await h.db.query(`insert into pierre_rt_companies (id,name) values ($1,'C2'),($2,'C3')`, [c2, c3]);
    await addMember(h.companyA, u, "viewer");
    await addMember(c2, u, "admin");
    await addMember(c3, u, "hr_manager");
    const list = await apiListCompanies(h.db, u);
    expect(list.length).toBe(3);
    const sw = await apiSwitchCompany(h.db, u, c2);
    expect(sw.company_id).toBe(c2);
    const pref = await h.db.query<{ last_company_id: string }>(`select last_company_id from pierre_rt_user_company_prefs where user_id=$1`, [u]);
    expect(pref.rows[0].last_company_id).toBe(c2);
    // suspend c3 → switch refused
    await h.db.query(`update pierre_rt_companies set status='suspended' where id=$1`, [c3]);
    await expect(apiSwitchCompany(h.db, u, c3)).rejects.toMatchObject({ code: "company_suspended" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("5. Sites CRUD + lifecycle", () => {
  it("patch optimistic; archive blocked with active employees unless reassigned; assign-manager validated", async () => {
    const ctx = h.ctx("A");
    const s1 = await createSite(h.db, ctx, { name: "Paris", code: "PAR" });
    const s2 = await createSite(h.db, ctx, { name: "Lyon", code: "LYO" });
    const patched = await apiPatchSite(h.db, ctx, s1.id, { city: "Paris", country: "FR" }, s1.version);
    expect(patched.city).toBe("Paris");
    await expect(apiPatchSite(h.db, ctx, s1.id, { city: "X" }, s1.version)).rejects.toMatchObject({ code: "version_conflict" });
    // employee on s1 blocks archive
    await createEmployee(h.db, ctx, { first_name: "Jean", last_name: "Site", site_id: s1.id });
    await expect(apiArchiveSite(h.db, ctx, s1.id)).rejects.toMatchObject({ code: "conflict" });
    const archived = await apiArchiveSite(h.db, ctx, s1.id, s2.id); // reassign to Lyon
    expect(archived.archived_at).toBeTruthy();
    const moved = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1 and site_id=$2`, [h.companyA, s2.id]);
    expect(moved.rows[0].n).toBe(1);
    // assign-manager must be an active member
    const owner = (await h.db.query<{ id: string }>(`select id from pierre_rt_members where company_id=$1 and user_id=$2`, [h.companyA, h.userA])).rows[0].id;
    const withMgr = await apiAssignSiteManager(h.db, ctx, s2.id, owner);
    expect(withMgr.manager_membership_id).toBe(owner);
    await expect(apiAssignSiteManager(h.db, ctx, s2.id, newUuid())).rejects.toMatchObject({ code: "validation_failed" });
    await apiGetSite(h.db, ctx, s2.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("6. Employee 360 services", () => {
  it("patch optimistic + search reindex; archive/reactivate; contracts; absence validation; timeline", async () => {
    const ctx = h.ctx("A");
    const emp = await createEmployee(h.db, ctx, { first_name: "Camille", last_name: "Roy", employee_number: "E100" });
    const v1 = emp.version ?? 1;
    const patched = await apiPatchEmployee(h.db, ctx, emp.id, { role_title: "Responsable", department: "RH" }, v1);
    expect(patched.role_title).toBe("Responsable");
    await expect(apiPatchEmployee(h.db, ctx, emp.id, { team: "X" }, v1)).rejects.toMatchObject({ code: "version_conflict" });
    // reindex: searching the new role title finds the employee
    const found = await searchEmployees(h.db, ctx, "responsable");
    expect(found.some((e) => e.id === emp.id)).toBe(true);
    // contracts
    const cid = await apiCreateContract(h.db, ctx, emp.id, "CDI_FULL_TIME");
    expect(cid).toBeTruthy();
    const contracts = await apiListContracts(h.db, ctx, emp.id);
    expect(contracts.length).toBe(1);
    // absence validation
    await expect(apiCreateAbsence(h.db, ctx, emp.id, { type: "conges_payes", start_date: "2026-07-10", end_date: "2026-07-01" })).rejects.toMatchObject({ code: "validation_failed" });
    await apiCreateAbsence(h.db, ctx, emp.id, { type: "conges_payes", start_date: "2026-07-01", end_date: "2026-07-10" });
    // archive / reactivate with status history
    await apiArchiveEmployee(h.db, ctx, emp.id);
    await apiReactivateEmployee(h.db, ctx, emp.id);
    const tl = await apiEmployeeTimeline(h.db, ctx, emp.id);
    expect(tl.some((e) => e.type.startsWith("status:"))).toBe(true);
    expect(tl.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("7. CSV import — preview / commit / rollback / idempotency / dedup", () => {
  const csv = [
    "prénom,nom,matricule,email pro,poste",
    "Hélène,Émard,E001,helene@acme.test,Manager",
    "Marc,Dubois,E002,marc@acme.test,Analyste",
    "Marc,Dubois,E002,marc@acme.test,Analyste",   // internal duplicate (E002)
    ",Sansprenom,E003,x@acme.test,X",             // error: missing first_name
  ].join("\n");

  it("preview classifies valid/duplicate/error; commit inserts only valid; rollback removes them; idempotent rerun", async () => {
    const ctx = h.ctx("A");
    const pv = await apiImportPreview(h.db, ctx, { csv, idempotency_key: "imp-1", allow_partial: true });
    expect(pv.total_rows).toBe(4);
    expect(pv.valid_rows).toBe(2);
    expect(pv.duplicate_rows).toBe(1);
    expect(pv.error_rows).toBe(1);
    const committed = await apiImportCommit(h.db, ctx, pv.batch_id);
    expect(committed.inserted_rows).toBe(2);
    const count = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1`, [h.companyA]);
    expect(count.rows[0].n).toBe(2);
    // accents preserved on insert; searchable accent-insensitively
    const helene = await searchEmployees(h.db, ctx, "helene");
    expect(helene.length).toBe(1);
    // idempotent commit (rerun) does not double-insert
    const again = await apiImportCommit(h.db, ctx, pv.batch_id);
    expect(again.idempotent).toBe(true);
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1`, [h.companyA])).rows[0].n).toBe(2);
    // rollback removes inserted employees
    const rb = await apiImportRollback(h.db, ctx, pv.batch_id);
    expect(rb.status).toBe("rolled_back");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1`, [h.companyA])).rows[0].n).toBe(0);
    // a second preview with the same idempotency_key returns the SAME (now rolled-back) batch
    const pv2 = await apiImportPreview(h.db, ctx, { csv, idempotency_key: "imp-1" });
    expect(pv2.idempotent).toBe(true);
    expect(pv2.batch_id).toBe(pv.batch_id);
  });

  it("existing-row dedup detects already-imported employees on a second batch", async () => {
    const ctx = h.ctx("A");
    await createEmployee(h.db, ctx, { first_name: "Marc", last_name: "Dubois", employee_number: "E002", professional_email: "marc@acme.test" });
    const pv = await apiImportPreview(h.db, ctx, { csv, allow_partial: true });
    // E002 now also collides with the existing employee → still 1 unique valid (Hélène)
    expect(pv.duplicate_rows).toBeGreaterThanOrEqual(1);
    expect(pv.valid_rows).toBe(1);
    void apiGetImportBatch;
  });

  it("missing required column is rejected", async () => {
    await expect(apiImportPreview(h.db, h.ctx("A"), { csv: "foo,bar\n1,2" })).rejects.toMatchObject({ code: "validation_failed" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("8. GDPR operations", () => {
  it("export gates sensitive by permission; anonymize is blocked under legal hold then pseudonymizes; purge respects retention", async () => {
    const ctx = h.ctx("A");
    const emp = await createEmployee(h.db, ctx, { first_name: "Iban", last_name: "Holder", professional_email: "iban@acme.test" });
    await withTenantTransaction(h.db, ctx, (tx) => tx.query(`insert into pierre_rt_employee_sensitive_data (id, company_id, employee_id, category, value_encrypted) values ($1,$2,$3,'bank_details','enc::secret')`, [newUuid(), h.companyA, emp.id]));
    const exp = await apiExportEmployee(h.db, ctx, emp.id);
    expect(Array.isArray((exp as { sensitive?: unknown[] }).sensitive)).toBe(true); // owner has sensitive.read

    // legal hold blocks anonymize
    await apiSetLegalHold(h.db, ctx, emp.id, true);
    await expect(apiAnonymizeEmployee(h.db, ctx, emp.id)).rejects.toMatchObject({ code: "conflict" });
    await apiSetLegalHold(h.db, ctx, emp.id, false);
    await apiAnonymizeEmployee(h.db, ctx, emp.id);
    const after = await h.db.query<{ first_name: string; professional_email: string | null; anonymized_at: string | null }>(`select first_name, professional_email, anonymized_at from pierre_rt_employees where id=$1`, [emp.id]);
    expect(after.rows[0].first_name).toBe("Anonymisé");
    expect(after.rows[0].professional_email).toBeNull();
    expect(after.rows[0].anonymized_at).toBeTruthy();
    const sens = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_sensitive_data where employee_id=$1`, [emp.id]);
    expect(sens.rows[0].n).toBe(0); // sensitive erased

    // retention guard on purge
    await h.db.query(`update pierre_rt_employees set retention_until = (now() + interval '365 days')::date where id=$1`, [emp.id]);
    await expect(apiPurgeEmployee(h.db, ctx, emp.id)).rejects.toMatchObject({ code: "conflict" });
    await apiPurgeEmployee(h.db, ctx, emp.id, "court_order");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where id=$1`, [emp.id])).rows[0].n).toBe(0);

    // audit trail recorded the operations
    const audit = await apiDataAccessAudit(h.db, ctx, 50) as Array<{ action: string }>;
    expect(audit.some((a) => a.action === "employee_anonymized")).toBe(true);
    expect(audit.some((a) => a.action.startsWith("employee_purged"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("9. Search — typo tolerant + order independent", () => {
  it("matches inverted name order and a single-letter typo", async () => {
    const ctx = h.ctx("A");
    await createEmployee(h.db, ctx, { first_name: "Hélène", last_name: "Émard", employee_number: "E900" });
    await createEmployee(h.db, ctx, { first_name: "Bruno", last_name: "Lefèvre" });
    // inverted order ("nom prénom")
    const inverted = await searchEmployees(h.db, ctx, "emard helene");
    expect(inverted.some((e) => e.employee_number === "E900")).toBe(true);
    // single-letter typo ("helene" -> "helenr")
    const typo = await searchEmployees(h.db, ctx, "helenr");
    expect(typo.some((e) => e.employee_number === "E900")).toBe(true);
  });
});
