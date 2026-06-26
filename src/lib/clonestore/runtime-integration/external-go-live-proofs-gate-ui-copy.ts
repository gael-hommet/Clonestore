// src/lib/clonestore/runtime-integration/external-go-live-proofs-gate-ui-copy.ts
// PHASE 7.1 — External Go-Live Proofs Gate — UI Copy / Badges (pur)
//
// Microcopy stricte : « Preuves externes go-live · readiness vs preuve réelle · public launch
// reste bloqué sans preuve réelle · aucune preuve inventée ». Jamais « public launch GO »,
// « Stripe live prouvé », « RLS prod prouvé » sans preuve réelle.

import type {
  ExternalGoLiveProofStatus,
  ExternalProofClassification,
  ExternalPublicLaunchVerdict,
  FirstLiveCustomerReadiness,
} from "./external-go-live-proofs-gate-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const EXTERNAL_GOLIVE_TITLE = "Go-Live — Preuves externes";
export const EXTERNAL_GOLIVE_VIEW_STRIPE_LABEL = "Voir Stripe live";
export const EXTERNAL_GOLIVE_VIEW_SUPABASE_LABEL = "Voir Supabase prod/RLS";
export const EXTERNAL_GOLIVE_VIEW_DOMAIN_LABEL = "Voir domaine/email";
export const EXTERNAL_GOLIVE_VIEW_CUSTOMER_LABEL = "Voir premier client réel";
export const EXTERNAL_GOLIVE_VIEW_MANUAL_LABEL = "Voir étapes manuelles";
export const EXTERNAL_GOLIVE_VIEW_BLOCKERS_LABEL = "Voir blockers";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const EXTERNAL_GOLIVE_MICROCOPY = "Preuves externes go-live · readiness vs preuve réelle";
export const EXTERNAL_GOLIVE_NO_INVENTED =
  "Aucune preuve live n'est inventée : par défaut rien n'est vérifié.";
export const EXTERNAL_GOLIVE_NOT_PUBLIC =
  "Public launch reste bloqué sans preuve réelle.";
export const EXTERNAL_GOLIVE_MANUAL =
  "Les preuves Stripe live, Supabase prod/RLS et domaine/email sont des étapes manuelles.";
export const EXTERNAL_GOLIVE_NEXT_PHASE =
  "Prochaine étape : First Live Customer Controlled Run.";
export const EXTERNAL_GOLIVE_PANEL_GUARDRAIL =
  "Preuves externes go-live · readiness vs preuve réelle. Aucune preuve live n'est inventée : par défaut rien n'est vérifié. Public launch reste bloqué sans preuve réelle. Les preuves Stripe live, Supabase prod/RLS et domaine/email sont des étapes manuelles. Prochaine étape : First Live Customer Controlled Run.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ExternalGoLiveProofStatus, string> = {
  readiness_documented: "Readiness documentée",
  manual_proof_required: "Preuve manuelle requise",
  partially_verified: "Partiellement vérifié",
  verified: "Vérifié",
  blocked: "Bloqué",
};

const CLASSIFICATION_LABELS: Record<ExternalProofClassification, string> = {
  readiness_documented: "A — Readiness documentée",
  manual_proof_required: "B — Preuve manuelle requise",
  proof_verified: "C — Preuve validée",
  blocking_public_launch: "D — Bloquant public launch",
};

const VERDICT_LABELS: Record<ExternalPublicLaunchVerdict, string> = {
  BLOCKED: "Bloqué",
  CONDITIONAL: "Conditionnel",
  GO: "Go",
};

const FIRST_CUSTOMER_LABELS: Record<FirstLiveCustomerReadiness, string> = {
  ready: "Prêt",
  conditional: "Conditionnel",
  not_ready: "Non prêt",
};

export function getExternalGoLiveStatusLabel(status: ExternalGoLiveProofStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getExternalProofClassificationLabel(c: ExternalProofClassification): string {
  return CLASSIFICATION_LABELS[c] ?? "Classification inconnue";
}

export function getExternalPublicLaunchVerdictLabel(v: ExternalPublicLaunchVerdict): string {
  return VERDICT_LABELS[v] ?? "Verdict inconnu";
}

export function getFirstLiveCustomerReadinessLabel(r: FirstLiveCustomerReadiness): string {
  return FIRST_CUSTOMER_LABELS[r] ?? "Readiness inconnue";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ExternalGoLiveBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ExternalGoLiveBadge = {
  id: string;
  label: string;
  tone: ExternalGoLiveBadgeTone;
};

export function buildExternalGoLiveBadges(): ExternalGoLiveBadge[] {
  return [
    { id: "egl-public-blocked", label: "Public launch : bloqué", tone: "warning" },
    { id: "egl-stripe-unverified", label: "Stripe live : non vérifié", tone: "neutral" },
    { id: "egl-rls-unverified", label: "Supabase prod/RLS : non vérifié", tone: "neutral" },
    { id: "egl-domain-unverified", label: "Domaine/email : non vérifié", tone: "neutral" },
    { id: "egl-no-invented", label: "Aucune preuve inventée", tone: "neutral" },
    { id: "egl-next-flc", label: "Prochaine étape : First Live Customer", tone: "info" },
  ];
}
