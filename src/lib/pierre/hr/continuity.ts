/**
 * Pierre Continuity Engine — Pure logic layer v10.5.
 * No DB, no async, no side effects.
 * Takes raw DB rows (Record<string, unknown>) and returns typed continuity views.
 * Classifies mission/task states, builds dashboards, generates continue plans,
 * selects the next safe-to-run tasks, and produces RH operational digests.
 */

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const SEND_TASK_TYPES = new Set(["email.send", "send_email"]);
const TERMINAL_TASK_STATUSES = new Set(["done", "cancelled"]);
const SAFE_RUN_STATUSES = new Set(["ready", "retry"]);
const STALLED_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const RECENTLY_COMPLETED_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const DUE_NOW_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

// ═══════════════════════════════════════════════════════════
// TYPES — NEW (v10.5)
// ═══════════════════════════════════════════════════════════

export type PierreTaskTimeState =
  | "due_now"
  | "overdue"
  | "scheduled_future"
  | "no_schedule";

export type PierreContinuitySectionKey =
  | "due_now"
  | "overdue"
  | "scheduled"
  | "awaiting_approval"
  | "blocked"
  | "failed"
  | "completed_recently"
  | "safe_to_run";

export type PierreContinuitySection = {
  key: PierreContinuitySectionKey;
  label: string;
  task_ids: string[];
  count: number;
};

export type PierreContinuityDigest = {
  text: string;
  tone: "action" | "waiting" | "blocked" | "complete" | "neutral";
};

export type PierreContinuityLogSummary = {
  total: number;
  last_event_type: string | null;
  last_message: string | null;
  last_at: string | null;
};

export type PierreContinuityDocumentSummary = {
  total: number;
  last_title: string | null;
  last_type: string | null;
  last_at: string | null;
};

// ═══════════════════════════════════════════════════════════
// TYPES — EXISTING (enhanced in v10.5)
// ═══════════════════════════════════════════════════════════

export type PierreMissionContinuityState =
  | "active"
  | "stalled"
  | "blocked"
  | "awaiting_approval"
  | "awaiting_info"
  | "completed"
  | "error"
  | "cancelled";

export type PierreTaskContinuityState =
  | "runnable"
  | "awaiting_approval"
  | "blocked"
  | "scheduled"
  | "done"
  | "error"
  | "not_ready";

export type PierreContinuityNextActionType =
  | "run_tasks"
  | "approve_tasks"
  | "provide_info"
  | "investigate_errors"
  | "mission_complete"
  | "no_action";

export type PierreContinuityNextAction = {
  type: PierreContinuityNextActionType;
  label: string;
  task_ids: string[];
};

export type PierreTaskContinuitySlot = {
  task_id: string;
  type: string;
  title: string;
  status: string;
  continuity_state: PierreTaskContinuityState;
  approval_required: boolean;
  is_safe_to_run: boolean;
  blocked_reason: string | null;
  execute_at: string | null;
  priority: number;
  updated_at?: string | null; // v10.5
};

export type PierreContinueAction = {
  task_id: string;
  type: string;
  title: string;
  action: "run" | "approve" | "provide_info" | "investigate";
  reason: string;
};

export type PierreContinuePlan = {
  mission_id: string;
  actions: PierreContinueAction[];
  safe_to_run: string[];
  requires_human: string[];
  blocked: string[];
  summary: string;
};

export type PierreContinuityDashboardMissionEntry = {
  mission_id: string;
  continuity_state: PierreMissionContinuityState;
  progress_pct: number;
  health_score: number;
  is_stalled: boolean;
  runnable_count: number;
  pending_approval_count: number;
  safe_task_ids: string[];
  digest?: PierreContinuityDigest; // v10.5
  log_summary?: PierreContinuityLogSummary; // v10.5
  document_summary?: PierreContinuityDocumentSummary; // v10.5
};

export type PierreMissionContinuityInsight = {
  mission_id: string;
  continuity_state: PierreMissionContinuityState;
  progress_pct: number;
  health_score: number;
  total_count: number;
  done_count: number;
  runnable_count: number;
  pending_approval_count: number;
  blocked_count: number;
  error_count: number;
  scheduled_count: number;
  has_missing_info: boolean;
  is_stalled: boolean;
  stalled_since: string | null;
  recommended_next_action: PierreContinuityNextAction;
  safe_task_ids: string[];
  tasks: PierreTaskContinuitySlot[];
  sections?: PierreContinuitySection[]; // v10.5
  digest?: PierreContinuityDigest; // v10.5
  log_summary?: PierreContinuityLogSummary; // v10.5
  document_summary?: PierreContinuityDocumentSummary; // v10.5
};

