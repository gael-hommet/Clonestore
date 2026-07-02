// src/lib/client-cockpit/v1.ts
// P9.3 — Pont RÉEL runtime V1 → modèles d'affichage canoniques.
//
// Les réponses V1 (contrats stricts zod côté client P8) utilisent des noms de
// champs propres à V1 (mission_id, risk, objective, sensitivity, version…),
// différents du chemin legacy. Ces mappers défensifs (jamais throw, entrée
// `unknown`) produisent directement les modèles `client-cockpit`. Aucun import de
// code serveur P8 ; on consomme uniquement la forme des réponses HTTP.

import {
  humanize,
  maxUrgency,
  missionStatusView,
  riskTone,
  riskUrgency,
  taskStatusView,
  toTaskStatus,
  validationStatusView,
} from "./status";
import type { CockpitPermissions } from "./permissions";
import { DEFAULT_PERMISSIONS } from "./permissions";
import type {
  CockpitArtifact,
  CockpitEmployeeListItem,
  CockpitMissionSummary,
  CockpitNextAction,
  CockpitTask,
  CockpitTimelineEvent,
  CockpitTone,
  CockpitValidation,
} from "./types";

// ── helpers défensifs ─────────────────────────────────────────────────────────
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown, fb = ""): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fb;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
function bool(v: unknown): boolean {
  return v === true;
}
function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter(isObject) : [];
}
function isoOf(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v instanceof Date) return v.toISOString();
  return null;
}

// Classification par MOTS-CLÉS (le runtime V1 utilise un vocabulaire varié :
// prepare_sensitive_draft, reminder, communication, deadline_reminder, signature…).
const COMM_RE = /email|mail|communication|reminder|relance|notification|convocation|message/i;
const DOC_RE = /draft|document|contract|contrat|letter|lettre|attestation|amendment|avenant|signature|signed|pdf|certificate|convention|offre|offboarding/i;
const SENSITIVE_RE = /sensitive|sensible|contract|contrat|signature|amendment|avenant|offboarding|licenciement|dismissal|rupture|prud/i;

function isCommType(type: string): boolean { return COMM_RE.test(type); }
function isDocType(type: string): boolean { return DOC_RE.test(type); }

const TERMINAL_TASK = new Set(["succeeded", "completed", "done", "failed", "cancelled", "canceled", "archived"]);
const DONE_TASK = new Set(["succeeded", "completed", "done", "archived"]);

// ── Missions ──────────────────────────────────────────────────────────────────

/** Item de liste V1 `{id,status,risk,summary,created_at}` → résumé mission. */
export function mapV1MissionListItem(raw: unknown): CockpitMissionSummary | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id ?? raw.mission_id);
  if (!id) return null;
  const statusView = missionStatusView(str(raw.status));
  const canonical = statusView.canonical as CockpitMissionSummary["status"];
  return {
    id,
    title: str(raw.summary) || "Mission",
    summary: str(raw.summary) || null,
    status: canonical,
    statusView,
    urgency: maxUrgency(statusView.urgency, riskUrgency(str(raw.risk))),
    progress: canonical === "done" ? 1 : 0,
    tasksTotal: 0,
    tasksDone: 0,
    tasksBlocked: 0,
    tasksAwaiting: 0,
    employee: null,
    nextAction: { label: "Ouvrir la mission", kind: "open", allowed: true },
    createdAt: isoOf(raw.created_at),
    dueAt: null,
    blockedReason: canonical === "blocked" ? "Une tâche de la mission est bloquée." : null,
    provenance: "pierre",
    freshness: "live",
  };
}

export function mapV1MissionList(raw: unknown): { missions: CockpitMissionSummary[]; nextCursor: string | null } {
  const items = isObject(raw) ? arr(raw.items) : Array.isArray(raw) ? arr(raw) : [];
  const missions = items.map(mapV1MissionListItem).filter((m): m is CockpitMissionSummary => m !== null);
  const nextCursor = isObject(raw) ? (str(raw.next_cursor) || null) : null;
  return { missions, nextCursor };
}

