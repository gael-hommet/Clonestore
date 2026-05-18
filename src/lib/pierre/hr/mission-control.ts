// ═══════════════════════════════════════════════════════════
// Pierre HR Engine — Mission Control / Daily Command Center
// Bloc 13 — Centre de pilotage opérationnel
// Module pur : pas de Supabase, pas de Next, pas d'async
// ═══════════════════════════════════════════════════════════

import type { PierreEmployeeFileSnapshot } from "./employee-file";
import type { PierreOperationalFeedItem } from "./operational-feed";
import type { PierreContinuityDashboard } from "./continuity";

// ── Helpers internes ──────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true" || v === "1";
}

function lowerText(v: unknown): string {
  const s = asString(v);
  return s ? s.toLowerCase() : "";
}

function normalizeText(v: unknown): string {
  const s = asString(v);
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeRowText(row: Record<string, unknown>): string {
  const directFields = [
    "title", "mission_summary", "message", "text_content", "description",
    "subject", "intent", "event_type", "doc_type", "type", "employee_name",
  ];
  const parts: string[] = [];
  for (const f of directFields) {
    const v = asString(row[f]);
    if (v) parts.push(v);
  }
  const nestedFields = ["brain_output_json", "meta_json", "context_snapshot_json"];
  for (const f of nestedFields) {
    if (!isObject(row[f])) continue;
    const nested = row[f] as Record<string, unknown>;
    for (const k of ["title", "summary", "intent", "domain", "message"]) {
      const v = asString(nested[k]);
      if (v) parts.push(v);
    }
  }
  return parts.join(" ");
}

function simpleHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (((h << 5) + h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function pickFirst(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = asString(row[k]);
    if (v) return v;
  }
  return null;
}

function extractEmployeeId(row: Record<string, unknown>): string | null {
  const direct = asString(row.employee_id);
  if (direct) return direct;
  const nested = ["brain_output_json", "context_snapshot_json", "meta_json"];
  for (const key of nested) {
    if (!isObject(row[key])) continue;
    const n = row[key] as Record<string, unknown>;
    const v = asString(n.employee_id);
    if (v) return v;
    if (isObject(n.employee_context)) {
      const ec = n.employee_context as Record<string, unknown>;
      const ev = asString(ec.employee_id);
      if (ev) return ev;
    }
  }
  return null;
}

function extractExecuteAt(row: Record<string, unknown>): string | null {
  return asString(row.execute_at) ?? null;
}

// ── Constantes de sécurité ────────────────────────────────

const BLOCKED_TASK_TYPES = new Set(["email.send", "send_email"]);
const SAFE_RUN_STATUSES = new Set(["ready", "retry"]);
const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const NON_EXECUTABLE_STATUSES = new Set(["done", "cancelled", "error", "awaiting_approval"]);
const SENSITIVE_KEYWORDS = /harcel|licenci|disciplin|faute.?grave|judiciaire|prudhomm|discrimin|agress|offboarding|critiqu/;

const PRIORITY_ORDER: Record<PierreMissionControlPriority, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
  low: 0,
};

const QUEUE_LABELS: Record<PierreMissionControlQueueKey, string> = {
  do_now: "À faire maintenant",
  safe_to_run: "Prêtes à exécuter",
  approvals: "En attente d'approbation",
  blocked: "Bloquées",
  errors: "En erreur",
  sensitive: "Cas sensibles",
  deliveries: "Livraisons disponibles",
  scheduled: "Planifiées",
  waiting_info: "En attente d'information",
  employee_attention: "Dossiers salariés à traiter",
  monitoring: "Surveillance",
};

const QUEUE_DESCRIPTIONS: Record<PierreMissionControlQueueKey, string> = {
  do_now: "Actions urgentes nécessitant une intervention immédiate",
  safe_to_run: "Tâches prêtes à être lancées automatiquement sans risque",
  approvals: "Tâches nécessitant une validation humaine explicite",
  blocked: "Tâches bloquées en attente de déblocage",
  errors: "Tâches en erreur nécessitant investigation",
  sensitive: "Situations RH sensibles nécessitant revue humaine",
  deliveries: "Documents, contrats, rapports disponibles",
  scheduled: "Tâches planifiées pour exécution future",
  waiting_info: "Missions ou tâches en attente d'informations complémentaires",
  employee_attention: "Dossiers salariés nécessitant attention ou mise à jour",
  monitoring: "Éléments actifs sous surveillance normale",
};

// ── Types exportés ────────────────────────────────────────

export type PierreMissionControlStatus =
  | "clear"
  | "active"
  | "attention_required"
  | "blocked"
  | "sensitive";

export type PierreMissionControlPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type PierreMissionControlQueueKey =
  | "do_now"
  | "safe_to_run"
  | "approvals"
  | "blocked"
  | "errors"
  | "sensitive"
  | "deliveries"
  | "scheduled"
  | "waiting_info"
  | "employee_attention"
  | "monitoring";

export type PierreMissionControlActionType =
  | "run_safe_task"
  | "approve_task"
  | "review_sensitive_case"
  | "resolve_blocker"
  | "investigate_error"
  | "open_delivery"
  | "open_mission"
  | "open_employee_file"
  | "prepare_followup"
  | "generate_briefing"
  | "wait_until_scheduled"
  | "no_action";

export type PierreMissionControlSourceType =
  | "mission"
  | "task"
  | "document"
  | "log"
  | "employee_file"
  | "continuity"
  | "feed"
  | "system";

export type PierreMissionControlAction = {
  id: string;
  type: PierreMissionControlActionType;
  label: string;
  description: string;
  priority: PierreMissionControlPriority;
  queue: PierreMissionControlQueueKey;
  source_type: PierreMissionControlSourceType;
  source_id: string | null;
  mission_id: string | null;
  task_id: string | null;
  employee_id: string | null;
  document_id: string | null;
  action_required: boolean;
  requires_human: boolean;
  is_safe_to_run: boolean;
  is_sensitive: boolean;
  is_blocking: boolean;
  is_delivery: boolean;
  execute_at: string | null;
  href: string | null;
  method: "GET" | "POST" | "PATCH" | "DELETE" | null;
  payload: Record<string, unknown> | null;
  reason: string;
  created_at: string | null;
  raw?: Record<string, unknown>;
};

export type PierreMissionControlQueue = {
  key: PierreMissionControlQueueKey;
  label: string;
  description: string;
  count: number;
  urgent_count: number;
  high_count: number;
  actions: PierreMissionControlAction[];
};

export type PierreMissionControlMetric = {
  key: string;
  label: string;
  value: number;
  severity: "neutral" | "good" | "warning" | "danger";
};

export type PierreMissionControlMissionCard = {
  mission_id: string;
  title: string;
  status: string;
  priority: PierreMissionControlPriority;
  health_score: number | null;
  progress_pct: number | null;
  next_action_label: string | null;
  blocked_count: number;
  pending_approval_count: number;
  safe_to_run_count: number;
  updated_at: string | null;
};

export type PierreMissionControlEmployeeCard = {
  employee_id: string;
  employee_name: string;
  status: string;
  risk_level: string;
  health_score: number | null;
  next_action_label: string | null;
  missing_info_count: number;
  open_tasks_count: number;
  pending_approval_count: number;
  latest_event_at: string | null;
};

export type PierreMissionControlExecutiveBriefing = {
  id: string;
  period: "instant" | "daily" | "weekly";
  status: PierreMissionControlStatus;
  headline: string;
  summary: string;
  decisions_required: string[];
  safe_actions_available: string[];
  blockers: string[];
  sensitive_cases: string[];
  deliveries_ready: string[];
  suggested_focus: string[];
  generated_at: string;
};

export type PierreMissionControlRunPlan = {
  dry_run: boolean;
  requested_max: number;
  safe_actions: PierreMissionControlAction[];
  safe_task_ids: string[];
  blocked_actions: PierreMissionControlAction[];
  blocked_reasons: Array<{
    action_id: string;
    reason: string;
  }>;
  summary: string;
};

export type PierreMissionControlDigest = {
  tone: "calm" | "action" | "waiting" | "blocked" | "sensitive";
  text: string;
};

export type PierreMissionControlDashboard = {
  generated_at: string;
  status: PierreMissionControlStatus;
  headline: string;
  digest: PierreMissionControlDigest;
  metrics: PierreMissionControlMetric[];
  queues: PierreMissionControlQueue[];
  recommended_order: PierreMissionControlAction[];
  safe_to_run: PierreMissionControlAction[];
  needs_human: PierreMissionControlAction[];
  blockers: PierreMissionControlAction[];
  sensitive: PierreMissionControlAction[];
  deliveries: PierreMissionControlAction[];
  mission_cards: PierreMissionControlMissionCard[];
  employee_cards: PierreMissionControlEmployeeCard[];
  briefing: PierreMissionControlExecutiveBriefing;
  scale_profile?: PierreMissionControlScaleProfile;
  data_window?: PierreMissionControlDataWindow;
};

// ── Types Bloc 13.1 ───────────────────────────────────────

export type PierreMissionControlScaleProfile = {
  target_active_clients: number;
  validated_active_clients: number | null;
  validation_status: "not_load_tested" | "partially_validated" | "validated";
  notes: string[];
};

export type PierreMissionControlDataWindow = {
  missions_limit: number;
  tasks_limit: number;
  documents_limit: number;
  logs_limit: number;
  employees_limit: number;
  safe_execution_hard_limit: number;
};

export type PierreMissionControlBriefing = {
  id: string;
  period: "instant" | "daily" | "weekly";
  status: PierreMissionControlStatus;
  headline: string;
  summary: string;
  decisions_required: string[];
  safe_actions_available: string[];
  blockers: string[];
  sensitive_cases: string[];
  deliveries_ready: string[];
  employee_attention: string[];
  suggested_focus: string[];
  scale_profile: PierreMissionControlScaleProfile;
  generated_at: string;
};

// ── Fonctions utilitaires exportées ──────────────────────

/**
 * Vérifie si une tâche DB peut être exécutée automatiquement sans risque.
 * Règles :
 * - type ne doit pas être email.send / send_email
 * - status doit être ready ou retry
 * - approval_required doit être false
 * - execute_at doit être null ou dans le passé/présent
 */
export function isMissionControlSafeToRun(
  task: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  if (!isObject(task)) return false;
  const type = lowerText(task.type);
  if (BLOCKED_TASK_TYPES.has(type)) return false;
  const status = lowerText(task.status);
  if (!SAFE_RUN_STATUSES.has(status)) return false;
  if (asBool(task.approval_required)) return false;
  const executeAt = extractExecuteAt(task);
  if (executeAt) {
    const d = new Date(executeAt);
    if (!isNaN(d.getTime()) && d > now) return false;
  }
  return true;
}

/**
 * Vérifie si une ligne DB contient des indicateurs de sensibilité RH.
 */
export function isMissionControlSensitive(row: Record<string, unknown>): boolean {
  if (!isObject(row)) return false;
  const text = normalizeText(safeRowText(row));
  if (SENSITIVE_KEYWORDS.test(text)) return true;
  const status = lowerText(row.status);
  if (status === "sensitive") return true;
  const riskLevel = lowerText(row.risk_level);
  if (riskLevel === "black" || riskLevel === "critical") return true;
  return false;
}

/**
 * Vérifie si une ligne DB représente un blocage actif.
 */
export function isMissionControlBlocking(row: Record<string, unknown>): boolean {
  if (!isObject(row)) return false;
  const status = lowerText(row.status);
  if (status === "blocked" || status === "error") return true;
  const eventType = lowerText(row.event_type);
  if (eventType.includes("blocked") || eventType.includes("error") || eventType.includes("failed")) return true;
  return false;
}

/**
 * Infère le type d'action de contrôle pour une ligne DB.
 */
export function inferMissionControlActionType(
  row: Record<string, unknown>,
  sourceType: PierreMissionControlSourceType,
  now: Date = new Date(),
): PierreMissionControlActionType {
  if (!isObject(row)) return "no_action";

  const status = lowerText(row.status);
  const approval = asBool(row.approval_required);
  const isSafe = sourceType === "task" ? isMissionControlSafeToRun(row, now) : false;

  if (isMissionControlSensitive(row)) return "review_sensitive_case";
  if (status === "awaiting_approval" || approval) return "approve_task";
  if (status === "error") return "investigate_error";
  if (status === "blocked") return "resolve_blocker";
  if (sourceType === "document") return "open_delivery";
  if (sourceType === "employee_file") return "open_employee_file";
  if (sourceType === "continuity") return "generate_briefing";
  if (sourceType === "task" && isSafe) return "run_safe_task";
  if (sourceType === "task" && status === "scheduled") return "wait_until_scheduled";
  if (sourceType === "mission") return "open_mission";
  return "prepare_followup";
}

/**
 * Classifie une action dans la bonne file d'attente.
 */
export function classifyMissionControlQueue(
  action: PierreMissionControlAction,
  now: Date = new Date(),
): PierreMissionControlQueueKey {
  if (action.is_sensitive) return "sensitive";
  if (action.type === "approve_task") return "approvals";
  if (action.type === "investigate_error") return "errors";
  if (action.type === "resolve_blocker" || action.is_blocking) return "blocked";
  if (action.type === "open_delivery" || action.is_delivery) return "deliveries";
  if (action.source_type === "employee_file") return "employee_attention";
  if (action.type === "run_safe_task" && action.is_safe_to_run) {
    if (action.priority === "urgent" || action.priority === "high") return "do_now";
    return "safe_to_run";
  }
  if (action.type === "wait_until_scheduled") {
    const ea = action.execute_at;
    if (ea) {
      const d = new Date(ea);
      if (!isNaN(d.getTime()) && d > now) return "scheduled";
    }
  }
  if (action.requires_human) {
    return action.priority === "urgent" ? "do_now" : "approvals";
  }
  if (action.action_required && action.priority === "urgent") return "do_now";
  if (action.source_type === "task" && lowerText(action.raw?.status) === "awaiting_info") return "waiting_info";
  return "monitoring";
}

// ── Builders d'actions ────────────────────────────────────

export function buildMissionControlActionFromTask(
  task: Record<string, unknown>,
  now: Date = new Date(),
): PierreMissionControlAction {
  const taskId = asString(task.id) ?? null;
  const missionId = asString(task.mission_id) ?? null;
  const employeeId = extractEmployeeId(task);
  const status = lowerText(task.status);
  const approval = asBool(task.approval_required);
  const title = pickFirst(task, ["title", "type"]) ?? "Tâche sans titre";
  const executeAt = extractExecuteAt(task);
  const createdAt = asString(task.created_at) ?? null;

  const isSafe = isMissionControlSafeToRun(task, now);
  const isSensitive = isMissionControlSensitive(task);
  const isBlocking = isMissionControlBlocking(task);
  const requiresHuman = !isSafe || approval || status === "awaiting_approval" || isSensitive;

  const actionType = inferMissionControlActionType(task, "task", now);

  let label = title;
  let description = "";
  let priority: PierreMissionControlPriority = "normal";

  if (isSensitive) {
    priority = "urgent";
    label = `Cas sensible — ${title}`;
    description = "Situation RH sensible nécessitant revue humaine immédiate";
  } else if (status === "awaiting_approval" || approval) {
    priority = "high";
    label = `Valider — ${title}`;
    description = "Cette tâche requiert une approbation explicite avant exécution";
  } else if (status === "error") {
    priority = "urgent";
    label = `Erreur — ${title}`;
    description = "Tâche en erreur nécessitant investigation";
  } else if (status === "blocked") {
    priority = "high";
    label = `Bloqué — ${title}`;
    description = "Tâche bloquée en attente de déblocage";
  } else if (isSafe) {
    priority = "normal";
    label = `Lancer — ${title}`;
    description = "Tâche prête à être exécutée automatiquement";
  } else if (status === "scheduled") {
    priority = "low";
    label = `Planifiée — ${title}`;
    description = executeAt ? `Exécution prévue le ${executeAt.slice(0, 10)}` : "Tâche planifiée";
  } else {
    description = `Tâche ${status}`;
  }

  // href & method
  let href: string | null = null;
  let method: PierreMissionControlAction["method"] = null;
  if (actionType === "run_safe_task" && taskId) {
    href = `/api/pierre/use/task/${taskId}/run`;
    method = "POST";
  } else if (actionType === "approve_task" && taskId) {
    href = `/api/pierre/use/task/${taskId}/approve`;
    method = "POST";
  } else if (missionId) {
    href = `/api/pierre/use/mission/${missionId}`;
    method = "GET";
  }

  const id = `ctrl_${simpleHash(`task|${taskId ?? ""}|${actionType}|${status}`)}`;
  const queue = classifyMissionControlQueue({
    id, type: actionType, label, description, priority, queue: "monitoring",
    source_type: "task", source_id: taskId, mission_id: missionId, task_id: taskId,
    employee_id: employeeId, document_id: null, action_required: approval || status === "awaiting_approval",
    requires_human: requiresHuman, is_safe_to_run: isSafe, is_sensitive: isSensitive,
    is_blocking: isBlocking, is_delivery: false, is_briefing: false, execute_at: executeAt,
    href, method, payload: null, reason: description, created_at: createdAt,
    raw: task,
  } as PierreMissionControlAction, now);

  return {
    id,
    type: actionType,
    label,
    description,
    priority,
    queue,
    source_type: "task",
    source_id: taskId,
    mission_id: missionId,
    task_id: taskId,
    employee_id: employeeId,
    document_id: null,
    action_required: approval || status === "awaiting_approval",
    requires_human: requiresHuman,
    is_safe_to_run: isSafe,
    is_sensitive: isSensitive,
    is_blocking: isBlocking,
    is_delivery: false,
    execute_at: executeAt,
    href,
    method,
    payload: null,
    reason: description,
    created_at: createdAt,
    raw: task,
  };
}

export function buildMissionControlActionFromMission(
  mission: Record<string, unknown>,
  now: Date = new Date(),
): PierreMissionControlAction {
  const missionId = asString(mission.id) ?? null;
  const employeeId = extractEmployeeId(mission);
  const status = lowerText(mission.status);
  const title = pickFirst(mission, ["mission_summary", "intent", "title"]) ?? "Mission sans titre";
  const createdAt = asString(mission.created_at) ?? null;
  const isSensitive = isMissionControlSensitive(mission);
  const isBlocking = status === "blocked" || status === "error";
  const approval = asBool(mission.approval_required);

  let label = title;
  let description = "";
  let priority: PierreMissionControlPriority = "normal";
  let actionType: PierreMissionControlActionType = "open_mission";

  if (isSensitive) {
    priority = "urgent";
    label = `Sensible — ${title}`;
    description = "Mission RH sensible à revue humaine";
    actionType = "review_sensitive_case";
  } else if (status === "blocked") {
    priority = "high";
    label = `Mission bloquée — ${title}`;
    description = "Mission bloquée, intervention requise";
    actionType = "resolve_blocker";
  } else if (status === "error") {
    priority = "urgent";
    label = `Erreur mission — ${title}`;
    description = "Mission en erreur";
    actionType = "investigate_error";
  } else if (status === "awaiting_approval" || approval) {
    priority = "high";
    label = `Validation requise — ${title}`;
    description = "Mission en attente d'approbation";
    actionType = "approve_task";
  } else if (status === "awaiting_info") {
    priority = "normal";
    label = `Info manquante — ${title}`;
    description = "Mission en attente d'informations";
  } else if (status === "active") {
    label = `Mission active — ${title}`;
    description = "Mission en cours de traitement";
  }

  const href = missionId ? `/api/pierre/use/mission/${missionId}` : null;
  const id = `ctrl_${simpleHash(`mission|${missionId ?? ""}|${actionType}|${status}`)}`;

  const tempAction = {
    id, type: actionType, label, description, priority, queue: "monitoring" as PierreMissionControlQueueKey,
    source_type: "mission" as PierreMissionControlSourceType, source_id: missionId, mission_id: missionId,
    task_id: null, employee_id: employeeId, document_id: null,
    action_required: approval || status === "awaiting_approval",
    requires_human: isSensitive || approval || status === "awaiting_approval",
    is_safe_to_run: false, is_sensitive: isSensitive, is_blocking: isBlocking,
    is_delivery: false, execute_at: null, href, method: "GET" as const,
    payload: null, reason: description, created_at: createdAt, raw: mission,
  };

  const queue = classifyMissionControlQueue(tempAction, now);

  return { ...tempAction, queue };
}

export function buildMissionControlActionFromDocument(
  doc: Record<string, unknown>,
): PierreMissionControlAction {
  const docId = asString(doc.id) ?? null;
  const missionId = asString(doc.mission_id) ?? null;
  const title = pickFirst(doc, ["title", "doc_type"]) ?? "Document sans titre";
  const docType = lowerText(doc.doc_type);
  const createdAt = asString(doc.created_at) ?? null;

  const label = `Livraison — ${title}`;
  const description = docType ? `Document ${docType} disponible` : "Document disponible";
  const href = missionId ? `/api/pierre/use/mission/${missionId}` : null;
  const id = `ctrl_${simpleHash(`document|${docId ?? ""}|open_delivery`)}`;

  return {
    id,
    type: "open_delivery",
    label,
    description,
    priority: "low",
    queue: "deliveries",
    source_type: "document",
    source_id: docId,
    mission_id: missionId,
    task_id: null,
    employee_id: null,
    document_id: docId,
    action_required: false,
    requires_human: false,
    is_safe_to_run: false,
    is_sensitive: false,
    is_blocking: false,
    is_delivery: true,
    execute_at: null,
    href,
    method: "GET",
    payload: null,
    reason: description,
    created_at: createdAt,
    raw: doc,
  };
}

export function buildMissionControlActionFromEmployeeSnapshot(
  snap: PierreEmployeeFileSnapshot | Record<string, unknown>,
): PierreMissionControlAction {
  const s = snap as Record<string, unknown>;
  const employeeId = asString(s.employee_id) ?? null;
  const employeeName = asString(s.employee_name) ?? "Salarié inconnu";
  const status = lowerText(s.status);
  const isSensitive = status === "sensitive";
  const riskLevel = lowerText(s.risk_level);
  const createdAt = asString(s.latest_event_at) ?? null;

  let label = `Dossier — ${employeeName}`;
  let description = "Dossier salarié à consulter";
  let priority: PierreMissionControlPriority = "normal";
  let actionType: PierreMissionControlActionType = "open_employee_file";

  if (isSensitive) {
    priority = "urgent";
    label = `Cas sensible — ${employeeName}`;
    description = "Dossier salarié sensible — revue immédiate requise";
    actionType = "review_sensitive_case";
  } else if (status === "attention_required") {
    priority = "high";
    label = `Attention requise — ${employeeName}`;
    description = "Dossier salarié nécessitant attention";
  } else if (status === "incomplete" || (riskLevel === "red" || riskLevel === "high")) {
    priority = "normal";
    label = `Dossier incomplet — ${employeeName}`;
    description = "Informations manquantes dans le dossier salarié";
  }

  const href = employeeId ? `/api/pierre/use/employee/${employeeId}/file` : null;
  const id = `ctrl_${simpleHash(`employee_file|${employeeId ?? ""}|${actionType}|${status}`)}`;

  return {
    id,
    type: actionType,
    label,
    description,
    priority,
    queue: isSensitive ? "sensitive" : "employee_attention",
    source_type: "employee_file",
    source_id: employeeId,
    mission_id: null,
    task_id: null,
    employee_id: employeeId,
    document_id: null,
    action_required: isSensitive || status === "attention_required",
    requires_human: isSensitive,
    is_safe_to_run: false,
    is_sensitive: isSensitive,
    is_blocking: false,
    is_delivery: false,
    execute_at: null,
    href,
    method: "GET",
    payload: null,
    reason: description,
    created_at: createdAt,
    raw: s,
  };
}

export function buildMissionControlActionFromFeedItem(
  item: PierreOperationalFeedItem,
): PierreMissionControlAction | null {
  try {
    const isSensitive = item.is_sensitive;
    const isBlocking = item.is_blocking;
    const isDelivery = item.is_delivery;

    let actionType: PierreMissionControlActionType = "prepare_followup";
    if (isSensitive) actionType = "review_sensitive_case";
    else if (item.action_kind === "approve_task") actionType = "approve_task";
    else if (item.action_kind === "run_task") actionType = "run_safe_task";
    else if (isDelivery) actionType = "open_delivery";
    else if (item.is_briefing) actionType = "generate_briefing";

    let priority: PierreMissionControlPriority = "normal";
    if (item.priority === "urgent") priority = "urgent";
    else if (item.priority === "high") priority = "high";
    else if (item.priority === "low") priority = "low";

    const id = `ctrl_${simpleHash(`feed|${item.id}|${actionType}`)}`;

    const tempAction = {
      id, type: actionType, label: item.title, description: item.message, priority,
      queue: "monitoring" as PierreMissionControlQueueKey,
      source_type: "feed" as PierreMissionControlSourceType,
      source_id: item.source_id, mission_id: item.mission_id, task_id: item.task_id,
      employee_id: item.employee_id, document_id: null,
      action_required: item.action_required,
      requires_human: isSensitive || item.action_kind === "approve_task",
      is_safe_to_run: item.action_kind === "run_task",
      is_sensitive: isSensitive, is_blocking: isBlocking, is_delivery: isDelivery,
      execute_at: null, href: item.action_target?.href ?? null,
      method: (item.action_target?.method ?? null) as PierreMissionControlAction["method"],
      payload: null, reason: item.message, created_at: item.created_at,
      raw: item.raw ?? {},
    };

    const queue = classifyMissionControlQueue(tempAction, new Date());
    return { ...tempAction, queue };
  } catch (_e) {
    /* skip malformed row */
    return null;
  }
}

// ── Builders de cartes ────────────────────────────────────

export function buildMissionControlMissionCard(
  mission: Record<string, unknown>,
  tasks: Record<string, unknown>[] = [],
  now: Date = new Date(),
): PierreMissionControlMissionCard {
  const missionId = asString(mission.id) ?? "unknown";
  const title = pickFirst(mission, ["mission_summary", "intent", "title"]) ?? "Mission sans titre";
  const status = lowerText(mission.status);
  const updatedAt = asString(mission.updated_at) ?? asString(mission.created_at) ?? null;
  const isSensitive = isMissionControlSensitive(mission);
  const riskLevel = lowerText(mission.risk_level);

  let priority: PierreMissionControlPriority = "normal";
  if (isSensitive || status === "error" || riskLevel === "black") priority = "urgent";
  else if (status === "blocked" || status === "awaiting_approval" || riskLevel === "red") priority = "high";
  else if (TERMINAL_STATUSES.has(status)) priority = "low";

  const missionTasks = tasks.filter((t) => asString(t.mission_id) === missionId);
  const blocked = missionTasks.filter((t) => lowerText(t.status) === "blocked" || lowerText(t.status) === "error").length;
  const pendingApproval = missionTasks.filter((t) => lowerText(t.status) === "awaiting_approval" || asBool(t.approval_required)).length;
  const safeToRunCount = missionTasks.filter((t) => isMissionControlSafeToRun(t, now)).length;

  const total = missionTasks.length;
  const done = missionTasks.filter((t) => TERMINAL_STATUSES.has(lowerText(t.status))).length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : null;

  let nextActionLabel: string | null = null;
  if (safeToRunCount > 0) nextActionLabel = `${safeToRunCount} tâche(s) prête(s) à exécuter`;
  else if (pendingApproval > 0) nextActionLabel = `${pendingApproval} validation(s) requise(s)`;
  else if (blocked > 0) nextActionLabel = `${blocked} blocage(s) à résoudre`;

  // Health score 0-100
  let healthScore: number | null = null;
  if (total > 0) {
    const errors = missionTasks.filter((t) => lowerText(t.status) === "error").length;
    healthScore = Math.round(((done + safeToRunCount * 0.5) / total) * 100 - errors * 10);
    healthScore = Math.max(0, Math.min(100, healthScore));
  }

  return {
    mission_id: missionId,
    title,
    status,
    priority,
    health_score: healthScore,
    progress_pct: progressPct,
    next_action_label: nextActionLabel,
    blocked_count: blocked,
    pending_approval_count: pendingApproval,
    safe_to_run_count: safeToRunCount,
    updated_at: updatedAt,
  };
}

export function buildMissionControlEmployeeCard(
  snap: PierreEmployeeFileSnapshot | Record<string, unknown>,
): PierreMissionControlEmployeeCard {
  const s = snap as Record<string, unknown>;
  const employeeId = asString(s.employee_id) ?? "unknown";
  const employeeName = asString(s.employee_name) ?? "Salarié inconnu";
  const status = lowerText(s.status) || "unknown";
  const riskLevel = lowerText(s.risk_level) || "low";
  const healthScore = typeof s.health_score === "number" ? s.health_score : null;
  const missingInfoCount = typeof s.missing_info_count === "number" ? s.missing_info_count : 0;
  const openTasksCount = typeof s.open_tasks_count === "number" ? s.open_tasks_count : 0;
  const pendingApprovalCount = typeof s.pending_approval_count === "number" ? s.pending_approval_count : 0;
  const latestEventAt = asString(s.latest_event_at) ?? null;

  let nextActionLabel: string | null = null;
  if (status === "sensitive") nextActionLabel = "Revue humaine immédiate requise";
  else if (status === "attention_required") nextActionLabel = "Dossier à vérifier";
  else if (missingInfoCount > 0) nextActionLabel = `${missingInfoCount} information(s) manquante(s)`;
  else if (pendingApprovalCount > 0) nextActionLabel = `${pendingApprovalCount} validation(s) en attente`;
  else if (openTasksCount > 0) nextActionLabel = `${openTasksCount} tâche(s) ouvertes`;

  return {
    employee_id: employeeId,
    employee_name: employeeName,
    status,
    risk_level: riskLevel,
    health_score: healthScore,
    next_action_label: nextActionLabel,
    missing_info_count: missingInfoCount,
    open_tasks_count: openTasksCount,
    pending_approval_count: pendingApprovalCount,
    latest_event_at: latestEventAt,
  };
}

// ── Métriques ─────────────────────────────────────────────

export function buildMissionControlMetrics(params: {
  actions: PierreMissionControlAction[];
  missions: Record<string, unknown>[];
  snapshots: Array<PierreEmployeeFileSnapshot | Record<string, unknown>>;
  continuityDashboard?: PierreContinuityDashboard | null;
}): PierreMissionControlMetric[] {
  const { actions, missions, snapshots, continuityDashboard } = params;

  const safeToRun = actions.filter((a) => a.is_safe_to_run).length;
  const pendingApprovals = actions.filter((a) => a.type === "approve_task").length;
  const blockers = actions.filter((a) => a.is_blocking).length;
  const sensitive = actions.filter((a) => a.is_sensitive).length;
  const deliveries = actions.filter((a) => a.is_delivery).length;
  const errors = actions.filter((a) => a.type === "investigate_error").length;
  const urgent = actions.filter((a) => a.priority === "urgent").length;
  const activeMissions = missions.filter((m) => lowerText(m.status) === "active").length;
  const sensitiveEmployees = snapshots.filter((s) => {
    const snap = s as Record<string, unknown>;
    return lowerText(snap.status) === "sensitive";
  }).length;
  const attentionEmployees = snapshots.filter((s) => {
    const snap = s as Record<string, unknown>;
    return lowerText(snap.status) === "attention_required";
  }).length;

  const totalRunnable = continuityDashboard?.total_runnable_tasks ?? safeToRun;

  const metrics: PierreMissionControlMetric[] = [
    {
      key: "safe_to_run",
      label: "Tâches prêtes à exécuter",
      value: totalRunnable,
      severity: totalRunnable > 0 ? "good" : "neutral",
    },
    {
      key: "pending_approvals",
      label: "Validations en attente",
      value: pendingApprovals,
      severity: pendingApprovals > 0 ? "warning" : "neutral",
    },
    {
      key: "blockers",
      label: "Blocages actifs",
      value: blockers,
      severity: blockers > 2 ? "danger" : blockers > 0 ? "warning" : "neutral",
    },
    {
      key: "errors",
      label: "Erreurs à traiter",
      value: errors,
      severity: errors > 0 ? "danger" : "neutral",
    },
    {
      key: "sensitive_cases",
      label: "Cas sensibles",
      value: sensitive,
      severity: sensitive > 0 ? "danger" : "neutral",
    },
    {
      key: "deliveries",
      label: "Livraisons disponibles",
      value: deliveries,
      severity: deliveries > 0 ? "good" : "neutral",
    },
    {
      key: "urgent_actions",
      label: "Actions urgentes",
      value: urgent,
      severity: urgent > 0 ? "danger" : "neutral",
    },
    {
      key: "active_missions",
      label: "Missions actives",
      value: activeMissions,
      severity: activeMissions > 0 ? "good" : "neutral",
    },
    {
      key: "sensitive_employees",
      label: "Salariés sensibles",
      value: sensitiveEmployees,
      severity: sensitiveEmployees > 0 ? "danger" : "neutral",
    },
    {
      key: "employees_attention",
      label: "Salariés à surveiller",
      value: attentionEmployees,
      severity: attentionEmployees > 1 ? "warning" : attentionEmployees > 0 ? "warning" : "neutral",
    },
  ];

  return metrics;
}

// ── Files d'actions ───────────────────────────────────────

export function buildMissionControlQueues(
  actions: PierreMissionControlAction[],
  now: Date = new Date(),
): PierreMissionControlQueue[] {
  const QUEUE_ORDER: PierreMissionControlQueueKey[] = [
    "do_now", "safe_to_run", "approvals", "blocked", "errors",
    "sensitive", "deliveries", "scheduled", "waiting_info", "employee_attention", "monitoring",
  ];

  const queueMap: Map<PierreMissionControlQueueKey, PierreMissionControlAction[]> = new Map();
  for (const key of QUEUE_ORDER) {
    queueMap.set(key, []);
  }

  for (const action of actions) {
    const key = classifyMissionControlQueue(action, now);
    const arr = queueMap.get(key);
    if (arr) arr.push(action);
  }

  return QUEUE_ORDER.map((key) => {
    const queueActions = queueMap.get(key) ?? [];
    return {
      key,
      label: QUEUE_LABELS[key],
      description: QUEUE_DESCRIPTIONS[key],
      count: queueActions.length,
      urgent_count: queueActions.filter((a) => a.priority === "urgent").length,
      high_count: queueActions.filter((a) => a.priority === "high").length,
      actions: sortMissionControlActions(queueActions),
    };
  });
}

// ── Tri des actions ───────────────────────────────────────

export function sortMissionControlActions(
  actions: PierreMissionControlAction[],
): PierreMissionControlAction[] {
  return [...actions].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 0;
    const pb = PRIORITY_ORDER[b.priority] ?? 0;
    if (pb !== pa) return pb - pa;
    if (a.action_required !== b.action_required) return a.action_required ? -1 : 1;
    if (a.is_blocking !== b.is_blocking) return a.is_blocking ? -1 : 1;
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (db !== da) return db - da;
    return a.label.localeCompare(b.label);
  });
}

