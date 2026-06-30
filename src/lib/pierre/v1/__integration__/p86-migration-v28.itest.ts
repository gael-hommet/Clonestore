// src/lib/pierre/v1/__integration__/p86-migration-v28.itest.ts
// PHASE 8.6 — SCHEMA INTEGRITY of the v28 "customer product & access lifecycle" migration, proven on
// real Postgres (PGlite). This file makes no assumption about runtime behaviour; it inspects the actual
// catalog (information_schema / pg_catalog) to assert that the deployable migration created exactly the
// structures the foundation relies on: the 6 new tables, the 2 least-privilege roles, RLS that is BOTH
// enabled AND forced on every new tenant table, the append-only audit invariant (UPDATE/DELETE refused
// by trigger), the single-live-entitlement partial unique index, the invitation reinforcement columns +
// hashed-token unique index, and the tenant-safe composite FK from onboarding steps back to sessions.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { refused } from "./p84-r1-helpers";
import { newUuid } from "../sql";

const NEW_TABLES = [
  "pierre_rt_commercial_events",
  "pierre_rt_product_entitlements",
  "pierre_rt_customer_activations",
  "pierre_rt_onboarding_sessions",
  "pierre_rt_onboarding_steps",
  "pierre_rt_company_access_events",
] as const;

// every new table carries RLS (the 5 tenant tables + the pre-tenant commercial-events ledger).
const RLS_TABLES = NEW_TABLES;

const NEW_ROLES = ["pierre_rt_billing_webhook", "pierre_rt_customer_activation_worker"] as const;

async function rows<T = Record<string, unknown>>(h: Harness, text: string, params?: readonly unknown[]): Promise<T[]> {
  const r = await h.pg.query(text, params ? [...params] : undefined);
  return r.rows as T[];
}

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

