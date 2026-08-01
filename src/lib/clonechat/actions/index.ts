// src/lib/clonechat/actions/index.ts — surface publique de CloneActions (BLOC 8).
export { planAction, executeAction, type PlanActionContext, type ExecuteActionContext } from "./plan";
export {
  decideDiagnoseGuideCareAndPlanAction, executeControlledAction, planActionFromVoiceResult,
  type PlannedDecision,
} from "./actions-with-context";
export { CLONE_ACTIONS, resolveActionDefinition, isRealRoute } from "./registry";
export {
  mintConfirmation, verifyConfirmation, createConfirmationRegistry, DEFAULT_CONFIRMATION_TTL_MS,
  type ConfirmationRegistry, type ConfirmationVerdict,
} from "./confirmation";
export { guardPlan, guardExecute, type GuardStaticInput, type GuardExecuteOptions } from "./guard";
export {
  hasAdapter, getAdapter, adapterAvailable,
  type AdapterDeps, type AdapterOutcome, type ActionAdapter, type AdapterCancelSignal,
} from "./adapters";
export { buildTrace, type TraceInput } from "./trace";
export {
  argsHashOf, planHashOf, idempotencyKeyOf, viewerKeyOf, tenantKeyOf, normalizeArgs,
} from "./keys";
export {
  CLONECHAT_ACTIONS_VERSION, CLONECHAT_TRACE_VERSION, CLONECHAT_CONFIRMATION_VERSION, CLONECHAT_GUARD_VERSION,
  type ActionNature, type ActionRisk, type ActionCategory, type ActionPermission, type ActionState,
  type StructuredActionError, type CloneActionRequest, type ArgsValidation, type ActionDefinition,
  type GuardDecision, type GuardCheck, type GuardResult, type ConfirmationToken, type ActionAuthorization,
  type CloneActionPlan, type CloneTrace, type CloneActionResult,
} from "./types";
