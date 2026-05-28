// B47 — Commercial Claims Policy
// Defines allowed/forbidden commercial promises about Pierre/CloneStore.
// Pure: no Supabase, no Next, no async. No throw.

import type {
  LegalCommercialClaim,
  CommercialClaimCategory,
  ClaimDecision,
  LegalRiskLevel,
} from "./types";
import { normalizeForPhraseCheck } from "./forbidden-phrases";

// ── Static claims registry ───────────────────────────────────────────────────

const CLAIMS: LegalCommercialClaim[] = [
  // ── ALLOWED ─────────────────────────────────────────────────────────────────
  {
    id: "c_prod_01",
    category: "productivity",
    claim: "Pierre automatise une grande partie de la charge RH opérationnelle.",
    decision: "allowed",
    risk_level: "low",
    required_disclaimer_ids: [],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: null,
  },
  {
    id: "c_prod_02",
    category: "cost_saving",
    claim: "Pierre aide à gagner du temps et de l'argent.",
    decision: "allowed",
    risk_level: "none",
    required_disclaimer_ids: [],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: "Slogan validé.",
  },
  {
    id: "c_prod_03",
    category: "automation",
    claim: "Pierre structure les missions, tâches, validations, documents, emails et historiques.",
    decision: "allowed",
    risk_level: "none",
    required_disclaimer_ids: [],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: null,
  },
  {
    id: "c_prod_04",
    category: "automation",
    claim: "Pierre améliore la continuité et la traçabilité.",
    decision: "allowed",
    risk_level: "none",
    required_disclaimer_ids: [],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: null,
  },
  {
    id: "c_prod_05",
    category: "hr_decision",
    claim: "Pierre peut préparer des documents RH sous validation humaine pour les documents sensibles.",
    decision: "allowed",
    risk_level: "low",
    required_disclaimer_ids: ["OFFICIAL_DOCUMENT_VALIDATION"],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: null,
  },
  {
    id: "c_prod_06",
    category: "hr_decision",
    claim: "Pierre ne remplace pas la responsabilité humaine finale.",
    decision: "allowed",
    risk_level: "none",
    required_disclaimer_ids: [],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: "Disclaimer actif — toujours sûr.",
  },
  {
    id: "c_prod_07",
    category: "automation",
    claim: "Pierre prépare, structure, suit, relance et documente.",
    decision: "allowed",
    risk_level: "none",
    required_disclaimer_ids: [],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: null,
  },
  {
    id: "c_prod_08",
    category: "automation",
    claim: "Pierre est disponible 24h/24, 7j/7 pour les tâches opérationnelles.",
    decision: "allowed",
    risk_level: "low",
    required_disclaimer_ids: ["AI_LIMIT"],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: "Disponibilité opérationnelle, pas garantie de continuité SLA.",
  },
  // ── ALLOWED WITH DISCLAIMER ──────────────────────────────────────────────────
  {
    id: "c_repl_01",
    category: "replacement",
    claim: "Pierre remplace une partie importante du travail opérationnel RH.",
    decision: "allowed_with_disclaimer",
    risk_level: "low",
    required_disclaimer_ids: ["HUMAN_RESPONSIBILITY", "AI_LIMIT"],
    forbidden_reason: null,
    safe_rewrite: "Pierre prend en charge une grande partie du travail opérationnel RH, l'humain garde la responsabilité finale.",
    notes: null,
  },
  {
    id: "c_repl_02",
    category: "cost_saving",
    claim: "Pierre peut réduire fortement le temps passé sur les tâches répétitives RH.",
    decision: "allowed_with_disclaimer",
    risk_level: "low",
    required_disclaimer_ids: ["AI_LIMIT"],
    forbidden_reason: null,
    safe_rewrite: null,
    notes: null,
  },
  {
    id: "c_pay_01",
    category: "payroll",
    claim: "Pierre peut préparer des éléments de pré-paie.",
    decision: "allowed_with_disclaimer",
    risk_level: "medium",
    required_disclaimer_ids: ["PAYROLL_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION"],
    forbidden_reason: null,
    safe_rewrite: "Pierre peut préparer des éléments variables de pré-paie. Ces données doivent être vérifiées et validées par un expert paie avant traitement.",
    notes: null,
  },
  {
    id: "c_prod_09",
    category: "ai_capability",
    claim: "Pierre absorbe une part massive du travail RH opérationnel.",
    decision: "allowed_with_disclaimer",
    risk_level: "medium",
    required_disclaimer_ids: ["HUMAN_RESPONSIBILITY", "AI_LIMIT"],
    forbidden_reason: null,
    safe_rewrite: "Pierre prend en charge une grande partie du travail RH opérationnel. Les décisions sensibles restent sous responsabilité humaine.",
    notes: "Wording fort mais acceptable avec disclaimer.",
  },
  // ── FORBIDDEN ────────────────────────────────────────────────────────────────
  {
    id: "c_forb_01",
    category: "legal",
    claim: "Pierre remplace un avocat.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Pierre ne fournit aucun conseil juridique. Affirmer le contraire est faux et potentiellement illégal.",
    safe_rewrite: "Pierre peut préparer des éléments RH opérationnels sous supervision humaine. Pour tout conseil juridique, consultez un professionnel du droit.",
    notes: null,
  },
  {
    id: "c_forb_02",
    category: "compliance",
    claim: "Pierre garantit la conformité légale.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Aucun outil IA ne peut garantir la conformité légale. Affirmation fausse et engageant la responsabilité.",
    safe_rewrite: "Pierre intègre des mécanismes de validation et de garde-fous. La conformité finale reste sous la responsabilité de l'employeur.",
    notes: null,
  },
  {
    id: "c_forb_03",
    category: "hr_decision",
    claim: "Pierre prend seul les décisions de licenciement.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Les décisions de licenciement sont des actes juridiques complexes requérant une décision humaine.",
    safe_rewrite: "Pierre peut préparer des éléments de dossier pour un licenciement. La décision finale reste humaine et juridique.",
    notes: null,
  },
  {
    id: "c_forb_04",
    category: "payroll",
    claim: "Pierre remplace un logiciel de paie ou la DSN.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Pierre prépare uniquement des éléments variables. Il ne génère pas de DSN et ne remplace pas un logiciel de paie.",
    safe_rewrite: "Pierre prépare des éléments de pré-paie. La paie officielle, la DSN et les bulletins définitifs restent à la charge d'un logiciel de paie et d'un expert paie.",
    notes: null,
  },
  {
    id: "c_forb_05",
    category: "ai_capability",
    claim: "Pierre garantit zéro erreur.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Aucun outil IA ne peut garantir l'absence d'erreur. Affirmation fausse et trompeuse.",
    safe_rewrite: "Pierre intègre des contrôles qualité. Les résultats doivent être vérifiés avant usage officiel.",
    notes: null,
  },
  {
    id: "c_forb_06",
    category: "legal",
    claim: "Pierre supprime tout risque prud'homal.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Aucun outil ne peut éliminer le risque prud'homal. Affirmation fausse.",
    safe_rewrite: "Pierre améliore la traçabilité et la structuration des dossiers RH, ce qui peut réduire certains risques opérationnels.",
    notes: null,
  },
  {
    id: "c_forb_07",
    category: "legal",
    claim: "Pierre gère juridiquement l'entreprise.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Pierre est un outil opérationnel RH. Il n'a aucune qualification juridique.",
    safe_rewrite: "Pierre automatise l'opérationnel RH. La gestion juridique reste sous la responsabilité de l'employeur et de ses conseils.",
    notes: null,
  },
  {
    id: "c_forb_08",
    category: "hr_decision",
    claim: "Pierre peut envoyer des sanctions ou licenciements automatiquement.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Les sanctions et licenciements nécessitent une décision humaine. L'envoi automatique est techniquement bloqué dans Pierre.",
    safe_rewrite: "Pierre prépare des brouillons de courriers sensibles. L'envoi est toujours conditionné à une validation humaine explicite.",
    notes: null,
  },
  {
    id: "c_forb_09",
    category: "data_protection",
    claim: "Pierre est conforme RGPD à 100% sans revue.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "La conformité RGPD dépend de la configuration et de l'usage. Aucun outil ne peut prétendre être conforme sans revue.",
    safe_rewrite: "Pierre intègre des mécanismes RGPD (export, purge, isolation). La configuration et la conformité finale nécessitent une revue par le responsable de traitement.",
    notes: null,
  },
  {
    id: "c_forb_10",
    category: "legal",
    claim: "Pierre est un service juridique autonome.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Pierre est un outil RH opérationnel. Il n'est pas un service juridique.",
    safe_rewrite: "Pierre est un poste RH opérationnel automatisé. Pour les questions juridiques, consultez un professionnel du droit.",
    notes: null,
  },
  {
    id: "c_forb_11",
    category: "replacement",
    claim: "Pierre remplace toute l'équipe RH juridiquement.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Pierre ne remplace pas la responsabilité légale d'une équipe RH humaine.",
    safe_rewrite: "Pierre automatise l'opérationnel RH et permet à une équipe réduite de gérer davantage, l'humain restant responsable légalement.",
    notes: null,
  },
  {
    id: "c_forb_12",
    category: "compliance",
    claim: "Conformité garantie.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Aucune garantie de conformité possible sans revue juridique.",
    safe_rewrite: "Pierre intègre des mécanismes de contrôle. La conformité finale relève de la responsabilité de l'employeur.",
    notes: null,
  },
  {
    id: "c_forb_13",
    category: "ai_capability",
    claim: "Zéro erreur.",
    decision: "forbidden",
    risk_level: "critical",
    required_disclaimer_ids: [],
    forbidden_reason: "Affirmation fausse — aucun outil IA ne garantit l'absence d'erreur.",
    safe_rewrite: "Pierre intègre des contrôles qualité. Les sorties doivent être vérifiées avant usage officiel.",
    notes: null,
  },
];

