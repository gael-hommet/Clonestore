// src/lib/clonestore/employee-context-registry/employee-context-registry-profile-feed.ts
// PHASE 3.21 — Global Employee Context Registry UI Preview / Read-Only Feed
//
// Bridge UI read-only pour /profile/agents. Réutilise les builders P3.20.
//
// INVARIANTS ABSOLUS :
//   - read-only / design-only : aucune exécution, aucun write, aucun POST
//   - pas de Supabase, pas d'API route, pas de fetch
//   - pas d'import src/lib/pierre, pas de CloneOS execution, pas de CloneVoice activation
//   - client-safe (typeof window) pour la lecture localStorage du footprint
//   - jamais de throw brut

import type {
  EmployeeContextRegistry,
  EmployeeContextRegistryEmployee,
} from "./employee-context-registry-types";
import {
  buildDefaultEmployeeContextRegistry,
} from "./employee-context-registry-defaults";
import {
  buildEmployeeContextRegistrySnapshot,
  filterActiveEmployeeContexts,
  filterCloneOSVisibleEmployeeContexts,
  filterCloneVoiceVisibleEmployeeContexts,
  findEmployeeContextByKey,
} from "./employee-context-registry-snapshot";
import {
  buildEmployeeContextRegistryFromEnterpriseFootprint,
} from "./employee-context-registry-enterprise-bridge";
import {
  buildCloneVoiceEmployeeContextContract,
  type CloneVoiceEmployeeContextContract,
} from "./employee-context-registry-clonevoice-contract";
import {
  sanitizeEmployeeContextRegistry,
  validateEmployeeContextRegistry,
} from "./employee-context-registry-validation";
// Lecture localStorage read-only de l'Empreinte (pas de Supabase, pas de Pierre moteur).
import { loadEnterpriseFootprintForCockpit } from "@/lib/clonestore/enterprise-footprint";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmployeeContextRegistryProfileFeedStatus =
  | "ready"
  | "empty"
  | "loading";

export type EmployeeContextRegistryProfileFeedSource =
  | "default_registry"
  | "enterprise_footprint"
  | "design_placeholder";

export type EmployeeContextRegistryProfileFeedSummary = {
  registry_version: string;
  source: EmployeeContextRegistryProfileFeedSource;
  employees_count: number;
  active_employees_count: number;
  future_placeholders_count: number;
  capabilities_count: number;
  functions_count: number;
  validation_rules_count: number;
  limits_count: number;
  cloneos_visible_count: number;
  clonevoice_visible_count: number;
  execution_enabled_count: number;
  has_pierre: boolean;
  has_future_placeholders: boolean;
  read_only: true;
  generated_at: string;
};

export type EmployeeContextRegistryProfileFeedCapabilityItem = {
  capability_key: string;
  label: string;
  risk_level: string;
  validation_mode: string;
  plan_only: boolean;
  execution_enabled: boolean;
  available_in_cloneos: boolean;
  available_in_clonevoice: boolean;
};

export type EmployeeContextRegistryProfileFeedFunctionItem = {
  function_key: string;
  label: string;
  risk_level: string;
  validation_mode: string;
  plan_only: boolean;
  execution_enabled: boolean;
};

export type EmployeeContextRegistryProfileFeedEmployeeCard = {
  employee_key: string;
  display_name: string;
  role_title: string;
  status: string;
  active_for_company: boolean;
  capabilities_count: number;
  functions_count: number;
  limits_count: number;
  validation_rules_count: number;
  cloneos_visible: boolean;
  clonevoice_visible: boolean;
  execution_enabled: false;
  design_only: true;
  top_capabilities: EmployeeContextRegistryProfileFeedCapabilityItem[];
  top_functions: EmployeeContextRegistryProfileFeedFunctionItem[];
  limits_labels: string[];
  validation_rule_labels: string[];
};

export type EmployeeContextRegistryProfileFeedItem = {
  id: string;
  title: string;
  body: string;
  tone: "success" | "warning" | "neutral" | "violet";
};

