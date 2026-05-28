// B47 — Acceptance Checklist Before B48 Launch
// Pre-launch legal and commercial validation checklist.
// Pure: no Supabase, no Next, no async. No throw.

import type { AcceptanceChecklistItem, LegalCommercialReadiness } from "./types";

// ── Checklist items ───────────────────────────────────────────────────────────

const CHECKLIST_ITEMS: AcceptanceChecklistItem[] = [
  {
    id: "legal_cgu",
    category: "juridique",
    description: "CGU (Conditions Générales d'Utilisation) rédigées et approuvées — À faire valider par conseil juridique.",
    status: "required",
    legal_review_needed: true,
    blocking_b48: true,
  },
  {
    id: "legal_cgv",
    category: "juridique",
    description: "CGV (Conditions Générales de Vente) incluant prix, durée, résiliation, remboursement — À faire valider par conseil juridique.",
    status: "required",
    legal_review_needed: true,
    blocking_b48: true,
  },
  {
    id: "legal_privacy",
    category: "rgpd",
    description: "Politique de confidentialité RGPD complète (bases légales, durées de conservation, droits des personnes) — À faire valider.",
    status: "required",
    legal_review_needed: true,
    blocking_b48: true,
  },
  {
    id: "legal_dpa",
    category: "rgpd",
    description: "DPA (Data Processing Agreement) / Accord de sous-traitance préparé pour les clients B2B — À faire valider.",
    status: "required",
    legal_review_needed: true,
    blocking_b48: true,
  },
  {
    id: "legal_ai_mention",
    category: "ia",
    description: "Mentions légales sur l'usage de l'IA générative et de modèles tiers (OpenAI, Anthropic) dans les outputs.",
    status: "required",
    legal_review_needed: true,
    blocking_b48: true,
  },
  {
    id: "legal_human_validation",
    category: "produit",
    description: "Mention explicite de la responsabilité humaine finale sur toutes les pages produit et dans les CGU.",
    status: "required",
    legal_review_needed: false,
    blocking_b48: true,
  },
  {
    id: "legal_limit_mention",
    category: "produit",
    description: "Disclaimer limite juridique (pas de conseil juridique, pas de remplacement avocat) sur les pages publiques.",
    status: "required",
    legal_review_needed: false,
    blocking_b48: true,
  },
  {
    id: "legal_payroll_mention",
    category: "produit",
    description: "Disclaimer pré-paie/DSN explicite : Pierre ne remplace pas un logiciel de paie ni la DSN.",
    status: "required",
    legal_review_needed: false,
    blocking_b48: true,
  },
  {
    id: "legal_doc_mention",
    category: "produit",
    description: "Disclaimer documents officiels : validation humaine obligatoire avant usage de tout document officiel généré.",
    status: "required",
    legal_review_needed: false,
    blocking_b48: true,
  },
  {
    id: "rgpd_export_purge",
    category: "rgpd",
    description: "Fonctionnalités RGPD export/purge vérifiées et testées (B41) — opérationnelles.",
    status: "required",
    legal_review_needed: false,
    blocking_b48: false,
  },
  {
    id: "rgpd_rls",
    category: "rgpd",
    description: "Row Level Security (RLS) Supabase appliqué en production sur toutes les tables sensibles (B41 SQL).",
    status: "required",
    legal_review_needed: false,
    blocking_b48: true,
  },
  {
    id: "stripe_billing",
    category: "paiement",
    description: "Stripe/facturation vérifié : price_id correct (449€), webhooks actifs, CGV liées au checkout.",
    status: "required",
    legal_review_needed: true,
    blocking_b48: true,
  },
  {
    id: "demo_no_ai_cost",
    category: "produit",
    description: "Démo gratuite confirmée sans consommation IA réelle (B38 cost shield enforce, demo=mock).",
    status: "required",
    legal_review_needed: false,
    blocking_b48: true,
  },
  {
    id: "no_zero_error_promise",
    category: "marketing",
    description: "Aucune promesse 'zéro erreur' dans les pages publiques, emails marketing, et documents produit.",
    status: "required",
    legal_review_needed: false,
    blocking_b48: true,
  },
  {
    id: "no_auto_sensitive_email",
    category: "produit",
    description: "Envoi d'emails sensibles (sanction, licenciement) confirmé comme jamais automatique (B39 + B47 guardrails).",
    status: "required",
    legal_review_needed: false,
    blocking_b48: true,
  },
  {
    id: "legal_human_review",
    category: "juridique",
    description: "Revue juridique humaine complète de toutes les communications publiques et CGU/CGV avant lancement.",
    status: "required",
    legal_review_needed: true,
    blocking_b48: true,
  },
  {
    id: "marketing_copy_review",
    category: "marketing",
    description: "Toutes les pages marketing, emails, et matériaux commerciaux validés via B47 guardrails.",
    status: "required",
    legal_review_needed: false,
    blocking_b48: false,
  },
  {
    id: "founder_pricing_terms",
    category: "paiement",
    description: "Termes founder pricing clairement définis et inclus dans les CGV — À valider juridiquement.",
    status: "required",
    legal_review_needed: true,
    blocking_b48: false,
  },
];

// ── Functions ─────────────────────────────────────────────────────────────────

export function buildB47AcceptanceChecklist(): AcceptanceChecklistItem[] {
  return [...CHECKLIST_ITEMS];
}

export function computeLegalCommercialReadiness(): LegalCommercialReadiness {
  const legal_review_required = CHECKLIST_ITEMS.filter((i) => i.legal_review_needed);
  const blocking = CHECKLIST_ITEMS.filter((i) => i.blocking_b48);

  const blocking_items = legal_review_required
    .filter((i) => i.blocking_b48)
    .map((i) => i.id);

  const warnings = CHECKLIST_ITEMS
    .filter((i) => i.legal_review_needed && !i.blocking_b48)
    .map((i) => `${i.id}: ${i.description}`);

  // Score: 100 - 10 per blocking legal review item outstanding
  const score = Math.max(0, 100 - blocking_items.length * 10);

  return {
    score,
    ok: blocking_items.length === 0,
    blocking_items,
    warnings,
  };
}

export function getB48LegalPrerequisites(): AcceptanceChecklistItem[] {
  return CHECKLIST_ITEMS.filter((i) => i.blocking_b48);
}

export function getLegalReviewRequiredItems(): AcceptanceChecklistItem[] {
  return CHECKLIST_ITEMS.filter((i) => i.legal_review_needed);
}
