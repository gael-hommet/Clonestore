// B43 — Runbook: actionable guidance per error code / domain

import type { ObservableEventDomain } from "./types";

// ── Runbook entry ─────────────────────────────────────────────────────────────

export type RunbookEntry = {
  code: string;
  title: string;
  description: string;
  steps: string[];
  escalate: boolean;
  auto_recoverable: boolean;
  doc_link?: string;
};

// ── Error-code runbook ────────────────────────────────────────────────────────

const ERROR_CODE_RUNBOOK: Record<string, RunbookEntry> = {
  tenant_mismatch: {
    code: "tenant_mismatch",
    title: "Tenant mismatch detected",
    description: "A request attempted to access data belonging to a different company.",
    steps: [
      "Identify the correlation_id and log all related events.",
      "Verify the company_id in the request context vs the resource owner.",
      "Block the request — do not proceed.",
      "Alert the security team immediately.",
    ],
    escalate: true,
    auto_recoverable: false,
  },
  security_violation: {
    code: "security_violation",
    title: "Security violation",
    description: "A hard security rule was violated (CloneGuard, RGPD guard, or policy check).",
    steps: [
      "Do not retry — this is a hard block.",
      "Log full audit trail with correlation_id.",
      "Escalate to security team within 15 minutes.",
      "Freeze the affected user session if possible.",
    ],
    escalate: true,
    auto_recoverable: false,
  },
  budget_exceeded: {
    code: "budget_exceeded",
    title: "AI budget exceeded",
    description: "The company's AI token budget has been exhausted for the current period.",
    steps: [
      "Do not retry AI calls — they will all fail.",
      "Notify the account manager to review budget.",
      "Surface a safe user message: 'Quota IA atteint — contactez votre administrateur.'",
      "Queue the request if budget reset is imminent.",
    ],
    escalate: false,
    auto_recoverable: false,
  },
  ai_budget_exceeded: {
    code: "ai_budget_exceeded",
    title: "AI budget exceeded (per-call)",
    description: "A single AI call exceeded the per-request token limit.",
    steps: [
      "Reduce the input size and retry once.",
      "If recurring, escalate to engineering for prompt size audit.",
    ],
    escalate: false,
    auto_recoverable: true,
  },
  validation_missing: {
    code: "validation_missing",
    title: "Required field missing",
    description: "A required input field was missing or invalid.",
    steps: [
      "Return a safe user message listing the missing fields.",
      "Do not retry — user input is required.",
    ],
    escalate: false,
    auto_recoverable: false,
  },
  sensitive_blocked: {
    code: "sensitive_blocked",
    title: "Sensitive action blocked",
    description: "The action was blocked because it involves a sensitive HR case requiring human approval.",
    steps: [
      "Do not retry automatically.",
      "Notify the HR manager that approval is required.",
      "Log the escalation in the audit trail.",
    ],
    escalate: true,
    auto_recoverable: false,
  },
  email_blocked_by_policy: {
    code: "email_blocked_by_policy",
    title: "Email blocked by policy",
    description: "Pierre's B39 email policy blocked this email from being sent.",
    steps: [
      "Do not retry — this is an intentional block.",
      "Review the email context: is an approval needed?",
      "Surface to cockpit for human decision.",
    ],
    escalate: false,
    auto_recoverable: false,
  },
  rgpd_purge_blocked: {
    code: "rgpd_purge_blocked",
    title: "RGPD purge blocked",
    description: "A RGPD purge was blocked due to a conflicting active legal hold or pending request.",
    steps: [
      "Do not retry.",
      "Escalate to DPO immediately.",
      "Document the blocking reason in the RGPD audit log.",
    ],
    escalate: true,
    auto_recoverable: false,
  },
  workflow_hard_fail: {
    code: "workflow_hard_fail",
    title: "Workflow hard fail",
    description: "A B42 workflow violated a hard constraint (cross-tenant leak, security bypass, etc.).",
    steps: [
      "Do not retry.",
      "Review the hard_fail_conditions in the workflow result.",
      "Escalate to engineering — this is a system integrity issue.",
    ],
    escalate: true,
    auto_recoverable: false,
  },
  unauthorized: {
    code: "unauthorized",
    title: "Unauthorized request",
    description: "The request lacks valid authentication credentials.",
    steps: [
      "Return 401 to the client.",
      "Do not expose internal details.",
      "Log the correlation_id for audit.",
    ],
    escalate: false,
    auto_recoverable: false,
  },
  forbidden: {
    code: "forbidden",
    title: "Forbidden request",
    description: "The authenticated user does not have permission for this action.",
    steps: [
      "Return 403 to the client.",
      "Do not expose the reason in the client response.",
      "Log for audit.",
    ],
    escalate: false,
    auto_recoverable: false,
  },
  approval_required: {
    code: "approval_required",
    title: "Human approval required",
    description: "This action requires explicit human approval before proceeding.",
    steps: [
      "Surface the approval request in the cockpit.",
      "Notify the responsible manager.",
      "Do not auto-execute — wait for explicit approval.",
    ],
    escalate: false,
    auto_recoverable: false,
  },
  ai_timeout: {
    code: "ai_timeout",
    title: "AI call timed out",
    description: "The AI provider did not respond within the allowed time.",
    steps: [
      "Retry with exponential backoff (max 2 retries for AI domain).",
      "If persistent, degrade gracefully and surface to cockpit.",
    ],
    escalate: false,
    auto_recoverable: true,
  },
  ai_provider_error: {
    code: "ai_provider_error",
    title: "AI provider returned an error",
    description: "The upstream AI API returned a 5xx or rate-limit error.",
    steps: [
      "Retry with exponential backoff.",
      "If rate-limited, respect Retry-After headers.",
      "Alert if error rate exceeds 10% of AI calls.",
    ],
    escalate: false,
    auto_recoverable: true,
  },
  email_send_failed: {
    code: "email_send_failed",
    title: "Email delivery failed",
    description: "The email provider returned an error during send.",
    steps: [
      "Retry once after 5 seconds.",
      "If still failing, dead-letter the email and surface to cockpit.",
      "Do not resend if the error is a hard bounce (invalid address).",
    ],
    escalate: false,
    auto_recoverable: true,
  },
  document_generation_failed: {
    code: "document_generation_failed",
    title: "Document generation failed",
    description: "Pierre failed to generate an HR document.",
    steps: [
      "Retry up to 2 times.",
      "If failing, surface the error to the cockpit with the document type.",
      "Check AI provider health.",
    ],
    escalate: false,
    auto_recoverable: true,
  },
  memory_write_failed: {
    code: "memory_write_failed",
    title: "Memory write failed",
    description: "Pierre failed to persist memory to the database.",
    steps: [
      "Retry up to 2 times.",
      "If persistent, check Supabase connectivity.",
      "Do not lose the memory data — queue for later write.",
    ],
    escalate: false,
    auto_recoverable: true,
  },
  unknown_error: {
    code: "unknown_error",
    title: "Unknown error",
    description: "An unexpected error occurred that was not classified.",
    steps: [
      "Check the internal_message in the error log.",
      "Review the correlation_id trace.",
      "Escalate to engineering if recurring.",
    ],
    escalate: false,
    auto_recoverable: false,
  },
};

