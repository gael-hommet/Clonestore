// src/lib/client-cockpit/overview.ts
// P9.3 — Construction de la Vue d'ensemble opérationnelle depuis les modèles
// canoniques déjà mappés. Pure et déterministe. Répond en un coup d'œil à
// « que fait Pierre, et que dois-je faire maintenant ? ». Aucune métrique fictive.

import { compareUrgency } from "./status";
import type {
  CockpitArtifact,
  CockpitAttentionItem,
  CockpitHealthState,
  CockpitIndicators,
  CockpitMissionSummary,
  CockpitOverview,
  CockpitTask,
  CockpitValidation,
} from "./types";

export interface OverviewInput {
  readonly missions: readonly CockpitMissionSummary[];
  readonly tasks: readonly CockpitTask[];
  readonly validations: readonly CockpitValidation[];
  readonly artifacts: readonly CockpitArtifact[];
  readonly employeeCount?: number;
  readonly recentLimit?: number;
}

function byUrgencyThenDate<T extends { urgency: CockpitMissionSummary["urgency"]; ageIso?: string | null; createdAt?: string | null }>(
  a: T,
  b: T,
): number {
  const u = compareUrgency(a.urgency, b.urgency);
  if (u !== 0) return u;
  const da = a.ageIso ?? a.createdAt ?? "";
  const db = b.ageIso ?? b.createdAt ?? "";
  return db.localeCompare(da); // plus récent d'abord à urgence égale
}

/** Éléments « À traiter maintenant » : actions humaines réellement attendues. */
export function buildAttention(input: OverviewInput): CockpitAttentionItem[] {
  const items: CockpitAttentionItem[] = [];

  // 1) Validations en attente.
  for (const v of input.validations) {
    if (v.status !== "pending") continue;
    items.push({
      id: `val:${v.id}`,
      kind: "validation",
      title: v.intent,
      context: v.isSensitive ? "Action sensible — validation humaine obligatoire." : v.reason,
      urgency: v.urgency,
      ageIso: v.createdAt,
      employee: v.employee,
      missionId: v.missionId,
      action: v.actions.find((a) => a.kind === "approve") ?? { label: "Examiner", kind: "open", allowed: true },
    });
  }

  // 2) Missions en attente d'informations.
  for (const m of input.missions) {
    if (m.status !== "understanding") continue;
    items.push({
      id: `info:${m.id}`,
      kind: "missing_info",
      title: `Informations requises — ${m.title}`,
      context: "Pierre a besoin de précisions pour avancer.",
      urgency: m.urgency,
      ageIso: m.createdAt,
      employee: m.employee,
      missionId: m.id,
      action: { label: "Compléter", kind: "open", allowed: true },
    });
  }

  // 3) Missions bloquées.
  for (const m of input.missions) {
    if (m.status !== "blocked") continue;
    items.push({
      id: `block:${m.id}`,
      kind: "blocked_mission",
      title: `Mission bloquée — ${m.title}`,
      context: m.blockedReason,
      urgency: "critical",
      ageIso: m.createdAt,
      employee: m.employee,
      missionId: m.id,
      action: { label: "Résoudre", kind: "open", allowed: true },
    });
  }

  // 4) Incidents : tâches échouées.
  for (const t of input.tasks) {
    if (t.status !== "failed") continue;
    items.push({
      id: `incident:${t.id}`,
      kind: "incident",
      title: `Incident — ${t.title}`,
      context: t.blockedReason ?? "Une action de Pierre a échoué et attend votre décision.",
      urgency: "high",
      ageIso: null,
      employee: null,
      missionId: t.missionId,
      action: { label: "Examiner l'incident", kind: "open", allowed: true },
    });
  }

  // 5) Documents à relire.
  for (const d of input.artifacts) {
    if (d.status !== "needs_review" && d.status !== "awaiting_validation") continue;
    items.push({
      id: `doc:${d.id}`,
      kind: "document_review",
      title: `Document à relire — ${d.title}`,
      context: d.family,
      urgency: "high",
      ageIso: d.createdAt,
      employee: d.employee,
      missionId: d.missionId,
      action: { label: "Relire le document", kind: "preview", allowed: true },
    });
  }

  return items.sort(byUrgencyThenDate);
}

export function buildIndicators(input: OverviewInput): CockpitIndicators {
  const missionsInProgress = input.missions.filter(
    (m) => m.status === "in_progress" || m.status === "awaiting_approval" || m.status === "understanding",
  ).length;
  const validationsPending = input.validations.filter((v) => v.status === "pending").length;
  const documentsProduced = input.artifacts.length;
  const incidentsOpen =
    input.tasks.filter((t) => t.status === "failed").length +
    input.missions.filter((m) => m.status === "blocked").length;
  const employeeCount =
    input.employeeCount ??
    new Set(
      [
        ...input.missions.map((m) => m.employee?.id),
        ...input.validations.map((v) => v.employee?.id),
        ...input.artifacts.map((d) => d.employee?.id),
      ].filter((x): x is string => !!x),
    ).size;
  return {
    missionsInProgress,
    validationsPending,
    documentsProduced,
    employeesConcerned: employeeCount,
    incidentsOpen,
  };
}

export function buildHealth(attention: readonly CockpitAttentionItem[], indicators: CockpitIndicators): CockpitHealthState {
  const critical = attention.filter((a) => a.urgency === "critical").length;
  if (critical > 0) {
    return {
      tone: "danger",
      label: "Attention requise",
      summary: `${critical} élément${critical > 1 ? "s" : ""} critique${critical > 1 ? "s" : ""} à traiter.`,
      attentionCount: attention.length,
    };
  }
  if (attention.length > 0) {
    return {
      tone: "warning",
      label: "Décisions en attente",
      summary: `${attention.length} élément${attention.length > 1 ? "s" : ""} attend${attention.length > 1 ? "ent" : ""} votre décision.`,
      attentionCount: attention.length,
    };
  }
  if (indicators.missionsInProgress > 0) {
    return {
      tone: "progress",
      label: "Pierre travaille",
      summary: `${indicators.missionsInProgress} mission${indicators.missionsInProgress > 1 ? "s" : ""} en cours, rien n'attend votre décision.`,
      attentionCount: 0,
    };
  }
  return { tone: "success", label: "À jour", summary: "Rien n'attend votre décision.", attentionCount: 0 };
}

export function buildOverview(input: OverviewInput): CockpitOverview {
  const attention = buildAttention(input);
  const indicators = buildIndicators(input);
  const health = buildHealth(attention, indicators);
  const inProgress = input.missions
    .filter((m) => m.status === "in_progress" || m.status === "awaiting_approval" || m.status === "understanding" || m.status === "blocked")
    .slice()
    .sort((a, b) => compareUrgency(a.urgency, b.urgency));
  const recentlyDone = input.missions
    .filter((m) => m.status === "done")
    .slice()
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, input.recentLimit ?? 5);
  return {
    health,
    attention,
    inProgress,
    recentlyDone,
    indicators,
    isEmpty: input.missions.length === 0,
  };
}