// ── Digest ────────────────────────────────────────────────

export function buildMissionControlDigest(params: {
  status: PierreMissionControlStatus;
  urgentCount: number;
  safeToRunCount: number;
  pendingApprovals: number;
  blockers: number;
  sensitiveCount: number;
  deliveries: number;
}): PierreMissionControlDigest {
  const { status, urgentCount, safeToRunCount, pendingApprovals, blockers, sensitiveCount, deliveries } = params;

  let tone: PierreMissionControlDigest["tone"] = "calm";
  const parts: string[] = [];

  if (sensitiveCount > 0) {
    tone = "sensitive";
    parts.push(`${sensitiveCount} cas sensible(s) nécessitent une revue humaine immédiate.`);
  } else if (blockers > 0 || urgentCount > 0) {
    tone = "blocked";
    if (urgentCount > 0) parts.push(`${urgentCount} action(s) urgente(s) en attente.`);
    if (blockers > 0) parts.push(`${blockers} blocage(s) à résoudre.`);
  } else if (pendingApprovals > 0) {
    tone = "waiting";
    parts.push(`${pendingApprovals} validation(s) humaine(s) requise(s).`);
  } else if (safeToRunCount > 0) {
    tone = "action";
    parts.push(`${safeToRunCount} tâche(s) prête(s) à être lancée(s) automatiquement.`);
  } else if (deliveries > 0) {
    tone = "calm";
    parts.push(`${deliveries} livraison(s) disponible(s).`);
  } else if (status === "clear") {
    tone = "calm";
    parts.push("Aucune action urgente — poste RH opérationnel à jour.");
  } else {
    tone = "calm";
    parts.push("Pierre surveille activement les missions et dossiers RH.");
  }

  return { tone, text: parts.join(" ") || "Poste RH opérationnel." };
}

