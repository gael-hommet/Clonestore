// src/lib/pierre/context/mission-context.ts
// B35 — Mission context signals.

import type { PierreContextSignal } from "./types";
import { buildContextSignal } from "./context-signals";

function safeStr(v: unknown, maxLen = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, maxLen) : null;
}

const SENSITIVE_MISSION_STATUSES = new Set(["blocked", "failed", "cancelled"]);
const ACTIVE_MISSION_STATUSES = new Set(["open", "in_progress", "pending_approval"]);

export function buildMissionContextSignals(params: {
  company_id: string;
  mission_id: string | null | undefined;
  mission: Record<string, unknown> | null | undefined;
  tasks?: Record<string, unknown>[];
  employee_id?: string | null;
  current_task_type?: string | null;
  current_domain?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];
  const mission = params.mission;

  if (!mission) {
    if (params.mission_id) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "mission",
          source: "default",
          type: "missing_info",
          priority: "medium",
          risk: "none",
          title: "Mission introuvable",
          content: `Aucune mission trouvée pour l'identifiant ${params.mission_id}.`,
          confidence: 1.0,
          related_mission_id: params.mission_id,
          related_employee_id: params.employee_id,
        }),
      );
    }
    return signals;
  }

  const missionId = safeStr(mission.id) ?? params.mission_id ?? "unknown";
  const status = safeStr(mission.status) ?? "unknown";
  const summary = safeStr(mission.mission_summary) ?? safeStr(mission.raw_input);
  const classification = safeStr(mission.classification);

  const isSensitive = SENSITIVE_MISSION_STATUSES.has(status);
  const isActive = ACTIVE_MISSION_STATUSES.has(status);

  // ── Mission status signal ─────────────────────────────────────────────────

  signals.push(
    buildContextSignal({
      company_id,
      scope: "mission",
      source: "mission_record",
      type: isSensitive ? "risk_flag" : "status",
      priority: isSensitive ? "high" : isActive ? "medium" : "low",
      risk: isSensitive ? "high" : "none",
      title: `Mission — ${status}`,
      content: [
        summary ? `Résumé: ${summary}` : null,
        `Statut: ${status}`,
        classification ? `Type: ${classification}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
      confidence: 0.9,
      related_mission_id: missionId,
      related_employee_id: params.employee_id,
      currentTaskType: params.current_task_type,
      currentDomain: params.current_domain,
      metadata: { status, classification },
    }),
  );

  // ── Pending approval gate ─────────────────────────────────────────────────

  if (status === "pending_approval" || mission.approval_required === true) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "validation",
        source: "mission_record",
        type: "validation_gate",
        priority: "critical",
        risk: "high",
        title: "Mission en attente d'approbation humaine",
        content: summary
          ? `La mission "${summary}" nécessite une approbation humaine avant toute action.`
          : "Cette mission nécessite une approbation humaine avant toute action.",
        confidence: 1.0,
        related_mission_id: missionId,
        related_employee_id: params.employee_id,
        metadata: { approval_required: true },
      }),
    );
  }

  // ── Task summary ──────────────────────────────────────────────────────────

  const tasks = params.tasks ?? [];
  if (tasks.length > 0) {
    const done = tasks.filter((t) => t.status === "done" || t.status === "completed").length;
    const pending = tasks.filter((t) => t.status === "awaiting_approval").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const hasCritical = pending > 0 || blocked > 0;

    signals.push(
      buildContextSignal({
        company_id,
        scope: "task",
        source: "task_record",
        type: hasCritical ? "risk_flag" : "status",
        priority: hasCritical ? "high" : "low",
        risk: hasCritical ? "high" : "none",
        title: `Tâches de la mission (${tasks.length} total)`,
        content: [
          `${tasks.length} tâche(s) au total`,
          `${done} terminée(s)`,
          pending > 0 ? `⚠ ${pending} en attente d'approbation` : null,
          blocked > 0 ? `⚠ ${blocked} bloquée(s)` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.95,
        related_mission_id: missionId,
        related_employee_id: params.employee_id,
        metadata: {
          total: tasks.length,
          done,
          pending_approval: pending,
          blocked,
        },
      }),
    );
  }

  // ── Mission context fields ────────────────────────────────────────────────

  const missingFields: string[] = [];
  if (!summary) missingFields.push("résumé de mission");
  if (!classification) missingFields.push("classification");

  if (missingFields.length > 0) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "mission",
        source: "mission_record",
        type: "missing_info",
        priority: "low",
        risk: "none",
        title: "Données de mission incomplètes",
        content: `Informations manquantes sur la mission: ${missingFields.join(", ")}.`,
        confidence: 1.0,
        related_mission_id: missionId,
        metadata: { missing_fields: missingFields },
      }),
    );
  }

  return signals;
}
