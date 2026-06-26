// src/lib/clonestore/employee-context-registry/employee-context-registry-snapshot.ts
// PHASE 3.20 — Global Employee Context Registry Design — Snapshot / read-only builders
//
// Module pur. Construit summary/cards/recommendations/actions read-only.
// Pas de Supabase, pas de réseau, pas de write, pas d'import Pierre.

import type {
  EmployeeContextRegistry,
  EmployeeContextRegistryEmployee,
  EmployeeContextRegistryCapability,
  EmployeeContextRegistryFunction,
  EmployeeContextRegistrySnapshot,
  EmployeeContextRegistrySummary,
  EmployeeContextRegistryCard,
  EmployeeContextRegistryRecommendation,
  EmployeeContextRegistryAction,
} from "./employee-context-registry-types";

// ── Filtres ───────────────────────────────────────────────────────────────────

export function filterActiveEmployeeContexts(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryEmployee[] {
  return registry.employees.filter((e) => e.status === "active" && e.active_for_company);
}

export function filterCloneOSVisibleEmployeeContexts(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryEmployee[] {
  return registry.employees.filter((e) => e.cloneos_visible);
}

export function filterCloneVoiceVisibleEmployeeContexts(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryEmployee[] {
  // CloneVoice visibility requiert CloneOS visibility (invariant gouverné)
  return registry.employees.filter((e) => e.clonevoice_visible && e.cloneos_visible);
}

// ── Finders ───────────────────────────────────────────────────────────────────

export function findEmployeeContextByKey(
  registry: EmployeeContextRegistry,
  employeeKey: string
): EmployeeContextRegistryEmployee | null {
  if (!employeeKey) return null;
  return registry.employees.find((e) => e.employee_key === employeeKey) ?? null;
}

export function findCapabilityContextByKey(
  registry: EmployeeContextRegistry,
  employeeKey: string,
  capabilityKey: string
): EmployeeContextRegistryCapability | null {
  const employee = findEmployeeContextByKey(registry, employeeKey);
  if (!employee) return null;
  return employee.capabilities.find((c) => c.capability_key === capabilityKey) ?? null;
}

export function findFunctionContextByKey(
  registry: EmployeeContextRegistry,
  employeeKey: string,
  functionKey: string
): EmployeeContextRegistryFunction | null {
  const employee = findEmployeeContextByKey(registry, employeeKey);
  if (!employee) return null;
  return employee.functions.find((f) => f.function_key === functionKey) ?? null;
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function buildEmployeeContextRegistrySummary(
  registry: EmployeeContextRegistry
): EmployeeContextRegistrySummary {
  const active = filterActiveEmployeeContexts(registry);
  const placeholders = registry.employees.filter((e) => e.status === "future_placeholder");

  let capabilitiesCount = 0;
  let functionsCount = 0;
  let validationRulesCount = registry.global_validation_rules.length;
  let limitsCount = registry.global_limits.length;
  let executionEnabledCount = 0;

  for (const e of registry.employees) {
    capabilitiesCount += e.capabilities.length;
    functionsCount += e.functions.length;
    validationRulesCount += e.validation_rules.length;
    limitsCount += e.limits.length;
    executionEnabledCount += e.capabilities.filter((c) => c.execution_enabled).length;
    executionEnabledCount += e.functions.filter((f) => f.execution_enabled).length;
  }

  return {
    registry_version: registry.registry_version,
    source: registry.source,
    employees_count: registry.employees.length,
    active_employees_count: active.length,
    future_placeholders_count: placeholders.length,
    capabilities_count: capabilitiesCount,
    functions_count: functionsCount,
    validation_rules_count: validationRulesCount,
    limits_count: limitsCount,
    cloneos_visible_count: filterCloneOSVisibleEmployeeContexts(registry).length,
    clonevoice_visible_count: filterCloneVoiceVisibleEmployeeContexts(registry).length,
    execution_enabled_count: executionEnabledCount,
    read_only: true,
    generated_at: new Date().toISOString(),
  };
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function buildEmployeeContextRegistryCards(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryCard[] {
  const summary = buildEmployeeContextRegistrySummary(registry);

  return [
    {
      id: "card-active-employees",
      label: "Employés actifs",
      value: summary.active_employees_count,
      sub_label: `${summary.future_placeholders_count} placeholder(s) futur(s)`,
      tone: summary.active_employees_count > 0 ? "success" : "neutral",
    },
    {
      id: "card-functions",
      label: "Fonctions disponibles",
      value: summary.functions_count,
      sub_label: `${summary.capabilities_count} capacité(s)`,
      tone: "violet",
    },
    {
      id: "card-validation",
      label: "Validations humaines",
      value: summary.validation_rules_count,
      sub_label: `${summary.limits_count} limite(s)`,
      tone: summary.validation_rules_count > 0 ? "success" : "warning",
    },
    {
      id: "card-visibility",
      label: "Visibilité CloneOS / CloneVoice",
      value: `${summary.cloneos_visible_count} / ${summary.clonevoice_visible_count}`,
      sub_label: "CloneVoice : contexte gouverné futur",
      tone: "neutral",
    },
    {
      id: "card-guardrails",
      label: "Garde-fous / exécution",
      value: summary.execution_enabled_count === 0 ? "Design-only" : `${summary.execution_enabled_count} exec`,
      sub_label: "execution_enabled = false",
      tone: summary.execution_enabled_count === 0 ? "success" : "warning",
    },
  ];
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function buildEmployeeContextRegistryRecommendations(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryRecommendation[] {
  const recs: EmployeeContextRegistryRecommendation[] = [];
  const active = filterActiveEmployeeContexts(registry);

  if (active.length === 0) {
    recs.push({
      id: "rec-no-active",
      text: "Aucun employé IA actif dans le registry — vérifier Pierre.",
      href: "/profile/agents",
      action_label: "Mon espace",
    });
  }

  if (!findEmployeeContextByKey(registry, "pierre")) {
    recs.push({
      id: "rec-pierre-missing",
      text: "Pierre est absent du registry — ajouter le contexte Pierre V1.",
      href: "/agents/pierre/setup",
      action_label: "Configurer Pierre",
    });
  }

  recs.push({
    id: "rec-clonevoice-governed",
    text: "CloneVoice accédera au contexte uniquement via CloneOS/CloneGuard/CloneTrace — non activé.",
    href: "/profile/technologies",
    action_label: "Technologies",
  });

  return recs;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function buildEmployeeContextRegistryActions(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryAction[] {
  void registry;
  return [
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: true },
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: false },
    { id: "go-technologies", label: "Technologies", href: "/profile/technologies", primary: false },
    { id: "go-pierre-setup", label: "Pierre Setup", href: "/agents/pierre/setup", primary: false },
    { id: "go-pierre-use", label: "Cockpit Pierre", href: "/agents/pierre/use", primary: false },
  ];
}

// ── Snapshot complet ──────────────────────────────────────────────────────────

export function buildEmployeeContextRegistrySnapshot(
  registry: EmployeeContextRegistry
): EmployeeContextRegistrySnapshot {
  return {
    registry,
    summary: buildEmployeeContextRegistrySummary(registry),
    cards: buildEmployeeContextRegistryCards(registry),
    recommendations: buildEmployeeContextRegistryRecommendations(registry),
    actions: buildEmployeeContextRegistryActions(registry),
    read_only: true,
  };
}
