// P-FINAL 01 — Phase 6 — Demo safety rules.
// Defines what is allowed and forbidden in demo mode.
// Pure: no Supabase, no Next, no async, no throw.
// ABSOLUTE constraints — never relax these rules.

import type { DemoActionType } from "./demo-types";

export interface DemoSafetyRule {
  id: string;
  label: string;
  description: string;
  is_absolute: boolean;
  allowed_in_demo: boolean;
}

export const DEMO_SAFETY_RULES: DemoSafetyRule[] = [
  {
    id: "no_real_ai_calls",
    label: "Pas d'appel IA réel (Anthropic/OpenAI)",
    description: "La démo n'appelle jamais l'API Anthropic ou OpenAI. Toutes les réponses Pierre sont pré-définies et statiques.",
    is_absolute: true,
    allowed_in_demo: false,
  },
  {
    id: "no_real_emails",
    label: "Pas d'envoi d'emails réels",
    description: "La démo ne peut pas envoyer d'emails via Resend ou tout autre service d'email. Les emails sont simulés (draft only).",
    is_absolute: true,
    allowed_in_demo: false,
  },
  {
    id: "no_real_accounts",
    label: "Pas de création de vrais comptes",
    description: "La démo ne crée pas de comptes Supabase Auth réels. La session est éphémère et locale.",
    is_absolute: true,
    allowed_in_demo: false,
  },
  {
    id: "no_stripe_checkout",
    label: "Pas de checkout Stripe",
    description: "La démo ne peut pas initier de paiement Stripe ou créer un abonnement.",
    is_absolute: true,
    allowed_in_demo: false,
  },
  {
    id: "no_real_data_access",
    label: "Pas d'accès aux données clients réels",
    description: "La démo utilise uniquement des données pré-définies et fictives. Aucune donnée Supabase production n'est accessible.",
    is_absolute: true,
    allowed_in_demo: false,
  },
  {
    id: "no_real_database_writes",
    label: "Pas d'écriture en base de données",
    description: "La démo ne peut pas écrire dans Supabase production. Toutes les actions sont simulées localement.",
    is_absolute: true,
    allowed_in_demo: false,
  },
  {
    id: "view_simulated_dashboard",
    label: "Visualisation du cockpit simulé",
    description: "L'utilisateur peut voir un cockpit Pierre illustratif avec des données fictives.",
    is_absolute: false,
    allowed_in_demo: true,
  },
  {
    id: "simulate_pierre_task",
    label: "Simulation d'une mission Pierre",
    description: "L'utilisateur peut simuler une mission Pierre avec une réponse pré-définie.",
    is_absolute: false,
    allowed_in_demo: true,
  },
  {
    id: "view_simulated_documents",
    label: "Visualisation de documents illustratifs",
    description: "L'utilisateur peut voir des documents brouillons pré-définis générés par Pierre.",
    is_absolute: false,
    allowed_in_demo: true,
  },
  {
    id: "demo_can_be_interrupted",
    label: "La démo peut être interrompue à tout moment",
    description: "CloneStore peut interrompre la démo à tout moment sans préavis ni engagement.",
    is_absolute: true,
    allowed_in_demo: true,
  },
];

export const ALLOWED_DEMO_ACTIONS: DemoActionType[] = [
  "view_dashboard",
  "view_employee",
  "view_task",
  "view_document",
  "simulate_task",
  "simulate_email_draft",
  "view_audit_trail",
];

export const BLOCKED_DEMO_ACTIONS_REASONS: Partial<Record<string, string>> = {
  real_ai_call: "La démo n'appelle pas l'IA en production — réponses pré-définies uniquement",
  real_email_send: "La démo n'envoie pas de vrais emails",
  stripe_checkout: "La démo ne crée pas d'abonnement Stripe",
  real_data_write: "La démo ne peut pas écrire en base de données production",
  real_account_create: "La démo ne crée pas de vrais comptes utilisateurs",
};

export function isDemoActionAllowed(action: DemoActionType): boolean {
  return ALLOWED_DEMO_ACTIONS.includes(action);
}

export function getAbsoluteRules(): DemoSafetyRule[] {
  return DEMO_SAFETY_RULES.filter((r) => r.is_absolute);
}

export function getForbiddenRules(): DemoSafetyRule[] {
  return DEMO_SAFETY_RULES.filter((r) => !r.allowed_in_demo);
}

export function getAllowedRules(): DemoSafetyRule[] {
  return DEMO_SAFETY_RULES.filter((r) => r.allowed_in_demo);
}
