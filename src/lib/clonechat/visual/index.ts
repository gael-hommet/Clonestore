// src/lib/clonechat/visual/index.ts — surface publique du guidage visuel (BLOC 9).
export { resolveVisualGuidance, detectStale, type VisualResolveInput, type StaleReason } from "./resolve";
export {
  decideDiagnoseGuideCarePlanActionAndVisualGuide, visualGuidanceFromVoiceResult, type VisualGuidedDecision,
} from "./visual-with-context";
export {
  VISUAL_TARGETS, getVisualTarget, targetRouteIsReal, declaredAnchorContract, CLONECHAT_VISUAL_REGISTRY_VERSION,
} from "./registry";
export {
  buildCaptureRef, computeCaptureFingerprint, captureFingerprintsMatch, CAPTURE_ALLOWED_STATES,
  type BuildCaptureInput, type CaptureBuild,
} from "./capture";
export {
  CLONECHAT_VISUAL_VERSION, CLONECHAT_CAPTURE_VERSION, VIEWPORTS,
  type VisualViewport, type VisualAudience, type LocationStrategy, type VerificationStatus,
  type VisualState, type VisualConfidence, type VisualElement, type MeasuredRect,
  type VisualTarget, type CaptureRef, type VisualGuidance,
} from "./types";
