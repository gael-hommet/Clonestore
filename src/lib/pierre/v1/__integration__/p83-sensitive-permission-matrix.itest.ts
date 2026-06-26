// src/lib/pierre/v1/__integration__/p83-sensitive-permission-matrix.itest.ts
// PHASE 8.3-B2E §16 — granular sensitive permissions exist and are granted by a precise
// role matrix: OWNER/ADMIN/HR_DIRECTOR get the full sensitive set; HR_MANAGER and
// HR_OPERATOR are limited; the permissions are real rows, not a hardcoded claim.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { if (h) await h.close(); });

const SENSITIVE = ["document.sensitive.generate", "document.sensitive.approve", "document.sensitive.finalize", "document.employee.expose", "document.manager.expose"];

async function rolePerms(role: string): Promise<Set<string>> {
  const { rows } = await h.db.query<{ permission_key: string }>(`select permission_key from pierre_rt_role_permissions where role_key=$1`, [role]);
  return new Set(rows.map((r) => r.permission_key));
}

describe("§16 sensitive permission matrix", () => {
  it("the granular sensitive permissions are registered", async () => {
    const { rows } = await h.db.query<{ key: string }>(`select key from pierre_rt_permissions where key = any($1)`, [SENSITIVE]);
    expect(new Set(rows.map((r) => r.key))).toEqual(new Set(SENSITIVE));
  });

  it("OWNER, ADMIN and HR_DIRECTOR hold the full sensitive set", async () => {
    for (const role of ["OWNER", "ADMIN", "HR_DIRECTOR"]) {
      const perms = await rolePerms(role);
      for (const p of SENSITIVE) expect(perms.has(p)).toBe(true);
    }
  });

  it("HR_MANAGER and HR_OPERATOR are limited (cannot approve/finalize sensitive documents)", async () => {
    const mgr = await rolePerms("HR_MANAGER");
    expect(mgr.has("document.sensitive.generate")).toBe(true);
    expect(mgr.has("document.sensitive.approve")).toBe(false);
    expect(mgr.has("document.sensitive.finalize")).toBe(false);
    const op = await rolePerms("HR_OPERATOR");
    expect(op.has("document.sensitive.generate")).toBe(true);
    expect(op.has("document.sensitive.approve")).toBe(false);
    expect(op.has("document.employee.expose")).toBe(false);
  });
});
