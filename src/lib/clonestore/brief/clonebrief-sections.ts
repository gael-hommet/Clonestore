// TECH-09 — CloneBrief Executive Summaries — Sections
// Construit les sections d'un briefing depuis les données sources.
// Pure functions: no async, no Supabase, no Next.js, no side effects.
// Ne génère jamais d'actions inventées. Ne masque jamais les blocages.

import type {
  CloneBriefSection,
  CloneBriefActionItem,
  CloneBriefRiskItem,
  CloneBriefValidationItem,
  CloneBriefBlockedItem,
  CloneBriefGenerationInput,
  CloneBriefSeverity,
  CloneBriefPriority,
} from "./clonebrief-types";
import {
  buildEmptyBriefSection,
  buildTraceBriefSourceRef,
  buildCommandBriefSourceRef,
  buildSystemBriefSourceRef,
} from "./clonebrief-defaults";
import {
  extractBlockedEventsFromInput,
  extractValidationEventsFromInput,
  extractCriticalEventsFromInput,
  extractCompletedEventsFromInput,
} from "./clonebrief-source-adapters";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildItemId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function mapRiskLevelToPriority(riskLevel: string): CloneBriefPriority {
  if (riskLevel === "critical") return "urgent";
  if (riskLevel === "high") return "high";
  if (riskLevel === "medium") return "normal";
  return "low";
}

function mapRiskLevelToSeverity(riskLevel: string): CloneBriefSeverity {
  if (riskLevel === "critical") return "critical";
  if (riskLevel === "high") return "risk";
  if (riskLevel === "medium") return "warning";
  return "info";
}

// ── Section: Overview ─────────────────────────────────────────────────────────

export function buildOverviewSection(input: CloneBriefGenerationInput): CloneBriefSection {
  const section = buildEmptyBriefSection("overview");
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const commands = input.command_results ?? [];

  const totalEvents = events.length;
  const totalCommands = commands.length;
  const blockedCount = extractBlockedEventsFromInput(input).length;
  const completedCount = extractCompletedEventsFromInput(input).length;
  const validationCount = extractValidationEventsFromInput(input).length;

  if (totalEvents === 0 && totalCommands === 0) {
    section.summary = "Aucune activité enregistrée pour cette période.";
    section.is_empty = true;
    return section;
  }

  const parts: string[] = [];
  if (completedCount > 0) parts.push(`${completedCount} action(s) terminée(s)`);
  if (validationCount > 0) parts.push(`${validationCount} validation(s) en attente`);
  if (blockedCount > 0) parts.push(`${blockedCount} action(s) bloquée(s)`);
  if (parts.length === 0) parts.push(`${totalEvents} événement(s) enregistré(s)`);

  section.summary = parts.join(", ") + ".";
  section.is_empty = false;
  section.severity = blockedCount > 0 ? "warning" : "info";
  section.source_refs = [buildSystemBriefSourceRef()];

  return section;
}

// ── Section: Completed Actions ────────────────────────────────────────────────

export function buildCompletedActionsSection(input: CloneBriefGenerationInput): CloneBriefSection {
  const section = buildEmptyBriefSection("completed_actions");
  const completedEvents = extractCompletedEventsFromInput(input);

  if (completedEvents.length === 0) {
    section.summary = "Aucune action terminée sur cette période.";
    section.is_empty = true;
    return section;
  }

  const items: CloneBriefActionItem[] = completedEvents.map((e) => ({
    item_id: buildItemId("action"),
    title: e.summary.slice(0, 100),
    description: e.description ?? e.summary,
    status: "completed",
    priority: mapRiskLevelToPriority(e.risk_level),
    severity: "success",
    employee_slug: e.employee_slug,
    mission_id: e.mission_id,
    task_id: e.task_id,
    source_refs: [buildTraceBriefSourceRef(e.event_id)],
  }));

  section.items = items;
  section.summary = `${items.length} action(s) terminée(s).`;
  section.is_empty = false;
  section.severity = "success";
  section.source_refs = completedEvents.map((e) => buildTraceBriefSourceRef(e.event_id));

  return section;
}

