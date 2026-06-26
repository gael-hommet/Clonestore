// TECH-09 — CloneBrief Executive Summaries — Generator
// Génère des briefings exécutifs depuis les sources disponibles.
// Pas d'IA. Résumé déterministe. Ne génère jamais d'actions inventées.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneBriefExecutiveSummary,
  CloneBriefGenerationInput,
  CloneBriefGenerationResult,
  CloneBriefActionItem,
  CloneBriefRiskItem,
  CloneBriefValidationItem,
  CloneBriefBlockedItem,
  CloneBriefEmployeeSummary,
  CloneBriefTechnologySummary,
  CloneBriefMetric,
  CloneBriefType,
  CloneBriefAudience,
  CloneBriefStatus,
} from "./clonebrief-types";
import {
  generateCloneBriefId,
  buildEmptyCloneBrief,
  buildDefaultBriefPeriod,
  buildDefaultBriefMetric,
  buildSystemBriefSourceRef,
  buildTraceBriefSourceRef,
  buildCommandBriefSourceRef,
} from "./clonebrief-defaults";
import {
  buildAllBriefSections,
  buildBlockedActionsSection,
  buildValidationsRequiredSection,
  buildRisksSection,
  buildOverviewSection,
} from "./clonebrief-sections";
import {
  extractBlockedEventsFromInput,
  extractValidationEventsFromInput,
  extractCriticalEventsFromInput,
  extractCompletedEventsFromInput,
  buildAllSourceRefsFromInput,
} from "./clonebrief-source-adapters";
import {
  sortBriefSectionsByPriority,
  calculateBriefHealthScore,
} from "./clonebrief-prioritizer";

// ── Text builder helpers ──────────────────────────────────────────────────────

export function buildExecutiveSummaryText(
  input: CloneBriefGenerationInput,
  sections: CloneBriefExecutiveSummary["sections"],
): string {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const blockedCount = extractBlockedEventsFromInput(input).length;
  const validationCount = extractValidationEventsFromInput(input).length;
  const completedCount = extractCompletedEventsFromInput(input).length;
  const criticalCount = extractCriticalEventsFromInput(input).length;
  const totalEvents = events.length;
  const totalCommands = (input.command_results ?? []).length;

  if (totalEvents === 0 && totalCommands === 0) {
    return "Aucune activité enregistrée sur cette période.";
  }

  const parts: string[] = [];

  if (completedCount > 0) {
    parts.push(`${completedCount} action(s) réalisée(s) avec succès.`);
  }

  if (validationCount > 0) {
    parts.push(`${validationCount} validation(s) humaine(s) en attente — intervention requise.`);
  }

  if (blockedCount > 0) {
    parts.push(`${blockedCount} action(s) bloquée(s) par CloneGuard.`);
  }

  if (criticalCount > 0) {
    parts.push(`${criticalCount} événement(s) critique(s) détecté(s).`);
  }

  if (parts.length === 0) {
    parts.push(`${totalEvents} événement(s) enregistré(s) sans incident notable.`);
  }

  return parts.join(" ");
}

// ── Metrics builder ───────────────────────────────────────────────────────────

export function buildBriefMetrics(
  input: CloneBriefGenerationInput,
): CloneBriefMetric[] {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const completedCount = extractCompletedEventsFromInput(input).length;
  const blockedCount = extractBlockedEventsFromInput(input).length;
  const validationCount = extractValidationEventsFromInput(input).length;
  const criticalCount = extractCriticalEventsFromInput(input).length;

  const metrics: CloneBriefMetric[] = [
    { ...buildDefaultBriefMetric("Événements totaux", events.length), severity: "info" },
    {
      ...buildDefaultBriefMetric("Actions terminées", completedCount),
      severity: completedCount > 0 ? "success" : "info",
    },
    {
      ...buildDefaultBriefMetric("Validations en attente", validationCount),
      severity: validationCount > 0 ? "warning" : "info",
    },
    {
      ...buildDefaultBriefMetric("Actions bloquées", blockedCount),
      severity: blockedCount > 0 ? "risk" : "info",
    },
    {
      ...buildDefaultBriefMetric("Événements critiques", criticalCount),
      severity: criticalCount > 0 ? "critical" : "info",
    },
  ];

  return metrics;
}

