// src/lib/pierre/v1/document-policy.ts
// PHASE 8.3-B2E §14 — document-type POLICY enforcement engine. Turns the canonical
// document-type registry (roles, renderers, sensitivity, approvals, visibility) into a
// single decision that the real services consult before they mutate or expose anything.
// evaluateDocumentTypePolicy is pure & fail-closed; assertDocumentTypePolicy throws.

import { Errors } from "./errors";
import { getDocumentTypePolicy, type DocumentTypePolicy } from "./document-types";

export type DocumentPolicyAction =
  | "create" | "version" | "preview" | "generate" | "finalize" | "approve" | "download"
  | "expose_employee" | "expose_manager";

export type DocumentPolicyInput = {
  action: DocumentPolicyAction;
  document_type: string;
  role_keys: readonly string[];
  permissions: readonly string[];
  sensitivity?: "normal" | "high";
  renderer?: "pdf" | "docx";
  is_exposed?: boolean;            // for expose_* — whether the doc has been explicitly exposed
};

export type DocumentPolicyDecision = {
  allowed: boolean;
  reason_codes: string[];
  required_permissions: string[];
  required_roles: string[];
  policy: DocumentTypePolicy | null;
};

const some = (have: readonly string[], allowed: readonly string[]) => have.some((h) => allowed.includes(h));

export function evaluateDocumentTypePolicy(input: DocumentPolicyInput): DocumentPolicyDecision {
  const reasons: string[] = [], reqPerms: string[] = [], reqRoles: string[] = [];
  const policy = getDocumentTypePolicy(input.document_type);
  if (!policy) return { allowed: false, reason_codes: ["unknown_document_type"], required_permissions: [], required_roles: [], policy: null };
  const sensitive = (input.sensitivity ?? policy.default_sensitivity) !== "normal";
  const roles = input.role_keys ?? [];
  const need = (perm: string) => { if (!input.permissions.includes(perm)) { reqPerms.push(perm); reasons.push(`missing_permission:${perm}`); } };

  switch (input.action) {
    case "create":
    case "version":
    case "preview":
    case "generate":
      need("document.write");
      if (roles.length > 0 && !some(roles, policy.allowed_roles)) { reqRoles.push(...policy.allowed_roles); reasons.push("role_cannot_use_document_type"); }
      if (sensitive) need("document.sensitive.write");
      if ((input.action === "generate" || input.action === "version") && input.renderer && !policy.allowed_renderers.includes(input.renderer)) reasons.push("renderer_not_allowed");
      break;
    case "finalize":
      need("document.write");
      if (sensitive) need("document.sensitive.write");
      break;
    case "approve":
      need("document.approve");
      if (roles.length > 0 && !some(roles, policy.approve_roles)) { reqRoles.push(...policy.approve_roles); reasons.push("role_cannot_approve_document_type"); }
      // required_approvals === 0 is informational (approval is optional), never a violation.
      break;
    case "download":
      need("document.read");
      if (roles.length > 0 && !some(roles, policy.read_roles) && !some(roles, policy.allowed_roles)) { reqRoles.push(...policy.read_roles); reasons.push("role_cannot_read_document_type"); }
      if (sensitive) need("document.sensitive.read");
      break;
    case "expose_employee":
      if (policy.employee_visibility === "never") reasons.push("employee_visibility_forbidden");
      else if (policy.employee_visibility === "when_exposed" && input.is_exposed === false) reasons.push("employee_not_exposed");
      need("document.expose");
      break;
    case "expose_manager":
      if (policy.manager_visibility === "never") reasons.push("manager_visibility_forbidden");
      else if (policy.manager_visibility === "when_exposed" && input.is_exposed === false) reasons.push("manager_not_exposed");
      need("document.expose");
      break;
  }
  const allowed = reasons.length === 0;
  return { allowed, reason_codes: Array.from(new Set(reasons)), required_permissions: Array.from(new Set(reqPerms)), required_roles: Array.from(new Set(reqRoles)), policy };
}

export class DocumentPolicyError extends Error {
  readonly code = "document_policy_violation";
  readonly status = 403;
  constructor(public decision: DocumentPolicyDecision) {
    super(`Document policy violation: ${decision.reason_codes.join(", ")}`);
    this.name = "DocumentPolicyError";
  }
}

/** Enforce the document-type policy; throws DocumentPolicyError when the action is not permitted. */
export function assertDocumentTypePolicy(input: DocumentPolicyInput): DocumentPolicyDecision {
  const d = evaluateDocumentTypePolicy(input);
  if (!d.allowed) throw new DocumentPolicyError(d);
  return d;
}

void Errors; // keep the structured-error module linked for callers that map DocumentPolicyError
