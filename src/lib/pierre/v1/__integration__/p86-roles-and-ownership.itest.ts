// src/lib/pierre/v1/__integration__/p86-roles-and-ownership.itest.ts
// PHASE 8.6 — roles + ownership, proven on real Postgres (PGlite). Exercises the REAL service modules:
//   - members.assignRole / removeRole (grant a second role, then revoke it; last-owner role removal refused);
//   - membership-invitations.createMembershipInvitation refusing to grant a role HIGHER than the inviter's
//     (a non-owner ADMIN inviting OWNER is forbidden — no privilege escalation via invite);
//   - company-access.transferCompanyOwnership promoting an active member to owner + demoting the previous
//     owner to admin, refusing transfer to a SUSPENDED member, and never leaving zero owners.
//
// Every ownership / status invariant is asserted against the database AFTER the operation, never inferred.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused, addMember } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid, newRequestId, newCorrelationId } from "../sql";
import type { TenantContext } from "../tenant-context";
import { assignRole, removeRole } from "../members";
import { createMembershipInvitation } from "../membership-invitations";
import { transferCompanyOwnership } from "../company-access";

const APP = "pierre_rt_app";

// Adapt the asRole `q` into a SqlExecutor so the real service modules run inside the role-bound,
// tenant-GUC-bound transaction (identical adapter to p86-foundation.itest.ts).
function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

const ALL_OWNER_PERMS: readonly string[] = [
  "company.read", "company.write", "company.admin",
  "mission.create", "mission.read", "mission.cancel",
  "employee.read", "employee.write", "employee.archive", "employee.sensitive.read", "employee.sensitive.write",
  "document.read", "document.write", "absence.read", "absence.write",
  "payroll_prep.read", "payroll_prep.write", "validation.read", "validation.decide",
  "pierre.use", "audit.read", "site.read", "site.write", "tenancy.admin",
  "task.read", "queue.admin", "gdpr.admin",
];

/** Build a TenantContext bound to a REAL seeded membership (so governed functions that key off
 *  ctx.membership_id / ctx.role operate on an actual row). */
function ctxFor(opts: {
  company_id: string; user_id: string; membership_id: string;
  role: TenantContext["role"]; role_keys: string[];
  permissions?: readonly string[];
}): TenantContext {
  return {
    company_id: opts.company_id,
    user_id: opts.user_id,
    membership_id: opts.membership_id,
    role: opts.role,
    role_keys: opts.role_keys,
    permissions: [...(opts.permissions ?? ALL_OWNER_PERMS)],
    site_ids: null,
    request_id: newRequestId(),
    correlation_id: newCorrelationId(),
  };
}

/** Create a fresh, isolated active company with a single active owner; returns its identifiers. */
async function freshCompanyWithOwner(h: Harness, name: string): Promise<{ company_id: string; owner_user: string; owner_membership: string }> {
  const company_id = newUuid();
  const owner_user = newUuid();
  const owner_membership = newUuid();
  await h.pg.query(`insert into pierre_rt_companies (id, name, status) values ($1,$2,'active')`, [company_id, name]);
  await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','active')`, [owner_membership, company_id, owner_user]);
  // Mirror the legacy owner role into the multi-role table so role_key based checks see the OWNER role too.
  await h.pg.query(`insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,'OWNER') on conflict do nothing`, [company_id, owner_membership]);
  return { company_id, owner_user, owner_membership };
}

async function roleKeysOf(h: Harness, membershipId: string): Promise<string[]> {
  const r = await h.pg.query(`select role_key from pierre_rt_membership_roles where membership_id=$1 order by role_key`, [membershipId]);
  return r.rows.map((x) => (x as { role_key: string }).role_key);
}
async function legacyRoleOf(h: Harness, companyId: string, membershipId: string): Promise<string> {
  const r = await h.pg.query(`select role from pierre_rt_members where company_id=$1 and id=$2`, [companyId, membershipId]);
  return (r.rows[0] as { role: string }).role;
}
async function activeOwnerCount(h: Harness, companyId: string): Promise<number> {
  const r = await h.pg.query(
    `select count(distinct m.id)::int as n from pierre_rt_members m
       where m.company_id=$1 and m.status='active'
         and (m.role='owner' or exists (select 1 from pierre_rt_membership_roles mr where mr.membership_id=m.id and mr.role_key='OWNER'))`,
    [companyId]);
  return (r.rows[0] as { n: number }).n;
}

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

