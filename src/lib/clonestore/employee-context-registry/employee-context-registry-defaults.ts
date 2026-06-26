// src/lib/clonestore/employee-context-registry/employee-context-registry-defaults.ts
// PHASE 3.20 — Global Employee Context Registry Design — Defaults
//
// DESIGN-ONLY. Pierre V1 détaillé + placeholders futurs design-only.
// execution_enabled toujours false. Aucun secret. Aucun runtime.

import type {
  EmployeeContextRegistry,
  EmployeeContextRegistryEmployee,
  EmployeeContextRegistryCapability,
  EmployeeContextRegistryFunction,
  EmployeeContextRegistryLimit,
  EmployeeContextRegistryValidationRule,
  EmployeeContextRegistryTechnologyBinding,
} from "./employee-context-registry-types";

export const DEFAULT_EMPLOYEE_CONTEXT_REGISTRY_VERSION = "3.20.0" as const;
export const DEFAULT_EMPLOYEE_CONTEXT_REGISTRY_SOURCE = "default_registry" as const;

const DESIGN_TIMESTAMP = "2026-06-08T00:00:00.000Z";

// ── Pierre — capacités ────────────────────────────────────────────────────────

function buildPierreCapabilities(): EmployeeContextRegistryCapability[] {
  const base = (
    capability_key: string,
    label: string,
    description: string,
    risk: EmployeeContextRegistryCapability["risk_level"],
    validation: EmployeeContextRegistryCapability["validation_mode"],
    clonevoice: boolean,
    outputs: string[]
  ): EmployeeContextRegistryCapability => ({
    capability_key,
    label,
    description,
    risk_level: risk,
    validation_mode: validation,
    plan_only: true,
    execution_enabled: false,
    available_in_cloneos: true,
    available_in_clonevoice: clonevoice,
    required_context: ["enterprise_footprint", "cloneadn"],
    forbidden_context: ["raw_secrets", "payment_credentials"],
    output_types: outputs,
    metadata: { design_only: true },
  });

  return [
    base("hr_mission_planning", "Planification de missions RH",
      "Prépare un plan de mission RH plan-only — jamais exécuté automatiquement.",
      "medium", "human_validation_required", true, ["mission_plan"]),
    base("hr_document_preparation", "Préparation de documents RH",
      "Prépare un brouillon de document RH — jamais signé ni envoyé sans validation.",
      "high", "human_validation_required", false, ["document_draft"]),
    base("absence_followup", "Suivi des absences",
      "Prépare un suivi d'absence — information manquante signalée.",
      "medium", "human_validation_required", true, ["absence_followup"]),
    base("onboarding_coordination", "Coordination d'onboarding",
      "Prépare une checklist d'onboarding plan-only.",
      "low", "plan_only", true, ["onboarding_checklist"]),
    base("pre_payroll_preparation", "Préparation pré-paie",
      "Prépare un résumé pré-paie pour validation humaine — ne lance jamais la paie officielle.",
      "high", "human_validation_required", false, ["pre_payroll_summary"]),
    base("internal_hr_communication_draft", "Brouillon de communication RH interne",
      "Rédige un brouillon de message RH interne — jamais envoyé sans validation.",
      "medium", "human_validation_required", true, ["message_draft"]),
    base("hr_risk_review", "Revue de risque RH",
      "Classe le niveau de risque RH d'une demande — lecture seule.",
      "medium", "plan_only", true, ["risk_classification"]),
    base("employee_file_context_review", "Revue de contexte dossier employé",
      "Résume le contexte d'un dossier employé — lecture seule.",
      "high", "human_validation_required", false, ["context_summary"]),
  ];
}

// ── Pierre — fonctions ────────────────────────────────────────────────────────

