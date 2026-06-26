// src/lib/clonestore/cloneos-history/cloneos-history-mappers.ts
// PHASE 3.2 — CloneOS History Server Persistence Design — Mappers
//
// Transforme CloneOSCommandCenterResult → CloneOSHistoryItem (persistable)
// et CloneOSHistoryItem → MessageCenterItem (pour /profile/messages).
//
// Invariants :
//   - raw_request_summary : ≤ 280 chars, jamais le texte brut complet si sensible
//   - metadata : toujours redacted
//   - read_only : toujours true
//   - aucun secret/token dans les items
//   - pas de "mission exécutée" si plan-only
//   - pas de "document généré" si planifié seulement

import type { CloneOSCommandCenterResult } from "@/lib/clonestore/cloneos";
import type {
  CloneOSHistoryItem,
  CloneOSHistoryGuardSummary,
  CloneOSHistoryTraceSummary,
  CloneOSHistoryMissionSummary,
} from "./cloneos-history-types";
import type { MessageCenterItem } from "@/lib/clonestore/messages";
import {
  CLONEOS_HISTORY_MAX_SUMMARY_LENGTH,
  CLONEOS_HISTORY_REDACT_KEYS,
} from "./cloneos-history-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function summarizeCloneOSRawRequest(text: string): string {
  if (!text || typeof text !== "string") return "Demande CloneOS";
  const clean = text.trim();
  if (clean.length <= CLONEOS_HISTORY_MAX_SUMMARY_LENGTH) return clean;
  return clean.slice(0, CLONEOS_HISTORY_MAX_SUMMARY_LENGTH - 3) + "…";
}

export function summarizeCloneOSMission(
  plan: CloneOSCommandCenterResult["mission_plan"]
): CloneOSHistoryMissionSummary | undefined {
  if (!plan) return undefined;
  return {
    mission_id: plan.mission_id,
    title: plan.title.slice(0, 120),
    domain: (plan.domain ?? "unknown") as CloneOSHistoryMissionSummary["domain"],
    task_count: plan.tasks?.length ?? 0,
    validation_required: plan.validation_required ?? false,
  };
}

export function summarizeCloneOSTasks(
  plan: CloneOSCommandCenterResult["mission_plan"]
): number {
  return plan?.tasks?.length ?? 0;
}

export function summarizeCloneOSGuard(
  guard: CloneOSCommandCenterResult["guard_result"]
): CloneOSHistoryGuardSummary | undefined {
  if (!guard) return undefined;
  return {
    overall_decision: guard.overall_decision,
    has_blocked_tasks: guard.has_blocked_tasks,
    has_refused_tasks: guard.has_refused_tasks,
    has_validation_required_tasks: guard.has_validation_required_tasks,
    critical_action_count: guard.critical_action_count,
  };
}

export function summarizeCloneOSTrace(
  trace: CloneOSCommandCenterResult["trace_result"]
): CloneOSHistoryTraceSummary | undefined {
  if (!trace) return undefined;
  return {
    timeline_id: trace.timeline_id,
    event_count: trace.event_count,
    trace_ready: trace.trace_ready,
  };
}

export function isSensitiveCloneOSHistoryKey(key: string): boolean {
  const lower = key.toLowerCase();
  return CLONEOS_HISTORY_REDACT_KEYS.some((r) => lower.includes(r.toLowerCase()));
}

