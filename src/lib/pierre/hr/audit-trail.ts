// Pierre HR Engine — Audit Trail & Observabilité (Bloc 16)
// Pure module: no Supabase, no Next, no async, no side effects
// Role: unified audit trail — missions, tasks, documents, logs, governance events

// ══════════════════════════════════════════════════════════
// 1. TYPES
// ══════════════════════════════════════════════════════════

export type PierreAuditTrailSource =
  | "mission"
  | "task"
  | "document"
  | "log"
  | "governance"
  | "cloneguard"
  | "clonepolicy"
  | "clonetrust"
  | "continuity"
  | "mission_control"
  | "employee_file"
  | "operational_feed"
  | "system";

export type PierreAuditTrailEventType =
  | "mission_created"
  | "mission_updated"
  | "mission_continued"
  | "mission_completed"
  | "task_created"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "task_blocked"
  | "task_skipped"
  | "task_approved"
  | "task_cancelled"
  | "document_generated"
  | "email_prepared"
  | "email_sent"
  | "governance_evaluated"
  | "governance_blocked"
  | "governance_refused"
  | "cloneguard_evaluated"
  | "clonepolicy_evaluated"
  | "clonetrust_evaluated"
  | "continuity_checked"
  | "run_safe_started"
  | "run_safe_completed"
  | "human_action_required"
  | "employee_file_updated"
  | "message_generated"
  | "system_note"
  | "unknown";

export type PierreAuditTrailRiskLevel = "green" | "orange" | "red" | "black";

export type PierreAuditTrailSeverity =
  | "info"
  | "notice"
  | "warning"
  | "action_required"
  | "blocked"
  | "critical";

export type PierreAuditTrailStatus =
  | "ok"
  | "waiting"
  | "blocked"
  | "failed"
  | "completed"
  | "unknown";

export type PierreAuditTrailEvent = {
  id: string;
  source: PierreAuditTrailSource;
  source_id: string | null;
  event_type: PierreAuditTrailEventType;
  title: string;
  message: string;
  created_at: string | null;
  mission_id: string | null;
  task_id: string | null;
  employee_id: string | null;
  employee_name: string | null;
  risk_level: PierreAuditTrailRiskLevel;
  severity: PierreAuditTrailSeverity;
  status: PierreAuditTrailStatus;
  requires_human: boolean;
  allowed_to_auto_execute: boolean | null;
  governance_decision: string | null;
  cloneguard_decision: string | null;
  clonepolicy_decision: string | null;
  clonetrust_decision: string | null;
  raw: Record<string, unknown>;
};

export type PierreAuditTrailFilter = {
  mission_id?: string | null;
  task_id?: string | null;
  employee_id?: string | null;
  source?: PierreAuditTrailSource | "all" | null;
  severity?: PierreAuditTrailSeverity | "all" | null;
  risk_level?: PierreAuditTrailRiskLevel | "all" | null;
  requires_human?: boolean | null;
  status?: PierreAuditTrailStatus | "all" | null;
  limit?: number | null;
};

export type PierreAuditTrailSectionKey =
  | "critical"
  | "blocked"
  | "human_required"
  | "failed"
  | "governance"
  | "executions"
  | "documents"
  | "messages"
  | "completed"
  | "all";

export type PierreAuditTrailSection = {
  key: PierreAuditTrailSectionKey;
  label: string;
  count: number;
  event_ids: string[];
};

export type PierreAuditTrailDigest = {
  tone: "ok" | "attention" | "blocked" | "critical";
  text: string;
};

export type PierreAuditTrailHealth = {
  score: number;
  label: string;
};

export type PierreAuditTrailDiagnostics = {
  total_events: number;
  critical_count: number;
  blocked_count: number;
  failed_count: number;
  human_required_count: number;
  governance_block_count: number;
  auto_allowed_count: number;
  latest_event_at: string | null;
};

export type PierreAuditTrailTimeline = {
  events: PierreAuditTrailEvent[];
  sections: PierreAuditTrailSection[];
  diagnostics: PierreAuditTrailDiagnostics;
  health: PierreAuditTrailHealth;
  digest: PierreAuditTrailDigest;
};

export type PierreAuditTrailAlert = {
  id: string;
  level: "info" | "warning" | "urgent" | "critical";
  title: string;
  message: string;
  mission_id: string | null;
  task_id: string | null;
  employee_id: string | null;
  created_at: string | null;
};

export type BuildAuditTrailEventsParams = {
  missions?: Record<string, unknown>[] | null;
  tasks?: Record<string, unknown>[] | null;
  documents?: Record<string, unknown>[] | null;
  logs?: Record<string, unknown>[] | null;
  governanceEvaluations?: Array<{
    evaluation: Record<string, unknown>;
    mission_id?: string | null;
    task_id?: string | null;
    employee_id?: string | null;
    created_at?: string | null;
  }> | null;
};

// ══════════════════════════════════════════════════════════
// 2. INTERNAL UTILITIES
// ══════════════════════════════════════════════════════════

function simpleHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function safeMetaJson(row: Record<string, unknown>): Record<string, unknown> {
  try {
    const m = row.meta_json;
    if (isObj(m)) return m;
    if (typeof m === "string") {
      const parsed: unknown = JSON.parse(m);
      return isObj(parsed) ? parsed : {};
    }
    return {};
  } catch {
    return {};
  }
}

function buildDeterministicId(
  source: string,
  source_id: string | null,
  event_type: string,
): string {
  return "at_" + simpleHash(source + ":" + (source_id ?? "") + ":" + event_type);
}

// ══════════════════════════════════════════════════════════
// 3. CONSTANTS
// ══════════════════════════════════════════════════════════