function buildPierreFunctions(): EmployeeContextRegistryFunction[] {
  const fn = (
    function_key: string,
    label: string,
    description: string,
    capability_keys: string[],
    risk: EmployeeContextRegistryFunction["risk_level"],
    validation: EmployeeContextRegistryFunction["validation_mode"]
  ): EmployeeContextRegistryFunction => ({
    function_key,
    label,
    description,
    capability_keys,
    input_contract: "Demande RH structurée (read-only, plan-only).",
    output_contract: "Plan / brouillon read-only — jamais exécuté ni envoyé.",
    risk_level: risk,
    validation_mode: validation,
    plan_only: true,
    execution_enabled: false,
    metadata: { design_only: true },
  });

  return [
    fn("prepare_hr_mission_plan", "Préparer un plan de mission RH",
      "Construit un plan de mission RH plan-only.",
      ["hr_mission_planning"], "medium", "human_validation_required"),
    fn("draft_hr_document", "Rédiger un document RH",
      "Prépare un brouillon de document RH.",
      ["hr_document_preparation"], "high", "human_validation_required"),
    fn("prepare_absence_followup", "Préparer un suivi d'absence",
      "Prépare le suivi d'un dossier d'absence.",
      ["absence_followup"], "medium", "human_validation_required"),
    fn("prepare_onboarding_checklist", "Préparer une checklist d'onboarding",
      "Construit une checklist d'onboarding plan-only.",
      ["onboarding_coordination"], "low", "plan_only"),
    fn("prepare_pre_payroll_summary", "Préparer un résumé pré-paie",
      "Prépare un résumé pré-paie pour validation humaine.",
      ["pre_payroll_preparation"], "high", "human_validation_required"),
    fn("draft_internal_hr_message", "Rédiger un message RH interne",
      "Prépare un brouillon de message RH interne.",
      ["internal_hr_communication_draft"], "medium", "human_validation_required"),
    fn("classify_hr_risk", "Classer le risque RH",
      "Classe le niveau de risque d'une demande RH.",
      ["hr_risk_review"], "medium", "plan_only"),
    fn("summarize_employee_context", "Résumer le contexte employé",
      "Résume le contexte d'un dossier employé en lecture seule.",
      ["employee_file_context_review"], "high", "human_validation_required"),
  ];
}

// ── Pierre — limites ──────────────────────────────────────────────────────────

function buildPierreLimits(): EmployeeContextRegistryLimit[] {
  const limit = (
    limit_key: string,
    label: string,
    description: string,
    severity: EmployeeContextRegistryLimit["severity"]
  ): EmployeeContextRegistryLimit => ({
    limit_key,
    label,
    description,
    severity,
    applies_to_capability_keys: [],
    reason: description,
  });

  return [
    limit("no_final_legal_decision", "Ne prend pas de décision juridique finale",
      "Pierre ne prend pas de décision juridique finale.", "critical"),
    limit("no_contract_signature", "Ne signe pas de contrat",
      "Pierre ne signe pas de contrat.", "critical"),
    limit("no_autonomous_termination", "Ne licencie jamais automatiquement",
      "Pierre ne licencie jamais automatiquement.", "critical"),
    limit("no_disciplinary_validation", "Ne valide pas une sanction disciplinaire",
      "Pierre ne valide pas une sanction disciplinaire.", "critical"),
    limit("no_human_replacement", "Ne remplace pas la responsabilité humaine",
      "Pierre ne remplace pas la responsabilité humaine.", "high"),
    limit("no_cloneguard_bypass", "Ne contourne pas CloneGuard",
      "Pierre ne contourne pas CloneGuard.", "critical"),
    limit("no_hidden_sensitive_actions", "Ne cache pas les actions sensibles",
      "Pierre ne cache pas les actions sensibles.", "high"),
    limit("no_unauthorized_server_write", "Ne modifie pas les données serveur sans autorisation",
      "Pierre ne modifie pas les données serveur sans autorisation.", "high"),
  ];
}

// ── Pierre — règles de validation ─────────────────────────────────────────────

