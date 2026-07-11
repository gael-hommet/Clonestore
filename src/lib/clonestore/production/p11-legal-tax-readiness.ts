// src/lib/clonestore/production/p11-legal-tax-readiness.ts
// P11 §5 — Readiness LÉGALE / FISCALE / TVA par pays de lancement. PRÉPARE le paquet, NE VALIDE PAS.
// Aucun statut ne devient « verified » sans un artefact de PREUVE EXTERNE (avocat/comptable). Par
// défaut : external_pending / draft_ready / missing. LEGAL_TAX_READY reste false tant qu'aucune
// preuve externe n'existe. Ne présente RIEN comme un conseil juridique/fiscal final.

export type LegalStatus = "verified" | "draft_ready" | "external_pending" | "missing" | "blocked";
export type LegalTaxEnv = Record<string, string | undefined>;

export const LEGAL_TAX_COUNTRIES = ["FR", "BE", "LU", "CH"] as const;
export type LegalCountry = (typeof LEGAL_TAX_COUNTRIES)[number];

export interface DocItem { readonly key: string; readonly label: string; readonly status: LegalStatus; readonly note: string }
export interface CountryItem { readonly country: LegalCountry; readonly label: string; readonly status: LegalStatus; readonly taxQuestions: { readonly q: string; readonly status: LegalStatus }[] }

// Documents requis avant lancement (§5). draft_ready = un contenu existe dans le repo ; la
// VALIDATION juridique reste external_pending. Ici, par défaut, aucune preuve → external_pending.
const REQUIRED_DOCS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "cgu", label: "CGU (conditions générales d'utilisation)" },
  { key: "cgv", label: "CGV (conditions générales de vente)" },
  { key: "dpa_gdpr", label: "DPA / RGPD (accord de traitement des données)" },
  { key: "privacy", label: "Politique de confidentialité" },
  { key: "mentions_legales", label: "Mentions légales" },
  { key: "refund_cancellation", label: "Politique de remboursement / résiliation" },
  { key: "payment_terms", label: "Conditions de paiement Stripe" },
  { key: "ai_employee_disclaimer", label: "Avertissement « employé IA / automatisation »" },
  { key: "hr_legal_boundary", label: "Avertissement limite juridique RH" },
  { key: "subprocessors", label: "Liste des sous-traitants / traitement des données" },
  { key: "country_billing_tax_notes", label: "Notes de facturation/fiscalité par pays" },
];

const TAX_QUESTIONS: ReadonlyArray<{ country: LegalCountry; q: string }> = [
  { country: "FR", q: "Traitement TVA France" },
  { country: "BE", q: "Traitement TVA Belgique" },
  { country: "LU", q: "Traitement TVA Luxembourg" },
  { country: "CH", q: "Traitement TVA suisse" },
];
const CROSS_TAX_QUESTIONS: ReadonlyArray<string> = [
  "Facturation B2B", "Autoliquidation (reverse charge) le cas échéant", "Facturation en CHF", "Facturation en EUR",
  "Pays de l'entité juridique au lancement", "Pays de l'entité Stripe", "Lancement suisse alors que la société est encore française",
  "Migration ultérieure vers une entité suisse",
];

const COUNTRY_LABEL: Record<LegalCountry, string> = { FR: "France", BE: "Belgique", LU: "Luxembourg", CH: "Suisse" };
const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };

export interface LegalTaxReadiness {
  ready: boolean;                 // LEGAL_TAX_READY — false sans preuve externe
  legalTaxReady: boolean;         // alias explicite
  blockers: string[];
  warnings: string[];
  requiredExternalReviews: string[];
  documentChecklist: DocItem[];
  countryChecklist: CountryItem[];
  crossBorderTaxQuestions: { q: string; status: LegalStatus }[];
  note: string;
}

/**
 * Évalue la readiness légale/fiscale. Sans artefact de preuve externe (env
 * CLONESTORE_LEGAL_REVIEW_PROOF / CLONESTORE_TAX_REVIEW_PROOF absents), tout reste external_pending
 * et LEGAL_TAX_READY=false. Aucune auto-validation.
 */
export function evaluateLegalTaxReadiness(env: LegalTaxEnv = process.env): LegalTaxReadiness {
  const hasLegalProof = flagOn(env.CLONESTORE_LEGAL_REVIEW_PROOF);   // artefact de revue juridique externe
  const hasTaxProof = flagOn(env.CLONESTORE_TAX_REVIEW_PROOF);       // artefact de revue fiscale externe

  const docStatus: LegalStatus = hasLegalProof ? "verified" : "external_pending";
  const taxStatus: LegalStatus = hasTaxProof ? "verified" : "external_pending";

  const documentChecklist: DocItem[] = REQUIRED_DOCS.map((d) => ({
    key: d.key, label: d.label, status: docStatus,
    note: hasLegalProof ? "Validé (artefact de revue juridique externe présent)." : "Contenu à finaliser + validation juridique externe requise.",
  }));

  const countryChecklist: CountryItem[] = LEGAL_TAX_COUNTRIES.map((c) => ({
    country: c, label: COUNTRY_LABEL[c],
    status: hasLegalProof && hasTaxProof ? "verified" : "external_pending",
    taxQuestions: TAX_QUESTIONS.filter((t) => t.country === c).map((t) => ({ q: t.q, status: taxStatus })),
  }));

  const crossBorderTaxQuestions = CROSS_TAX_QUESTIONS.map((q) => ({ q, status: taxStatus }));

  const blockers: string[] = [];
  const requiredExternalReviews: string[] = [];
  if (!hasLegalProof) { blockers.push("Revue juridique externe (CGU/CGV/DPA/mentions/…) NON finalisée pour FR/BE/LU/CH."); requiredExternalReviews.push("Revue avocat des documents légaux pour les 4 pays de lancement."); }
  if (!hasTaxProof) { blockers.push("Revue fiscale/TVA externe NON finalisée (EUR vs CHF, TVA CH vs UE, B2B/reverse charge, entité)."); requiredExternalReviews.push("Revue comptable/fiscale TVA par pays + traitement CHF/EUR + entité juridique."); }

  const legalTaxReady = blockers.length === 0; // = false sans preuves
  return {
    ready: legalTaxReady,
    legalTaxReady,
    blockers,
    warnings: legalTaxReady ? [] : ["P11 ne formule AUCUN conseil juridique/fiscal final ; ces éléments requièrent une validation externe avant go-live."],
    requiredExternalReviews,
    documentChecklist,
    countryChecklist,
    crossBorderTaxQuestions,
    note: "P11 PRÉPARE le paquet légal/fiscal ; il ne le VALIDE pas et NE PEUT PAS le vérifier lui-même. LEGAL_TAX_READY ne devient true que si l'OWNER pose des ATTESTATIONS (CLONESTORE_LEGAL_REVIEW_PROOF + CLONESTORE_TAX_REVIEW_PROOF) APRÈS une revue externe réelle. Ce sont des attestations owner (flags), pas des preuves vérifiées par P11 — modèle d'approbation owner assumé et fail-closed par défaut.",
  };
}