const VALID_SOURCES: ReadonlySet<string> = new Set([
  "mission", "task", "document", "log", "governance",
  "cloneguard", "clonepolicy", "clonetrust", "continuity",
  "mission_control", "employee_file", "operational_feed", "system",
]);

const VALID_EVENT_TYPES: ReadonlySet<string> = new Set([
  "mission_created", "mission_updated", "mission_continued", "mission_completed",
  "task_created", "task_started", "task_completed", "task_failed",
  "task_blocked", "task_skipped", "task_approved", "task_cancelled",
  "document_generated", "email_prepared", "email_sent",
  "governance_evaluated", "governance_blocked", "governance_refused",
  "cloneguard_evaluated", "clonepolicy_evaluated", "clonetrust_evaluated",
  "continuity_checked", "run_safe_started", "run_safe_completed",
  "human_action_required", "employee_file_updated", "message_generated",
  "system_note", "unknown",
]);

const VALID_SEVERITIES: ReadonlySet<string> = new Set([
  "info", "notice", "warning", "action_required", "blocked", "critical",
]);

const VALID_RISK_LEVELS: ReadonlySet<string> = new Set(["green", "orange", "red", "black"]);

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "ok", "waiting", "blocked", "failed", "completed", "unknown",
]);

// Map raw event_type strings from logs to canonical audit event types
const EVENT_TYPE_MAP: Record<string, PierreAuditTrailEventType> = {
  task_execution_started: "task_started",
  task_execution_completed: "task_completed",
  task_execution_failed: "task_failed",
  task_execution_blocked: "task_blocked",
  governance_evaluation: "governance_evaluated",
  governance_execution_blocked: "governance_blocked",
  governance_auto_allowed: "governance_evaluated",
  governance_continuity_blocked: "governance_blocked",
  cloneguard_evaluation: "cloneguard_evaluated",
  cloneguard_blocked: "cloneguard_evaluated",
  clonepolicy_evaluation: "clonepolicy_evaluated",
  clonepolicy_blocked: "clonepolicy_evaluated",
  clonetrust_evaluation: "clonetrust_evaluated",
  clonetrust_hard_block: "clonetrust_evaluated",
  clonetrust_auto_allowed: "clonetrust_evaluated",
  mission_control_run_safe_started: "run_safe_started",
  mission_control_run_safe_completed: "run_safe_completed",
  mission_control_briefing_generated: "governance_evaluated",
  continuity_skipped_governance: "continuity_checked",
  continuity_run_next: "continuity_checked",
  human_action_required: "human_action_required",
  email_draft_created: "email_prepared",
  email_queued: "email_sent",
  document_created: "document_generated",
  employee_file_updated: "employee_file_updated",
  employee_file_accessed: "employee_file_updated",
  message_created: "message_generated",
};

// ══════════════════════════════════════════════════════════
// 4. NORMALIZERS
// ══════════════════════════════════════════════════════════

export function normalizeAuditTrailRiskLevel(value: unknown): PierreAuditTrailRiskLevel {
  if (typeof value !== "string") return "green";
  const t = value.trim().toLowerCase();
  if (t === "black") return "black";
  if (t === "red") return "red";
  if (t === "orange") return "orange";
  if (t === "green") return "green";
  return "green";
}

export function normalizeAuditTrailSeverity(value: unknown): PierreAuditTrailSeverity {
  if (typeof value !== "string") return "info";
  const t = value.trim().toLowerCase();
  if (VALID_SEVERITIES.has(t)) return t as PierreAuditTrailSeverity;
  return "info";
}

export function normalizeAuditTrailSource(value: unknown): PierreAuditTrailSource {
  if (typeof value !== "string") return "system";
  const t = value.trim().toLowerCase();
  if (VALID_SOURCES.has(t)) return t as PierreAuditTrailSource;
  return "system";
}

function normalizeEventType(value: unknown): PierreAuditTrailEventType {
  if (typeof value !== "string") return "unknown";
  const t = value.trim().toLowerCase();
  if (VALID_EVENT_TYPES.has(t)) return t as PierreAuditTrailEventType;
  if (EVENT_TYPE_MAP[t]) return EVENT_TYPE_MAP[t];
  return "unknown";
}

function normalizeStatus(value: unknown): PierreAuditTrailStatus {
  if (typeof value !== "string") return "unknown";
  const t = value.trim().toLowerCase();
  if (VALID_STATUSES.has(t)) return t as PierreAuditTrailStatus;
  if (t === "done") return "completed";
  if (t === "error") return "failed";
  if (t === "running") return "ok";
  if (t === "pending") return "waiting";
  if (t === "awaiting_approval") return "waiting";
  if (t === "awaiting_info") return "waiting";
  return "unknown";
}

// ══════════════════════════════════════════════════════════
// 5. INFERENCE
// ══════════════════════════════════════════════════════════

export function inferAuditTrailEventType(
  row: Record<string, unknown>,
): PierreAuditTrailEventType {
  if (!isObj(row)) return "unknown";

  // Direct event_type from log row
  const direct = asStr(row.event_type);
  if (direct) {
    const normalized = normalizeEventType(direct);
    if (normalized !== "unknown") return normalized;
  }

  // Infer from task/mission status
  const status = asStr(row.status);
  if (status) {
    const s = status.toLowerCase();
    if (s === "done" || s === "completed") return "task_completed";
    if (s === "blocked" || s === "awaiting_approval" || s === "awaiting_info") return "task_blocked";
    if (s === "error" || s === "failed") return "task_failed";
    if (s === "running") return "task_started";
  }

  // Infer from presence of specific fields
  if (isObj(row.doc_type) || asStr(row.doc_type)) return "document_generated";
  if (asStr(row.subject) || Array.isArray(row.to_json)) return "email_prepared";

  // Infer from mission-only fields
  if (asStr(row.mission_summary) || asStr(row.understanding_status)) return "mission_created";

  return "unknown";
}

