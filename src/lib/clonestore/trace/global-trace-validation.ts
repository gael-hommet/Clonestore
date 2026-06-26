// TECH-07 — CloneTrace Global Audit Timeline — Validation
// 30 règles de validation pour GlobalTraceEvent et GlobalTraceTimeline.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalTraceEvent,
  GlobalTraceTimeline,
  GlobalTraceValidationIssue,
  GlobalTraceValidationReport,
} from "./global-trace-types";

// ── Helper ─────────────────────────────────────────────────────────────────

function issue(
  code: string,
  field: string,
  message: string,
  severity: "error" | "warning" | "info",
): GlobalTraceValidationIssue {
  return { code, field, message, severity };
}

// ── Validation d'un événement ─────────────────────────────────────────────

/**
 * Valide un événement de trace individuel.
 * Retourne un tableau de problèmes (vide = valide).
 */
export function validateGlobalTraceEvent(
  event: GlobalTraceEvent,
): GlobalTraceValidationIssue[] {
  const issues: GlobalTraceValidationIssue[] = [];

  // TV01 : event_id non vide
  if (!event.event_id?.trim()) {
    issues.push(issue("TV01", "event_id", "event_id est requis.", "error"));
  }

  // TV02 : timeline_id non vide
  if (!event.timeline_id?.trim()) {
    issues.push(issue("TV02", "timeline_id", "timeline_id est requis.", "error"));
  }

  // TV03 : company_id non vide
  if (!event.company_id?.trim()) {
    issues.push(issue("TV03", "company_id", "company_id est requis.", "error"));
  }

  // TV04 : event_type valide
  const validEventTypes = [
    "request_received", "mission_created", "task_created", "task_started",
    "task_completed", "task_failed", "action_attempted", "action_allowed",
    "action_prepared", "action_requires_validation", "action_blocked",
    "action_refused", "validation_requested", "validation_approved",
    "validation_rejected", "document_prepared", "email_prepared", "email_sent",
    "memory_read", "memory_update_proposed", "memory_update_approved",
    "guard_evaluated", "policy_matched", "employee_handoff", "schedule_created",
    "schedule_triggered", "retry_scheduled", "error_recorded", "proof_attached",
    "system_note",
  ];
  if (!validEventTypes.includes(event.event_type)) {
    issues.push(issue("TV04", "event_type", `event_type "${event.event_type}" est invalide.`, "error"));
  }

  // TV05 : severity valide
  const validSeverities = ["debug", "info", "warning", "error", "critical"];
  if (!validSeverities.includes(event.severity)) {
    issues.push(issue("TV05", "severity", `severity "${event.severity}" est invalide.`, "error"));
  }

  // TV06 : status valide
  const validStatuses = [
    "pending", "in_progress", "success", "failure",
    "blocked", "refused", "requires_validation", "cancelled",
  ];
  if (!validStatuses.includes(event.status)) {
    issues.push(issue("TV06", "status", `status "${event.status}" est invalide.`, "error"));
  }

  // TV07 : visibility valide
  const validVisibilities = ["public", "internal", "admin_only", "audit_only"];
  if (!validVisibilities.includes(event.visibility)) {
    issues.push(issue("TV07", "visibility", `visibility "${event.visibility}" est invalide.`, "error"));
  }

  // TV08 : source valide
  const validSources = [
    "cloneguard", "clonepolicy", "clonetrace", "cloneadn", "cloneos",
    "pierre_bridge", "employee_runtime", "human_action", "system_init", "test_fixture",
  ];
  if (!validSources.includes(event.source)) {
    issues.push(issue("TV08", "source", `source "${event.source}" est invalide.`, "error"));
  }

  // TV09 : actor présent et valide
  if (!event.actor?.actor_id?.trim()) {
    issues.push(issue("TV09", "actor", "actor.actor_id est requis.", "error"));
  }
  if (!event.actor?.actor_label?.trim()) {
    issues.push(issue("TV09b", "actor", "actor.actor_label est requis.", "error"));
  }

  // TV10 : summary non vide
  if (!event.summary?.trim()) {
    issues.push(issue("TV10", "summary", "Le résumé de l'événement est requis.", "error"));
  }

  // TV11 : summary ne doit pas contenir de données sensibles
  const lowerSummary = (event.summary ?? "").toLowerCase();
  const sensitiveSummaryPatterns = ["sk_live_", "whsec_", "password=", "token=", "api_key="];
  for (const pattern of sensitiveSummaryPatterns) {
    if (lowerSummary.includes(pattern.toLowerCase())) {
      issues.push(issue("TV11", "summary", `Le résumé contient une valeur sensible potentielle (${pattern}).`, "error"));
    }
  }

  // TV12 : metadata ne doit pas contenir de clés sensibles non redactées
  const sensitiveMetaKeys = [
    "password", "token", "secret", "api_key", "authorization",
    "private_key", "webhook_secret",
  ];
  for (const key of Object.keys(event.metadata ?? {})) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitiveMetaKeys.some((k) => keyLower.includes(k));
    if (isSensitive) {
      const val = event.metadata[key];
      if (val !== "[REDACTED]" && val !== null && val !== undefined) {
        issues.push(issue("TV12", "metadata", `La clé "${key}" contient potentiellement des données sensibles non redactées.`, "error"));
      }
    }
  }

  // TV13 : immutable doit être true
  if (event.immutable !== true) {
    issues.push(issue("TV13", "immutable", "immutable doit toujours être true.", "error"));
  }

  // TV14 : created_at présent et valide ISO
  if (!event.created_at?.trim()) {
    issues.push(issue("TV14", "created_at", "created_at est requis.", "error"));
  } else {
    const dt = new Date(event.created_at);
    if (isNaN(dt.getTime())) {
      issues.push(issue("TV14b", "created_at", "created_at n'est pas une date ISO valide.", "error"));
    }
  }

  // TV15 : risk_level valide
  const validRiskLevels = ["low", "medium", "high", "critical"];
  if (!validRiskLevels.includes(event.risk_level)) {
    issues.push(issue("TV15", "risk_level", `risk_level "${event.risk_level}" est invalide.`, "error"));
  }

  // TV16 : les événements refused doivent avoir severity=critical
  if (event.event_type === "action_refused" && event.severity !== "critical") {
    issues.push(issue("TV16", "severity", "Les événements action_refused doivent avoir severity=critical.", "error"));
  }

  // TV17 : les événements blocked doivent avoir severity >= warning
  if (event.event_type === "action_blocked") {
    const validBlockSeverities = ["warning", "error", "critical"];
    if (!validBlockSeverities.includes(event.severity)) {
      issues.push(issue("TV17", "severity", "Les événements action_blocked doivent avoir severity=warning, error ou critical.", "warning"));
    }
  }

  // TV18 : guard_decision requise pour guard_evaluated, action_blocked, action_refused
  const guardEventTypes = ["guard_evaluated", "action_blocked", "action_refused"];
  if (guardEventTypes.includes(event.event_type) && !event.guard_decision) {
    issues.push(issue("TV18", "guard_decision", `Les événements ${event.event_type} doivent avoir une guard_decision.`, "warning"));
  }

  // TV19 : validation_ref requise pour validation_requested
  if (event.event_type === "validation_requested" && !event.validation_ref) {
    issues.push(issue("TV19", "validation_ref", "Les événements validation_requested doivent avoir une validation_ref.", "warning"));
  }

  // TV20 : is_demo est un booléen
  if (typeof event.is_demo !== "boolean") {
    issues.push(issue("TV20", "is_demo", "is_demo doit être un booléen.", "error"));
  }

  // TV21 : tags est un tableau
  if (!Array.isArray(event.tags)) {
    issues.push(issue("TV21", "tags", "tags doit être un tableau.", "error"));
  }

  // TV22 : related_entities est un tableau
  if (!Array.isArray(event.related_entities)) {
    issues.push(issue("TV22", "related_entities", "related_entities doit être un tableau.", "error"));
  }

  // TV23 : technology_refs est un tableau
  if (!Array.isArray(event.technology_refs)) {
    issues.push(issue("TV23", "technology_refs", "technology_refs doit être un tableau.", "error"));
  }

  // TV24 : proof_refs est un tableau
  if (!Array.isArray(event.proof_refs)) {
    issues.push(issue("TV24", "proof_refs", "proof_refs doit être un tableau.", "error"));
  }

  // TV25 : summary ne doit pas dire "conformité garantie"
  if (lowerSummary.match(/conformit.* garantie|garantit.* conformit/)) {
    issues.push(issue("TV25", "summary", "Le résumé ne doit pas affirmer une conformité garantie.", "error"));
  }

  // TV26 : summary ne doit pas utiliser zero-trust
  if (lowerSummary.match(/zero.trust|z.ro.confiance|zero.confiance/)) {
    issues.push(issue("TV26", "summary", "Ne pas utiliser le terme 'zero-trust'. CloneTrust = autonomie graduelle.", "warning"));
  }

  // TV27 : actor.is_human et actor.is_ai ne peuvent pas être tous les deux true
  if (event.actor?.is_human && event.actor?.is_ai) {
    issues.push(issue("TV27", "actor", "Un acteur ne peut pas être à la fois human et ai.", "error"));
  }

  return issues;
}