describe("P8.6 v28 migration — tables", () => {
  it("creates all 6 new tables as ordinary base tables in the public schema", async () => {
    const present = await rows<{ table_name: string }>(
      h,
      `select table_name from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE' and table_name = any($1::text[])`,
      [NEW_TABLES as unknown as string[]],
    );
    const names = present.map((r) => r.table_name).sort();
    expect(names).toEqual([...NEW_TABLES].sort());
    // and the count matches exactly (no table silently missing)
    expect(names.length).toBe(NEW_TABLES.length);
  });

  it("each new table has the expected anchor columns (id + tenant/owner scoping)", async () => {
    // commercial events are pre-tenant: company_id is nullable; the rest are company-scoped.
    const checks: Array<{ table: string; cols: string[] }> = [
      { table: "pierre_rt_commercial_events", cols: ["id", "provider", "provider_event_id", "event_key", "payload_hash", "application_status", "company_id"] },
      { table: "pierre_rt_product_entitlements", cols: ["id", "company_id", "product_key", "status", "version"] },
      { table: "pierre_rt_customer_activations", cols: ["id", "provisioning_key", "company_id", "status", "owner_user_id"] },
      { table: "pierre_rt_onboarding_sessions", cols: ["id", "company_id", "product_key", "status", "progress_percent"] },
      { table: "pierre_rt_onboarding_steps", cols: ["id", "company_id", "session_id", "step_key", "status", "required"] },
      { table: "pierre_rt_company_access_events", cols: ["id", "company_id", "event_kind", "created_at"] },
    ];
    for (const { table, cols } of checks) {
      const got = await rows<{ column_name: string }>(
        h,
        `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
        [table],
      );
      const colSet = new Set(got.map((r) => r.column_name));
      for (const c of cols) expect(colSet, `${table}.${c}`).toContain(c);
    }
  });
});

describe("P8.6 v28 migration — least-privilege roles", () => {
  it("creates both dedicated nologin roles", async () => {
    const got = await rows<{ rolname: string; rolcanlogin: boolean }>(
      h,
      `select rolname, rolcanlogin from pg_roles where rolname = any($1::text[])`,
      [NEW_ROLES as unknown as string[]],
    );
    const names = got.map((r) => r.rolname).sort();
    expect(names).toEqual([...NEW_ROLES].sort());
    // both are NOLOGIN service roles
    for (const r of got) expect(r.rolcanlogin).toBe(false);
  });

  it("the application role from the foundation still exists alongside the new roles", async () => {
    const app = await rows(h, `select 1 from pg_roles where rolname='pierre_rt_app'`);
    expect(app.length).toBe(1);
  });
});

describe("P8.6 v28 migration — RLS enabled AND forced", () => {
  it("every new table has both relrowsecurity and relforcerowsecurity set", async () => {
    const got = await rows<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      h,
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname = any($1::text[])`,
      [RLS_TABLES as unknown as string[]],
    );
    expect(got.length).toBe(RLS_TABLES.length);
    for (const r of got) {
      expect(r.relrowsecurity, `${r.relname} RLS enabled`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname} RLS forced`).toBe(true);
    }
  });

  it("each new table carries a per-tenant isolation policy", async () => {
    const got = await rows<{ tablename: string; policyname: string }>(
      h,
      `select tablename, policyname from pg_policies where schemaname='public' and tablename = any($1::text[])`,
      [RLS_TABLES as unknown as string[]],
    );
    const byTable = new Set(got.map((r) => r.tablename));
    for (const t of RLS_TABLES) expect(byTable, `policy on ${t}`).toContain(t);
    // the canonical naming convention is honoured
    for (const r of got) expect(r.policyname).toBe(`rt_iso_${r.tablename}`);
  });
});

describe("P8.6 v28 migration — append-only access-events audit", () => {
  it("declares BEFORE UPDATE and BEFORE DELETE triggers backed by the append-only guard fn", async () => {
    const trg = await rows<{ tgname: string; tgenabled: string }>(
      h,
      `select t.tgname, t.tgenabled
         from pg_trigger t join pg_class c on c.oid=t.tgrelid
        where c.relname='pierre_rt_company_access_events' and not t.tgisinternal`,
    );
    const names = trg.map((r) => r.tgname);
    expect(names).toContain("trg_rt_access_event_no_upd");
    expect(names).toContain("trg_rt_access_event_no_del");
    for (const r of trg) expect(r.tgenabled).not.toBe("D"); // not disabled
    // the guard function exists
    const fn = await rows(h, `select 1 from pg_proc where proname='pierre_rt_access_event_append_only'`);
    expect(fn.length).toBe(1);
  });

  it("refuses a raw UPDATE and a raw DELETE on an inserted audit row (insert-only)", async () => {
    // insert via the governed SECURITY DEFINER logger (the only sanctioned write path)
    const evId = await rows<{ id: string }>(
      h,
      `insert into pierre_rt_company_access_events (id, company_id, event_kind, new_state)
       values (gen_random_uuid(), $1, 'test.audit_immutability', 'created') returning id`,
      [h.companyA],
    );
    const id = evId[0].id;
    expect(id).toBeTruthy();

    const updateRefused = await refused(() =>
      h.pg.query(`update pierre_rt_company_access_events set new_state='tampered' where id=$1`, [id]),
    );
    expect(updateRefused).toBe(true);

    const deleteRefused = await refused(() =>
      h.pg.query(`delete from pierre_rt_company_access_events where id=$1`, [id]),
    );
    expect(deleteRefused).toBe(true);

    // the row is still present and untouched
    const after = await rows<{ new_state: string }>(
      h,
      `select new_state from pierre_rt_company_access_events where id=$1`,
      [id],
    );
    expect(after.length).toBe(1);
    expect(after[0].new_state).toBe("created");
  });
});

describe("P8.6 v28 migration — single-live-entitlement partial unique index", () => {
  it("the partial unique index over (company_id, product_key) WHERE live exists", async () => {
    const idx = await rows<{ indexname: string; indexdef: string }>(
      h,
      `select indexname, indexdef from pg_indexes where schemaname='public' and tablename='pierre_rt_product_entitlements' and indexname=$1`,
      ["uq_pierre_rt_entitlement_live"],
    );
    expect(idx.length).toBe(1);
    const def = idx[0].indexdef.toLowerCase();
    expect(def).toContain("unique");
    expect(def).toContain("company_id");
    expect(def).toContain("product_key");
    // it is a PARTIAL index over the non-terminal statuses
    expect(def).toContain("where");
    expect(def).toMatch(/pending|active|grace|suspended/);
  });

  it("the index actually forbids a SECOND live entitlement for the same (company, product)", async () => {
    const company = newUuid();
    await h.pg.query(`insert into pierre_rt_companies (id, name) values ($1,'Ent Co')`, [company]);
    await h.pg.query(
      `insert into pierre_rt_product_entitlements (id, company_id, product_key, status) values (gen_random_uuid(),$1,'pierre','active')`,
      [company],
    );
    const dupRefused = await refused(() =>
      h.pg.query(
        `insert into pierre_rt_product_entitlements (id, company_id, product_key, status) values (gen_random_uuid(),$1,'pierre','grace')`,
        [company],
      ),
    );
    expect(dupRefused).toBe(true);
    // a TERMINAL (cancelled) entitlement does NOT collide — a fresh live one is allowed afterwards
    await h.pg.query(
      `update pierre_rt_product_entitlements set status='cancelled', cancelled_at=now() where company_id=$1`,
      [company],
    );
    const freshAllowed = await refused(() =>
      h.pg.query(
        `insert into pierre_rt_product_entitlements (id, company_id, product_key, status) values (gen_random_uuid(),$1,'pierre','active')`,
        [company],
      ),
    );
    expect(freshAllowed).toBe(false);
  });
});

describe("P8.6 v28 migration — invitation reinforcement", () => {
  it("adds email_normalized / accepted_by / updated_at / version columns", async () => {
    const got = await rows<{ column_name: string; is_nullable: string }>(
      h,
      `select column_name, is_nullable from information_schema.columns
        where table_schema='public' and table_name='pierre_rt_invitations'`,
    );
    const cols = new Set(got.map((r) => r.column_name));
    for (const c of ["email_normalized", "accepted_by", "updated_at", "version", "superseded_at"]) {
      expect(cols, `pierre_rt_invitations.${c}`).toContain(c);
    }
    // the raw token is NEVER a column — only the hash is persisted
    expect(cols).toContain("token_hash");
    expect(cols).not.toContain("token");
    expect(cols).not.toContain("token_raw");
  });

  it("token_hash has a UNIQUE index (one-time tokens never reused)", async () => {
    const idx = await rows<{ indexname: string; indexdef: string }>(
      h,
      `select indexname, indexdef from pg_indexes where schemaname='public' and tablename='pierre_rt_invitations' and indexname=$1`,
      ["uq_pierre_rt_invitation_token_hash"],
    );
    expect(idx.length).toBe(1);
    const def = idx[0].indexdef.toLowerCase();
    expect(def).toContain("unique");
    expect(def).toContain("token_hash");
  });

  it("the unique token_hash index is actually enforced at the DB level", async () => {
    const company = h.companyA;
    const th = "th_dup_" + newUuid();
    await h.pg.query(
      `insert into pierre_rt_invitations (id, company_id, email, email_normalized, token_hash, roles, invited_by, status, expires_at)
       values (gen_random_uuid(),$1,'a@x.test','a@x.test',$2,array['VIEWER']::text[],$3,'pending',now()+interval '1 hour')`,
      [company, th, h.userA],
    );
    const dup = await refused(() =>
      h.pg.query(
        `insert into pierre_rt_invitations (id, company_id, email, email_normalized, token_hash, roles, invited_by, status, expires_at)
         values (gen_random_uuid(),$1,'b@x.test','b@x.test',$2,array['VIEWER']::text[],$3,'pending',now()+interval '1 hour')`,
        [company, th, h.userA],
      ),
    );
    expect(dup).toBe(true);
  });
});

describe("P8.6 v28 migration — tenant-safe composite FK", () => {
  it("onboarding_steps(company_id, session_id) → onboarding_sessions(company_id, id) FK exists", async () => {
    const fk = await rows<{
      conname: string;
      child: string;
      parent: string;
      child_cols: string[];
      parent_cols: string[];
      contype: string;
    }>(
      h,
      `select c.conname,
              cr.relname as child,
              pr.relname as parent,
              (select array_agg(att.attname order by k.ord)
                 from unnest(c.conkey) with ordinality k(attnum, ord)
                 join pg_attribute att on att.attrelid=c.conrelid and att.attnum=k.attnum) as child_cols,
              (select array_agg(att.attname order by k.ord)
                 from unnest(c.confkey) with ordinality k(attnum, ord)
                 join pg_attribute att on att.attrelid=c.confrelid and att.attnum=k.attnum) as parent_cols,
              c.contype
         from pg_constraint c
         join pg_class cr on cr.oid=c.conrelid
         join pg_class pr on pr.oid=c.confrelid
        where c.conname=$1`,
      ["fk_rt_onboarding_step_session_ct"],
    );
    expect(fk.length).toBe(1);
    const row = fk[0];
    expect(row.contype).toBe("f"); // foreign key
    expect(row.child).toBe("pierre_rt_onboarding_steps");
    expect(row.parent).toBe("pierre_rt_onboarding_sessions");
    expect(row.child_cols).toEqual(["company_id", "session_id"]);
    expect(row.parent_cols).toEqual(["company_id", "id"]);
  });

  it("the composite FK is enforced: a step pointing at a session in a DIFFERENT company is refused", async () => {
    // build a real session in companyA
    const sessionId = newUuid();
    await h.pg.query(
      `insert into pierre_rt_onboarding_sessions (id, company_id, product_key, status) values ($1,$2,'pierre','in_progress')`,
      [sessionId, h.companyA],
    );
    // a step in companyA pointing at that session is accepted
    const ok = await refused(() =>
      h.pg.query(
        `insert into pierre_rt_onboarding_steps (id, company_id, session_id, step_key) values (gen_random_uuid(),$1,$2,'k1')`,
        [h.companyA, sessionId],
      ),
    );
    expect(ok).toBe(false);
    // the SAME session_id but a DIFFERENT company_id violates the composite FK (tenant cross-binding blocked)
    const cross = await refused(() =>
      h.pg.query(
        `insert into pierre_rt_onboarding_steps (id, company_id, session_id, step_key) values (gen_random_uuid(),$1,$2,'k2')`,
        [h.companyB, sessionId],
      ),
    );
    expect(cross).toBe(true);
  });
});
