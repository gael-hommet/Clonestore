// src/lib/clonestore/employee-context-registry/employee-context-registry-enterprise-bridge.ts
// PHASE 3.20 — Global Employee Context Registry Design — Enterprise Footprint / CloneADN Bridge
//
// DESIGN-ONLY. Prépare le lien futur entre Enterprise Footprint / CloneADN et le
// registry employés. Ne modifie pas le footprint. Ne sauvegarde rien.
// Pas de Supabase, pas de server safe apply, pas d'import Pierre, pas de runtime.

import type {
  EmployeeContextRegistry,
  EmployeeContextRegistryReadResult,
  EmployeeContextRegistryIssue,
  EmployeeContextRegistryRecommendation,
} from "./employee-context-registry-types";
import {
  buildDefaultEmployeeContextRegistry,
} from "./employee-context-registry-defaults";
import {
  filterActiveEmployeeContexts,
  filterCloneOSVisibleEmployeeContexts,
  filterCloneVoiceVisibleEmployeeContexts,
  findEmployeeContextByKey,
} from "./employee-context-registry-snapshot";

// Forme minimale lue depuis l'Enterprise Footprint (design-only, pas d'import dur).
type EnterpriseFootprintLike = {
  company_id?: string;
  company?: { company_name?: string };
} | null | undefined;

// ── Build registry depuis Enterprise Footprint ────────────────────────────────
// Si footprint absent → registry par défaut (Pierre + placeholders).
// Si company_id présent → registry.company_id = footprint.company_id.
// Ne modifie jamais le footprint. Ne sauvegarde rien.

export function buildEmployeeContextRegistryFromEnterpriseFootprint(
  footprint: EnterpriseFootprintLike
): EmployeeContextRegistry {
  const base = buildDefaultEmployeeContextRegistry();

  if (footprint && typeof footprint === "object" && footprint.company_id) {
    return {
      ...base,
      source: "enterprise_footprint",
      company_id: footprint.company_id,
    };
  }

  return base;
}

// ── Attacher le registry à un snapshot entreprise (design-only) ───────────────

export function attachEmployeeContextRegistryToEnterpriseSnapshot<T extends Record<string, unknown>>(
  snapshot: T,
  registry: EmployeeContextRegistry
): T & { employee_context_registry: EmployeeContextRegistry } {
  return {
    ...snapshot,
    employee_context_registry: registry,
  };
}

// ── Read result combiné ───────────────────────────────────────────────────────

