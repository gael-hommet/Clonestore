// src/lib/pierre/brain/task-bridge.ts
// Pierre Brain Task Bridge — conversion brain tasks → DB-ready PierreTaskDraft.
// Module pur : pas de Supabase, pas de Next, pas d'async, ne throw jamais.
// CRITIQUE : utilise execute_at (jamais scheduled_for). Ne crée jamais email.send sans approval.

import type { PierreBrainTaskPlan, PierreBrainTaskDraft, PierreBrainRiskLevel } from "./types";
import type {
  PierreTaskDraft,
  PierreTaskType,
  PierreRiskLevel,
  PierreTaskStatus,
  PierreOutputKind,
} from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

// Tous les types email exigent approval_required=true dans le cerveau IA
const ALWAYS_APPROVAL_TASK_TYPES = new Set([
  "email.send",
  "email.draft",
  "send_email",
  "email_send",
]);

// Mapping des types proposés par le cerveau vers PierreTaskType valides
// email.send → email.draft : conversion de sécurité obligatoire
const BRAIN_TYPE_TO_PIERRE_TYPE: Record<string, PierreTaskType> = {
  "email.send": "email.draft",
  "email.draft": "email.draft",
  "email_send": "email.draft",
  "send_email": "email.draft",
  "doc.generate": "doc.generate",
  "document.generate": "doc.generate",
  "doc.rewrite": "doc.rewrite",
  "document.rewrite": "doc.rewrite",
  "pdf.generate": "pdf.generate",
  "reminder.create": "reminder.create",
  "followup.schedule": "followup.schedule",
  "contract.generate": "doc.generate",
  "amendment.generate": "doc.generate",
  "hr.document": "doc.generate",
  "onboarding.document": "doc.generate",
  "absence.document": "doc.generate",
  "document.prepare": "doc.generate",
  "employee.summary": "doc.generate",
  "prepayroll.summary": "doc.generate",
};

const VALID_PIERRE_TASK_TYPES = new Set<string>([
  "email.send",
  "email.draft",
  "doc.generate",
  "doc.rewrite",
  "pdf.generate",
  "reminder.create",
  "followup.schedule",
]);

// ── Internal helpers ──────────────────────────────────────────────────────────

function safeStr(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim();
  return fallback;
}

function safeNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  const result = isNaN(n) ? fallback : n;
  return Math.max(min, Math.min(max, result));
}

function mapBrainRiskToDbRisk(risk: PierreBrainRiskLevel): PierreRiskLevel {
  if (risk === "critical" || risk === "high") return "high";
  if (risk === "medium") return "medium";
  return "low";
}