function missionNextAction(status: CockpitMissionSummary["status"], nextActionRaw: string | null): CockpitNextAction {
  if (status === "understanding") return { label: "Compléter les informations", kind: "open", allowed: true };
  if (status === "awaiting_approval") return { label: "Voir les validations", kind: "open", allowed: true };
  if (status === "blocked") return { label: "Débloquer la mission", kind: "open", allowed: true };
  if (nextActionRaw) return { label: "Ouvrir la mission", kind: "open", allowed: true };
  return { label: "Ouvrir la mission", kind: "open", allowed: true };
}

/** Détail V1 `MissionView` → résumé mission enrichi (compteurs depuis tasks[]). */
export function mapV1MissionView(
  raw: unknown,
  opts: { employee?: CockpitMissionSummary["employee"]; freshness?: "live" | "stale" } = {},
): CockpitMissionSummary | null {
  const mission = isObject(raw) ? (isObject(raw.mission) ? raw.mission : raw) : null;
  if (!mission) return null;
  const id = str(mission.mission_id ?? mission.id);
  if (!id) return null;
  const tasks = arr(mission.tasks);
  let done = 0, blocked = 0, awaiting = 0;
  for (const t of tasks) {
    const cs = toTaskStatus(str(t.status)); // canonique (succeeded→completed, awaiting_validation→awaiting_approval)
    if (cs === "completed") done++;
    else if (cs === "blocked" || cs === "failed") blocked++;
    else if (cs === "awaiting_approval") awaiting++;
  }
  const statusView = missionStatusView(str(mission.status));
  const canonical = statusView.canonical as CockpitMissionSummary["status"];
  const total = tasks.length;
  return {
    id,
    title: str(mission.summary) || "Mission",
    summary: str(mission.summary) || null,
    status: canonical,
    statusView,
    urgency: maxUrgency(statusView.urgency, riskUrgency(str(mission.risk))),
    progress: total > 0 ? Math.min(1, done / total) : canonical === "done" ? 1 : 0,
    tasksTotal: total,
    tasksDone: done,
    tasksBlocked: blocked,
    tasksAwaiting: awaiting,
    employee: opts.employee ?? null,
    nextAction: missionNextAction(canonical, str(mission.next_action) || null),
    createdAt: isoOf(mission.created_at),
    dueAt: null,
    blockedReason: canonical === "blocked" ? "Une tâche de la mission est bloquée." : null,
    provenance: "pierre",
    freshness: opts.freshness ?? "live",
  };
}

// ── Tâches ──────────────────────────────────────────────────────────────────

/** V1 TaskView `{id,type,objective,status,risk,sensitivity,approval_required,…}`. */
export function mapV1Task(raw: unknown, missionId: string | null = null): CockpitTask | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const type = str(raw.type, "unknown");
  const statusView = taskStatusView(str(raw.status));
  const sensitivity = str(raw.sensitivity).toLowerCase();
  return {
    id,
    missionId: str(raw.mission_id) || missionId,
    title: str(raw.objective) || humanize(type),
    status: statusView.canonical as CockpitTask["status"],
    statusView,
    requiresValidation: bool(raw.approval_required),
    isSensitive: bool(raw.approval_required) || sensitivity === "high" || sensitivity === "sensitive" || SENSITIVE_RE.test(type),
    isEmail: isCommType(type),
    scheduledFor: isoOf(raw.execute_at ?? raw.scheduled_for),
    blockedReason: str(raw.blocked_reason ?? raw.error_message) || null,
  };
}

export function mapV1Tasks(raw: unknown, missionId: string | null = null): CockpitTask[] {
  const list = Array.isArray(raw) ? arr(raw) : isObject(raw) ? arr(raw.tasks ?? raw.items) : [];
  return list.map((t) => mapV1Task(t, missionId)).filter((t): t is CockpitTask => t !== null);
}

// ── Validations ───────────────────────────────────────────────────────────────

function riskFromContext(ctx: unknown): string {
  if (!isObject(ctx)) return "";
  return str(ctx.risk ?? ctx.risk_level ?? ctx.level);
}

function validationActions(perms: CockpitPermissions): CockpitNextAction[] {
  if (!perms.canDecideValidations) {
    const denied = (label: string, kind: CockpitNextAction["kind"]): CockpitNextAction => ({
      label, kind, allowed: false, reason: "Votre rôle ne permet pas de décider des validations.",
    });
    return [denied("Approuver", "approve"), denied("Demander des modifications", "request_changes"), denied("Refuser", "reject")];
  }
  return [
    { label: "Approuver", kind: "approve", allowed: true },
    { label: "Demander des modifications", kind: "request_changes", allowed: true },
    { label: "Refuser", kind: "reject", allowed: true },
  ];
}

