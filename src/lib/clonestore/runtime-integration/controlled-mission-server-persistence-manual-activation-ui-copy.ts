// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-manual-activation-ui-copy.ts
// PHASE 5.5 — Controlled Mission Server Persistence Manual Activation QA — UI Copy / Badges (pur)
//
// Microcopy stricte : « QA manuelle uniquement · aucune activation · ne pas appliquer
// le SQL · aucune donnée envoyée ». Jamais « SQL appliqué », « flag activé »,
// « route créée », « persisté », « exécuté », « envoyé », « lancé ».

import type {
  ControlledMissionServerPersistenceManualActivationVerdict,
  ControlledMissionServerPersistenceManualActivationCategory,
} from "./controlled-mission-server-persistence-manual-activation-types";

// ── Actions (lecture seule) ───────────────────────────────────────────────────

export const CONTROLLED_MISSION_SERVER_MANUAL_QA_VIEW_CHECKLIST_LABEL = "Voir checklist QA";
export const CONTROLLED_MISSION_SERVER_MANUAL_QA_VIEW_RUNBOOK_LABEL = "Voir runbook manuel";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY = "QA manuelle uniquement · Aucune activation";
export const CONTROLLED_MISSION_SERVER_MANUAL_QA_WHAT_IT_DOES =
  "Cette phase vérifie la préparation, elle n'active pas la persistance serveur.";
export const CONTROLLED_MISSION_SERVER_MANUAL_QA_DO_NOT_APPLY =
  "Ne pas appliquer le SQL dans cette phase.";
export const CONTROLLED_MISSION_SERVER_MANUAL_QA_NO_DATA =
  "Aucune donnée n'est envoyée au serveur.";
export const CONTROLLED_MISSION_SERVER_MANUAL_QA_PANEL_GUARDRAIL =
  "Activation serveur — QA manuelle uniquement. Cette phase vérifie la préparation, elle n'active pas la persistance serveur.";

// Faits affichés dans le panneau d'activation manuelle.
export const CONTROLLED_MISSION_SERVER_MANUAL_QA_FACTS = [
  "Persistance serveur toujours inactive",
  "SQL non appliqué",
  "Flag serveur désactivé",
  "Aucune route active",
  "Aucune donnée envoyée",
  "Aucune exécution",
] as const;

// ── Labels ────────────────────────────────────────────────────────────────────

const VERDICT_LABELS: Record<ControlledMissionServerPersistenceManualActivationVerdict, string> = {
  ready: "Prêt pour revue manuelle",
  passed: "Préparation manuelle validée",
  blocked: "Bloqué",
  needs_review: "Revue requise",
  pending: "En attente",
};

const CATEGORY_LABELS: Record<ControlledMissionServerPersistenceManualActivationCategory, string> = {
  design_p54: "Design P5.4",
  sql_manual_review: "Revue SQL manuelle",
  feature_flag: "Feature flag",
  routes: "Routes",
  no_execution_invariants: "Invariants no-execution",
  manual_evidence: "Evidence manuelle",
};

export function getControlledMissionServerManualQaVerdictLabel(
  verdict: ControlledMissionServerPersistenceManualActivationVerdict
): string {
  return VERDICT_LABELS[verdict] ?? "Statut inconnu";
}

export function getControlledMissionServerManualQaCategoryLabel(
  category: ControlledMissionServerPersistenceManualActivationCategory
): string {
  return CATEGORY_LABELS[category] ?? "Catégorie inconnue";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionServerManualQaBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionServerManualQaBadge = {
  id: string;
  label: string;
  tone: ControlledMissionServerManualQaBadgeTone;
};

export function buildControlledMissionServerManualQaBadges(): ControlledMissionServerManualQaBadge[] {
  return [
    { id: "mq-manual", label: "QA manuelle", tone: "info" },
    { id: "mq-server-inactive", label: "Serveur inactif", tone: "neutral" },
    { id: "mq-sql-not-applied", label: "SQL non appliqué", tone: "neutral" },
    { id: "mq-flag-off", label: "Flag désactivé", tone: "neutral" },
    { id: "mq-no-execution", label: "Aucune exécution", tone: "neutral" },
  ];
}