export function inferAuditTrailSeverity(
  row: Record<string, unknown>,
): PierreAuditTrailSeverity {
  if (!isObj(row)) return "info";

  const meta = safeMetaJson(row);
  const govDecision = asStr(meta.governance_decision) || asStr(meta.decision);
  const cgDecision = asStr(meta.cloneguard_decision) || asStr(meta.guard_decision);
  const policyDecision = asStr(meta.clonepolicy_decision) || asStr(meta.policy_decision);
  const trustDecision = asStr(meta.clonetrust_decision) || asStr(meta.trust_decision);

  if (govDecision === "refuse" || cgDecision === "refuse" || policyDecision === "refuse") {
    return "critical";
  }
  if (
    govDecision === "block" || cgDecision === "block" || policyDecision === "block" ||
    trustDecision === "manual_only"
  ) {
    return "blocked";
  }
  if (
    govDecision === "require_approval" || trustDecision === "approval_required" ||
    asBool(row.approval_required) || asBool(meta.approval_required)
  ) {
    return "action_required";
  }

  const eventType = asStr(row.event_type) ?? "";
  if (
    eventType.includes("refused") || eventType.includes("refuse") ||
    eventType === "governance_refused"
  ) return "critical";
  if (
    eventType.includes("blocked") || eventType.includes("block") ||
    eventType === "governance_blocked" || eventType === "governance_execution_blocked"
  ) return "blocked";
  if (eventType === "human_action_required") return "action_required";

  const status = asStr(row.status) ?? "";
  if (status === "error" || status === "failed") return "warning";
  if (status === "blocked" || status === "awaiting_approval") return "action_required";

  const riskLevel = asStr(row.risk_level) || asStr(meta.risk_level);
  if (riskLevel === "black") return "critical";
  if (riskLevel === "red") return "warning";

  return "info";
}

export function inferAuditTrailRiskLevel(
  row: Record<string, unknown>,
): PierreAuditTrailRiskLevel {
  if (!isObj(row)) return "green";

  const meta = safeMetaJson(row);
  const candidates = [
    asStr(row.risk_level),
    asStr(meta.risk_level),
    asStr(meta.guard_risk_level),
    asStr(meta.governance_risk),
  ].filter(Boolean) as string[];

  let highest: PierreAuditTrailRiskLevel = "green";
  const rank: Record<PierreAuditTrailRiskLevel, number> = { green: 0, orange: 1, red: 2, black: 3 };

  for (const c of candidates) {
    const normalized = normalizeAuditTrailRiskLevel(c);
    if (rank[normalized] > rank[highest]) highest = normalized;
  }

  // Escalate from governance decision
  const govDecision = asStr(meta.governance_decision) || asStr(meta.decision);
  if (govDecision === "refuse" && rank[highest] < rank["black"]) highest = "red";
  if (govDecision === "block" && rank[highest] < rank["red"]) highest = "red";

  return highest;
}

// ══════════════════════════════════════════════════════════
// 6. EVENT NORMALIZER
// ══════════════════════════════════════════════════════════

export function normalizeAuditTrailEvent(
  row: Record<string, unknown>,
  sourceHint?: PierreAuditTrailSource,
): PierreAuditTrailEvent {
  if (!isObj(row)) {
    return {
      id: buildDeterministicId("system", null, "unknown"),
      source: "system",
      source_id: null,
      event_type: "unknown",
      title: "Événement inconnu",
      message: "Données manquantes ou malformées.",
      created_at: null,
      mission_id: null,
      task_id: null,
      employee_id: null,
      employee_name: null,
      risk_level: "green",
      severity: "info",
      status: "unknown",
      requires_human: false,
      allowed_to_auto_execute: null,
      governance_decision: null,
      cloneguard_decision: null,
      clonepolicy_decision: null,
      clonetrust_decision: null,
      raw: {},
    };
  }

  const meta = safeMetaJson(row);
  const source = sourceHint ?? normalizeAuditTrailSource(row.source);
  const source_id = asStr(row.id) ?? asStr(row.source_id);
  const event_type = inferAuditTrailEventType(row);
  const severity = inferAuditTrailSeverity(row);
  const risk_level = inferAuditTrailRiskLevel(row);

  const mission_id = asStr(row.mission_id) ?? asStr(meta.mission_id);
  const task_id = asStr(row.task_id) ?? asStr(meta.task_id);
  const employee_id =
    asStr(row.employee_id) ??
    asStr(meta.employee_id) ??
    asStr(meta.employee_context_id);
  const employee_name = asStr(row.employee_name) ?? asStr(meta.employee_name);

  const rawTitle =
    asStr(row.title) ??
    asStr(row.mission_summary) ??
    asStr(row.message) ??
    asStr(row.doc_type) ??
    asStr(row.type) ??
    "";
  const title = rawTitle || "Événement Pierre";

  const rawMessage =
    asStr(row.message) ??
    asStr(row.explanation) ??
    asStr(row.human_note) ??
    asStr(meta.message) ??
    "";
  const message = rawMessage || title;

  const govDecision =
    asStr(meta.governance_decision) ??
    asStr(meta.decision) ??
    asStr(row.governance_decision);
  const cgDecision =
    asStr(meta.cloneguard_decision) ??
    asStr(meta.guard_decision) ??
    asStr(row.cloneguard_decision);
  const policyDecision =
    asStr(meta.clonepolicy_decision) ??
    asStr(meta.policy_decision) ??
    asStr(row.clonepolicy_decision);
  const trustDecision =
    asStr(meta.clonetrust_decision) ??
    asStr(meta.trust_decision) ??
    asStr(row.clonetrust_decision);

  const rawRequiresHuman =
    row.requires_human === true ||
    meta.requires_human === true ||
    severity === "action_required" ||
    severity === "blocked" ||
    severity === "critical";

  const rawAutoExec =
    row.allowed_to_auto_execute === true || meta.allowed_to_auto_execute === true
      ? true
      : row.allowed_to_auto_execute === false || meta.allowed_to_auto_execute === false
        ? false
        : null;

  const status = normalizeStatus(asStr(row.status));
  const created_at = asStr(row.created_at);

  const id = buildDeterministicId(source, source_id, event_type);

  return {
    id,
    source,
    source_id,
    event_type,
    title,
    message,
    created_at,
    mission_id,
    task_id,
    employee_id,
    employee_name,
    risk_level,
    severity,
    status,
    requires_human: rawRequiresHuman,
    allowed_to_auto_execute: rawAutoExec,
    governance_decision: govDecision,
    cloneguard_decision: cgDecision,
    clonepolicy_decision: policyDecision,
    clonetrust_decision: trustDecision,
    raw: row,
  };
}