// ── Keyword classifiers (pattern → category) ────────────────────────────────

const CATEGORY_KEYWORDS: Array<{ patterns: string[]; category: CommercialClaimCategory }> = [
  { patterns: ["avocat", "juriste", "juridique", "droit", "légal"], category: "legal" },
  { patterns: ["conformité", "conforme", "rgpd", "compliance"], category: "compliance" },
  { patterns: ["paie", "dsn", "bulletin", "salaire", "rémunération", "prepaye", "pré-paie"], category: "payroll" },
  { patterns: ["licenciement", "sanction", "discipline", "prud"], category: "hr_decision" },
  { patterns: ["remplace", "supprime", "élimin"], category: "replacement" },
  { patterns: ["garantit", "garanti", "zéro erreur", "sans erreur", "parfait"], category: "ai_capability" },
  { patterns: ["temps", "coût", "argent", "productivité", "efficacité"], category: "productivity" },
  { patterns: ["automatise", "automatisation", "automate"], category: "automation" },
  { patterns: ["rgpd", "données", "protection", "confidentialité"], category: "data_protection" },
  { patterns: ["prix", "tarif", "abonnement", "fondateur", "founder"], category: "pricing" },
  { patterns: ["démo", "demo", "gratuit", "essai", "trial"], category: "demo_trial" },
];

