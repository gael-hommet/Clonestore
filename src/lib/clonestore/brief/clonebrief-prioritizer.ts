// TECH-09 — CloneBrief Executive Summaries — Prioritizer
// Calcule les priorités, scores de santé et trie les éléments du briefing.
// Pure functions: no async, no Supabase, no Next.js, no side effects.
// Ne masque jamais les blocked/refused. Les mets toujours en urgent/high.

import type {
  CloneBriefExecutiveSummary,
  CloneBriefSection,
  CloneBriefActionItem,
  CloneBriefRiskItem,
  CloneBriefValidationItem,
  CloneBriefBlockedItem,
  CloneBriefGenerationInput,
  CloneBriefPriority,
} from "./clonebrief-types";
import { extractBlockedEventsFromInput, extractValidationEventsFromInput, extractCriticalEventsFromInput } from "./clonebrief-source-adapters";

// ── Priority ranks ────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<CloneBriefPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

// ── Global priority ───────────────────────────────────────────────────────────

/**
 * Calcule la priorité globale du briefing depuis son input.
 * critical/refused/blocked → urgent ; validation pending → high.
 */
export function calculateBriefPriority(input: CloneBriefGenerationInput): CloneBriefPriority {
  const blockedCount = extractBlockedEventsFromInput(input).length;
  const criticalCount = extractCriticalEventsFromInput(input).length;
  const validationCount = extractValidationEventsFromInput(input).length;
  const refusedCommands = (input.command_results ?? []).filter(
    (r) => r.status === "refused",
  ).length;

  if (blockedCount > 0 || criticalCount > 0 || refusedCommands > 0) return "urgent";
  if (validationCount > 0) return "high";

  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  if (events.length > 0) return "normal";

  return "low";
}

// ── Section priority ──────────────────────────────────────────────────────────

/**
 * Calcule la priorité d'une section.
 */
export function calculateSectionPriority(section: CloneBriefSection): CloneBriefPriority {
  if (section.type === "blocked_actions" || section.type === "validations_required") {
    if (!section.is_empty) return "urgent";
  }
  if (section.type === "risks") {
    if (!section.is_empty) return "high";
  }
  if (section.severity === "critical") return "urgent";
  if (section.severity === "risk") return "high";
  if (section.severity === "warning") return "normal";
  return section.priority;
}

// ── Sort functions ────────────────────────────────────────────────────────────

/**
 * Trie les sections par priorité décroissante.
 * Les sections non-vides avant les vides.
 */
export function sortBriefSectionsByPriority(sections: CloneBriefSection[]): CloneBriefSection[] {
  return [...sections].sort((a, b) => {
    // Non-vides avant vides
    if (!a.is_empty && b.is_empty) return -1;
    if (a.is_empty && !b.is_empty) return 1;
    // Par priorité calculée
    const pa = calculateSectionPriority(a);
    const pb = calculateSectionPriority(b);
    return PRIORITY_RANK[pb] - PRIORITY_RANK[pa];
  });
}

/**
 * Trie les items d'action par priorité décroissante.
 */
export function sortActionItemsByPriority(items: CloneBriefActionItem[]): CloneBriefActionItem[] {
  return [...items].sort(
    (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
  );
}

/**
 * Trie les items de risque par priorité décroissante.
 */
export function sortRiskItemsByPriority(items: CloneBriefRiskItem[]): CloneBriefRiskItem[] {
  return [...items].sort(
    (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
  );
}

// ── List urgent items ─────────────────────────────────────────────────────────

/**
 * Liste tous les éléments urgents du briefing (blocked, refused, critical risk).
 */
export function listUrgentBriefItems(
  brief: CloneBriefExecutiveSummary,
): (CloneBriefActionItem | CloneBriefRiskItem | CloneBriefValidationItem | CloneBriefBlockedItem)[] {
  const urgent: (CloneBriefActionItem | CloneBriefRiskItem | CloneBriefValidationItem | CloneBriefBlockedItem)[] = [];

  urgent.push(...brief.blocked_items);

  for (const action of brief.action_items) {
    if (action.priority === "urgent" || action.status === "blocked" || action.status === "refused") {
      urgent.push(action);
    }
  }

  for (const risk of brief.risk_items) {
    if (risk.priority === "urgent" || risk.risk_level === "critical") {
      urgent.push(risk);
    }
  }

  return urgent;
}

/**
 * Liste les éléments nécessitant une intervention humaine.
 */
export function listBriefItemsNeedingHumanAttention(
  brief: CloneBriefExecutiveSummary,
): (CloneBriefActionItem | CloneBriefValidationItem | CloneBriefBlockedItem)[] {
  const items: (CloneBriefActionItem | CloneBriefValidationItem | CloneBriefBlockedItem)[] = [];

  // Toujours inclure les validations en attente
  items.push(...brief.validation_items);

  // Toujours inclure les bloqués absolus
  items.push(...brief.blocked_items.filter((b) => b.is_absolute_refusal));

  // Actions requires_validation
  for (const action of brief.action_items) {
    if (action.status === "requires_validation") {
      items.push(action);
    }
  }

  return items;
}

// ── Health score ──────────────────────────────────────────────────────────────

/**
 * Calcule le score de santé d'un briefing (0-100).
 * Pénalités : blocked×10, refused×15, critical risk×10, validation pending×5.
 */
export function calculateBriefHealthScore(brief: CloneBriefExecutiveSummary): number {
  if (brief.status === "empty") return 50;

  let score = 100;

  const refusedCount = brief.blocked_items.filter((b) => b.is_absolute_refusal).length;
  const blockedCount = brief.blocked_items.filter((b) => !b.is_absolute_refusal).length;
  const criticalRisks = brief.risk_items.filter((r) => r.risk_level === "critical").length;
  const validationPending = brief.validation_items.length;

  score -= refusedCount * 15;
  score -= blockedCount * 10;
  score -= criticalRisks * 10;
  score -= validationPending * 5;

  return Math.max(0, Math.min(100, score));
}