/** V1 ValidationView `{id,status,reason,validator_role,task_id,version,risk_context}`. */
export function mapV1Validation(
  raw: unknown,
  opts: { permissions?: CockpitPermissions; missionId?: string | null; task?: CockpitTask | null; employee?: CockpitValidation["employee"] } = {},
): CockpitValidation | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const perms = opts.permissions ?? DEFAULT_PERMISSIONS;
  const statusView = validationStatusView(str(raw.status));
  const risk = riskFromContext(raw.risk_context);
  const task = opts.task ?? null;
  const intent = task?.title || str(raw.reason) || "Décision requise";
  return {
    id,
    taskId: str(raw.task_id) || null,
    missionId: opts.missionId ?? null,
    title: intent,
    intent,
    status: statusView.canonical as CockpitValidation["status"],
    statusView,
    urgency: maxUrgency(statusView.urgency, riskUrgency(risk)),
    reason: str(raw.reason) || null,
    isSensitive: (task?.isSensitive ?? false) || riskTone(risk) === "danger",
    isEmail: task?.isEmail ?? false,
    employee: opts.employee ?? null,
    version: num(raw.version),
    createdAt: isoOf(raw.created_at),
    actions: statusView.canonical === "pending" ? validationActions(perms) : [],
  };
}

export function mapV1Validations(
  raw: unknown,
  opts: { permissions?: CockpitPermissions; missionId?: string | null; tasksById?: Map<string, CockpitTask> } = {},
): CockpitValidation[] {
  const list = Array.isArray(raw) ? arr(raw) : isObject(raw) ? arr(raw.items ?? raw.validations) : [];
  return list
    .map((v) => mapV1Validation(v, {
      permissions: opts.permissions,
      missionId: opts.missionId,
      task: opts.tasksById?.get(str(v.task_id)) ?? null,
    }))
    .filter((v): v is CockpitValidation => v !== null);
}

// ── Documents / livrables (dérivés des tâches documentaires réelles) ──────────
// V1 n'expose pas de liste documents par mission ; les livrables réels sont les
// sorties des tâches doc/pdf/email. On dérive un artifact par tâche documentaire
// terminée, avec un statut honnête. Aucun faux document.

export function deriveV1Artifacts(
  tasksRaw: unknown,
  opts: { permissions?: CockpitPermissions; missionId?: string | null } = {},
): CockpitArtifact[] {
  const perms = opts.permissions ?? DEFAULT_PERMISSIONS;
  const list = Array.isArray(tasksRaw) ? arr(tasksRaw) : isObject(tasksRaw) ? arr(tasksRaw.tasks) : [];
  const out: CockpitArtifact[] = [];
  for (const t of list) {
    const type = str(t.type).toLowerCase();
    const isComm = isCommType(type);
    const isDoc = isDocType(type);
    if (!isDoc && !isComm) continue;
    const id = str(t.id);
    if (!id) continue;
    const status = str(t.status).toLowerCase();
    const requiresValidation = bool(t.approval_required);
    // Statut d'affichage : à valider si approbation requise et pas terminé, sinon d'après l'état de tâche.
    let artStatus: CockpitArtifact["status"] = "draft";
    if (requiresValidation && !TERMINAL_TASK.has(status)) artStatus = "awaiting_validation";
    else if (DONE_TASK.has(status)) artStatus = isComm && !isDoc ? "sent" : "validated";
    else if (status === "failed" || status === "blocked" || status === "escalated") artStatus = "needs_review";
    // Une communication (email/relance) prime la famille « Communication » sur « Document ».
    const family = isDoc && !isComm ? "Document" : isComm && !isDoc ? "Communication" : "Document";
    out.push({
      id,
      missionId: str(t.mission_id) || opts.missionId || null,
      title: str(t.objective) || humanize(type),
      family,
      status: artStatus,
      statusView: { canonical: artStatus, label: artStatus === "sent" ? "Envoyé" : artStatus === "validated" ? "Validé" : artStatus === "awaiting_validation" ? "À valider" : artStatus === "needs_review" ? "À relire" : "Brouillon", tone: artStatus === "validated" || artStatus === "sent" ? "success" : artStatus === "needs_review" || artStatus === "awaiting_validation" ? "warning" : "neutral", urgency: artStatus === "awaiting_validation" || artStatus === "needs_review" ? "high" : "low" },
      isPdf: /pdf/.test(type),
      qualityScore: null,
      requiresValidation,
      employee: null,
      createdAt: isoOf(t.created_at),
      canPreview: TERMINAL_TASK.has(status),
      canDownload: perms.canDownloadDocuments && DONE_TASK.has(status),
    });
  }
  return out;
}

