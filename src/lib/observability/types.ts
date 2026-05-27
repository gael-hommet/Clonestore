// B43 — Observability core types
// Pure module: no DB, no async side-effects

// ── Severity ──────────────────────────────────────────────────────────────────

export type ObservabilitySeverity = "debug" | "info" | "warning" | "error" | "critical";

export const SEVERITY_RANK: Record<ObservabilitySeverity, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

export function isSeverityAtLeast(
  actual: ObservabilitySeverity,
  threshold: ObservabilitySeverity,
): boolean {
  return SEVERITY_RANK[actual] >= SEVERITY_RANK[threshold];
}

export function getHighestSeverity(severities: ObservabilitySeverity[]): ObservabilitySeverity {
  if (severities.length === 0) return "debug";
  return severities.reduce((a, b) => (SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b));
}

// ── Event status ──────────────────────────────────────────────────────────────

export type ObservableEventStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "blocked"
  | "retried"
  | "degraded"
  | "skipped"
  | "dead_lettered";

// ── Domain ────────────────────────────────────────────────────────────────────

export type ObservableEventDomain =
  | "ai"
  | "email"
  | "workflow"
  | "task"
  | "mission"
  | "cockpit"
  | "security"
  | "rgpd"
  | "billing"
  | "document"
  | "pdf"
  | "memory"
  | "channel"
  | "system";

// ── Observable event ──────────────────────────────────────────────────────────

export type ObservableEvent = {
  id: string;
  timestamp: string;
  correlation_id: string;
  causation_id: string | null;
  company_id: string | null;
  user_id: string | null;
  agent_slug: string;
  mission_id: string | null;
  task_id: string | null;
  domain: ObservableEventDomain;
  event_type: string;
  status: ObservableEventStatus;
  severity: ObservabilitySeverity;
  message: string;
  safe_user_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  metadata_redacted: Record<string, unknown>;
  created_at: string;
};

// ── Observable error ──────────────────────────────────────────────────────────

export type ObservableError = {
  code: string;
  domain: ObservableEventDomain;
  severity: ObservabilitySeverity;
  retryable: boolean;
  user_safe: boolean;
  safe_message: string;
  internal_message: string;
  cause_type: string;
  metadata_redacted: Record<string, unknown>;
};

// ── Retry decision ────────────────────────────────────────────────────────────

export type RetryDecision = {
  should_retry: boolean;
  next_attempt_at: string | null;
  retry_count: number;
  max_retries: number;
  backoff_ms: number;
  reason: string;
};

// ── Dead letter ───────────────────────────────────────────────────────────────

export type DeadLetterEntry = {
  id: string;
  correlation_id: string;
  domain: ObservableEventDomain;
  resource_type: string;
  resource_id: string | null;
  error_code: string;
  severity: ObservabilitySeverity;
  retry_count: number;
  payload_redacted: Record<string, unknown>;
  reason: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
};

// ── Health check ──────────────────────────────────────────────────────────────

export type HealthCheckStatus = "ok" | "degraded" | "down" | "disabled";

export type HealthCheckResult = {
  service: string;
  status: HealthCheckStatus;
  latency_ms: number | null;
  checked_at: string;
  message: string | null;
  details_redacted: Record<string, unknown>;
};

// ── Pierre runtime areas ──────────────────────────────────────────────────────

export type PierreRuntimeArea =
  | "mission_submit"
  | "task_execution"
  | "workflow_runtime"
  | "cockpit_snapshot"
  | "email_prepare"
  | "email_send"
  | "document_generation"
  | "pdf_generation"
  | "memory_read"
  | "memory_write"
  | "rgpd_export"
  | "rgpd_purge"
  | "security_guard"
  | "ai_call"
  | "cost_ledger";

export type PierreAreaStatus = "ok" | "degraded" | "error" | "unknown";

// ── Diagnostics sub-types ─────────────────────────────────────────────────────

export type PierreDiagnosticsRecentError = {
  correlation_id: string;
  domain: ObservableEventDomain;
  event_type: string;
  error_code: string | null;
  severity: ObservabilitySeverity;
  message: string;
  timestamp: string;
};

export type PierreDiagnosticsDeadLetterItem = {
  id: string;
  domain: ObservableEventDomain;
  error_code: string;
  retry_count: number;
  reason: string;
  created_at: string;
};

// ── Diagnostics report ────────────────────────────────────────────────────────

export type PierreDiagnosticsReport = {
  generated_at: string;
  status: "ok" | "degraded" | "critical";
  areas: Record<PierreRuntimeArea, PierreAreaStatus>;
  recent_errors: PierreDiagnosticsRecentError[];
  dead_letters: PierreDiagnosticsDeadLetterItem[];
  health_checks: HealthCheckResult[];
  degraded_reasons: string[];
  recommended_actions: string[];
  safe_to_operate: boolean;
};

// ── Observable summary ────────────────────────────────────────────────────────

export type ObservableSummary = {
  total: number;
  by_status: Partial<Record<ObservableEventStatus, number>>;
  by_severity: Partial<Record<ObservabilitySeverity, number>>;
  by_domain: Partial<Record<ObservableEventDomain, number>>;
  critical_count: number;
  error_count: number;
};

// ── Event query ───────────────────────────────────────────────────────────────

export type ObservableEventQuery = {
  domain?: ObservableEventDomain;
  company_id?: string;
  user_id?: string;
  correlation_id?: string;
  severity?: ObservabilitySeverity;
  status?: ObservableEventStatus;
  limit?: number;
};
