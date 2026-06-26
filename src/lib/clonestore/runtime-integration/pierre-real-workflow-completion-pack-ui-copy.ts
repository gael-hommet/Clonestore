// src/lib/clonestore/runtime-integration/pierre-real-workflow-completion-pack-ui-copy.ts
// PHASE 6.2 — Pierre Real Workflow Completion Pack — UI Copy / Badges (pur)
//
// Microcopy stricte : « pack scénarios Pierre · aucune exécution autonome · actions
// sensibles bloquées/validées · Pierre n'est pas encore public-launch complete ».
// Jamais « Pierre vendable », « runtime exécuté », « email envoyé », « document officiel
// généré », « public launch GO ».

import type {
  PierreWorkflowPackStatus,
} from "./pierre-real-workflow-completion-pack-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const PIERRE_WORKFLOW_PACK_TITLE = "Pierre — 5 scénarios RH vendables";
export const PIERRE_WORKFLOW_PACK_VIEW_SCENARIOS_LABEL = "Voir scénarios";
export const PIERRE_WORKFLOW_PACK_VIEW_DELIVERABLES_LABEL = "Voir livrables";
export const PIERRE_WORKFLOW_PACK_VIEW_VALIDATIONS_LABEL = "Voir validations";
export const PIERRE_WORKFLOW_PACK_VIEW_RISKS_LABEL = "Voir risques";
export const PIERRE_WORKFLOW_PACK_VIEW_VALUE_LABEL = "Voir preuve de valeur";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const PIERRE_WORKFLOW_PACK_MICROCOPY = "Pack scénarios Pierre · Aucune exécution autonome";
export const PIERRE_WORKFLOW_PACK_VALUE_NO_RUNTIME =
  "Ces scénarios prouvent la valeur RH vendable sans activer le runtime.";
export const PIERRE_WORKFLOW_PACK_SENSITIVE_BLOCKED =
  "Les actions sensibles restent bloquées ou soumises à validation humaine.";
export const PIERRE_WORKFLOW_PACK_NOT_PUBLIC_COMPLETE =
  "Pierre n'est pas encore public-launch complete.";
export const PIERRE_WORKFLOW_PACK_NEXT_P6_3 =
  "Prochaine étape : P6.3 — Pierre State/Server Activation Decision Gate.";
export const PIERRE_WORKFLOW_PACK_PANEL_GUARDRAIL =
  "Pack scénarios Pierre · Aucune exécution autonome. Ces scénarios prouvent la valeur RH vendable sans activer le runtime. Les actions sensibles restent bloquées ou soumises à validation humaine. Pierre n'est pas encore public-launch complete.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PierreWorkflowPackStatus, string> = {
  workflow_pack_ready: "Pack prêt",
  scenarios_ready_for_demo: "Scénarios prêts pour démo",
  blocked: "Bloqué",
};

export function getPierreWorkflowPackStatusLabel(status: PierreWorkflowPackStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type PierreWorkflowPackBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type PierreWorkflowPackBadge = {
  id: string;
  label: string;
  tone: PierreWorkflowPackBadgeTone;
};

export function buildPierreWorkflowPackBadges(): PierreWorkflowPackBadge[] {
  return [
    { id: "wp-demo", label: "Prêt démo", tone: "success" },
    { id: "wp-first-sale", label: "Candidat première vente", tone: "info" },
    { id: "wp-no-runtime", label: "Aucune exécution autonome", tone: "neutral" },
    { id: "wp-sensitive-blocked", label: "Actions sensibles bloquées/validées", tone: "neutral" },
    { id: "wp-not-public", label: "Pas public-launch complete", tone: "neutral" },
  ];
}
