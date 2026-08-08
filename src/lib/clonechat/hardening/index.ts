// src/lib/clonechat/hardening/index.ts — surface publique du runtime durci CloneChat (BLOC 13).

export {
  CLONECHAT_HARDENING_VERSION,
  type RuntimeMode, type HardeningErrorCode, type InputLimits, type TimeBudgets, type ConcurrencyPolicy,
  type RetryPolicy, type CircuitPolicy, type ActionPolicy, type HardeningConfig, type SafeError, type ModeEffect,
  type ReadinessStatus, type ReadinessCheck, type ReadinessReport, type CircuitState,
} from "./types";
export {
  DEFAULT_LIMITS, DEFAULT_BUDGETS, DEFAULT_CONCURRENCY, DEFAULT_RETRY, DEFAULT_CIRCUIT, DEFAULT_ACTIONS,
  readRuntimeMode, readKillSwitch, resolveHardeningConfig, hardeningConfig, modeEffect,
  type ConfigDiagnostic, type ResolvedHardeningConfig,
} from "./config";
export { HardeningError, httpStatusFor, safeMessageFor, makeSafeError, toSafeError } from "./errors";
export { checkInputLimits, enforceOutputLimit, type HardeningInput } from "./limits";
export { withTimeout, withBoundedRetry, type SleepFn, type TimeoutOptions, type RetryOptions } from "./timeout";
export { createCircuitBreaker, createBreakerRegistry, type CircuitBreaker, type CircuitDeps } from "./circuit-breaker";
export { createConcurrencyLimiter, type ConcurrencyLimiter, type RunOptions } from "./concurrency";
export {
  evaluateReadiness, isActiveAllowed, buildReadinessEvidence,
  REQUIRED_GUARANTEES, DEGRADING_GUARANTEE,
  type EvidenceState, type ReadinessEvidence, type ReadinessFacts, type RequiredGuarantee,
} from "./readiness";
export { createHardenedRuntime, type HardenedRuntime, type GuardResult, type GuardContext, type RuntimeDeps } from "./runtime";
export { correlationId, safeLogFields, type HardeningObservation } from "./observe";
export { hardeningChatPrecheck, type ChatPrecheck, type ChatPrecheckInput } from "./chat-precheck";
export { guardProviderCall, type ProviderGuardOptions } from "./provider-guard";
export { pumpHardenedStream, type HardenedStreamEvent, type HardenedStreamSink, type HardenedStreamDeps, type HardenedStreamResult } from "./stream-guard";
export { readBoundedRequestText, contentLengthExceeds, type BoundedRead } from "./body-guard";
export {
  activeHardening, buildActiveHardenedStream, activeReadinessFacts,
  runServedActiveStream, runServedActiveUnary, ACTIVE_STREAM_PROVIDER_KEY,
  __setActiveStreamProduceForTests, activeStreamProduceForTests,
  __setActiveUnaryCallForTests, activeUnaryCallForTests,
  __resetActiveHardeningForTests, activeBreakerSnapshotForTests, activeConcurrencySnapshotForTests,
  type ActiveHardening, type ActiveUnaryCall, type ServedStreamResult, type ServedUnaryResult,
} from "./chat-active";