// ── Briefing exécutif ─────────────────────────────────────

export function buildMissionControlExecutiveBriefing(params: {
  status: PierreMissionControlStatus;
  actions: PierreMissionControlAction[];
  missionCards: PierreMissionControlMissionCard[];
  employeeCards: PierreMissionControlEmployeeCard[];
  period?: "instant" | "daily" | "weekly";
  now?: Date;
}): PierreMissionControlExecutiveBriefing {
  const { status, actions, missionCards, employeeCards, period = "instant", now = new Date() } = params;
  const generatedAt = now.toISOString();

  const urgentActions = actions.filter((a) => a.priority === "urgent");
  const safeActions = actions.filter((a) => a.is_safe_to_run);
  const blockerActions = actions.filter((a) => a.is_blocking);
  const sensitiveActions = actions.filter((a) => a.is_sensitive);
  const deliveryActions = actions.filter((a) => a.is_delivery);
  const approvalActions = actions.filter((a) => a.type === "approve_task");

  const decisionsRequired: string[] = [];
  for (const a of approvalActions.slice(0, 5)) decisionsRequired.push(a.label);
  for (const a of sensitiveActions.slice(0, 3)) {
    if (!decisionsRequired.includes(a.label)) decisionsRequired.push(a.label);
  }

  const safeActionsAvailable = safeActions.slice(0, 5).map((a) => a.label);
  const blockers = blockerActions.slice(0, 5).map((a) => a.reason || a.label);
  const sensitiveCases = sensitiveActions.slice(0, 5).map((a) => a.label);
  const deliveriesReady = deliveryActions.slice(0, 5).map((a) => a.label);

  const suggestedFocus: string[] = [];
  if (urgentActions.length > 0) suggestedFocus.push(`Traiter ${urgentActions.length} action(s) urgente(s)`);
  if (approvalActions.length > 0) suggestedFocus.push(`Valider ${approvalActions.length} demande(s) en attente`);
  if (blockerActions.length > 0) suggestedFocus.push(`Résoudre ${blockerActions.length} blocage(s)`);
  if (safeActions.length > 0) suggestedFocus.push(`Lancer ${safeActions.length} tâche(s) prête(s)`);
  if (deliveryActions.length > 0) suggestedFocus.push(`Consulter ${deliveryActions.length} livraison(s)`);
  if (suggestedFocus.length === 0) suggestedFocus.push("Aucune action urgente — continuer la surveillance");

  let headline = "";
  if (status === "sensitive") {
    headline = `ATTENTION — ${sensitiveActions.length} cas sensible(s) RH en cours`;
  } else if (status === "blocked") {
    headline = `${blockerActions.length} blocage(s) + ${urgentActions.length} action(s) urgente(s)`;
  } else if (status === "attention_required") {
    headline = `${urgentActions.length} action(s) urgente(s) — ${approvalActions.length} validation(s) requise(s)`;
  } else if (safeActions.length > 0) {
    headline = `${safeActions.length} tâche(s) prête(s) — ${missionCards.length} mission(s) actives`;
  } else {
    headline = `Poste RH opérationnel — ${actions.length} message(s) Pierre`;
  }

  const parts: string[] = [];
  if (urgentActions.length > 0) parts.push(`${urgentActions.length} action(s) urgente(s).`);
  if (safeActions.length > 0) parts.push(`${safeActions.length} tâche(s) safe à lancer.`);
  if (approvalActions.length > 0) parts.push(`${approvalActions.length} validation(s) humaine(s) requise(s).`);
  if (blockerActions.length > 0) parts.push(`${blockerActions.length} blocage(s) actif(s).`);
  if (sensitiveActions.length > 0) parts.push(`${sensitiveActions.length} cas sensible(s).`);
  if (deliveryActions.length > 0) parts.push(`${deliveryActions.length} livraison(s) disponible(s).`);
  if (missionCards.length > 0) parts.push(`${missionCards.length} mission(s) suivies.`);
  if (employeeCards.length > 0) parts.push(`${employeeCards.length} dossier(s) salarié(s).`);
  if (parts.length === 0) parts.push("Aucune action urgente — tout est à jour.");

  const idInput = `${period}|${generatedAt.slice(0, 10)}|${actions.length}|${urgentActions.length}`;
  const id = `brief_ctrl_${simpleHash(idInput)}`;

  return {
    id,
    period,
    status,
    headline,
    summary: parts.join(" "),
    decisions_required: decisionsRequired,
    safe_actions_available: safeActionsAvailable,
    blockers,
    sensitive_cases: sensitiveCases,
    deliveries_ready: deliveriesReady,
    suggested_focus: suggestedFocus,
    generated_at: generatedAt,
  };
}

