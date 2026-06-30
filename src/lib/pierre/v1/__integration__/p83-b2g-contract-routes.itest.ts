// src/lib/pierre/v1/__integration__/p83-b2g-contract-routes.itest.ts
// PHASE 8.3-B2G §10 — the contract API layer (what the routes delegate to) enforces tenant
// isolation, permissions and role gating; the routes are thin withTenant wrappers that never
// trust a body-supplied company_id.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedEmployee } from "./b2g-helpers";
import * as Api from "../api";

let h: Harness; let owner: TenantContext; let ownerB: TenantContext; let emp: string;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
  emp = await seedEmployee(h, h.companyA);
});
afterEach(async () => { if (h) await h.close(); });

describe("§10 contract routes / api layer", () => {
  it("a permitted user creates and reads a contract through the api layer", async () => {
    const c = await Api.apiCreateGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    const got = await Api.apiGetContract(h.db, owner, c.id);
    expect(got.contract.id).toBe(c.id);
    expect(got.versions.length).toBe(1);
  });

  it("a foreign tenant cannot read another tenant's contract", async () => {
    const c = await Api.apiCreateGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await expect(Api.apiGetContract(h.db, ownerB, c.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("a role without create rights is refused even with the base permission", async () => {
    const auditor: TenantContext = { ...owner, role_keys: ["AUDITOR"] };
    await expect(Api.apiCreateGovernedContract(h.db, auditor, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("a missing base permission is refused", async () => {
    const noPerm: TenantContext = { ...owner, permissions: ["document.read"] };
    await expect(Api.apiCreateGovernedContract(h.db, noPerm, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("every contract route is a thin withTenant wrapper and never reads company_id from the body", () => {
    const dir = resolve(process.cwd(), "src/app/api/pierre/v1/contracts");
    const files: string[] = [];
    const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = resolve(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "route.ts") files.push(p); } };
    walk(dir);
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      // PHASE 8.6 — tenant resolved server-side via a thin wrapper: withProductAccess (product-gated) or
      // withTenant. Either way the tenant is never trusted from the body.
      expect(src, `${f} must use a server-side tenant wrapper`).toMatch(/with(ProductAccess|Tenant)\(req,/);
      expect(src).not.toMatch(/company_id\s*:\s*b\./);    // never an authoritative company_id from the body
      expect(src).not.toMatch(/getRuntimeDb|insert into|update pierre_rt/i); // routes never touch the DB directly
    }
  });
});