export type PierreContinuityDashboard = {
  user_id: string;
  generated_at: string;
  missions_total: number;
  missions_active: number;
  missions_stalled: number;
  missions_awaiting_approval: number;
  missions_completed: number;
  missions_blocked: number;
  missions_error: number;
  total_runnable_tasks: number;
  total_pending_approvals: number;
  total_blocked_tasks: number;
  total_safe_task_ids: string[];
  mission_entries: PierreContinuityDashboardMissionEntry[];
  recommended_next_action: PierreContinuityNextAction | null;
  sections?: PierreContinuitySection[]; // v10.5
};

// ═══════════════════════════════════════════════════════════
// SAFE FIELD EXTRACTORS (internal)
// ═══════════════════════════════════════════════════════════

function asStr(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function asNullStr(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "true" || v === "1") return true;
  return false;
}

// ═══════════════════════════════════════════════════════════
// SECTION METADATA (internal)
// ═══════════════════════════════════════════════════════════

const SECTION_LABELS: Record<PierreContinuitySectionKey, string> = {
  due_now: "À traiter maintenant",
  overdue: "En retard",
  scheduled: "Planifiées",
  awaiting_approval: "En attente d'approbation",
  blocked: "Bloquées",
  failed: "En erreur",
  completed_recently: "Terminées récemment (24h)",
  safe_to_run: "Prêtes à exécuter",
};

const SECTION_ORDER: PierreContinuitySectionKey[] = [
  "due_now",
  "overdue",
  "safe_to_run",
  "awaiting_approval",
  "blocked",
  "failed",
  "scheduled",
  "completed_recently",
];

// ═══════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS — EXISTING
// ═══════════════════════════════════════════════════════════

/**
 * Classifies a raw DB task row into a PierreTaskContinuityState.
 * Accounts for execute_at scheduling and approval requirements.
 */
export function classifyTaskContinuityState(
  task: Record<string, unknown>,
  now: Date = new Date(),
): PierreTaskContinuityState {
  const status = asStr(task.status);
  const approvalRequired = asBool(task.approval_required);
  const executeAt = asNullStr(task.execute_at);

  if (TERMINAL_TASK_STATUSES.has(status)) return "done";
  if (status === "error") return "error";
  if (status === "awaiting_approval") return "awaiting_approval";
  if (status === "blocked") return "blocked";
  if (status === "running") return "runnable";

  if (status === "scheduled") {
    if (executeAt) {
      const due = new Date(executeAt);
      if (!isNaN(due.getTime()) && due.getTime() > now.getTime()) return "scheduled";
    }
    return "runnable";
  }

  if (SAFE_RUN_STATUSES.has(status)) {
    if (approvalRequired) return "awaiting_approval";
    if (executeAt) {
      const due = new Date(executeAt);
      if (!isNaN(due.getTime()) && due.getTime() > now.getTime()) return "scheduled";
    }
    return "runnable";
  }

  return "not_ready";
}

/**
 * Returns true if a task can be automatically executed without human intervention.
 * Rules: status ready|retry, approval_required=false, type not a send type,
 * and execute_at is null or already past.
 */
export function isTaskSafeToRun(
  task: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  const status = asStr(task.status);
  if (!SAFE_RUN_STATUSES.has(status)) return false;
  if (asBool(task.approval_required)) return false;
  if (SEND_TASK_TYPES.has(asStr(task.type))) return false;
  const executeAt = asNullStr(task.execute_at);
  if (executeAt) {
    const due = new Date(executeAt);
    if (!isNaN(due.getTime()) && due.getTime() > now.getTime()) return false;
  }
  return true;
}

/**
 * Builds a fully typed PierreTaskContinuitySlot from a raw DB task row.
 */
export function buildTaskContinuitySlot(
  task: Record<string, unknown>,
  now: Date = new Date(),
): PierreTaskContinuitySlot {
  const state = classifyTaskContinuityState(task, now);
  const taskType = asStr(task.type);
  const safeToRun = state === "runnable" && isTaskSafeToRun(task, now);

  let blockedReason: string | null = null;
  if (state === "awaiting_approval") {
    blockedReason = "Validation humaine requise avant exécution";
  } else if (state === "blocked") {
    blockedReason =
      asNullStr(task.last_error) ??
      "Tâche bloquée — informations manquantes ou dépendance non résolue";
  } else if (state === "scheduled") {
    const due = asNullStr(task.execute_at);
    blockedReason = due ? `Planifiée pour le ${due}` : "Planifiée";
  } else if (state === "runnable" && SEND_TASK_TYPES.has(taskType)) {
    blockedReason = "Envoi d'email — déclenchement manuel requis";
  }

  return {
    task_id: asStr(task.id),
    type: taskType,
    title: asNullStr(task.title) ?? "Tâche sans titre",
    status: asStr(task.status),
    continuity_state: state,
    approval_required: asBool(task.approval_required),
    is_safe_to_run: safeToRun,
    blocked_reason: blockedReason,
    execute_at: asNullStr(task.execute_at),
    priority: asNum(task.priority, 50),
    updated_at: asNullStr(task.updated_at), // v10.5
  };
}

