// src/lib/pierre/v1/__tests__/p83-document-cloneguard.test.ts
// PHASE 8.3-B2 §15 — documentary CloneGuard rule coverage.

import { describe, it, expect } from "vitest";
import { evaluateDocumentGuard, type DocumentGuardInput } from "../document-guard";

const base = (over: Partial<DocumentGuardInput>): DocumentGuardInput => ({
  action: "generate_final", document_type: "work_certificate", document_status: "draft", version_status: "draft",
  sensitivity: "normal", file_status: "clean", scan_status: "clean", template_status: "published", missing_fields: [],
  permissions: ["document.write", "document.approve"], approval_status: "approved", content_hash: "h", approved_content_hash: "h",
  legal_hold: false, ...over,
});

describe("§15 documentary CloneGuard", () => {
  it("allows a clean, published, complete final generation", () => {
    expect(evaluateDocumentGuard(base({})).decision).toBe("allow");
  });
  it("blocks generation with an unpublished/unapproved template", () => {
    expect(evaluateDocumentGuard(base({ template_status: "draft" })).reason_codes).toEqual(expect.arrayContaining(["template_not_published", "template_not_approved"]));
    expect(evaluateDocumentGuard(base({ template_status: "review_required" })).decision).toBe("block");
  });
  it("blocks on missing required fields", () => {
    const d = evaluateDocumentGuard(base({ missing_fields: ["employee.start_date"] }));
    expect(d.decision).toBe("block");
    expect(d.missing_information).toContain("employee.start_date");
  });
  it("blocks when the attached file is not clean", () => {
    expect(evaluateDocumentGuard(base({ file_status: "quarantined" })).reason_codes).toContain("file_not_clean");
    expect(evaluateDocumentGuard(base({ scan_status: "infected" })).reason_codes).toContain("scan_not_clean");
  });
  it("requires sensitive permission to download a sensitive document", () => {
    const d = evaluateDocumentGuard(base({ action: "download", sensitivity: "high", permissions: ["document.read"] }));
    expect(d.decision).toBe("block");
    expect(d.required_permissions).toContain("document.sensitive.read");
  });
  it("payroll final generation needs sensitive permission + approval", () => {
    const d = evaluateDocumentGuard(base({ document_type: "payroll_variable_document", permissions: ["document.write"] }));
    expect(d.reason_codes).toContain("compensation_no_permission");
    expect(d.reason_codes).toContain("compensation_requires_approval");
  });
  it("disciplinary requires approval and escalates on signature", () => {
    const gen = evaluateDocumentGuard(base({ document_type: "disciplinary_document", sensitivity: "high" }));
    expect(gen.reason_codes).toContain("disciplinary_requires_approval");
    expect(gen.required_approvals).toContain("hr_director");
    const sig = evaluateDocumentGuard(base({ action: "submit_signature", document_type: "disciplinary_document", sensitivity: "high" }));
    expect(["escalate", "block"]).toContain(sig.decision); // escalated + canonical guard may block
    expect(sig.reason_codes).toContain("disciplinary_signature_escalation");
  });
  it("blocks signature without approval and on hash drift after approval", () => {
    expect(evaluateDocumentGuard(base({ action: "submit_signature", approval_status: "pending" })).reason_codes).toContain("signature_without_approval");
    expect(evaluateDocumentGuard(base({ action: "submit_signature", content_hash: "h2" })).reason_codes).toContain("content_hash_changed_after_approval");
  });
  it("invalidates approval when an approved version is modified", () => {
    expect(evaluateDocumentGuard(base({ action: "modify_version", version_status: "approved", content_hash: "h2" })).reason_codes).toContain("approval_invalidated_by_change");
  });
  it("blocks modifying a signed contract and proposes an amendment", () => {
    const d = evaluateDocumentGuard(base({ action: "modify_signed_contract", document_type: "employment_contract", document_status: "signed" }));
    expect(d.decision).toBe("block");
    expect(d.safe_alternatives).toContain("create_amendment");
  });
  it("blocks delete under legal hold and delete of a signed document", () => {
    expect(evaluateDocumentGuard(base({ action: "delete_document", legal_hold: true })).reason_codes).toContain("legal_hold_delete");
    expect(evaluateDocumentGuard(base({ action: "delete_document", document_status: "signed" })).reason_codes).toContain("signed_document_delete");
  });
  it("blocks reading evidence without the evidence permission", () => {
    expect(evaluateDocumentGuard(base({ action: "read_evidence", permissions: ["document.read"] })).reason_codes).toContain("evidence_no_permission");
  });
});