// ── Plan de lancement sécurisé ────────────────────────────

export function buildMissionControlRunPlan(
  actions: PierreMissionControlAction[],
  maxTasks: number = 5,
  dryRun: boolean = true,
): PierreMissionControlRunPlan {
  const clampedMax = Math.min(Math.max(maxTasks, 1), 20);
  const safeActions: PierreMissionControlAction[] = [];
  const blockedActions: PierreMissionControlAction[] = [];
  const blockedReasons: Array<{ action_id: string; reason: string }> = [];

  for (const action of sortMissionControlActions(actions)) {
    if (action.is_safe_to_run && action.task_id && !action.requires_human && !action.is_sensitive) {
      if (safeActions.length < clampedMax) {
        safeActions.push(action);
      }
    } else if (action.source_type === "task" || action.task_id) {
      let reason = "Action non sûre à lancer automatiquement";
      if (action.requires_human) reason = "Validation humaine requise";
      else if (action.is_sensitive) reason = "Cas sensible — revue humaine obligatoire";
      else if (!action.is_safe_to_run) reason = "Conditions non remplies pour lancement auto";
      blockedActions.push(action);
      blockedReasons.push({ action_id: action.id, reason });
    }
  }

  const safe_task_ids = safeActions
    .map((a) => a.task_id)
    .filter((id): id is string => id !== null);

  let summary = "";
  if (safeActions.length === 0) {
    summary = "Aucune tâche prête à être lancée automatiquement.";
  } else if (dryRun) {
    summary = `${safeActions.length} tâche(s) seraient lancées (mode simulation). ${blockedActions.length} bloquée(s).`;
  } else {
    summary = `${safeActions.length} tâche(s) à lancer. ${blockedActions.length} bloquée(s) pour revue humaine.`;
  }

  return {
    dry_run: dryRun,
    requested_max: clampedMax,
    safe_actions: safeActions,
    safe_task_ids,
    blocked_actions: blockedActions,
    blocked_reasons: blockedReasons,
    summary,
  };
}

