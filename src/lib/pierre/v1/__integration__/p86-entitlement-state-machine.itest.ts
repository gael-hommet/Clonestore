// src/lib/pierre/v1/__integration__/p86-entitlement-state-machine.itest.ts
// PHASE 8.6 — EXHAUSTIVE entitlement state machine, proven on real Postgres (PGlite).
//
// applyEntitlementEvent (governed SECURITY DEFINER fn, billing-webhook role only) is the SOLE writer of
// commercial truth. This suite drives the full transition graph end to end on real rows:
//   active → grace → active → suspended → active   (round-trip, each step asserted)
//   cancelled is TERMINAL (a stray reactivation never resurrects the cancelled row — it mints a fresh one)
//   `version` increments on every real transition; a fresh insert starts at version 1
//   grace sets grace_until strictly in the FUTURE
//   the unique-live partial index guarantees AT MOST ONE non-terminal entitlement per (company, product)
//     at any time — proven by COUNTING live rows after every transition
//   subscription_updated is metadata-only: it never changes the status (and never bumps version)
//
// Each test uses a freshly-inserted, isolated company so the assertions are deterministic.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import { applyEntitlementEvent, type CommercialEventKey } from "../commercial-events";
import { getEntitlement } from "../entitlements";

// Adapt the asRole `q` into a SqlExecutor so we exercise the real service modules inside a role-bound tx.
function execFrom(
  q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>,
): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) =>
      q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

const BILLING = "pierre_rt_billing_webhook";
const APP = "pierre_rt_app";
const PRODUCT = "pierre";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

/** Insert a fresh, isolated company (with an active owner) and return its id. */
async function freshCompany(name: string): Promise<string> {
  const id = newUuid();
  await h.pg.query(`insert into pierre_rt_companies (id, name, status) values ($1,$2,'active')`, [id, name]);
  await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','active')`,
    [newUuid(), id, newUuid()]);
  return id;
}

/** Drive one commercial event through the state machine as the billing-webhook role. */
function apply(company: string, event_key: CommercialEventKey, opts?: { grace_seconds?: number; source_reference?: string }): Promise<string> {
  return asRole(h, BILLING, company, (q) =>
    applyEntitlementEvent(execFrom(q), {
      company_id: company, product_key: PRODUCT, event_key,
      grace_seconds: opts?.grace_seconds, source_reference: opts?.source_reference,
    }));
}

/** Count NON-TERMINAL (live) entitlements for a company+product — must never exceed 1. */
async function liveCount(company: string): Promise<number> {
  const r = await h.pg.query<{ n: number }>(
    `select count(*)::int as n from pierre_rt_product_entitlements
       where company_id=$1 and product_key=$2 and status in ('pending','active','grace','suspended')`,
    [company, PRODUCT]);
  return r.rows[0].n;
}

/** Count ALL entitlement rows (live + terminal) for a company+product. */
async function totalCount(company: string): Promise<number> {
  const r = await h.pg.query<{ n: number }>(
    `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1 and product_key=$2`,
    [company, PRODUCT]);
  return r.rows[0].n;
}