// ── Section: Pending Actions ──────────────────────────────────────────────────

export function buildPendingActionsSection(input: CloneBriefGenerationInput): CloneBriefSection {
  const section = buildEmptyBriefSection("pending_actions");
  const commands = input.command_results ?? [];

  const pendingCommands = commands.filter(
    (r) => r.status === "ready_for_execution" || r.status === "requires_validation",
  );

  if (pendingCommands.length === 0) {
    section.summary = "Aucune action en attente d'exécution.";
    section.is_empty = true;
    return section;
  }

  const items: CloneBriefActionItem[] = pendingCommands.map((r) => ({
    item_id: buildItemId("pending"),
    title: r.classified_command?.summary ?? `Commande ${r.command_id}`,
    description: r.next_action ?? "En attente d'exécution.",
    status: r.status === "requires_validation" ? "requires_validation" : "pending",
    priority: r.classified_command?.risk_level === "critical" ? "urgent"
      : r.classified_command?.risk_level === "high" ? "high" : "normal",
    severity: r.status === "requires_validation" ? "warning" : "info",
    employee_slug: r.selected_route?.employee_slug,
    mission_id: r.mission_plan?.mission_id,
    source_refs: [buildCommandBriefSourceRef(r.command_id)],
  }));

  section.items = items;
  section.summary = `${items.length} action(s) en attente.`;
  section.is_empty = false;
  section.severity = "warning";
  section.source_refs = pendingCommands.map((r) => buildCommandBriefSourceRef(r.command_id));

  return section;
}

// ── Section: Blocked Actions ──────────────────────────────────────────────────

/**
 * Les actions bloquées ne sont jamais masquées.
 * Cette section est toujours incluse si des blocages existent.
 */
export function buildBlockedActionsSection(input: CloneBriefGenerationInput): CloneBriefSection {
  const section = buildEmptyBriefSection("blocked_actions");
  const blockedEvents = extractBlockedEventsFromInput(input);
  const blockedCommands = (input.command_results ?? []).filter(
    (r) => r.status === "blocked" || r.status === "refused",
  );

  if (blockedEvents.length === 0 && blockedCommands.length === 0) {
    section.summary = "Aucune action bloquée.";
    section.is_empty = true;
    return section;
  }

  const items: CloneBriefBlockedItem[] = [];

  for (const e of blockedEvents) {
    items.push({
      item_id: buildItemId("blocked"),
      title: e.summary.slice(0, 100),
      description: e.description ?? e.summary,
      block_reason: e.guard_decision?.decision === "refuse"
        ? "Invariant absolu CloneGuard — action refusée définitivement."
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
      item_id: buildItemId("blocked_cmd"),
      title: r.classified_command?.summary ?? `Commande ${r.command_id}`,
      description: r.errors.join("; ") || "Commande bloquée.",
      block_reason: r.status === "refused"
        ? "Invariant absolu CloneGuard — commande refusée définitivement."
        : r.errors[0] ?? "Bloqué par CloneOS.",
      severity: r.status === "refused" ? "critical" : "risk",
      is_absolute_refusal: r.status === "refused",
      employee_slug: r.selected_route?.employee_slug,
      source_refs: [buildCommandBriefSourceRef(r.command_id)],
    });
  }

  section.items = items;
  section.summary = `${items.length} action(s) bloquée(s) — attention requise.`;
  section.is_empty = false;
  section.severity = items.some((i) => i.is_absolute_refusal) ? "critical" : "risk";
  section.priority = items.some((i) => i.is_absolute_refusal) ? "urgent" : "high";

  return section;
}

// ── Section: Validations Required ────────────────────────────────────────────

/**
 * Les validations en attente ne sont jamais masquées.
 */
