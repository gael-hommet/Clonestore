// src/lib/clonechat/analytics/index.ts — surface publique de CloneAnalytics & Observability (BLOC 12).

export {
  CLONECHAT_ANALYTICS_VERSION, FORBIDDEN_RESULTS,
  type PipelineStage, type AnalyticsCategory, type AnalyticsNature, type CollectionBasis,
  type SensitivityLevel, type SamplingPolicy, type DedupStrategy, type AnalyticsResult, type ConsentMode,
  type EmitStatus, type EmitResult, type MetaValue, type AnalyticsEventSpec, type AnalyticsEnvelope,
  type ValidatedEnvelope, type AnalyticsSink, type SinkDeliveryResult, type SinkDeliveryStatus,
  type AggregateSnapshot, type HealthSnapshot, type LatencyStat,
} from "./types";
export { getEventSpec, isKnownEvent, allEventSpecs, ANALYTICS_EVENT_NAMES } from "./registry";
export {
  createDefaultPseudonymizer, validateAndMinimizeMeta, isBannedMetaKey,
  MAX_META_KEYS, MAX_FIELD_LEN, MAX_ENVELOPE_BYTES,
  type Pseudonymizer, type PseudonymKind, type MetaValidation,
} from "./privacy";
export { buildEnvelope, type EmitInput, type EnvelopeDeps } from "./envelope";
export {
  createMemorySink, createNoopSink, createFailingSink, createTimeoutSink, createPartialSink,
  type MemoryAnalyticsSink,
} from "./sink";
export {
  createCloneAnalytics,
  type CloneAnalytics, type CloneAnalyticsConfig, type FlushResult, type Sampler, type AnalyticsCounters,
} from "./collector";
export { aggregate, health } from "./aggregate";
export { deriveEventsFromDecision, type DerivedEvent } from "./instrument";
export {
  onboardPrepareMissionAndObserveWithCloneChat,
  type ObservedResult, type ObserveOptions, type AnalyticsObservation,
} from "./observe-with-context";