function inferOutputKind(taskType: PierreTaskType): PierreOutputKind {
  if (taskType === "email.send" || taskType === "email.draft") return "email";
  if (taskType === "doc.generate" || taskType === "doc.rewrite") return "document";
  if (taskType === "pdf.generate") return "pdf";
  if (taskType === "followup.schedule") return "followup";
  if (taskType === "reminder.create") return "reminder";
  return "none";
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

// ── Public functions ──────────────────────────────────────────────────────────

/**
 * Convertit un type proposé par le cerveau IA en PierreTaskType valide et sûr.
 * email.send est toujours converti en email.draft.
 * Les types inconnus sont mappés vers doc.generate.
 */
export function sanitizeBrainTaskType(rawType: unknown): PierreTaskType {
  if (typeof rawType !== "string" || rawType.trim().length === 0) {
    return "doc.generate";
  }
  const normalized = rawType.trim().toLowerCase();
  const mapped = BRAIN_TYPE_TO_PIERRE_TYPE[normalized];
  if (mapped !== undefined) return mapped;
  if (VALID_PIERRE_TASK_TYPES.has(normalized)) return normalized as PierreTaskType;
  return "doc.generate";
}

/**
 * Applique les règles de sécurité obligatoires sur un PierreTaskDraft.
 * - Tous les types email → approval_required=true
 * - Risque high → approval_required=true
 * - sensitive_topics non vides → approval_required=true
 * - globalApprovalRequired=true → approval_required=true sur toutes les tâches
 * - Ne touche jamais scheduled_for. execute_at reste null (jamais modifié ici).
 */
export function enforceBrainTaskSafety(
  task: PierreTaskDraft,
  options?: {
    sensitiveTopics?: string[];
    globalApprovalRequired?: boolean;
  },
): PierreTaskDraft {
  const sensitiveTopics = Array.isArray(options && options.sensitiveTopics)
    ? (options as { sensitiveTopics: string[] }).sensitiveTopics
    : [];
  const globalApproval = Boolean(options && options.globalApprovalRequired);

  const typeNorm = safeStr(task.type).toLowerCase();
  const isEmailType = ALWAYS_APPROVAL_TASK_TYPES.has(typeNorm);
  const isHighRisk = task.risk_level === "high";
  const hasSensitiveTopics = sensitiveTopics.length > 0;

  const approvalRequired =
    task.approval_required ||
    isEmailType ||
    isHighRisk ||
    hasSensitiveTopics ||
    globalApproval;

  return {
    ...task,
    approval_required: approvalRequired,
  };
}

/**
 * Convertit un PierreBrainTaskPlan en PierreTaskDraft[] prêts pour la DB.
 * Ne throw jamais. Retourne [] si l'entrée est invalide.
 * Applique sanitizeBrainTaskType + enforceBrainTaskSafety sur chaque tâche.
 * Si cloneADNContext est fourni, applique les règles ADN sur chaque tâche.
 */
export function convertPierreBrainTaskPlanToTaskDrafts(
  taskPlan: PierreBrainTaskPlan | null | undefined,
  options?: {
    sensitiveTopics?: string[];
    globalApprovalRequired?: boolean;
    maxTasks?: number;
    cloneADNContext?: {
      blocked_task_types?: string[];
      never_auto_execute?: string[];
      always_require_human_for?: string[];
      sensitive_topics?: string[];
      validation_mode?: string;
      autonomy_level?: string;
    } | null;
  },
): PierreTaskDraft[] {
  if (!taskPlan || !Array.isArray(taskPlan.tasks)) return [];

  const sensitiveTopics = Array.isArray(options && options.sensitiveTopics)
    ? (options as { sensitiveTopics: string[] }).sensitiveTopics
    : [];
  const globalApprovalRequired = Boolean(options && options.globalApprovalRequired);
  const maxTasks =
    typeof options !== "undefined" &&
    options !== null &&
    typeof options.maxTasks === "number" &&
    options.maxTasks > 0
      ? options.maxTasks
      : 20;

  const adnCtx =
    options && options.cloneADNContext && typeof options.cloneADNContext === "object"
      ? options.cloneADNContext
      : null;
  const adnBlockedTypes = new Set<string>(
    Array.isArray(adnCtx && adnCtx.blocked_task_types) ? (adnCtx as { blocked_task_types: string[] }).blocked_task_types.map((t) => t.toLowerCase()) : [],
  );
  const adnNeverAuto = new Set<string>(
    Array.isArray(adnCtx && adnCtx.never_auto_execute) ? (adnCtx as { never_auto_execute: string[] }).never_auto_execute.map((t) => t.toLowerCase()) : [],
  );
  const adnAlwaysHuman = new Set<string>(
    Array.isArray(adnCtx && adnCtx.always_require_human_for) ? (adnCtx as { always_require_human_for: string[] }).always_require_human_for.map((t) => t.toLowerCase()) : [],
  );
  const adnSensitiveTopics = Array.isArray(adnCtx && adnCtx.sensitive_topics)
    ? (adnCtx as { sensitive_topics: string[] }).sensitive_topics
    : [];
  const allSensitiveTopics = [...sensitiveTopics, ...adnSensitiveTopics];

  const results: PierreTaskDraft[] = [];

  for (let i = 0; i < Math.min(taskPlan.tasks.length, maxTasks); i++) {
    const brainTask: PierreBrainTaskDraft = taskPlan.tasks[i];
    if (!brainTask || typeof brainTask !== "object") continue;

    const safeType = sanitizeBrainTaskType(brainTask.type);
    const riskLevel = mapBrainRiskToDbRisk(
      (brainTask.risk_level as PierreBrainRiskLevel) || "low",
    );

    const rawPayload: Record<string, unknown> =
      brainTask.payload !== null &&
      typeof brainTask.payload === "object" &&
      !Array.isArray(brainTask.payload)
        ? { ...brainTask.payload }
        : {};

    // CloneADN evaluation
    const typeNormLower = safeType.toLowerCase();
    const adnBlocked =
      adnBlockedTypes.has(typeNormLower) || adnNeverAuto.has(typeNormLower);
    const adnRequiresValidation =
      adnAlwaysHuman.has(typeNormLower) || adnSensitiveTopics.length > 0;

    if (adnCtx) {
      rawPayload["cloneadn_applied"] = true;
      rawPayload["autonomy_level"] = adnCtx.autonomy_level ?? null;
      rawPayload["validation_mode"] = adnCtx.validation_mode ?? null;
      rawPayload["requires_validation"] = adnRequiresValidation;
      if (adnBlocked) rawPayload["blocked"] = true;
    }

    const raw: PierreTaskDraft = {
      type: safeType,
      title: safeStr(brainTask.title, `Tâche RH ${i + 1}`),
      description: safeStr(brainTask.description, ""),
      status: "draft" as PierreTaskStatus,
      priority: safeNum(brainTask.priority, 50, 1, 100),
      approval_required: Boolean(brainTask.approval_required) || adnBlocked || adnRequiresValidation,
      risk_level: riskLevel,
      execute_at: null,
      depends_on_json: [],
      payload_json: rawPayload,
      output_kind: inferOutputKind(safeType),
    };

    results.push(
      enforceBrainTaskSafety(raw, { sensitiveTopics: allSensitiveTopics, globalApprovalRequired }),
    );
  }

  return results;
}

/**
 * Fusionne les tâches déterministes et les tâches du cerveau IA.
 * Déduplique par (type + titre normalisé).
 * Les tâches déterministes ont la priorité sur les doublons.
 * Les tâches cerveau non dupliquées sont ajoutées en complément.
 * Ne throw jamais.
 */
export function mergeDeterministicAndBrainTasks(
  deterministicTasks: PierreTaskDraft[],
  brainTasks: PierreTaskDraft[],
  options?: {
    maxTotal?: number;
    brainTasksOnly?: boolean;
  },
): PierreTaskDraft[] {
  const maxTotal =
    typeof options !== "undefined" &&
    options !== null &&
    typeof options.maxTotal === "number" &&
    options.maxTotal > 0
      ? options.maxTotal
      : 30;

  if (options && options.brainTasksOnly) {
    return Array.isArray(brainTasks) ? brainTasks.slice(0, maxTotal) : [];
  }

  const safeDeterm = Array.isArray(deterministicTasks) ? deterministicTasks : [];
  const safeBrain = Array.isArray(brainTasks) ? brainTasks : [];

  const seen = new Set<string>();
  const merged: PierreTaskDraft[] = [];

  for (const task of safeDeterm) {
    const key = `${safeStr(task.type)}::${normalizeTitle(safeStr(task.title))}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(task);
    }
  }

  for (const task of safeBrain) {
    const key = `${safeStr(task.type)}::${normalizeTitle(safeStr(task.title))}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(task);
    }
  }

  return merged.slice(0, maxTotal);
}