// ── Timeline ──────────────────────────────────────────────────────────────────
// V1 TimelineEvent `{type,actor_type,prev_state,new_state,task_id,created_at,metadata}`.

const V1_KIND: Record<string, CockpitTimelineEvent["kind"]> = {
  mission_created: "mission", mission_completed: "mission", mission_cancelled: "mission",
  task_created: "task", task_started: "task", task_completed: "task",
  task_failed: "incident", task_blocked: "incident",
  validation_requested: "validation", validation_approved: "validation", validation_rejected: "validation", validation_changes_requested: "validation",
  document_generated: "document", email_prepared: "communication", email_sent: "communication",
};

export function mapV1TimelineEvent(raw: unknown, index = 0): CockpitTimelineEvent {
  const o = isObject(raw) ? raw : {};
  const type = str(o.type).toLowerCase();
  const kind = V1_KIND[type] ?? "system";
  const actorType = str(o.actor_type).toLowerCase();
  const actor = actorType === "human" || actorType === "user" ? "human" : actorType === "system" ? "system" : "pierre";
  const tone = kind === "incident" ? "danger" : kind === "validation" ? "warning" : "neutral";
  return {
    id: str(o.id) || `evt-${index}`,
    kind,
    title: humanize(type || "event"),
    at: isoOf(o.created_at),
    actor,
    missionId: str(o.mission_id) || null,
    employee: null,
    tone,
    detail: null, // metadata brute jamais exposée
  };
}

export function mapV1Timeline(raw: unknown): CockpitTimelineEvent[] {
  const list = Array.isArray(raw) ? arr(raw) : isObject(raw) ? arr(raw.items ?? raw.events) : [];
  return list.map((e, i) => mapV1TimelineEvent(e, i));
}

// ── Salariés (liste V1) ───────────────────────────────────────────────────────

const EMP_STATUS: Record<string, { label: string; tone: CockpitTone }> = {
  active: { label: "Actif", tone: "success" },
  onboarding: { label: "En intégration", tone: "info" },
  offboarding: { label: "En départ", tone: "warning" },
  inactive: { label: "Inactif", tone: "neutral" },
  archived: { label: "Archivé", tone: "neutral" },
  suspended: { label: "Suspendu", tone: "warning" },
};

const EMPLOYEES_ROUTE = "/agents/pierre/employees";

export function mapV1Employee(raw: unknown): CockpitEmployeeListItem | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id ?? raw.employee_id);
  if (!id) return null;
  const name =
    str(raw.full_name) ||
    [str(raw.first_name), str(raw.last_name)].filter(Boolean).join(" ").trim() ||
    str(raw.name) ||
    "Salarié";
  const statusRaw = str(raw.status).toLowerCase() || "unknown";
  const meta = EMP_STATUS[statusRaw] ?? { label: humanize(statusRaw), tone: "neutral" as CockpitTone };
  return {
    id,
    name,
    role: str(raw.role_title ?? raw.job_title ?? raw.role) || null,
    status: statusRaw,
    statusLabel: meta.label,
    tone: meta.tone,
    href: `${EMPLOYEES_ROUTE}?employee=${encodeURIComponent(id)}`,
  };
}

export function mapV1Employees(raw: unknown): CockpitEmployeeListItem[] {
  const list = Array.isArray(raw) ? arr(raw) : isObject(raw) ? arr(raw.items ?? raw.employees ?? raw.data) : [];
  return list.map(mapV1Employee).filter((e): e is CockpitEmployeeListItem => e !== null);
}