describe("P8.6 roles — assignRole / removeRole", () => {
  it("an owner grants HR_MANAGER to a second member, then revokes it", async () => {
    const { company_id, owner_user, owner_membership } = await freshCompanyWithOwner(h, "Roles Co A");
    const ownerCtx = ctxFor({ company_id, user_id: owner_user, membership_id: owner_membership, role: "owner", role_keys: ["OWNER"] });
    const second = await addMember(h, company_id, "hr_operator");

    // initially the second member holds no system role-keys
    expect(await roleKeysOf(h, second.membership_id)).toEqual([]);

    // grant HR_MANAGER (a real, seeded system role)
    await assignRole(h.db, ownerCtx, second.membership_id, "HR_MANAGER");
    expect(await roleKeysOf(h, second.membership_id)).toContain("HR_MANAGER");

    // assign is idempotent (on conflict do nothing) — re-granting does not duplicate
    await assignRole(h.db, ownerCtx, second.membership_id, "HR_MANAGER");
    const afterReassign = await roleKeysOf(h, second.membership_id);
    expect(afterReassign.filter((k) => k === "HR_MANAGER")).toHaveLength(1);

    // an access/data-access audit row was written for the grant
    const audit = await h.pg.query(
      `select count(*)::int as n from pierre_rt_data_access_log where company_id=$1 and subject_id=$2 and action like 'role_assigned:%'`,
      [company_id, second.membership_id]);
    expect((audit.rows[0] as { n: number }).n).toBeGreaterThan(0);

    // revoke HR_MANAGER — the role-key is gone (this is NOT an owner role, so no last-owner guard fires)
    await removeRole(h.db, ownerCtx, second.membership_id, "HR_MANAGER");
    expect(await roleKeysOf(h, second.membership_id)).not.toContain("HR_MANAGER");
  });

  it("removing the OWNER role from the sole owner is refused (conflict); >=1 owner is preserved", async () => {
    const { company_id, owner_user, owner_membership } = await freshCompanyWithOwner(h, "Roles Co B");
    const ownerCtx = ctxFor({ company_id, user_id: owner_user, membership_id: owner_membership, role: "owner", role_keys: ["OWNER"] });

    expect(await activeOwnerCount(h, company_id)).toBe(1);

    // the lone owner cannot have its OWNER role-key stripped
    let conflict = false;
    try {
      await removeRole(h.db, ownerCtx, owner_membership, "OWNER");
    } catch (e) {
      conflict = (e as { code?: string }).code === "conflict";
    }
    expect(conflict).toBe(true);

    // invariant intact: the OWNER role-key (and the owner) survives
    expect(await roleKeysOf(h, owner_membership)).toContain("OWNER");
    expect(await activeOwnerCount(h, company_id)).toBe(1);
  });

  it("removing OWNER is allowed once a SECOND owner exists (never the last)", async () => {
    const { company_id, owner_user, owner_membership } = await freshCompanyWithOwner(h, "Roles Co C");
    const ownerCtx = ctxFor({ company_id, user_id: owner_user, membership_id: owner_membership, role: "owner", role_keys: ["OWNER"] });

    // a second active owner (legacy role + role-key)
    const second = await addMember(h, company_id, "owner");
    await h.pg.query(`insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,'OWNER') on conflict do nothing`, [company_id, second.membership_id]);
    expect(await activeOwnerCount(h, company_id)).toBe(2);

    // now the first owner's OWNER *role-key* may be removed — the second owner remains
    await removeRole(h.db, ownerCtx, second.membership_id, "OWNER");
    expect(await roleKeysOf(h, second.membership_id)).not.toContain("OWNER");
  });
});

describe("P8.6 invitations — no privilege escalation via invite", () => {
  it("a non-owner (ADMIN) cannot invite to OWNER, but CAN invite to a role at/below its own", async () => {
    const { company_id, owner_user, owner_membership } = await freshCompanyWithOwner(h, "Invite Co");
    // engineer an inviter context whose role_keys LACK OWNER (an ADMIN) yet still hold tenancy.admin.
    const adminMember = await addMember(h, company_id, "admin");
    const adminCtx = ctxFor({
      company_id, user_id: adminMember.user_id, membership_id: adminMember.membership_id,
      role: "admin", role_keys: ["ADMIN"],
    });

    // inviting OWNER (rank 100) from an ADMIN inviter (rank 90) is forbidden. The rank check fires
    // BEFORE any DB query, so h.db is never actually touched here.
    let forbidden = false;
    try {
      await createMembershipInvitation(h.db, adminCtx, { email: "boss@example.com", roles: ["OWNER"] });
    } catch (e) {
      forbidden = (e as { code?: string }).code === "forbidden";
    }
    expect(forbidden).toBe(true);

    // and the governed insert never happened — no invitation row exists for that email
    const none = await h.pg.query(`select count(*)::int as n from pierre_rt_invitations where company_id=$1 and email_normalized=$2`, [company_id, "boss@example.com"]);
    expect((none.rows[0] as { n: number }).n).toBe(0);

    // inviting HR_MANAGER (rank 70 < 90) succeeds — the create persists a pending invitation, token hashed only
    const res = await asRole(h, APP, company_id, (q) =>
      createMembershipInvitation(execFrom(q), adminCtx, { email: "hr@example.com", roles: ["HR_MANAGER"] }));
    expect(res.invitation_id).toBeTruthy();
    expect(res.token).toBeTruthy();

    const inv = await h.pg.query(
      `select status, roles, email_normalized from pierre_rt_invitations where id=$1`, [res.invitation_id]);
    const row = inv.rows[0] as { status: string; roles: string[]; email_normalized: string };
    expect(row.status).toBe("pending");
    expect(row.roles).toContain("HR_MANAGER");
    expect(row.email_normalized).toBe("hr@example.com");

    // sanity: a real owner is still present (we never touched ownership here)
    void owner_user; void owner_membership;
    expect(await activeOwnerCount(h, company_id)).toBe(1);
  });
});

