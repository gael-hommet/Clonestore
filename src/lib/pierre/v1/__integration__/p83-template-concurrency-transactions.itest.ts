// src/lib/pierre/v1/__integration__/p83-template-concurrency-transactions.itest.ts
// PHASE 8.3-B2E §9 — concurrent version creation is transactionally serialized (row lock)
// and protected by a BOUNDED retry on a unique violation: N concurrent writers always
// produce N DISTINCT, contiguous version numbers with no duplicate-key error surfacing.
// (PGlite is single-connection, so this is a logical-local proof of the allocation logic.)

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid, withUniqueViolationRetry, isUniqueViolation } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { createTemplate, createTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name" }];

describe("§9 concurrent version transactions", () => {
  it("N concurrent createTemplateVersion calls yield N distinct contiguous version numbers", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const N = 10;
    const results = await Promise.all(Array.from({ length: N }, () => createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema })));
    const numbers = results.map((r) => r.version_number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: N }, (_, i) => i + 1)); // 1..N, all distinct
    const persisted = (await h.db.query<{ n: number }>(`select count(distinct version_number)::int n from pierre_rt_document_template_versions where company_id=$1 and template_id=$2`, [h.companyA, t.id])).rows[0].n;
    expect(persisted).toBe(N);
  });

  it("the bounded retry re-runs on a unique violation and gives up after the bound", async () => {
    // a transient unique violation that clears on the 3rd attempt → succeeds.
    let calls = 0;
    const out = await withUniqueViolationRetry(async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error("duplicate key value violates unique constraint uq"), { code: "23505" });
      return "ok";
    });
    expect(out).toBe("ok");
    expect(calls).toBe(3);
    // a persistent unique violation eventually propagates (bounded, not infinite).
    let attempts = 0;
    await expect(withUniqueViolationRetry(async () => { attempts++; throw Object.assign(new Error("dup"), { code: "23505" }); }, 4)).rejects.toMatchObject({ code: "23505" });
    expect(attempts).toBe(4);
    // a non-unique error is NOT retried — it surfaces immediately.
    let other = 0;
    await expect(withUniqueViolationRetry(async () => { other++; throw new Error("some other failure"); })).rejects.toThrow(/other failure/);
    expect(other).toBe(1);
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(new Error("nope"))).toBe(false);
  });
});
