// src/lib/clonechat/brain/index.ts — surface publique du Brain (BLOC 2).
export { decide, toStructured } from "./brain";
export type { LegacyStructured } from "./brain";
export { validateBrainDecision, extractModelProse } from "./parse";
export { classifyMode, resolveRoute, retrieveTruths } from "./classify";
export {
  BRAIN_DECISION_VERSION,
  type BrainDecision,
  type BrainMode,
  type BrainConfidence,
  type BrainInput,
  type BrainAccountContext,
  type BrainRequestedAction,
} from "./types";