function buildPierreValidationRules(): EmployeeContextRegistryValidationRule[] {
  const rule = (
    policy_key: string,
    label: string,
    description: string,
    risk: EmployeeContextRegistryValidationRule["risk_level"],
    approver: string,
    blocks: boolean
  ): EmployeeContextRegistryValidationRule => ({
    policy_key,
    label,
    description,
    risk_level: risk,
    required_approver_role: approver,
    blocks_execution: blocks,
    applies_to_function_keys: [],
    applies_to_capability_keys: [],
  });

  return [
    rule("sensitive_hr_requires_human_validation", "Validation humaine RH sensible",
      "Toute action RH sensible nécessite une validation humaine.",
      "high", "hr_manager", true),
    rule("legal_or_disciplinary_action_blocked", "Action légale/disciplinaire bloquée",
      "Les actions légales ou disciplinaires sont bloquées en autonomie IA.",
      "critical", "legal_or_hr_director", true),
    rule("external_email_requires_policy_check", "Email externe : contrôle policy",
      "Un email externe nécessite un contrôle policy avant tout envoi.",
      "high", "hr_manager", true),
    rule("payroll_sensitive_requires_review", "Pré-paie : revue requise",
      "Les éléments de pré-paie sensibles nécessitent une revue humaine.",
      "high", "hr_manager", true),
  ];
}

// ── Pierre — bindings technologiques ──────────────────────────────────────────

function buildPierreTechnologyBindings(): EmployeeContextRegistryTechnologyBinding[] {
  const bind = (
    technology_key: string,
    label: string,
    description: string,
    clonevoice: boolean,
    writeEnabled: boolean
  ): EmployeeContextRegistryTechnologyBinding => ({
    technology_key,
    label,
    description,
    visible_to_employee: true,
    visible_to_cloneos: true,
    visible_to_clonevoice: clonevoice,
    read_only: !writeEnabled,
    write_enabled: writeEnabled,
  });

  return [
    bind("cloneos", "CloneOS", "Orchestration des missions et tâches.", true, false),
    bind("cloneadn", "CloneADN", "Mémoire entreprise / Empreinte — lecture.", true, false),
    bind("cloneguard", "CloneGuard", "Gouvernance et garde-fous des actions sensibles.", true, false),
    bind("clonetrace", "CloneTrace", "Trace d'audit des actions.", true, false),
    bind("clonebrief", "CloneBrief", "Synthèses exécutives.", true, false),
    bind("clonevoice", "CloneVoice", "Contexte gouverné futur — accès via CloneOS uniquement (read-only).", true, false),
  ];
}

// ── Pierre Employee Context ───────────────────────────────────────────────────

export function buildPierreEmployeeContext(): EmployeeContextRegistryEmployee {
  return {
    employee_key: "pierre",
    display_name: "Pierre",
    role_title: "Employé RH opérationnel automatisé",
    definition:
      "Pierre est le poste RH opérationnel automatisé de CloneStore : centre de missions RH, "
      + "documents, onboarding, absences, pré-paie simple, communications RH, helpdesk RH, "
      + "reporting, suivi et validations. Supervision humaine constante. Plan-only en design.",
    status: "active",
    visibility: "clonevoice_governed",
    active_for_company: true,
    capabilities: buildPierreCapabilities(),
    functions: buildPierreFunctions(),
    limits: buildPierreLimits(),
    validation_rules: buildPierreValidationRules(),
    technology_bindings: buildPierreTechnologyBindings(),
    context_sources: ["enterprise_footprint", "cloneadn", "cloneos_history"],
    cloneos_visible: true,
    clonevoice_visible: true, // design-only / future governed access — pas d'exécution
    created_at: DESIGN_TIMESTAMP,
    updated_at: DESIGN_TIMESTAMP,
    metadata: { design_only: true, execution_enabled: false },
  };
}

export const PIERRE_EMPLOYEE_CONTEXT: EmployeeContextRegistryEmployee = buildPierreEmployeeContext();

// ── Placeholders futurs (design-only) ─────────────────────────────────────────

const FUTURE_PLACEHOLDER_KEYS = [
  ["clara", "Clara", "Employée Support (placeholder design-only)"],
  ["emma", "Emma", "Employée Support/Relation client (placeholder design-only)"],
  ["alex", "Alex", "Employé Ops (placeholder design-only)"],
  ["noah", "Noah", "Employé Data (placeholder design-only)"],
  ["lucas", "Lucas", "Employé Finance (placeholder design-only)"],
  ["sophie", "Sophie", "Employée Legal (placeholder design-only)"],
  ["adrien", "Adrien", "Employé Sales (placeholder design-only)"],
] as const;

