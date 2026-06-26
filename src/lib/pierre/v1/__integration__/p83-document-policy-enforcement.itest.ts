// src/lib/pierre/v1/__integration__/p83-document-policy-enforcement.itest.ts
// PHASE 8.3-B2E §14 — the document-type policy engine, and its enforcement inside the
// real document service. Unknown types, ineligible roles and missing permissions are
// refused; a permitted action passes.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { evaluateDocumentTypePolicy, assertDocumentTypePolicy, DocumentPolicyError } from "../document-policy";
import { createDocument } from "../documents";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

describe("§14 document-type policy enforcement", () => {
  it("refuses an unknown document type", () => {
    const d = evaluateDocumentTypePolicy({ action: "create", document_type: "ghost_type", role_keys: ["OWNER"], permissions: ["document.write"] });
    expect(d.allowed).toBe(false);
    expect(d.reason_codes).toContain("unknown_document_type");
  });

  it("refuses a role that cannot use the document type, and a missing permission", () => {
    const roleDenied = evaluateDocumentTypePolicy({ action: "create", document_type: "payroll_variable_document", role_keys: ["HR_OPERATOR"], permissions: ["document.write", "document.sensitive.write"] });
    expect(roleDenied.allowed).toBe(false);
    expect(roleDenied.reason_codes).toContain("role_cannot_use_document_type");
    const permDenied = evaluateDocumentTypePolicy({ action: "create", document_type: "payroll_variable_document", role_keys: ["OWNER"], permissions: ["document.write"], sensitivity: "high" });
    expect(permDenied.allowed).toBe(false);
    expect(permDenied.required_permissions).toContain("document.sensitive.write");
    expect(() => assertDocumentTypePolicy(permDenied as never)).toBeDefined();
    expect(() => assertDocumentTypePolicy({ action: "create", document_type: "payroll_variable_document", role_keys: ["OWNER"], permissions: ["document.write"], sensitivity: "high" })).toThrow(DocumentPolicyError);
  });

  it("a renderer outside the allowed set is refused", () => {
    // absence_justification allows NO renderer (upload-only)
    const d = evaluateDocumentTypePolicy({ action: "generate", document_type: "absence_justification", role_keys: ["OWNER"], permissions: ["document.write"], renderer: "pdf" });
    expect(d.reason_codes).toContain("renderer_not_allowed");
  });

  it("the real createDocument service enforces the policy (permitted type passes)", async () => {
    const doc = await createDocument(h.db, owner, { document_type: "work_certificate", title: "Certificat" });
    expect(doc.document_type).toBe("work_certificate");
    // a high-sensitivity type with the owner (who has the sensitive write permission) is allowed
    const sensitive = await createDocument(h.db, owner, { document_type: "disciplinary_document", title: "Avertissement", sensitivity: "high" });
    expect(sensitive.sensitivity).toBe("high");
  });
});