/**
 * Computes mission progress as a percentage (0–100) based on terminal task count.
 */
export function computeMissionProgress(slots: PierreTaskContinuitySlot[]): number {
  if (slots.length === 0) return 0;
  const terminal = slots.filter((s) => s.continuity_state === "done").length;
  return Math.round((terminal / slots.length) * 100);
}

/**
 * Detects whether a mission is stalled: has non-terminal tasks, none runnable,
 * and no activity for longer than STALLED_THRESHOLD_MS.
 */
export function detectStalledMission(
  mission: Record<string, unknown>,
  slots: PierreTaskContinuitySlot[],
  now: Date = new Date(),
): { stalled: boolean; stalled_since: string | null } {
  const missionStatus = asStr(mission.status);
  if (missionStatus === "done" || missionStatus === "cancelled") {
    return { stalled: false, stalled_since: null };
  }

  const activeTasks = slots.filter((s) => s.continuity_state !== "done");
  if (activeTasks.length === 0) return { stalled: false, stalled_since: null };

  const hasRunnable = activeTasks.some((s) => s.continuity_state === "runnable");
  if (hasRunnable) return { stalled: false, stalled_since: null };

  const updatedAt = asNullStr(mission.updated_at) ?? asNullStr(mission.created_at);
  if (!updatedAt) return { stalled: true, stalled_since: null };

  const lastUpdate = new Date(updatedAt);
  if (isNaN(lastUpdate.getTime())) return { stalled: true, stalled_since: null };

  const elapsed = now.getTime() - lastUpdate.getTime();
  if (elapsed >= STALLED_THRESHOLD_MS) {
    return { stalled: true, stalled_since: updatedAt };
  }

  return { stalled: false, stalled_since: null };
}

/**
 * Classifies the overall continuity state of a mission from its task slots.
 * Priority: cancelled > completed > error > awaiting_info > awaiting_approval > active > stalled > blocked
 */
export function classifyMissionContinuityState(
  mission: Record<string, unknown>,
  slots: PierreTaskContinuitySlot[],
  now: Date = new Date(),
): PierreMissionContinuityState {
  const missionStatus = asStr(mission.status);
  if (missionStatus === "cancelled") return "cancelled";

  if (slots.length === 0) {
    if (missionStatus === "done") return "completed";
    return "active";
  }

  const allDone = slots.every((s) => s.continuity_state === "done");
  if (allDone) return "completed";

  const activeTasks = slots.filter((s) => s.continuity_state !== "done");
  const hasRunnable = activeTasks.some((s) => s.continuity_state === "runnable");
  const hasApprovalPending = activeTasks.some(
    (s) => s.continuity_state === "awaiting_approval",
  );
  const allBlocked = activeTasks.every((s) => s.continuity_state === "blocked");
  const allError = activeTasks.every((s) => s.continuity_state === "error");
  const hasMissingInfo =
    Array.isArray(mission.missing_info_json) &&
    (mission.missing_info_json as unknown[]).length > 0;

  if (allError) return "error";
  if (hasMissingInfo || missionStatus === "awaiting_info") return "awaiting_info";
  if (hasApprovalPending && !hasRunnable) return "awaiting_approval";
  if (hasRunnable) return "active";

  const { stalled } = detectStalledMission(mission, slots, now);
  if (stalled) return "stalled";
  if (allBlocked) return "blocked";

  return "active";
}

/**
 * Builds the recommended next action from current task slots.
 * Priority: run_tasks > approve_tasks > investigate_errors > provide_info > mission_complete > no_action
 */
