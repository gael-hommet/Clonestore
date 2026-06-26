// TECH-07 — CloneTrace Global Audit Timeline — Public Exports
// Point d'entrée public pour la couche trace globale.

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  GlobalTraceEventId,
  GlobalTraceTimelineId,
  GlobalTraceSessionId,
  GlobalTraceMissionId,
  GlobalTraceTaskId,
  GlobalTraceCompanyId,
  GlobalTraceEmployeeSlug,
  GlobalTraceActorType,
  GlobalTraceEventType,
  GlobalTraceSeverity,
  GlobalTraceStatus,
  GlobalTraceVisibility,
  GlobalTraceSource,
  GlobalTraceTechnologyKey,
  GlobalTraceRelatedEntityType,
  GlobalTraceProofType,
  GlobalTraceRiskLevel,
  GlobalTraceEventMetadata,
  GlobalTraceActor,
  GlobalTraceTechnologyRef,
  GlobalTraceRelatedEntity,
  GlobalTraceProofRef,
  GlobalTraceGuardDecisionRef,
  GlobalTraceValidationRef,
  GlobalTraceEvent,
  GlobalTraceTimeline,
  GlobalTraceTimelineFilter,
  GlobalTraceSnapshot,
  GlobalTraceValidationIssue,
  GlobalTraceValidationReport,
  GlobalTraceEmployeeAccessProfile,
  GlobalGuardTraceInput,
  GlobalPierreTraceInput,
} from "./global-trace-types";

// ── Defaults & Constructors ───────────────────────────────────────────────────
export {
  DEFAULT_GLOBAL_TRACE_VERSION,
  generateTraceEventId,
  generateTraceTimelineId,
  buildSystemTraceActor,
  buildCloneGuardActor,
  buildClonePolicyActor,
  buildAIEmployeeTraceActor,
  buildHumanTraceActor,
  buildCloneOSActor,
  buildEmptyGlobalTraceTimeline,
  buildDemoGlobalTraceTimeline,
  defaultTraceSeverityForEventType,
  defaultTraceStatusForEventType,
  defaultTraceVisibility,
  defaultTraceSource,
} from "./global-trace-defaults";

// ── Event Factory ─────────────────────────────────────────────────────────────
export {
  SENSITIVE_METADATA_KEYS,
  redactTraceMetadata,
  sanitizeTraceSummary,
  createGlobalTraceEvent,
  createMissionCreatedEvent,
  createActionAllowedEvent,
  createActionBlockedEvent,
  createActionRefusedEvent,
  createValidationRequestedEvent,
  createDocumentPreparedEvent,
  createErrorRecordedEvent,
  createGuardEvaluatedEvent,
  createSystemNoteEvent,
} from "./global-trace-event-factory";
export type { CreateGlobalTraceEventParams } from "./global-trace-event-factory";

// ── Timeline Management ───────────────────────────────────────────────────────
export {
  addEventToTimeline,
  addEventsToTimeline,
  filterTimelineEvents,
  getEventById,
  groupEventsByType,
  groupEventsBySeverity,
  groupEventsByStatus,
  groupEventsByActor,
  groupEventsByMission,
  getLatestEvents,
  getCriticalEvents,
  getGuardDecisionEvents,
  countEventsByRiskLevel,
} from "./global-trace-timeline";

// ── Validation ────────────────────────────────────────────────────────────────
export {
  validateGlobalTraceEvent,
  validateGlobalTraceTimeline,
  getGlobalTraceValidationReport,
} from "./global-trace-validation";

// ── Snapshot ──────────────────────────────────────────────────────────────────
export {
  buildGlobalTraceSnapshot,
} from "./global-trace-snapshot";

// ── Storage ───────────────────────────────────────────────────────────────────
export {
  getGlobalTraceTimeline,
  getOrCreateGlobalTraceTimeline,
  setGlobalTraceTimeline,
  appendTraceEvent,
  appendTraceEvents,
  getAllTraceTimelines,
  getTraceTimelineCount,
  hasTraceTimeline,
  clearTraceStore,
  getTotalTraceEventCount,
  getTraceEventById,
} from "./global-trace-storage";

// ── Employee Access ───────────────────────────────────────────────────────────
export {
  PIERRE_DEFAULT_TRACE_ACCESS_PROFILE,
  UNKNOWN_EMPLOYEE_TRACE_ACCESS_PROFILE,
  SYSTEM_TRACE_ACCESS_PROFILE,
  getEmployeeTraceAccessProfile,
  canEmployeeCreateEvent,
  doesActionRequireTrace,
  canEmployeeDeleteEvents,
} from "./employee-trace-access";

// ── Guard → Trace Bridge ──────────────────────────────────────────────────────
export {
  mapGuardDecisionToTraceEventType,
  createTraceEventFromGuardDecision,
  applyGuardDecisionToTimeline,
  createValidationRequestTraceFromGuard,
} from "./guard-trace-bridge";
export type { GuardTraceBridgeInput } from "./guard-trace-bridge";

// ── Pierre → Trace Bridge ─────────────────────────────────────────────────────
export {
  mapPierreEventTypeToGlobalEventType,
  mapPierreRiskLevelToGlobal,
  createTraceEventFromPierreEvent,
  applyPierreEventToTimeline,
  getPierreMappingsSummary,
} from "./pierre-trace-bridge";
export type { PierreTraceBridgeInput } from "./pierre-trace-bridge";
