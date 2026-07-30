// src/lib/clonechat/diagnosis/index.ts — surface publique du moteur de diagnostic (BLOC 4).
export { diagnoseCloneChat, type DiagnoseInput } from "./diagnose";
export { decideAndDiagnose, type DiagnosedDecision } from "./diagnose-with-context";
export {
  CLONECHAT_DIAGNOSIS_VERSION,
  type CloneChatDiagnosis,
  type DiagnosisKind,
  type CauseCertainty,
  type DiagnosisConfidence,
  type BlockerCategory,
  type DiagnosisUnblockAction,
} from "./types";
