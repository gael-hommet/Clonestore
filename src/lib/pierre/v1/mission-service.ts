// src/lib/pierre/v1/mission-service.ts
// PHASE 8.1 — Pierre Production Runtime Core — mission orchestration service.
//
// The ONLY place missions/tasks are created and transitioned. Idempotent create,
// governed (CloneGuard + autonomy policy) task planning, durable queueing,
// version-checked transitions, CloneTrace events, validation workflow, mission
// aggregation. No route mutates status directly.

import type { SqlExecutor } from "./sql";
import { newUuid, idempotencyKey } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./tenant-context";
import {
  MissionRepo, TaskRepo, ValidationRepo, EventRepo, IdempotencyRepo,
  type MissionRow, type TaskRow,
} from "./repositories";
import { enqueueJob, cancelJobsForTask } from "./queue";
import { emitRuntimeEvent } from "./runtime-event-bus";
import { createHash } from "crypto";
import { type AnalyzedTask } from "./analysis";
import { cognitiveAnalyze } from "./cognitive-runtime/cognitive-analyzer";
import { evaluateGuard } from "./cloneguard";
import { decideValidation, requiresHumanApproval, AUTONOMY_MODES, type AutonomyMode } from "./autonomy";
import {
  assertMissionTransition, assertTaskTransition, canTransitionMission,
  type MissionStatus, type TaskStatus, type ActorType, type TransitionReason,
} from "./state-machine";
import { executorExternalSideEffect } from "./executors";

export type CreateMissionInput = {
  instruction: string;
  source?: string;
  employee_id?: string | null;
  site_id?: string | null;
  parent_mission_id?: string | null;
  autonomy_mode?: AutonomyMode;
  idempotency_key?: string;
};

export type MissionView = {
  mission_id: string;
  status: MissionStatus;
  summary: string | null;
  risk: string;
  tasks: Array<{ id: string; type: string; status: TaskStatus; approval_required: boolean; risk: string }>;
  missing_info: Array<{ id: string; question: string; priority: string }>;
  approvals: Array<{ id: string; status: string; reason: string }>;
  queued_actions: number;
  next_action: string | null;
  trace_reference: string;
  idempotent_replay: boolean;
};

// ── Governed transition helpers (only path to change status) ────────────────

export async function transitionTask(
  db: SqlExecutor, ctx: { company_id: string; user_id?: string }, task: TaskRow, to: TaskStatus,
  reason: TransitionReason, actor: ActorType, opts: { result?: unknown; scheduled_at?: string | null; bumpAttempt?: boolean; metadata?: Record<string, unknown> } = {}
): Promise<TaskRow> {
  assertTaskTransition(task.status, to);
  const updated = await TaskRepo.updateStatus(db, ctx.company_id, task.id, task.version, to, { result: opts.result, scheduled_at: opts.scheduled_at ?? undefined }, opts.bumpAttempt ?? false);
  await EventRepo.append(db, {
    company_id: ctx.company_id, mission_id: task.mission_id, task_id: task.id,
    type: `task_${to}`, actor_type: actor,
    // P16E §10 (F31) — a HUMAN transition must be ATTRIBUTABLE: record the real user_id when the
    // actor is a human. System/worker/guard actors carry no human id (null).
    actor_id: actor === "user" ? (ctx.user_id ?? null) : null,
    prev_state: task.status, new_state: to,
    metadata: { reason, ...(opts.metadata ?? {}) },
  });
  return updated;
}

export async function transitionMission(
  db: SqlExecutor, companyId: string, mission: MissionRow, to: MissionStatus,
  reason: TransitionReason, actor: ActorType, patch: { summary?: string | null; next_action?: string | null; archived_at?: string | null; metadata?: Record<string, unknown>; actorId?: string | null } = {}
): Promise<MissionRow> {
  assertMissionTransition(mission.status, to);
  const updated = await MissionRepo.updateStatus(db, companyId, mission.id, mission.version, to, { summary: patch.summary, next_action: patch.next_action, archived_at: patch.archived_at });
  await EventRepo.append(db, {
    company_id: companyId, mission_id: mission.id, task_id: null,
    type: `mission_${to}`, actor_type: actor,
    // P16E §10 (F31) — attribute a human mission transition to the real user.
    actor_id: actor === "user" ? (patch.actorId ?? null) : null,
    prev_state: mission.status, new_state: to,
    metadata: { reason, ...(patch.metadata ?? {}) },
  });
  return updated;
}