// ── Items extractors from sections ────────────────────────────────────────────

export function buildBriefActionItems(
  input: CloneBriefGenerationInput,
): CloneBriefActionItem[] {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const actions: CloneBriefActionItem[] = [];

  for (const e of events) {
    if (
      e.event_type === "task_completed" ||
      e.event_type === "document_prepared" ||
      e.event_type === "email_prepared" ||
      e.event_type === "email_sent" ||
      e.event_type === "action_allowed"
    ) {
      actions.push({
        item_id: `action_${e.event_id}`,
        title: e.summary.slice(0, 100),
        description: e.description ?? e.summary,
        status: "completed",
        priority: e.risk_level === "critical" ? "urgent"
          : e.risk_level === "high" ? "high" : "normal",
        severity: "success",
        employee_slug: e.employee_slug,
        mission_id: e.mission_id,
        task_id: e.task_id,
        source_refs: [buildTraceBriefSourceRef(e.event_id)],
      });
    }
  }

  return actions;
}

export function buildBriefRiskItems(
  input: CloneBriefGenerationInput,
): CloneBriefRiskItem[] {
  const criticalEvents = extractCriticalEventsFromInput(input);
  return criticalEvents.map((e) => ({
    item_id: `risk_${e.event_id}`,
    title: e.summary.slice(0, 100),
    description: e.description ?? e.summary,
    severity: e.severity === "critical" ? "critical" : "risk",
    priority: e.risk_level === "critical" ? "urgent"
      : e.risk_level === "high" ? "high" : "normal",
    risk_level: e.risk_level,
    employee_slug: e.employee_slug,
    source_refs: [buildTraceBriefSourceRef(e.event_id)],
  }));
}

export function buildBriefValidationItems(
  input: CloneBriefGenerationInput,
): CloneBriefValidationItem[] {
  const validationEvents = extractValidationEventsFromInput(input);
  const validationCommands = (input.command_results ?? []).filter(
    (r) => r.status === "requires_validation",
  );

  const items: CloneBriefValidationItem[] = [];

  for (const e of validationEvents) {
    items.push({
      item_id: `val_${e.event_id}`,
      title: e.summary.slice(0, 100),
      description: e.description ?? e.summary,
      priority: "high",
      requested_at: e.created_at,
      requested_from: e.validation_ref?.requested_from ?? [],
      employee_slug: e.employee_slug,
      mission_id: e.mission_id,
      source_refs: [buildTraceBriefSourceRef(e.event_id)],
    });
  }

  for (const r of validationCommands) {
    items.push({
      item_id: `val_cmd_${r.command_id}`,
      title: r.classified_command?.summary ?? `Commande ${r.command_id}`,
      description: r.next_action ?? "Validation humaine requise.",
      priority: "high",
      requested_at: r.generated_at,
      requested_from: [],
      employee_slug: r.selected_route?.employee_slug,
      mission_id: r.mission_plan?.mission_id,
      source_refs: [buildCommandBriefSourceRef(r.command_id)],
    });
  }

  return items;
}

export function buildBriefBlockedItems(
  input: CloneBriefGenerationInput,
): CloneBriefBlockedItem[] {
  const blockedEvents = extractBlockedEventsFromInput(input);
  const blockedCommands = (input.command_results ?? []).filter(
    (r) => r.status === "blocked" || r.status === "refused",
  );

  const items: CloneBriefBlockedItem[] = [];

  for (const e of blockedEvents) {
    items.push({
      item_id: `blocked_${e.event_id}`,
      title: e.summary.slice(0, 100),
      description: e.description ?? e.summary,
      block_reason: e.event_type === "action_refused"
        ? "Invariant absolu CloneGuard — refusé définitivement."
        : "Action bloquée par CloneGuard.",
      severity: e.event_type === "action_refused" ? "critical" : "risk",
      is_absolute_refusal: e.event_type === "action_refused",
      employee_slug: e.employee_slug,
      action_type: e.guard_decision?.action_type,
      source_refs: [buildTraceBriefSourceRef(e.event_id)],
    });
  }

  for (const r of blockedCommands) {
    items.push({
      item_id: `blocked_cmd_${r.command_id}`,
      title: r.classified_command?.summary ?? `Commande ${r.command_id}`,
      description: r.errors.join("; ") || "Commande bloquée.",
      block_reason: r.status === "refused"
        ? "Invariant absolu CloneGuard — refusé définitivement."
        : r.errors[0] ?? "Bloqué.",
      severity: r.status === "refused" ? "critical" : "risk",
      is_absolute_refusal: r.status === "refused",
      employee_slug: r.selected_route?.employee_slug,
      source_refs: [buildCommandBriefSourceRef(r.command_id)],
    });
  }

  return items;
}