export function buildEnterpriseEmployeeContextReadResult(
  footprint: EnterpriseFootprintLike,
  registry?: EmployeeContextRegistry
): EmployeeContextRegistryReadResult {
  const reg = registry ?? buildEmployeeContextRegistryFromEnterpriseFootprint(footprint);
  const active = filterActiveEmployeeContexts(reg);

  return {
    registry: reg,
    summary: {
      registry_version: reg.registry_version,
      source: reg.source,
      employees_count: reg.employees.length,
      active_employees_count: active.length,
      future_placeholders_count: reg.employees.filter((e) => e.status === "future_placeholder").length,
      capabilities_count: reg.employees.reduce((n, e) => n + e.capabilities.length, 0),
      functions_count: reg.employees.reduce((n, e) => n + e.functions.length, 0),
      validation_rules_count:
        reg.global_validation_rules.length +
        reg.employees.reduce((n, e) => n + e.validation_rules.length, 0),
      limits_count:
        reg.global_limits.length +
        reg.employees.reduce((n, e) => n + e.limits.length, 0),
      cloneos_visible_count: filterCloneOSVisibleEmployeeContexts(reg).length,
      clonevoice_visible_count: filterCloneVoiceVisibleEmployeeContexts(reg).length,
      execution_enabled_count: 0,
      read_only: true,
      generated_at: new Date().toISOString(),
    },
    has_active_employee: active.length > 0,
    source: reg.source,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeEnterpriseEmployeeContext(
  footprint: EnterpriseFootprintLike,
  registry?: EmployeeContextRegistry
): string {
  const result = buildEnterpriseEmployeeContextReadResult(footprint, registry);
  const company = footprint?.company?.company_name || result.registry.company_id || "Entreprise non renseignée";
  return [
    `[Employee Context Registry] ${company}`,
    `  Employés actifs : ${result.summary.active_employees_count}`,
    `  Placeholders futurs : ${result.summary.future_placeholders_count}`,
    `  Fonctions : ${result.summary.functions_count}`,
    `  Source : ${result.source}`,
    `  Design-only — aucune exécution. lancement public externe non validé.`,
  ].join("\n");
}

// ── Issues ────────────────────────────────────────────────────────────────────

export function buildEnterpriseEmployeeContextIssues(
  footprint: EnterpriseFootprintLike,
  registry?: EmployeeContextRegistry
): EmployeeContextRegistryIssue[] {
  const reg = registry ?? buildEmployeeContextRegistryFromEnterpriseFootprint(footprint);
  const issues: EmployeeContextRegistryIssue[] = [];

  if (filterActiveEmployeeContexts(reg).length === 0) {
    issues.push({ code: "no_active_employee", message: "Aucun employé IA actif.", severity: "warning" });
  }
  if (!findEmployeeContextByKey(reg, "pierre")) {
    issues.push({ code: "pierre_missing", message: "Pierre absent du registry.", severity: "blocking" });
  }
  for (const e of reg.employees) {
    if (e.status === "active" && !e.cloneos_visible) {
      issues.push({ code: "cloneos_visibility_missing", message: `${e.employee_key} non visible CloneOS.`, severity: "warning" });
    }
    if (e.clonevoice_visible && !e.cloneos_visible) {
      issues.push({ code: "clonevoice_visibility_without_cloneos", message: `${e.employee_key} CloneVoice sans CloneOS.`, severity: "blocking" });
    }
    const execCaps = e.capabilities.filter((c) => c.execution_enabled).length;
    const execFns = e.functions.filter((f) => f.execution_enabled).length;
    if (execCaps + execFns > 0) {
      issues.push({ code: "execution_enabled_in_design_phase", message: `${e.employee_key} a de l'exécution activée.`, severity: "blocking" });
    }
    if (e.status === "active" && e.validation_rules.length === 0) {
      issues.push({ code: "validation_rule_missing", message: `${e.employee_key} sans règle de validation.`, severity: "warning" });
    }
  }

  // Détection de clé secret-like (design safety)
  for (const e of reg.employees) {
    if (/secret|api_key|private_key|token/i.test(e.employee_key)) {
      issues.push({ code: "secret_like_key_detected", message: `Clé suspecte : ${e.employee_key}.`, severity: "blocking" });
    }
  }

  return issues;
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function buildEnterpriseEmployeeContextRecommendations(
  footprint: EnterpriseFootprintLike,
  registry?: EmployeeContextRegistry
): EmployeeContextRegistryRecommendation[] {
  const issues = buildEnterpriseEmployeeContextIssues(footprint, registry);
  const recs: EmployeeContextRegistryRecommendation[] = [];

  if (issues.some((i) => i.code === "pierre_missing")) {
    recs.push({
      id: "rec-add-pierre",
      text: "Ajouter le contexte Pierre V1 au registry.",
      href: "/agents/pierre/setup",
      action_label: "Configurer Pierre",
    });
  }
  if (issues.some((i) => i.code === "no_active_employee")) {
    recs.push({
      id: "rec-activate-employee",
      text: "Activer au moins un employé IA pour l'entreprise.",
      href: "/profile/agents",
      action_label: "Mon espace",
    });
  }

  recs.push({
    id: "rec-footprint",
    text: "Compléter l'Empreinte Entreprise pour enrichir le contexte employés.",
    href: "/profile/onboarding",
    action_label: "Onboarding",
  });

  return recs;
}
