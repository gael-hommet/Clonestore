// TECH-03 — Global Technology Config Defaults
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// DEFAULT_GLOBAL_TECH_CONFIGS: one entry per technology.
// Scores sourced from TECH-01 real audit.
// All configs reflect current reality — no wishful thinking.

import type {
  GlobalTechnologyConfig,
  GlobalTechnologyKey,
} from "./global-tech-config";

// ── Timestamps ────────────────────────────────────────────────────────────────

const CREATED_AT = "2026-06-01T00:00:00.000Z";
const UPDATED_AT = "2026-06-01T00:00:00.000Z";

// ── Default configs ───────────────────────────────────────────────────────────

const CLONEOS_DEFAULT: GlobalTechnologyConfig = {
  key: "cloneos",
  display_name: "CloneOS",
  short_description: "Mission and task orchestration engine — the central nervous system of every AI employee.",
  category: "core",
  visibility: "public",
  status: "active",
  mode: "supervised",
  runtime_status: "partial",
  control_level: "platform_locked",
  risk_mode: "balanced",
  autonomy_level: "supervised",
  configurable_by_customer: false,
  locked_by_platform: true,
  visible_to_customer: true,
  required_for_public_launch: true,
  required_for_employee_runtime: true,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {},
  guardrails: {
    requires_human_validation: true,
    blocks_autonomous_actions: false,
    requires_audit_trail: true,
    requires_paid_access: false,
    no_live_production_without_approval: true,
    max_autonomy_allowed: "semi_autonomous",
  },
  dependencies: [],
  conflicts: [],
  readiness_score: 85,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONEADN_DEFAULT: GlobalTechnologyConfig = {
  key: "cloneadn",
  display_name: "CloneADN",
  short_description: "Enterprise memory layer — living knowledge base that gives context to every AI action.",
  category: "memory",
  visibility: "public",
  status: "active",
  mode: "supervised",
  runtime_status: "partial",
  control_level: "company_configurable",
  risk_mode: "balanced",
  autonomy_level: "supervised",
  configurable_by_customer: true,
  locked_by_platform: false,
  visible_to_customer: true,
  required_for_public_launch: true,
  required_for_employee_runtime: true,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {
    memory_depth: "full",
    empreinte_b44_enabled: true,
  },
  guardrails: {
    requires_human_validation: false,
    blocks_autonomous_actions: false,
    requires_audit_trail: true,
    requires_paid_access: false,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "semi_autonomous",
  },
  dependencies: ["cloneos"],
  conflicts: [],
  readiness_score: 80,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONEGUARD_DEFAULT: GlobalTechnologyConfig = {
  key: "cloneguard",
  display_name: "CloneGuard",
  short_description: "Governance and risk validation engine — every AI action passes through CloneGuard before execution.",
  category: "governance",
  visibility: "public",
  status: "active",
  mode: "supervised",
  runtime_status: "partial",
  control_level: "platform_locked",
  risk_mode: "conservative",
  autonomy_level: "supervised",
  configurable_by_customer: false,
  locked_by_platform: true,
  visible_to_customer: true,
  required_for_public_launch: true,
  required_for_employee_runtime: true,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {
    policy_pipeline_enabled: true,
    trust_pipeline_enabled: true,
  },
  guardrails: {
    requires_human_validation: true,
    blocks_autonomous_actions: true,
    requires_audit_trail: true,
    requires_paid_access: false,
    no_live_production_without_approval: true,
    max_autonomy_allowed: "supervised",
  },
  dependencies: ["cloneos", "clonepolicy", "clonetrust"],
  conflicts: [],
  readiness_score: 85,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONETRACE_DEFAULT: GlobalTechnologyConfig = {
  key: "clonetrace",
  display_name: "CloneTrace",
  short_description: "Immutable audit trail — every AI action, decision, and output is traceable and auditable.",
  category: "traceability",
  visibility: "public",
  status: "active",
  mode: "supervised",
  runtime_status: "partial",
  control_level: "platform_locked",
  risk_mode: "conservative",
  autonomy_level: "none",
  configurable_by_customer: false,
  locked_by_platform: true,
  visible_to_customer: true,
  required_for_public_launch: true,
  required_for_employee_runtime: true,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {
    retention_days: 365,
    include_payload: true,
    gdpr_mode: false,
  },
  guardrails: {
    requires_human_validation: false,
    blocks_autonomous_actions: false,
    requires_audit_trail: false, // CloneTrace IS the audit trail
    requires_paid_access: false,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "none",
  },
  dependencies: ["cloneos"],
  conflicts: [],
  readiness_score: 80,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONEVOICE_DEFAULT: GlobalTechnologyConfig = {
  key: "clonevoice",
  display_name: "CloneVoice",
  short_description: "Voice interface layer — spoken interaction with AI employees via voice input/output.",
  category: "interface",
  visibility: "customer_only",
  status: "partial",
  mode: "disabled",
  runtime_status: "not_implemented",
  control_level: "company_configurable",
  risk_mode: "disabled",
  autonomy_level: "none",
  configurable_by_customer: false,
  locked_by_platform: false,
  visible_to_customer: true,
  required_for_public_launch: false,
  required_for_employee_runtime: false,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {},
  guardrails: {
    requires_human_validation: false,
    blocks_autonomous_actions: false,
    requires_audit_trail: false,
    requires_paid_access: true,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "none",
  },
  dependencies: ["cloneos"],
  conflicts: [],
  readiness_score: 15,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONECHAT_DEFAULT: GlobalTechnologyConfig = {
  key: "clonechat",
  display_name: "CloneChat",
  short_description: "Conversational interface — chat-based interaction with AI employees.",
  category: "interface",
  visibility: "public",
  status: "partial",
  mode: "supervised",
  runtime_status: "partial",
  control_level: "company_configurable",
  risk_mode: "balanced",
  autonomy_level: "suggest_only",
  configurable_by_customer: true,
  locked_by_platform: false,
  visible_to_customer: true,
  required_for_public_launch: false,
  required_for_employee_runtime: false,
  supports_employee_overrides: true,
  employee_overrides: [],
  settings: {
    thread_enabled: true,
    file_upload_enabled: false,
  },
  guardrails: {
    requires_human_validation: false,
    blocks_autonomous_actions: false,
    requires_audit_trail: true,
    requires_paid_access: false,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "suggest_only",
  },
  dependencies: ["cloneos", "cloneadn"],
  conflicts: [],
  readiness_score: 50,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONEPOLICY_DEFAULT: GlobalTechnologyConfig = {
  key: "clonepolicy",
  display_name: "ClonePolicy",
  short_description: "Executable policy engine — runs inside CloneGuard's governance pipeline to evaluate rules and decisions.",
  category: "governance",
  visibility: "internal",
  status: "active",
  mode: "production",
  runtime_status: "operational",
  control_level: "internal_only",
  risk_mode: "conservative",
  autonomy_level: "none",
  configurable_by_customer: false,
  locked_by_platform: true,
  visible_to_customer: false,
  required_for_public_launch: false,
  required_for_employee_runtime: false, // Embedded in CloneGuard pipeline
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {
    pipeline_stage: "cloneguard_internal",
    evaluation_mode: "strict",
  },
  guardrails: {
    requires_human_validation: false,
    blocks_autonomous_actions: false,
    requires_audit_trail: true,
    requires_paid_access: false,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "none",
  },
  dependencies: ["cloneguard"],
  conflicts: [],
  readiness_score: 85,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONECONTINUUM_DEFAULT: GlobalTechnologyConfig = {
  key: "clonecontinuum",
  display_name: "CloneContinuum",
  short_description: "Session continuity — maintains context and mission state across multiple interactions.",
  category: "automation",
  visibility: "customer_only",
  status: "partial",
  mode: "supervised",
  runtime_status: "partial",
  control_level: "company_configurable",
  risk_mode: "balanced",
  autonomy_level: "suggest_only",
  configurable_by_customer: true,
  locked_by_platform: false,
  visible_to_customer: true,
  required_for_public_launch: false,
  required_for_employee_runtime: false,
  supports_employee_overrides: true,
  employee_overrides: [],
  settings: {
    session_timeout_hours: 24,
    resume_on_reconnect: true,
  },
  guardrails: {
    requires_human_validation: false,
    blocks_autonomous_actions: false,
    requires_audit_trail: true,
    requires_paid_access: false,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "supervised",
  },
  dependencies: ["cloneos", "cloneadn"],
  conflicts: [],
  readiness_score: 65,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONETRUST_DEFAULT: GlobalTechnologyConfig = {
  key: "clonetrust",
  display_name: "CloneTrust",
  short_description: "Gradual autonomy calibration — CloneTrust progressively extends AI autonomy as trust is earned through demonstrated behavior.",
  category: "governance",
  visibility: "customer_only",
  status: "partial",
  mode: "supervised",
  runtime_status: "partial",
  control_level: "company_configurable",
  risk_mode: "conservative",
  autonomy_level: "supervised",
  configurable_by_customer: true,
  locked_by_platform: false,
  visible_to_customer: true,
  required_for_public_launch: false,
  required_for_employee_runtime: false,
  supports_employee_overrides: true,
  employee_overrides: [],
  settings: {
    trust_model: "gradual_autonomy", // progressive trust calibration — autonomie graduelle
    baseline_autonomy: "supervised",
    escalation_threshold: 0.8,
  },
  guardrails: {
    requires_human_validation: true,
    blocks_autonomous_actions: false,
    requires_audit_trail: true,
    requires_paid_access: false,
    no_live_production_without_approval: true,
    max_autonomy_allowed: "semi_autonomous",
  },
  dependencies: ["cloneguard", "clonetrace"],
  conflicts: [],
  readiness_score: 60,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONEREVIEW_DEFAULT: GlobalTechnologyConfig = {
  key: "clonereview",
  display_name: "CloneReview",
  short_description: "Quality control gate — validates AI-generated deliverables before they leave the system.",
  category: "quality",
  visibility: "customer_only",
  status: "roadmap",
  mode: "roadmap",
  runtime_status: "not_implemented",
  control_level: "company_configurable",
  risk_mode: "conservative",
  autonomy_level: "none",
  configurable_by_customer: false,
  locked_by_platform: false,
  visible_to_customer: false,
  required_for_public_launch: false,
  required_for_employee_runtime: false,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {},
  guardrails: {
    requires_human_validation: true,
    blocks_autonomous_actions: false,
    requires_audit_trail: false,
    requires_paid_access: false,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "none",
  },
  dependencies: ["cloneguard", "clonetrace"],
  conflicts: [],
  readiness_score: 10,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONESIGNALS_DEFAULT: GlobalTechnologyConfig = {
  key: "clonesignals",
  display_name: "CloneSignals",
  short_description: "Triggers and alerts engine — monitors conditions and fires automated responses when thresholds are crossed.",
  category: "automation",
  visibility: "customer_only",
  status: "roadmap",
  mode: "roadmap",
  runtime_status: "not_implemented",
  control_level: "company_configurable",
  risk_mode: "disabled",
  autonomy_level: "none",
  configurable_by_customer: false,
  locked_by_platform: false,
  visible_to_customer: false,
  required_for_public_launch: false,
  required_for_employee_runtime: false,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {},
  guardrails: {
    requires_human_validation: false,
    blocks_autonomous_actions: false,
    requires_audit_trail: false,
    requires_paid_access: false,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "none",
  },
  dependencies: ["cloneos"],
  conflicts: [],
  readiness_score: 5,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONELEARN_DEFAULT: GlobalTechnologyConfig = {
  key: "clonelearn",
  display_name: "CloneLearn",
  short_description: "Governed learning engine — AI employees improve over time within strict governance boundaries.",
  category: "learning",
  visibility: "internal",
  status: "roadmap",
  mode: "roadmap",
  runtime_status: "not_implemented",
  control_level: "platform_locked",
  risk_mode: "disabled",
  autonomy_level: "none",
  configurable_by_customer: false,
  locked_by_platform: true,
  visible_to_customer: false,
  required_for_public_launch: false,
  required_for_employee_runtime: false,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {},
  guardrails: {
    requires_human_validation: true,
    blocks_autonomous_actions: true,
    requires_audit_trail: true,
    requires_paid_access: false,
    no_live_production_without_approval: true,
    max_autonomy_allowed: "none",
  },
  dependencies: ["cloneguard", "clonetrace", "cloneadn"],
  conflicts: [],
  readiness_score: 5,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const CLONEBRIEF_DEFAULT: GlobalTechnologyConfig = {
  key: "clonebrief",
  display_name: "CloneBrief",
  short_description: "Executive briefing engine — generates structured summaries and status reports for leadership.",
  category: "executive",
  visibility: "customer_only",
  status: "roadmap",
  mode: "roadmap",
  runtime_status: "not_implemented",
  control_level: "company_configurable",
  risk_mode: "disabled",
  autonomy_level: "none",
  configurable_by_customer: false,
  locked_by_platform: false,
  visible_to_customer: false,
  required_for_public_launch: false,
  required_for_employee_runtime: false,
  supports_employee_overrides: false,
  employee_overrides: [],
  settings: {
    frequency: "weekly",
    format: "structured_markdown",
  },
  guardrails: {
    requires_human_validation: false,
    blocks_autonomous_actions: false,
    requires_audit_trail: false,
    requires_paid_access: true,
    no_live_production_without_approval: false,
    max_autonomy_allowed: "none",
  },
  dependencies: ["cloneos", "cloneadn"],
  conflicts: [],
  readiness_score: 5,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const DEFAULT_GLOBAL_TECH_CONFIGS: Record<GlobalTechnologyKey, GlobalTechnologyConfig> = {
  cloneos:      CLONEOS_DEFAULT,
  cloneadn:     CLONEADN_DEFAULT,
  cloneguard:   CLONEGUARD_DEFAULT,
  clonetrace:   CLONETRACE_DEFAULT,
  clonevoice:   CLONEVOICE_DEFAULT,
  clonechat:    CLONECHAT_DEFAULT,
  clonepolicy:  CLONEPOLICY_DEFAULT,
  clonecontinuum: CLONECONTINUUM_DEFAULT,
  clonetrust:   CLONETRUST_DEFAULT,
  clonereview:  CLONEREVIEW_DEFAULT,
  clonesignals: CLONESIGNALS_DEFAULT,
  clonelearn:   CLONELEARN_DEFAULT,
  clonebrief:   CLONEBRIEF_DEFAULT,
};

export const DEFAULT_GLOBAL_TECH_CONFIG_LIST: GlobalTechnologyConfig[] =
  Object.values(DEFAULT_GLOBAL_TECH_CONFIGS);

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getDefaultGlobalTechConfig(
  key: GlobalTechnologyKey,
): GlobalTechnologyConfig {
  return DEFAULT_GLOBAL_TECH_CONFIGS[key];
}

export function getActiveDefaultConfigs(): GlobalTechnologyConfig[] {
  return DEFAULT_GLOBAL_TECH_CONFIG_LIST.filter((c) => c.status === "active");
}

export function getPartialDefaultConfigs(): GlobalTechnologyConfig[] {
  return DEFAULT_GLOBAL_TECH_CONFIG_LIST.filter((c) => c.status === "partial");
}

export function getRoadmapDefaultConfigs(): GlobalTechnologyConfig[] {
  return DEFAULT_GLOBAL_TECH_CONFIG_LIST.filter((c) => c.status === "roadmap");
}

export function getEmployeeRuntimeRequiredDefaultConfigs(): GlobalTechnologyConfig[] {
  return DEFAULT_GLOBAL_TECH_CONFIG_LIST.filter((c) => c.required_for_employee_runtime);
}

export function getPlatformLockedDefaultConfigs(): GlobalTechnologyConfig[] {
  return DEFAULT_GLOBAL_TECH_CONFIG_LIST.filter((c) => c.locked_by_platform);
}

export function getCustomerVisibleDefaultConfigs(): GlobalTechnologyConfig[] {
  return DEFAULT_GLOBAL_TECH_CONFIG_LIST.filter((c) => c.visible_to_customer);
}

export function getDefaultReadinessScore(key: GlobalTechnologyKey): number {
  return DEFAULT_GLOBAL_TECH_CONFIGS[key].readiness_score;
}

export function getAverageDefaultReadinessScore(): number {
  const scores = DEFAULT_GLOBAL_TECH_CONFIG_LIST.map((c) => c.readiness_score);
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}
