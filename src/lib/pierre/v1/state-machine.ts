// src/lib/pierre/v1/state-machine.ts
// PHASE 8.1 — Pierre Production Runtime Core — canonical business state machine.
//
// SINGLE source of allowed transitions. No route, repository or component may
// change a status with a bare UPDATE. All transitions go through assertTransition
// + the mission-service, which enforces optimistic concurrency (version) and
// emits a CloneTrace event.

import { Errors } from "./errors";

export type MissionStatus =
  | "draft" | "analyzing" | "awaiting_info" | "planned" | "awaiting_validation"
  | "ready" | "queued" | "in_progress" | "partially_completed" | "done"
  | "blocked" | "failed" | "retry_scheduled" | "cancelled" | "escalated" | "archived";

export type TaskStatus =
  | "draft" | "planned" | "awaiting_info" | "awaiting_validation" | "ready"
  | "queued" | "leased" | "in_progress" | "succeeded" | "failed"
  | "retry_scheduled" | "blocked" | "cancelled" | "escalated" | "archived";

export const MISSION_STATUSES: readonly MissionStatus[] = [
  "draft","analyzing","awaiting_info","planned","awaiting_validation","ready","queued",
  "in_progress","partially_completed","done","blocked","failed","retry_scheduled",
  "cancelled","escalated","archived",
];

export const TASK_STATUSES: readonly TaskStatus[] = [
  "draft","planned","awaiting_info","awaiting_validation","ready","queued","leased",
  "in_progress","succeeded","failed","retry_scheduled","blocked","cancelled","escalated","archived",
];

const MISSION_TRANSITIONS: Record<MissionStatus, readonly MissionStatus[]> = {
  draft: ["analyzing", "cancelled", "archived"],
  analyzing: ["awaiting_info", "planned", "awaiting_validation", "blocked", "failed", "cancelled"],
  awaiting_info: ["analyzing", "planned", "awaiting_validation", "cancelled", "blocked"],
  planned: ["awaiting_validation", "ready", "queued", "blocked", "cancelled"],
  awaiting_validation: ["ready", "queued", "blocked", "escalated", "cancelled", "failed"],
  ready: ["queued", "in_progress", "blocked", "cancelled"],
  queued: ["in_progress", "blocked", "cancelled", "retry_scheduled"],
  in_progress: ["partially_completed", "done", "failed", "blocked", "retry_scheduled", "escalated"],
  partially_completed: ["in_progress", "done", "failed", "blocked", "escalated"],
  retry_scheduled: ["queued", "in_progress", "failed", "cancelled"],
  done: ["archived"],
  failed: ["retry_scheduled", "escalated", "archived", "cancelled"],
  blocked: ["ready", "queued", "cancelled", "escalated", "failed"],
  escalated: ["ready", "cancelled", "archived", "failed"],
  cancelled: ["archived"],
  archived: [],
};

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  draft: ["planned", "awaiting_info", "cancelled"],
  planned: ["awaiting_info", "awaiting_validation", "ready", "blocked", "cancelled"],
  awaiting_info: ["planned", "ready", "blocked", "cancelled"],
  awaiting_validation: ["ready", "blocked", "escalated", "cancelled", "failed"],
  ready: ["queued", "blocked", "cancelled"],
  queued: ["leased", "ready", "cancelled", "blocked"],
  leased: ["in_progress", "ready", "retry_scheduled", "failed", "cancelled"],
  in_progress: ["succeeded", "failed", "blocked", "retry_scheduled", "escalated", "awaiting_validation"],
  retry_scheduled: ["queued", "ready", "failed", "cancelled"],
  succeeded: ["archived"],
  failed: ["retry_scheduled", "escalated", "archived", "cancelled"],
  blocked: ["ready", "cancelled", "escalated", "failed"],
  escalated: ["ready", "cancelled", "archived", "failed"],
  cancelled: ["archived"],
  archived: [],
};

export const TERMINAL_MISSION_STATUSES: readonly MissionStatus[] = ["done", "cancelled", "archived"];
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ["succeeded", "cancelled", "archived"];

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return from === to || (MISSION_TRANSITIONS[from]?.includes(to) ?? false);
}
export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || (TASK_TRANSITIONS[from]?.includes(to) ?? false);
}

/** Throws RuntimeError(illegal_transition) if not allowed. */
export function assertMissionTransition(from: MissionStatus, to: MissionStatus): void {
  if (!canTransitionMission(from, to)) throw Errors.illegalTransition(from, to);
}
export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) throw Errors.illegalTransition(from, to);
}

export type TransitionReason =
  | "analysis" | "planning" | "missing_info" | "validation_requested" | "validation_approved"
  | "validation_rejected" | "queued" | "claimed" | "execution_started" | "execution_succeeded"
  | "execution_failed" | "retry_scheduled" | "blocked_by_guard" | "blocked_by_dependency"
  | "cancelled" | "escalated" | "aggregated" | "stale_lease_recovered" | "archived";

export type ActorType = "user" | "system" | "worker" | "guard";