export function redactCloneOSHistoryMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveCloneOSHistoryKey(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 500) {
      result[key] = value.slice(0, 500) + "…";
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Mapper principal : CloneOSCommandCenterResult → CloneOSHistoryItem ────────

export function mapCloneOSResultToHistoryItem(
  result: CloneOSCommandCenterResult,
  options: {
    userId?: string;
    companyId?: string;
    rawRequest?: string;
    source?: CloneOSHistoryItem["source"];
  } = {}
): CloneOSHistoryItem {
  const classified = result.classified_command;
  const route = result.selected_route;
  const missionPlan = result.mission_plan;
  const guardResult = result.guard_result;
  const traceResult = result.trace_result;

  const rawSummary = summarizeCloneOSRawRequest(
    classified?.summary ?? options.rawRequest ?? "Demande CloneOS"
  );

  const guardDecision = guardResult?.overall_decision ?? undefined;
  const humanValidationRequired =
    guardResult?.has_validation_required_tasks ?? false;
  const blocked =
    result.status === "blocked" || (guardResult?.has_blocked_tasks ?? false);
  const refused =
    result.status === "refused" || (guardResult?.has_refused_tasks ?? false);

  const missionSummary = summarizeCloneOSMission(missionPlan);

  const now = new Date().toISOString();

  return {
    id: `local:${result.command_id}`,
    command_id: result.command_id,
    user_id: options.userId,
    company_id: options.companyId ?? "demo_company",
    raw_request_summary: rawSummary,
    domain: (classified?.domain ?? "unknown") as CloneOSHistoryItem["domain"],
    intent: classified?.intent ?? "unknown",
    status: result.status as CloneOSHistoryItem["status"],
    risk_level: (classified?.risk_level === "critical"
      ? "critical"
      : classified?.risk_level ?? "low") as CloneOSHistoryItem["risk_level"],
    employee_slug: route?.is_available ? route.employee_slug : undefined,
    employee_display_name: route?.is_available ? route.employee_display_name : undefined,
    mission_title: missionSummary?.title,
    mission_summary: missionSummary
      ? `${missionSummary.task_count} tâche(s) — plan-only, non exécuté`
      : undefined,
    task_count: summarizeCloneOSTasks(missionPlan),
    guard_decision: guardDecision,
    human_validation_required: humanValidationRequired,
    blocked,
    refused,
    trace_event_count: traceResult?.event_count ?? 0,
    next_action: result.next_action?.slice(0, 200),
    source: options.source ?? "localstorage",
    created_at: result.generated_at ?? now,
    updated_at: now,
    read_only: true,
    metadata: redactCloneOSHistoryMetadata({
      ok: result.ok,
      errors: result.errors?.slice(0, 3) ?? [],
      warnings: result.warnings?.slice(0, 3) ?? [],
      plan_only: true, // invariant — jamais exécuté
    }),
  };
}

// ── Mapper secondaire : CloneOSHistoryItem → MessageCenterItem ────────────────
// Pour intégration future avec /profile/messages.
//
// Mapping par statut :
//   blocked/refused/requires_validation → Alertes
//   hr normal → Suivis
//   livrable potentiel (expected outputs) → Suivis (future: Livraisons)
//   brief → Briefings (future)

export function mapHistoryItemToMessageCenterItem(
  item: CloneOSHistoryItem
): MessageCenterItem {
  const isAlert =
    item.blocked ||
    item.refused ||
    item.human_validation_required ||
    item.status === "blocked" ||
    item.status === "refused" ||
    item.status === "requires_validation";

  const tab: MessageCenterItem["tab"] = isAlert ? "alertes" : "suivis";

  const priority: MessageCenterItem["priority"] =
    item.risk_level === "critical" || item.refused
      ? "urgent"
      : item.risk_level === "high" || item.blocked
        ? "high"
        : item.human_validation_required
          ? "high"
          : item.risk_level === "medium"
            ? "normal"
            : "low";

  const status: MessageCenterItem["status"] =
    item.blocked ? "blocked"
    : item.refused ? "blocked"
    : item.human_validation_required ? "requires_validation"
    : item.status === "ready_for_execution" ? "pending"
    : "pending";

  const title =
    item.mission_title ??
    `CloneOS — ${item.domain.toUpperCase()} — plan préparé, non exécuté`;

  const summary =
    item.raw_request_summary +
    (item.human_validation_required
      ? " — Validation humaine requise."
      : item.refused
        ? " — Action refusée par CloneGuard (invariant absolu)."
        : item.blocked
          ? " — Action bloquée."
          : " — Plan préparé, non exécuté. Lecture seule.");

  return {
    id: `cloneos-history:${item.command_id}`,
    tab,
    title: title.slice(0, 120),
    summary: summary.slice(0, 300),
    priority,
    status,
    source: "cloneos",
    employee_slug: item.employee_slug,
    created_at: item.created_at,
    updated_at: item.updated_at,
    tags: [
      "CloneOS",
      item.domain,
      item.status,
      item.source,
      "plan-only",
      "lecture seule",
    ].filter(Boolean),
    action_kind: "open_cockpit_pierre",
    action_label: "Voir dans Mon espace",
    href: "/profile/agents",
    metadata: {
      command_id: item.command_id,
      domain: item.domain,
      risk_level: item.risk_level,
      task_count: item.task_count,
      history_source: item.source,
    },
    is_real_data: item.source === "server",
    read_only: true,
  };
}
