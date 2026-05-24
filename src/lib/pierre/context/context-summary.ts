// src/lib/pierre/context/context-summary.ts
// B35 — Deterministic context summary builder. No AI required.

import type { PierreContextPack, PierreContextSignal } from "./types";
import { rankContextSignals, filterSignalsByScope, deriveOverallRisk } from "./scoring";

function topSignalContent(signals: PierreContextSignal[], limit = 3): string[] {
  return rankContextSignals(signals, limit).map((s) => s.content);
}

export function buildRiskSummary(signals: PierreContextSignal[]): string {
  const overallRisk = deriveOverallRisk(signals);
  const riskSignals = signals.filter(
    (s) => s.risk === "blocked" || s.risk === "sensitive" || s.risk === "high",
  );

  if (overallRisk === "none" || riskSignals.length === 0) {
    return "Aucun signal de risque élevé détecté dans le contexte actuel.";
  }

  const parts: string[] = [`Niveau de risque global: ${overallRisk}.`];
  const blocked = riskSignals.filter((s) => s.risk === "blocked");
  const sensitive = riskSignals.filter((s) => s.risk === "sensitive");
  const high = riskSignals.filter((s) => s.risk === "high");

  if (blocked.length > 0) parts.push(`${blocked.length} signal(s) bloquant(s).`);
  if (sensitive.length > 0) parts.push(`${sensitive.length} signal(s) sensible(s).`);
  if (high.length > 0) parts.push(`${high.length} signal(s) à risque élevé.`);

  return parts.join(" ");
}

export function buildValidationSummary(signals: PierreContextSignal[]): string {
  const validationGates = signals.filter((s) => s.type === "validation_gate");
  const constraints = signals.filter((s) => s.type === "constraint");

  if (validationGates.length === 0 && constraints.length === 0) {
    return "Aucune validation humaine requise dans le contexte actuel.";
  }

  const parts: string[] = [];
  if (validationGates.length > 0) {
    parts.push(`${validationGates.length} gate(s) de validation active(s).`);
  }
  if (constraints.length > 0) {
    parts.push(`${constraints.length} contrainte(s) détectée(s).`);
  }
  return parts.join(" ");
}

export function buildEmployeeSummary(signals: PierreContextSignal[]): string | null {
  const employeeSignals = filterSignalsByScope(signals, "employee");
  if (employeeSignals.length === 0) return null;

  const identitySignal = employeeSignals.find((s) => s.type === "identity");
  if (!identitySignal) return null;

  const riskSignals = employeeSignals.filter(
    (s) => s.risk === "high" || s.risk === "sensitive" || s.risk === "blocked",
  );

  const parts = [identitySignal.content];
  if (riskSignals.length > 0) {
    parts.push(`⚠ ${riskSignals.length} signal(s) à risque sur ce salarié.`);
  }
  return parts.join(" ");
}

export function buildMissionSummary(signals: PierreContextSignal[]): string | null {
  const missionSignals = filterSignalsByScope(signals, "mission");
  if (missionSignals.length === 0) return null;

  const top = rankContextSignals(missionSignals, 2);
  return top.map((s) => s.content).join(" | ");
}

export function buildFileSummary(signals: PierreContextSignal[]): string | null {
  const fileSignals = filterSignalsByScope(signals, "file");
  if (fileSignals.length === 0) return null;

  const top = rankContextSignals(fileSignals, 2);
  return top.map((s) => s.content).join(" | ");
}

export function buildChannelSummary(signals: PierreContextSignal[]): string | null {
  const channelSignals = filterSignalsByScope(signals, "channel");
  if (channelSignals.length === 0) return null;

  const top = rankContextSignals(channelSignals, 1);
  return top[0]?.content ?? null;
}

export function buildMissingInfo(signals: PierreContextSignal[]): string[] {
  return signals
    .filter((s) => s.type === "missing_info")
    .map((s) => s.title);
}

