// TECH-09 — CloneBrief Executive Summaries — Storage (In-Memory)
// Storage compatible pure en mémoire — prépare la future persistance sans toucher DB.
// Pas de Supabase write. Pas de migration. Pas de service role. Pas d'API.
// Pure functions with in-memory Map (reset entre sessions).

import type {
  CloneBriefExecutiveSummary,
  CloneBriefCompanyId,
  CloneBriefId,
} from "./clonebrief-types";
import { buildEmptyCloneBrief } from "./clonebrief-defaults";

// ── In-memory store ───────────────────────────────────────────────────────────

// Indexé par company_id → Map<brief_id, brief>
const briefStore = new Map<string, Map<CloneBriefId, CloneBriefExecutiveSummary>>();

// ── Storage functions ─────────────────────────────────────────────────────────

export function saveCloneBriefInMemory(brief: CloneBriefExecutiveSummary): void {
  if (!briefStore.has(brief.company_id)) {
    briefStore.set(brief.company_id, new Map());
  }
  briefStore.get(brief.company_id)!.set(brief.brief_id, brief);
}

export function getCloneBrief(
  briefId: CloneBriefId,
): CloneBriefExecutiveSummary | undefined {
  for (const companyBriefs of briefStore.values()) {
    const brief = companyBriefs.get(briefId);
    if (brief) return brief;
  }
  return undefined;
}

export function listCloneBriefs(
  companyId: CloneBriefCompanyId,
): CloneBriefExecutiveSummary[] {
  const companyBriefs = briefStore.get(companyId);
  if (!companyBriefs) return [];
  return Array.from(companyBriefs.values()).sort(
    (a, b) => b.generated_at.localeCompare(a.generated_at),
  );
}

export function clearCloneBriefStore(): void {
  briefStore.clear();
}

// ── Serialization ─────────────────────────────────────────────────────────────

/**
 * Sérialise un briefing en JSON string.
 * Retire les données sensibles avant export.
 */
export function serializeCloneBrief(brief: CloneBriefExecutiveSummary): string {
  // Sanitize — retire les tokens sensibles du summary (défense en profondeur)
  const sanitized: CloneBriefExecutiveSummary = {
    ...brief,
    executive_summary: brief.executive_summary
      .replace(/sk_live_\S+/gi, "[REDACTED]")
      .replace(/whsec_\S+/gi, "[REDACTED]")
      .replace(/OPENAI_API_KEY\S*/gi, "[REDACTED]")
      .replace(/ANTHROPIC_API_KEY\S*/gi, "[REDACTED]"),
  };
  return JSON.stringify(sanitized, null, 2);
}

/**
 * Normalise un payload brut en CloneBriefExecutiveSummary valide.
 * Applique les defaults pour les champs manquants.
 */
export function normalizeCloneBriefPayload(
  payload: Partial<CloneBriefExecutiveSummary>,
): CloneBriefExecutiveSummary {
  const defaults = buildEmptyCloneBrief(
    payload.company_id ?? "unknown",
    payload.brief_type ?? "daily",
  );

  return {
    ...defaults,
    ...payload,
    brief_id: payload.brief_id ?? defaults.brief_id,
    company_id: payload.company_id ?? defaults.company_id,
    brief_type: payload.brief_type ?? defaults.brief_type,
    period: payload.period ?? defaults.period,
    audience: payload.audience ?? defaults.audience,
    status: payload.status ?? defaults.status,
    title: payload.title ?? defaults.title,
    executive_summary: payload.executive_summary ?? defaults.executive_summary,
    key_metrics: Array.isArray(payload.key_metrics) ? payload.key_metrics : defaults.key_metrics,
    sections: Array.isArray(payload.sections) ? payload.sections : defaults.sections,
    action_items: Array.isArray(payload.action_items) ? payload.action_items : defaults.action_items,
    risk_items: Array.isArray(payload.risk_items) ? payload.risk_items : defaults.risk_items,
    validation_items: Array.isArray(payload.validation_items) ? payload.validation_items : defaults.validation_items,
    blocked_items: Array.isArray(payload.blocked_items) ? payload.blocked_items : defaults.blocked_items,
    employee_summaries: Array.isArray(payload.employee_summaries) ? payload.employee_summaries : defaults.employee_summaries,
    technology_summaries: Array.isArray(payload.technology_summaries) ? payload.technology_summaries : defaults.technology_summaries,
    source_refs: Array.isArray(payload.source_refs) ? payload.source_refs : defaults.source_refs,
    generated_at: payload.generated_at ?? defaults.generated_at,
    is_demo: payload.is_demo ?? defaults.is_demo,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : defaults.warnings,
  };
}

/**
 * Fusionne un briefing par défaut avec une version stockée.
 */
export function mergeCloneBriefWithStoredPayload(
  defaultBrief: CloneBriefExecutiveSummary,
  stored: Partial<CloneBriefExecutiveSummary>,
): CloneBriefExecutiveSummary {
  return normalizeCloneBriefPayload({ ...defaultBrief, ...stored });
}