// ── Domain runbook ────────────────────────────────────────────────────────────

const DOMAIN_RUNBOOK: Record<ObservableEventDomain, string[]> = {
  ai:       ["Check AI provider status page.", "Verify token budget.", "Review prompt size."],
  email:    ["Check Resend status.", "Verify recipient address validity.", "Review email policy blocks."],
  workflow: ["Review hard fail conditions.", "Check scenario classification.", "Escalate if security-related."],
  task:     ["Retry transient failures.", "Check task status before re-queuing.", "Verify executor availability."],
  mission:  ["Check mission state machine.", "Verify all tasks completed.", "Review rollback conditions."],
  cockpit:  ["Refresh cockpit snapshot.", "Check Supabase connectivity.", "Verify tenant isolation."],
  security: ["Never auto-retry security errors.", "Escalate immediately.", "Log full audit trail."],
  rgpd:     ["Escalate RGPD purge blocks to DPO.", "Do not retry blocked purges.", "Document in RGPD audit log."],
  billing:  ["Check billing provider status.", "Retry once after 3 seconds.", "Alert if budget gate fails."],
  document: ["Retry document generation up to 2 times.", "Check AI provider.", "Log document type in error metadata."],
  pdf:      ["Retry PDF rendering once.", "Check memory limits.", "Fall back to HTML if PDF fails persistently."],
  memory:   ["Retry memory operations up to 2 times.", "Check Supabase connectivity.", "Queue write for later if failing."],
  channel:  ["Check channel provider status.", "Retry once.", "Dead-letter if persistent failure."],
  system:   ["Check runtime environment.", "Verify env vars present.", "Review system health dashboard."],
};

// ── Lookup functions ──────────────────────────────────────────────────────────

export function getRunbookForErrorCode(code: string): RunbookEntry | null {
  return ERROR_CODE_RUNBOOK[code] ?? null;
}

export function getRunbookForDomain(domain: ObservableEventDomain): string[] {
  return DOMAIN_RUNBOOK[domain] ?? ["Review error logs.", "Check system health.", "Escalate if recurring."];
}

export function buildRecommendedActions(
  code: string,
  domain: ObservableEventDomain,
): string[] {
  const runbook = getRunbookForErrorCode(code);
  if (runbook) return runbook.steps;
  return getRunbookForDomain(domain);
}

export function shouldEscalate(code: string): boolean {
  return ERROR_CODE_RUNBOOK[code]?.escalate ?? false;
}

export function isAutoRecoverable(code: string): boolean {
  return ERROR_CODE_RUNBOOK[code]?.auto_recoverable ?? false;
}
