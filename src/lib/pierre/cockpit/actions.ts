// src/lib/pierre/cockpit/actions.ts
// Pierre Cockpit B40 — Safe action builders. Pure. No async, no Supabase.
// Validates payloads before they reach the API client.
// Company_id / user_id are NEVER accepted from client action payloads.

import type { PierreTenantContext } from "./types";
import { isTenantAuthorized, sanitizeActionPayload } from "./tenant";

// ── Mission submit ────────────────────────────────────────────────────────────

export type MissionSubmitPayload = {
  input: string;
  source?: string;
  autonomy_level?: string;
};

export type ValidatedMissionPayload = {
  ok: true;
  payload: MissionSubmitPayload;
} | {
  ok: false;
  error: string;
};

export function buildMissionSubmitPayload(
  input: string,
  tenant: PierreTenantContext | null,
  options: { source?: string; autonomy_level?: string } = {},
): ValidatedMissionPayload {
  if (!isTenantAuthorized(tenant)) {
    return { ok: false, error: "Accès Pierre requis pour soumettre une mission" };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "La mission ne peut pas être vide" };
  }
  if (trimmed.length < 5) {
    return { ok: false, error: "La mission est trop courte (minimum 5 caractères)" };
  }
  if (trimmed.length > 4000) {
    return { ok: false, error: "La mission est trop longue (maximum 4000 caractères)" };
  }
  return {
    ok: true,
    payload: {
      input: trimmed,
      source: options.source ?? "cockpit_b40",
      autonomy_level: options.autonomy_level,
    },
  };
}

// ── Task actions ──────────────────────────────────────────────────────────────

export type TaskActionPayload = {
  task_id: string;
  reason?: string;
};

export type ValidatedTaskPayload = {
  ok: true;
  task_id: string;
  extra: Record<string, unknown>;
} | {
  ok: false;
  error: string;
};

export function buildTaskApprovePayload(
  taskId: string,
  tenant: PierreTenantContext | null,
  extra: Record<string, unknown> = {},
): ValidatedTaskPayload {
  if (!isTenantAuthorized(tenant)) {
    return { ok: false, error: "Accès Pierre requis" };
  }
  if (!taskId?.trim()) {
    return { ok: false, error: "taskId requis" };
  }
  return {
    ok: true,
    task_id: taskId,
    extra: sanitizeActionPayload(extra, tenant!),
  };
}

export function buildTaskCancelPayload(
  taskId: string,
  tenant: PierreTenantContext | null,
  reason?: string,
): ValidatedTaskPayload {
  if (!isTenantAuthorized(tenant)) {
    return { ok: false, error: "Accès Pierre requis" };
  }
  if (!taskId?.trim()) {
    return { ok: false, error: "taskId requis" };
  }
  const extra: Record<string, unknown> = {};
  if (reason) extra.reason = reason.slice(0, 500);
  return {
    ok: true,
    task_id: taskId,
    extra: sanitizeActionPayload(extra, tenant!),
  };
}

export function buildTaskRunPayload(
  taskId: string,
  tenant: PierreTenantContext | null,
  extra: Record<string, unknown> = {},
): ValidatedTaskPayload {
  if (!isTenantAuthorized(tenant)) {
    return { ok: false, error: "Accès Pierre requis" };
  }
  if (!taskId?.trim()) {
    return { ok: false, error: "taskId requis" };
  }
  return {
    ok: true,
    task_id: taskId,
    extra: sanitizeActionPayload(extra, tenant!),
  };
}

// ── Email prepare action ──────────────────────────────────────────────────────
// B39: never sends real email from cockpit UI. Always dry-run/mock.

export type EmailPreparePayload = {
  task_id: string;
  email_mode: "mock" | "dry_run";   // Never "live" from client
  recipient?: string;
  subject_hint?: string;
};

export type ValidatedEmailPayload = {
  ok: true;
  payload: EmailPreparePayload;
} | {
  ok: false;
  error: string;
};

export function buildEmailPreparePayload(
  taskId: string,
  tenant: PierreTenantContext | null,
  options: { recipient?: string; subject_hint?: string } = {},
): ValidatedEmailPayload {
  if (!isTenantAuthorized(tenant)) {
    return { ok: false, error: "Accès Pierre requis" };
  }
  if (!taskId?.trim()) {
    return { ok: false, error: "taskId requis" };
  }
  // B39 constraint: cockpit ALWAYS uses mock or dry_run — never live
  return {
    ok: true,
    payload: {
      task_id: taskId,
      email_mode: "mock",          // Hardcoded — cockpit never sends real email
      recipient: options.recipient,
      subject_hint: options.subject_hint,
    },
  };
}

// ── Next actions resolver ─────────────────────────────────────────────────────

export type CockpitContext = {
  hasMission: boolean;
  hasValidations: boolean;
  hasSensitiveTasks: boolean;
  hasEmailTasks: boolean;
  hasDeliverables: boolean;
  memoryConfigured: boolean;
  emailMode: string;
};

export function resolveNextActions(ctx: CockpitContext): string[] {
  const actions: string[] = [];

  if (!ctx.hasMission) {
    actions.push("Soumettez votre première mission RH dans la zone de commande");
  }

  if (ctx.hasValidations) {
    actions.push("Validations en attente — approuvez ou refusez les tâches en attente");
  }

  if (ctx.hasSensitiveTasks) {
    actions.push("Tâches sensibles détectées — validation humaine obligatoire");
  }

  if (ctx.hasEmailTasks && ctx.emailMode === "mock") {
    actions.push("Emails préparés en mode mock — configurez le mode live pour envoi réel");
  }

  if (ctx.hasDeliverables) {
    actions.push("Livrables disponibles — consultez Documents & Emails");
  }

  if (!ctx.memoryConfigured) {
    actions.push("Configurez l'empreinte entreprise (CloneADN) pour personnaliser Pierre");
  }

  return actions.slice(0, 5);
}