// ══════════════════════════════════════════════════════════
// 7. BUILD EVENTS FROM MULTIPLE SOURCES
// ══════════════════════════════════════════════════════════

function eventsFromMissions(missions: Record<string, unknown>[]): PierreAuditTrailEvent[] {
  const out: PierreAuditTrailEvent[] = [];
  for (const m of missions) {
    if (!isObj(m)) continue;
    try {
      const status = asStr(m.status) ?? "";
      let event_type: PierreAuditTrailEventType = "mission_created";
      if (status === "done" || status === "completed") event_type = "mission_completed";
      else if (status === "running") event_type = "mission_continued";

      const source_id = asStr(m.id);
      const title = asStr(m.mission_summary) ?? asStr(m.intent) ?? "Mission";
      const id = buildDeterministicId("mission", source_id, event_type);
      const risk_level = normalizeAuditTrailRiskLevel(m.risk_level);
      const isApprovalRequired = asBool(m.approval_required);
      const severity: PierreAuditTrailSeverity = isApprovalRequired ? "action_required" : "info";

      out.push({
        id,
        source: "mission",
        source_id,
        event_type,
        title,
        message: title,
        created_at: asStr(m.created_at),
        mission_id: source_id,
        task_id: null,
        employee_id: null,
        employee_name: null,
        risk_level,
        severity,
        status: normalizeStatus(status),
        requires_human: isApprovalRequired || risk_level === "red" || risk_level === "black",
        allowed_to_auto_execute: null,
        governance_decision: null,
        cloneguard_decision: null,
        clonepolicy_decision: null,
        clonetrust_decision: null,
        raw: m,
      });
    } catch {
      // skip malformed row
    }
  }
  return out;
}

function eventsFromTasks(tasks: Record<string, unknown>[]): PierreAuditTrailEvent[] {
  const out: PierreAuditTrailEvent[] = [];
  for (const t of tasks) {
    if (!isObj(t)) continue;
    try {
      const status = asStr(t.status) ?? "";
      let event_type: PierreAuditTrailEventType = "task_created";
      const sl = status.toLowerCase();
      if (sl === "done" || sl === "completed") event_type = "task_completed";
      else if (sl === "error" || sl === "failed") event_type = "task_failed";
      else if (sl === "blocked" || sl === "awaiting_info") event_type = "task_blocked";
      else if (sl === "awaiting_approval") event_type = "task_blocked";
      else if (sl === "running") event_type = "task_started";
      else if (sl === "cancelled") event_type = "task_cancelled";

      const source_id = asStr(t.id);
      const title = asStr(t.title) ?? asStr(t.type) ?? "Tâche";
      const id = buildDeterministicId("task", source_id, event_type);
      const risk_level = normalizeAuditTrailRiskLevel(t.risk_level);
      const isApprovalRequired = asBool(t.approval_required);
      const taskType = (asStr(t.type) ?? "").toLowerCase();
      const isSensitiveTask = taskType === "email.send" || taskType === "send_email";

      let severity: PierreAuditTrailSeverity = "info";
      if (sl === "error" || sl === "failed") severity = "warning";
      else if (sl === "blocked" || isApprovalRequired || isSensitiveTask) severity = "action_required";
      else if (risk_level === "black") severity = "critical";
      else if (risk_level === "red") severity = "warning";

      out.push({
        id,
        source: "task",
        source_id,
        event_type,
        title,
        message: title,
        created_at: asStr(t.created_at),
        mission_id: asStr(t.mission_id),
        task_id: source_id,
        employee_id: null,
        employee_name: null,
        risk_level,
        severity,
        status: normalizeStatus(status),
        requires_human: isApprovalRequired || isSensitiveTask || risk_level === "red" || risk_level === "black",
        allowed_to_auto_execute: null,
        governance_decision: null,
        cloneguard_decision: null,
        clonepolicy_decision: null,
        clonetrust_decision: null,
        raw: t,
      });
    } catch {
      // skip malformed row
    }
  }
  return out;
}

function eventsFromDocuments(documents: Record<string, unknown>[]): PierreAuditTrailEvent[] {
  const out: PierreAuditTrailEvent[] = [];
  for (const d of documents) {
    if (!isObj(d)) continue;
    try {
      const source_id = asStr(d.id);
      const title = asStr(d.title) ?? asStr(d.doc_type) ?? "Document";
      const id = buildDeterministicId("document", source_id, "document_generated");

      out.push({
        id,
        source: "document",
        source_id,
        event_type: "document_generated",
        title,
        message: `Document généré : ${title}`,
        created_at: asStr(d.created_at),
        mission_id: asStr(d.mission_id),
        task_id: asStr(d.task_id),
        employee_id: null,
        employee_name: null,
        risk_level: "green",
        severity: "info",
        status: "completed",
        requires_human: false,
        allowed_to_auto_execute: null,
        governance_decision: null,
        cloneguard_decision: null,
        clonepolicy_decision: null,
        clonetrust_decision: null,
        raw: d,
      });
    } catch {
      // skip malformed row
    }
  }
  return out;
}