export function buildRecommendedNextAction(
  signals: PierreContextSignal[],
  packMeta: {
    employee_id: string | null;
    mission_id: string | null;
    task_id: string | null;
  },
): string | null {
  // Priority: blocked > validation gates > sensitive > pending approvals > missing info

  if (signals.some((s) => s.risk === "blocked")) {
    return "Une ou plusieurs actions sont bloquées. Contactez un administrateur pour débloquer la situation.";
  }

  const validationGates = signals.filter((s) => s.type === "validation_gate");
  if (validationGates.length > 0) {
    return `Valider ${validationGates.length} élément(s) nécessitant une approbation humaine avant de poursuivre.`;
  }

  if (signals.some((s) => s.risk === "sensitive")) {
    return "Des données sensibles ont été détectées. Vérifier avec l'équipe RH avant toute action.";
  }

  const taskSignals = filterSignalsByScope(signals, "task");
  const pendingApproval = taskSignals.find(
    (s) => s.type === "risk_flag" && s.metadata?.pending_approval_count,
  );
  if (pendingApproval) {
    return "Approuver les tâches en attente pour débloquer le flux de travail.";
  }

  const missingInfoSignals = signals.filter((s) => s.type === "missing_info");
  if (missingInfoSignals.length > 0) {
    const first = missingInfoSignals[0];
    return `Compléter les informations manquantes: ${first.title}`;
  }

  if (!packMeta.employee_id && !packMeta.mission_id) {
    return "Préciser le salarié ou la mission concerné(e) pour une assistance plus ciblée.";
  }

  return "Contexte complet. Pierre est prêt à agir.";
}

export function summarizeContextPack(pack: PierreContextPack): {
  risk_summary: string;
  validation_summary: string;
  employee_summary: string | null;
  mission_summary: string | null;
  file_summary: string | null;
  channel_summary: string | null;
  missing_info: string[];
  recommended_next_action: string | null;
  should_require_validation: boolean;
  top_rules: PierreContextSignal[];
  top_preferences: PierreContextSignal[];
  top_warnings: PierreContextSignal[];
} {
  const signals = pack.signals;

  const riskSummary = buildRiskSummary(signals);
  const validationSummary = buildValidationSummary(signals);
  const employeeSummary = buildEmployeeSummary(signals);
  const missionSummary = buildMissionSummary(signals);
  const fileSummary = buildFileSummary(signals);
  const channelSummary = buildChannelSummary(signals);
  const missingInfo = buildMissingInfo(signals);

  const ruleSignals = filterSignalsByScope(signals, "rules");
  const topRules = rankContextSignals(ruleSignals, 5);

  const preferenceSignals = filterSignalsByScope(signals, "preference");
  const adnSignals = filterSignalsByScope(signals, "adn");
  const topPreferences = rankContextSignals([...preferenceSignals, ...adnSignals], 5);

  const topWarnings = rankContextSignals(
    signals.filter(
      (s) => s.risk === "sensitive" || s.risk === "high" || s.risk === "blocked",
    ),
    5,
  );

  const shouldRequireValidation =
    signals.some((s) => s.type === "validation_gate") ||
    signals.some((s) => s.risk === "sensitive" || s.risk === "blocked");

  const recommendedNextAction = buildRecommendedNextAction(signals, {
    employee_id: pack.employee_id,
    mission_id: pack.mission_id,
    task_id: pack.task_id,
  });

  // Build top content for summary output
  topSignalContent(signals, 3); // side-effect-free, used internally

  return {
    risk_summary: riskSummary,
    validation_summary: validationSummary,
    employee_summary: employeeSummary,
    mission_summary: missionSummary,
    file_summary: fileSummary,
    channel_summary: channelSummary,
    missing_info: missingInfo,
    recommended_next_action: recommendedNextAction,
    should_require_validation: shouldRequireValidation,
    top_rules: topRules,
    top_preferences: topPreferences,
    top_warnings: topWarnings,
  };
}
