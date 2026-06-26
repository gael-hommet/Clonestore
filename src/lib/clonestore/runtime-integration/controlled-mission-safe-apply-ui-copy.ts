// src/lib/clonestore/runtime-integration/controlled-mission-safe-apply-ui-copy.ts
// PHASE 5.1 — Controlled Mission Safe Apply — UI Copy / Badges (pur, read-only)
//
// Microcopy stricte : mission PRÉPARÉE / CRÉÉE LOCALEMENT / NON EXÉCUTÉE.
// Jamais "lancée", jamais "exécutée", jamais "Pierre traite la mission".
// Pas de fetch, pas de base de données, pas d'import Pierre.

import type {
  LocalControlledMission,
  LocalControlledMissionStatus,
} from "./controlled-mission-safe-apply-types";

// ── Boutons / messages ────────────────────────────────────────────────────────

export const CONTROLLED_MISSION_SAFE_APPLY_BUTTON_LABEL = "Créer une mission contrôlée locale";
export const CONTROLLED_MISSION_SAFE_APPLY_BUTTON_LABEL_ALT = "Enregistrer comme mission contrôlée";
export const CONTROLLED_MISSION_SAFE_APPLY_MICROCOPY =
  "Local uniquement · Aucune exécution · Aucun envoi · Non persisté serveur";
export const CONTROLLED_MISSION_SAFE_APPLY_SUCCESS =
  "Mission contrôlée créée localement. Elle n'a pas été exécutée.";
export const CONTROLLED_MISSION_SAFE_APPLY_ALREADY_CREATED = "Déjà créée localement";
export const CONTROLLED_MISSION_SAFE_APPLY_BLOCKED =
  "Safe apply impossible : informations manquantes / risque trop élevé / validation requise.";
export const CONTROLLED_MISSION_SAFE_APPLY_FAILED =
  "Échec de la sauvegarde locale. Aucune exécution n'a eu lieu.";

// ── Guardrails ────────────────────────────────────────────────────────────────

export const CONTROLLED_MISSION_GUARDRAILS: string[] = [
  "Cette mission est préparée, pas exécutée.",
  "Pierre ne travaille pas encore en autonomie sur cette mission.",
  "Aucune donnée n'est envoyée au serveur dans cette phase.",
  "La persistance serveur et l'exécution gouvernée seront traitées dans une phase ultérieure.",
];

// ── Status labels ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LocalControlledMissionStatus, string> = {
  local_controlled_created: "Mission contrôlée créée (locale)",
  waiting_manual_review: "En attente de validation humaine",
  blocked_by_guard: "Bloquée par CloneGuard",
  blocked_by_missing_information: "Bloquée — informations manquantes",
  archived_local: "Archivée (locale)",
};

export function getLocalControlledMissionStatusLabel(status: LocalControlledMissionStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type LocalControlledMissionBadgeTone = "success" | "warning" | "info" | "neutral" | "danger" | "violet";
export type LocalControlledMissionBadge = { id: string; label: string; tone: LocalControlledMissionBadgeTone };

export function buildLocalControlledMissionBadges(
  mission: LocalControlledMission
): LocalControlledMissionBadge[] {
  const isBlocked = mission.status === "blocked_by_guard" || mission.status === "blocked_by_missing_information";
  return [
    { id: "badge-status", label: getLocalControlledMissionStatusLabel(mission.status), tone: isBlocked ? "danger" : mission.status === "archived_local" ? "neutral" : "success" },
    { id: "badge-local", label: "Local", tone: "info" },
    { id: "badge-not-executed", label: "Non exécuté", tone: "neutral" },
    { id: "badge-server-disabled", label: "Serveur désactivé", tone: "neutral" },
    { id: "badge-human", label: "Validation humaine", tone: "neutral" },
    { id: "badge-no-pierre", label: "Aucun appel Pierre", tone: "neutral" },
    { id: "badge-no-ai", label: "Aucun appel IA", tone: "neutral" },
  ];
}

// ── Badges de section (globaux) ───────────────────────────────────────────────

export function buildLocalControlledMissionSectionBadges(): LocalControlledMissionBadge[] {
  return [
    { id: "sec-local", label: "Local", tone: "info" },
    { id: "sec-not-executed", label: "Non exécuté", tone: "neutral" },
    { id: "sec-server-disabled", label: "Serveur désactivé", tone: "neutral" },
    { id: "sec-human", label: "Validation humaine", tone: "neutral" },
  ];
}
