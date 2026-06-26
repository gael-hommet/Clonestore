// src/lib/pierre/v1/document-guard.ts
// PHASE 8.3-B2C §11–§13 — documentary CloneGuard. REAL composition with the
// canonical evaluateGuard (decisions merged with strict precedence
// block > escalate > require_approval > allow), FAIL-CLOSED (absent evidence
// blocks critical actions — undefined is never a positive proof), and sensitivity
// governed across preview/generation/finalization/approval/download/evidence.

import { evaluateGuard, type GuardDecision } from "./cloneguard";
import { getDocumentTypePolicy } from "./document-types";

export type DocAction =
  | "preview" | "generate_final" | "finalize" | "submit_signature" | "approve" | "modify_version"
  | "modify_signed_contract" | "delete_document" | "read_evidence" | "download";

export type DocumentGuardInput = {
  action: DocAction;
  document_type: string;
  document_status?: string;
  version_status?: string;
  sensitivity: "normal" | "high";
  file_status?: string;
  scan_status?: string;
  template_status?: string;
  missing_fields?: string[];
  permissions: readonly string[];
  approval_status?: "pending" | "approved" | "rejected";
  content_hash?: string | null;
  approved_content_hash?: string | null;
  legal_hold?: boolean;
  contract_status?: string;
  signature_status?: string;
};

export type GuardLevel = "allow" | "require_approval" | "escalate" | "block";
export type DocumentGuardDecision = {
  decision: GuardLevel;
  reason_codes: string[]; explanation: string; missing_information: string[];
  required_permissions: string[]; required_approvals: string[]; prohibited_actions: string[];
  safe_alternatives: string[]; policy_sources: string[];
  trace_event: { type: string; action: DocAction; decision: GuardLevel };
  base: GuardDecision;
};

const RANK: Record<GuardLevel, number> = { allow: 0, require_approval: 1, escalate: 2, block: 3 };
const has = (perms: readonly string[], p: string) => perms.includes(p);
const SENSITIVE_ACTIONS = new Set<DocAction>(["preview", "generate_final", "finalize", "approve", "download", "read_evidence"]);
const FILE_ACTIONS = new Set<DocAction>(["generate_final", "finalize", "submit_signature", "download"]);

