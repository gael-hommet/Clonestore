// src/lib/clonechat/inspector/index.ts — surface publique de CloneInspector (BLOC 10, additif).
// Réexporte aussi l'analyse de capture existante (inspectScreenshot) pour une surface unique.
export { inspectEvidence, type InspectDeps, type InspectOptions } from "./inspect";
export { decideDiagnoseGuideCarePlanActionVisualAndInspect, inspectFromVoiceResult, type InspectedDecision } from "./inspect-with-context";
export {
  validateEvidence, detectActiveOrUnsupportedBinary, detectActiveText, decodeSafeText, DEFAULT_MAX_EVIDENCE_BYTES,
  type ValidateOptions,
} from "./evidence-validate";
export { analyzeJson, MAX_JSON_DEPTH, MAX_JSON_TEXT, type JsonAnalysis } from "./evidence-json";
export { analyzeLogs, MAX_LOG_TEXT, type LogAnalysis } from "./evidence-logs";
export {
  mockVisionProvider, visionOf, validateVisionOutput,
  type VisionProvider, type VisionRequest, type VisionOutcome, type VisionValidation,
} from "./vision-provider";
export {
  CLONECHAT_INSPECTOR_VERSION,
  type RawEvidence, type ValidatedEvidence, type EvidenceOrigin, type EvidenceType, type ValidationState,
  type InspectionStatus, type ObservationKind, type Observation, type InspectorConfidence, type CloneInspectionResult,
} from "./evidence-types";
// Analyse de capture EXISTANTE (C1.8) — conservée, réutilisée par l'orchestrateur.
export { inspectScreenshot, type InspectorInput, type InspectorResult, type ScreenshotAnalysis } from "./cloneinspector";
