// src/lib/go-live/final-launch-gate/final-launch-actions.ts
// GO-LIVE 10 — Structured action plan for unblocking public launch.
// Pure data — no side effects, no API calls.

export type ActionCategory = "gael" | "repo" | "legal" | "stripe" | "supabase" | "while_waiting";

export interface FinalLaunchAction {
  priority: number;
  category: ActionCategory;
  action: string;
  unlocks: string;
  depends_on?: string;
  can_start_now: boolean;
}

export const GAEL_ACTIONS: FinalLaunchAction[] = [
  {
    priority: 1,
    category: "gael",
    action: "Immatriculer la societe Aurexia / CloneStore avec les parents",
    unlocks: "Stripe live, mentions legales completes, email pro, KYC Stripe",
    can_start_now: true,
  },
  {
    priority: 2,
    category: "gael",
    action: "Remplir les informations societe dans /legal/mentions (SIREN, adresse, gerant)",
    unlocks: "LEGAL_ENTITY_INFO_COMPLETED",
    depends_on: "Immatriculation societe",
    can_start_now: false,
  },
  {
    priority: 3,
    category: "legal",
    action: "Envoyer le dossier juridique (CGU/CGV/DPA/confidentialite) a un avocat specialise",
    unlocks: "LEGAL_HUMAN_REVIEW_COMPLETED, LEGAL_CGU_VALIDATED, LEGAL_CGV_VALIDATED",
    depends_on: "Informations societe completes",
    can_start_now: false,
  },
  {
    priority: 4,
    category: "stripe",
    action: "Configurer Stripe live: compte, produit Pierre 449 EUR/mois, cles sk_live_, webhook live",
    unlocks: "STRIPE_LIVE_SECRET_SET, STRIPE_LIVE_PRICE_PIERRE_449_CREATED, STRIPE_LIVE_WEBHOOK_CONFIGURED",
    depends_on: "Immatriculation societe",
    can_start_now: false,
  },
  {
    priority: 5,
    category: "supabase",
    action: "Verifier et appliquer le RLS Supabase en production",
    unlocks: "SUPABASE_RLS_PRODUCTION_VERIFIED",
    depends_on: "Societe immatriculee, Stripe live configure",
    can_start_now: false,
  },
  {
    priority: 6,
    category: "gael",
    action: "Tester le flux paid customer complet en production (checkout live, webhook, acces Pierre)",
    unlocks: "PAID_CUSTOMER_PRODUCTION_E2E_COMPLETED, STRIPE_LIVE_PAYMENT_SUCCESS_TESTED",
    depends_on: "Stripe live + RLS production verifies",
    can_start_now: false,
  },
  {
    priority: 7,
    category: "gael",
    action: "Valider go-live-proofs.local.json et declencher le lancement public",
    unlocks: "PUBLIC_LAUNCH_AUTHORIZED",
    depends_on: "Toutes les etapes precedentes",
    can_start_now: false,
  },
];

export const REPO_ACTIONS: FinalLaunchAction[] = [
  // No urgent repo work — product, site, onboarding all ready.
  // Only act if a real bug is found.
];

export const WHILE_WAITING_ACTIONS: FinalLaunchAction[] = [
  {
    priority: 1,
    category: "while_waiting",
    action: "Continuer les demonstrations privees (demo Pierre accessible)",
    unlocks: "Feedback client, validation produit",
    can_start_now: true,
  },
  {
    priority: 2,
    category: "while_waiting",
    action: "Preparer la prospection et les decks commerciaux",
    unlocks: "Pipeline commercial pret au lancement",
    can_start_now: true,
  },
  {
    priority: 3,
    category: "while_waiting",
    action: "Preparer la documentation commerciale et les tarifs",
    unlocks: "Sales enablement",
    can_start_now: true,
  },
  {
    priority: 4,
    category: "while_waiting",
    action: "Tester l'UX manuellement (onboarding, setup Pierre, cockpit)",
    unlocks: "QA pre-launch manuel",
    can_start_now: true,
  },
  {
    priority: 5,
    category: "while_waiting",
    action: "Rediger la FAQ et le processus de support client",
    unlocks: "Support operationnel pret",
    can_start_now: true,
  },
  {
    priority: 6,
    category: "while_waiting",
    action: "Preparer les emails de bienvenue et le plan d'onboarding",
    unlocks: "Customer success pre-launch",
    can_start_now: true,
  },
];
