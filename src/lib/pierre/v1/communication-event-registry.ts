// src/lib/pierre/v1/communication-event-registry.ts
// PHASE 8.4.1 — canonical communication EVENT REGISTRY. The ONLY source of a communication policy
// is this server registry. A policy supplied in an outbox payload is IGNORED. A communicable event
// has an explicit policy; a known internal lifecycle event is explicitly NON-communicable (skipped);
// anything else is UNKNOWN → quarantined, signalled, never dispatched (never a permissive default).

export type CommunicationChannel = "in_app" | "email";

export type CommunicationEventPolicy = {
  kind: string;
  category: "transactional" | "operational" | "approval" | "security" | "reminder" | "optional";
  sensitivity: "normal" | "personal" | "sensitive_hr" | "contractual";
  allowedChannels: CommunicationChannel[];
  requiredChannels: CommunicationChannel[];
  /** named strategy resolved by the recipient resolver (server-side). */
  recipientStrategy: "document_approver" | "document_requester" | "signature_coordinator" | "contract_owner" | "template_author" | "task_target" | "invited_email";
  /** R1.4 — an explicit, documented generic fallback (the ONLY way owner/admin is used). */
  fallbackStrategy?: "tenant_owner";
  templateKey: string;
  humanApprovalRequired: boolean;
  /** can a user preference opt out? mandatory categories (security/contractual/approval-action) cannot. */
  suppressible: boolean;
  quietHoursApplicable: boolean;
  attachmentPolicy: "none" | "secure_link_only" | "attachment_allowed";
  failurePolicy: "retry" | "urgent_retry" | "manual_review";
  maxAttempts: number;
  priority: "low" | "normal" | "high" | "critical";
};

const P = (p: Partial<CommunicationEventPolicy> & { kind: string; templateKey: string; recipientStrategy: string }): CommunicationEventPolicy => ({
  category: "operational",
  sensitivity: "normal",
  allowedChannels: ["in_app"],
  requiredChannels: ["in_app"],
  humanApprovalRequired: false,
  suppressible: false,
  quietHoursApplicable: false,
  attachmentPolicy: "secure_link_only",
  failurePolicy: "retry",
  maxAttempts: 5,
  priority: "normal",
  ...p,
});

