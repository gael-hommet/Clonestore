// TECH-10 — CloneVoice Readiness Layer — Public Index
// CloneVoice est la couche d'entrée vocale de CloneStore.
// CloneVoice n'est PAS actif en production. TECH-10 = readiness layer uniquement.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  CloneVoiceStatus,
  CloneVoiceRuntimeStatus,
  CloneVoiceReadinessLevel,
  CloneVoiceInputMode,
  CloneVoiceProviderStatus,
  CloneVoiceRiskLevel,
  CloneVoiceTranscriptStatus,
  CloneVoiceCommandIntent,
  CloneVoiceLanguage,
  CloneVoiceFeatureFlag,
  CloneVoicePrerequisite,
  CloneVoiceCapability,
  CloneVoiceLimitation,
  CloneVoiceGuardrail,
  CloneVoiceTranscriptDraft,
  CloneVoiceCommandDraft,
  CloneVoiceReadinessReport,
  CloneVoiceValidationIssue,
  CloneVoiceValidationReport,
  CloneVoiceSnapshot,
} from "./clonevoice-types";

// ── Defaults ──────────────────────────────────────────────────────────────────
export {
  DEFAULT_CLONEVOICE_STATUS,
  DEFAULT_CLONEVOICE_RUNTIME_STATUS,
  DEFAULT_CLONEVOICE_READINESS_LEVEL,
  DEFAULT_CLONEVOICE_PROVIDER_STATUS,
  DEFAULT_CLONEVOICE_AVAILABLE_INPUT_MODES,
  DEFAULT_CLONEVOICE_CAPABILITIES,
  DEFAULT_CLONEVOICE_LIMITATIONS,
  DEFAULT_CLONEVOICE_GUARDRAILS,
  DEFAULT_CLONEVOICE_PREREQUISITES,
  DEFAULT_CLONEVOICE_FEATURE_FLAGS,
  buildDefaultCloneVoiceReadinessReport,
  buildDemoCloneVoiceTranscriptDraft,
  buildDemoCloneVoiceCommandDraft,
  buildEmptyCloneVoiceSnapshot,
} from "./clonevoice-defaults";

// ── Readiness ─────────────────────────────────────────────────────────────────
export type {
  CloneVoiceReadinessEvaluationOptions,
  CloneVoiceReadinessEvaluationResult,
} from "./clonevoice-readiness";
export {
  calculateReadinessScore,
  determineReadinessLevel,
  determineCloneVoiceStatus,
  determineRuntimeStatus,
  evaluateCloneVoiceReadiness,
  buildReadinessVerdict,
  isTextTranscriptAvailable,
  isCloneVoiceProductionEnabled,
  isLiveAudioReady,
  isMicrophoneReady,
  getDefaultReadinessReport,
  listBlockingPrerequisites,
  listAvailableInputModes,
} from "./clonevoice-readiness";

// ── Transcript Normalizer ─────────────────────────────────────────────────────
export type {
  RedactionResult,
  TranscriptNormalizationInput,
  TranscriptNormalizationResult,
} from "./clonevoice-transcript-normalizer";
export {
  detectLanguage,
  detectCommandIntent,
  evaluateRiskLevel,
  requiresHumanReview,
  redactPII,
  normalizeText,
  validateRawText,
  normalizeTranscript,
  rejectTranscript,
} from "./clonevoice-transcript-normalizer";

// ── Command Adapter ───────────────────────────────────────────────────────────
export type {
  CloneVoiceCommandAdaptationResult,
} from "./clonevoice-command-adapter";
export {
  mapIntentToEmployeeSlug,
  requiresValidationBeforeCloneOS,
  canProceedToCloneOS,
  adaptTranscriptToCommandDraft,
  buildVoiceMetadataForCloneOS,
  filterCommandsReadyForCloneOS,
  filterCommandsRequiringValidation,
  filterBlockedCommands,
} from "./clonevoice-command-adapter";

// ── Guardrails ────────────────────────────────────────────────────────────────
export type {
  CloneVoiceGuardrailCheckResult,
} from "./clonevoice-guardrails";
export {
  checkProductionEnabledGuardrail,
  checkLiveAudioGuardrail,
  checkMicrophoneGuardrail,
  checkAudioStorageGuardrail,
  checkTranscriptGuardrails,
  checkCommandDraftGuardrails,
  checkReadinessReportGuardrails,
  getActiveGuardrails,
  getGuardrailsRequiringHumanReview,
  isActionBlockedByGuardrails,
} from "./clonevoice-guardrails";

// ── Validation ────────────────────────────────────────────────────────────────
export {
  ruleCV01_productionEnabledFalse,
  ruleCV02_liveAudioFalse,
  ruleCV03_microphoneFalse,
  ruleCV04_audioStorageFalse,
  ruleCV05_privacyReviewRequired,
  ruleCV06_securityReviewRequired,
  ruleCV07_readinessScoreRange,
  ruleCV08_verdictNotEmpty,
  ruleCV09_verdictNoProductionClaim,
  ruleCV10_generatedAtNotEmpty,
  ruleCV11_inputModeTextTranscript,
  ruleCV12_transcriptSanitized,
  ruleCV13_transcriptDraftId,
  ruleCV14_transcriptCompanyId,
  ruleCV15_criticalRiskReview,
  ruleCV16_blockedReasonConsistency,
  ruleCV17_commandDraftId,
  ruleCV18_cloneosSourceIsCloneChat,
  ruleCV19_snapshotProductionFalse,
  ruleCV20_capabilitiesConsistency,
  validateCloneVoiceReadinessReport,
  validateCloneVoiceTranscriptDraft,
  validateCloneVoiceCommandDraft,
  validateCloneVoiceSnapshot,
} from "./clonevoice-validation";

// ── Snapshot ──────────────────────────────────────────────────────────────────
export type {
  CloneVoiceSnapshotDiff,
} from "./clonevoice-snapshot";
export {
  buildCloneVoiceSnapshot,
  diffCloneVoiceSnapshots,
  countSnapshotsByStatus,
  countSnapshotsByRuntimeStatus,
  countSnapshotsByReadinessLevel,
  calculateAverageReadinessScore,
  listSnapshotsWithBlockers,
  getLatestSnapshot,
  getSnapshotOrEmpty,
  summarizeSnapshot,
} from "./clonevoice-snapshot";

// ── Storage ───────────────────────────────────────────────────────────────────
export {
  saveTranscriptDraft,
  getTranscriptDraft,
  listTranscriptDrafts,
  listTranscriptsDraftsPendingReview,
  saveCommandDraft,
  getCommandDraft,
  listCommandDrafts,
  listCommandDraftsReadyForCloneOS,
  saveReadinessReport,
  getReadinessReport,
  saveSnapshot,
  listSnapshots,
  getLatestSnapshotFromStore,
  serializeTranscriptDraft,
  serializeReadinessReport,
  clearCloneVoiceStore,
  getCloneVoiceStoreStats,
} from "./clonevoice-storage";

// ── Pierre Bridge ─────────────────────────────────────────────────────────────
export type {
  PierreVoiceBridgeInput,
  PierreVoiceBridgeResult,
  PierreVoiceCommandSummary,
} from "./pierre-voice-bridge";
export {
  processPierreVoiceInput,
  buildPierreVoiceCommandSummary,
  buildPierreDemoVoiceTranscript,
  buildPierreDemoVoiceCommand,
  canPierreUseCloneVoiceForIntent,
  getPierreSupportedVoiceIntents,
} from "./pierre-voice-bridge";