export function buildFutureEmployeeContextPlaceholders(): EmployeeContextRegistryEmployee[] {
  return FUTURE_PLACEHOLDER_KEYS.map(([key, name, def]) => ({
    employee_key: key,
    display_name: name,
    role_title: `${name} — futur employé IA (non actif)`,
    definition: `${def}. Non actif en production. Aucune exécution. Design-only.`,
    status: "future_placeholder" as const,
    visibility: "company" as const,
    active_for_company: false,
    capabilities: [],
    functions: [],
    limits: [],
    validation_rules: [],
    technology_bindings: [],
    context_sources: [],
    cloneos_visible: false,
    clonevoice_visible: false,
    created_at: DESIGN_TIMESTAMP,
    updated_at: DESIGN_TIMESTAMP,
    metadata: { design_only: true, future_placeholder: true, execution_enabled: false },
  }));
}

export const FUTURE_EMPLOYEE_CONTEXT_PLACEHOLDERS: EmployeeContextRegistryEmployee[] =
  buildFutureEmployeeContextPlaceholders();

// ── Limites globales / règles globales / technologies ─────────────────────────

function buildGlobalLimits(): EmployeeContextRegistryLimit[] {
  return [
    {
      limit_key: "no_execution_in_design_phase",
      label: "Aucune exécution en phase design",
      description: "Le registry est design-only — aucune exécution n'est activée.",
      severity: "critical",
      applies_to_capability_keys: [],
      reason: "PHASE 3.20 est design-only.",
    },
    {
      limit_key: "no_clonevoice_activation",
      label: "CloneVoice non activé",
      description: "CloneVoice n'est pas activé production — accès gouverné futur uniquement.",
      severity: "high",
      applies_to_capability_keys: [],
      reason: "CloneVoice passe par CloneOS/CloneGuard/CloneTrace plus tard.",
    },
  ];
}

function buildGlobalValidationRules(): EmployeeContextRegistryValidationRule[] {
  return [
    {
      policy_key: "all_sensitive_actions_require_human_validation",
      label: "Validation humaine globale des actions sensibles",
      description: "Toute action sensible nécessite une validation humaine.",
      risk_level: "critical",
      required_approver_role: "human_supervisor",
      blocks_execution: true,
      applies_to_function_keys: [],
      applies_to_capability_keys: [],
    },
  ];
}

function buildGlobalTechnologies(): EmployeeContextRegistryTechnologyBinding[] {
  return buildPierreTechnologyBindings();
}

// ── Registry par défaut ───────────────────────────────────────────────────────

export function buildDefaultEmployeeContextRegistry(): EmployeeContextRegistry {
  return {
    registry_version: DEFAULT_EMPLOYEE_CONTEXT_REGISTRY_VERSION,
    source: DEFAULT_EMPLOYEE_CONTEXT_REGISTRY_SOURCE,
    employees: [buildPierreEmployeeContext(), ...buildFutureEmployeeContextPlaceholders()],
    global_limits: buildGlobalLimits(),
    global_validation_rules: buildGlobalValidationRules(),
    technologies: buildGlobalTechnologies(),
    generated_at: new Date().toISOString(),
    read_only: true,
    execution_enabled: false,
  };
}

export const DEFAULT_GLOBAL_EMPLOYEE_CONTEXT_REGISTRY: EmployeeContextRegistry =
  buildDefaultEmployeeContextRegistry();

export function buildEmptyEmployeeContextRegistry(): EmployeeContextRegistry {
  return {
    registry_version: DEFAULT_EMPLOYEE_CONTEXT_REGISTRY_VERSION,
    source: DEFAULT_EMPLOYEE_CONTEXT_REGISTRY_SOURCE,
    employees: [],
    global_limits: buildGlobalLimits(),
    global_validation_rules: buildGlobalValidationRules(),
    technologies: [],
    generated_at: new Date().toISOString(),
    read_only: true,
    execution_enabled: false,
  };
}
