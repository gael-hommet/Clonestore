// src/lib/clonestore/runtime-integration/customer-evidence-applied-second-customer-ui-copy.ts
// PHASE 7.4 — Customer Evidence Applied / Second Controlled Customer — UI Copy / Badges (pur)
//
// Microcopy stricte : « Evidence Applied · application contrôlée · aucune preuve n'est appliquée
// sans vérification réelle · un ou deux clients ne suffisent pas à déclarer le lancement public ·
// les go-live proofs restent manuels ». Jamais « evidence applied », « customer success »,
// « public launch GO ».

import type {
  EvidenceApplicationStatus,
  AppliedEvidenceCategory,
} from "./customer-evidence-applied-second-customer-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const CEA_TITLE = "Pierre — Customer Evidence Applied";
export const CEA_VIEW_APPLICATION_LABEL = "Voir application matrix";
export const CEA_VIEW_CONTRIBUTION_LABEL = "Voir go-live contribution";
export const CEA_VIEW_SECOND_CUSTOMER_LABEL = "Voir client 2 preparation";
export const CEA_VIEW_COMPARISON_LABEL = "Voir comparison plan";
export const CEA_VIEW_SAFETY_GATE_LABEL = "Voir safety gate";
export const CEA_VIEW_RUNBOOK_LABEL = "Voir runbook client 2";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CEA_MICROCOPY = "Evidence Applied · application contrôlée";
export const CEA_NO_APPLY_WITHOUT_REAL =
  "Aucune preuve n'est appliquée sans vérification réelle.";
export const CEA_NOT_PUBLIC =
  "Un ou deux clients ne suffisent pas à déclarer le lancement public.";
export const CEA_GO_LIVE_MANUAL =
  "Les go-live proofs restent manuels.";
export const CEA_NEXT_PHASE =
  "Prochaine étape : Second Customer Controlled Run / Public Launch Review Prep.";
export const CEA_PANEL_GUARDRAIL =
  "Evidence Applied · application contrôlée. Aucune preuve n'est appliquée sans vérification réelle. Un ou deux clients ne suffisent pas à déclarer le lancement public. Les go-live proofs restent manuels. Prochaine étape : Second Customer Controlled Run / Public Launch Review Prep.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<EvidenceApplicationStatus, string> = {
  ready_to_apply_when_verified: "Prêt à appliquer dès vérification",
  evidence_missing: "Evidence manquante",
  evidence_partial: "Evidence partielle",
  evidence_applied: "Evidence appliquée",
  blocked: "Bloqué",
};

const CATEGORY_LABELS: Record<AppliedEvidenceCategory, string> = {
  customer_identity: "Identité client",
  contract_cgv: "Contrat / CGV",
  payment_or_activation: "Paiement / activation",
  setup: "Setup",
  first_output: "Premier livrable",
  human_validation: "Validation humaine",
  feedback: "Feedback",
  incident_log: "Incidents",
  post_run_decision: "Décision post-run",
};

export function getEvidenceApplicationStatusLabel(status: EvidenceApplicationStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getAppliedEvidenceCategoryLabel(category: AppliedEvidenceCategory): string {
  return CATEGORY_LABELS[category] ?? "Catégorie inconnue";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type CeaBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type CeaBadge = {
  id: string;
  label: string;
  tone: CeaBadgeTone;
};

export function buildCeaBadges(): CeaBadge[] {
  return [
    { id: "cea-apply-ready", label: "Application prête (non appliquée)", tone: "success" },
    { id: "cea-real-only", label: "Aucune application sans preuve réelle", tone: "neutral" },
    { id: "cea-public-blocked", label: "Public launch bloqué", tone: "warning" },
    { id: "cea-second-not-started", label: "Client 2 non démarré", tone: "neutral" },
    { id: "cea-next-second", label: "Prochaine étape : Second Customer Run", tone: "info" },
  ];
}