// ── Create mission (idempotent, governed, durable) ──────────────────────────

export async function createMission(db: SqlExecutor, ctx: TenantContext, input: CreateMissionInput): Promise<MissionView> {
  requirePermission(ctx, "mission.create");
  if (!input.instruction || input.instruction.trim().length === 0) throw Errors.validation("instruction is required");

  const idem = input.idempotency_key ?? idempotencyKey([ctx.company_id, ctx.user_id, "mission", input.instruction.trim()]);

  // P8.14 — AUTHORITATIVE cognitive analysis (LLM when enabled+available; deterministic regex as the
  // degraded fallback + a safety floor the model can never breach). Computed OUTSIDE the transaction so a
  // model call never holds a DB transaction open. The governed pipeline below (guard/validation/queue)
  // is unchanged and remains the fail-closed authority over whatever the analysis proposed.
  const analysis = await cognitiveAnalyze(input.instruction);

  return db.transaction(async (tx) => {
    // 1) Idempotency replay — same key returns the stored result, no re-create.
    const replay = (await IdempotencyRepo.get(tx, ctx.company_id, "mission.create", idem)) as MissionView | null;
    if (replay) return { ...replay, idempotent_replay: true };
    const existing = await MissionRepo.byIdempotency(tx, ctx.company_id, idem);
    if (existing) {
      const view = await assembleView(tx, ctx.company_id, existing, true);
      return view;
    }

    // P16E §4 (F24) — VÉRIFIER les identifiants fournis par le client AVANT de créer la mission.
    // `employee_id`/`site_id` venaient du corps de requête et étaient persistés tels quels : une
    // entreprise A pouvait lier une mission à un salarié/site de l'entreprise B. On exige que
    // l'employé et le site appartiennent à l'entreprise ACTIVE, avec un échec FERMÉ et NON
    // révélateur (un id étranger est indiscernable d'un id inexistant : même réponse). Cette
    // vérification précède tout INSERT ⇒ aucune mission / tâche / événement d'audit sur échec.
    if (input.employee_id) {
      const e = await tx.query<{ id: string; site_id: string | null; status: string }>(
        `select id, site_id, status from pierre_rt_employees where company_id = $1 and id = $2`, [ctx.company_id, input.employee_id]);
      const emp = e.rows[0];
      if (!emp) throw Errors.validation("Référence salarié invalide"); // étranger OU inexistant — réponse identique
      if (emp.status === "left") throw Errors.validation("Salarié inéligible");
      if (input.site_id && emp.site_id && emp.site_id !== input.site_id) throw Errors.validation("Salarié et site incohérents");
    }
    if (input.site_id) {
      const s = await tx.query<{ id: string }>(
        `select id from pierre_rt_sites where company_id = $1 and id = $2 and archived_at is null`, [ctx.company_id, input.site_id]);
      if (!s.rows[0]) throw Errors.validation("Référence site invalide");
    }

    // P16E §8 — l'autonomie est un RÉGLAGE D'ENTREPRISE GOUVERNÉ, pas un paramètre de confiance
    // client. Un utilisateur `mission.create` ne doit pas pouvoir faire ESCALADER sa mission
    // au-dessus du `default_autonomy_mode` de l'entreprise en forgeant `autonomy_mode` dans le
    // corps de requête. On résout le plafond entreprise côté serveur et on BORNE : l'appelant
    // peut demander un mode PLUS prudent, jamais plus élevé.
    const companyRow = await tx.query<{ default_autonomy_mode: string }>(`select default_autonomy_mode from pierre_rt_companies where id = $1`, [ctx.company_id]);
    const rawDefault = companyRow.rows[0]?.default_autonomy_mode;
    const ceiling: AutonomyMode = (AUTONOMY_MODES as readonly string[]).includes(rawDefault) ? (rawDefault as AutonomyMode) : "normal";
    const requested: AutonomyMode = input.autonomy_mode && (AUTONOMY_MODES as readonly string[]).includes(input.autonomy_mode) ? input.autonomy_mode : ceiling;
    const autonomy: AutonomyMode = AUTONOMY_MODES[Math.min(AUTONOMY_MODES.indexOf(requested), AUTONOMY_MODES.indexOf(ceiling))];

    // 2) Persist mission (analyzing -> planned/awaiting_*).
    const missionId = newUuid();
    let mission = await MissionRepo.insert(tx, {
      id: missionId, company_id: ctx.company_id, requester_user_id: ctx.user_id,
      employee_id: input.employee_id ?? null, site_id: input.site_id ?? null,
      parent_mission_id: input.parent_mission_id ?? null, source: input.source ?? "cockpit",
      instruction: input.instruction, status: "analyzing", risk: analysis.risk_level,
      sensitivity: analysis.sensitivity, autonomy_mode: autonomy, approval_policy: "auto_execute",
      summary: analysis.summary, next_action: analysis.next_best_action,
      correlation_id: ctx.correlation_id, request_id: ctx.request_id, idempotency_key: idem,
    });
    await EventRepo.append(tx, { company_id: ctx.company_id, mission_id: missionId, task_id: null, type: "mission_received", actor_type: "user", actor_id: ctx.user_id, request_id: ctx.request_id, correlation_id: ctx.correlation_id, metadata: { source: input.source ?? "cockpit" } });
    await EventRepo.append(tx, { company_id: ctx.company_id, mission_id: missionId, task_id: null, type: "analysis_completed", actor_type: "system", metadata: { intent: analysis.intent, confidence: analysis.confidence } });
    if (analysis.missing_info.length > 0) {
      // P16E §3 (F22) — persister les QUESTIONS exactes (id/question/priorité), pas seulement leur
      // nombre : MissionView doit exposer la raison précise du blocage (statut awaiting_info), et
      // répondre à une question ne doit pas effacer les autres. Ordre et priorité préservés.
      await EventRepo.append(tx, { company_id: ctx.company_id, mission_id: missionId, task_id: null, type: "missing_info_detected", actor_type: "system", metadata: { count: analysis.missing_info.length, questions: analysis.missing_info } });
    }

    // 3) Plan + persist tasks (governed), wire dependencies, queue ready ones.
    const taskIds: string[] = [];
    let queued = 0;
    let anyAwaitingValidation = false;

    for (let i = 0; i < analysis.proposed_tasks.length; i++) {
      const at: AnalyzedTask = analysis.proposed_tasks[i];
      const guard = evaluateGuard({ action: at.action, risk: at.risk, sensitivity: at.sensitivity, text: at.objective });
      const decision = decideValidation({ mode: autonomy, action: at.action, risk: at.risk, sensitivity: at.sensitivity, external_side_effect: at.external_side_effect || executorExternalSideEffect(at.type) });

      const approvalRequired = guard.requires_approval || requiresHumanApproval(decision) || !guard.allow;
      const taskId = newUuid();
      const taskIdem = idempotencyKey([ctx.company_id, missionId, "task", i, at.type]);

      // Initial status: blocked (guard black) > awaiting_validation > awaiting_info > planned(deps) > ready
      let status: TaskStatus = "planned";
      if (!guard.allow && guard.level === "black") status = "escalated";
      else if (approvalRequired) status = "awaiting_validation";
      else if (analysis.missing_info.some((m) => m.priority === "high")) status = "awaiting_info";
      else if (at.depends_on.length > 0) status = "planned";
      else status = "ready";

      await TaskRepo.insert(tx, {
        id: taskId, company_id: ctx.company_id, mission_id: missionId, type: at.type, objective: at.objective,
        status, priority: at.priority, domain: at.domain, risk: at.risk, sensitivity: at.sensitivity,
        channel: at.channel, approval_required: approvalRequired, expected_output: at.expected_output,
        owner: "pierre", max_attempts: 5, timeout_ms: 30000, scheduled_at: null, due_at: null, idempotency_key: taskIdem,
      });
      taskIds.push(taskId);
      await EventRepo.append(tx, { company_id: ctx.company_id, mission_id: missionId, task_id: taskId, type: "task_created", actor_type: "system", new_state: status, metadata: { guard: guard.level, decision } });

      if (status === "escalated" || status === "awaiting_validation") {
        anyAwaitingValidation = status === "awaiting_validation";
        await ValidationRepo.insert(tx, {
          company_id: ctx.company_id, mission_id: missionId, task_id: taskId,
          validator_role: at.sensitivity === "restricted" ? "hr_manager" : "hr_manager",
          reason: `Validation requise: ${at.type} (${guard.level})`,
          risk_context: { guard_level: guard.level, prohibited: guard.prohibited_actions, risk: at.risk },
          expires_at: null,
        });
        await EventRepo.append(tx, { company_id: ctx.company_id, mission_id: missionId, task_id: taskId, type: "validation_requested", actor_type: "guard", metadata: { level: guard.level } });
      }
    }

    // Wire dependencies (index → id).
    for (let i = 0; i < analysis.proposed_tasks.length; i++) {
      for (const depIdx of analysis.proposed_tasks[i].depends_on) {
        if (taskIds[depIdx]) await TaskRepo.addDependency(tx, ctx.company_id, taskIds[i], taskIds[depIdx]);
      }
    }

    // Enqueue ready tasks (durable, idempotent dedup_key).
    for (let i = 0; i < taskIds.length; i++) {
      const t = await TaskRepo.byId(tx, ctx.company_id, taskIds[i]);
      if (t && t.status === "ready") {
        const qt = await transitionTask(tx, ctx, t, "queued", "queued", "system");
        await enqueueJob(tx, { company_id: ctx.company_id, task_id: qt.id, mission_id: missionId, priority: qt.priority, dedup_key: `task:${qt.id}` });
        await EventRepo.append(tx, { company_id: ctx.company_id, mission_id: missionId, task_id: qt.id, type: "task_queued", actor_type: "system" });
        queued++;
      }
    }

    // 4) Mission status from task fan-out.
    let missionStatus: MissionStatus;
    if (anyAwaitingValidation) missionStatus = "awaiting_validation";
    else if (analysis.missing_info.some((m) => m.priority === "high")) missionStatus = "awaiting_info";
    else if (queued > 0) missionStatus = "queued";
    else missionStatus = "planned";

    // analyzing -> (target). Go through 'planned' if needed to satisfy machine.
    mission = await transitionMission(tx, ctx.company_id, mission, missionStatus === "queued" ? "planned" : missionStatus, "planning", "system");
    if (missionStatus === "queued") mission = await transitionMission(tx, ctx.company_id, mission, "queued", "queued", "system");

    const view = await assembleView(tx, ctx.company_id, mission, false);
    // 5) Persist idempotency result (first writer wins).
    await IdempotencyRepo.put(tx, ctx.company_id, "mission.create", idem, view);
    return view;
  });
}

