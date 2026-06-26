// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-final-gate-ui-copy.ts
// PHASE 5.7 — Controlled Mission Server Persistence Final Gate — UI Copy / Badges (pur)
//
// Microcopy stricte : « Final Gate design-only · aucune activation · la persistance
// serveur reste inactive · aucune route serveur · aucune exécution ». Jamais
// « production ready », « execution ready », « activé », « persisté », « lancé ».

import type {
  ControlledMissionServerPersistenceFinalGateVerdict,
  ControlledMissionServerPersistenceFinalGateReadinessLevel,
} from "./controlled-mission-server-persistence-final-gate-types";

// ── Actions (lecture seule) ───────────────────────────────────────────────────

export const CONTROLLED_MISSION_FINAL_GATE_VIEW_REPORT_LABEL = "Voir final gate";
export const CONTROLLED_MISSION_FINAL_GATE_VIEW_INVARIANTS_LABEL = "Voir invariants";
export const CONTROLLED_MISSION_FINAL_GATE_VIEW_NEXT_STEPS_LABEL = "Voir prochaines étapes";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_FINAL_GATE_MICROCOPY = "Final Gate design-only · Aucune activation";
export const CONTROLLED_MISSION_FINAL_GATE_WHAT_IT_DOES =
  "Cette fermeture valide la préparation, pas la production.";
export const CONTROLLED_MISSION_FINAL_GATE_SERVER_INACTIVE =
  "La persistance serveur reste inactive.";
export const CONTROLLED_MISSION_FINAL_GATE_NO_ROUTE =
  "Aucune route serveur n'est créée.";
export const CONTROLLED_MISSION_FINAL_GATE_NO_EXECUTION =
  "Aucune exécution n'est possible dans cette phase.";
export const CONTROLLED_MISSION_FINAL_GATE_PANEL_GUARDRAIL =
  "Final Gate design-only · Aucune activation. Cette fermeture valide la préparation, pas la production. La persistance serveur reste inactive. Aucune route serveur n'est créée. Aucune exécution n'est possible dans cette phase.";

// ── Labels ────────────────────────────────────────────────────────────────────

const VERDICT_LABELS: Record<ControlledMissionServerPersistenceFinalGateVerdict, string> = {
  go_for_next_design_phase: "GO — phase de design suivante",
  blocked: "Bloqué",
  needs_review: "Revue requise",
};

const LEVEL_LABELS: Record<ControlledMissionServerPersistenceFinalGateReadinessLevel, string> = {
  incomplete: "Incomplet",
  design_ready: "Design prêt",
  manually_review_ready: "Prêt pour revue manuelle",
  next_phase_candidate: "Candidat phase suivante",
};

export function getControlledMissionFinalGateVerdictLabel(
  verdict: ControlledMissionServerPersistenceFinalGateVerdict
): string {
  return VERDICT_LABELS[verdict] ?? "Statut inconnu";
}

export function getControlledMissionFinalGateLevelLabel(
  level: ControlledMissionServerPersistenceFinalGateReadinessLevel
): string {
  return LEVEL_LABELS[level] ?? "Niveau inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionFinalGateBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionFinalGateBadge = {
  id: string;
  label: string;
  tone: ControlledMissionFinalGateBadgeTone;
};

export function buildControlledMissionFinalGateBadges(
  verdict: ControlledMissionServerPersistenceFinalGateVerdict
): ControlledMissionFinalGateBadge[] {
  const go = verdict === "go_for_next_design_phase";
  return [
    { id: "fg-verdict", label: go ? "GO phase suivante" : getControlledMissionFinalGateVerdictLabel(verdict), tone: go ? "success" : verdict === "blocked" ? "danger" : "warning" },
    { id: "fg-design-only", label: "Design-only", tone: "info" },
    { id: "fg-server-inactive", label: "Serveur inactif", tone: "neutral" },
    { id: "fg-no-route", label: "Aucune route", tone: "neutral" },
    { id: "fg-no-execution", label: "Aucune exécution", tone: "neutral" },
  ];
}