describe("P8.6 ownership transfer", () => {
  it("promotes an active member to owner and demotes the previous owner to admin", async () => {
    const { company_id, owner_user, owner_membership } = await freshCompanyWithOwner(h, "Transfer Co A");
    const ownerCtx = ctxFor({ company_id, user_id: owner_user, membership_id: owner_membership, role: "owner", role_keys: ["OWNER"] });
    const target = await addMember(h, company_id, "admin"); // active member

    expect(await activeOwnerCount(h, company_id)).toBe(1);

    const result = await asRole(h, APP, company_id, (q) =>
      transferCompanyOwnership(execFrom(q), ownerCtx, { to_membership_id: target.membership_id }));
    expect(result).toBe("transferred");

    // target promoted to owner (legacy role + OWNER role-key); previous owner demoted to admin
    expect(await legacyRoleOf(h, company_id, target.membership_id)).toBe("owner");
    expect(await roleKeysOf(h, target.membership_id)).toContain("OWNER");
    expect(await legacyRoleOf(h, company_id, owner_membership)).toBe("admin");
    expect(await roleKeysOf(h, owner_membership)).not.toContain("OWNER");

    // company owner_user_id repointed at the new owner; a single owner remains
    const co = await h.pg.query(`select owner_user_id from pierre_rt_companies where id=$1`, [company_id]);
    expect((co.rows[0] as { owner_user_id: string }).owner_user_id).toBe(target.user_id);
    expect(await activeOwnerCount(h, company_id)).toBe(1);

    // a company.ownership_transferred access event was logged
    const ev = await h.pg.query(
      `select count(*)::int as n from pierre_rt_company_access_events where company_id=$1 and event_kind='company.ownership_transferred'`, [company_id]);
    expect((ev.rows[0] as { n: number }).n).toBe(1);
  });

  it("transferring ownership to a SUSPENDED member is refused; ownership is unchanged", async () => {
    const { company_id, owner_user, owner_membership } = await freshCompanyWithOwner(h, "Transfer Co B");
    const ownerCtx = ctxFor({ company_id, user_id: owner_user, membership_id: owner_membership, role: "owner", role_keys: ["OWNER"] });
    const suspended = await addMember(h, company_id, "admin");
    await h.pg.query(`update pierre_rt_members set status='suspended' where company_id=$1 and id=$2`, [company_id, suspended.membership_id]);

    const refusedTransfer = await refused(() =>
      asRole(h, APP, company_id, (q) => transferCompanyOwnership(execFrom(q), ownerCtx, { to_membership_id: suspended.membership_id })));
    expect(refusedTransfer).toBe(true);

    // unchanged: original owner still owner, suspended member never became owner, still exactly one owner
    expect(await legacyRoleOf(h, company_id, owner_membership)).toBe("owner");
    expect(await legacyRoleOf(h, company_id, suspended.membership_id)).toBe("admin");
    expect(await roleKeysOf(h, suspended.membership_id)).not.toContain("OWNER");
    expect(await activeOwnerCount(h, company_id)).toBe(1);
  });

  it("transfer keeping the previous owner leaves the company with TWO owners", async () => {
    const { company_id, owner_user, owner_membership } = await freshCompanyWithOwner(h, "Transfer Co C");
    const ownerCtx = ctxFor({ company_id, user_id: owner_user, membership_id: owner_membership, role: "owner", role_keys: ["OWNER"] });
    const target = await addMember(h, company_id, "admin");

    const result = await asRole(h, APP, company_id, (q) =>
      transferCompanyOwnership(execFrom(q), ownerCtx, { to_membership_id: target.membership_id, keep_previous_owner: true }));
    expect(result).toBe("transferred");

    // both are owners now
    expect(await legacyRoleOf(h, company_id, owner_membership)).toBe("owner");
    expect(await legacyRoleOf(h, company_id, target.membership_id)).toBe("owner");
    expect(await activeOwnerCount(h, company_id)).toBe(2);
  });

  it("a non-owner caller cannot transfer ownership (guarded before touching the DB)", async () => {
    const { company_id } = await freshCompanyWithOwner(h, "Transfer Co D");
    const adminMember = await addMember(h, company_id, "admin");
    const target = await addMember(h, company_id, "admin");
    const adminCtx = ctxFor({
      company_id, user_id: adminMember.user_id, membership_id: adminMember.membership_id,
      role: "admin", role_keys: ["ADMIN"],
    });

    let forbidden = false;
    try {
      await asRole(h, APP, company_id, (q) => transferCompanyOwnership(execFrom(q), adminCtx, { to_membership_id: target.membership_id }));
    } catch (e) {
      forbidden = (e as { code?: string }).code === "forbidden";
    }
    expect(forbidden).toBe(true);
    expect(await legacyRoleOf(h, company_id, target.membership_id)).toBe("admin");
  });
});
