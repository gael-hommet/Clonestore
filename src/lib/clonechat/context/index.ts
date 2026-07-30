// src/lib/clonechat/context/index.ts — surface publique du CloneContext (BLOC 3).
export { buildCloneChatContext, type BuildContextInput } from "./build";
export { decideWithContext, contextToBrainAccount, type ContextualDecision, type ContextualInput } from "./brain-context";
export {
  CLONECHAT_CONTEXT_VERSION,
  type CloneChatContext,
  type CloneChatNavigation,
  type CloneChatViewerContext,
  type CloneChatTenantContext,
  type CloneChatPierreContext,
  type CloneChatActionId,
  type ContextEnvironment,
} from "./types";