// ── Status global ─────────────────────────────────────────

function computeGlobalStatus(
  actions: PierreMissionControlAction[],
): PierreMissionControlStatus {
  if (actions.some((a) => a.is_sensitive)) return "sensitive";
  if (actions.some((a) => a.is_blocking || a.type === "investigate_error")) return "blocked";
  if (actions.some((a) => a.priority === "urgent" || a.priority === "high")) return "attention_required";
  if (actions.length > 0) return "active";
  return "clear";
}

function computeHeadline(
  status: PierreMissionControlStatus,
  actions: PierreMissionControlAction[],
  missionCount: number,
): string {
  const safe = actions.filter((a) => a.is_safe_to_run).length;
  const sensitive = actions.filter((a) => a.is_sensitive).length;
  const blockers = actions.filter((a) => a.is_blocking).length;
  const urgent = actions.filter((a) => a.priority === "urgent").length;

  if (status === "sensitive") return `ATTENTION — ${sensitive} cas sensible(s) RH`;
  if (status === "blocked") return `${blockers} blocage(s) actif(s) — intervention requise`;
  if (status === "attention_required") return `${urgent} action(s) urgente(s) — ${missionCount} mission(s)`;
  if (safe > 0) return `${safe} tâche(s) prête(s) — ${missionCount} mission(s) suivies`;
  if (actions.length > 0) return `${actions.length} message(s) Pierre — ${missionCount} mission(s)`;
  return "Poste RH à jour — aucune action requise";
}

