// src/lib/pierre/cockpit/permissions.ts
// Pierre Cockpit B40 — Access control checks. Pure. No async, no Supabase.
// Determines what a given tenant is allowed to do in the cockpit.

import type { PierreTenantContext, PierreCockpitTaskSummary } from "./types";
import { isNonPayingAccess, isPaidAccess, isTenantAuthorized } from "./tenant";

// ── Task action guards ────────────────────────────────────────────────────────

const SENSITIVE_TASK_TYPES = new Set([
  "email.send", "send_email",
  "hr_contract_draft", "hr_amendment_draft",
  "offboarding_checklist", "sensitive_case_note",
  "prepay_summary", "disciplinary_notice",
]);

const EMAIL_TASK_TYPES = new Set([
  "email.send", "email.draft", "send_email", "email_send", "email_draft",
]);

export type CockpitPermissions = {
  can_submit_mission: boolean;
  can_approve_task: boolean;
  can_cancel_task: boolean;
  can_run_task: boolean;
  can_prepare_email: boolean;
  can_view_deliverables: boolean;
  can_view_memory: boolean;
  can_view_history: boolean;
  can_view_employees: boolean;
  can_use_ai: boolean;
};

export function resolveCockpitPermissions(tenant: PierreTenantContext | null): CockpitPermissions {
  const authorized = isTenantAuthorized(tenant);
  const paid = tenant ? isPaidAccess(tenant) : false;
  const nonPaying = tenant ? isNonPayingAccess(tenant) : true;

  if (nonPaying || !authorized) {
    return {
      can_submit_mission: false,
      can_approve_task: false,
      can_cancel_task: false,
      can_run_task: false,
      can_prepare_email: false,
      can_view_deliverables: false,
      can_view_memory: false,
      can_view_history: false,
      can_view_employees: false,
      can_use_ai: false,
    };
  }

  return {
    can_submit_mission: authorized,
    can_approve_task: authorized,
    can_cancel_task: authorized,
    can_run_task: authorized,
    can_prepare_email: paid,         // B39: email actions require paid access
    can_view_deliverables: authorized,
    can_view_memory: authorized,
    can_view_history: authorized,
    can_view_employees: authorized,
    can_use_ai: paid,                // B38A: AI requires paid access
  };
}

// ── Per-task action checks ────────────────────────────────────────────────────

export type TaskActionPermission = {
  allowed: boolean;
  reason: string | null;
};

export function canApproveTask(
  task: PierreCockpitTaskSummary,
  tenant: PierreTenantContext | null,
): TaskActionPermission {
  if (!isTenantAuthorized(tenant)) {
    return { allowed: false, reason: "Accès Pierre requis" };
  }
  if (task.status === "done" || task.status === "completed") {
    return { allowed: false, reason: "Tâche déjà terminée" };
  }
  if (task.status === "cancelled") {
    return { allowed: false, reason: "Tâche annulée" };
  }
  return { allowed: true, reason: null };
}

export function canCancelTask(
  task: PierreCockpitTaskSummary,
  tenant: PierreTenantContext | null,
): TaskActionPermission {
  if (!isTenantAuthorized(tenant)) {
    return { allowed: false, reason: "Accès Pierre requis" };
  }
  if (task.status === "done" || task.status === "completed") {
    return { allowed: false, reason: "Tâche déjà terminée" };
  }
  if (task.status === "cancelled") {
    return { allowed: false, reason: "Tâche déjà annulée" };
  }
  return { allowed: true, reason: null };
}

export function canRunTask(
  task: PierreCockpitTaskSummary,
  tenant: PierreTenantContext | null,
): TaskActionPermission {
  if (!isTenantAuthorized(tenant)) {
    return { allowed: false, reason: "Accès Pierre requis" };
  }
  if (EMAIL_TASK_TYPES.has(task.type)) {
    return {
      allowed: false,
      reason: "Les emails doivent être préparés via le panneau email (B39 dry-run/mock)",
    };
  }
  if (task.isSensitive && task.requiresValidation) {
    return { allowed: false, reason: "Validation humaine requise avant exécution" };
  }
  if (task.status === "awaiting_approval") {
    return { allowed: false, reason: "En attente de validation — approuvez d'abord" };
  }
  if (task.status === "done" || task.status === "completed") {
    return { allowed: false, reason: "Tâche déjà terminée" };
  }
  if (task.status === "cancelled") {
    return { allowed: false, reason: "Tâche annulée" };
  }
  return { allowed: true, reason: null };
}

export function canSendEmail(
  task: PierreCockpitTaskSummary,
  tenant: PierreTenantContext | null,
  emailMode: string,
): TaskActionPermission {
  // B39 constraint: never allow real email send from UI
  if (emailMode === "live") {
    return {
      allowed: false,
      reason: "Envoi email live désactivé dans le cockpit (B39 — triple opt-in requis côté serveur)",
    };
  }
  if (!isTenantAuthorized(tenant)) {
    return { allowed: false, reason: "Accès Pierre requis" };
  }
  if (!isPaidAccess(tenant!)) {
    return { allowed: false, reason: "Abonnement payant requis pour préparer des emails" };
  }
  if (task.requiresValidation) {
    return { allowed: false, reason: "Email sensible — validation humaine requise" };
  }
  return { allowed: true, reason: null };
}

// ── Sensitive action detection ────────────────────────────────────────────────

export function isSensitiveTaskType(taskType: string): boolean {
  return SENSITIVE_TASK_TYPES.has(taskType);
}

export function isEmailTaskType(taskType: string): boolean {
  return EMAIL_TASK_TYPES.has(taskType);
}

export function getBlockedReason(
  task: PierreCockpitTaskSummary,
  tenant: PierreTenantContext | null,
  emailMode: string,
): string | null {
  if (isEmailTaskType(task.type)) {
    const emailPerm = canSendEmail(task, tenant, emailMode);
    if (!emailPerm.allowed) return emailPerm.reason;
    // Even when "allowed" in mock/dry_run, always clarify this goes through the email panel
    return `Email en mode ${emailMode} — à préparer via le panneau Emails (B39 — aucun vrai envoi)`;
  }
  if (task.isSensitive) {
    return "Action sensible — validation humaine requise avant toute exécution";
  }
  if (!isTenantAuthorized(tenant)) {
    return "Accès Pierre requis";
  }
  return null;
}
