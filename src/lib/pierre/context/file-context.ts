// src/lib/pierre/context/file-context.ts
// B35 — File context signals from B34 CloneFileRecord data.

import type { PierreContextSignal } from "./types";
import type { PierreContextRisk } from "./types";
import { buildContextSignal } from "./context-signals";

function safeStr(v: unknown, maxLen = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, maxLen) : null;
}

function fileRiskToContextRisk(riskLevel: string | null): PierreContextRisk {
  switch (riskLevel) {
    case "blocked": return "blocked";
    case "sensitive": return "sensitive";
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    default: return "none";
  }
}

export function buildFileContextSignals(params: {
  company_id: string;
  file_id: string | null | undefined;
  files: Record<string, unknown>[];
  mission_id?: string | null;
  employee_id?: string | null;
  current_task_type?: string | null;
  current_domain?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];
  const files = params.files ?? [];

  if (files.length === 0 && !params.file_id) return signals;

  // Find specific file
  const specificFile = params.file_id
    ? files.find((f) => safeStr(f.id) === params.file_id) ?? null
    : null;

  // ── Specific file signal ──────────────────────────────────────────────────

  if (specificFile) {
    const fileId = safeStr(specificFile.id) ?? params.file_id ?? "unknown";
    const filename = safeStr(specificFile.safe_filename) ?? safeStr(specificFile.original_filename) ?? "fichier";
    const riskLevel = safeStr(specificFile.risk_level);
    const category = safeStr(specificFile.category);
    const status = safeStr(specificFile.status);
    const contextRisk = fileRiskToContextRisk(riskLevel);

    const isSensitive = contextRisk === "sensitive" || contextRisk === "blocked";

    signals.push(
      buildContextSignal({
        company_id,
        scope: "file",
        source: "file_record",
        type: isSensitive ? "risk_flag" : "status",
        priority: contextRisk === "blocked" ? "critical" : isSensitive ? "high" : "medium",
        risk: contextRisk,
        title: `Fichier: ${filename}`,
        content: [
          `Fichier: ${filename}`,
          category ? `Catégorie RH: ${category}` : null,
          riskLevel ? `Niveau de risque: ${riskLevel}` : null,
          status ? `Statut: ${status}` : null,
          isSensitive ? "⚠ Ce fichier contient des données sensibles — validation humaine requise." : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.95,
        related_file_id: fileId,
        related_mission_id: params.mission_id,
        related_employee_id: params.employee_id,
        currentTaskType: params.current_task_type,
        metadata: { risk_level: riskLevel, category, status },
      }),
    );

    // ── Sensitive file gate ─────────────────────────────────────────────────

    if (isSensitive) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "validation",
          source: "file_record",
          type: "validation_gate",
          priority: "critical",
          risk: contextRisk,
          title: `Fichier sensible — validation requise: ${filename}`,
          content: `Le fichier "${filename}" (catégorie: ${category ?? "inconnue"}, risque: ${riskLevel ?? "inconnu"}) nécessite une validation humaine. Aucune action automatique autorisée.`,
          confidence: 1.0,
          related_file_id: fileId,
          related_mission_id: params.mission_id,
          related_employee_id: params.employee_id,
          metadata: { requires_human_validation: true, risk_level: riskLevel, category },
        }),
      );
    }
  }

  // ── File overview (all files in context) ──────────────────────────────────

  if (files.length > 0) {
    const sensitiveCount = files.filter(
      (f) => f.risk_level === "sensitive" || f.risk_level === "blocked",
    ).length;
    const highRiskCount = files.filter((f) => f.risk_level === "high").length;
    const byCategory: Record<string, number> = {};
    for (const f of files) {
      const cat = safeStr(f.category) ?? "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }

    const hasCritical = sensitiveCount > 0;

    signals.push(
      buildContextSignal({
        company_id,
        scope: "file",
        source: "file_record",
        type: hasCritical ? "risk_flag" : "status",
        priority: hasCritical ? "high" : "low",
        risk: hasCritical ? "sensitive" : highRiskCount > 0 ? "high" : "none",
        title: `Fichiers RH (${files.length})`,
        content: [
          `${files.length} fichier(s) dans le contexte`,
          sensitiveCount > 0 ? `⚠ ${sensitiveCount} fichier(s) sensible(s)` : null,
          highRiskCount > 0 ? `${highRiskCount} fichier(s) à risque élevé` : null,
          Object.keys(byCategory).length > 0
            ? `Catégories: ${Object.entries(byCategory).map(([k, v]) => `${k}(${v})`).join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.9,
        related_mission_id: params.mission_id,
        related_employee_id: params.employee_id,
        metadata: { total: files.length, sensitive_count: sensitiveCount, by_category: byCategory },
      }),
    );
  }

  return signals;
}
