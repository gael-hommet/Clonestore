// src/lib/pierre/v1/__integration__/p82c-route-security.itest.ts
// PHASE 8.2-C correction — authorization the routes enforce, proven vs real
// Postgres: unauthenticated, permission denied, cross-tenant, suspended member,
// suspended company, viewer vs owner, stable error codes, no secret leakage.
// These exercise the exact (db, ctx) handler layer the route files call.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext } from "../tenant-context";
import { errorBody, toRuntimeError } from "../errors";
import {
  apiCreateInvitation, apiAnonymizeEmployee, apiWriteSensitive, apiReadSensitive,
  apiImportPreview, apiGetEmployee360, apiSwitchCompany, apiArchiveRole, apiPurgeEmployee,
  apiCreateRole, apiSuspendMember, apiArchiveSite, apiPatchEmployee,
} from "../api";
import { createEmployee } from "../employees";
import { createSite } from "../sites";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

async function addMember(company: string, user: string, role = "viewer", status = "active"): Promise<string> {
  const id = newUuid();
  await h.db.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,$4,$5)`, [id, company, user, role, status]);
  return id;
}

describe("route authorization — identity & lifecycle gates", () => {
  it("unauthenticated → unauthenticated (401)", async () => {
    await expect(resolveTenantContext(h.db, { user_id: null, company_id: h.companyA })).rejects.toMatchObject({ code: "unauthenticated", status: 401 });
  });

  it("suspended membership → membership_suspended (403), NOT a legacy fallback code", async () => {
    const u = newUuid();
    await addMember(h.companyA, u, "hr_manager", "suspended");
    await expect(resolveTenantContext(h.db, { user_id: u, company_id: h.companyA })).rejects.toMatchObject({ code: "membership_suspended", status: 403 });
  });

  it("suspended company → company_suspended (403)", async () => {
    await h.db.query(`update pierre_rt_companies set status='suspended' where id=$1`, [h.companyA]);
    await expect(resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA })).rejects.toMatchObject({ code: "company_suspended", status: 403 });
  });

  it("company switch to a non-member company → tenant_access_denied (403)", async () => {
    await expect(apiSwitchCompany(h.db, h.userA, h.companyB)).rejects.toMatchObject({ code: "tenant_access_denied", status: 403 });
  });
});

describe("route authorization — permission denied (viewer) vs owner", () => {
  const viewer = () => h.ctx("A", "viewer");
  const owner = () => h.ctx("A");

  it("viewer cannot create invitations / roles / suspend members (forbidden)", async () => {
    await expect(apiCreateInvitation(h.db, viewer(), { email: "x@acme.test" })).rejects.toMatchObject({ code: "forbidden", status: 403 });
    await expect(apiCreateRole(h.db, viewer(), { label: "R" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiArchiveRole(h.db, viewer(), "OWNER")).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiSuspendMember(h.db, viewer(), newUuid())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("viewer cannot run GDPR ops, write sensitive data, or import (forbidden)", async () => {
    const emp = await createEmployee(h.db, owner(), { first_name: "A", last_name: "B" });
    await expect(apiAnonymizeEmployee(h.db, viewer(), emp.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiPurgeEmployee(h.db, viewer(), emp.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiWriteSensitive(h.db, viewer(), emp.id, "bank_details", "x")).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiReadSensitive(h.db, viewer(), emp.id, "bank_details")).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiImportPreview(h.db, viewer(), { csv: "prénom,nom\nA,B" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiPatchEmployee(h.db, viewer(), emp.id, { role_title: "X" }, emp.version ?? 1)).rejects.toMatchObject({ code: "forbidden" });
    await expect(apiArchiveSite(h.db, viewer(), newUuid())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("owner is allowed where the viewer is denied", async () => {
    const inv = await apiCreateInvitation(h.db, owner(), { email: "ok@acme.test" });
    expect(inv.id).toBeTruthy();
    const site = await createSite(h.db, owner(), { name: "S" });
    expect(site.id).toBeTruthy();
  });
});

describe("route authorization — cross-tenant isolation", () => {
  it("a tenant A context cannot read tenant B's employee (RLS-bound → not found)", async () => {
    const bEmp = await createEmployee(h.db, h.ctx("B"), { first_name: "Secret", last_name: "B" });
    await expect(apiGetEmployee360(h.db, h.ctx("A"), bEmp.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("a tenant A context cannot anonymize tenant B's employee", async () => {
    const bEmp = await createEmployee(h.db, h.ctx("B"), { first_name: "Secret", last_name: "B" });
    await expect(apiAnonymizeEmployee(h.db, h.ctx("A"), bEmp.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("error surface — stable codes, no secret leakage", () => {
  it("errorBody exposes only code/message (+ safe details); never a stack or SQL", () => {
    const forbidden = errorBody(toRuntimeError({ name: "x" }));
    expect(forbidden.error).toHaveProperty("code");
    expect(JSON.stringify(forbidden)).not.toMatch(/stack|password|secret|select \*/i);
  });

  it("an arbitrary thrown DB error is redacted to a generic internal error", () => {
    const re = toRuntimeError(new Error("duplicate key value violates unique constraint pierre_rt_secret"));
    const body = errorBody(re);
    expect(re.code).toBe("internal");
    expect(JSON.stringify(body)).not.toContain("pierre_rt_secret");
  });
});
