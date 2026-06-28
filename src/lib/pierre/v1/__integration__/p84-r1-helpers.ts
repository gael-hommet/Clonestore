// src/lib/pierre/v1/__integration__/p84-r1-helpers.ts
// PHASE 8.4-R1 — shared helpers (NOT a test file). Adds a SECOND real member to a tenant (so per-
// strategy recipient resolution can be proven to differ), and a generic role-runner that binds an
// arbitrary least-privilege role + the tenant GUC inside one transaction — this is how the REAL role
// isolation (worker / webhook / app) is proven, instead of running everything as the superuser.

import type { Harness } from "./harness";
import { newUuid } from "../sql";

/** Insert a second active member (a distinct real user) in the tenant; returns {user_id, membership_id}. */
export async function addMember(h: Harness, companyId: string, role = "admin"): Promise<{ user_id: string; membership_id: string }> {
  const user_id = newUuid();
  const membership_id = newUuid();
  await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role) values ($1,$2,$3,$4)`, [membership_id, companyId, user_id, role]);
  return { user_id, membership_id };
}

/** Run a block bound to an arbitrary DB role + the tenant GUC (transaction-local; reset at commit). */
export async function asRole<T>(
  h: Harness, role: string, companyId: string,
  fn: (q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
): Promise<T> {
  return (await h.pg.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query(`select set_config('app.current_company', $1, true)`, [companyId]);
    return fn(async (text, params) => {
      const r = await tx.query(text, params ? [...params] : undefined);
      return { rows: r.rows as Record<string, unknown>[] };
    });
  })) as T;
}

/** Did a callback throw? (used to assert a role/function is refused) */
export async function refused(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch { return true; }
}
