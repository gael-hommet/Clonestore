// src/lib/clonestore/employee-context-registry/employee-context-registry-types.ts
// PHASE 3.20 — Global Employee Context Registry Design — Types
//
// Registre global DESIGN-ONLY des employés IA, fonctions, capacités, limites,
// règles de validation, technologies et visibilité de contexte.
//
// INVARIANTS ABSOLUS :
//   - design-only : aucune exécution, aucun write, aucun runtime
//   - clés produit safe (employee_key, function_key, capability_key,
//     technology_key, policy_key) — JAMAIS de secrets / API keys
//   - execution_enabled false par défaut
//   - pas de Supabase, pas de réseau, pas d'import src/lib/pierre

// ── Clés produit safe (PAS des secrets) ───────────────────────────────────────
// Ces identifiants sont des clés de registre produit, lowercase snake_case.

export type EmployeeContextRegistryKey = string;
export type EmployeeContextRegistryEmployeeKey = string;   // ex: "pierre"
export type EmployeeContextRegistryCapabilityKey = string; // ex: "hr_mission_planning"
export type EmployeeContextRegistryFunctionKey = string;   // ex: "prepare_hr_mission_plan"
export type EmployeeContextRegistryTechnologyKey = string; // ex: "cloneos"
export type EmployeeContextRegistryPolicyKey = string;     // ex: "sensitive_hr_requires_human_validation"

// ── Enums ─────────────────────────────────────────────────────────────────────

export type EmployeeContextRegistryStatus =
  | "active"
  | "beta"
  | "roadmap"
  | "future_placeholder"
  | "disabled";

export type EmployeeContextRegistryVisibility =
  | "private"
  | "company"
  | "cloneos"
  | "clonevoice_governed";

export type EmployeeContextRegistryRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type EmployeeContextRegistryValidationMode =
  | "none"
  | "plan_only"
  | "human_validation_required"
  | "blocked";

export type EmployeeContextRegistrySource =
  | "default_registry"
  | "enterprise_footprint"
  | "design_placeholder";

// ── Capability ────────────────────────────────────────────────────────────────

export type EmployeeContextRegistryCapability = {
  capability_key: EmployeeContextRegistryCapabilityKey;
  label: string;
  description: string;
  risk_level: EmployeeContextRegistryRiskLevel;
  validation_mode: EmployeeContextRegistryValidationMode;
  plan_only: boolean;
  execution_enabled: boolean;
  available_in_cloneos: boolean;
  available_in_clonevoice: boolean;
  required_context: string[];
  forbidden_context: string[];
  output_types: string[];
  metadata: Record<string, unknown>;
};

// ── Function ──────────────────────────────────────────────────────────────────

export type EmployeeContextRegistryFunction = {
  function_key: EmployeeContextRegistryFunctionKey;
  label: string;
  description: string;
  capability_keys: EmployeeContextRegistryCapabilityKey[];
  input_contract: string;
  output_contract: string;
  risk_level: EmployeeContextRegistryRiskLevel;
  validation_mode: EmployeeContextRegistryValidationMode;
  plan_only: boolean;
  execution_enabled: boolean;
  metadata: Record<string, unknown>;
};

// ── Limit ─────────────────────────────────────────────────────────────────────

export type EmployeeContextRegistryLimit = {
  limit_key: string;
  label: string;
  description: string;
  severity: EmployeeContextRegistryRiskLevel;
  applies_to_capability_keys: EmployeeContextRegistryCapabilityKey[];
  reason: string;
};

// ── Validation Rule ───────────────────────────────────────────────────────────

export type EmployeeContextRegistryValidationRule = {
  policy_key: EmployeeContextRegistryPolicyKey;
  label: string;
  description: string;
  risk_level: EmployeeContextRegistryRiskLevel;
  required_approver_role: string;
  blocks_execution: boolean;
  applies_to_function_keys: EmployeeContextRegistryFunctionKey[];
  applies_to_capability_keys: EmployeeContextRegistryCapabilityKey[];
};

// ── Technology Binding ────────────────────────────────────────────────────────

export type EmployeeContextRegistryTechnologyBinding = {
  technology_key: EmployeeContextRegistryTechnologyKey;
  label: string;
  description: string;
  visible_to_employee: boolean;
  visible_to_cloneos: boolean;
  visible_to_clonevoice: boolean;
  read_only: boolean;
  write_enabled: boolean;
};

// ── Employee ──────────────────────────────────────────────────────────────────

export type EmployeeContextRegistryEmployee = {
  employee_key: EmployeeContextRegistryEmployeeKey;
  display_name: string;
  role_title: string;
  definition: string;
  status: EmployeeContextRegistryStatus;
  visibility: EmployeeContextRegistryVisibility;
  active_for_company: boolean;
  capabilities: EmployeeContextRegistryCapability[];
  functions: EmployeeContextRegistryFunction[];
  limits: EmployeeContextRegistryLimit[];
  validation_rules: EmployeeContextRegistryValidationRule[];
  technology_bindings: EmployeeContextRegistryTechnologyBinding[];
  context_sources: string[];
  cloneos_visible: boolean;
  clonevoice_visible: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

// ── Registry ──────────────────────────────────────────────────────────────────

export type EmployeeContextRegistry = {
  registry_version: string;
  source: EmployeeContextRegistrySource;
  company_id?: string;
  employees: EmployeeContextRegistryEmployee[];
  global_limits: EmployeeContextRegistryLimit[];
  global_validation_rules: EmployeeContextRegistryValidationRule[];
  technologies: EmployeeContextRegistryTechnologyBinding[];
  generated_at: string;
  read_only: true;
  execution_enabled: false;
};

// ── Snapshot / résultats ──────────────────────────────────────────────────────

export type EmployeeContextRegistrySummary = {
  registry_version: string;
  source: EmployeeContextRegistrySource;
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
  read_only: true;
  generated_at: string;
};

export type EmployeeContextRegistryCard = {
  id: string;
  label: string;
  value: string | number;
  sub_label?: string;
  tone: "success" | "warning" | "neutral" | "violet";
};

export type EmployeeContextRegistryRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type EmployeeContextRegistryAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
  description?: string;
};

export type EmployeeContextRegistrySnapshot = {
  registry: EmployeeContextRegistry;
  summary: EmployeeContextRegistrySummary;
  cards: EmployeeContextRegistryCard[];
  recommendations: EmployeeContextRegistryRecommendation[];
  actions: EmployeeContextRegistryAction[];
  read_only: true;
};

export type EmployeeContextRegistryReadResult = {
  registry: EmployeeContextRegistry;
  summary: EmployeeContextRegistrySummary;
  has_active_employee: boolean;
  source: EmployeeContextRegistrySource;
};

export type EmployeeContextRegistryIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};
