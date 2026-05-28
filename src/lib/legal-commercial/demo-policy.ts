// B47 — Demo vs Paid Customer Policy
// Defines what is allowed in demo mode vs paid customer mode.
// Pure: no Supabase, no Next, no async. No throw.

import type { DemoCapabilityKey } from "./types";
import { getDemoVsPaidCapabilities } from "./pricing-policy";

// ── Demo capabilities ─────────────────────────────────────────────────────────

const DEMO_BLOCKED_ACTIONS = new Set<string>([
  "email.send",
  "send_email",
  "email_live_send",
  "official_document_export",
  "pdf_export_live",
  "real_ai_generation",
  "real_mission_execution",
  "customer_data_persist",
  "sensitive_hr_decision",
  "payroll_generation",
  "cloneadn_write",
  "clonetrace_write",
  "payment_trigger",
  "stripe_charge",
]);

export function getDemoCapabilities(): Record<DemoCapabilityKey, boolean> {
  const caps = getDemoVsPaidCapabilities();
  return Object.fromEntries(
    Object.entries(caps).map(([k, v]) => [k, v.demo]),
  ) as Record<DemoCapabilityKey, boolean>;
}

export function getPaidCapabilities(): Record<DemoCapabilityKey, boolean> {
  const caps = getDemoVsPaidCapabilities();
  return Object.fromEntries(
    Object.entries(caps).map(([k, v]) => [k, v.paid]),
  ) as Record<DemoCapabilityKey, boolean>;
}

export function assertDemoCannotPerformAction(action: string): { blocked: boolean; reason: string | null } {
  if (DEMO_BLOCKED_ACTIONS.has(action)) {
    return {
      blocked: true,
      reason: `Action "${action}" non disponible en mode démo — réservée aux clients payants.`,
    };
  }
  return { blocked: false, reason: null };
}

export function isDemoAction(action: string): boolean {
  return DEMO_BLOCKED_ACTIONS.has(action);
}

export function compareDemoAndPaidCapabilities(): Array<{
  capability: DemoCapabilityKey;
  demo: boolean;
  paid: boolean;
  note: string;
}> {
  const caps = getDemoVsPaidCapabilities();
  return Object.entries(caps).map(([k, v]) => ({
    capability: k as DemoCapabilityKey,
    demo: v.demo,
    paid: v.paid,
    note: v.note,
  }));
}

export function getDemoCapabilitySummary(): {
  demo_description: string;
  demo_allowed: string[];
  demo_blocked: string[];
  paid_unlocks: string[];
  legal_note: string;
} {
  return {
    demo_description: "Démonstration gratuite interactive et illustrative. Aucune action réelle déclenchée.",
    demo_allowed: [
      "Interface cockpit illustrative",
      "Génération IA simulée (mode mock)",
      "Aperçu de documents (non exportables)",
      "Présentation des workflows RH",
      "Navigation dans l'interface",
    ],
    demo_blocked: [
      "Envoi d'emails réels",
      "Export de documents officiels",
      "Génération IA réelle (coût budgeté)",
      "Exécution de missions réelles",
      "Stockage durable de données client",
      "Décisions RH sensibles",
      "Génération de pré-paie",
      "Accès au cockpit opérationnel complet",
      "CloneADN / Empreinte entreprise",
      "Consommation de budget IA réel",
    ],
    paid_unlocks: [
      "Missions et tâches RH réelles",
      "Génération IA sous budget (B38 shield)",
      "Emails opérationnels (B39 mode production)",
      "Documents PDF officiels (validation humaine requise)",
      "Cockpit Pierre complet",
      "Empreinte entreprise (CloneADN)",
      "Audit trail CloneTrace",
      "Pré-paie préparatoire (validation expert paie requise)",
    ],
    legal_note:
      "La démo gratuite est illustrative et ne déclenche pas d'actions réelles. Aucun essai gratuit de 7 jours en mode production. Les clients payants accèdent au mode opérationnel sous guards et budgets.",
  };
}