// ── Validation d'une timeline ────────────────────────────────────────────────

/**
 * Valide une timeline complète.
 * Retourne un tableau de toutes les issues trouvées.
 */
export function validateGlobalTraceTimeline(
  timeline: GlobalTraceTimeline,
): GlobalTraceValidationIssue[] {
  const allIssues: GlobalTraceValidationIssue[] = [];

  // TL01 : timeline_id non vide
  if (!timeline.timeline_id?.trim()) {
    allIssues.push(issue("TL01", "timeline_id", "timeline_id est requis.", "error"));
  }

  // TL02 : company_id non vide
  if (!timeline.company_id?.trim()) {
    allIssues.push(issue("TL02", "company_id", "company_id est requis.", "error"));
  }

  // TL03 : event_count cohérent avec events.length
  if (timeline.event_count !== timeline.events.length) {
    allIssues.push(issue(
      "TL03", "event_count",
      `event_count (${timeline.event_count}) ne correspond pas au nombre réel d'événements (${timeline.events.length}).`,
      "error",
    ));
  }

  // TL04 : aucun event_id dupliqué
  const eventIds = timeline.events.map((e) => e.event_id);
  const duplicates = eventIds.filter((id, i) => eventIds.indexOf(id) !== i);
  if (duplicates.length > 0) {
    allIssues.push(issue(
      "TL04", "events",
      `event_id dupliqués détectés : ${[...new Set(duplicates)].join(", ")}`,
      "error",
    ));
  }

  // TL05 : tous les événements référencent la même company_id
  for (const ev of timeline.events) {
    if (ev.company_id !== timeline.company_id) {
      allIssues.push(issue(
        "TL05", "events",
        `L'événement ${ev.event_id} appartient à company_id=${ev.company_id}, attendu ${timeline.company_id}.`,
        "error",
      ));
    }
  }

  // TL06 : tous les événements référencent la même timeline_id
  for (const ev of timeline.events) {
    if (ev.timeline_id !== timeline.timeline_id) {
      allIssues.push(issue(
        "TL06", "events",
        `L'événement ${ev.event_id} référence timeline_id=${ev.timeline_id}, attendu ${timeline.timeline_id}.`,
        "error",
      ));
    }
  }

  // TL07 : is_demo est un booléen
  if (typeof timeline.is_demo !== "boolean") {
    allIssues.push(issue("TL07", "is_demo", "is_demo doit être un booléen.", "error"));
  }

  // Valider chaque événement individuellement
  for (const event of timeline.events) {
    const eventIssues = validateGlobalTraceEvent(event);
    allIssues.push(...eventIssues);
  }

  return allIssues;
}

// ── Rapport de validation ──────────────────────────────────────────────────

/**
 * Génère un rapport de validation complet pour une timeline.
 */
export function getGlobalTraceValidationReport(
  timeline: GlobalTraceTimeline,
): GlobalTraceValidationReport {
  const allIssues = validateGlobalTraceTimeline(timeline);
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    event_count: timeline.events.length,
    checked_at: new Date().toISOString(),
  };
}