// ── Forbidden keyword patterns ────────────────────────────────────────────────

const FORBIDDEN_PATTERNS = [
  "garantit la conformité",
  "garantit zéro erreur",
  "remplace un avocat",
  "remplace l'avocat",
  "service juridique autonome",
  "juridiquement autonome",
  "prend seul les décisions",
  "décisions de licenciement seul",
  "envoyer des sanctions automatiquement",
  "remplace la dsn",
  "remplace un logiciel de paie",
  "supprime tout risque",
  "zéro risque prud",
  "conforme rgpd à 100%",
  "sans revue",
  "garantit",
  "zéro erreur",
  "garanti",
  "aucune erreur",
  "remplace toute l'équipe rh juridiquement",
  "conformité garantie",
  "outil juridique complet",
  "licencie automatiquement",
  "paie officielle autonome",
];

// ── Exports ───────────────────────────────────────────────────────────────────

export function getAllClaims(): LegalCommercialClaim[] {
  return CLAIMS;
}

export function getAllowedClaims(): LegalCommercialClaim[] {
  return CLAIMS.filter((c) => c.decision === "allowed" || c.decision === "allowed_with_disclaimer");
}

export function getForbiddenClaims(): LegalCommercialClaim[] {
  return CLAIMS.filter((c) => c.decision === "forbidden");
}

export function classifyCommercialClaim(text: string): CommercialClaimCategory {
  const normalized = normalizeForPhraseCheck(text);
  for (const { patterns, category } of CATEGORY_KEYWORDS) {
    if (patterns.some((p) => normalized.includes(normalizeForPhraseCheck(p)))) return category;
  }
  return "automation";
}

export function evaluateCommercialClaim(text: string): { decision: ClaimDecision; risk_level: LegalRiskLevel; matched_claim: LegalCommercialClaim | null; reason: string | null } {
  const normalized = normalizeForPhraseCheck(text);

  // Check exact/near matches in claims registry
  for (const claim of CLAIMS) {
    if (normalized.includes(normalizeForPhraseCheck(claim.claim))) {
      return {
        decision: claim.decision,
        risk_level: claim.risk_level,
        matched_claim: claim,
        reason: claim.forbidden_reason,
      };
    }
  }

  // Check forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (normalized.includes(normalizeForPhraseCheck(pattern))) {
      return {
        decision: "forbidden",
        risk_level: "critical",
        matched_claim: null,
        reason: `Contient une formulation interdite : "${pattern}"`,
      };
    }
  }

  return {
    decision: "allowed",
    risk_level: "low",
    matched_claim: null,
    reason: null,
  };
}

export function rewriteUnsafeClaim(text: string): string {
  const normalized = normalizeForPhraseCheck(text);
  for (const claim of CLAIMS) {
    if (normalized.includes(normalizeForPhraseCheck(claim.claim)) && claim.safe_rewrite) {
      return claim.safe_rewrite;
    }
  }
  // Generic safe rewrite
  return text
    .replace(/garantit/gi, "contribue à")
    .replace(/garantie/gi, "contribue à")
    .replace(/zéro erreur/gi, "avec contrôles qualité intégrés")
    .replace(/remplace\s+(un\s+)?avocat/gi, "assiste les équipes RH opérationnelles")
    .replace(/conforme.*?100%/gi, "intègre des mécanismes de conformité")
    .replace(/autonome/gi, "assisté par l'humain");
}
