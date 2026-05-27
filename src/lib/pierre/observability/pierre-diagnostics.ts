// B43 — Pierre diagnostics report

import type {
  PierreDiagnosticsReport,
  PierreRuntimeArea,
  PierreAreaStatus,
  ObservableEventDomain,
  ObservabilitySeverity,
} from "../../observability/types";
import type { ObservableEventSink } from "../../observability/event-log";
import type { DeadLetterSink } from "../../observability/dead-letter";
import { buildPierreHealthReport, type PierreHealthReport } from "./pierre-health";
import { buildRunbookForDiagnostics } from "./pierre-observability-verdict";

// ── Runtime area definitions ──────────────────────────────────────────────────

const ALL_RUNTIME_AREAS: PierreRuntimeArea[] = [
  "mission_submit",
  "task_execution",
  "workflow_runtime",
  "cockpit_snapshot",
  "email_prepare",
  "email_send",
  "document_generation",
  "pdf_generation",
  "memory_read",
  "memory_write",
  "rgpd_export",
  "rgpd_purge",
  "security_guard",
  "ai_call",
  "cost_ledger",
];

// ── Domain → runtime area mapping ────────────────────────────────────────────

const DOMAIN_TO_AREAS: Partial<Record<ObservableEventDomain, PierreRuntimeArea[]>> = {
  mission:  ["mission_submit", "workflow_runtime"],
  task:     ["task_execution"],
  email:    ["email_prepare", "email_send"],
  ai:       ["ai_call"],
  document: ["document_generation"],
  pdf:      ["pdf_generation"],
  memory:   ["memory_read", "memory_write"],
  rgpd:     ["rgpd_export", "rgpd_purge"],
  security: ["security_guard"],
  billing:  ["cost_ledger"],
  cockpit:  ["cockpit_snapshot"],
};

// ── Area status derivation ────────────────────────────────────────────────────

type AreaStatus = PierreAreaStatus;

function deriveAreaStatus(
  area: PierreRuntimeArea,
  recentErrorCodes: string[],
  downServices: string[],
): AreaStatus {
  // Check if a directly related service is down
  if (area === "ai_call" && downServices.includes("ai_provider")) return "error";
  if ((area === "email_send" || area === "email_prepare") && downServices.includes("email_provider")) return "error";
  if ((area === "memory_read" || area === "memory_write" || area === "cockpit_snapshot") && downServices.includes("supabase")) return "error";
  if (area === "security_guard" && downServices.includes("security_guard")) return "error";

  // Check recent error codes
  const areaErrorPatterns: Partial<Record<PierreRuntimeArea, string[]>> = {
    mission_submit: ["PIERRE_MISSION_NOT_FOUND", "PIERRE_MISSION_ALREADY_CLOSED"],
    task_execution: ["PIERRE_TASK_EXECUTION_FAILED", "PIERRE_WORKFLOW_HARD_FAIL"],
    workflow_runtime: ["PIERRE_WORKFLOW_HARD_FAIL", "PIERRE_WORKFLOW_NO_TASKS"],
    email_send: ["PIERRE_EMAIL_SEND_FAILED", "PIERRE_EMAIL_BLOCKED_BY_POLICY"],
    ai_call: ["PIERRE_AI_CALL_FAILED", "PIERRE_AI_TIMEOUT", "PIERRE_AI_BUDGET_EXCEEDED"],
    document_generation: ["PIERRE_DOCUMENT_GENERATION_FAILED"],
    pdf_generation: ["PIERRE_PDF_RENDER_FAILED"],
    security_guard: ["PIERRE_SECURITY_VIOLATION", "PIERRE_MISSION_COMPANY_MISMATCH"],
    rgpd_purge: ["PIERRE_RGPD_PURGE_BLOCKED"],
  };

  const patterns = areaErrorPatterns[area] ?? [];
  if (patterns.some((p) => recentErrorCodes.includes(p))) return "degraded";

  return "ok";
}

// ── Main diagnostics builder ──────────────────────────────────────────────────

export type PierreDiagnosticsOptions = {
  sink?: ObservableEventSink;
  dead_letter_sink?: DeadLetterSink;
  max_recent_errors?: number;
};

export function buildPierreDiagnosticsReport(
  options: PierreDiagnosticsOptions = {},
): PierreDiagnosticsReport {
  const now = new Date().toISOString();
  const health = buildPierreHealthReport();

  const recentErrors = options.sink
    ? options.sink.list({ severity: "error", limit: options.max_recent_errors ?? 20 }).concat(
        options.sink.list({ severity: "critical" as ObservabilitySeverity, limit: 10 }),
      )
    : [];

  const deadLetters = options.dead_letter_sink
    ? options.dead_letter_sink.list({ resolved: false })
    : [];

  const recentErrorCodes = recentErrors
    .map((e) => e.error_code)
    .filter((c): c is string => !!c);

  const areas: Record<PierreRuntimeArea, AreaStatus> = {} as Record<PierreRuntimeArea, AreaStatus>;
  for (const area of ALL_RUNTIME_AREAS) {
    areas[area] = deriveAreaStatus(area, recentErrorCodes, health.down_services);
  }

  const degraded_reasons: string[] = [];
  for (const service of health.degraded_services) {
    degraded_reasons.push(`Service dégradé : ${service}`);
  }
  for (const service of health.down_services) {
    degraded_reasons.push(`Service hors ligne : ${service}`);
  }
  if (deadLetters.length > 0) {
    degraded_reasons.push(`${deadLetters.length} message(s) en dead-letter non résolus`);
  }

  const errorAreaCount = Object.values(areas).filter((s) => s === "error").length;
  const degradedAreaCount = Object.values(areas).filter((s) => s === "degraded").length;

  let status: "ok" | "degraded" | "critical";
  if (errorAreaCount > 0 || !health.safe_to_operate) status = "critical";
  else if (degradedAreaCount > 0 || degraded_reasons.length > 0) status = "degraded";
  else status = "ok";

  const recommended_actions = buildRunbookForDiagnostics(
    health.down_services,
    health.degraded_services,
    deadLetters.length,
  );

  return {
    generated_at: now,
    status,
    areas,
    recent_errors: recentErrors.slice(0, 20).map((e) => ({
      correlation_id: e.correlation_id,
      domain: e.domain,
      event_type: e.event_type,
      error_code: e.error_code,
      severity: e.severity,
      message: e.message,
      timestamp: e.timestamp,
    })),
    dead_letters: deadLetters.slice(0, 10).map((dl) => ({
      id: dl.id,
      domain: dl.domain,
      error_code: dl.error_code,
      retry_count: dl.retry_count,
      reason: dl.reason,
      created_at: dl.created_at,
    })),
    health_checks: health.checks,
    degraded_reasons,
    recommended_actions,
    safe_to_operate: health.safe_to_operate && status !== "critical",
  };
}

// ── Operate-safely check ──────────────────────────────────────────────────────

export function canPierreOperateSafely(options: PierreDiagnosticsOptions = {}): boolean {
  const report = buildPierreDiagnosticsReport(options);
  return report.safe_to_operate;
}
