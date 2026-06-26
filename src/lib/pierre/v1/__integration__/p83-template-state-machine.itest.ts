// src/lib/pierre/v1/__integration__/p83-template-state-machine.itest.ts
// PHASE 8.3-B2D §1 — strict, non-bypassable template state machine.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { assertTemplateTransition, canTemplateTransition, TemplateTransitionError } from "../template-state";
import { createTemplate, createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("§1 template transitions (pure)", () => {
  it("allows exactly the documented transitions", () => {
    for (const [f, t] of [["draft", "review_required"], ["review_required", "changes_requested"], ["changes_requested", "draft"], ["review_required", "approved"], ["approved", "published"], ["published", "deprecated"], ["deprecated", "archived"]] as const) {
      expect(canTemplateTransition(f, t)).toBe(true);
      expect(() => assertTemplateTransition(f, t)).not.toThrow();
    }
  });
  it("forbids every other transition", () => {
    for (const [f, t] of [["published", "draft"], ["published", "review_required"], ["published", "approved"], ["archived", "draft"], ["deprecated", "published"], ["draft", "published"], ["approved", "draft"]] as const) {
      expect(canTemplateTransition(f, t)).toBe(false);
      expect(() => assertTemplateTransition(f, t)).toThrowError(TemplateTransitionError);
    }
  });
});

describe("§1 service-level enforcement", () => {
  const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];
  it("services reject illegal transitions with code illegal_transition", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
    await expect(approveTemplateVersion(h.db, owner, v.id)).rejects.toMatchObject({ code: "illegal_transition" }); // draft → approved
    await expect(publishTemplateVersion(h.db, owner, v.id)).rejects.toMatchObject({ code: "illegal_transition" }); // draft → published
    await submitTemplateForReview(h.db, owner, v.id);
    await expect(publishTemplateVersion(h.db, owner, v.id)).rejects.toMatchObject({ code: "illegal_transition" }); // review_required → published
  });
});
