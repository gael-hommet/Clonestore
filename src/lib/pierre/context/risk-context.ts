// src/lib/pierre/context/risk-context.ts
// B35 — Risk context signals: cross-scope risk aggregation.

import type { PierreContextSignal } from "./types";
import { buildContextSignal } from "./context-signals";
import { deriveOverallRisk, filterRiskSignals } from "./scoring";

export function buildRiskContextSignals(params: {
  company_id: string;
  existing_signals: PierreContextSignal[];
  current_task_type?: string | null;
  current_domain?: string | null;
  employee_id?: string | null;
  mission_id?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];

  const riskSignals = filterRiskSignals(params.existing_signals);
  if (riskSignals.length === 0) return signals;

  const overallRisk = deriveOverallRisk(riskSignals);

  // ── Overall risk summary ──────────────────────────────────────────────────

  if (overallRisk === "blocked" || overallRisk === "sensitive" || overallRisk === "high") {
    const riskLabel =
      overallRisk === "blocked"
        ? "Action bloquée"
        : overallRisk === "sensitive"
          ? "Données sensibles détectées"
          : "Risque élevé";

    signals.push(
      buildContextSignal({
        company_id,
        scope: "risk",
        source: "heuristic",
        type: "risk_flag",
        priority: overallRisk === "blocked" ? "critical" : "high",
        risk: overallRisk,
        title: `Niveau de risque global: ${overallRisk}`,
        content: `${riskLabel}. ${riskSignals.length} signal(s) à risque détectés dans le contexte. Revue humaine fortement recommandée.`,
        confidence: 0.9,
        related_employee_id: params.employee_id,
        related_mission_id: params.mission_id,
        currentTaskType: params.current_task_type,
        metadata: {
          overall_risk: overallRisk,
          risk_signal_count: riskSignals.length,
          risk_scopes: [...new Set(riskSignals.map((s) => s.scope))],
        },
      }),
    );
  }

  // ── Blocked action gate ───────────────────────────────────────────────────

  if (overallRisk === "blocked") {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "risk",
        source: "heuristic",
        type: "constraint",
        priority: "critical",
        risk: "blocked",
        title: "Exécution automatique bloquée",
        content: "Des signaux de blocage ont été détectés. Pierre ne peut pas procéder automatiquement. Une action humaine est requise pour débloquer.",
        confidence: 1.0,
        related_employee_id: params.employee_id,
        related_mission_id: params.mission_id,
        metadata: { blocked: true },
      }),
    );
  }

  // ── Sensitive data warning ────────────────────────────────────────────────

  if (overallRisk === "sensitive") {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "risk",
        source: "heuristic",
        type: "risk_flag",
        priority: "high",
        risk: "sensitive",
        title: "Contexte sensible — validation humaine",
        content: "Le contexte contient des données à caractère sensible (santé, identité, contentieux, etc.). Toute action doit être validée par un humain avant exécution.",
        confidence: 1.0,
        related_employee_id: params.employee_id,
        related_mission_id: params.mission_id,
        metadata: { sensitive: true },
      }),
    );
  }

  return signals;
}
