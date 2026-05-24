// src/lib/pierre/context/validation-context.ts
// B35 — Validation context signals: approval gates, human validation requirements.

import type { PierreContextSignal } from "./types";
import { buildContextSignal } from "./context-signals";
import { sanitizeCloneADNProfile } from "../adn/cloneadn";

export function buildValidationContextSignals(params: {
  company_id: string;
  clone_adn_profile: Record<string, unknown> | null;
  tasks: Record<string, unknown>[];
  files: Record<string, unknown>[];
  current_task_type?: string | null;
  employee_id?: string | null;
  mission_id?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];

  const profile = sanitizeCloneADNProfile(params.clone_adn_profile);

  // ── Task-level approval gates ─────────────────────────────────────────────

  const pendingTasks = params.tasks.filter(
    (t) => t.approval_required === true && t.status === "awaiting_approval",
  );

  if (pendingTasks.length > 0) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "validation",
        source: "task_record",
        type: "validation_gate",
        priority: "critical",
        risk: "high",
        title: `${pendingTasks.length} validation(s) en attente`,
        content: `${pendingTasks.length} tâche(s) bloquée(s) en attente d'approbation humaine. Pierre ne peut pas agir automatiquement sur ces éléments.`,
        confidence: 1.0,
        related_employee_id: params.employee_id,
        related_mission_id: params.mission_id,
        metadata: {
          pending_approval_count: pendingTasks.length,
          task_ids: pendingTasks.map((t) => t.id).filter(Boolean).slice(0, 10),
        },
      }),
    );
  }

  // ── Sensitive file gates ──────────────────────────────────────────────────

  const sensitiveFiles = params.files.filter(
    (f) => f.risk_level === "sensitive" || f.risk_level === "blocked",
  );

  if (sensitiveFiles.length > 0) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "validation",
        source: "file_record",
        type: "validation_gate",
        priority: "critical",
        risk: "sensitive",
        title: `${sensitiveFiles.length} fichier(s) sensible(s) — validation requise`,
        content: `${sensitiveFiles.length} fichier(s) avec données sensibles (arrêt de travail, identité, contentieux...) nécessitent une validation humaine avant tout traitement.`,
        confidence: 1.0,
        related_employee_id: params.employee_id,
        related_mission_id: params.mission_id,
        metadata: {
          sensitive_file_count: sensitiveFiles.length,
          file_ids: sensitiveFiles.map((f) => f.id).filter(Boolean).slice(0, 10),
        },
      }),
    );
  }

  // ── CloneADN validation requirements ─────────────────────────────────────

  if (profile) {
    const alwaysRequireHuman = profile.validation?.always_require_human_for ?? [];

    const relevantGate =
      params.current_task_type &&
      Array.isArray(alwaysRequireHuman) &&
      alwaysRequireHuman.some((t: unknown) => typeof t === "string" && t === params.current_task_type)
        ? params.current_task_type
        : null;

    if (relevantGate) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "validation",
          source: "clone_adn",
          type: "validation_gate",
          priority: "critical",
          risk: "high",
          title: `Validation humaine obligatoire: ${relevantGate}`,
          content: `Le type de tâche "${relevantGate}" requiert toujours une validation humaine selon les règles CloneADN de l'entreprise.`,
          confidence: 1.0,
          currentTaskType: params.current_task_type,
          metadata: { task_type: relevantGate, always_require_human_for: alwaysRequireHuman },
        }),
      );
    }

    // ── Validation mode ─────────────────────────────────────────────────────

    const validationMode = profile.validation?.default_mode;
    if (validationMode === "human_only") {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "validation",
          source: "clone_adn",
          type: "constraint",
          priority: "high",
          risk: "high",
          title: "Mode validation: humain uniquement",
          content: "L'entreprise a configuré le mode 'human_only'. Toutes les actions Pierre nécessitent une approbation humaine préalable.",
          confidence: 1.0,
          metadata: { validation_mode: validationMode },
        }),
      );
    } else if (validationMode === "required") {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "validation",
          source: "clone_adn",
          type: "rule",
          priority: "medium",
          risk: "medium",
          title: "Mode validation: approbation requise",
          content: "Les actions à risque élevé nécessitent une approbation selon la politique de validation de l'entreprise.",
          confidence: 1.0,
          metadata: { validation_mode: validationMode },
        }),
      );
    }
  }

  return signals;
}
