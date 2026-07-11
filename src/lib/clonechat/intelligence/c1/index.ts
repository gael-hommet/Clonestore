// src/lib/clonechat/intelligence/c1/index.ts
// C1 — CLONECHAT TOTAL CLONESTORE INTELLIGENCE : exports publics.
// Couche PURE et locale-sûre : connaissance canonique (site, produit, Pierre,
// technologies, prix, vérité, roadmap) + cerveaux vente/support + mémoire de bugs
// validés + boucle d'apprentissage propositions-uniquement + router + moteur +
// command center. Aucun provider live, aucun paiement, production OFF.
// NOTE : ce barrel N'EST PAS ré-exporté par src/lib/clonechat/index.ts (pas de cycle,
// pas de collision de noms avec la couche P9.4.x existante).

// ── Types & vocabulaires ───────────────────────────────────────────────────────
export * from "./clonechat-knowledge-types";

// ── Politique de claims ────────────────────────────────────────────────────────
export {
  C1_FORBIDDEN_CLAIM_RULES,
  FORBIDDEN_CLAIM_PROBES,
  FORBIDDEN_SALES_BEHAVIOURS,
  CANONICAL_ALLOWED_CLAIMS,
  SAFE_REFUSAL_TEXT,
  affirmativeText,
  checkAnswerTextSafety,
  guardAnswerText,
  evaluateCommercialClaim,
  allForbiddenProbesBlocked,
} from "./clonechat-claims-policy";
export type { ForbiddenClaimRule, ClaimViolation, AnswerTextSafety, GuardedAnswer } from "./clonechat-claims-policy";

// ── Site map ───────────────────────────────────────────────────────────────────
export {
  CLONESTORE_SITE_PAGES,
  UNAVAILABLE_ROUTES,
  NAVIGATION_TOPICS,
  getSitePage,
  resolveLink,
  pageForTopic,
  bestProspectLinks,
} from "./clonechat-site-map";
export type { NavigationTopic } from "./clonechat-site-map";

// ── Matrice de vérité ──────────────────────────────────────────────────────────
export {
  CLONECHAT_TRUTH_MATRIX,
  CLONESTORE_TRUTH,
  PIERRE_TRUTH,
  T1_TRUTH,
  T2_TRUTH,
  EXTERNAL_BLOCKERS_TRUTH,
  truthEntryById,
  truthEntriesBySection,
  truthEntriesByStatus,
  readyVsBlockedSummary,
} from "./clonechat-truth-matrix";

// ── Connaissances ──────────────────────────────────────────────────────────────
export { PRODUCT_IDENTITY, PRODUCT_FAQ, explainCloneStore } from "./clonechat-product-knowledge";
export {
  PIERRE_IDENTITY,
  PIERRE_LAUNCH_PITCH,
  PIERRE_DOES,
  PIERRE_DOES_NOT,
  PIERRE_PAIN_POINTS,
  PIERRE_OBJECTIONS,
  pierreObjectionById,
  explainPierre,
} from "./clonechat-pierre-knowledge";
export {
  T1_TECHNOLOGY_KNOWLEDGE,
  T2_TECHNOLOGY_KNOWLEDGE,
  ALL_TECHNOLOGY_KNOWLEDGE,
  technologyKnowledgeById,
  findTechnologyInText,
} from "./clonechat-technology-knowledge";
export {
  LAUNCH_COUNTRIES,
  PRICING_RULES,
  pricingKnowledgeForCountry,
  allLaunchPricing,
  answerHowMuch,
  answerWhy449,
  answerWhyCHF,
  answerCanIPayNow,
  answerCanIReserve,
  answerFreeTrial,
  answerCountryAvailability,
} from "./clonechat-pricing-knowledge";
export { CLONECHAT_ROADMAP, NEXT_PHASES, roadmapByHorizon, externalBlockers } from "./clonechat-roadmap-knowledge";

// ── Cerveau de vente ───────────────────────────────────────────────────────────
export {
  SALES_PERSONA_PROFILES,
  PAIN_TRIGGERS,
  SALES_FLOW,
  SALES_OBJECTIONS,
  personaProfile,
  salesObjectionById,
  findSalesObjection,
  salesPitchFor,
  deepObjectionAnswer,
} from "./clonechat-sales-brain";
export type { SalesPersonaProfile } from "./clonechat-sales-brain";

// ── Support & bugs ─────────────────────────────────────────────────────────────
export {
  classifyBugCategory,
  inferSeverity,
  missingInfoQuestions,
  safeTroubleshooting,
  classifyBugReport,
  supportRespond,
} from "./clonechat-support-brain";
export type { SupportAnswer } from "./clonechat-support-brain";
export { createC1BugMemory, C1_SEED_KNOWN_BUGS } from "./clonechat-bug-memory";
export type { C1BugMemory, KnownBugQuery, ReportKnownBugInput } from "./clonechat-bug-memory";

// ── Boucle d'apprentissage ─────────────────────────────────────────────────────
export { proposeLearningCandidate, createLearningLoop, LEARNING_DOCTRINE } from "./clonechat-learning-loop";
export type { LearningLoop, ProposeLearningInput } from "./clonechat-learning-loop";

// ── Router & moteur ────────────────────────────────────────────────────────────
export { routeCloneChatQuestion } from "./clonechat-answer-router";
export {
  answerCloneStoreQuestion,
  answerSalesQuestion,
  answerSupportQuestion,
  REQUIRED_SITE_ROUTES,
  requiredRoutesPresent,
} from "./clonechat-answer-engine";
export type { AnswerOptions } from "./clonechat-answer-engine";

// ── Command center ─────────────────────────────────────────────────────────────
export { evaluateCloneChatIntelligenceCommandCenter } from "./clonechat-command-center";
export type { CloneChatIntelligenceCommandCenterReport } from "./clonechat-command-center";

// ── Contrat d'intégration UI (étape suivante — l'UI n'est PAS modifiée en C1) ──
/**
 * Comment câbler C1 dans l'UI CloneChat existante, sans rien casser :
 * - Le route handler public existant (POST /api/assistant, mode orientation) peut
 *   appeler `answerCloneStoreQuestion(question, { mode: "visitor" })` derrière le
 *   flag CLONECHAT_ENABLED existant (défaut OFF) — réponse déterministe, zéro I/O.
 * - Le pipeline authentifié (POST /api/assistant/chat) peut injecter la connaissance
 *   C1 comme source de grounding supplémentaire ; l'EXÉCUTION d'actions reste
 *   exclusivement sur le pipeline gouverné P9.4.2 (propose → confirme → exécute).
 * - Interdits : appels providers live, secrets, écriture en production, mutation
 *   silencieuse de connaissance globale.
 */
export const C1_UI_INTEGRATION_CONTRACT = Object.freeze({
  status: "ready_not_wired" as const,
  safeEntrypoints: [
    "answerCloneStoreQuestion",
    "routeCloneChatQuestion",
    "answerSalesQuestion",
    "answerSupportQuestion",
    "classifyBugReport",
    "proposeLearningCandidate",
  ],
  wiringTarget: "POST /api/assistant (orientation publique) derrière CLONECHAT_ENABLED (défaut OFF)",
  executionStaysOn: "pipeline gouverné P9.4.2 (/api/assistant/chat + /api/assistant/execute)",
  forbidden: ["provider live", "secret", "écriture production", "mutation silencieuse de connaissance"],
  nextStep: "Étape dédiée de câblage UI après C1 — aucune modification d'UI/API dans C1.",
});
