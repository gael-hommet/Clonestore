// src/lib/go-live/final-launch-gate/final-launch-blockers.ts
// GO-LIVE 10 — Canonical blocker registry.
// Pure data — no side effects, no API calls, no auto-validation.

import type { FinalLaunchBlocker } from "./final-launch-gate-types";

export const FINAL_LAUNCH_BLOCKERS: FinalLaunchBlocker[] = [
  // ── READY ─────────────────────────────────────────────────────────────────

  {
    id: "product_core",
    title: "Produit Pierre — moteur IA",
    description: "B38-B48 clos. Pierre product layer validé: contrats, onboarding, gouvernance, CloneGuard, CloneTrust, audit trail.",
    status: "ready",
    severity: "info",
    owner: "repo",
    evidence_ref: "src/lib/pierre/**/__tests__",
    next_action: "Ne pas rouvrir sans bug réel.",
    can_be_done_now: false,
    blocks_public_launch: false,
    human_label: "Pierre moteur — prêt",
  },
  {
    id: "public_site",
    title: "Site public",
    description: "Homepage, démo Pierre, funnel démo, visual QA public clos. GO-LIVE 05/06/07 validés.",
    status: "ready",
    severity: "info",
    owner: "repo",
    evidence_ref: "docs/GO_LIVE_07_PUBLIC_VISUAL_QA.md",
    next_action: "Ne pas refaire si pas de bug.",
    can_be_done_now: false,
    blocks_public_launch: false,
    human_label: "Site public — prêt",
  },
  {
    id: "supabase_preprod_security",
    title: "Sécurité Supabase — pré-prod",
    description: "RLS pré-prod/staging validé (7/7 PASS). Isolation cross-company vérifiée en staging. GO-LIVE 01D/01E clos.",
    status: "ready",
    severity: "info",
    owner: "supabase",
    evidence_ref: "src/lib/production-readiness/supabase/__tests__",
    next_action: "Appliquer le même RLS en production après immatriculation société.",
    can_be_done_now: false,
    blocks_public_launch: false,
    human_label: "RLS pré-prod — validé",
  },
  {
    id: "first_customer_onboarding",
    title: "Onboarding premier client",
    description: "GO-LIVE 09 clos: /paiement/success → /agents/pierre/setup → cockpit. Access gate, trialing fix, bannière onboarding, premières missions.",
    status: "ready",
    severity: "info",
    owner: "repo",
    evidence_ref: "docs/GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md",
    next_action: "Tester manuellement avec un vrai paiement une fois Stripe live configuré.",
    can_be_done_now: false,
    blocks_public_launch: false,
    human_label: "Onboarding — prêt côté repo",
  },

  // ── PARTIAL / PENDING ──────────────────────────────────────────────────────

  {
    id: "stripe_test",
    title: "Stripe — environnement test",
    description: "Env test configuré, tooling E2E GO-LIVE 08 prêt. E2E test mode formel peut rester pending jusqu'à réouverture Stripe.",
    status: "partial_ready",
    severity: "warning",
    owner: "mixed",
    evidence_ref: "docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md",
    next_action: "Exécuter l'E2E formel test mode quand Stripe sera rouvert.",
    can_be_done_now: false,
    blocks_public_launch: false,
    human_label: "Stripe test — partiel",
  },
  {
    id: "legal_public_copy",
    title: "Copy public — scan automatique",
    description: "Scan automatique propre (GO-LIVE 03). Revue manuelle des pages live, liens CGV/confidentialité checkout et placeholders légaux pending.",
    status: "partial_ready",
    severity: "warning",
    owner: "gael",
    next_action: "Relire manuellement /checkout, /legal/cgv, /legal/confidentialite apres remplissage societe.",
    can_be_done_now: false,
    blocks_public_launch: true,
    human_label: "Copy public — scan OK, revue manuelle pending",
  },
  {
    id: "support_ops",
    title: "Support & FAQ",
    description: "Contact page present. FAQ et processus support non formalisés.",
    status: "partial_ready",
    severity: "warning",
    owner: "gael",
    next_action: "Préparer la FAQ et le processus de support avant lancement public.",
    can_be_done_now: true,
    blocks_public_launch: false,
    human_label: "Support — partiel",
  },

  // ── BLOCKED ────────────────────────────────────────────────────────────────

  {
    id: "legal_entity",
    title: "Société — immatriculation",
    description: "Aurexia / CloneStore non immatriculée. Bloque: Stripe live, mentions légales, email pro, KYC Stripe.",
    status: "blocked",
    severity: "blocker",
    owner: "gael",
    next_action: "Immatriculer la société avec les parents. Obtenir SIREN/SIRET + récépissé RCS.",
    can_be_done_now: true,
    blocks_public_launch: true,
    human_label: "Société non immatriculée — BLOQUE TOUT",
  },
  {
    id: "legal_review",
    title: "Revue juridique humaine",
    description: "CGU, CGV, DPA, confidentialité, mentions légales, infos société — relecture et validation par un juriste ou avocat pending.",
    status: "blocked",
    severity: "blocker",
    owner: "legal",
    next_action: "Envoyer le dossier juridique à un avocat spécialisé après remplissage infos société.",
    can_be_done_now: false,
    blocks_public_launch: true,
    human_label: "Revue juridique — non effectuée",
  },
  {
    id: "stripe_live",
    title: "Stripe live — configuration complète",
    description: "Clés sk_live_ non définies. Produit Pierre 449€/mois sur Stripe live non créé. Webhook live non configuré. Bloqué par immatriculation société.",
    status: "blocked",
    severity: "blocker",
    owner: "stripe",
    next_action: "Configurer Stripe live après immatriculation société: clés, produit, prix, webhook.",
    can_be_done_now: false,
    blocks_public_launch: true,
    human_label: "Stripe live — non configuré",
  },
  {
    id: "production_rls",
    title: "RLS Supabase — production",
    description: "RLS pré-prod validé mais non appliqué en production. Doit être fait après immatriculation et avant lancement public.",
    status: "blocked",
    severity: "blocker",
    owner: "supabase",
    next_action: "Appliquer le RLS production après validation de la société et configuration Stripe.",
    can_be_done_now: false,
    blocks_public_launch: true,
    human_label: "RLS production — non vérifié",
  },
  {
    id: "live_paid_customer_e2e",
    title: "Paid customer E2E — production",
    description: "Flux complet paid customer live non exécuté. Nécessite Stripe live + société + RLS production. Tooling prêt, exécution bloquée.",
    status: "blocked",
    severity: "blocker",
    owner: "mixed",
    evidence_ref: "docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md",
    next_action: "Exécuter le flux paid customer complet en production après déblocage Stripe live.",
    can_be_done_now: false,
    blocks_public_launch: true,
    human_label: "E2E live — non exécuté",
  },
];

export function getBlockersByStatus(status: FinalLaunchBlocker["status"]): FinalLaunchBlocker[] {
  return FINAL_LAUNCH_BLOCKERS.filter((b) => b.status === status);
}

export function getPublicLaunchBlockers(): FinalLaunchBlocker[] {
  return FINAL_LAUNCH_BLOCKERS.filter((b) => b.blocks_public_launch && (b.status === "blocked" || b.status === "pending"));
}

export function getCanDoNowActions(): FinalLaunchBlocker[] {
  return FINAL_LAUNCH_BLOCKERS.filter((b) => b.can_be_done_now);
}