/**
 * P16E §3 (F22) — récupère les questions d'information manquante PERSISTÉES pour une mission
 * (depuis le dernier événement `missing_info_detected`). Recouvre le blocage exact — pour un
 * affichage à la création comme à la relecture. Retourne [] si aucune (ou si résolue en aval).
 */
export async function readMissionMissingInfo(db: SqlExecutor, companyId: string, missionId: string): Promise<Array<{ id: string; question: string; priority: string }>> {
  const events = await EventRepo.timeline(db, companyId, missionId);
  let questions: Array<{ id: string; question: string; priority: string }> = [];
  for (const e of events) {
    if (e.type === "missing_info_detected") {
      const q = (e.metadata as { questions?: unknown } | null)?.questions;
      if (Array.isArray(q)) questions = q as Array<{ id: string; question: string; priority: string }>;
    }
  }
  return questions;
}

async function assembleView(db: SqlExecutor, companyId: string, mission: MissionRow, replay: boolean): Promise<MissionView> {
  const tasks = await TaskRepo.listByMission(db, companyId, mission.id);
  const validations = await ValidationRepo.listByMission(db, companyId, mission.id);
  const queued = tasks.filter((t) => t.status === "queued" || t.status === "leased" || t.status === "in_progress").length;
  return {
    mission_id: mission.id, status: mission.status as MissionStatus, summary: mission.summary, risk: mission.risk,
    tasks: tasks.map((t) => ({ id: t.id, type: t.type, status: t.status, approval_required: t.approval_required, risk: t.risk })),
    missing_info: await readMissionMissingInfo(db, companyId, mission.id), // F22 — jamais discardé
    approvals: validations.map((v) => ({ id: v.id, status: v.status, reason: v.reason })),
    queued_actions: queued, next_action: mission.next_action,
    trace_reference: mission.correlation_id, idempotent_replay: replay,
  };
}

