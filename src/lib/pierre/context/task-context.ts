// src/lib/pierre/context/task-context.ts
// B35 — Task context signals.

import type { PierreContextSignal } from "./types";
import { buildContextSignal } from "./context-signals";

function safeStr(v: unknown, maxLen = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, maxLen) : null;
}

export function buildTaskContextSignals(params: {
  company_id: string;
  task_id: string | null | undefined;
  tasks: Record<string, unknown>[];
  mission_id?: string | null;
  employee_id?: string | null;
  current_task_type?: string | null;
  current_domain?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];
  const tasks = params.tasks ?? [];

  if (tasks.length === 0 && !params.task_id) return signals;

  // Find the specific task if task_id provided
  const specificTask = params.task_id
    ? tasks.find((t) => safeStr(t.id) === params.task_id) ?? null
    : null;

  // ── Specific task signal ──────────────────────────────────────────────────

  if (specificTask) {
    const taskId = safeStr(specificTask.id) ?? params.task_id ?? "unknown";
    const status = safeStr(specificTask.status) ?? "unknown";
    const title = safeStr(specificTask.title) ?? safeStr(specificTask.task_type);
    const approvalRequired = specificTask.approval_required === true;
    const isSensitive = status === "blocked" || status === "failed";
    const isPendingApproval = status === "awaiting_approval" || approvalRequired;

    signals.push(
      buildContextSignal({
        company_id,
        scope: "task",
        source: "task_record",
        type: isSensitive
          ? "risk_flag"
          : isPendingApproval
            ? "validation_gate"
            : "status",
        priority: isSensitive ? "high" : isPendingApproval ? "critical" : "medium",
        risk: isSensitive ? "high" : isPendingApproval ? "high" : "none",
        title: `Tâche: ${title ?? status}`,
        content: [
          title ? `Tâche: ${title}` : null,
          `Statut: ${status}`,
          approvalRequired ? "Approbation humaine requise" : null,
          safeStr(specificTask.execute_at) ? `Planifiée: ${specificTask.execute_at}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.95,
        related_task_id: taskId,
        related_mission_id: params.mission_id,
        related_employee_id: params.employee_id,
        currentTaskType: params.current_task_type,
        metadata: {
          status,
          approval_required: approvalRequired,
          task_type: safeStr(specificTask.task_type),
        },
      }),
    );
  }

  // ── Aggregate task overview (for missions/employees) ──────────────────────

  if (tasks.length > 1 || (tasks.length === 1 && !specificTask)) {
    const pendingApproval = tasks.filter(
      (t) => t.approval_required === true && t.status === "awaiting_approval",
    ).length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const scheduled = tasks.filter((t) => t.status === "scheduled").length;
    const done = tasks.filter(
      (t) => t.status === "done" || t.status === "completed",
    ).length;

    const hasCritical = pendingApproval > 0 || blocked > 0;

    signals.push(
      buildContextSignal({
        company_id,
        scope: "task",
        source: "task_record",
        type: hasCritical ? "risk_flag" : "status",
        priority: hasCritical ? "high" : "low",
        risk: hasCritical ? "high" : "none",
        title: `Vue d'ensemble des tâches (${tasks.length})`,
        content: [
          `${tasks.length} tâche(s) au total`,
          `${done} terminée(s)`,
          scheduled > 0 ? `${scheduled} planifiée(s)` : null,
          pendingApproval > 0 ? `⚠ ${pendingApproval} en attente d'approbation` : null,
          blocked > 0 ? `⚠ ${blocked} bloquée(s)` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.9,
        related_mission_id: params.mission_id,
        related_employee_id: params.employee_id,
        metadata: {
          total: tasks.length,
          done,
          pending_approval: pendingApproval,
          blocked,
          scheduled,
        },
      }),
    );

    // ── Critical: tasks awaiting approval need immediate attention ────────

    if (pendingApproval > 0) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "validation",
          source: "task_record",
          type: "validation_gate",
          priority: "critical",
          risk: "high",
          title: `${pendingApproval} tâche(s) en attente d'approbation`,
          content: `${pendingApproval} tâche(s) requièrent une approbation humaine immédiate. Aucune action automatique possible sur ces éléments.`,
          confidence: 1.0,
          related_mission_id: params.mission_id,
          related_employee_id: params.employee_id,
          metadata: { pending_approval_count: pendingApproval },
        }),
      );
    }
  }

  return signals;
}