export function evaluateDocumentGuard(input: DocumentGuardInput): DocumentGuardDecision {
  const reasons: string[] = [], missing: string[] = [], reqPerms: string[] = [], reqApprovals: string[] = [], prohibited: string[] = [], safe: string[] = [];
  let level: GuardLevel = "allow";
  const raise = (to: GuardLevel) => { if (RANK[to] > RANK[level]) level = to; };
  const block = (code: string) => { reasons.push(code); raise("block"); };
  const escalate = (code: string) => { reasons.push(code); raise("escalate"); };
  const approval = (code: string, who = "hr_approver") => { reasons.push(code); reqApprovals.push(who); raise("require_approval"); };

  const typePolicy = getDocumentTypePolicy(input.document_type);
  if (!typePolicy) block("unknown_document_type");
  const isContract = input.document_type === "employment_contract" || input.document_type === "contract_amendment";
  const isDisciplinary = input.document_type === "disciplinary_document";
  const isPayroll = input.document_type === "payroll_variable_document";
  const sensitive = input.sensitivity === "high" || isPayroll || isDisciplinary || (typePolicy?.default_sensitivity === "high");

  // §12 FAIL-CLOSED: file-bearing actions require PRESENT + clean file/scan.
  if (FILE_ACTIONS.has(input.action)) {
    if (input.file_status === undefined) block("file_status_unknown");
    else if (input.file_status !== "clean") block("file_not_clean");
    if (input.scan_status === undefined) block("scan_status_unknown");
    else if (input.scan_status !== "clean") block("scan_not_clean");
  }

  // §12 FAIL-CLOSED: final generation requires an approved+published template, a content
  // hash, no missing fields. Absent proof blocks.
  if (input.action === "generate_final" || input.action === "finalize") {
    if (input.template_status === undefined) block("template_status_unknown");
    else if (input.template_status !== "published") { block("template_not_published"); if (["draft", "review_required", "changes_requested"].includes(input.template_status)) reasons.push("template_not_approved"); }
    if (!input.content_hash) block("content_hash_missing");
    if (input.missing_fields === undefined) block("missing_fields_unknown");
    else if (input.missing_fields.length > 0) { block("missing_required_fields"); missing.push(...input.missing_fields); }
    if (!has(input.permissions, "document.write")) { block("no_document_permission"); reqPerms.push("document.write"); }
  }

  // §13 sensitivity governance across the lifecycle (not just download).
  if (sensitive && SENSITIVE_ACTIONS.has(input.action)) {
    if (!has(input.permissions, "document.sensitive.read")) { block("sensitive_no_permission"); reqPerms.push("document.sensitive.read"); }
  }
  if (isPayroll && (input.action === "generate_final" || input.action === "finalize")) {
    if (!has(input.permissions, "employee.sensitive.read")) { block("compensation_no_permission"); reqPerms.push("employee.sensitive.read"); }
    approval("compensation_requires_approval");
  }
  if (isDisciplinary && ["generate_final", "finalize", "submit_signature"].includes(input.action)) {
    approval("disciplinary_requires_approval", "hr_director");
    if (input.action === "submit_signature") escalate("disciplinary_signature_escalation");
  }

  // §12 FAIL-CLOSED: signature requires approval + matching hashes (presence required).
  if (input.action === "submit_signature") {
    if (input.approval_status !== "approved") block("signature_without_approval");
    if (!input.content_hash) block("content_hash_missing");
    if (!input.approved_content_hash) block("approved_hash_missing");
    if (input.approved_content_hash && input.content_hash && input.approved_content_hash !== input.content_hash) block("content_hash_changed_after_approval");
    if (isContract && input.contract_status !== undefined && !["approved", "ready_for_signature"].includes(input.contract_status)) block("contract_not_approved");
    if (isContract && input.contract_status === undefined) block("contract_status_unknown");
  }

  if (input.action === "modify_version" && input.version_status === "approved" && input.approved_content_hash && input.content_hash && input.approved_content_hash !== input.content_hash) block("approval_invalidated_by_change");
  if (input.action === "modify_signed_contract" || (input.action === "modify_version" && (input.version_status === "signed" || input.document_status === "signed"))) { block("signed_immutable"); safe.push("create_amendment"); }

  // §12 FAIL-CLOSED deletes: legal_hold + status must be KNOWN.
  if (input.action === "delete_document") {
    if (input.legal_hold === undefined) block("legal_hold_unknown");
    else if (input.legal_hold) block("legal_hold_delete");
    if (input.document_status === undefined) block("document_status_unknown");
    else if (input.document_status === "signed") { block("signed_document_delete"); safe.push("governed_legal_erasure_procedure"); }
  }
  if (input.action === "read_evidence" && !has(input.permissions, "signature.evidence.read")) { block("evidence_no_permission"); reqPerms.push("signature.evidence.read"); }

  // §11 REAL composition with the canonical CloneGuard.
  const actionKind = isContract ? (input.document_type === "contract_amendment" ? "amendment" : "contract") : isPayroll ? "compensation" : isDisciplinary ? "sanction" : "standard_report";
  const base = evaluateGuard({ action: actionKind, risk: sensitive ? "high" : "medium", sensitivity: sensitive ? "sensitive" : "normal" });
  if (!base.allow) block("cloneguard_blocked");
  if (base.requires_approval) approval("cloneguard_requires_approval");
  prohibited.push(...base.prohibited_actions);
  if (RANK[level] === RANK.block) prohibited.push(input.action);

  return {
    decision: level,
    reason_codes: Array.from(new Set(reasons)),
    explanation: level === "allow" ? "Action permise sous gouvernance documentaire." : `Action ${level} : ${Array.from(new Set(reasons)).join(", ")}.`,
    missing_information: Array.from(new Set(missing)),
    required_permissions: Array.from(new Set(reqPerms)),
    required_approvals: Array.from(new Set(reqApprovals)),
    prohibited_actions: Array.from(new Set(prohibited)),
    safe_alternatives: Array.from(new Set([...safe, ...base.safe_alternatives])),
    policy_sources: base.policy_sources,
    trace_event: { type: "document_guard", action: input.action, decision: level },
    base,
  };
}

// ── §15 — enforceDocumentGuard: turn a decision into a typed refusal the services raise ──
export class DocumentGuardError extends Error {
  readonly status: number = 403;
  constructor(message: string, public decision: DocumentGuardDecision, public code: string) { super(message); this.name = "DocumentGuardError"; }
}
export class DocumentGuardBlockedError extends DocumentGuardError {
  constructor(decision: DocumentGuardDecision) { super(`Action bloquée: ${decision.reason_codes.join(", ")}`, decision, "document_guard_blocked"); this.name = "DocumentGuardBlockedError"; }
}
export class DocumentApprovalRequiredError extends DocumentGuardError {
  readonly status = 409;
  constructor(decision: DocumentGuardDecision) { super(`Approbation requise: ${decision.reason_codes.join(", ")}`, decision, "document_guard_approval_required"); this.name = "DocumentApprovalRequiredError"; }
}
export class DocumentEscalationRequiredError extends DocumentGuardError {
  readonly status = 409;
  constructor(decision: DocumentGuardDecision) { super(`Escalade requise: ${decision.reason_codes.join(", ")}`, decision, "document_guard_escalation_required"); this.name = "DocumentEscalationRequiredError"; }
}

/**
 * Evaluate the documentary guard and ENFORCE it: anything that is not `allow` raises a
 * typed error the service propagates. This is the single choke-point a real service
 * calls before a sensitive mutation — block → blocked, escalate → escalation,
 * require_approval → approval-required.
 */
export function enforceDocumentGuard(input: DocumentGuardInput): DocumentGuardDecision {
  const d = evaluateDocumentGuard(input);
  if (d.decision === "block") throw new DocumentGuardBlockedError(d);
  if (d.decision === "escalate") throw new DocumentEscalationRequiredError(d);
  if (d.decision === "require_approval") throw new DocumentApprovalRequiredError(d);
  return d;
}
