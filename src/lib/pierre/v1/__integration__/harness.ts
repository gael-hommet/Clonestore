// src/lib/pierre/v1/__integration__/harness.ts
// PHASE 8.1 — Integration harness. Real in-process PostgreSQL 16 via PGlite
// (no Docker, no system binaries). Applies the real migration, seeds two
// tenants, exposes a SqlExecutor + TenantContext builders.
//
// PGlite is a devDependency, used ONLY by integration tests/bench — never by the
// shipped runtime (which depends only on SqlExecutor).

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import type { SqlExecutor, SqlRow } from "../sql";
import { newUuid, newRequestId, newCorrelationId } from "../sql";
import type { TenantContext, MemberRole } from "../tenant-context";

const MIG_DIR = resolve(process.cwd(), "supabase/migrations");
/** All canonical runtime migrations (pierre_v1, pierre_v2, …) in order. */
function migrationSql(): string[] {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql") && f.includes("pierre_v"))
    .sort()
    .map((f) => readFileSync(resolve(MIG_DIR, f), "utf-8"));
}

export type Harness = {
  db: SqlExecutor;
  pg: PGlite;
  companyA: string;
  companyB: string;
  userA: string;
  userB: string;
  /** PIERRE SELLABILITY STRESS TEST (2026-07-26) — 2 ADDITIONAL real tenants (C, D), additive
   *  only. Existing A/B seeding and behavior are untouched — every prior caller of ctx("A"|"B")
   *  keeps working identically. Added so multi-tenant campaigns can use 4 REAL companies instead
   *  of 4 textual profile names sharing a single tenant. */
  companyC: string;
  companyD: string;
  userC: string;
  userD: string;
  ctx(company: "A" | "B" | "C" | "D", role?: MemberRole): TenantContext;
  /** Run a block as the restricted (non-superuser) role with a tenant GUC bound —
   *  this is how RLS isolation is actually proven. */
  asTenantRole<T>(companyId: string, fn: (q: (text: string, params?: readonly unknown[]) => Promise<{ rows: SqlRow[] }>) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

function wrap(pg: PGlite): SqlExecutor {
  const exec: SqlExecutor = {
    async query<T = SqlRow>(text: string, params?: readonly unknown[]) {
      const r = await pg.query(text, params ? [...params] : undefined);
      return { rows: r.rows as T[] };
    },
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return pg.transaction(async (tx) => {
        const txExec: SqlExecutor = {
          async query<T2 = SqlRow>(text: string, params?: readonly unknown[]) {
            const r = await tx.query(text, params ? [...params] : undefined);
            return { rows: r.rows as T2[] };
          },
          transaction(inner) { return inner(txExec); },
        };
        return fn(txExec);
      }) as Promise<T>;
    },
  };
  return exec;
}

/**
 * PHASE 8.6 — bring a harness company to the product-access decision `allowed` via the minimal real state
 * the gate reads: an ACTIVE product entitlement + a COMPLETED onboarding session. Route-handler suites
 * that exercise the real handlers (now product-gated) must establish this precondition — the gate is never
 * relaxed for tests; the fixture is brought up to a genuinely-entitled, onboarded company instead.
 */
export async function provisionActiveCompany(h: Harness, companyId: string): Promise<void> {
  await h.pg.query(
    `insert into pierre_rt_product_entitlements (id, company_id, product_key, status, source_type, starts_at)
       values (gen_random_uuid(), $1, 'pierre', 'active', 'operator_activation', now())
       on conflict do nothing`,
    [companyId],
  );
  await h.pg.query(
    `insert into pierre_rt_onboarding_sessions (id, company_id, product_key, status, progress_percent, completed_at)
       values (gen_random_uuid(), $1, 'pierre', 'completed', 100, now())
       on conflict do nothing`,
    [companyId],
  );
}

export async function createHarness(): Promise<Harness> {
  const pg = await PGlite.create();
  for (const sql of migrationSql()) await pg.exec(sql);
  // B3-R2 — TEST-ONLY provider registration (superuser, harness-only). The DEPLOYABLE v18
  // migration declares ONLY live providers; the deterministic Fake + sandbox providers exist
  // exclusively here so B2F/B3 functional tests can drive the governed ingress. This NEVER
  // weakens the production migration (production never runs this seed).
  await pg.exec(`insert into pierre_rt_signature_provider_registry (provider, kind, enabled) values
    ('fake_provider','test',true), ('internal_sandbox','sandbox',true), ('local_sandbox','sandbox',true)
    on conflict (provider) do nothing`).catch(() => { /* tolerate pre-v18 chains */ });
  const db = wrap(pg);

  const companyA = newUuid();
  const companyB = newUuid();
  const userA = newUuid();
  const userB = newUuid();
  const companyC = newUuid();
  const companyD = newUuid();
  const userC = newUuid();
  const userD = newUuid();

  // P16E §3 (F17) — a real company has a verified LEGAL name distinct from its display name; seed
  // it so governed contract generation (which requires company.legal_name) has a valid identity.
  await pg.query("insert into pierre_rt_companies (id, name, legal_name) values ($1,$2,$3),($4,$5,$6)",
    [companyA, "Tenant A", "TENANT A SAS", companyB, "Tenant B", "TENANT B SAS"]);
  await pg.query("insert into pierre_rt_members (id, company_id, user_id, role) values ($1,$2,$3,'owner'),($4,$5,$6,'owner')",
    [newUuid(), companyA, userA, newUuid(), companyB, userB]);
  // Additive C/D tenants — same real seeding shape as A/B, own row, own owner membership.
  await pg.query("insert into pierre_rt_companies (id, name, legal_name) values ($1,$2,$3),($4,$5,$6)",
    [companyC, "Tenant C", "TENANT C SAS", companyD, "Tenant D", "TENANT D SAS"]);
  await pg.query("insert into pierre_rt_members (id, company_id, user_id, role) values ($1,$2,$3,'owner'),($4,$5,$6,'owner')",
    [newUuid(), companyC, userC, newUuid(), companyD, userD]);

  return {
    db, pg, companyA, companyB, userA, userB, companyC, companyD, userC, userD,
    ctx(company, role: MemberRole = "owner"): TenantContext {
      const company_id = company === "A" ? companyA : company === "B" ? companyB : company === "C" ? companyC : companyD;
      const user_id = company === "A" ? userA : company === "B" ? userB : company === "C" ? userC : userD;
      // viewer = read-only (no sensitive, no write); owner = full OWNER permission set.
      const perms = role === "viewer"
        ? (["company.read", "mission.read", "task.read", "validation.read", "employee.read", "site.read"] as const)
        : ([
            "company.read", "company.write", "company.admin",
            "mission.create", "mission.read", "mission.cancel",
            "employee.read", "employee.write", "employee.archive", "employee.sensitive.read", "employee.sensitive.write",
            "document.read", "document.write", "absence.read", "absence.write",
            "payroll_prep.read", "payroll_prep.write", "validation.read", "validation.decide",
            "pierre.use", "audit.read", "site.read", "site.write", "tenancy.admin",
            "task.read", "queue.admin", "gdpr.admin",
          ] as const);
      const ROLE_KEY: Record<string, string> = { owner: "OWNER", admin: "ADMIN", hr_manager: "HR_MANAGER", hr_operator: "HR_OPERATOR", viewer: "VIEWER" };
      return {
        company_id, user_id, membership_id: newUuid(), role, role_keys: [ROLE_KEY[role] ?? "VIEWER"],
        permissions: [...perms], site_ids: null, request_id: newRequestId(), correlation_id: newCorrelationId(),
      };
    },
    async asTenantRole(companyId, fn) {
      // Switch to the restricted role + bind the tenant GUC inside one tx.
      const r = await pg.transaction(async (tx) => {
        await tx.exec("set local role pierre_rt_app");
        await tx.query("select set_config('app.current_company', $1, true)", [companyId]);
        return fn(async (text, params) => {
          const res = await tx.query(text, params ? [...params] : undefined);
          return { rows: res.rows as SqlRow[] };
        });
      });
      return r as never;
    },
    async close() { await pg.close(); },
  };
}
