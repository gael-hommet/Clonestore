// src/lib/clonestore/clonebrief/canonical/brief.ts
// P19 — CLONEBRIEF: the executive briefing composed ONLY from proven canonical facts. It answers "what must
// the director know now?" by reading the canonical CloneTrace events (canonical-event.ts) + the durable
// scheduler state (Continuum/Signals). It is NOT a decorative dashboard: every line is backed by a real
// event/scheduled item, and it NEVER presents a prepared action as executed. Pure & deterministic.
//
// Invariants: no success without a trace event; a prepared/awaiting action is never "done"; a cancelled
// mission is never "active"; a failed task is never "completed"; strictly tenant + entity scoped; provenance
// points at the canonical event ids; a generation version + active country/entity are stamped.

import type { CanonicalTraceEvent } from "../../../pierre/v1/trace/canonical-event";

export type BriefKind = "morning" | "evening";

/** A durable scheduled item (Continuum/Signals) the brief reports as an upcoming deadline / wake. */
export type ScheduledItem = {
  readonly company_id: string;
  readonly entity_id?: string | null;
  readonly mission_id: string | null;
  readonly kind: "deadline" | "relance" | "wake" | "validation_expiry";
  readonly due_at: string;                 // ISO
  readonly label: string;
  readonly cancelled?: boolean;
};

export type BriefLine = {
  readonly mission_id: string | null;
  readonly task_id: string | null;
  readonly label: string;
  readonly evidence_event_ids: readonly string[];   // provenance → canonical events
};

export type CloneBrief = {
  readonly version: "clonebrief-1";
  readonly kind: BriefKind;
  readonly company_id: string;
  readonly entity_id: string | null;
  readonly legal_country: string | null;
  readonly generated_at: string;
  readonly completed_actions: readonly BriefLine[];      // genuinely executed (succeeded)
  readonly prepared_actions: readonly BriefLine[];       // prepared / awaiting integration — NOT executed
  readonly blocked: readonly BriefLine[];
  readonly pending_validations: readonly BriefLine[];
  readonly missing_info: readonly BriefLine[];
  readonly deadlines: readonly { mission_id: string | null; label: string; due_at: string }[];
  readonly decisions_required: readonly BriefLine[];
  readonly anomalies: readonly string[];
  readonly counts: Record<string, number>;
};

const COMPLETED_STATES = new Set(["succeeded", "done"]);
const isFor = (e: CanonicalTraceEvent, companyId: string, entityId: string | null) =>
  e.company_id === companyId && ((entityId == null) || (e.entity_id ?? null) === entityId);

function line(e: CanonicalTraceEvent, label: string): BriefLine {
  return { mission_id: e.mission_id, task_id: e.task_id, label, evidence_event_ids: [e.event_id] };
}

/**
 * Build an executive brief from canonical trace events + scheduled items, strictly scoped to (company,
 * entity). Pure. Preparation is never counted as execution; cancelled missions are excluded from active work.
 */
export function buildCloneBrief(params: {
  kind: BriefKind;
  company_id: string;
  entity_id?: string | null;
  legal_country: string | null;
  now: string;
  events: readonly CanonicalTraceEvent[];
  scheduled?: readonly ScheduledItem[];
}): CloneBrief {
  const entityId = params.entity_id ?? null;
  const evts = params.events.filter((e) => isFor(e, params.company_id, entityId));

  // Missions cancelled → excluded from "active" work (they must never appear as active/completed).
  const cancelledMissions = new Set(
    evts.filter((e) => e.new_state === "cancelled" || e.event_type.includes("mission_cancelled")).map((e) => e.mission_id),
  );
  const active = (e: CanonicalTraceEvent) => !(e.mission_id != null && cancelledMissions.has(e.mission_id));

  const completed_actions: BriefLine[] = [];
  const prepared_actions: BriefLine[] = [];
  const blocked: BriefLine[] = [];
  const pending_validations: BriefLine[] = [];
  const missing_info: BriefLine[] = [];
  const decisions_required: BriefLine[] = [];
  const anomalies: string[] = [];

  for (const e of evts) {
    const t = e.event_type;
    // A failed task is NEVER completed — it is an anomaly.
    if (e.new_state === "failed" || e.result === "failed" || t.includes("task_failed")) {
      anomalies.push(`Tâche en échec (${e.task_id ?? e.mission_id ?? "?"}) — ${t}. [${e.event_id}]`);
      continue;
    }
    if (!active(e)) continue; // cancelled mission → not active work

    if (e.new_state && COMPLETED_STATES.has(e.new_state) || t.includes("task_succeeded")) {
      completed_actions.push(line(e, `Action exécutée : ${t}`));
    } else if (e.result === "awaiting_integration" || e.new_state === "blocked" || t.includes("awaiting_integration")) {
      // Prepared / awaiting a provider — NOT executed.
      (e.new_state === "blocked" ? blocked : prepared_actions).push(line(e, e.new_state === "blocked" ? `Bloqué (attente intégration) : ${t}` : `Préparé (non exécuté) : ${t}`));
    } else if (t.includes("validation_requested") || e.new_state === "awaiting_validation") {
      pending_validations.push(line(e, `Validation en attente : ${t}`));
      decisions_required.push(line(e, `Décision requise : ${t}`));
    } else if (t.includes("missing_info") || e.new_state === "awaiting_info") {
      missing_info.push(line(e, `Information manquante : ${t}`));
    } else if (t.includes("cloneos_task_planned") || t.includes("action_prepared")) {
      prepared_actions.push(line(e, `Préparé (non exécuté) : ${t}`));
    }
  }

  // Late events on a cancelled mission → anomaly (activity after cancellation).
  for (const e of evts) {
    if (e.mission_id != null && cancelledMissions.has(e.mission_id) && (COMPLETED_STATES.has(e.new_state ?? "") || e.result === "ok")) {
      anomalies.push(`Activité sur une mission annulée (${e.mission_id}) — ${e.event_type}. [${e.event_id}]`);
    }
  }

  const deadlines = (params.scheduled ?? [])
    .filter((s) => s.company_id === params.company_id && ((entityId == null) || (s.entity_id ?? null) === entityId) && !s.cancelled)
    .map((s) => ({ mission_id: s.mission_id, label: `${s.kind} — ${s.label}`, due_at: s.due_at }))
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  return {
    version: "clonebrief-1",
    kind: params.kind,
    company_id: params.company_id,
    entity_id: entityId,
    legal_country: params.legal_country,
    generated_at: params.now,
    completed_actions, prepared_actions, blocked, pending_validations, missing_info, deadlines, decisions_required, anomalies,
    counts: {
      completed: completed_actions.length, prepared: prepared_actions.length, blocked: blocked.length,
      pending_validations: pending_validations.length, missing_info: missing_info.length,
      deadlines: deadlines.length, decisions_required: decisions_required.length, anomalies: anomalies.length,
    },
  };
}
