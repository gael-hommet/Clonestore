// src/lib/pierre/context/history-context.ts
// B35 — History/audit context signals from recent logs and missions.

import type { PierreContextSignal } from "./types";
import { buildContextSignal } from "./context-signals";

function safeStr(v: unknown, maxLen = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, maxLen) : null;
}

function formatRelativeTime(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "aujourd'hui";
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} semaine(s)`;
  return `il y a ${Math.floor(diffDays / 30)} mois`;
}

export function buildHistoryContextSignals(params: {
  company_id: string;
  recent_logs: Record<string, unknown>[];
  recent_missions: Record<string, unknown>[];
  employee_id?: string | null;
  mission_id?: string | null;
  current_task_type?: string | null;
  current_domain?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];
  const logs = params.recent_logs ?? [];
  const missions = params.recent_missions ?? [];

  if (logs.length === 0 && missions.length === 0) return signals;

  // ── Recent audit activity ─────────────────────────────────────────────────

  if (logs.length > 0) {
    const recentLog = logs[0];
    const lastAt = safeStr(recentLog.created_at);
    const relativeTime = formatRelativeTime(lastAt);
    const logTypes: Record<string, number> = {};
    for (const log of logs) {
      const action = safeStr(log.action) ?? safeStr(log.event_type) ?? "other";
      logTypes[action] = (logTypes[action] ?? 0) + 1;
    }

    signals.push(
      buildContextSignal({
        company_id,
        scope: "history",
        source: "audit_log",
        type: "history_event",
        priority: "low",
        risk: "none",
        title: `Historique d'activité (${logs.length} événement(s))`,
        content: [
          `${logs.length} événement(s) récent(s) dans les logs`,
          relativeTime ? `Dernière activité: ${relativeTime}` : null,
          Object.keys(logTypes).length > 0
            ? `Actions: ${Object.entries(logTypes).map(([k, v]) => `${k}(${v})`).join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.85,
        updated_at: lastAt ?? undefined,
        related_employee_id: params.employee_id,
        related_mission_id: params.mission_id,
        currentTaskType: params.current_task_type,
        metadata: {
          log_count: logs.length,
          log_types: logTypes,
          last_event_at: lastAt,
        },
      }),
    );

    // ── Recent sensitive events ─────────────────────────────────────────────

    const sensitiveKeywords = /licenci|harcèl|disciplin|faute.grave|prud.homm|discrimin|contentieux|conflit|sanction/i;
    const sensitiveLogs = logs.filter((log) => {
      const msg = safeStr(log.message) ?? safeStr(log.content) ?? "";
      return sensitiveKeywords.test(msg);
    });

    if (sensitiveLogs.length > 0) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "history",
          source: "audit_log",
          type: "risk_flag",
          priority: "high",
          risk: "sensitive",
          title: `${sensitiveLogs.length} événement(s) sensible(s) dans l'historique`,
          content: `Des événements RH sensibles ont été détectés dans l'historique récent (licenciement, harcèlement, discipline, contentieux...). Vérifier avant toute action automatique.`,
          confidence: 0.8,
          related_employee_id: params.employee_id,
          related_mission_id: params.mission_id,
          metadata: { sensitive_event_count: sensitiveLogs.length },
        }),
      );
    }
  }

  // ── Mission history ───────────────────────────────────────────────────────

  if (missions.length > 0) {
    const completed = missions.filter(
      (m) => m.status === "completed" || m.status === "done" || m.status === "closed",
    ).length;
    const recent = missions[0];
    const recentAt = safeStr(recent?.created_at);
    const relativeTime = formatRelativeTime(recentAt);

    signals.push(
      buildContextSignal({
        company_id,
        scope: "history",
        source: "mission_record",
        type: "history_event",
        priority: "low",
        risk: "none",
        title: `Historique missions (${missions.length})`,
        content: [
          `${missions.length} mission(s) dans l'historique`,
          `${completed} terminée(s)`,
          relativeTime ? `Dernière mission: ${relativeTime}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.85,
        updated_at: recentAt ?? undefined,
        related_employee_id: params.employee_id,
        currentTaskType: params.current_task_type,
        metadata: {
          total_missions: missions.length,
          completed_missions: completed,
          last_mission_at: recentAt,
        },
      }),
    );
  }

  return signals;
}