describe("P8.6 entitlement state machine — exhaustive transitions", () => {
  it("round-trips active → grace → active → suspended → active with a single live entitlement throughout", async () => {
    const company = await freshCompany("SM Round-Trip SAS");

    // ── 1) payment_confirmed → active (fresh insert: version 1, no grace) ──
    expect(await apply(company, "commercial.payment_confirmed", { source_reference: "sub_rt" })).toBe("active");
    let ent = await getEntitlement(h.db, company);
    expect(ent?.status).toBe("active");
    expect(ent?.version).toBe(1);                  // freshly inserted, never transitioned
    expect(ent?.starts_at).not.toBeNull();
    expect(ent?.grace_until).toBeNull();
    expect(await liveCount(company)).toBe(1);
    const entId = ent!.id;                          // the row identity must be STABLE across live transitions

    // ── 2) subscription_past_due → grace (version++, grace_until in the future) ──
    const beforeGrace = Date.now();
    expect(await apply(company, "commercial.subscription_past_due", { grace_seconds: 7 * 24 * 3600 })).toBe("grace");
    ent = await getEntitlement(h.db, company);
    expect(ent?.id).toBe(entId);                    // SAME row was transitioned, not replaced
    expect(ent?.status).toBe("grace");
    expect(ent?.version).toBe(2);
    expect(ent?.grace_until).not.toBeNull();
    expect(new Date(ent!.grace_until!).getTime()).toBeGreaterThan(beforeGrace); // strictly in the future
    expect(await liveCount(company)).toBe(1);

    // ── 3) subscription_reactivated → active (version++, still the same row) ──
    expect(await apply(company, "commercial.subscription_reactivated")).toBe("active");
    ent = await getEntitlement(h.db, company);
    expect(ent?.id).toBe(entId);
    expect(ent?.status).toBe("active");
    expect(ent?.version).toBe(3);
    expect(await liveCount(company)).toBe(1);

    // ── 4) subscription_suspended → suspended (version++, suspended_at stamped) ──
    expect(await apply(company, "commercial.subscription_suspended")).toBe("suspended");
    ent = await getEntitlement(h.db, company);
    expect(ent?.id).toBe(entId);
    expect(ent?.status).toBe("suspended");
    expect(ent?.version).toBe(4);
    expect(ent?.suspended_at).not.toBeNull();
    expect(await liveCount(company)).toBe(1);

    // ── 5) back to active (suspended is recoverable — version++, same row) ──
    expect(await apply(company, "commercial.subscription_active")).toBe("active");
    ent = await getEntitlement(h.db, company);
    expect(ent?.id).toBe(entId);
    expect(ent?.status).toBe("active");
    expect(ent?.version).toBe(5);
    expect(await liveCount(company)).toBe(1);

    // the whole journey touched exactly ONE physical row
    expect(await totalCount(company)).toBe(1);
  });

  it("cancellation is terminal: the cancelled row is never resurrected; a later reactivation mints a NEW live entitlement", async () => {
    const company = await freshCompany("SM Cancel SAS");

    expect(await apply(company, "commercial.payment_confirmed")).toBe("active");
    const original = (await getEntitlement(h.db, company))!.id;

    // cancel the live entitlement → terminal
    expect(await apply(company, "commercial.subscription_cancelled")).toBe("cancelled");
    let ent = await getEntitlement(h.db, company);
    expect(ent?.status).toBe("cancelled");
    expect(ent?.cancelled_at).not.toBeNull();
    expect(await liveCount(company)).toBe(0);       // cancelled is NOT live

    // the cancelled row is frozen: read it directly and confirm it stays cancelled
    const frozen = await h.pg.query<{ status: string; id: string }>(
      `select id, status from pierre_rt_product_entitlements where id=$1`, [original]);
    expect(frozen.rows[0].status).toBe("cancelled");

    // a stray reactivation does NOT touch the cancelled row — it creates a fresh, distinct live entitlement
    expect(await apply(company, "commercial.subscription_reactivated")).toBe("active");
    ent = await getEntitlement(h.db, company);
    expect(ent?.status).toBe("active");
    expect(ent?.id).not.toBe(original);            // a genuinely NEW row
    expect(ent?.version).toBe(1);                  // fresh insert
    expect(await liveCount(company)).toBe(1);       // still only one live row
    expect(await totalCount(company)).toBe(2);      // one terminal (cancelled) + one fresh live

    // and the old cancelled row is still cancelled — never resurrected
    const stillFrozen = await h.pg.query<{ status: string }>(
      `select status from pierre_rt_product_entitlements where id=$1`, [original]);
    expect(stillFrozen.rows[0].status).toBe("cancelled");
  });

  it("a cancel/refund with NO live entitlement is ignored (no row is created)", async () => {
    const company = await freshCompany("SM No-Live SAS");

    expect(await apply(company, "commercial.subscription_cancelled")).toBe("ignored");
    expect(await apply(company, "commercial.refund_confirmed")).toBe("ignored");
    expect(await totalCount(company)).toBe(0);       // nothing was ever created
    expect(await getEntitlement(h.db, company)).toBeNull();
  });

  it("refund_confirmed cancels a live entitlement (alias of cancellation)", async () => {
    const company = await freshCompany("SM Refund SAS");

    expect(await apply(company, "commercial.payment_confirmed")).toBe("active");
    expect(await apply(company, "commercial.refund_confirmed")).toBe("cancelled");
    const ent = await getEntitlement(h.db, company);
    expect(ent?.status).toBe("cancelled");
    expect(ent?.cancelled_at).not.toBeNull();
    expect(await liveCount(company)).toBe(0);
  });

  it("payment_failed routes to grace exactly like past_due, with grace_until in the future", async () => {
    const company = await freshCompany("SM Payment-Failed SAS");

    expect(await apply(company, "commercial.payment_confirmed")).toBe("active");
    const before = Date.now();
    expect(await apply(company, "commercial.payment_failed", { grace_seconds: 3 * 24 * 3600 })).toBe("grace");
    const ent = await getEntitlement(h.db, company);
    expect(ent?.status).toBe("grace");
    expect(ent?.grace_until).not.toBeNull();
    expect(new Date(ent!.grace_until!).getTime()).toBeGreaterThan(before);
    expect(await liveCount(company)).toBe(1);
  });

  it("subscription_updated is metadata-only: it never changes status and never bumps version", async () => {
    const company = await freshCompany("SM Updated SAS");

    expect(await apply(company, "commercial.payment_confirmed")).toBe("active");
    const pre = (await getEntitlement(h.db, company))!;
    expect(pre.version).toBe(1);

    // updated with a new source_reference: status unchanged, version unchanged (only the reference is touched)
    expect(await apply(company, "commercial.subscription_updated", { source_reference: "sub_meta_new" })).toBe("active");
    const post = (await getEntitlement(h.db, company))!;
    expect(post.id).toBe(pre.id);
    expect(post.status).toBe("active");
    expect(post.version).toBe(1);                   // version is NOT bumped by a metadata-only event
    expect(post.source_reference).toBe("sub_meta_new");
    expect(await liveCount(company)).toBe(1);
  });

  it("subscription_updated against NO entitlement is ignored (creates nothing)", async () => {
    const company = await freshCompany("SM Updated-No-Ent SAS");
    expect(await apply(company, "commercial.subscription_updated")).toBe("ignored");
    expect(await totalCount(company)).toBe(0);
  });

  it("the unique-live partial index physically forbids two live entitlements for the same (company, product)", async () => {
    const company = await freshCompany("SM Unique-Index SAS");
    expect(await apply(company, "commercial.payment_confirmed")).toBe("active");
    expect(await liveCount(company)).toBe(1);

    // a direct INSERT of a SECOND live (active) row must be rejected by uq_pierre_rt_entitlement_live
    const blocked = await refused(() =>
      h.pg.query(
        `insert into pierre_rt_product_entitlements (id, company_id, product_key, status, source_type)
         values ($1,$2,$3,'active','operator_activation')`,
        [newUuid(), company, PRODUCT]));
    expect(blocked).toBe(true);
    expect(await liveCount(company)).toBe(1);       // still exactly one live row
  });

  it("the application role CANNOT execute the entitlement truth function (billing role only)", async () => {
    const company = await freshCompany("SM Role-Refusal SAS");
    const denied = await refused(() =>
      asRole(h, APP, company, (q) =>
        applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.payment_confirmed" })));
    expect(denied).toBe(true);
    // and the app's refused call left no entitlement behind
    expect(await totalCount(company)).toBe(0);
  });
});