// ── Fonction principale exportée ──────────────────────────

export function buildMissionControlDashboard(params: {
  missions?: unknown[];
  tasks?: unknown[];
  documents?: unknown[];
  logs?: unknown[];
  employeeSnapshots?: Array<PierreEmployeeFileSnapshot | Record<string, unknown>>;
  feedItems?: PierreOperationalFeedItem[];
  continuityDashboard?: PierreContinuityDashboard | null;
  now?: Date;
  maxSafeActions?: number;
}): PierreMissionControlDashboard {
  const {
    missions = [],
    tasks = [],
    documents = [],
    employeeSnapshots = [],
    feedItems = [],
    continuityDashboard = null,
    now = new Date(),
    maxSafeActions = 10,
  } = params;

  const generatedAt = now.toISOString();

  // Normaliser les rows
  const safeMissions = missions.filter(isObject) as Record<string, unknown>[];
  const safeTasks = tasks.filter(isObject) as Record<string, unknown>[];
  const safeDocuments = documents.filter(isObject) as Record<string, unknown>[];

  // Construire les actions
  const actions: PierreMissionControlAction[] = [];

  // Actions depuis les tâches
  for (const task of safeTasks) {
    try {
      const action = buildMissionControlActionFromTask(task, now);
      const status = lowerText(task.status);
      if (!TERMINAL_STATUSES.has(status)) {
        actions.push(action);
      }
    } catch (_e) {
      /* skip malformed row */
    }
  }

  // Actions depuis les missions (seulement non terminées)
  for (const mission of safeMissions) {
    try {
      const status = lowerText(mission.status);
      if (!TERMINAL_STATUSES.has(status)) {
        actions.push(buildMissionControlActionFromMission(mission, now));
      }
    } catch (_e) {
      /* skip malformed row */
    }
  }

  // Actions depuis les documents (livraisons)
  for (const doc of safeDocuments) {
    try {
      const status = lowerText(doc.status);
      if (status !== "cancelled") {
        actions.push(buildMissionControlActionFromDocument(doc));
      }
    } catch (_e) {
      /* skip malformed row */
    }
  }

  // Actions depuis les snapshots employés (attention/sensitive uniquement)
  for (const snap of employeeSnapshots) {
    try {
      const s = snap as Record<string, unknown>;
      const efStatus = lowerText(s.status);
      if (efStatus === "sensitive" || efStatus === "attention_required" || efStatus === "incomplete") {
        actions.push(buildMissionControlActionFromEmployeeSnapshot(snap));
      }
    } catch (_e) {
      /* skip malformed row */
    }
  }

  // Enrichir depuis le feed (items non déjà couverts par task/mission)
  const coveredTaskIds = new Set(safeTasks.map((t) => asString(t.id)).filter(Boolean));
  const coveredMissionIds = new Set(safeMissions.map((m) => asString(m.id)).filter(Boolean));
  for (const item of feedItems) {
    try {
      if (item.task_id && coveredTaskIds.has(item.task_id)) continue;
      if (item.mission_id && coveredMissionIds.has(item.mission_id) && item.source_type === "mission") continue;
      const action = buildMissionControlActionFromFeedItem(item);
      if (action) actions.push(action);
    } catch (_e) {
      /* skip malformed row */
    }
  }

  // Déduplication par id
  const seenIds = new Set<string>();
  const uniqueActions: PierreMissionControlAction[] = [];
  for (const action of actions) {
    if (!seenIds.has(action.id)) {
      seenIds.add(action.id);
      uniqueActions.push(action);
    }
  }

  // Trier les actions
  const sortedActions = sortMissionControlActions(uniqueActions);

  // Construire les listes spécialisées
  const safeToRun = sortedActions.filter((a) => a.is_safe_to_run && !a.requires_human).slice(0, maxSafeActions);
  const needsHuman = sortedActions.filter((a) => a.requires_human || a.type === "approve_task");
  const blockers = sortedActions.filter((a) => a.is_blocking || a.type === "investigate_error" || a.type === "resolve_blocker");
  const sensitive = sortedActions.filter((a) => a.is_sensitive);
  const deliveries = sortedActions.filter((a) => a.is_delivery);

  // Ordre recommandé (sans doublons)
  const seenRec = new Set<string>();
  const recommended: PierreMissionControlAction[] = [];
  for (const list of [sensitive, blockers, needsHuman, safeToRun, deliveries, sortedActions]) {
    for (const a of list) {
      if (!seenRec.has(a.id)) {
        seenRec.add(a.id);
        recommended.push(a);
      }
    }
  }

  // Cartes missions
  const missionCards: PierreMissionControlMissionCard[] = safeMissions.map((m) => {
    try {
      return buildMissionControlMissionCard(m, safeTasks, now);
    } catch (_e) {
      /* skip malformed row */
      return null;
    }
  }).filter((c): c is PierreMissionControlMissionCard => c !== null);

  // Cartes employés
  const employeeCards: PierreMissionControlEmployeeCard[] = employeeSnapshots.map((s) => {
    try {
      return buildMissionControlEmployeeCard(s);
    } catch (_e) {
      /* skip malformed row */
      return null;
    }
  }).filter((c): c is PierreMissionControlEmployeeCard => c !== null);

  // Files d'attente
  const queues = buildMissionControlQueues(sortedActions, now);

  // Métriques
  const metrics = buildMissionControlMetrics({
    actions: sortedActions,
    missions: safeMissions,
    snapshots: employeeSnapshots,
    continuityDashboard,
  });

  // Status global
  const status = computeGlobalStatus(sortedActions);

  // Headline
  const headline = computeHeadline(status, sortedActions, safeMissions.filter((m) => lowerText(m.status) === "active").length);

  // Digest
  const urgentCount = sortedActions.filter((a) => a.priority === "urgent").length;
  const safeToRunCount = safeToRun.length;
  const pendingApprovals = needsHuman.filter((a) => a.type === "approve_task").length;
  const digest = buildMissionControlDigest({
    status,
    urgentCount,
    safeToRunCount,
    pendingApprovals,
    blockers: blockers.length,
    sensitiveCount: sensitive.length,
    deliveries: deliveries.length,
  });

  // Briefing exécutif
  const briefing = buildMissionControlExecutiveBriefing({
    status,
    actions: sortedActions,
    missionCards,
    employeeCards,
    period: "instant",
    now,
  });

  return {
    generated_at: generatedAt,
    status,
    headline,
    digest,
    metrics,
    queues,
    recommended_order: recommended,
    safe_to_run: safeToRun,
    needs_human: needsHuman,
    blockers,
    sensitive,
    deliveries,
    mission_cards: missionCards,
    employee_cards: employeeCards,
    briefing,
    scale_profile: buildMissionControlScaleProfile(),
    data_window: buildMissionControlDataWindow(),
  };
}

