// src/lib/clonestore/runtime-integration/controlled-mission-persistence-phase5-closure-ui-copy.ts
// PHASE 5.10 — Controlled Mission Persistence Phase 5 Closure — UI Copy / Badges (pur)
//
// Microcopy stricte : « clôture Phase 5 design-only · aucune activation · la source
// active reste localStorage · aucun GET/POST serveur ». Jamais « Phase 5 activée »,
// « serveur activé », « persisté », « exécuté », « lancé », « production ready ».

import type {
  ControlledMissionPersistencePhase5ClosureStatus,
} from "./controlled-mission-persistence-phase5-closure-types";

// ── Actions (lecture seule) ───────────────────────────────────────────────────

export const CONTROLLED_MISSION_CLOSURE_VIEW_CLOSURE_LABEL = "Voir clôture P5";
export const CONTROLLED_MISSION_CLOSURE_VIEW_BLOCKS_LABEL = "Voir blocs fermés";
export const CONTROLLED_MISSION_CLOSURE_VIEW_RISKS_LABEL = "Voir risques";
export const CONTROLLED_MISSION_CLOSURE_VIEW_P6_LABEL = "Voir P6";
export const CONTROLLED_MISSION_CLOSURE_VIEW_VERDICT_LABEL = "Voir verdict";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_CLOSURE_MICROCOPY = "Clôture Phase 5 design-only · Aucune activation";
export const CONTROLLED_MISSION_CLOSURE_WHAT_IT_DOES =
  "Cette clôture ferme la préparation Controlled Mission Persistence, pas le lancement public.";
export const CONTROLLED_MISSION_CLOSURE_LOCAL_SOURCE =
  "La source active reste localStorage.";
export const CONTROLLED_MISSION_CLOSURE_NO_GET_POST =
  "Aucun GET/POST serveur n'est effectué.";
export const CONTROLLED_MISSION_CLOSURE_NO_EXECUTION =
  "Aucune exécution n'est possible dans cette phase.";
export const CONTROLLED_MISSION_CLOSURE_NEXT_P6 =
  "Prochaine étape : P6 — Pierre Sellable Completion Sprint.";
export const CONTROLLED_MISSION_CLOSURE_PANEL_GUARDRAIL =
  "Clôture Phase 5 design-only · Aucune activation. Cette clôture ferme la préparation Controlled Mission Persistence, pas le lancement public. La source active reste localStorage. Aucun GET/POST serveur n'est effectué. Aucune exécution n'est possible dans cette phase. Prochaine étape : P6 — Pierre Sellable Completion Sprint.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ControlledMissionPersistencePhase5ClosureStatus, string> = {
  closed_design_only: "Fermée (design-only)",
  validated_no_execution: "Validée (no execution)",
  ready_for_pierre_sellable_sprint: "Prête pour P6 — Pierre Sellable Sprint",
  blocked: "Bloquée",
};

export function getControlledMissionClosureStatusLabel(
  status: ControlledMissionPersistencePhase5ClosureStatus
): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionClosureBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionClosureBadge = {
  id: string;
  label: string;
  tone: ControlledMissionClosureBadgeTone;
};

export function buildControlledMissionClosureBadges(): ControlledMissionClosureBadge[] {
  return [
    { id: "cl-closed", label: "Phase 5 fermée", tone: "success" },
    { id: "cl-design-only", label: "Design-only", tone: "info" },
    { id: "cl-ready-p6", label: "Prête pour P6", tone: "info" },
    { id: "cl-server-inactive", label: "Serveur inactif", tone: "neutral" },
    { id: "cl-no-execution", label: "Aucune exécution", tone: "neutral" },
  ];
}
