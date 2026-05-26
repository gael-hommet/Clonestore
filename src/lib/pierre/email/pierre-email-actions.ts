// src/lib/pierre/email/pierre-email-actions.ts
// B39 — Pierre email action orchestrator.
// Combines: use-case policy → template → B39 send-policy → runtime.
// Does NOT call OpenAI or Anthropic. No AI credits consumed.
// All sensitive/official emails require human validation — never auto-sent.

import type { EmailSendResult } from "@/lib/cloneos/channels/email-production/types";
import { buildPierreEmailContext, type PierreEmailUseCase } from "./pierre-email-policy";
import { buildPierreTemplatedPayload, type PierreEmailTemplateVars } from "./pierre-email-templates";
import { sendEmailProduction } from "@/lib/cloneos/channels/email-production/runtime";

// ── Action params ─────────────────────────────────────────────────────────────

export type PierreEmailActionParams = {
  // Caller context
  company_id: string;
  user_id: string | null;
  access_level: string;
  use_case: PierreEmailUseCase;

  // Mission / task correlation
  mission_id?: string | null;
  task_id?: string | null;
  employee_id?: string | null;

  // Routing
  from: string;
  to: string[];
  reply_to?: string | null;
  cc?: string[];
  bcc?: string[];

  // Template variables
  vars: PierreEmailTemplateVars;

  // Overrides
  override_sensitive?: boolean;
  override_approval_required?: boolean;
};

// ── Main action ───────────────────────────────────────────────────────────────

export async function sendPierreEmailAction(
  params: PierreEmailActionParams,
): Promise<EmailSendResult> {
  const {
    company_id,
    user_id,
    access_level,
    use_case,
    mission_id = null,
    task_id = null,
    employee_id = null,
    from,
    to,
    reply_to = null,
    cc = [],
    bcc = [],
    vars,
    override_sensitive,
    override_approval_required,
  } = params;

  // 1. Build send context from Pierre use-case
  const context = buildPierreEmailContext({
    company_id,
    user_id,
    access_level,
    use_case,
    mission_id,
    task_id,
    employee_id,
    override_sensitive,
    override_approval_required,
  });

  // 2. Build email payload from template
  const payload = buildPierreTemplatedPayload({
    use_case,
    from,
    to,
    vars,
    reply_to,
    cc,
    bcc,
  });

  // 3. Send through B39 production runtime
  return sendEmailProduction(context, payload);
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export async function sendPierreHrNotification(params: {
  company_id: string;
  user_id: string | null;
  access_level: string;
  from: string;
  to: string[];
  mission_id?: string | null;
  vars: PierreEmailTemplateVars;
}): Promise<EmailSendResult> {
  return sendPierreEmailAction({ ...params, use_case: "hr_notification" });
}

export async function sendPierreOnboardingEmail(params: {
  company_id: string;
  user_id: string | null;
  access_level: string;
  from: string;
  to: string[];
  mission_id?: string | null;
  vars: PierreEmailTemplateVars;
}): Promise<EmailSendResult> {
  return sendPierreEmailAction({
    ...params,
    use_case: "onboarding_email",
    override_approval_required: true,
  });
}

export async function sendPierreDocumentDelivery(params: {
  company_id: string;
  user_id: string | null;
  access_level: string;
  from: string;
  to: string[];
  mission_id?: string | null;
  task_id?: string | null;
  employee_id?: string | null;
  vars: PierreEmailTemplateVars;
}): Promise<EmailSendResult> {
  return sendPierreEmailAction({
    ...params,
    use_case: "document_delivery",
    override_approval_required: true,
  });
}

export async function sendPierreSensitiveHrEmail(params: {
  company_id: string;
  user_id: string | null;
  access_level: string;
  from: string;
  to: string[];
  mission_id?: string | null;
  employee_id?: string | null;
  vars: PierreEmailTemplateVars;
}): Promise<EmailSendResult> {
  // Sensitive HR — always blocked without approval_required=true
  return sendPierreEmailAction({
    ...params,
    use_case: "sensitive_hr",
    override_sensitive: true,
    override_approval_required: true,
  });
}

export async function sendPierrePrepayrollAlert(params: {
  company_id: string;
  user_id: string | null;
  access_level: string;
  from: string;
  to: string[];
  mission_id?: string | null;
  vars: PierreEmailTemplateVars;
}): Promise<EmailSendResult> {
  return sendPierreEmailAction({ ...params, use_case: "prepayroll_alert" });
}