// ── Bloc 13.1 — Scale + DataWindow + Briefing + Preview ──

export function buildMissionControlScaleProfile(): PierreMissionControlScaleProfile {
  return {
    target_active_clients: 100000,
    validated_active_clients: null,
    validation_status: "not_load_tested",
    notes: [
      "Architecture pensée pour 100 000+ entreprises actives.",
      "Capacité non garantie sans load tests.",
      "Bloc Scale dédié requis avant promesse technique ferme.",
      "Nécessite workers, observabilité, cache, indexes, rétention et tests de charge.",
    ],
  };
}

export function buildMissionControlDataWindow(
  overrides?: Partial<PierreMissionControlDataWindow>,
): PierreMissionControlDataWindow {
  return {
    missions_limit: 300,
    tasks_limit: 500,
    documents_limit: 300,
    logs_limit: 500,
    employees_limit: 500,
    safe_execution_hard_limit: 10,
    ...overrides,
  };
}

export function buildMissionControlBriefing(params: {
  dashboard: PierreMissionControlDashboard;
  period?: "instant" | "daily" | "weekly";
  now?: Date;
}): PierreMissionControlBriefing {
  const { dashboard, period = "instant", now = new Date() } = params;
  const generatedAt = now.toISOString();

  const id = `brief_mc_${simpleHash(period + "|" + generatedAt.slice(0, 16))}`;

  // decisions_required — depuis needs_human + sensitive
  const decisionsRequired: string[] = [];
  for (const a of dashboard.needs_human ?? []) {
    const label = a.label || a.reason || "Validation requise";
    if (!decisionsRequired.includes(label)) decisionsRequired.push(label);
  }
  for (const a of dashboard.sensitive ?? []) {
    const label = `Cas sensible : ${a.label || a.reason || "revue requise"}`;
    if (!decisionsRequired.includes(label)) decisionsRequired.push(label);
  }

  // safe_actions_available
  const safeActionsAvailable = (dashboard.safe_to_run ?? []).map(
    (a) => a.label || "Tâche sûre à lancer",
  );

  // blockers
  const blockersList = (dashboard.blockers ?? []).map(
    (a) => a.label || a.reason || "Blocage à résoudre",
  );

  // sensitive_cases
  const sensitiveCases = (dashboard.sensitive ?? []).map(
    (a) => a.label || "Cas sensible",
  );

  // deliveries_ready
  const deliveriesReady = (dashboard.deliveries ?? []).map(
    (a) => a.label || "Livraison disponible",
  );

  // employee_attention
  const employeeAttention = (dashboard.employee_cards ?? [])
    .filter((c) => c.status === "sensitive" || c.status === "attention_required" || c.missing_info_count > 0)
    .map((c) => `${c.employee_name} — ${c.status}`);

  // suggested_focus (priorité décroissante)
  const suggestedFocus: string[] = [];
  if (sensitiveCases.length > 0) suggestedFocus.push(`Traiter ${sensitiveCases.length} cas sensible(s) RH immédiatement`);
  if (decisionsRequired.length > 0) suggestedFocus.push(`Valider ${decisionsRequired.length} action(s) humaine(s) en attente`);
  if (blockersList.length > 0) suggestedFocus.push(`Débloquer ${blockersList.length} tâche(s) bloquée(s)`);
  if (safeActionsAvailable.length > 0) suggestedFocus.push(`Exécuter ${safeActionsAvailable.length} tâche(s) sûre(s) automatiquement`);
  if (deliveriesReady.length > 0) suggestedFocus.push(`Vérifier ${deliveriesReady.length} livraison(s) disponible(s)`);
  if (employeeAttention.length > 0) suggestedFocus.push(`Surveiller ${employeeAttention.length} dossier(s) salarié(s)`);
  if (suggestedFocus.length === 0) suggestedFocus.push("Poste RH opérationnel — aucune action prioritaire");

  // summary
  let summary = "";
  const totalActions = (dashboard.recommended_order ?? []).length;
  if (dashboard.status === "sensitive") {
    summary = `ATTENTION — ${sensitiveCases.length} cas sensible(s) RH nécessitent une revue humaine immédiate. ${totalActions} action(s) au total.`;
  } else if (dashboard.status === "blocked") {
    summary = `${blockersList.length} blocage(s) actif(s). ${safeActionsAvailable.length} tâche(s) prête(s). ${totalActions} action(s) au total.`;
  } else if (safeActionsAvailable.length > 0) {
    summary = `${safeActionsAvailable.length} tâche(s) prête(s) à exécuter. ${decisionsRequired.length} validation(s) humaine(s). ${totalActions} action(s) au total.`;
  } else if (totalActions > 0) {
    summary = `${totalActions} action(s) Pierre en cours de suivi. Poste RH opérationnel.`;
  } else {
    summary = "Poste RH à jour — aucune action urgente requise.";
  }

  return {
    id,
    period,
    status: dashboard.status,
    headline: dashboard.headline,
    summary,
    decisions_required: decisionsRequired,
    safe_actions_available: safeActionsAvailable,
    blockers: blockersList,
    sensitive_cases: sensitiveCases,
    deliveries_ready: deliveriesReady,
    employee_attention: employeeAttention,
    suggested_focus: suggestedFocus,
    scale_profile: buildMissionControlScaleProfile(),
    generated_at: generatedAt,
  };
}

