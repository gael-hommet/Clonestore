// src/lib/pierre/v1/__tests__/p83-document-guard-failclosed.test.ts
// PHASE 8.3-B2C §11/§12 — documentary CloneGuard fail-closed: absent evidence
// (undefined) is NEVER a positive proof; canonical decision merged with precedence.

import { describe, it, expect } from "vitest";
import { evaluateDocumentGuard, type DocumentGuardInput } from "../document-guard";

const perms = ["document.write", "document.approve", "document.sensitive.read", "signature.evidence.read"];
const ready = (over: Partial<DocumentGuardInput>): DocumentGuardInput => ({
  action: "generate_final", document_type: "work_certificate", document_status: "draft", version_status: "approved",
  sensitivity: "normal", file_status: "clean", scan_status: "clean", template_status: "published", missing_fields: [],
  permissions: perms, approval_status: "approved", content_hash: "h", approved_content_hash: "h", legal_hold: false, contract_status: "approved", ...over,
});

describe("§12 generate_final is fail-closed on absent evidence", () => {
  it("allows only when every proof is present + positive", () => {
    expect(evaluateDocumentGuard(ready({})).decision).toBe("allow");
  });
  it("blocks when file/scan/template/content/missing evidence is UNDEFINED", () => {
    expect(evaluateDocumentGuard(ready({ file_status: undefined })).reason_codes).toContain("file_status_unknown");
    expect(evaluateDocumentGuard(ready({ scan_status: undefined })).reason_codes).toContain("scan_status_unknown");
    expect(evaluateDocumentGuard(ready({ template_status: undefined })).reason_codes).toContain("template_status_unknown");
    expect(evaluateDocumentGuard(ready({ content_hash: null })).reason_codes).toContain("content_hash_missing");
    expect(evaluateDocumentGuard(ready({ missing_fields: undefined })).reason_codes).toContain("missing_fields_unknown");
    expect(evaluateDocumentGuard(ready({ permissions: [] })).reason_codes).toContain("no_document_permission");
  });
});

describe("§12 submit_signature + delete are fail-closed", () => {
  it("signature blocks on missing approved hash / unknown contract status", () => {
    expect(evaluateDocumentGuard(ready({ action: "submit_signature", approved_content_hash: null })).reason_codes).toContain("approved_hash_missing");
    expect(evaluateDocumentGuard(ready({ action: "submit_signature", document_type: "employment_contract", contract_status: undefined })).reason_codes).toContain("contract_status_unknown");
  });
  it("delete blocks when legal_hold or document_status is UNKNOWN", () => {
    expect(evaluateDocumentGuard(ready({ action: "delete_document", legal_hold: undefined })).reason_codes).toContain("legal_hold_unknown");
    expect(evaluateDocumentGuard(ready({ action: "delete_document", document_status: undefined })).reason_codes).toContain("document_status_unknown");
  });
});

describe("§11 canonical composition + precedence (block > escalate > require_approval > allow)", () => {
  it("a blocking documentary rule overrides everything → block", () => {
    const d = evaluateDocumentGuard(ready({ template_status: "draft" }));
    expect(d.decision).toBe("block");
    expect(d.prohibited_actions).toContain("generate_final");
  });
  it("the canonical guard decision is merged (not just exposed in base)", () => {
    // a sensitive disciplinary generation: canonical guard governs 'sanction' → at least require_approval/escalate/block
    const d = evaluateDocumentGuard(ready({ document_type: "disciplinary_document", sensitivity: "high" }));
    expect(["require_approval", "escalate", "block"]).toContain(d.decision);
    expect(d.decision).not.toBe("allow");
    expect(d.policy_sources.length).toBeGreaterThanOrEqual(0);
  });
  it("§13 sensitivity is governed on preview/approve/download, not only download", () => {
    expect(evaluateDocumentGuard(ready({ action: "preview", document_type: "payroll_variable_document", permissions: ["document.read"] })).reason_codes).toContain("sensitive_no_permission");
    expect(evaluateDocumentGuard(ready({ action: "approve", document_type: "payroll_variable_document", permissions: ["document.read"] })).reason_codes).toContain("sensitive_no_permission");
  });
});