function eventsFromLogs(logs: Record<string, unknown>[]): PierreAuditTrailEvent[] {
  const out: PierreAuditTrailEvent[] = [];
  for (const l of logs) {
    if (!isObj(l)) continue;
    try {
      const source_id = asStr(l.id);
      const event_type = inferAuditTrailEventType(l);
      const id = buildDeterministicId("log", source_id, event_type);
      const meta = safeMetaJson(l);

      const severity = inferAuditTrailSeverity(l);
      const risk_level = inferAuditTrailRiskLevel(l);

      const govDecision = asStr(meta.governance_decision) ?? asStr(meta.decision);
      const cgDecision = asStr(meta.cloneguard_decision) ?? asStr(meta.guard_decision);
      const policyDecision = asStr(meta.clonepolicy_decision) ?? asStr(meta.policy_decision);
      const trustDecision = asStr(meta.clonetrust_decision) ?? asStr(meta.trust_decision);

      const requiresHuman =
        severity === "action_required" ||
        severity === "blocked" ||
        severity === "critical" ||
        asBool(meta.requires_human);

      const autoExec =
        meta.allowed_to_auto_execute === true
          ? true
          : meta.allowed_to_auto_execute === false
            ? false
            : null;

      out.push({
        id,
        source: "log",
        source_id,
        event_type,
        title: asStr(l.message) ?? event_type,
        message: asStr(l.message) ?? "Événement journalisé.",
        created_at: asStr(l.created_at),
        mission_id: asStr(l.mission_id) ?? asStr(meta.mission_id),
        task_id: asStr(l.task_id) ?? asStr(meta.task_id),
        employee_id: asStr(meta.employee_id),
        employee_name: asStr(meta.employee_name),
        risk_level,
        severity,
        status: "ok",
        requires_human: requiresHuman,
        allowed_to_auto_execute: autoExec,
        governance_decision: govDecision,
        cloneguard_decision: cgDecision,
        clonepolicy_decision: policyDecision,
        clonetrust_decision: trustDecision,
        raw: l,
      });
    } catch {
      // skip malformed row
    }
  }
  return out;
}

function eventsFromGovernanceEvals(
  evals: NonNullable<BuildAuditTrailEventsParams["governanceEvaluations"]>,
): PierreAuditTrailEvent[] {
  const out: PierreAuditTrailEvent[] = [];
  for (const entry of evals) {
    if (!isObj(entry) || !isObj(entry.evaluation)) continue;
    try {
      const ev = entry.evaluation;
      const decision = asStr(ev.decision) ?? "unknown";

      let event_type: PierreAuditTrailEventType = "governance_evaluated";
      if (decision === "refuse") event_type = "governance_refused";
      else if (decision === "block") event_type = "governance_blocked";

      const mission_id = asStr(entry.mission_id) ?? null;
      const task_id = asStr(entry.task_id) ?? null;
      const employee_id = asStr(entry.employee_id) ?? null;
      const source_id = mission_id ?? task_id ?? "eval";
      const id = buildDeterministicId("governance", source_id, event_type);

      const govDecision = decision;
      const cgDecision = asStr(ev.guard_decision);
      const policyDecision = asStr(ev.policy_decision);
      const trustDecision = asStr(ev.trust_decision);

      const riskLevel = normalizeAuditTrailRiskLevel(ev.risk_level);

      let severity: PierreAuditTrailSeverity = "info";
      if (decision === "refuse") severity = "critical";
      else if (decision === "block") severity = "blocked";
      else if (decision === "require_approval") severity = "action_required";
      else if (decision === "supervised") severity = "notice";
      else if (decision === "allow_with_warning") severity = "warning";

      const requiresHuman =
        decision === "refuse" ||
        decision === "block" ||
        decision === "require_approval" ||
        ev.requires_human === true;

      const autoExec =
        ev.allowed_to_auto_execute === true
          ? true
          : ev.allowed_to_auto_execute === false
            ? false
            : null;

      out.push({
        id,
        source: "governance",
        source_id,
        event_type,
        title: `Gouvernance: ${decision}`,
        message: asStr(ev.explanation) ?? `Décision gouvernance: ${decision}`,
        created_at: asStr(entry.created_at),
        mission_id,
        task_id,
        employee_id,
        employee_name: null,
        risk_level: riskLevel,
        severity,
        status: decision === "allow" ? "ok" : "waiting",
        requires_human: requiresHuman,
        allowed_to_auto_execute: autoExec,
        governance_decision: govDecision,
        cloneguard_decision: cgDecision,
        clonepolicy_decision: policyDecision,
        clonetrust_decision: trustDecision,
        raw: entry as unknown as Record<string, unknown>,
      });
    } catch {
      // skip malformed row
    }
  }
  return out;
}