export type EmployeeContextRegistryProfileFeedSectionKind =
  | "overview"
  | "active_employees"
  | "future_placeholders"
  | "capabilities"
  | "validation_and_limits"
  | "clonevoice_governed_context"
  | "security_warnings";

export type EmployeeContextRegistryProfileFeedSection = {
  id: string;
  kind: EmployeeContextRegistryProfileFeedSectionKind;
  title: string;
  description: string;
  read_only: true;
};

export type EmployeeContextRegistryProfileFeedWarning = {
  code: string;
  label: string;
  tone: "success" | "warning" | "info";
};

export type EmployeeContextRegistryProfileFeedAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type EmployeeContextRegistryProfileFeedReadResult = {
  status: EmployeeContextRegistryProfileFeedStatus;
  source: EmployeeContextRegistryProfileFeedSource;
  summary: EmployeeContextRegistryProfileFeedSummary;
  sections: EmployeeContextRegistryProfileFeedSection[];
  employees: EmployeeContextRegistryProfileFeedEmployeeCard[];
  future_placeholders: EmployeeContextRegistryProfileFeedEmployeeCard[];
  warnings: EmployeeContextRegistryProfileFeedWarning[];
  actions: EmployeeContextRegistryProfileFeedAction[];
  clonevoice_contract: CloneVoiceEmployeeContextContract;
  read_only: true;
  // Microcopy invariants exposés pour l'UI :
  // CloneVoice non actif · execution_enabled false · public_launch_external_not_validated
  notes: string[];
};

// ── Labels ────────────────────────────────────────────────────────────────────

export function getEmployeeContextRegistryProfileFeedStatusLabel(
  status: EmployeeContextRegistryProfileFeedStatus
): string {
  const labels: Record<EmployeeContextRegistryProfileFeedStatus, string> = {
    ready: "Registre disponible",
    empty: "Registre vide",
    loading: "Chargement…",
  };
  return labels[status] ?? "Inconnu";
}

export function getEmployeeContextRegistryProfileFeedSourceLabel(
  source: EmployeeContextRegistryProfileFeedSource
): string {
  const labels: Record<EmployeeContextRegistryProfileFeedSource, string> = {
    default_registry: "Registre par défaut",
    enterprise_footprint: "Empreinte Entreprise",
    design_placeholder: "Design placeholder",
  };
  return labels[source] ?? "Inconnu";
}

// ── Employee card builders ────────────────────────────────────────────────────

export function buildEmployeeContextRegistryProfileFeedCapabilities(
  employee: EmployeeContextRegistryEmployee
): EmployeeContextRegistryProfileFeedCapabilityItem[] {
  return employee.capabilities.map((c) => ({
    capability_key: c.capability_key,
    label: c.label,
    risk_level: c.risk_level,
    validation_mode: c.validation_mode,
    plan_only: c.plan_only,
    execution_enabled: c.execution_enabled,
    available_in_cloneos: c.available_in_cloneos,
    available_in_clonevoice: c.available_in_clonevoice,
  }));
}

export function buildEmployeeContextRegistryProfileFeedFunctions(
  employee: EmployeeContextRegistryEmployee
): EmployeeContextRegistryProfileFeedFunctionItem[] {
  return employee.functions.map((f) => ({
    function_key: f.function_key,
    label: f.label,
    risk_level: f.risk_level,
    validation_mode: f.validation_mode,
    plan_only: f.plan_only,
    execution_enabled: f.execution_enabled,
  }));
}

function buildEmployeeCard(
  employee: EmployeeContextRegistryEmployee
): EmployeeContextRegistryProfileFeedEmployeeCard {
  const caps = buildEmployeeContextRegistryProfileFeedCapabilities(employee);
  const fns = buildEmployeeContextRegistryProfileFeedFunctions(employee);
  return {
    employee_key: employee.employee_key,
    display_name: employee.display_name,
    role_title: employee.role_title,
    status: employee.status,
    active_for_company: employee.active_for_company,
    capabilities_count: employee.capabilities.length,
    functions_count: employee.functions.length,
    limits_count: employee.limits.length,
    validation_rules_count: employee.validation_rules.length,
    cloneos_visible: employee.cloneos_visible,
    clonevoice_visible: employee.clonevoice_visible,
    execution_enabled: false,
    design_only: true,
    top_capabilities: caps.slice(0, 8),
    top_functions: fns.slice(0, 8),
    limits_labels: employee.limits.map((l) => l.label),
    validation_rule_labels: employee.validation_rules.map((r) => r.label),
  };
}

