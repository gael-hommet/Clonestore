// PHASE 8.5-R1 §R1.1 — the runtime executors bind the EXACT PostgreSQL role and VERIFY current_user.
// SET LOCAL ROLE produces precisely the expected role; assertRuntimeRole rejects any current_user that
// is not the expected runtime role (so the runtime never runs under app/service/superuser). The full
// membership-based fail-closed (a login that is NOT a member of the role) is proven by the opt-in
// infrastructure smoke against a real PostgreSQL (PGlite is single-superuser).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole } from "./p84-r1-helpers";
import { assertRuntimeRole } from "../runtime-worker-db";
import type { SqlExecutor } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

describe("P8.5-R1 real role binding (current_user)", () => {
  it("SET LOCAL ROLE binds the EXACT current_user for each runtime role", async () => {
    const cu = (role: string) => asRole(h, role, h.companyA, (q) => q(`select current_user`)).then((r) => (r.rows[0] as { current_user: string }).current_user);
    expect(await cu("pierre_rt_runtime_worker")).toBe("pierre_rt_runtime_worker");
    expect(await cu("pierre_rt_runtime_scheduler")).toBe("pierre_rt_runtime_scheduler");
    expect(await cu("pierre_rt_app")).toBe("pierre_rt_app");
  });

  it("assertRuntimeRole REJECTS a current_user that is not the expected role", async () => {
    await h.pg.transaction(async (tx) => {
      await tx.exec("set local role pierre_rt_app");
      const wrapped = { async query(t: string, p?: readonly unknown[]) { const r = await tx.query(t, p ? [...p] : undefined); return { rows: r.rows as never[] }; }, transaction(fn: (x: SqlExecutor) => unknown) { return fn(wrapped as never); } } as unknown as SqlExecutor;
      await expect(assertRuntimeRole(wrapped, "pierre_rt_runtime_worker")).rejects.toThrow(/role binding failed/);
      await expect(assertRuntimeRole(wrapped, "pierre_rt_app")).resolves.toBeUndefined(); // matches → ok
    });
  });
});
