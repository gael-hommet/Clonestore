// src/lib/pierre/v1/__integration__/p86-security-definer-grants.itest.ts
// PHASE 8.6 — every v28 governed function is a hardened SECURITY DEFINER: a fixed, safe search_path is
// pinned; EXECUTE is revoked from PUBLIC; and each role can execute ONLY its own function set (billing
// cannot become an activation worker and vice-versa; the app role has no commercial/activation truth).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";

const V28_FUNCS = [
  "pierre_rt_log_access_event",
  "pierre_rt_ingest_commercial_event", "pierre_rt_resolve_commercial_event", "pierre_rt_apply_entitlement_event",
  "pierre_rt_apply_commercial_event", "pierre_rt_request_customer_activation", "pierre_rt_mark_activation_provisioning",
  "pierre_rt_claim_customer_activation", "pierre_rt_provision_customer_company", "pierre_rt_block_customer_activation",
  "pierre_rt_complete_onboarding_step", "pierre_rt_reopen_onboarding_step", "pierre_rt_complete_onboarding_session",
  "pierre_rt_create_membership_invitation", "pierre_rt_revoke_membership_invitation", "pierre_rt_accept_membership_invitation",
  "pierre_rt_set_member_status", "pierre_rt_transfer_company_ownership",
];

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

async function fnRows(name: string) {
  return (await h.pg.query<{ oid: string; prosecdef: boolean; proconfig: string[] | null; ident: string }>(
    `select p.oid::text as oid, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) as ident
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.proname=$1 and n.nspname='public'`, [name])).rows;
}

describe("P8.6 v28 functions are hardened SECURITY DEFINER (search_path + secdef)", () => {
  it("every v28 function is SECURITY DEFINER with a pinned search_path", async () => {
    for (const fn of V28_FUNCS) {
      const rows = await fnRows(fn);
      expect(rows.length, `${fn} should exist`).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.prosecdef, `${fn} must be SECURITY DEFINER`).toBe(true);
        const hasSearchPath = (r.proconfig ?? []).some((c) => c.toLowerCase().startsWith("search_path="));
        expect(hasSearchPath, `${fn} must pin search_path (proconfig=${JSON.stringify(r.proconfig)})`).toBe(true);
      }
    }
  });
});

describe("P8.6 EXECUTE is revoked from PUBLIC on every v28 function", () => {
  it("PUBLIC cannot execute any v28 function (incl. the internal log_access_event)", async () => {
    for (const fn of V28_FUNCS) {
      const rows = await fnRows(fn);
      for (const r of rows) {
        // use the OID directly (avoids regprocedure text parsing); 'public' is the implicit pseudo-role
        const pub = (await h.pg.query<{ ok: boolean }>(
          `select has_function_privilege('public', $1::oid, 'EXECUTE') as ok`, [r.oid])).rows[0].ok;
        expect(pub, `PUBLIC must NOT execute ${fn}(${r.ident})`).toBe(false);
      }
    }
  });
});

describe("P8.6 per-role least privilege (billing ≠ worker ≠ app)", () => {
  async function canExec(role: string, sig: string): Promise<boolean> {
    return (await h.pg.query<{ ok: boolean }>(`select has_function_privilege($1, $2::regprocedure, 'EXECUTE') as ok`, [role, sig])).rows[0].ok;
  }
  it("billing-webhook executes commercial/entitlement, NOT activation provisioning", async () => {
    expect(await canExec("pierre_rt_billing_webhook", "pierre_rt_apply_commercial_event(uuid)")).toBe(true);
    expect(await canExec("pierre_rt_billing_webhook", "pierre_rt_ingest_commercial_event(text,text,text,text,text,text,text,text,timestamptz)")).toBe(true);
    expect(await canExec("pierre_rt_billing_webhook", "pierre_rt_provision_customer_company(uuid,text,bigint,text,uuid,text,text,text,jsonb,uuid)")).toBe(false);
    expect(await canExec("pierre_rt_billing_webhook", "pierre_rt_claim_customer_activation(text,integer,timestamptz)")).toBe(false);
  });
  it("activation-worker executes claim/provision, NOT commercial ingress", async () => {
    expect(await canExec("pierre_rt_customer_activation_worker", "pierre_rt_claim_customer_activation(text,integer,timestamptz)")).toBe(true);
    expect(await canExec("pierre_rt_customer_activation_worker", "pierre_rt_provision_customer_company(uuid,text,bigint,text,uuid,text,text,text,jsonb,uuid)")).toBe(true);
    expect(await canExec("pierre_rt_customer_activation_worker", "pierre_rt_ingest_commercial_event(text,text,text,text,text,text,text,text,timestamptz)")).toBe(false);
    expect(await canExec("pierre_rt_customer_activation_worker", "pierre_rt_apply_commercial_event(uuid)")).toBe(false);
  });
  it("untrusted roles (incl. PUBLIC) cannot CREATE objects in the public schema", async () => {
    for (const role of ["public", "pierre_rt_app", "pierre_rt_billing_webhook", "pierre_rt_customer_activation_worker"]) {
      const ok = (await h.pg.query<{ ok: boolean }>(`select has_schema_privilege($1, 'public', 'CREATE') as ok`, [role])).rows[0].ok;
      expect(ok, `${role} must NOT have CREATE on schema public`).toBe(false);
    }
  });

  it("app executes onboarding/invitation/membership, NOT any commercial/activation truth function", async () => {
    expect(await canExec("pierre_rt_app", "pierre_rt_request_customer_activation(text,text,text,uuid,uuid,text)")).toBe(true);
    expect(await canExec("pierre_rt_app", "pierre_rt_complete_onboarding_step(uuid,uuid,text,uuid,text,integer)")).toBe(true);
    expect(await canExec("pierre_rt_app", "pierre_rt_apply_commercial_event(uuid)")).toBe(false);
    expect(await canExec("pierre_rt_app", "pierre_rt_apply_entitlement_event(uuid,text,text,text,text,integer)")).toBe(false);
    expect(await canExec("pierre_rt_app", "pierre_rt_provision_customer_company(uuid,text,bigint,text,uuid,text,text,text,jsonb,uuid)")).toBe(false);
    // the internal audit helper is reachable by NO external role
    expect(await canExec("pierre_rt_app", "pierre_rt_log_access_event(uuid,uuid,uuid,uuid,text,text,text,text,uuid,jsonb)")).toBe(false);
  });
});