export function buildEmployeeContextRegistryProfileFeedEmployees(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryProfileFeedEmployeeCard[] {
  return filterActiveEmployeeContexts(registry).map(buildEmployeeCard);
}

function buildPlaceholderCards(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryProfileFeedEmployeeCard[] {
  return registry.employees
    .filter((e) => e.status === "future_placeholder")
    .map(buildEmployeeCard);
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function buildEmployeeContextRegistryProfileFeedSummary(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryProfileFeedSummary {
  const snapshot = buildEmployeeContextRegistrySnapshot(registry);
  const s = snapshot.summary;
  return {
    registry_version: s.registry_version,
    source: registry.source,
    employees_count: s.employees_count,
    active_employees_count: s.active_employees_count,
    future_placeholders_count: s.future_placeholders_count,
    capabilities_count: s.capabilities_count,
    functions_count: s.functions_count,
    validation_rules_count: s.validation_rules_count,
    limits_count: s.limits_count,
    cloneos_visible_count: filterCloneOSVisibleEmployeeContexts(registry).length,
    clonevoice_visible_count: filterCloneVoiceVisibleEmployeeContexts(registry).length,
    execution_enabled_count: s.execution_enabled_count,
    has_pierre: findEmployeeContextByKey(registry, "pierre") !== null,
    has_future_placeholders: s.future_placeholders_count > 0,
    read_only: true,
    generated_at: s.generated_at,
  };
}

// ── Sections ──────────────────────────────────────────────────────────────────

export function buildEmployeeContextRegistryProfileFeedSections(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryProfileFeedSection[] {
  void registry;
  return [
    { id: "sec-overview", kind: "overview", title: "Vue d'ensemble", description: "Registre global des employés IA — lecture seule, design-only.", read_only: true },
    { id: "sec-active", kind: "active_employees", title: "Employés actifs", description: "Employés IA actifs pour l'entreprise (Pierre V1).", read_only: true },
    { id: "sec-future", kind: "future_placeholders", title: "Employés futurs", description: "Placeholders design-only — non actifs en production.", read_only: true },
    { id: "sec-capabilities", kind: "capabilities", title: "Capacités & fonctions", description: "Capacités et fonctions plan-only — aucune exécution activée.", read_only: true },
    { id: "sec-validation", kind: "validation_and_limits", title: "Validations & limites", description: "Règles de validation humaine et garde-fous.", read_only: true },
    { id: "sec-clonevoice", kind: "clonevoice_governed_context", title: "CloneVoice — contexte gouverné futur", description: "Accès gouverné futur — non actif production.", read_only: true },
    { id: "sec-security", kind: "security_warnings", title: "Sécurité", description: "Keys safe, aucun secret, aucun write, aucune exécution.", read_only: true },
  ];
}

// ── Warnings ──────────────────────────────────────────────────────────────────

export function buildEmployeeContextRegistryProfileFeedWarnings(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryProfileFeedWarning[] {
  const warnings: EmployeeContextRegistryProfileFeedWarning[] = [];

  if (findEmployeeContextByKey(registry, "pierre") === null) {
    warnings.push({ code: "no_pierre", label: "Pierre absent du registry", tone: "warning" });
  }

  let execDetected = false;
  let clonevoiceWithoutCloneos = false;
  let secretLike = false;
  for (const e of registry.employees) {
    if (e.capabilities.some((c) => c.execution_enabled) || e.functions.some((f) => f.execution_enabled)) {
      execDetected = true;
    }
    if (e.clonevoice_visible && !e.cloneos_visible) clonevoiceWithoutCloneos = true;
    if (/secret|api_key|private_key|token/i.test(e.employee_key)) secretLike = true;
  }

  warnings.push({
    code: "execution_enabled_detected",
    label: execDetected ? "Exécution détectée (anomalie)" : "Aucune exécution activée",
    tone: execDetected ? "warning" : "success",
  });
  if (clonevoiceWithoutCloneos) {
    warnings.push({ code: "clonevoice_visible_but_not_cloneos", label: "CloneVoice visible sans CloneOS (anomalie)", tone: "warning" });
  }
  if (secretLike) {
    warnings.push({ code: "secret_like_key_detected", label: "Clé suspecte détectée", tone: "warning" });
  }

  warnings.push(
    { code: "placeholders_design_only", label: "Placeholders futurs design-only", tone: "info" },
    { code: "clonevoice_not_active", label: "CloneVoice non actif", tone: "info" },
    { code: "read_only_registry", label: "Registre en lecture seule", tone: "success" },
    { code: "public_launch_external_not_validated", label: "Lancement public externe non validé", tone: "info" },
  );

  return warnings;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function buildEmployeeContextRegistryProfileFeedActions(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryProfileFeedAction[] {
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

// ── Build feed depuis un registry ─────────────────────────────────────────────

export function buildEmployeeContextRegistryProfileFeed(
  registry: EmployeeContextRegistry
): EmployeeContextRegistryProfileFeedReadResult {
  // Toujours sanitize + validate (design-only safety).
  const safe = sanitizeEmployeeContextRegistry(registry);
  validateEmployeeContextRegistry(safe);

  const summary = buildEmployeeContextRegistryProfileFeedSummary(safe);
  const employees = buildEmployeeContextRegistryProfileFeedEmployees(safe);
  const futurePlaceholders = buildPlaceholderCards(safe);
  const sections = buildEmployeeContextRegistryProfileFeedSections(safe);
  const warnings = buildEmployeeContextRegistryProfileFeedWarnings(safe);
  const actions = buildEmployeeContextRegistryProfileFeedActions(safe);
  const clonevoiceContract = buildCloneVoiceEmployeeContextContract(safe);

  return {
    status: summary.active_employees_count > 0 ? "ready" : "empty",
    source: safe.source,
    summary,
    sections,
    employees,
    future_placeholders: futurePlaceholders,
    warnings,
    actions,
    clonevoice_contract: clonevoiceContract,
    read_only: true,
    notes: [
      "Les keys employee_key, function_key, capability_key ne sont pas des secrets.",
      "CloneVoice n'est pas actif production.",
      "CloneVoice ne déclenche aucune action.",
      "execution_enabled false — aucune exécution dans ce bloc.",
      "Aucun write serveur. Aucune action exécutée.",
      "public_launch_external_not_validated — lancement public externe non validé.",
    ],
  };
}

// ── Empty feed ────────────────────────────────────────────────────────────────

export function buildEmptyEmployeeContextRegistryProfileFeed(): EmployeeContextRegistryProfileFeedReadResult {
  const registry = buildDefaultEmployeeContextRegistry();
  return buildEmployeeContextRegistryProfileFeed(registry);
}

// ── Loader principal ──────────────────────────────────────────────────────────
// Read-only. Tente de lire l'Empreinte Entreprise (localStorage) pour rattacher
// le company_id. Sinon registry par défaut. Jamais de throw brut.

export function loadEmployeeContextRegistryProfileFeed(): EmployeeContextRegistryProfileFeedReadResult {
  try {
    let registry: EmployeeContextRegistry = buildDefaultEmployeeContextRegistry();

    if (typeof window !== "undefined") {
      try {
        const cockpit = loadEnterpriseFootprintForCockpit();
        if (cockpit.has_footprint && cockpit.footprint) {
          registry = buildEmployeeContextRegistryFromEnterpriseFootprint(
            cockpit.footprint as { company_id?: string; company?: { company_name?: string } }
          );
        }
      } catch {
        /* Silent fail — fallback registry par défaut */
      }
    }

    return buildEmployeeContextRegistryProfileFeed(registry);
  } catch {
    return buildEmptyEmployeeContextRegistryProfileFeed();
  }
}