export function buildMissionControlPreview(dashboard: PierreMissionControlDashboard): {
  status: PierreMissionControlStatus;
  headline: string;
  digest: PierreMissionControlDigest;
  top_actions: PierreMissionControlAction[];
  counts: {
    safe_to_run: number;
    needs_human: number;
    blockers: number;
    sensitive: number;
    deliveries: number;
  };
} {
  const safeList = Array.isArray(dashboard.safe_to_run) ? dashboard.safe_to_run : [];
  const humanList = Array.isArray(dashboard.needs_human) ? dashboard.needs_human : [];
  const blockerList = Array.isArray(dashboard.blockers) ? dashboard.blockers : [];
  const sensitiveList = Array.isArray(dashboard.sensitive) ? dashboard.sensitive : [];
  const deliveryList = Array.isArray(dashboard.deliveries) ? dashboard.deliveries : [];
  const recommended = Array.isArray(dashboard.recommended_order) ? dashboard.recommended_order : [];

  const topActions = recommended.slice(0, 5);

  return {
    status: dashboard.status,
    headline: dashboard.headline,
    digest: dashboard.digest,
    top_actions: topActions,
    counts: {
      safe_to_run: safeList.length,
      needs_human: humanList.length,
      blockers: blockerList.length,
      sensitive: sensitiveList.length,
      deliveries: deliveryList.length,
    },
  };
}