// ── Employee summaries ────────────────────────────────────────────────────────

export function buildEmployeeSummaries(
  input: CloneBriefGenerationInput,
): CloneBriefEmployeeSummary[] {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const byEmployee = new Map<string, typeof events>();

  for (const e of events) {
    if (e.employee_slug) {
      if (!byEmployee.has(e.employee_slug)) byEmployee.set(e.employee_slug, []);
      byEmployee.get(e.employee_slug)!.push(e);
    }
  }

  const summaries: CloneBriefEmployeeSummary[] = [];
  for (const [slug, evts] of byEmployee.entries()) {
    const completed = evts.filter(
      (e) => e.event_type === "task_completed" || e.event_type === "document_prepared" || e.event_type === "action_allowed",
    ).length;
    const blocked = evts.filter((e) => e.event_type === "action_blocked").length;
    const refused = evts.filter((e) => e.event_type === "action_refused").length;
    const validations = evts.filter((e) => e.event_type === "validation_requested").length;

    summaries.push({
      employee_slug: slug,
      display_name: slug === "pierre" ? "Pierre — Employé IA RH" : slug,
      domain: slug === "pierre" ? "hr" : "unknown",
      total_events: evts.length,
      completed_actions: completed,
      blocked_actions: blocked,
      refused_actions: refused,
      pending_validations: validations,
      last_activity_at: evts[evts.length - 1]?.created_at,
      health_score: Math.max(0, 100 - blocked * 10 - refused * 15 - validations * 5),
      activity_summary: `${completed} terminée(s), ${blocked} bloquée(s), ${validations} validation(s).`,
      source_refs: evts.slice(0, 3).map((e) => buildTraceBriefSourceRef(e.event_id)),
    });
  }

  return summaries;
}

// ── Technology summaries ──────────────────────────────────────────────────────

export function buildTechnologySummaries(
  input: CloneBriefGenerationInput,
): CloneBriefTechnologySummary[] {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const byTech = new Map<string, number>();

  for (const e of events) {
    for (const techRef of e.technology_refs ?? []) {
      byTech.set(techRef.technology_key, (byTech.get(techRef.technology_key) ?? 0) + 1);
    }
  }

  const summaries: CloneBriefTechnologySummary[] = [];
  for (const [key, count] of byTech.entries()) {
    summaries.push({
      technology_key: key,
      display_name: key,
      event_count: count,
      health_score: 100,
      source_refs: [],
    });
  }

  return summaries;
}

// ── Status determination ──────────────────────────────────────────────────────