export function buildContinuityRecommendedNextAction(
  slots: PierreTaskContinuitySlot[],
): PierreContinuityNextAction {
  const runnableSafe = slots.filter((s) => s.is_safe_to_run);
  if (runnableSafe.length > 0) {
    return {
      type: "run_tasks",
      label: `Lancer ${runnableSafe.length} tâche(s) prête(s) à exécution automatique`,
      task_ids: runnableSafe.map((s) => s.task_id),
    };
  }

  const pendingApproval = slots.filter((s) => s.continuity_state === "awaiting_approval");
  if (pendingApproval.length > 0) {
    return {
      type: "approve_tasks",
      label: `${pendingApproval.length} tâche(s) en attente d'approbation humaine`,
      task_ids: pendingApproval.map((s) => s.task_id),
    };
  }

  const errorTasks = slots.filter((s) => s.continuity_state === "error");
  if (errorTasks.length > 0) {
    return {
      type: "investigate_errors",
      label: `${errorTasks.length} tâche(s) en erreur à investiguer`,
      task_ids: errorTasks.map((s) => s.task_id),
    };
  }

  const blockedTasks = slots.filter((s) => s.continuity_state === "blocked");
  if (blockedTasks.length > 0) {
    return {
      type: "provide_info",
      label: `${blockedTasks.length} tâche(s) bloquée(s) — informations manquantes`,
      task_ids: blockedTasks.map((s) => s.task_id),
    };
  }

  const allDone = slots.every((s) => s.continuity_state === "done");
  if (allDone && slots.length > 0) {
    return {
      type: "mission_complete",
      label: "Mission complète — toutes les tâches sont terminées",
      task_ids: [],
    };
  }

  return {
    type: "no_action",
    label: "Aucune action disponible pour le moment",
    task_ids: [],
  };
}

/**
 * Scores mission continuity health from 0 (broken) to 100 (perfect).
 * Deductions: -15 per error task, -10 per blocked task, -5 per pending approval, -20 if stalled.
 */
