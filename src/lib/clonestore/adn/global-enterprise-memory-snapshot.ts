// TECH-05 — GlobalEnterpriseMemory snapshot
// Génère un résumé (snapshot) de GlobalEnterpriseMemory.
// Pure functions : aucun async, aucun Supabase, aucun appel réseau.

import {
  GlobalEnterpriseMemory,
  GlobalEnterpriseMemorySnapshot,
} from "./global-enterprise-memory";
import { computeCoverageScore } from "./global-enterprise-memory-validation";

// ── Calcul des coverages par bloc ─────────────────────────────────────────────

function computeIdentityCoverage(memory: GlobalEnterpriseMemory): number {
  const fields = [
    memory.identity?.company_name,
    memory.identity?.country,
    memory.identity?.language,
    memory.identity?.timezone,
    memory.identity?.industry,
    memory.identity?.public_description,
    memory.identity?.internal_context,
  ];
  const filled = fields.filter((f) => f && String(f).trim() !== "").length;
  return Math.round((filled / fields.length) * 100);
}

function computeToneCoverage(memory: GlobalEnterpriseMemory): number {
  let score = 0;
  if (memory.tone?.default_tone?.trim()) score += 30;
  if (memory.tone?.preferred_formality?.trim()) score += 20;
  if ((memory.tone?.vocabulary_preferences?.length ?? 0) > 0) score += 20;
  if ((memory.tone?.signature_rules?.length ?? 0) > 0) score += 15;
  if ((memory.tone?.examples?.length ?? 0) > 0) score += 15;
  return score;
}

function computeHumanRegistryCoverage(memory: GlobalEnterpriseMemory): number {
  if (!memory.humans || memory.humans.total_count === 0) return 0;
  const withRole = memory.humans.humans.filter((h) => h.role_title?.trim()).length;
  const withDept = memory.humans.humans.filter((h) => h.department_id?.trim()).length;
  const total = memory.humans.humans.length;
  const completeness = ((withRole + withDept) / (total * 2)) * 100;
  return Math.min(100, Math.round(completeness));
}

function computeValidationCircuitsCoverage(memory: GlobalEnterpriseMemory): number {
  if (!memory.validation_circuits || memory.validation_circuits.length === 0) return 0;
  const withApprovers = memory.validation_circuits.filter(
    (c) => c.required_approvers.length > 0,
  ).length;
  return Math.round((withApprovers / memory.validation_circuits.length) * 100);
}

function computeDocumentsCoverage(memory: GlobalEnterpriseMemory): number {
  if (!memory.documents || memory.documents.length === 0) return 0;
  const extracted = memory.documents.filter(
    (d) => d.extraction_status === "extracted",
  ).length;
  return Math.round((extracted / memory.documents.length) * 100);
}

function computeRulesCoverage(memory: GlobalEnterpriseMemory): number {
  if (!memory.rules || memory.rules.length === 0) return 0;
  const active = memory.rules.filter((r) => r.active).length;
  return Math.round((active / memory.rules.length) * 100);
}

function computeMemoryItemsCoverage(memory: GlobalEnterpriseMemory): number {
  const items = memory.memory_items ?? [];
  if (items.length === 0) return 0;
  // 5 items couvrent les catégories essentielles => 100%
  const highConfidence = items.filter((i) => i.confidence >= 0.7).length;
  const score = Math.min(100, Math.round((highConfidence / Math.max(items.length, 1)) * 100));
  return score;
}

// ── Constructeur principal ────────────────────────────────────────────────────

/**
 * Génère un snapshot (résumé lisible) de la GlobalEnterpriseMemory.
 * Utile pour les tableaux de bord de configuration CloneADN.
 */
export function buildGlobalEnterpriseMemorySnapshot(
  memory: GlobalEnterpriseMemory,
): GlobalEnterpriseMemorySnapshot {
  const identityCoverage = computeIdentityCoverage(memory);
  const toneCoverage = computeToneCoverage(memory);
  const humanRegistryCoverage = computeHumanRegistryCoverage(memory);
  const validationCircuitsCoverage = computeValidationCircuitsCoverage(memory);
  const documentsCoverage = computeDocumentsCoverage(memory);
  const rulesCoverage = computeRulesCoverage(memory);
  const memoryItemsCoverage = computeMemoryItemsCoverage(memory);
  const overallCoverage = computeCoverageScore(memory);

  return {
    memory_id: memory.memory_id,
    company_id: memory.company_id,
    generated_at: new Date().toISOString(),

    identity_coverage: identityCoverage,
    tone_coverage: toneCoverage,
    human_registry_coverage: humanRegistryCoverage,
    validation_circuits_coverage: validationCircuitsCoverage,
    documents_coverage: documentsCoverage,
    rules_coverage: rulesCoverage,
    memory_items_coverage: memoryItemsCoverage,
    overall_coverage: overallCoverage,

    human_count: memory.humans?.humans.length ?? 0,
    active_human_count:
      memory.humans?.humans.filter((h) => h.employment_status === "active").length ?? 0,
    site_count: memory.sites?.length ?? 0,
    department_count: memory.departments?.length ?? 0,
    document_count: memory.documents?.length ?? 0,
    rule_count: memory.rules?.length ?? 0,
    memory_item_count: memory.memory_items?.length ?? 0,
    validation_circuit_count: memory.validation_circuits?.length ?? 0,

    is_demo: memory.metadata?.is_demo ?? false,
  };
}
