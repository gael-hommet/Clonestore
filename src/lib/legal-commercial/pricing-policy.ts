// B47 — Pricing Policy
// Pierre pricing rules and founder pricing policy.
// Pure: no Supabase, no Next, no async. No throw.

import type { PricingPolicy, DemoCapabilityKey } from "./types";
import { normalizeForPhraseCheck } from "./forbidden-phrases";

// ── Pricing constants ─────────────────────────────────────────────────────────

export const PIERRE_MONTHLY_PRICE_EUR = 449;
export const PIERRE_CURRENCY = "EUR";

// ── Policy ────────────────────────────────────────────────────────────────────

export function getPierrePricingPolicy(): PricingPolicy {
  return {
    monthly_price_eur: PIERRE_MONTHLY_PRICE_EUR,
    currency: PIERRE_CURRENCY,
    founder_pricing_enabled: true,
    founder_pricing_description:
      "Les premiers clients conservent le prix affiché au moment de leur souscription, tant que ce prix ne baisse pas ultérieurement. Aucune hausse tarifaire imposée rétroactivement.",
    free_trial_enabled: false,
    free_trial_days: 0,
    free_demo_enabled: true,
    refund_policy_note:
      "[À définir et valider par conseil juridique avant lancement public] — Politique de remboursement à préciser selon les CGV.",
    cancellation_policy_note:
      "[À définir et valider par conseil juridique avant lancement public] — Politique de résiliation à préciser selon les CGV.",
    legal_review_required: true,
  };
}

export function validatePricingClaim(text: string): { ok: boolean; warnings: string[]; errors: string[] } {
  const normalized = normalizeForPhraseCheck(text);
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check if price mentioned matches
  const priceMatches = text.match(/(\d+)\s*€/g);
  if (priceMatches) {
    for (const match of priceMatches) {
      const amount = parseInt(match.replace(/[€\s]/g, ""), 10);
      if (!isNaN(amount) && amount !== PIERRE_MONTHLY_PRICE_EUR && amount > 0) {
        warnings.push(`Prix mentionné (${amount}€) différent du prix officiel (${PIERRE_MONTHLY_PRICE_EUR}€) — vérifier.`);
      }
    }
  }

  // Check for problematic pricing claims
  if (normalized.includes("gratuit") && !normalized.includes("demo") && !normalized.includes("essai")) {
    errors.push("Claim 'gratuit' sans contexte démo — vérifier si applicable.");
  }
  if (normalized.includes("remboursement garanti")) {
    errors.push("'Remboursement garanti' requiert validation juridique CGV.");
  }
  if (normalized.includes("essai gratuit") && !normalized.includes("demo")) {
    warnings.push("Essai gratuit non disponible par défaut — uniquement démo illustrative.");
  }
  if (normalized.includes("prix fixe a vie")) {
    warnings.push("'Prix fixe à vie' non conforme — utiliser la formulation fondateur officielle.");
  }

  return { ok: errors.length === 0, warnings, errors };
}

export function isFounderPricingClaimAllowed(text: string): boolean {
  const normalized = normalizeForPhraseCheck(text);
  const allowed = [
    "prix fondateur",
    "tarif fondateur",
    "founder pricing",
    "prix de lancement",
    "premier prix",
    "conservent leur prix",
    "prix d'origine",
  ];
  return allowed.some((p) => normalized.includes(normalizeForPhraseCheck(p)));
}

export function getDemoVsPaidCapabilities(): Record<DemoCapabilityKey, { demo: boolean; paid: boolean; note: string }> {
  return {
    real_email_send: {
      demo: false,
      paid: true,
      note: "Emails réels nécessitent B39 production mode + validation humaine pour sensibles.",
    },
    official_document_export: {
      demo: false,
      paid: true,
      note: "Export de documents officiels réservé aux clients payants, avec validation humaine.",
    },
    real_ai_generation: {
      demo: false,
      paid: true,
      note: "Génération IA réelle réservée aux clients payants (B38 cost shield).",
    },
    real_mission_execution: {
      demo: false,
      paid: true,
      note: "Exécution de missions réelles réservée aux clients payants.",
    },
    customer_data_storage: {
      demo: false,
      paid: true,
      note: "Stockage long terme uniquement avec consentement et client payant.",
    },
    sensitive_hr_decision: {
      demo: false,
      paid: false,
      note: "Jamais autonome — validation humaine requise dans tous les cas.",
    },
    paid_automation: {
      demo: false,
      paid: true,
      note: "Automatisation réelle réservée aux clients payants.",
    },
    cockpit_access: {
      demo: false,
      paid: true,
      note: "Cockpit Pierre réservé aux clients payants.",
    },
    cloneadn_context: {
      demo: false,
      paid: true,
      note: "Empreinte entreprise réservée aux clients payants.",
    },
    pdf_export: {
      demo: false,
      paid: true,
      note: "Export PDF réservé aux clients payants, avec validation humaine pour officiels.",
    },
    clonetrace: {
      demo: false,
      paid: true,
      note: "Audit trail CloneTrace réservé aux clients payants.",
    },
    real_budget_consumption: {
      demo: false,
      paid: true,
      note: "Consommation IA réelle uniquement pour clients payants (B38 shield).",
    },
  };
}