function deduplicateEvents(events: PierreAuditTrailEvent[]): PierreAuditTrailEvent[] {
  // Keep only the most recent event per (source, source_id, event_type)
  const map = new Map<string, PierreAuditTrailEvent>();
  for (const e of events) {
    const key = `${e.source}:${e.source_id ?? "null"}:${e.event_type}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, e);
    } else {
      // Keep most recent (later created_at wins)
      const existingTs = existing.created_at ? new Date(existing.created_at).getTime() : -1;
      const newTs = e.created_at ? new Date(e.created_at).getTime() : -1;
      if (newTs > existingTs) map.set(key, e);
    }
  }
  return Array.from(map.values());
}

function sortEventsByDateDesc(events: PierreAuditTrailEvent[]): PierreAuditTrailEvent[] {
  return [...events].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : -1;
    const tb = b.created_at ? new Date(b.created_at).getTime() : -1;
    if (ta === -1 && tb === -1) return 0;
    if (ta === -1) return 1;  // nulls at end
    if (tb === -1) return -1;
    return tb - ta; // DESC
  });
}

export function buildAuditTrailEvents(
  params: BuildAuditTrailEventsParams,
): PierreAuditTrailEvent[] {
  if (!isObj(params)) return [];

  const allEvents: PierreAuditTrailEvent[] = [];

  try {
    if (Array.isArray(params.missions)) {
      allEvents.push(...eventsFromMissions(params.missions));
    }
  } catch { /* skip */ }

  try {
    if (Array.isArray(params.tasks)) {
      allEvents.push(...eventsFromTasks(params.tasks));
    }
  } catch { /* skip */ }

  try {
    if (Array.isArray(params.documents)) {
      allEvents.push(...eventsFromDocuments(params.documents));
    }
  } catch { /* skip */ }

  try {
    if (Array.isArray(params.logs)) {
      allEvents.push(...eventsFromLogs(params.logs));
    }
  } catch { /* skip */ }

  try {
    if (Array.isArray(params.governanceEvaluations)) {
      allEvents.push(...eventsFromGovernanceEvals(params.governanceEvaluations));
    }
  } catch { /* skip */ }

  const deduped = deduplicateEvents(allEvents);
  return sortEventsByDateDesc(deduped);
}

// ══════════════════════════════════════════════════════════
// 8. FILTER
// ══════════════════════════════════════════════════════════

export function filterAuditTrailEvents(
  events: PierreAuditTrailEvent[],
  filter: PierreAuditTrailFilter,
): PierreAuditTrailEvent[] {
  if (!Array.isArray(events)) return [];
  if (!isObj(filter)) return events;

  let result = events;

  if (filter.mission_id != null && filter.mission_id !== "") {
    result = result.filter((e) => e.mission_id === filter.mission_id);
  }
  if (filter.task_id != null && filter.task_id !== "") {
    result = result.filter((e) => e.task_id === filter.task_id);
  }
  if (filter.employee_id != null && filter.employee_id !== "") {
    result = result.filter((e) => e.employee_id === filter.employee_id);
  }
  if (filter.source != null && filter.source !== "all") {
    result = result.filter((e) => e.source === filter.source);
  }
  if (filter.severity != null && filter.severity !== "all") {
    result = result.filter((e) => e.severity === filter.severity);
  }
  if (filter.risk_level != null && filter.risk_level !== "all") {
    result = result.filter((e) => e.risk_level === filter.risk_level);
  }
  if (filter.requires_human != null) {
    result = result.filter((e) => e.requires_human === filter.requires_human);
  }
  if (filter.status != null && filter.status !== "all") {
    result = result.filter((e) => e.status === filter.status);
  }

  const limit = typeof filter.limit === "number" && filter.limit > 0 ? filter.limit : null;
  if (limit !== null) {
    result = result.slice(0, limit);
  }

  return result;
}

// ══════════════════════════════════════════════════════════
// 9. SECTIONS
// ══════════════════════════════════════════════════════════

export function buildAuditTrailSections(
  events: PierreAuditTrailEvent[],
): PierreAuditTrailSection[] {
  if (!Array.isArray(events)) return [];

  const sections: Array<{
    key: PierreAuditTrailSectionKey;
    label: string;
    predicate: (e: PierreAuditTrailEvent) => boolean;
  }> = [
    {
      key: "critical",
      label: "Critique",
      predicate: (e) => e.severity === "critical",
    },
    {
      key: "blocked",
      label: "Bloqué",
      predicate: (e) => e.severity === "blocked" || e.status === "blocked",
    },
    {
      key: "human_required",
      label: "Action humaine requise",
      predicate: (e) => e.requires_human === true && e.severity !== "critical" && e.severity !== "blocked",
    },
    {
      key: "failed",
      label: "Échec",
      predicate: (e) => e.status === "failed" || e.event_type === "task_failed",
    },
    {
      key: "governance",
      label: "Gouvernance",
      predicate: (e) =>
        e.source === "governance" ||
        e.source === "cloneguard" ||
        e.source === "clonepolicy" ||
        e.source === "clonetrust" ||
        e.event_type.startsWith("governance_") ||
        e.event_type.startsWith("cloneguard_") ||
        e.event_type.startsWith("clonepolicy_") ||
        e.event_type.startsWith("clonetrust_"),
    },
    {
      key: "executions",
      label: "Exécutions",
      predicate: (e) =>
        e.event_type === "task_started" ||
        e.event_type === "task_completed" ||
        e.event_type === "run_safe_started" ||
        e.event_type === "run_safe_completed",
    },
    {
      key: "documents",
      label: "Documents",
      predicate: (e) => e.source === "document" || e.event_type === "document_generated",
    },
    {
      key: "messages",
      label: "Messages",
      predicate: (e) =>
        e.event_type === "email_prepared" ||
        e.event_type === "email_sent" ||
        e.event_type === "message_generated",
    },
    {
      key: "completed",
      label: "Complété",
      predicate: (e) =>
        e.status === "completed" &&
        e.severity !== "critical" &&
        e.severity !== "blocked",
    },
    {
      key: "all",
      label: "Tous",
      predicate: () => true,
    },
  ];

  return sections.map(({ key, label, predicate }) => {
    const matching = events.filter(predicate);
    return {
      key,
      label,
      count: matching.length,
      event_ids: matching.map((e) => e.id),
    };
  });
}

// ══════════════════════════════════════════════════════════
// 10. DIAGNOSTICS
// ══════════════════════════════════════════════════════════

export function buildAuditTrailDiagnostics(
  events: PierreAuditTrailEvent[],
): PierreAuditTrailDiagnostics {
  if (!Array.isArray(events)) {
    return {
      total_events: 0,
      critical_count: 0,
      blocked_count: 0,
      failed_count: 0,
      human_required_count: 0,
      governance_block_count: 0,
      auto_allowed_count: 0,
      latest_event_at: null,
    };
  }

  let critical_count = 0;
  let blocked_count = 0;
  let failed_count = 0;
  let human_required_count = 0;
  let governance_block_count = 0;
  let auto_allowed_count = 0;
  let latest_event_at: string | null = null;
  let latestTs = -1;

  for (const e of events) {
    if (e.severity === "critical") critical_count++;
    if (e.severity === "blocked" || e.status === "blocked") blocked_count++;
    if (e.status === "failed" || e.event_type === "task_failed") failed_count++;
    if (e.requires_human) human_required_count++;
    if (
      e.event_type === "governance_blocked" ||
      e.event_type === "governance_refused" ||
      e.governance_decision === "block" ||
      e.governance_decision === "refuse"
    ) governance_block_count++;
    if (e.allowed_to_auto_execute === true) auto_allowed_count++;

    if (e.created_at) {
      try {
        const ts = new Date(e.created_at).getTime();
        if (ts > latestTs) {
          latestTs = ts;
          latest_event_at = e.created_at;
        }
      } catch {
        // skip bad date
      }
    }
  }

  return {
    total_events: events.length,
    critical_count,
    blocked_count,
    failed_count,
    human_required_count,
    governance_block_count,
    auto_allowed_count,
    latest_event_at,
  };
}

// ══════════════════════════════════════════════════════════
// 11. HEALTH SCORE
// ══════════════════════════════════════════════════════════

export function scoreAuditTrailHealth(
  events: PierreAuditTrailEvent[],
): PierreAuditTrailHealth {
  if (!Array.isArray(events) || events.length === 0) {
    return { score: 100, label: "Aucune donnée" };
  }

  const diag = buildAuditTrailDiagnostics(events);
  const total = diag.total_events;
  if (total === 0) return { score: 100, label: "OK" };

  let penalty = 0;
  penalty += diag.critical_count * 20;
  penalty += diag.governance_block_count * 15;
  penalty += diag.blocked_count * 10;
  penalty += diag.failed_count * 8;
  penalty += diag.human_required_count * 3;

  const score = Math.max(0, Math.min(100, 100 - penalty));

  let label: string;
  if (score >= 90) label = "Excellent";
  else if (score >= 75) label = "Bon";
  else if (score >= 55) label = "Attention";
  else if (score >= 30) label = "Dégradé";
  else label = "Critique";

  return { score, label };
}

// ══════════════════════════════════════════════════════════
// 12. DIGEST
// ══════════════════════════════════════════════════════════

export function buildAuditTrailDigest(
  events: PierreAuditTrailEvent[],
): PierreAuditTrailDigest {
  if (!Array.isArray(events) || events.length === 0) {
    return { tone: "ok", text: "Aucun événement dans l'audit trail." };
  }

  const diag = buildAuditTrailDiagnostics(events);

  if (diag.critical_count > 0) {
    return {
      tone: "critical",
      text: `${diag.critical_count} événement(s) critique(s) détecté(s). Intervention humaine requise.`,
    };
  }

  if (diag.governance_block_count > 0 || diag.blocked_count > 0) {
    const blockTotal = Math.max(diag.governance_block_count, diag.blocked_count);
    return {
      tone: "blocked",
      text: `${blockTotal} blocage(s) gouvernance. ${diag.human_required_count} action(s) humaine(s) en attente.`,
    };
  }

  if (diag.human_required_count > 0 || diag.failed_count > 0) {
    return {
      tone: "attention",
      text: `${diag.human_required_count} validation(s) requise(s), ${diag.failed_count} échec(s).`,
    };
  }

  if (diag.auto_allowed_count > 0) {
    return {
      tone: "ok",
      text: `${diag.auto_allowed_count} tâche(s) auto-exécutée(s). Aucun blocage détecté.`,
    };
  }

  return {
    tone: "ok",
    text: `${diag.total_events} événement(s) enregistré(s). Aucune anomalie détectée.`,
  };
}

// ══════════════════════════════════════════════════════════
// 13. TIMELINE
// ══════════════════════════════════════════════════════════

export function buildAuditTrailTimeline(
  events: PierreAuditTrailEvent[],
  filter?: PierreAuditTrailFilter,
): PierreAuditTrailTimeline {
  if (!Array.isArray(events)) {
    const empty = buildAuditTrailDiagnostics([]);
    return {
      events: [],
      sections: buildAuditTrailSections([]),
      diagnostics: empty,
      health: scoreAuditTrailHealth([]),
      digest: buildAuditTrailDigest([]),
    };
  }

  const filtered = filter ? filterAuditTrailEvents(events, filter) : events;

  return {
    events: filtered,
    sections: buildAuditTrailSections(filtered),
    diagnostics: buildAuditTrailDiagnostics(filtered),
    health: scoreAuditTrailHealth(filtered),
    digest: buildAuditTrailDigest(filtered),
  };
}

// ══════════════════════════════════════════════════════════
// 14. ALERTS
// ══════════════════════════════════════════════════════════

export function buildAuditTrailAlerts(
  events: PierreAuditTrailEvent[],
): PierreAuditTrailAlert[] {
  if (!Array.isArray(events)) return [];

  const alerts: PierreAuditTrailAlert[] = [];
  const PRIORITY_EVENTS = new Set<PierreAuditTrailEventType>([
    "governance_refused",
    "governance_blocked",
    "task_failed",
    "task_blocked",
    "human_action_required",
  ]);

  for (const e of events) {
    if (
      e.severity === "critical" ||
      e.severity === "blocked" ||
      e.severity === "action_required" ||
      PRIORITY_EVENTS.has(e.event_type) ||
      e.risk_level === "black" ||
      e.risk_level === "red"
    ) {
      let level: PierreAuditTrailAlert["level"] = "info";
      if (e.severity === "critical" || e.risk_level === "black") level = "critical";
      else if (e.severity === "blocked") level = "urgent";
      else if (e.severity === "action_required" || e.severity === "warning" || e.risk_level === "red") level = "warning";

      const alertId = "alr_" + simpleHash(e.id + level);

      alerts.push({
        id: alertId,
        level,
        title: e.title || e.event_type,
        message: e.message,
        mission_id: e.mission_id,
        task_id: e.task_id,
        employee_id: e.employee_id,
        created_at: e.created_at,
      });
    }
  }

  // Sort: critical first, then urgent, then warning, then info
  const levelRank: Record<PierreAuditTrailAlert["level"], number> = {
    critical: 3, urgent: 2, warning: 1, info: 0,
  };
  return alerts.sort((a, b) => levelRank[b.level] - levelRank[a.level]);
}

// ══════════════════════════════════════════════════════════
// 15. SUMMARIZE EVENT
// ══════════════════════════════════════════════════════════

export function summarizeAuditTrailEvent(event: PierreAuditTrailEvent): string {
  if (!event || typeof event !== "object") return "Événement inconnu.";

  const severityLabels: Record<PierreAuditTrailSeverity, string> = {
    critical: "CRITIQUE",
    blocked: "BLOQUÉ",
    action_required: "ACTION REQUISE",
    warning: "AVERTISSEMENT",
    notice: "NOTICE",
    info: "INFO",
  };

  const parts: string[] = [
    `[${severityLabels[event.severity] ?? event.severity}]`,
    event.title || event.event_type,
  ];

  if (event.governance_decision) parts.push(`| Gouvernance: ${event.governance_decision}`);
  if (event.mission_id) parts.push(`| Mission: ${event.mission_id.slice(0, 8)}`);
  if (event.requires_human) parts.push("| Humain requis");
  if (event.created_at) {
    try {
      parts.push(`| ${new Date(event.created_at).toISOString().slice(0, 16).replace("T", " ")}`);
    } catch {
      // skip bad date
    }
  }

  return parts.join(" ");
}

// ══════════════════════════════════════════════════════════
// 16. EXPORT
// ══════════════════════════════════════════════════════════

export function buildAuditTrailExport(
  events: PierreAuditTrailEvent[],
): Record<string, unknown> {
  if (!Array.isArray(events)) {
    return {
      generated_at: "",
      total_events: 0,
      events: [],
      alerts: [],
      diagnostics: buildAuditTrailDiagnostics([]),
      health: scoreAuditTrailHealth([]),
      digest: buildAuditTrailDigest([]),
    };
  }

  const diag = buildAuditTrailDiagnostics(events);
  const health = scoreAuditTrailHealth(events);
  const digest = buildAuditTrailDigest(events);
  const alerts = buildAuditTrailAlerts(events);

  const exportEvents = events.map((e) => ({
    id: e.id,
    source: e.source,
    source_id: e.source_id,
    event_type: e.event_type,
    title: e.title,
    message: e.message,
    created_at: e.created_at,
    mission_id: e.mission_id,
    task_id: e.task_id,
    employee_id: e.employee_id,
    risk_level: e.risk_level,
    severity: e.severity,
    status: e.status,
    requires_human: e.requires_human,
    allowed_to_auto_execute: e.allowed_to_auto_execute,
    governance_decision: e.governance_decision,
    cloneguard_decision: e.cloneguard_decision,
    clonepolicy_decision: e.clonepolicy_decision,
    clonetrust_decision: e.clonetrust_decision,
  }));

  return {
    generated_at: new Date().toISOString(),
    total_events: events.length,
    events: exportEvents,
    alerts,
    diagnostics: diag,
    health,
    digest,
  };
}

// ══════════════════════════════════════════════════════════
// 17. SNAPSHOT
// ══════════════════════════════════════════════════════════

export function buildAuditTrailSnapshot(
  timeline: PierreAuditTrailTimeline,
): Record<string, unknown> {
  if (!timeline || typeof timeline !== "object") {
    return {
      snapshot_at: "",
      total_events: 0,
      health_score: 100,
      health_label: "Aucune donnée",
      digest_tone: "ok",
      digest_text: "",
      critical_count: 0,
      blocked_count: 0,
      human_required_count: 0,
      latest_event_at: null,
      sections_summary: [],
    };
  }

  const nonEmptySections = (timeline.sections ?? [])
    .filter((s) => s.count > 0 && s.key !== "all")
    .map((s) => ({ key: s.key, label: s.label, count: s.count }));

  return {
    snapshot_at: new Date().toISOString(),
    total_events: timeline.diagnostics?.total_events ?? 0,
    health_score: timeline.health?.score ?? 0,
    health_label: timeline.health?.label ?? "",
    digest_tone: timeline.digest?.tone ?? "ok",
    digest_text: timeline.digest?.text ?? "",
    critical_count: timeline.diagnostics?.critical_count ?? 0,
    blocked_count: timeline.diagnostics?.blocked_count ?? 0,
    human_required_count: timeline.diagnostics?.human_required_count ?? 0,
    governance_block_count: timeline.diagnostics?.governance_block_count ?? 0,
    auto_allowed_count: timeline.diagnostics?.auto_allowed_count ?? 0,
    latest_event_at: timeline.diagnostics?.latest_event_at ?? null,
    sections_summary: nonEmptySections,
  };
}
