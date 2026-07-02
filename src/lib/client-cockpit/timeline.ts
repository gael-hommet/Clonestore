// src/lib/client-cockpit/timeline.ts
// P9.3 — Activité lisible : mappe les événements d'audit réels (event_type ~30)
// vers une timeline humaine, et regroupe le bruit technique. Masque par défaut
// payloads/hashes/IDs internes/provider request IDs (jamais dans le modèle). Pur.

import type { CockpitProvenance, CockpitTimelineEvent, CockpitTimelineKind, CockpitTone } from "./types";
import { employeeReference } from "./map";

/** Forme minimale d'un événement d'audit réel consommé (le reste est ignoré). */
export interface RawTimelineEvent {
  readonly id?: string | null;
  readonly event_type?: string | null;
  readonly title?: string | null;
  readonly message?: string | null;
  readonly created_at?: string | null;
  readonly mission_id?: string | null;
  readonly employee_id?: string | null;
  readonly employee_name?: string | null;
  readonly severity?: string | null;
  readonly source?: string | null;
}

const KIND_BY_EVENT: Record<string, CockpitTimelineKind> = {
  mission_created: "mission", mission_updated: "mission", mission_continued: "mission", mission_completed: "mission",
  task_created: "task", task_started: "task", task_completed: "task", task_skipped: "task",
  task_approved: "validation", task_cancelled: "task", task_failed: "incident", task_blocked: "incident",
  human_action_required: "validation",
  governance_evaluated: "system", governance_blocked: "incident", governance_refused: "incident",
  cloneguard_evaluated: "system", clonepolicy_evaluated: "system", clonetrust_evaluated: "system", continuity_checked: "system",
  document_generated: "document",
  email_prepared: "communication", email_sent: "communication", message_generated: "communication",
  run_safe_started: "system", run_safe_completed: "system",
  employee_file_updated: "system", system_note: "system",
};

const TONE_BY_SEVERITY: Record<string, CockpitTone> = {
  info: "neutral", notice: "info", warning: "warning",
  action_required: "warning", blocked: "danger", critical: "danger",
};

const ACTOR_BY_SOURCE: Record<string, CockpitProvenance> = {
  mission: "pierre", task: "pierre", document: "pierre", governance: "system",
  cloneguard: "system", system: "system", employee_file: "human", operational_feed: "pierre",
};

function humanTitle(e: RawTimelineEvent): string {
  if (e.title && e.title.trim()) return e.title.trim();
  const t = (e.event_type ?? "").replace(/[_-]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Événement";
}

export function mapTimelineEvent(e: RawTimelineEvent, index = 0): CockpitTimelineEvent {
  const eventType = (e.event_type ?? "").trim().toLowerCase();
  const kind = KIND_BY_EVENT[eventType] ?? "system";
  const tone = TONE_BY_SEVERITY[(e.severity ?? "").trim().toLowerCase()] ?? "neutral";
  const actor = ACTOR_BY_SOURCE[(e.source ?? "").trim().toLowerCase()] ?? "pierre";
  return {
    id: (e.id && e.id.trim()) || `evt-${index}`,
    kind,
    title: humanTitle(e),
    at: e.created_at ?? null,
    actor,
    missionId: e.mission_id ?? null,
    employee: employeeReference(e.employee_id, e.employee_name),
    tone,
    // Message humain uniquement ; jamais de payload brut / hash / request-id.
    detail: e.message && e.message.trim() ? e.message.trim() : null,
  };
}

export function mapTimeline(events: readonly RawTimelineEvent[] | null | undefined): CockpitTimelineEvent[] {
  if (!events || events.length === 0) return [];
  return events.map((e, i) => mapTimelineEvent(e, i));
}

/** Regroupe les événements techniques consécutifs de même type système pour éviter
 *  une avalanche (ex. plusieurs "governance_evaluated" d'affilée → un seul groupe). */
export interface CockpitTimelineGroup {
  readonly kind: CockpitTimelineKind;
  readonly events: readonly CockpitTimelineEvent[];
  readonly collapsed: boolean;
}

export function groupTimeline(events: readonly CockpitTimelineEvent[]): CockpitTimelineGroup[] {
  const groups: CockpitTimelineGroup[] = [];
  for (const evt of events) {
    const last = groups[groups.length - 1];
    if (last && last.kind === "system" && evt.kind === "system") {
      (last.events as CockpitTimelineEvent[]).push(evt);
    } else {
      groups.push({ kind: evt.kind, events: [evt], collapsed: false });
    }
  }
  return groups.map((g) => (g.kind === "system" && g.events.length > 1 ? { ...g, collapsed: true } : g));
}
