// src/lib/pierre/v1/contract-readiness.ts
// PHASE 8.3-B2G §2 — deterministic CONTRACT READINESS engine. Pure: the service resolves the
// tenant-verified evidence (employee, template, context, artifact, approvals, hashes) and
// passes it here; this returns a structured verdict. Fail-closed: a missing/undefined proof
// is never read as success. A blocker always prevents the transition; a warning never does.

import type { ContractPolicy } from "./contract-policies";
import type { StrictGenerationContext } from "./generation-context";

export type ContractAction = "generate" | "submit_review" | "approve" | "finalize" | "prepare_signature";
export type ReadinessStage = "draft" | "review" | "approval" | "finalization" | "signature";

export type ContractReadinessInput = {
  requested_action: ContractAction;
  policy: ContractPolicy | null;
  workflow_status: string;
  employee_ok: boolean;
  site_coherent: boolean;
  contract_matches_employee: boolean;
  template: { published: boolean; document_type: string; allowed_renderers: Array<"pdf" | "docx"> } | null;
  context: StrictGenerationContext | null;
  renderer: "pdf" | "docx";
  permissions: readonly string[];
  role_keys: readonly string[];
  required_approvals: number;
  approvals_valid: number;
  template_fingerprint_current?: string | null;
  template_fingerprint_approved?: string | null;
  document_content_hash?: string | null;
  approved_content_hash?: string | null;
  artifact?: { present: boolean; upload_status?: string | null; scan_status?: string | null } | null;
  legal_hold: boolean;
  is_latest_version: boolean;
  signed_or_superseded: boolean;
  provenance_failures?: string[];
};

export type ContractReadiness = {
  ready: boolean;
  stage: ReadinessStage;
  blockers: string[];
  warnings: string[];
  missing_fields: string[];
  invalid_fields: string[];
  sensitive_fields: string[];
  provenance_failures: string[];
  required_approvals: number;
  approvals_obtained: number;
  template_fingerprint_ok: boolean;
  document_hash_ok: boolean;
  artifact_clean: boolean;
  signature_ready: boolean;
};

const STAGE: Record<ContractAction, ReadinessStage> = {
  generate: "draft", submit_review: "review", approve: "approval", finalize: "finalization", prepare_signature: "signature",
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const present = (x: string | null | undefined) => x !== null && x !== undefined && x !== "" && x !== "—";

export function evaluateContractReadiness(input: ContractReadinessInput): ContractReadiness {
  const blockers: string[] = [], warnings: string[] = [], missing: string[] = [], invalid: string[] = [], provenance: string[] = [...(input.provenance_failures ?? [])];
  const stage = STAGE[input.requested_action];
  const block = (c: string) => { if (!blockers.includes(c)) blockers.push(c); };
  const warn = (c: string) => { if (!warnings.includes(c)) warnings.push(c); };

  const policy = input.policy;
  if (!policy) block("unknown_contract_type");
  if (!input.employee_ok) block("employee_not_in_tenant");
  if (!input.site_coherent) block("site_incoherent");
  if (!input.contract_matches_employee) block("contract_employee_mismatch");
  if (input.signed_or_superseded) block("contract_not_mutable");
  if (input.legal_hold) block("legal_hold");
  if (!input.is_latest_version) block("not_latest_version");

  const ctx = input.context;
  // Field-level / template / renderer checks belong to GENERATION (the draft stage). Once a
  // version is generated, its content is frozen in the canonical hash + the clean artifact;
  // later stages verify the artifact, approvals and drift, not the raw input fields.
  if (stage === "draft") {
    if (policy?.requires_template) {
      if (!input.template) block("template_missing");
      else {
        if (!input.template.published) block("template_not_published");
        if (input.template.document_type !== policy.document_type) block("template_incompatible_document_type");
        if (!input.template.allowed_renderers.includes(input.renderer)) block("renderer_not_allowed");
      }
    }
    if (policy && !policy.allowed_renderers.includes(input.renderer)) block("renderer_not_allowed");

    if (!ctx) block("generation_context_missing");
    else if (policy) {
      for (const f of policy.required_fields) if (!present(ctx.values[f])) missing.push(f);
      for (const f of policy.conditional_fields) if (policy.requires_end_date && f === "employment.end_date" && !present(ctx.values[f])) missing.push(f);
      const start = ctx.values["employment.start_date"]; const end = ctx.values["employment.end_date"];
      if (present(start) && !DATE_RE.test(String(start))) invalid.push("employment.start_date");
      if (policy.requires_end_date) {
        if (!present(end)) { if (!missing.includes("employment.end_date")) missing.push("employment.end_date"); }
        else if (!DATE_RE.test(String(end))) invalid.push("employment.end_date");
        else if (present(start) && DATE_RE.test(String(start)) && String(end) <= String(start)) invalid.push("employment.end_date_before_start");
      }
      const hours = ctx.values["employment.weekly_hours"];
      if (present(hours)) { const n = Number(hours); if (Number.isNaN(n) || n <= 0 || n > 60) invalid.push("employment.weekly_hours"); }
      else warn("weekly_hours_missing");
      for (const sf of ctx.sensitive_fields) {
        if (!input.permissions.includes("document.sensitive.read") && !input.permissions.includes("employee.sensitive.read")) {
          if (!provenance.includes(`sensitive_no_permission:${sf}`)) provenance.push(`sensitive_no_permission:${sf}`);
        }
      }
    }
    if (missing.length > 0) block("missing_required_fields");
    if (invalid.length > 0) block("invalid_fields");
    if (provenance.length > 0) block("provenance_or_sensitivity_failure");
  }

  // hashes + fingerprints (matter at finalization/signature)
  const template_fingerprint_ok = !input.template_fingerprint_approved || input.template_fingerprint_approved === input.template_fingerprint_current;
  const document_hash_ok = !input.approved_content_hash || input.approved_content_hash === input.document_content_hash;
  const artifact_clean = !!input.artifact && input.artifact.present && input.artifact.upload_status === "clean" && input.artifact.scan_status === "clean";

  if (stage === "finalization" || stage === "signature") {
    if (input.approvals_valid < input.required_approvals) block("insufficient_approvals");
    if (!template_fingerprint_ok) block("template_fingerprint_drift");
    if (!document_hash_ok) block("document_hash_drift");
    if (!artifact_clean) block("artifact_not_clean");
  }
  if (stage === "signature") {
    if (input.workflow_status !== "final" && input.workflow_status !== "ready_for_signature") block("not_finalized");
  }

  // requested-action status preconditions
  const STATUS_OK: Record<ContractAction, string[]> = {
    generate: ["draft", "changes_requested"],
    submit_review: ["draft"],
    approve: ["under_review"],
    finalize: ["approved"],
    prepare_signature: ["final"],
  };
  if (!STATUS_OK[input.requested_action].includes(input.workflow_status)) block("status_does_not_allow_action");

  const signature_ready = artifact_clean && template_fingerprint_ok && document_hash_ok && input.approvals_valid >= input.required_approvals;
  return {
    ready: blockers.length === 0,
    stage,
    blockers, warnings,
    missing_fields: missing, invalid_fields: invalid,
    sensitive_fields: ctx?.sensitive_fields ?? [],
    provenance_failures: provenance,
    required_approvals: input.required_approvals,
    approvals_obtained: input.approvals_valid,
    template_fingerprint_ok, document_hash_ok, artifact_clean, signature_ready,
  };
}
