// src/lib/clonestore/technologies/t1/index.ts
// T1 — CLONESTORE TECHNOLOGIES LAYER : exports publics.
// Couche de technologies RÉUTILISABLES consommées par contrat par Pierre (P16C) et par les
// futurs employés IA. Aucun provider live, aucun paiement, production OFF (plancher P10).
// NOTE : distinct des couches B46/TECH-03 du dossier parent (config visible des technos).

// ── Types de base ──────────────────────────────────────────────────────────────
export type {
  TechnologyId, TechnologyStatus, LiveDependency, TechnologyMode, TechnologyContext,
} from "./technology-types";
export { ALL_TECHNOLOGY_IDS, ALL_TECHNOLOGY_STATUSES, isTechnologyId } from "./technology-types";

// ── Résultats ──────────────────────────────────────────────────────────────────
export type { TechnologyResult, TechnologyResultKind } from "./technology-result";
export {
  ALL_TECHNOLOGY_RESULT_KINDS, okResult, needsValidationResult, fallbackResult, blockedResult, errorResult,
  sanitizeTechnologyMessage,
} from "./technology-result";

// ── Contrat ────────────────────────────────────────────────────────────────────
export type { TechnologyContract, DefineTechnologyConfig, TechnologyPrepareOutcome } from "./technology-contract";
export { defineTechnologyContract, wantsLiveEffect, LIVE_EFFECT_BLOCKED_REASON } from "./technology-contract";

// ── Validation (jamais de contournement humain) ───────────────────────────────
export type { TechnologyValidationReport, TechnologyValidationMeta } from "./technology-validation";
export { buildTechnologyValidationReport } from "./technology-validation";

// ── Permissions (fail-closed) ─────────────────────────────────────────────────
export type { TechnologyPermissionDecision, TechnologyPermissionOptions } from "./technology-permissions";
export { checkTechnologyPermission } from "./technology-permissions";

// ── Audit (disponible même en fallback) ───────────────────────────────────────
export type { TechnologyAuditEntry, TechnologyAuditLog } from "./technology-audit";
export { createTechnologyAuditEntry, createTechnologyAuditLog } from "./technology-audit";

// ── Fallbacks sûrs ─────────────────────────────────────────────────────────────
export {
  TECHNOLOGY_FALLBACKS, UNKNOWN_TECHNOLOGY_FALLBACK, getTechnologyFallbackText, allTechnologiesHaveSafeFallback,
} from "./technology-fallbacks";

// ── Statut / mode (dérivés du plancher P10 réel) ──────────────────────────────
export type { TechnologyModeMeta } from "./technology-status";
export { technologyProductionAllowed, isLiveExecutionAllowed, resolveTechnologyMode } from "./technology-status";

// ── Les 15 contrats ────────────────────────────────────────────────────────────
export {
  documentTech, mailTech, calendarTech, signatureTech, voiceTech, notificationTech, connectorTech,
  memoryTech, evidenceTech, workflowTech, analyticsTech, fileTech, exportTech, permissionTech,
  integrationBusTech, ALL_TECHNOLOGY_CONTRACTS, ALL_TECHNOLOGY_CONTRACT_IDS, getTechnologyContract,
} from "./technology-contracts";
export type {
  DocumentTechInput, PreparedDocumentArtifact, MailTechInput, DraftedEmailArtifact,
  CalendarTechInput, PreparedCalendarEventArtifact, SignatureTechInput, PreparedSignaturePackageArtifact,
  VoiceTechInput, VoiceFallbackArtifact, NotificationTechInput, CockpitReminderArtifact,
  ConnectorTechInput, ConnectorFallbackArtifact, MemoryTechInput, MemoryOperationArtifact,
  EvidenceTechInput, EvidenceEntryArtifact, WorkflowTechInput, WorkflowPlanArtifact,
  AnalyticsTechInput, MetricsReportArtifact, FileTechInput, FileIngestionArtifact,
  ExportTechInput, ExportPackageArtifact, PermissionTechInput, PermissionDecisionArtifact,
  IntegrationBusInput, BusSummaryArtifact,
} from "./technology-contracts";

// ── Registre ───────────────────────────────────────────────────────────────────
export type { TechnologyRegistryEntry, TechnologyIntegrationPhase, TechnologyRegistryCrossCheck } from "./technology-registry";
export {
  buildTechnologyRegistry, listTechnologyRegistryEntries, getTechnologyRegistryEntry,
  crossCheckTechnologyRegistryWithMasterSplit,
} from "./technology-registry";

// ── Bus ────────────────────────────────────────────────────────────────────────
export type { TechnologyBus, TechnologyBusListing, TechnologyBusSummary, CreateTechnologyBusOptions } from "./technology-bus";
export {
  createTechnologyBus, listTechnologies, getTechnology, canUseTechnology, prepareWithTechnology,
  validateTechnologyResult, auditTechnologyUse, getTechnologyFallback, summarizeTechnologyBus,
} from "./technology-bus";

// ── Command center ─────────────────────────────────────────────────────────────
export type { TechnologyCommandCenterReport } from "./technology-command-center";
export { summarizeTechnologyCommandCenter } from "./technology-command-center";
