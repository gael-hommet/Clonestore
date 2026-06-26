// TECH-05 — GlobalEnterpriseMemory validation
// 25 règles de validation pour GlobalEnterpriseMemory.
// Pure functions : aucun async, aucun Supabase, aucun appel réseau.

import {
  GlobalEnterpriseMemory,
  GlobalEnterpriseMemoryValidationReport,
  GlobalEnterpriseMemoryValidationIssue,
} from "./global-enterprise-memory";

// ── Types internes ────────────────────────────────────────────────────────────

type IssueSeverity = "error" | "warning" | "info";

function issue(
  code: string,
  field: string,
  message: string,
  severity: IssueSeverity,
): GlobalEnterpriseMemoryValidationIssue {
  return { code, field, message, severity };
}

// ── Calcul du score de couverture ─────────────────────────────────────────────

/**
 * Calcule un score de couverture 0–100 basé sur les blocs renseignés.
 * Formule : moyenne pondérée des 7 blocs fondamentaux.
 */
export function computeCoverageScore(memory: GlobalEnterpriseMemory): number {
  const checks: { weight: number; score: number }[] = [
    // Identité (poids 20)
    {
      weight: 20,
      score:
        memory.identity.company_name &&
        memory.identity.country &&
        memory.identity.language &&
        memory.identity.timezone
          ? 1
          : memory.identity.company_name
          ? 0.5
          : 0,
    },
    // Ton (poids 15)
    {
      weight: 15,
      score:
        memory.tone.default_tone &&
        memory.tone.preferred_formality &&
        memory.tone.vocabulary_preferences.length > 0
          ? 1
          : memory.tone.default_tone
          ? 0.5
          : 0,
    },
    // Communication (poids 10)
    {
      weight: 10,
      score:
        memory.communication.allowed_channels.length > 0 &&
        memory.communication.default_channel
          ? 1
          : memory.communication.default_channel
          ? 0.5
          : 0,
    },
    // Circuits de validation (poids 15)
    {
      weight: 15,
      score:
        memory.validation_circuits.length > 0
          ? memory.validation_circuits.some(
              (c) => c.required_approvers.length > 0,
            )
            ? 1
            : 0.6
          : 0,
    },
    // Humains (poids 20)
    {
      weight: 20,
      score:
        memory.humans.total_count > 0
          ? memory.humans.active_count > 0
            ? 1
            : 0.5
          : 0,
    },
    // Règles (poids 10)
    {
      weight: 10,
      score:
        memory.rules.length > 0
          ? 1
          : memory.memory_items.some((i) => i.category === "rules")
          ? 0.5
          : 0,
    },
    // Items mémoire génériques (poids 10)
    {
      weight: 10,
      score:
        memory.memory_items.length >= 3
          ? 1
          : memory.memory_items.length > 0
          ? 0.5
          : 0,
    },
  ];

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const weighted = checks.reduce((s, c) => s + c.weight * c.score, 0);
  return Math.round((weighted / totalWeight) * 100);
}

// ── 25 règles de validation ───────────────────────────────────────────────────