export function buildValidationsRequiredSection(
  input: CloneBriefGenerationInput,
): CloneBriefSection {
  const section = buildEmptyBriefSection("validations_required");
  const validationEvents = extractValidationEventsFromInput(input);
  const validationCommands = (input.command_results ?? []).filter(
    (r) => r.status === "requires_validation",
  );

  if (validationEvents.length === 0 && validationCommands.length === 0) {
    section.summary = "Aucune validation humaine en attente.";
    section.is_empty = true;
    return section;
  }

  const items: CloneBriefValidationItem[] = [];

  for (const e of validationEvents) {
    items.push({
      item_id: buildItemId("val"),
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
      item_id: buildItemId("val_cmd"),
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

  section.items = items;
  section.summary = `${items.length} validation(s) humaine(s) en attente.`;
  section.is_empty = false;
  section.severity = "warning";
  section.priority = "high";

  return section;
}

// ── Section: Risks ────────────────────────────────────────────────────────────

/**
 * Les risques critiques sont toujours inclus et jamais masqués.
 */
export function buildRisksSection(input: CloneBriefGenerationInput): CloneBriefSection {
  const section = buildEmptyBriefSection("risks");
  const criticalEvents = extractCriticalEventsFromInput(input);
  const highRiskCommands = (input.command_results ?? []).filter(
    (r) => r.classified_command?.risk_level === "critical" ||
           r.classified_command?.risk_level === "high",
  );

  if (criticalEvents.length === 0 && highRiskCommands.length === 0) {
    section.summary = "Aucun risque identifié sur cette période.";
    section.is_empty = true;
    return section;
  }

  const items: CloneBriefRiskItem[] = [];

  for (const e of criticalEvents) {
    items.push({
      item_id: buildItemId("risk"),
      title: e.summary.slice(0, 100),
      description: e.description ?? e.summary,
      severity: mapRiskLevelToSeverity(e.risk_level),
      priority: mapRiskLevelToPriority(e.risk_level),
      risk_level: e.risk_level,
      employee_slug: e.employee_slug,
      source_refs: [buildTraceBriefSourceRef(e.event_id)],
    });
  }

  for (const r of highRiskCommands) {
    const riskLevel = r.classified_command?.risk_level ?? "high";
    items.push({
      item_id: buildItemId("risk_cmd"),
      title: r.classified_command?.summary ?? `Commande ${r.command_id}`,
      description: r.errors.join("; ") || "Commande à risque élevé.",
      severity: mapRiskLevelToSeverity(riskLevel),
      priority: mapRiskLevelToPriority(riskLevel),
      risk_level: riskLevel as "low" | "medium" | "high" | "critical",
      employee_slug: r.selected_route?.employee_slug,
      source_refs: [buildCommandBriefSourceRef(r.command_id)],
    });
  }

  section.items = items;
  section.summary = `${items.length} risque(s) identifié(s).`;
  section.is_empty = false;
  section.severity = items.some((i) => i.risk_level === "critical") ? "critical" : "risk";
  section.priority = items.some((i) => i.priority === "urgent") ? "urgent" : "high";

  return section;
}

// ── Section: Employee Activity ────────────────────────────────────────────────

export function buildEmployeeActivitySection(
  input: CloneBriefGenerationInput,
): CloneBriefSection {
  const section = buildEmptyBriefSection("employee_activity");
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];

  // Grouper par employee_slug
  const byEmployee = new Map<string, typeof events>();
  for (const e of events) {
    if (e.employee_slug) {
      if (!byEmployee.has(e.employee_slug)) byEmployee.set(e.employee_slug, []);
      byEmployee.get(e.employee_slug)!.push(e);
    }
  }

  if (byEmployee.size === 0) {
    section.summary = "Aucune activité d'employé IA enregistrée.";
    section.is_empty = true;
    return section;
  }

  const summaries: string[] = [];
  for (const [slug, evts] of byEmployee.entries()) {
    summaries.push(`${slug}: ${evts.length} événement(s)`);
  }
  section.summary = summaries.join(". ") + ".";
  section.is_empty = false;
  section.severity = "info";

  return section;
}

// ── Section: Technology Activity ──────────────────────────────────────────────

export function buildTechnologyActivitySection(
  input: CloneBriefGenerationInput,
): CloneBriefSection {
  const section = buildEmptyBriefSection("technology_activity");
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];

  // Grouper par technology_key
  const byTech = new Map<string, number>();
  for (const e of events) {
    for (const techRef of e.technology_refs ?? []) {
      byTech.set(techRef.technology_key, (byTech.get(techRef.technology_key) ?? 0) + 1);
    }
  }

  if (byTech.size === 0) {
    section.summary = "Aucune activité technologique enregistrée.";
    section.is_empty = true;
    return section;
  }

  const summaries: string[] = [];
  for (const [key, count] of byTech.entries()) {
    summaries.push(`${key}: ${count} événement(s)`);
  }
  section.summary = summaries.join(". ") + ".";
  section.is_empty = false;
  section.severity = "info";

  return section;
}

// ── Section: Next Steps ───────────────────────────────────────────────────────

export function buildNextStepsSection(input: CloneBriefGenerationInput): CloneBriefSection {
  const section = buildEmptyBriefSection("next_steps");
  const validationItems = extractValidationEventsFromInput(input);
  const blockedItems = extractBlockedEventsFromInput(input);
  const pendingCommands = (input.command_results ?? []).filter(
    (r) => r.status === "requires_validation" || r.status === "ready_for_execution",
  );

  const steps: string[] = [];
  if (validationItems.length > 0) {
    steps.push(`Traiter ${validationItems.length} validation(s) humaine(s) en attente.`);
  }
  if (blockedItems.length > 0) {
    steps.push(`Examiner ${blockedItems.length} action(s) bloquée(s).`);
  }
  if (pendingCommands.length > 0) {
    steps.push(`${pendingCommands.length} commande(s) CloneOS prêtes à exécution.`);
  }

  if (steps.length === 0) {
    section.summary = "Aucune étape suivante identifiée.";
    section.is_empty = true;
    return section;
  }

  section.summary = steps.join(" ");
  section.is_empty = false;
  section.severity = blockedItems.length > 0 ? "warning" : "info";

  return section;
}

// ── Section: Attention Points ─────────────────────────────────────────────────

export function buildAttentionPointsSection(
  input: CloneBriefGenerationInput,
): CloneBriefSection {
  const section = buildEmptyBriefSection("attention_points");
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const errorEvents = events.filter(
    (e) => e.event_type === "error_recorded" || e.severity === "error",
  );

  if (errorEvents.length === 0) {
    section.summary = "Aucun point d'attention particulier.";
    section.is_empty = true;
    return section;
  }

  section.summary = `${errorEvents.length} erreur(s) système enregistrée(s).`;
  section.is_empty = false;
  section.severity = "risk";
  section.priority = "high";

  return section;
}

// ── Section: System Health ────────────────────────────────────────────────────

export function buildSystemHealthSection(input: CloneBriefGenerationInput): CloneBriefSection {
  const section = buildEmptyBriefSection("system_health");
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  const criticalCount = events.filter((e) => e.severity === "critical").length;
  const errorCount = events.filter((e) => e.severity === "error").length;
  const blockedCount = extractBlockedEventsFromInput(input).length;

  let healthScore = 100;
  healthScore -= criticalCount * 10;
  healthScore -= errorCount * 5;
  healthScore -= blockedCount * 3;
  healthScore = Math.max(0, healthScore);

  const healthLabel = healthScore >= 80 ? "Sain" : healthScore >= 50 ? "Dégradé" : "Critique";

  section.summary = `Score de santé: ${healthScore}/100 (${healthLabel}).`;
  section.is_empty = false;
  section.severity = healthScore >= 80 ? "success" : healthScore >= 50 ? "warning" : "critical";

  return section;
}

// ── Build All Sections ────────────────────────────────────────────────────────

/**
 * Construit toutes les sections d'un briefing depuis l'input.
 * N'exclut jamais les sections blocked/validations si données présentes.
 */
export function buildAllBriefSections(input: CloneBriefGenerationInput): CloneBriefSection[] {
  return [
    buildOverviewSection(input),
    buildCompletedActionsSection(input),
    buildPendingActionsSection(input),
    buildBlockedActionsSection(input),
    buildValidationsRequiredSection(input),
    buildRisksSection(input),
    buildEmployeeActivitySection(input),
    buildTechnologyActivitySection(input),
    buildNextStepsSection(input),
    buildAttentionPointsSection(input),
    buildSystemHealthSection(input),
  ];
}