// ── Validation decisions (real workflow) ────────────────────────────────────

export async function decideValidationAction(
  db: SqlExecutor, ctx: TenantContext, validationId: string, action: "approve" | "reject" | "request_changes", version: number
): Promise<{ validation_id: string; status: string; unlocked_task: string | null }> {
  requirePermission(ctx, "validation.decide");
  return db.transaction(async (tx) => {
    const v = await ValidationRepo.byId(tx, ctx.company_id, validationId);
    if (!v) throw Errors.notFound("Validation not found");
    if (v.status !== "pending") {
      // Idempotent: deciding an already-decided validation returns its state.
      return { validation_id: v.id, status: v.status, unlocked_task: null };
    }
    if (v.version !== version) throw Errors.versionConflict();

    const mapped = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested";
    const decided = await ValidationRepo.decide(tx, ctx.company_id, v.id, v.version, mapped as "approved" | "rejected" | "changes_requested", ctx.user_id);
    await EventRepo.append(tx, { company_id: ctx.company_id, mission_id: v.mission_id, task_id: v.task_id, type: `validation_${mapped}`, actor_type: "user", actor_id: ctx.user_id });

    // P8.5-FINAL §3 — the REAL decision emits a durable runtime event IN THIS TRANSACTION (never a later
    // poll of decided validations). Only an APPROVAL resolves the runtime approval wait, and only with the
    // pinned content fingerprint (a stale/amended content never auto-passes); a rejection / changes_requested
    // is recorded but resolves nothing — the sensitive step never silently proceeds.
    const fp = (v.risk_context as { content_fingerprint?: string | null } | null)?.content_fingerprint ?? null;
    const decisionKind = mapped === "approved" ? "approval.approved" : mapped === "rejected" ? "approval.rejected" : "approval.changes_requested";
    await emitRuntimeEvent(tx, ctx, {
      source: "p8x_approval",
      event_key: `val:${v.id}:${mapped}:${fp ?? "none"}`,
      kind: decisionKind,
      object_type: "validation",
      object_id: v.id,
      payload_hash: createHash("sha256").update(`${v.id}:${mapped}:${fp ?? ""}`).digest("hex"),
      fingerprint: fp,
      resolve: mapped === "approved" ? { event_kind: "approval.decided", object_type: "validation", object_id: v.id } : null,
    });

    let unlocked: string | null = null;
    if (v.task_id) {
      const task = await TaskRepo.byId(tx, ctx.company_id, v.task_id);
      if (task) {
        if (mapped === "approved") {
          const unmet = await TaskRepo.unmetDependencies(tx, ctx.company_id, task.id);
          if (unmet === 0) {
            const ready = await transitionTask(tx, ctx, task, "ready", "validation_approved", "user");
            const q = await transitionTask(tx, ctx, ready, "queued", "queued", "system");
            await enqueueJob(tx, { company_id: ctx.company_id, task_id: q.id, mission_id: q.mission_id, priority: q.priority, dedup_key: `task:${q.id}` });
            unlocked = q.id;
          } else {
            await transitionTask(tx, ctx, task, "planned", "blocked_by_dependency", "system");
          }
        } else if (mapped === "rejected") {
          await transitionTask(tx, ctx, task, "cancelled", "validation_rejected", "user");
          await cancelJobsForTask(tx, ctx.company_id, task.id);
        } else {
          await transitionTask(tx, ctx, task, "awaiting_info", "validation_rejected", "user");
        }
      }
    }
    return { validation_id: decided.id, status: decided.status, unlocked_task: unlocked };
  });
}

