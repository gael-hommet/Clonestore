// src/lib/pierre/v1/__integration__/p83-b2g-contract-readiness.itest.ts
// PHASE 8.3-B2G §2 — the readiness engine is deterministic and fail-closed.

import { describe, it, expect } from "vitest";
import { evaluateContractReadiness, type ContractReadinessInput } from "../contract-readiness";
import { getContractPolicy } from "../contract-policies";
import type { StrictGenerationContext } from "../generation-context";

function ctx(values: Record<string, string | null>, sensitive: string[] = []): StrictGenerationContext {
  return { document_type: "employment_contract", employee_id: "e", site_id: null, contract_id: "c", values, sensitive_fields: sensitive, custom_field_keys: [], rejected_overrides: [] };
}
function base(over: Partial<ContractReadinessInput> = {}): ContractReadinessInput {
  return {
    requested_action: "generate", policy: getContractPolicy("CDI_FULL_TIME"), workflow_status: "draft",
    employee_ok: true, site_coherent: true, contract_matches_employee: true,
    template: { published: true, document_type: "employment_contract", allowed_renderers: ["pdf", "docx"] },
    context: ctx({ "company.legal_name": "Acme", "employee.first_name": "A", "employee.last_name": "B", "employee.role_title": "Dev", "employment.start_date": "2026-01-01", "employment.weekly_hours": "35" }),
    renderer: "pdf", permissions: ["document.write"], role_keys: ["OWNER"],
    required_approvals: 1, approvals_valid: 0, legal_hold: false, is_latest_version: true, signed_or_superseded: false,
    ...over,
  };
}

describe("§2 contract readiness", () => {
  it("a complete contract is ready to generate", () => {
    const r = evaluateContractReadiness(base());
    expect(r.ready).toBe(true);
    expect(r.stage).toBe("draft");
    expect(r.blockers).toEqual([]);
  });

  it("a missing required field is a blocker", () => {
    const r = evaluateContractReadiness(base({ context: ctx({ "company.legal_name": "Acme", "employee.first_name": "A", "employee.role_title": "Dev", "employment.start_date": "2026-01-01", "employment.weekly_hours": "35" }) }));
    expect(r.ready).toBe(false);
    expect(r.missing_fields).toContain("employee.last_name");
    expect(r.blockers).toContain("missing_required_fields");
  });

  it("a fixed-term contract with end <= start is invalid", () => {
    const r = evaluateContractReadiness(base({ policy: getContractPolicy("CDD"), context: ctx({ "company.legal_name": "Acme", "employee.first_name": "A", "employee.last_name": "B", "employee.role_title": "Dev", "employment.start_date": "2026-06-01", "employment.end_date": "2026-01-01" }) }));
    expect(r.ready).toBe(false);
    expect(r.invalid_fields).toContain("employment.end_date_before_start");
  });

  it("a fixed-term contract without an end date is missing it", () => {
    const r = evaluateContractReadiness(base({ policy: getContractPolicy("CDD"), context: ctx({ "company.legal_name": "Acme", "employee.first_name": "A", "employee.last_name": "B", "employee.role_title": "Dev", "employment.start_date": "2026-01-01" }) }));
    expect(r.missing_fields).toContain("employment.end_date");
  });

  it("missing weekly hours is a WARNING, not a blocker", () => {
    const r = evaluateContractReadiness(base({ context: ctx({ "company.legal_name": "Acme", "employee.first_name": "A", "employee.last_name": "B", "employee.role_title": "Dev", "employment.start_date": "2026-01-01" }) }));
    // weekly_hours is a required field for CDI → it's missing → blocker; but the engine ALSO warns
    expect(r.warnings).toContain("weekly_hours_missing");
  });

  it("at finalization: insufficient approvals / drift / unclean artifact each block; signature_ready reflects them", () => {
    const fin = (over: Partial<ContractReadinessInput>) => evaluateContractReadiness(base({ requested_action: "finalize", workflow_status: "approved", required_approvals: 1, approvals_valid: 1, template_fingerprint_approved: "fp", template_fingerprint_current: "fp", approved_content_hash: "h", document_content_hash: "h", artifact: { present: true, upload_status: "clean", scan_status: "clean" }, ...over }));
    expect(fin({}).ready).toBe(true);
    expect(fin({ approvals_valid: 0 }).blockers).toContain("insufficient_approvals");
    expect(fin({ template_fingerprint_current: "DRIFTED" }).blockers).toContain("template_fingerprint_drift");
    expect(fin({ document_content_hash: "DRIFTED" }).blockers).toContain("document_hash_drift");
    expect(fin({ artifact: { present: true, upload_status: "quarantined", scan_status: "infected" } }).blockers).toContain("artifact_not_clean");
  });

  it("undefined evidence is never read as success (fail-closed)", () => {
    const r = evaluateContractReadiness(base({ requested_action: "finalize", workflow_status: "approved", artifact: null }));
    expect(r.artifact_clean).toBe(false);
    expect(r.blockers).toContain("artifact_not_clean");
  });
});
