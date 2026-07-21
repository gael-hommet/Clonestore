// src/lib/clonechat/intelligence/c1-1/index.ts
// C1.1 — CLONECHAT PARRAIN : barrel des contrats SÛRS.
//
// ⚠️ SERVER-ORIENTED. Ce barrel n'est PAS destiné aux composants client : la couche de
// connaissance dérive des registres canoniques (canon RH P8.10, registres T1/T2, sources
// P9.4.1) et ne doit jamais entrer dans un bundle navigateur.
//
// EXCLUS VOLONTAIREMENT de ce barrel (import par CHEMIN FEUILLE côté serveur uniquement) :
//   · ./parrain-command-center        → node:fs / node:path (sondes de câblage)
//   · ./parrain-code-index            → node:fs (manifeste de symboles, fondateur)
//   · ./parrain-internal-adapter      → dépend du code index (fondateur)
//   · ./parrain-file-parsers          → pdf-parse / mammoth / xlsx (Node)
//   · ./parrain-attachment-ingestion  → node:crypto + parseurs
//   · ./parrain-authenticated-adapter → proposal-store (base de données) + loopback V1
// Le composant UI ne les importe jamais : il parle à /api/assistant/chat.

// ── Vocabulaire & types ───────────────────────────────────────────────────────
export * from "./parrain-types";

// ── Visibilité (fail-closed) ──────────────────────────────────────────────────
export {
  allowedParrainVisibilities,
  chunkVisibleFor,
  filterVisibleChunks,
  toLegacyVisibility,
  containsSecretMaterial,
  quarantineIfSecret,
  stripInternalPathsForViewer,
} from "./parrain-visibility";

// ── Chunks & fraîcheur ────────────────────────────────────────────────────────
export { makeParrainChunk, derivedChunkId, PARRAIN_DEFAULT_REVIEWED_AT } from "./parrain-knowledge-chunk";
export type { MakeChunkInput } from "./parrain-knowledge-chunk";
export {
  computeCanonicalFingerprints,
  checkSourceFreshness,
  buildFreshnessReport,
} from "./parrain-freshness";
export type { CanonicalFingerprints, FreshnessCheck, FreshnessReport } from "./parrain-freshness";

// ── Registre de sources ───────────────────────────────────────────────────────
export {
  buildParrainSourceRegistry,
  sourceById,
  sourceRegistryValid,
  checkRegistryFreshness,
} from "./parrain-source-registry";

// ── Index vivants ─────────────────────────────────────────────────────────────
export {
  buildParrainSiteIndex,
  sitePageByRoute,
  lookupSite,
  buildSiteChunks,
} from "./parrain-site-index";
export type { ParrainSitePage, SiteLookupResult } from "./parrain-site-index";

export {
  buildPierreCapabilityIndex,
  canonicalCapabilityCount,
  capabilityById,
  capabilitiesByDomain,
  retrieveCapabilities,
  capabilityChunks,
  domainSummaryChunk,
} from "./parrain-pierre-index";
export type { ParrainPierreCapabilityEntry } from "./parrain-pierre-index";

export {
  buildTechnologyIndex,
  technologyCounts,
  technologyEntryById,
  technologyFromQuestion,
  distinctionForQuestion,
  technologyChunks,
  TECHNOLOGY_DISTINCTIONS,
} from "./parrain-technology-index";
export type { ParrainTechnologyEntry } from "./parrain-technology-index";

export { productIdentityChunk, clonechatIdentityChunk, productTruthChunks, pricingChunk, externalBlockersChunk } from "./parrain-product-index";
export { roadmapPublicChunk, readinessFounderChunk, roadmapEntryCount } from "./parrain-roadmap-index";

// ── Index de connaissance unifié & récupération ───────────────────────────────
export {
  buildKnowledgeIndex,
  searchKnowledgeIndex,
  boundedCapabilitiesFor,
  indexLeaksForbiddenSources,
  KNOWLEDGE_INDEX_BOUNDS,
} from "./parrain-knowledge-index";
export type { KnowledgeIndexBuild, KnowledgeIndexInput, KnowledgeIndexStats } from "./parrain-knowledge-index";

export { retrieveParrainChunks } from "./parrain-retrieval";
export type { RetrievalOptions } from "./parrain-retrieval";
export { collectCandidateChunks, legacyKnowledgeAsParrainChunks } from "./parrain-source-adapters";

// ── Grounding, prompt, citations ──────────────────────────────────────────────
export { buildParrainGroundedPrompt } from "./parrain-grounding";
export type { ParrainGroundedPrompt, GroundingInput } from "./parrain-grounding";
export { buildParrainSystemPrompt } from "./parrain-system-prompt";
export { validateParrainCitations, qualifyUnsupported } from "./parrain-citations";
export type { ParrainCitationResult } from "./parrain-citations";