// ── Cancel + aggregation ────────────────────────────────────────────────────

export async function cancelMission(db: SqlExecutor, ctx: TenantContext, missionId: string): Promise<{ mission_id: string; status: MissionStatus }> {
  requirePermission(ctx, "mission.cancel");
  return db.transaction(async (tx) => {
    const m = await MissionRepo.byId(tx, ctx.company_id, missionId);
    if (!m) throw Errors.notFound("Mission not found");
    const tasks = await TaskRepo.listByMission(tx, ctx.company_id, missionId);
    for (const t of tasks) {
      if (!["succeeded", "cancelled", "archived"].includes(t.status)) {
        try { await transitionTask(tx, ctx, t, "cancelled", "cancelled", "user"); } catch { /* terminal already */ }
        await cancelJobsForTask(tx, ctx.company_id, t.id);
      }
    }
    const updated = await transitionMission(tx, ctx.company_id, m, "cancelled", "cancelled", "user", { actorId: ctx.user_id });
    return { mission_id: updated.id, status: updated.status as MissionStatus };
  });
}

/** Recompute mission status from its tasks. Called by the worker after each task. */
export async function aggregateMission(db: SqlExecutor, companyId: string, missionId: string): Promise<MissionStatus | null> {
  return db.transaction(async (tx) => {
    const m = await MissionRepo.byId(tx, companyId, missionId);
    if (!m || ["done", "cancelled", "archived"].includes(m.status)) return (m?.status as MissionStatus) ?? null;
    const tasks = await TaskRepo.listByMission(tx, companyId, missionId);
    if (tasks.length === 0) return m.status as MissionStatus;

    const active = tasks.filter((t) => !["cancelled", "archived"].includes(t.status));
    const allDone = active.length > 0 && active.every((t) => t.status === "succeeded");
    const anyRunning = active.some((t) => ["queued", "leased", "in_progress", "ready", "retry_scheduled"].includes(t.status));
    const anyFailed = active.some((t) => t.status === "failed");
    const someDone = active.some((t) => t.status === "succeeded");

    let target: MissionStatus | null = null;
    if (allDone) target = "done";
    else if (anyRunning) target = "in_progress";
    else if (anyFailed && someDone) target = "partially_completed";
    else if (anyFailed) target = "failed";

    if (target && target !== m.status) {
      try {
        let cur = m;
        // Walk through the legal intermediate: queued -> in_progress -> done/...
        if (["done", "partially_completed", "failed"].includes(target) && !["in_progress", "partially_completed"].includes(cur.status) && canTransitionMission(cur.status, "in_progress")) {
          cur = await transitionMission(tx, companyId, cur, "in_progress", "aggregated", "system");
        }
        if (cur.status !== target && canTransitionMission(cur.status, target)) {
          cur = await transitionMission(tx, companyId, cur, target, "aggregated", "system");
        }
        return cur.status as MissionStatus;
      } catch {
        // Transition not allowed from current state — leave as-is, no throw.
        return m.status as MissionStatus;
      }
    }
    return m.status as MissionStatus;
  });
}