export function validateGlobalEnterpriseMemory(
  memory: GlobalEnterpriseMemory,
): GlobalEnterpriseMemoryValidationReport {
  const errors: GlobalEnterpriseMemoryValidationIssue[] = [];
  const warnings: GlobalEnterpriseMemoryValidationIssue[] = [];

  // ── Règle 1 : memory_id non vide ────────────────────────────────────────────
  if (!memory.memory_id || memory.memory_id.trim() === "") {
    errors.push(issue("R01", "memory_id", "memory_id est requis.", "error"));
  }

  // ── Règle 2 : company_id non vide ───────────────────────────────────────────
  if (!memory.company_id || memory.company_id.trim() === "") {
    errors.push(issue("R02", "company_id", "company_id est requis.", "error"));
  }

  // ── Règle 3 : identity.company_name non vide ────────────────────────────────
  if (!memory.identity?.company_name?.trim()) {
    errors.push(
      issue("R03", "identity.company_name", "Le nom de l'entreprise est requis.", "error"),
    );
  }

  // ── Règle 4 : identity.country format ISO 3166-1 alpha-2 ────────────────────
  if (!memory.identity?.country || !/^[A-Z]{2}$/.test(memory.identity.country)) {
    errors.push(
      issue(
        "R04",
        "identity.country",
        "Le pays doit être un code ISO 3166-1 alpha-2 (ex: FR, US).",
        "error",
      ),
    );
  }

  // ── Règle 5 : identity.language format ISO 639-1 ────────────────────────────
  if (!memory.identity?.language || !/^[a-z]{2}$/.test(memory.identity.language)) {
    errors.push(
      issue(
        "R05",
        "identity.language",
        "La langue doit être un code ISO 639-1 (ex: fr, en).",
        "error",
      ),
    );
  }

  // ── Règle 6 : identity.timezone non vide ────────────────────────────────────
  if (!memory.identity?.timezone?.trim()) {
    errors.push(
      issue("R06", "identity.timezone", "Le fuseau horaire est requis (ex: Europe/Paris).", "error"),
    );
  }

  // ── Règle 7 : tone.default_tone non vide ────────────────────────────────────
  if (!memory.tone?.default_tone?.trim()) {
    warnings.push(
      issue(
        "R07",
        "tone.default_tone",
        "Le ton par défaut n'est pas défini. Le ton neutre sera appliqué.",
        "warning",
      ),
    );
  }

  // ── Règle 8 : tone.forbidden_tones est un tableau ───────────────────────────
  if (!Array.isArray(memory.tone?.forbidden_tones)) {
    errors.push(
      issue("R08", "tone.forbidden_tones", "forbidden_tones doit être un tableau.", "error"),
    );
  }

  // ── Règle 9 : communication.default_channel non vide ───────────────────────
  if (!memory.communication?.default_channel?.trim()) {
    warnings.push(
      issue(
        "R09",
        "communication.default_channel",
        "Le canal de communication par défaut n'est pas défini.",
        "warning",
      ),
    );
  }

  // ── Règle 10 : communication.allowed_channels non vide ─────────────────────
  if (
    !Array.isArray(memory.communication?.allowed_channels) ||
    memory.communication.allowed_channels.length === 0
  ) {
    warnings.push(
      issue(
        "R10",
        "communication.allowed_channels",
        "Aucun canal de communication autorisé défini.",
        "warning",
      ),
    );
  }

  // ── Règle 11 : validation_circuits cohérence ────────────────────────────────
  for (const circuit of memory.validation_circuits ?? []) {
    if (!circuit.circuit_id?.trim()) {
      errors.push(
        issue("R11", "validation_circuits.circuit_id", "Un circuit n'a pas d'ID.", "error"),
      );
    }
    if (circuit.sla_hours !== null && circuit.sla_hours !== undefined && circuit.sla_hours < 0) {
      errors.push(
        issue(
          "R11b",
          `validation_circuits[${circuit.circuit_id}].sla_hours`,
          "sla_hours ne peut pas être négatif.",
          "error",
        ),
      );
    }
  }

  // ── Règle 12 : humains — cohérence total_count / active_count ───────────────
  if (memory.humans) {
    const actualTotal = memory.humans.humans.length;
    if (memory.humans.total_count !== actualTotal) {
      warnings.push(
        issue(
          "R12",
          "humans.total_count",
          `total_count (${memory.humans.total_count}) ne correspond pas au nombre d'humains réels (${actualTotal}).`,
          "warning",
        ),
      );
    }
    const actualActive = memory.humans.humans.filter((h) => h.employment_status === "active").length;
    if (memory.humans.active_count !== actualActive) {
      warnings.push(
        issue(
          "R12b",
          "humans.active_count",
          `active_count (${memory.humans.active_count}) ne correspond pas aux humains actifs réels (${actualActive}).`,
          "warning",
        ),
      );
    }
  }

  // ── Règle 13 : humains — human_id unique ────────────────────────────────────
  const humanIds = (memory.humans?.humans ?? []).map((h) => h.human_id);
  const duplicateHumanIds = humanIds.filter((id, i) => humanIds.indexOf(id) !== i);
  if (duplicateHumanIds.length > 0) {
    errors.push(
      issue(
        "R13",
        "humans.humans",
        `human_id dupliqués détectés : ${[...new Set(duplicateHumanIds)].join(", ")}`,
        "error",
      ),
    );
  }

  // ── Règle 14 : humains — full_name non vide ──────────────────────────────────
  for (const human of memory.humans?.humans ?? []) {
    if (!human.full_name?.trim()) {
      errors.push(
        issue(
          "R14",
          `humans[${human.human_id}].full_name`,
          `Le prénom/nom est requis pour l'humain ${human.human_id}.`,
          "error",
        ),
      );
    }
  }

  // ── Règle 15 : sites — site_id unique ───────────────────────────────────────
  const siteIds = (memory.sites ?? []).map((s) => s.site_id);
  const duplicateSiteIds = siteIds.filter((id, i) => siteIds.indexOf(id) !== i);
  if (duplicateSiteIds.length > 0) {
    errors.push(
      issue("R15", "sites", `site_id dupliqués : ${[...new Set(duplicateSiteIds)].join(", ")}`, "error"),
    );
  }

  // ── Règle 16 : un seul siège social ─────────────────────────────────────────
  const hqCount = (memory.sites ?? []).filter((s) => s.is_headquarters && s.active).length;
  if (hqCount > 1) {
    warnings.push(
      issue("R16", "sites", `${hqCount} sièges sociaux actifs détectés. Un seul est recommandé.`, "warning"),
    );
  }

  // ── Règle 17 : départements — department_id unique ──────────────────────────
  const deptIds = (memory.departments ?? []).map((d) => d.department_id);
  const duplicateDeptIds = deptIds.filter((id, i) => deptIds.indexOf(id) !== i);
  if (duplicateDeptIds.length > 0) {
    errors.push(
      issue(
        "R17",
        "departments",
        `department_id dupliqués : ${[...new Set(duplicateDeptIds)].join(", ")}`,
        "error",
      ),
    );
  }

  // ── Règle 18 : documents — document_id unique ───────────────────────────────
  const docIds = (memory.documents ?? []).map((d) => d.document_id);
  const duplicateDocIds = docIds.filter((id, i) => docIds.indexOf(id) !== i);
  if (duplicateDocIds.length > 0) {
    errors.push(
      issue(
        "R18",
        "documents",
        `document_id dupliqués : ${[...new Set(duplicateDocIds)].join(", ")}`,
        "error",
      ),
    );
  }

  // ── Règle 19 : règles — rule_id unique ──────────────────────────────────────
  const ruleIds = (memory.rules ?? []).map((r) => r.rule_id);
  const duplicateRuleIds = ruleIds.filter((id, i) => ruleIds.indexOf(id) !== i);
  if (duplicateRuleIds.length > 0) {
    errors.push(
      issue(
        "R19",
        "rules",
        `rule_id dupliqués : ${[...new Set(duplicateRuleIds)].join(", ")}`,
        "error",
      ),
    );
  }

  // ── Règle 20 : memory_items — confidence 0.0–1.0 ────────────────────────────
  for (const item of memory.memory_items ?? []) {
    if (typeof item.confidence !== "number" || item.confidence < 0 || item.confidence > 1) {
      errors.push(
        issue(
          "R20",
          `memory_items[${item.item_id}].confidence`,
          `confidence doit être entre 0.0 et 1.0 (valeur : ${item.confidence}).`,
          "error",
        ),
      );
    }
  }

  // ── Règle 21 : memory_items — item_id unique ────────────────────────────────
  const itemIds = (memory.memory_items ?? []).map((i) => i.item_id);
  const duplicateItemIds = itemIds.filter((id, i) => itemIds.indexOf(id) !== i);
  if (duplicateItemIds.length > 0) {
    errors.push(
      issue(
        "R21",
        "memory_items",
        `item_id dupliqués : ${[...new Set(duplicateItemIds)].join(", ")}`,
        "error",
      ),
    );
  }

  // ── Règle 22 : employee_access_profiles — employee_slug unique ──────────────
  const slugs = (memory.employee_access_profiles ?? []).map((p) => p.employee_slug);
  const duplicateSlugs = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (duplicateSlugs.length > 0) {
    errors.push(
      issue(
        "R22",
        "employee_access_profiles",
        `employee_slug dupliqués : ${[...new Set(duplicateSlugs)].join(", ")}`,
        "error",
      ),
    );
  }

  // ── Règle 23 : V1 — writable_categories toujours vide ───────────────────────
  for (const profile of memory.employee_access_profiles ?? []) {
    if (profile.writable_categories.length > 0) {
      warnings.push(
        issue(
          "R23",
          `employee_access_profiles[${profile.employee_slug}].writable_categories`,
          `En V1, writable_categories doit être vide (CloneLearn activera l'écriture plus tard). Slug : ${profile.employee_slug}`,
          "warning",
        ),
      );
    }
  }

  // ── Règle 24 : validation_circuits — required_approvers référencent des humains connus ──
  const knownHumanIds = new Set((memory.humans?.humans ?? []).map((h) => h.human_id));
  for (const circuit of memory.validation_circuits ?? []) {
    for (const approver of circuit.required_approvers) {
      if (knownHumanIds.size > 0 && !knownHumanIds.has(approver)) {
        warnings.push(
          issue(
            "R24",
            `validation_circuits[${circuit.circuit_id}].required_approvers`,
            `L'approbateur "${approver}" ne correspond à aucun humain connu dans le registre.`,
            "warning",
          ),
        );
      }
    }
  }

  // ── Règle 25 : metadata.version est défini ──────────────────────────────────
  if (!memory.metadata?.version?.trim()) {
    errors.push(
      issue("R25", "metadata.version", "La version de la mémoire est requise.", "error"),
    );
  }

  // ── Calcul du rapport ────────────────────────────────────────────────────────

  const coverageScore = computeCoverageScore(memory);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    human_count: memory.humans?.humans.length ?? 0,
    site_count: memory.sites?.length ?? 0,
    department_count: memory.departments?.length ?? 0,
    document_count: memory.documents?.length ?? 0,
    rule_count: memory.rules?.length ?? 0,
    memory_item_count: memory.memory_items?.length ?? 0,
    coverage_score: coverageScore,
    checked_at: new Date().toISOString(),
  };
}