// ── Contexte compte (ports injectés — aucune base ici) ────────────────────────
export {
  buildAccountContextSnapshot,
  accountSnapshotChunks,
  assertOwnEntity,
} from "./parrain-account-context";
export type {
  ParrainAccountPort,
  ParrainAccountContextSnapshot,
  AccountMissionLite,
  AccountValidationLite,
  AccountEmployeeLite,
  AccountArtifactLite,
} from "./parrain-account-context";

// ── Lineage documentaire ──────────────────────────────────────────────────────
export { buildDocumentLineage, explainSentence, lineageChunk } from "./parrain-document-lineage";
export type { ParrainDocumentLineage, ParrainLineagePort, SentenceExplanation } from "./parrain-document-lineage";

// ── Pièces jointes : types & politique (les PARSEURS restent en feuille serveur) ─
export {
  ATTACHMENT_SUPPORT_MATRIX,
  ATTACHMENT_SUPPORT_STATUSES,
} from "./parrain-attachment-types";
export type {
  AttachmentFormat,
  AttachmentSupportStatus,
  ParrainAttachment,
  ParrainAttachmentChunk,
  AttachmentIngestionInput,
  AttachmentIngestionResult,
} from "./parrain-attachment-types";
export {
  ATTACHMENT_LIMITS,
  detectMime,
  extensionOf,
  formatForExtension,
  evaluateAttachmentPolicy,
  neutralizeLinks,
  redactedAttachmentError,
  withExtractionTimeout,
} from "./parrain-attachment-policy";
export type { PolicyDecision } from "./parrain-attachment-policy";

export { imageAnalysisChunk, IMAGE_PIPELINE_DOCTRINE } from "./parrain-image-adapter";
export type { ExistingScreenshotAnalysis } from "./parrain-image-adapter";
export { searchAttachmentChunks, resolveReferencedIds, pickDocumentSessionChunks } from "./parrain-document-retrieval";
export type { DocumentRetrievalHit } from "./parrain-document-retrieval";

// ── Runtimes ──────────────────────────────────────────────────────────────────
export { analyzeSalesTurn, SALES_FORBIDDEN_BEHAVIOURS } from "./parrain-sales-runtime";
export type { SalesTurnAnalysis } from "./parrain-sales-runtime";

export { runSupportTurn } from "./parrain-support-runtime";
export type { SupportTurnInput, SupportTurnResult, ParrainSupportArtifact } from "./parrain-support-runtime";

export {
  createParrainBugStore,
  honestResolutionText,
  PARRAIN_BUG_SCOPES,
} from "./parrain-bug-learning";
export type { ParrainBugStore, ParrainKnownBug, ParrainBugScope, BugQueryContext } from "./parrain-bug-learning";

export {
  createParrainLearningLoop,
  checkContradiction,
  PARRAIN_LEARNING_OUTPUT_TYPES,
  CANONICAL_SUPERSEDES_APPROVED,
} from "./parrain-knowledge-learning";
export type { ParrainLearningLoop, ParrainLearningCandidate, ParrainLearningOutputType } from "./parrain-knowledge-learning";

// ── Délégation Pierre (ports injectés — jamais d'exécution ici) ───────────────
export {
  classifyPierreRequest,
  delegateToPierre,
  readAuthoritativeMissionStatus,
  PIERRE_REQUEST_KINDS,
} from "./parrain-pierre-delegation";
export type { ParrainPierreDelegationResult, PierreDelegationPort, PierreRequestKind } from "./parrain-pierre-delegation";

// ── Schéma de réponse & tour ──────────────────────────────────────────────────
export { deriveHonesty, finalizeAnswerText } from "./parrain-answer-schema";
export type { ParrainAnswer } from "./parrain-answer-schema";
export { runParrainTurn } from "./parrain-turn-runtime";
export type { ParrainTurnInput, ParrainTurnPorts, ParrainResponderPort } from "./parrain-turn-runtime";

// ── Adaptateur public (aucun tenant, aucun code, aucune délégation) ───────────
export { answerPublicQuestion, PUBLIC_VIEWER } from "./parrain-public-adapter";
export type { PublicTurnInput } from "./parrain-public-adapter";

/**
 * Contrat de câblage C1.1 (documentaire, testé) : où vivent les entrées serveur.
 * Les modules cités ne sont PAS ré-exportés ici — importer par chemin feuille.
 */
export const C1_1_SERVER_LEAF_MODULES = Object.freeze({
  commandCenter: "@/lib/clonechat/intelligence/c1-1/parrain-command-center",
  codeIndex: "@/lib/clonechat/intelligence/c1-1/parrain-code-index",
  internalAdapter: "@/lib/clonechat/intelligence/c1-1/parrain-internal-adapter",
  fileParsers: "@/lib/clonechat/intelligence/c1-1/parrain-file-parsers",
  attachmentIngestion: "@/lib/clonechat/intelligence/c1-1/parrain-attachment-ingestion",
  authenticatedAdapter: "@/lib/clonechat/intelligence/c1-1/parrain-authenticated-adapter",
});
