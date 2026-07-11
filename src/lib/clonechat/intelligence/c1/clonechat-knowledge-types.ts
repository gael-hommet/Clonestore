// src/lib/clonechat/intelligence/c1/clonechat-knowledge-types.ts
// C1 — CLONECHAT TOTAL CLONESTORE INTELLIGENCE : vocabulaire fermé + types partagés.
// CloneChat répond depuis une connaissance CANONIQUE (site, produit, Pierre, technologies,
// prix, vérité, roadmap, support) — jamais depuis des suppositions vagues. Couche PURE,
// additive, locale-sûre : aucun provider live, aucun paiement, production OFF (plancher P10).

// ── Statuts de vérité (vocabulaire fermé) ─────────────────────────────────────
export const TRUTH_STATUSES = [
  "verified_live",
  "verified_local_safe",
  "integration_ready",
  "architecture_ready",
  "demo_only",
  "roadmap",
  "external_blocked",
  "forbidden_claim",
  "unknown",
] as const;
export type TruthStatus = (typeof TRUTH_STATUSES)[number];

// ── Audiences / modes de réponse ──────────────────────────────────────────────
export const ANSWER_MODES = ["visitor", "prospect", "client", "founder", "internal"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

// ── Site map ──────────────────────────────────────────────────────────────────
export const SITE_PAGE_STATUSES = ["public", "demo", "gated", "internal", "unavailable"] as const;
export type SitePageStatus = (typeof SITE_PAGE_STATUSES)[number];

export interface CloneStoreSitePage {
  readonly id: string;
  readonly route: string;
  readonly title: string;
  readonly description: string;
  readonly audience: readonly AnswerMode[];
  readonly purpose: string;
  readonly cta: string | null;
  readonly relatedPages: readonly string[];
  readonly status: SitePageStatus;
  readonly canLinkDirectly: boolean;
  readonly notes: string | null;
}

/** Route absente/future — CloneChat répond honnêtement et propose la page existante la plus proche. */
export interface UnavailableRoute {
  readonly route: string;
  readonly planned: boolean;
  readonly closestExistingRoute: string;
  readonly note: string;
}

export interface LinkResolution {
  readonly exists: boolean;
  readonly page: CloneStoreSitePage | null;
  readonly closestExisting: CloneStoreSitePage | null;
  readonly plannedNote: string | null;
}

// ── Matrice de vérité ─────────────────────────────────────────────────────────
export const TRUTH_SECTIONS = ["clonestore", "pierre", "t1", "t2", "external_blockers"] as const;
export type TruthSection = (typeof TRUTH_SECTIONS)[number];

export interface TruthMatrixEntry {
  readonly id: string;
  readonly section: TruthSection;
  readonly title: string;
  readonly status: TruthStatus;
  readonly whatExists: string;
  readonly whatDoesNotExist: string;
  readonly safeExplanation: string;
  readonly commercialClaimAllowed: readonly string[];
  readonly commercialClaimForbidden: readonly string[];
  readonly sourceReport: string;
  readonly lastVerifiedPhase: string;
}

// ── Connaissance technologies (T1 + T2) ───────────────────────────────────────
export type TechnologyLayer = "t1" | "t2";

export interface TechnologyKnowledgeEntry {
  readonly id: string;
  readonly layer: TechnologyLayer;
  readonly name: string;
  readonly definition: string;
  readonly role: string;
  readonly contains: readonly string[];
  readonly doesNotContain: readonly string[];
  readonly dependsOn: readonly string[];
  readonly currentStatus: TruthStatus;
  /** Statut EXACT du registre réel (t1/t2) — cross-checké par le command center. */
  readonly sourceStatus: string;
  readonly canClaim: readonly string[];
  readonly cannotClaim: readonly string[];
  readonly clientExplanation: string;
  readonly internalExplanation: string;
  readonly examplePierre: string;
  readonly exampleRoomOrCall: string | null;
}

// ── Connaissance Pierre ───────────────────────────────────────────────────────
export interface PierreObjection {
  readonly id: string;
  readonly objection: string;
  readonly directAnswer: string;
  readonly honestLimitation: string;
  readonly painReframing: string;
  readonly valueArgument: string;
  readonly recommendedCTA: AnswerCTA;
}

// ── CTA / liens ───────────────────────────────────────────────────────────────
export interface AnswerCTA {
  readonly label: string;
  readonly route: string;
}

export interface RelevantLink {
  readonly route: string;
  readonly label: string;
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export interface CountryPricingKnowledge {
  readonly country: string;
  readonly currency: string;
  readonly amount: number;
  readonly display: string;
  readonly group: string;
}

// ── Roadmap ───────────────────────────────────────────────────────────────────
export const ROADMAP_HORIZONS = ["now", "next", "later", "external"] as const;
export type RoadmapHorizon = (typeof ROADMAP_HORIZONS)[number];

export interface RoadmapEntry {
  readonly id: string;
  readonly title: string;
  readonly horizon: RoadmapHorizon;
  readonly dependsOn: readonly string[];
  readonly honestStatement: string;
}

// ── Vente ─────────────────────────────────────────────────────────────────────
export const SALES_PERSONAS = [
  "ceo",
  "hr_director",
  "founder",
  "office_manager",
  "operations_manager",
  "skeptical_buyer",
  "technical_buyer",
  "legal_minded_buyer",
] as const;
export type SalesPersona = (typeof SALES_PERSONAS)[number];

export interface SalesObjectionAnswer {
  readonly id: string;
  readonly objection: string;
  readonly shortAnswer: string;
  readonly explanation: string;
  readonly painReframing: string;
  readonly proofOrFeature: string;
  readonly cta: AnswerCTA;
}

// ── Support / bugs ────────────────────────────────────────────────────────────
export const BUG_CATEGORIES = [
  "login",
  "payment",
  "demo",
  "pierre",
  "cloneroom",
  "clonecall",
  "document",
  "pricing",
  "mobile",
  "performance",
  "visual",
  "unknown",
] as const;
export type BugCategory = (typeof BUG_CATEGORIES)[number];

export const BUG_SEVERITIES = ["low", "medium", "high", "blocking"] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];

export const BUG_REPORT_STATUSES = [
  "reported",
  "needs_info",
  "known_bug",
  "workaround_available",
  "escalated",
  "resolved",
] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export interface BugIntake {
  readonly userId: string | null;
  readonly companyId: string | null;
  readonly route: string | null;
  readonly browserOrDevice: string | null;
  readonly screenSize: string | null;
  readonly category: BugCategory | null;
  readonly description: string;
  readonly reproductionSteps: string | null;
  readonly expectedBehaviour: string | null;
  readonly actualBehaviour: string | null;
  readonly severity: BugSeverity | null;
  readonly at: string;
}

export interface BugReportArtifact {
  readonly id: string;
  readonly category: BugCategory;
  readonly severity: BugSeverity;
  readonly status: BugReportStatus;
  readonly route: string | null;
  readonly companyId: string | null;
  readonly redactedDescription: string;
  /** Max 2 questions précises quand une info manque. */
  readonly missingInfoQuestions: readonly string[];
  readonly linkedKnownIssueId: string | null;
  readonly workaround: string | null;
  readonly escalated: boolean;
  readonly createdAt: string;
}

// ── Mémoire de bugs validés ───────────────────────────────────────────────────
export const BUG_VALIDATION_STATUSES = ["candidate", "validated", "deprecated"] as const;
export type BugValidationStatus = (typeof BUG_VALIDATION_STATUSES)[number];

export const BUG_SCOPES = ["global", "account", "route", "feature"] as const;
export type BugScope = (typeof BUG_SCOPES)[number];

export interface KnownBug {
  readonly id: string;
  readonly title: string;
  readonly symptoms: readonly string[];
  readonly affectedRoutes: readonly string[];
  readonly affectedFeatures: readonly string[];
  readonly severity: BugSeverity;
  readonly rootCauseHypothesis: string;
  readonly confirmedFix: string | null;
  readonly workaround: string | null;
  readonly validationStatus: BugValidationStatus;
  readonly scope: BugScope;
  /** Obligatoire quand scope==="account" — jamais réutilisé pour une autre entreprise. */
  readonly accountId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnownBugMatch {
  readonly bug: KnownBug;
  readonly score: number;
}

// ── Boucle d'apprentissage (propositions uniquement) ──────────────────────────
export const LEARNING_SOURCE_TYPES = [
  "user_question",
  "repeated_objection",
  "repeated_bug",
  "support_resolution",
  "sales_conversation",
  "founder_correction",
  "validated_bug_fix",
  "site_change",
  "pricing_change",
  "product_phase_change",
] as const;
export type LearningSourceType = (typeof LEARNING_SOURCE_TYPES)[number];

export const LEARNING_KNOWLEDGE_TYPES = [
  "faq_entry",
  "sales_answer",
  "bug_memory",
  "site_knowledge_update",
  "objection_handling_improvement",
  "product_explanation_improvement",
] as const;
export type LearningKnowledgeType = (typeof LEARNING_KNOWLEDGE_TYPES)[number];

export const LEARNING_STATUSES = ["candidate", "approved", "rejected", "deprecated"] as const;
export type LearningStatus = (typeof LEARNING_STATUSES)[number];

export const LEARNING_SCOPES = ["global", "account"] as const;
export type LearningScope = (typeof LEARNING_SCOPES)[number];

export interface LearningCandidate {
  readonly id: string;
  readonly sourceType: LearningSourceType;
  readonly proposedKnowledgeType: LearningKnowledgeType;
  readonly summary: string;
  readonly suggestedAnswer: string;
  readonly confidence: number;
  readonly scope: LearningScope;
  readonly accountId: string | null;
  /** TOUJOURS true — aucune connaissance globale sans validation admin/fondateur. */
  readonly requiresValidation: true;
  readonly evidence: readonly string[];
  readonly status: LearningStatus;
  readonly validatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── Router / moteur de réponse ────────────────────────────────────────────────
export const ANSWER_CATEGORIES = [
  "product_explanation",
  "pierre_explanation",
  "technology_explanation",
  "pricing",
  "country_availability",
  "demo_or_reservation",
  "sales_objection",
  "support_bug",
  "site_navigation",
  "roadmap",
  "legal_or_compliance",
  "internal_status",
  "unknown",
] as const;
export type AnswerCategory = (typeof ANSWER_CATEGORIES)[number];

export const ANSWER_CONFIDENCES = ["high", "medium", "low"] as const;
export type AnswerConfidence = (typeof ANSWER_CONFIDENCES)[number];

export interface QuestionRouting {
  readonly category: AnswerCategory;
  readonly confidence: AnswerConfidence;
  readonly matchedSignals: readonly string[];
}

export interface CloneChatAnswer {
  readonly category: AnswerCategory;
  readonly mode: AnswerMode;
  readonly confidence: AnswerConfidence;
  readonly answer: string;
  readonly suggestedCTA: AnswerCTA | null;
  readonly relevantLinks: readonly RelevantLink[];
  readonly claimsUsed: readonly string[];
  readonly forbiddenClaimsAvoided: readonly string[];
  readonly needsHumanEscalation: boolean;
  readonly learningCandidate: LearningCandidate | null;
}

// ── Utilitaires partagés (purs, déterministes) ────────────────────────────────
/** Empreinte FNV-1a stable (même idiome que la couche clonechat existante). */
export function c1Fingerprint(prefix: string, text: string): string {
  let h = 0x811c9dc5;
  const s = text.toLowerCase().trim();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${prefix}_${h.toString(16).padStart(8, "0")}`;
}

/** Similarité Jaccard sur tokens — utilisée par la mémoire de bugs. */
export function c1TokenSimilarity(a: string, b: string): number {
  const tok = (t: string): Set<string> =>
    new Set(
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2),
    );
  const ta = tok(a);
  const tb = tok(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}
