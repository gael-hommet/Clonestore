// src/lib/clonestore/runtime-integration/pierre-channels-identity-final-ui-copy.ts
// PHASE 6.4 — Pierre Channels & Identity Final — UI Copy / Badges (pur)
//
// Microcopy stricte : « identité Pierre · aucun email réel · brouillons uniquement · le
// domaine client n'est pas connecté · première vente contrôlée ≠ email production ».
// Jamais « email envoyé », « domaine connecté », « DNS vérifié », « public launch GO ».

import type {
  PierreIdentityStatus,
  PierreIdentityMode,
  PierreChannelStatus,
} from "./pierre-channels-identity-final-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const PIERRE_IDENTITY_TITLE = "Pierre — Identité & canaux";
export const PIERRE_IDENTITY_VIEW_IDENTITY_LABEL = "Voir identité";
export const PIERRE_IDENTITY_VIEW_CHANNELS_LABEL = "Voir canaux";
export const PIERRE_IDENTITY_VIEW_EMAIL_LABEL = "Voir email strategy";
export const PIERRE_IDENTITY_VIEW_PERMISSIONS_LABEL = "Voir permissions";
export const PIERRE_IDENTITY_VIEW_TEMPLATES_LABEL = "Voir templates";
export const PIERRE_IDENTITY_VIEW_DOMAIN_LABEL = "Voir prérequis domaine";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const PIERRE_IDENTITY_MICROCOPY = "Identité Pierre · Aucun email réel";
export const PIERRE_IDENTITY_DRAFT_ONLY =
  "Pierre peut préparer des brouillons, pas envoyer sans validation.";
export const PIERRE_IDENTITY_DOMAIN_NOT_CONNECTED =
  "Le domaine client n'est pas connecté dans cette phase.";
export const PIERRE_IDENTITY_SALE_VS_EMAIL = "Première vente contrôlée ≠ email production.";
export const PIERRE_IDENTITY_NEXT_P6_5 =
  "Prochaine étape : P6.5 — Pierre Customer Activation E2E Final.";
export const PIERRE_IDENTITY_PANEL_GUARDRAIL =
  "Identité Pierre · Aucun email réel. Pierre peut préparer des brouillons, pas envoyer sans validation. Le domaine client n'est pas connecté dans cette phase. Première vente contrôlée ≠ email production. Prochaine étape : P6.5 — Pierre Customer Activation E2E Final.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PierreIdentityStatus, string> = {
  identity_ready: "Identité prête",
  channels_ready_for_first_sale: "Canaux prêts (première vente)",
  blocked: "Bloqué",
};

const MODE_LABELS: Record<PierreIdentityMode, string> = {
  clonestore_managed_identity: "Identité gérée CloneStore",
  customer_domain_future: "Domaine client (futur)",
  customer_domain_required_for_public_launch: "Domaine client requis (public launch)",
};

const CHANNEL_STATUS_LABELS: Record<PierreChannelStatus, string> = {
  active_for_first_sale: "Actif (première vente)",
  draft_only: "Brouillon uniquement",
  future: "Futur",
  future_public_launch: "Futur (public launch)",
  controlled_local_or_future: "Contrôlé local / futur",
};

export function getPierreIdentityStatusLabel(status: PierreIdentityStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getPierreIdentityModeLabel(mode: PierreIdentityMode): string {
  return MODE_LABELS[mode] ?? "Mode inconnu";
}

export function getPierreChannelStatusLabel(status: PierreChannelStatus): string {
  return CHANNEL_STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type PierreIdentityBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type PierreIdentityBadge = {
  id: string;
  label: string;
  tone: PierreIdentityBadgeTone;
};

export function buildPierreIdentityBadges(): PierreIdentityBadge[] {
  return [
    { id: "id-channels-ready", label: "Canaux première vente", tone: "success" },
    { id: "id-no-email", label: "Aucun email réel", tone: "neutral" },
    { id: "id-domain-not-connected", label: "Domaine non connecté", tone: "neutral" },
    { id: "id-draft-only", label: "Brouillons uniquement", tone: "neutral" },
    { id: "id-not-public", label: "Pas email production", tone: "neutral" },
  ];
}
