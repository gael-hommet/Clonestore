// src/lib/clonestore/runtime-integration/pierre-sellable-completion-master-audit-ui-copy.ts
// PHASE 6.1 — Pierre Sellable Completion Master Audit — UI Copy / Badges (pur)
//
// Microcopy stricte : « audit Pierre vendable · aucune activation · Pierre n'est pas
// encore public-launch complete ». Jamais « Pierre vendable », « GO », « serveur activé »,
// « runtime exécuté », « lancé en public ».

import type {
  PierreSellableAuditStatus,
  PierreSellableLevel,
  PierreSellableAuditClassification,
} from "./pierre-sellable-completion-master-audit-types";

// ── Actions (lecture seule) ───────────────────────────────────────────────────

export const PIERRE_SELLABLE_AUDIT_VIEW_AUDIT_LABEL = "Voir audit";
export const PIERRE_SELLABLE_AUDIT_VIEW_BLOCKERS_LABEL = "Voir blockers";
export const PIERRE_SELLABLE_AUDIT_VIEW_P6_LABEL = "Voir séquence P6";
export const PIERRE_SELLABLE_AUDIT_VIEW_CRITERIA_LABEL = "Voir critères vendables";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const PIERRE_SELLABLE_AUDIT_MICROCOPY = "Audit Pierre vendable · Aucune activation";
export const PIERRE_SELLABLE_AUDIT_WHAT_IT_DOES =
  "Cet audit prépare Pierre vendable, il ne déclare pas le GO.";
export const PIERRE_SELLABLE_AUDIT_NOT_PUBLIC_COMPLETE =
  "Pierre n'est pas encore public-launch complete.";
export const PIERRE_SELLABLE_AUDIT_NEXT_P6_2 =
  "Prochaine étape : P6.2 — Pierre Real Workflow Completion Pack.";
export const PIERRE_SELLABLE_AUDIT_PANEL_GUARDRAIL =
  "Audit Pierre vendable · Aucune activation. Cet audit prépare Pierre vendable, il ne déclare pas le GO. Pierre n'est pas encore public-launch complete. Prochaine étape : P6.2 — Pierre Real Workflow Completion Pack.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PierreSellableAuditStatus, string> = {
  audit_ready: "Audit prêt",
  sellable_gap_identified: "Écart vendable identifié",
  blocked: "Bloqué",
  ready_for_p6_2: "Prêt pour P6.2",
};

const LEVEL_LABELS: Record<PierreSellableLevel, string> = {
  not_sellable: "Non vendable",
  partially_sellable: "Partiellement vendable",
  internally_demo_sellable: "Vendable en démo interne",
  first_customer_candidate: "Candidat premier client",
  fully_sellable: "Pleinement vendable",
};

const CLASSIFICATION_LABELS: Record<PierreSellableAuditClassification, string> = {
  DONE_SELLABLE: "Fait — vendable",
  DONE_BUT_LOCAL_ONLY: "Fait — local uniquement",
  READY_BUT_INACTIVE: "Prêt — inactif",
  PARTIAL: "Partiel",
  BLOCKING_BEFORE_SALE: "Bloquant avant vente",
  BLOCKING_BEFORE_PUBLIC_LAUNCH: "Bloquant avant public launch",
  FUTURE_NOT_REQUIRED_FOR_FIRST_SALE: "Futur — non requis première vente",
  UNKNOWN_NEEDS_AUDIT: "Inconnu — à auditer",
};

export function getPierreSellableAuditStatusLabel(status: PierreSellableAuditStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getPierreSellableLevelLabel(level: PierreSellableLevel): string {
  return LEVEL_LABELS[level] ?? "Niveau inconnu";
}

export function getPierreSellableClassificationLabel(c: PierreSellableAuditClassification): string {
  return CLASSIFICATION_LABELS[c] ?? "Classification inconnue";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type PierreSellableAuditBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type PierreSellableAuditBadge = {
  id: string;
  label: string;
  tone: PierreSellableAuditBadgeTone;
};

export function buildPierreSellableAuditBadges(level: PierreSellableLevel): PierreSellableAuditBadge[] {
  return [
    { id: "sa-level", label: getPierreSellableLevelLabel(level), tone: level === "fully_sellable" ? "success" : "warning" },
    { id: "sa-audit-only", label: "Audit-only", tone: "info" },
    { id: "sa-not-public", label: "Pas public-launch complete", tone: "neutral" },
    { id: "sa-no-activation", label: "Aucune activation", tone: "neutral" },
    { id: "sa-next-p62", label: "Prochaine étape P6.2", tone: "info" },
  ];
}