// The communicable events, with explicit, server-authoritative policies. Recipient strategies are
// resolved server-side from the real business object (see communication-recipient-resolver.ts).
const POLICIES: Record<string, CommunicationEventPolicy> = {
  // ── documents ──
  "document.ready_for_review": P({ kind: "document.ready_for_review", category: "approval", sensitivity: "sensitive_hr", templateKey: "document.ready_for_review", recipientStrategy: "document_approver", allowedChannels: ["in_app", "email"], requiredChannels: ["in_app"], priority: "high", attachmentPolicy: "secure_link_only" }),
  "document.approved": P({ kind: "document.approved", category: "operational", templateKey: "document.approved", recipientStrategy: "document_requester", allowedChannels: ["in_app", "email"], requiredChannels: ["in_app"], suppressible: true, quietHoursApplicable: true }),
  "document.signature_ready": P({ kind: "document.signature_ready", category: "operational", sensitivity: "contractual", templateKey: "document.signature_ready", recipientStrategy: "signature_coordinator", allowedChannels: ["in_app"], requiredChannels: ["in_app"], priority: "high" }),
  // ── contracts ──
  "contract.approved": P({ kind: "contract.approved", category: "operational", sensitivity: "sensitive_hr", templateKey: "contract.approved", recipientStrategy: "contract_owner", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app"], requiredChannels: ["in_app"] }),
  "contract.signature_prepared": P({ kind: "contract.signature_prepared", category: "operational", sensitivity: "contractual", templateKey: "contract.signature_prepared", recipientStrategy: "contract_owner", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app"], requiredChannels: ["in_app"] }),
  "contract.finalized": P({ kind: "contract.finalized", category: "transactional", sensitivity: "contractual", templateKey: "contract.signed", recipientStrategy: "contract_owner", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app", "email"], requiredChannels: ["in_app"], priority: "high", attachmentPolicy: "secure_link_only" }),
  "contract.amendment_activated": P({ kind: "contract.amendment_activated", category: "operational", sensitivity: "contractual", templateKey: "contract.amendment_activated", recipientStrategy: "contract_owner", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app"], requiredChannels: ["in_app"] }),
  "contract.generation_blocked": P({ kind: "contract.generation_blocked", category: "operational", sensitivity: "sensitive_hr", templateKey: "contract.blocked", recipientStrategy: "contract_owner", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app"], requiredChannels: ["in_app"], priority: "high", failurePolicy: "urgent_retry" }),
  // ── signatures ──
  "signature.completed": P({ kind: "signature.completed", category: "transactional", sensitivity: "contractual", templateKey: "signature.completed", recipientStrategy: "contract_owner", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app", "email"], requiredChannels: ["in_app"], priority: "high", attachmentPolicy: "secure_link_only" }),
  "signature.request_activated": P({ kind: "signature.request_activated", category: "operational", sensitivity: "contractual", templateKey: "signature.activated", recipientStrategy: "signature_coordinator", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app"], requiredChannels: ["in_app"] }),
  // ── templates ──
  "template.published": P({ kind: "template.published", category: "operational", templateKey: "template.published", recipientStrategy: "template_author", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app"], requiredChannels: ["in_app"], suppressible: true }),
  // ── mission/task external side effect ──
  "email": P({ kind: "email", category: "operational", templateKey: "task.notification", recipientStrategy: "task_target", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app"], requiredChannels: ["in_app"], suppressible: true, quietHoursApplicable: true }),
  "low_risk_notification": P({ kind: "low_risk_notification", category: "optional", templateKey: "task.notification", recipientStrategy: "task_target", fallbackStrategy: "tenant_owner", allowedChannels: ["in_app"], requiredChannels: ["in_app"], suppressible: true, quietHoursApplicable: true }),
  // ── members / invitations (P8.6) — the invitee is an EXTERNAL email (not yet a member): email ONLY,
  // transactional (mandatory, never suppressible), recipient read from the persisted invitation row. ──
  "member.invited": P({ kind: "member.invited", category: "transactional", sensitivity: "personal", templateKey: "member.invited", recipientStrategy: "invited_email", allowedChannels: ["email"], requiredChannels: ["email"], priority: "high", attachmentPolicy: "none" }),
};

// Known internal lifecycle events that are intentionally NOT communications (skipped cleanly, not
// quarantined). These are real, expected event kinds that produce no recipient-facing message.
const NON_COMMUNICABLE = new Set<string>([
  "contract.created", "contract.version_created", "contract.readiness_checked", "contract.generation_started",
  "contract.generated", "contract.approval_invalidated", "contract.amendment_created",
  "template.created", "template.version_created", "template.review_requested", "template.changes_requested",
  "template.approved", "template.approval_invalidated", "template.deprecated", "template.archived", "template.preview_rendered",
  "signature.provider_request_created", "signature.document_uploaded", "signature.recipient_created",
  "signature.evidence_downloaded", "signature.signed_document_stored",
  "document", "file",
]);

export type EventClassification =
  | { kind: "communicable"; policy: CommunicationEventPolicy }
  | { kind: "non_communicable" }
  | { kind: "unknown" };

/** Classify an outbox event kind. The policy comes ONLY from here — never from the payload. */
export function classifyCommunicationEvent(eventKind: string): EventClassification {
  const policy = POLICIES[eventKind];
  if (policy) return { kind: "communicable", policy };
  if (NON_COMMUNICABLE.has(eventKind)) return { kind: "non_communicable" };
  return { kind: "unknown" };
}

export function getCommunicationPolicy(eventKind: string): CommunicationEventPolicy | null {
  return POLICIES[eventKind] ?? null;
}

export function allCommunicablePolicies(): CommunicationEventPolicy[] {
  return Object.values(POLICIES);
}

/** A category whose communications can NEVER be suppressed by a user preference. */
export function isMandatoryCategory(category: CommunicationEventPolicy["category"]): boolean {
  return category === "security" || category === "transactional" || category === "approval";
}