export function scoreMissionContinuityHealth(
  insight: PierreMissionContinuityInsight,
): number {
  if (insight.progress_pct === 100) return 100;
  if (insight.total_count === 0) return 50;

  let score = 100;
  score -= insight.error_count * 15;
  score -= insight.blocked_count * 10;
  score -= insight.pending_approval_count * 5;
  if (insight.is_stalled) score -= 20;
  if (insight.runnable_count > 0) score = Math.max(score, 30);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Builds a full PierreMissionContinuityInsight for a single mission and its tasks.
 * v10.5: also computes sections, digest, and optional log/document summaries.
 */
export function buildMissionContinuityInsight(
  mission: Record<string, unknown>,
  tasks: Record<string, unknown>[],
  options?: {
    now?: Date;
    logs?: Record<string, unknown>[];
    documents?: Record<string, unknown>[];
  },
): PierreMissionContinuityInsight {
  const now = options?.now ?? new Date();
  const missionId = asStr(mission.id);
  const slots = tasks.map((t) => buildTaskContinuitySlot(t, now));

  const total = slots.length;
  const doneCount = slots.filter((s) => s.continuity_state === "done").length;
  const runnableCount = slots.filter((s) => s.continuity_state === "runnable").length;
  const pendingApprovalCount = slots.filter(
    (s) => s.continuity_state === "awaiting_approval",
  ).length;
  const blockedCount = slots.filter((s) => s.continuity_state === "blocked").length;
  const errorCount = slots.filter((s) => s.continuity_state === "error").length;
  const scheduledCount = slots.filter((s) => s.continuity_state === "scheduled").length;
  const hasMissingInfo =
    Array.isArray(mission.missing_info_json) &&
    (mission.missing_info_json as unknown[]).length > 0;

  const { stalled, stalled_since } = detectStalledMission(mission, slots, now);
  const continuityState = classifyMissionContinuityState(mission, slots, now);
  const progressPct = computeMissionProgress(slots);
  const recommendedNextAction = buildContinuityRecommendedNextAction(slots);
  const safeTaskIds = slots
    .filter((s) => s.is_safe_to_run)
    .map((s) => s.task_id);

  const sections = buildMissionSections(slots, now);

  const insight: PierreMissionContinuityInsight = {
    mission_id: missionId,
    continuity_state: continuityState,
    progress_pct: progressPct,
    health_score: 0,
    total_count: total,
    done_count: doneCount,
    runnable_count: runnableCount,
    pending_approval_count: pendingApprovalCount,
    blocked_count: blockedCount,
    error_count: errorCount,
    scheduled_count: scheduledCount,
    has_missing_info: hasMissingInfo,
    is_stalled: stalled,
    stalled_since,
    recommended_next_action: recommendedNextAction,
    safe_task_ids: safeTaskIds,
    tasks: slots,
    sections,
  };

  insight.health_score = scoreMissionContinuityHealth(insight);
  insight.digest = buildMissionContinuityDigest(insight, sections);

  if (options?.logs !== undefined) {
    insight.log_summary = summarizeMissionLogs(options.logs);
  }
  if (options?.documents !== undefined) {
    insight.document_summary = summarizeMissionDocuments(options.documents);
  }

  return insight;
}

/**
 * Builds a PierreContinuePlan for a single mission — ordered, actionable steps.
 */
export function buildContinuePlan(
  mission: Record<string, unknown>,
  tasks: Record<string, unknown>[],
  options?: { now?: Date },
): PierreContinuePlan {
  const now = options?.now ?? new Date();
  const missionId = asStr(mission.id);
  const slots = tasks.map((t) => buildTaskContinuitySlot(t, now));

  const actions: PierreContinueAction[] = [];
  const safeToRun: string[] = [];
  const requiresHuman: string[] = [];
  const blocked: string[] = [];

  for (const slot of slots) {
    if (slot.continuity_state === "done") continue;

    if (slot.is_safe_to_run) {
      safeToRun.push(slot.task_id);
      actions.push({
        task_id: slot.task_id,
        type: slot.type,
        title: slot.title,
        action: "run",
        reason: "Tâche prête — aucune validation requise, exécution automatique possible",
      });
    } else if (slot.continuity_state === "awaiting_approval") {
      requiresHuman.push(slot.task_id);
      actions.push({
        task_id: slot.task_id,
        type: slot.type,
        title: slot.title,
        action: "approve",
        reason: "Validation humaine requise avant toute exécution",
      });
    } else if (slot.continuity_state === "blocked") {
      blocked.push(slot.task_id);
      actions.push({
        task_id: slot.task_id,
        type: slot.type,
        title: slot.title,
        action: "provide_info",
        reason:
          slot.blocked_reason ??
          "Informations manquantes — compléter pour débloquer",
      });
    } else if (slot.continuity_state === "error") {
      actions.push({
        task_id: slot.task_id,
        type: slot.type,
        title: slot.title,
        action: "investigate",
        reason: "Tâche en erreur — investigation requise avant relance",
      });
    } else if (slot.continuity_state === "runnable" && SEND_TASK_TYPES.has(slot.type)) {
      requiresHuman.push(slot.task_id);
      actions.push({
        task_id: slot.task_id,
        type: slot.type,
        title: slot.title,
        action: "approve",
        reason:
          "Envoi d'email — déclenchement manuel requis pour prévenir les envois non souhaités",
      });
    }
  }

  const parts: string[] = [];
  if (safeToRun.length > 0) {
    parts.push(`${safeToRun.length} tâche(s) exécutable(s) automatiquement`);
  }
  if (requiresHuman.length > 0) {
    parts.push(`${requiresHuman.length} tâche(s) requérant intervention humaine`);
  }
  if (blocked.length > 0) {
    parts.push(`${blocked.length} tâche(s) bloquée(s)`);
  }

  const summary =
    parts.length > 0
      ? parts.join(", ") + "."
      : "Aucune action disponible — mission complète ou sans tâches actives.";

  return {
    mission_id: missionId,
    actions,
    safe_to_run: safeToRun,
    requires_human: requiresHuman,
    blocked,
    summary,
  };
}

/**
 * Selects the next batch of safe-to-run tasks from any collection.
 * Sorted by priority descending, then created_at ascending (FIFO within priority).
 */
export function selectNextRunnableTasks(
  tasks: Record<string, unknown>[],
  options?: { max?: number; now?: Date },
): Record<string, unknown>[] {
  const now = options?.now ?? new Date();
  const max = options?.max ?? 10;

  return tasks
    .filter((t) => isTaskSafeToRun(t, now))
    .sort((a, b) => {
      const pa = asNum(a.priority, 50);
      const pb = asNum(b.priority, 50);
      if (pb !== pa) return pb - pa;
      const ca = asNullStr(a.created_at) ?? "";
      const cb = asNullStr(b.created_at) ?? "";
      return ca.localeCompare(cb);
    })
    .slice(0, max);
}

/**
 * Builds a full PierreContinuityDashboard across multiple missions.
 * tasksByMissionId: tasks grouped by mission_id (keyed by mission.id).
 * v10.5: accepts optional logsByMissionId and documentsByMissionId for richer per-mission entries.
 * v10.5: returns aggregated sections across all missions.
 */
export function buildContinuityDashboard(
  userId: string,
  missions: Record<string, unknown>[],
  tasksByMissionId: Record<string, Record<string, unknown>[]>,
  options?: {
    now?: Date;
    logsByMissionId?: Record<string, Record<string, unknown>[]>;
    documentsByMissionId?: Record<string, Record<string, unknown>[]>;
  },
): PierreContinuityDashboard {
  const now = options?.now ?? new Date();
  const generatedAt = now.toISOString();

  const entries: PierreContinuityDashboardMissionEntry[] = [];
  const totalSafeTaskIds: string[] = [];
  let totalRunnable = 0;
  let totalPendingApprovals = 0;
  let totalBlocked = 0;

  let missionsActive = 0;
  let missionsStalled = 0;
  let missionsAwaitingApproval = 0;
  let missionsCompleted = 0;
  let missionsBlocked = 0;
  let missionsError = 0;

  const ACTION_PRIORITY: Record<string, number> = {
    run_tasks: 4,
    approve_tasks: 3,
    investigate_errors: 2,
    provide_info: 1,
    mission_complete: 0,
    no_action: 0,
  };

  let globalBestAction: PierreContinuityNextAction | null = null;

  for (const mission of missions) {
    const mId = asStr(mission.id);
    const tasks = tasksByMissionId[mId] ?? [];
    const logs = options?.logsByMissionId ? options.logsByMissionId[mId] : undefined;
    const documents = options?.documentsByMissionId
      ? options.documentsByMissionId[mId]
      : undefined;
    const insight = buildMissionContinuityInsight(mission, tasks, { now, logs, documents });

    entries.push({
      mission_id: mId,
      continuity_state: insight.continuity_state,
      progress_pct: insight.progress_pct,
      health_score: insight.health_score,
      is_stalled: insight.is_stalled,
      runnable_count: insight.runnable_count,
      pending_approval_count: insight.pending_approval_count,
      safe_task_ids: insight.safe_task_ids,
      digest: insight.digest,
      log_summary: insight.log_summary,
      document_summary: insight.document_summary,
    });

    for (const tid of insight.safe_task_ids) totalSafeTaskIds.push(tid);
    totalRunnable += insight.runnable_count;
    totalPendingApprovals += insight.pending_approval_count;
    totalBlocked += insight.blocked_count;

    switch (insight.continuity_state) {
      case "active":
        missionsActive++;
        break;
      case "stalled":
        missionsStalled++;
        break;
      case "awaiting_approval":
        missionsAwaitingApproval++;
        break;
      case "completed":
        missionsCompleted++;
        break;
      case "blocked":
      case "awaiting_info":
        missionsBlocked++;
        break;
      case "error":
        missionsError++;
        break;
      case "cancelled":
        break;
    }

    const na = insight.recommended_next_action;
    if (na.type !== "no_action" && na.type !== "mission_complete") {
      const naPrio = ACTION_PRIORITY[na.type] ?? 0;
      const bestPrio = globalBestAction ? (ACTION_PRIORITY[globalBestAction.type] ?? 0) : -1;
      if (naPrio > bestPrio) {
        globalBestAction = na;
      }
    }
  }

  const sections = buildDashboardSections(missions, tasksByMissionId, now);

  return {
    user_id: userId,
    generated_at: generatedAt,
    missions_total: missions.length,
    missions_active: missionsActive,
    missions_stalled: missionsStalled,
    missions_awaiting_approval: missionsAwaitingApproval,
    missions_completed: missionsCompleted,
    missions_blocked: missionsBlocked,
    missions_error: missionsError,
    total_runnable_tasks: totalRunnable,
    total_pending_approvals: totalPendingApprovals,
    total_blocked_tasks: totalBlocked,
    total_safe_task_ids: totalSafeTaskIds,
    mission_entries: entries,
    recommended_next_action: globalBestAction,
    sections,
  };
}

// ═══════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS — NEW (v10.5)
// ═══════════════════════════════════════════════════════════

/**
 * Classifies the time state of a task based on its execute_at field relative to now.
 * - overdue: execute_at is in the past
 * - due_now: execute_at is within the next 24h
 * - scheduled_future: execute_at is beyond 24h
 * - no_schedule: no execute_at
 */
export function classifyTaskTimeState(
  task: Record<string, unknown>,
  now: Date = new Date(),
): PierreTaskTimeState {
  const executeAt = asNullStr(task.execute_at);
  if (!executeAt) return "no_schedule";

  const due = new Date(executeAt);
  if (isNaN(due.getTime())) return "no_schedule";

  const diff = due.getTime() - now.getTime();

  if (diff < 0) return "overdue";
  if (diff <= DUE_NOW_WINDOW_MS) return "due_now";
  return "scheduled_future";
}

/**
 * Returns true if a task was completed (done or cancelled) within the last windowMs milliseconds.
 */
export function isTaskCompletedRecently(
  task: Record<string, unknown>,
  now: Date = new Date(),
  windowMs = RECENTLY_COMPLETED_WINDOW_MS,
): boolean {
  const status = asStr(task.status);
  if (!TERMINAL_TASK_STATUSES.has(status)) return false;

  const updatedAt = asNullStr(task.updated_at);
  if (!updatedAt) return false;

  const updated = new Date(updatedAt);
  if (isNaN(updated.getTime())) return false;

  return now.getTime() - updated.getTime() <= windowMs;
}

/**
 * Groups task slots into the 8 operational sections for RH piloting.
 * Returns all 8 sections (empty ones included for predictable structure).
 * A slot can appear in multiple sections (e.g., due_now + safe_to_run).
 */
export function buildMissionSections(
  slots: PierreTaskContinuitySlot[],
  now: Date = new Date(),
): PierreContinuitySection[] {
  const buckets: Record<PierreContinuitySectionKey, string[]> = {
    due_now: [],
    overdue: [],
    scheduled: [],
    awaiting_approval: [],
    blocked: [],
    failed: [],
    completed_recently: [],
    safe_to_run: [],
  };

  for (const slot of slots) {
    if (slot.is_safe_to_run) {
      buckets.safe_to_run.push(slot.task_id);
    }

    if (slot.continuity_state === "awaiting_approval") {
      buckets.awaiting_approval.push(slot.task_id);
    } else if (slot.continuity_state === "blocked") {
      buckets.blocked.push(slot.task_id);
    } else if (slot.continuity_state === "error") {
      buckets.failed.push(slot.task_id);
    } else if (slot.continuity_state === "scheduled") {
      buckets.scheduled.push(slot.task_id);
    }

    if (slot.continuity_state === "done" && slot.updated_at) {
      const updated = new Date(slot.updated_at);
      if (
        !isNaN(updated.getTime()) &&
        now.getTime() - updated.getTime() <= RECENTLY_COMPLETED_WINDOW_MS
      ) {
        buckets.completed_recently.push(slot.task_id);
      }
    }

    if (slot.execute_at && slot.continuity_state !== "done") {
      const due = new Date(slot.execute_at);
      if (!isNaN(due.getTime())) {
        const diff = due.getTime() - now.getTime();
        if (diff < 0) {
          buckets.overdue.push(slot.task_id);
        } else if (diff <= DUE_NOW_WINDOW_MS) {
          buckets.due_now.push(slot.task_id);
        }
      }
    }
  }

  return SECTION_ORDER.map((key) => ({
    key,
    label: SECTION_LABELS[key],
    task_ids: buckets[key],
    count: buckets[key].length,
  }));
}

/**
 * Summarizes a list of pierre_task_logs rows into a compact PierreContinuityLogSummary.
 * Uses the new log schema: event_type + message + meta_json.
 */
export function summarizeMissionLogs(
  logs: Record<string, unknown>[],
): PierreContinuityLogSummary {
  if (logs.length === 0) {
    return { total: 0, last_event_type: null, last_message: null, last_at: null };
  }

  const sorted = [...logs].sort((a, b) => {
    const ta = asNullStr(a.created_at) ?? "";
    const tb = asNullStr(b.created_at) ?? "";
    return tb.localeCompare(ta);
  });

  const last = sorted[0];
  return {
    total: logs.length,
    last_event_type: asNullStr(last.event_type),
    last_message: asNullStr(last.message),
    last_at: asNullStr(last.created_at),
  };
}

/**
 * Summarizes a list of pierre_documents rows into a compact PierreContinuityDocumentSummary.
 */
export function summarizeMissionDocuments(
  documents: Record<string, unknown>[],
): PierreContinuityDocumentSummary {
  if (documents.length === 0) {
    return { total: 0, last_title: null, last_type: null, last_at: null };
  }

  const sorted = [...documents].sort((a, b) => {
    const ta = asNullStr(a.created_at) ?? "";
    const tb = asNullStr(b.created_at) ?? "";
    return tb.localeCompare(ta);
  });

  const last = sorted[0];
  return {
    total: documents.length,
    last_title: asNullStr(last.title),
    last_type: asNullStr(last.doc_type) ?? asNullStr(last.type),
    last_at: asNullStr(last.created_at),
  };
}

/**
 * Builds a French RH narrative digest from a mission insight and its sections.
 * Returns a short operational summary with a tone classification.
 */
export function buildMissionContinuityDigest(
  insight: PierreMissionContinuityInsight,
  sections: PierreContinuitySection[],
): PierreContinuityDigest {
  if (insight.progress_pct === 100) {
    return {
      text: "Mission complète — toutes les tâches sont terminées.",
      tone: "complete",
    };
  }

  const byKey = (key: PierreContinuitySectionKey) =>
    sections.find((s) => s.key === key)?.count ?? 0;

  const safeCount = byKey("safe_to_run");
  const approvalCount = byKey("awaiting_approval");
  const blockedCount = byKey("blocked");
  const failedCount = byKey("failed");
  const overdueCount = byKey("overdue");
  const dueNowCount = byKey("due_now");

  const parts: string[] = [];

  if (dueNowCount > 0) {
    parts.push(`${dueNowCount} tâche(s) à traiter maintenant.`);
  }
  if (overdueCount > 0) {
    parts.push(`${overdueCount} tâche(s) en retard.`);
  }
  if (safeCount > 0) {
    parts.push(`${safeCount} tâche(s) prête(s) à exécution automatique.`);
  }
  if (approvalCount > 0) {
    parts.push(`${approvalCount} tâche(s) en attente d'approbation humaine.`);
  }
  if (blockedCount > 0) {
    parts.push(`${blockedCount} tâche(s) bloquée(s) — informations manquantes.`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} tâche(s) en erreur — investigation requise.`);
  }
  if (insight.is_stalled) {
    parts.push("Mission bloquée depuis plus de 3 jours — intervention recommandée.");
  }

  if (parts.length === 0) {
    parts.push("Mission en cours — aucune action immédiate requise.");
  }

  parts.push(`Progression : ${insight.progress_pct}%.`);

  let tone: PierreContinuityDigest["tone"] = "neutral";
  if (safeCount > 0) {
    tone = "action";
  } else if (approvalCount > 0) {
    tone = "waiting";
  } else if (blockedCount > 0 || failedCount > 0) {
    tone = "blocked";
  }

  return { text: parts.join(" "), tone };
}

/**
 * Aggregates sections across all missions for the global continuity dashboard.
 * Returns all 8 sections with cumulative task_ids from all missions.
 */
export function buildDashboardSections(
  missions: Record<string, unknown>[],
  tasksByMissionId: Record<string, Record<string, unknown>[]>,
  now: Date = new Date(),
): PierreContinuitySection[] {
  const buckets: Record<PierreContinuitySectionKey, string[]> = {
    due_now: [],
    overdue: [],
    scheduled: [],
    awaiting_approval: [],
    blocked: [],
    failed: [],
    completed_recently: [],
    safe_to_run: [],
  };

  for (const mission of missions) {
    const mId = asStr(mission.id);
    const tasks = tasksByMissionId[mId] ?? [];
    const slots = tasks.map((t) => buildTaskContinuitySlot(t, now));
    const missionSections = buildMissionSections(slots, now);

    for (const section of missionSections) {
      for (const taskId of section.task_ids) {
        buckets[section.key].push(taskId);
      }
    }
  }

  return SECTION_ORDER.map((key) => ({
    key,
    label: SECTION_LABELS[key],
    task_ids: buckets[key],
    count: buckets[key].length,
  }));
}

/**
 * Generates followup task drafts from a continue plan, suitable for DB insertion.
 * Only creates tasks if there are blocked or requires_human task_ids.
 * Followup types: reminder.create (for blocked), followup.schedule (for requires_human).
 * Never creates email.send or approval_required tasks.
 */
export function buildFollowupTaskDraftsForContinue(
  missionId: string,
  plan: PierreContinuePlan,
): Record<string, unknown>[] {
  const drafts: Record<string, unknown>[] = [];

  if (plan.blocked.length > 0) {
    drafts.push({
      mission_id: missionId,
      type: "reminder.create",
      title: `Relance — ${plan.blocked.length} tâche(s) bloquée(s) à débloquer`,
      status: "ready",
      approval_required: false,
      execute_at: null,
      priority: 40,
      payload_json: {
        source: "continuity_continue",
        blocked_task_ids: plan.blocked,
        reason: "Tâches bloquées détectées lors de la continuité de mission",
      },
    });
  }

  if (plan.requires_human.length > 0) {
    drafts.push({
      mission_id: missionId,
      type: "followup.schedule",
      title: `Suivi humain — ${plan.requires_human.length} tâche(s) en attente de validation`,
      status: "ready",
      approval_required: false,
      execute_at: null,
      priority: 35,
      payload_json: {
        source: "continuity_continue",
        requires_human_task_ids: plan.requires_human,
        reason: "Tâches nécessitant intervention humaine détectées lors de la continuité",
      },
    });
  }

  return drafts;
}