function determineBriefStatus(
  input: CloneBriefGenerationInput,
  sections: CloneBriefExecutiveSummary["sections"],
): CloneBriefStatus {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const commands = input.command_results ?? [];

  if (events.length === 0 && commands.length === 0) return "empty";

  const nonEmptySections = sections.filter((s) => !s.is_empty).length;
  if (nonEmptySections === 0) return "empty";

  const blockedCount = extractBlockedEventsFromInput(input).length;
  const refusedCommands = commands.filter((r) => r.status === "refused").length;
  if (blockedCount > 0 || refusedCommands > 0) return "ready"; // "ready" même avec blocked — les blocages sont visibles

  return "ready";
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * Génère un briefing CloneOS complet depuis un input.
 * Pas d'IA. Pas d'invention. Synthèse uniquement des données existantes.
 */
export function generateCloneBrief(
  input: CloneBriefGenerationInput,
): CloneBriefGenerationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const notes: string[] = [];

  if (!input.company_id) {
    return {
      ok: false,
      brief: buildEmptyCloneBrief("unknown"),
      warnings: [],
      errors: ["company_id est requis."],
      generation_notes: [],
    };
  }

  // Construire les sections
  const allSections = buildAllBriefSections(input);
  const sortedSections = sortBriefSectionsByPriority(allSections);

  // Construire les items
  const actionItems = buildBriefActionItems(input);
  const riskItems = buildBriefRiskItems(input);
  const validationItems = buildBriefValidationItems(input);
  const blockedItems = buildBriefBlockedItems(input);
  const employeeSummaries = buildEmployeeSummaries(input);
  const techSummaries = buildTechnologySummaries(input);
  const metrics = buildBriefMetrics(input);
  const sourceRefs = buildAllSourceRefsFromInput(input);

  // Résumé exécutif
  const executiveSummary = buildExecutiveSummaryText(input, sortedSections);

  const status = determineBriefStatus(input, sortedSections);

  // Avertissements
  if (input.is_demo) warnings.push("Brief de démonstration — données non réelles.");
  if (!input.enterprise_memory) notes.push("Mémoire entreprise non disponible — contexte ADN absent.");
  if (blockedItems.length > 0) notes.push(`${blockedItems.length} action(s) bloquée(s) incluse(s) dans le briefing.`);

  const brief: CloneBriefExecutiveSummary = {
    brief_id: generateCloneBriefId(),
    company_id: input.company_id,
    brief_type: input.brief_type,
    period: input.period ?? buildDefaultBriefPeriod(input.brief_type),
    audience: input.audience,
    status,
    title: buildBriefTitle(input.brief_type, input.company_id),
    executive_summary: executiveSummary,
    key_metrics: metrics,
    sections: sortedSections,
    action_items: actionItems,
    risk_items: riskItems,
    validation_items: validationItems,
    blocked_items: blockedItems,
    employee_summaries: employeeSummaries,
    technology_summaries: techSummaries,
    source_refs: sourceRefs,
    generated_at: new Date().toISOString(),
    is_demo: input.is_demo ?? false,
    warnings,
  };

  return { ok: true, brief, warnings, errors, generation_notes: notes };
}

function buildBriefTitle(type: CloneBriefType, _companyId: string): string {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const map: Record<CloneBriefType, string> = {
    daily: `Briefing du ${today}`,
    weekly: "Résumé hebdomadaire",
    monthly: "Résumé mensuel",
    mission: "Résumé de mission",
    employee: "Activité employé IA",
    risk: "Briefing risques",
    validation: "Validations en attente",
    incident: "Briefing incident",
    executive: "Synthèse exécutive",
  };
  return map[type] ?? `Briefing CloneStore — ${today}`;
}

// ── Specialized generators ────────────────────────────────────────────────────

/**
 * Génère un briefing quotidien.
 */
export function generateDailyCloneBrief(
  input: Omit<CloneBriefGenerationInput, "brief_type">,
): CloneBriefGenerationResult {
  return generateCloneBrief({ ...input, brief_type: "daily" });
}

/**
 * Génère un briefing pour une mission précise.
 */
export function generateMissionCloneBrief(
  input: Omit<CloneBriefGenerationInput, "brief_type">,
): CloneBriefGenerationResult {
  return generateCloneBrief({ ...input, brief_type: "mission" });
}

/**
 * Génère un briefing centré sur un employé IA.
 */
export function generateEmployeeCloneBrief(
  input: Omit<CloneBriefGenerationInput, "brief_type">,
): CloneBriefGenerationResult {
  return generateCloneBrief({ ...input, brief_type: "employee" });
}

/**
 * Génère un briefing risques uniquement.
 */
export function generateRiskCloneBrief(
  input: Omit<CloneBriefGenerationInput, "brief_type">,
): CloneBriefGenerationResult {
  return generateCloneBrief({ ...input, brief_type: "risk" });
}

/**
 * Génère un briefing validations en attente.
 */
export function generateValidationCloneBrief(
  input: Omit<CloneBriefGenerationInput, "brief_type">,
): CloneBriefGenerationResult {
  return generateCloneBrief({ ...input, brief_type: "validation" });
}
