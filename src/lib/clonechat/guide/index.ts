// src/lib/clonechat/guide/index.ts — surface publique de CloneGuide (BLOC 5).
export { buildCloneGuide, type BuildGuideOptions } from "./build";
export { decideDiagnoseAndGuide, type GuidedDecision } from "./guide-with-context";
export {
  CLONECHAT_GUIDE_VERSION,
  type CloneGuide,
  type CloneGuideStep,
  type GuideId,
  type GuideState,
} from "./types";
