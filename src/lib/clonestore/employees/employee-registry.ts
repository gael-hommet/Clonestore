// TECH-02 — Employee Registry
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Central registry of all CloneStore AI employees.
// Each employee declares its identity, capabilities, and technology plug-in
// via the EmployeeRuntimeContract.
//
// Currently registered employees:
//   - Pierre (HR) — active, V1 launch candidate
//
// Future employees (declared in comments only, NOT yet registered):
//   - Emma (Support)   — roadmap
//   - Lucas (Finance)  — roadmap
//   - Sophie (Legal)   — roadmap
//   - Adrien (Ops)     — concept
//   - Nolan (Sales)    — concept
//
// Rule: add to registry ONLY after Employee Runtime Contract is formally
// validated and domain pack is implemented. Do not add roadmap stubs.

import type {
  EmployeeRuntimeContract,
  EmployeeTechnologyRequirement,
} from "./employee-runtime-contract";
import type { TechnologySlug } from "../technologies/contracts";

// ── Pierre — HR AI Employee ───────────────────────────────────────────────────
//
// Pierre is CloneStore's first AI employee. He handles HR workflows:
// document preparation, employee file management, onboarding coordination,
// absence follow-up, pre-payroll preparation, and HR email drafting.
//
// What Pierre IS:
//   - A supervised HR operations assistant
//   - A document and workflow preparation engine
//   - An audit-traced, governed AI employee
//
// What Pierre IS NOT:
//   - A lawyer or legal advisor
//   - An official payroll system
//   - An autonomous decision-maker for sensitive HR cases
//   - A replacement for human HR judgment
//
// Pierre's technology stack:
//   CloneOS  → orchestrates his missions and tasks
//   CloneADN → reads enterprise memory, tone, and HR rules
//   CloneGuard → governs every action (includes ClonePolicy + CloneTrust pipelines)
//   CloneTrace → writes full audit trail of all HR actions
//   CloneContinuum → mission continuity between sessions (recommended)
//   CloneTrust → autonomy calibration within CloneGuard (integrated)
//   CloneReview → quality control of HR documents (partial, roadmap)
//   CloneBrief → HR activity briefings (future, readiness declared)

export const PIERRE_EMPLOYEE_RUNTIME_CONTRACT: EmployeeRuntimeContract = {
  // ── Identity ────────────────────────────────────────────────────────────────
  employee_id: "employee_pierre_hr_v1",
  slug: "pierre",
  display_name: "Pierre",
  short_name: "Pierre",
  domain: "hr",
  status: "active",
  launch_stage: "launch_candidate",
  description:
    "Employé IA RH opérationnel. Prépare les documents RH, gère les dossiers employés, "
    + "coordonne les onboardings et suit les absences — sous supervision humaine constante.",
  public_positioning:
    "Votre employé IA RH qui prépare les documents, suit les dossiers et gère les workflows "
    + "RH — chaque action validée par vous avant exécution.",
  internal_purpose:
    "Automatisation supervisée des tâches RH récurrentes : préparation de documents, "
    + "brouillons d'emails, gestion de dossiers. Validation humaine obligatoire sur les "
    + "actions sensibles. Pierre ne prend pas de décisions légales.",

  // ── Business capabilities (Pierre domain pack) ──────────────────────────────
  capabilities: [
    "employee_file",          // manage and update employee records
    "hr_documents",           // generate HR documents (contracts, amendments, etc.)
    "recruitment_ops",        // recruitment workflow support
    "onboarding",             // coordinate employee onboarding
    "absence_followup",       // track and follow up on absence cases
    "prepayroll_preparation", // prepare payroll data for human validation (NOT run payroll)
    "hr_email_drafts",        // draft HR emails for human review and send
    "hr_traceability",        // maintain audit trail of HR actions
  ],

  mission_types: [
    "contract_preparation",
    "amendment_preparation",
    "onboarding_coordination",
    "employee_record_management",
    "absence_case_management",
    "hr_document_generation",
    "hr_email_drafting",
    "recruitment_support",
    "offboarding_preparation",
    "hr_policy_query",
  ],

  task_types: [
    "draft_employment_contract",
    "draft_amendment_letter",
    "draft_termination_notice",
    "draft_disciplinary_letter",
    "generate_onboarding_checklist",
    "send_email_draft",
    "update_employee_file",
    "validate_employee_data",
    "prepare_payroll_data",
    "log_absence_event",
    "generate_absence_report",
    "prepare_offboarding_dossier",
    "query_hr_policy",
  ],

  artifact_types: [
    "contract_pdf",
    "amendment_letter_pdf",
    "termination_notice_pdf",
    "disciplinary_letter_pdf",
    "onboarding_checklist",
    "absence_report",
    "payroll_preparation_summary",
    "hr_email_draft",
    "employee_file_summary",
    "offboarding_dossier",
  ],

  channels: ["chat", "cockpit", "email"],

  // ── Technology plug-in ───────────────────────────────────────────────────────
  // Only valid TechnologySlug values are used here.
  // Note: ClonePolicy is not a standalone TechnologySlug — its functionality is
  // embedded in CloneGuard via guard_profile.policy_pipeline_enabled: true.

  required_technologies: [
    {
      slug: "cloneos" as TechnologySlug,
      required: true,
      rationale:
        "Core orchestration engine. CloneOS transforms HR requests into missions, "
        + "sequences tasks, manages dependencies and coordinates workflows. "
        + "Without CloneOS, Pierre cannot create or execute missions.",
      minimum_readiness: 60,
    },
    {
      slug: "cloneadn" as TechnologySlug,
      required: true,
      rationale:
        "Enterprise memory layer (Empreinte Entreprise B44). CloneADN provides tone, "
        + "communication style, HR rules, circuit de validation, and company context. "
        + "Without CloneADN, Pierre works without enterprise context — generic responses.",
      minimum_readiness: 50,
    },
    {
      slug: "cloneguard" as TechnologySlug,
      required: true,
      rationale:
        "Governance and risk gateway. Every Pierre action passes through CloneGuard "
        + "(CloneGuard → ClonePolicy → CloneTrust pipeline). Blocks sensitive actions, "
        + "routes to human validation on red/black risk. Without CloneGuard: no governance.",
      minimum_readiness: 60,
    },
    {
      slug: "clonetrace" as TechnologySlug,
      required: true,
      rationale:
        "Full audit trail of all HR actions. Logs missions, tasks, documents generated, "
        + "emails drafted, validations requested, actions blocked. Required for compliance "
        + "and credibility. Without CloneTrace: no proof of execution.",
      minimum_readiness: 60,
    },
    {
      slug: "clonecontinuum" as TechnologySlug,
      required: false,
      rationale:
        "Mission continuity between sessions. Handles resumption of stalled HR missions, "
        + "detects blocked states, manages planned relaunches. Recommended for full experience.",
      minimum_readiness: 40,
    },
    {
      slug: "clonetrust" as TechnologySlug,
      required: false,
      rationale:
        "Autonomy calibration for HR actions. Integrated in CloneGuard pipeline. "
        + "Determines how autonomous Pierre can be based on risk, history, and context. "
        + "Currently operated at 'supervised' level for all HR actions.",
      minimum_readiness: 40,
    },
    {
      slug: "clonereview" as TechnologySlug,
      required: false,
      rationale:
        "Quality control for HR documents before delivery. Reviews tone, coherence, "
        + "accuracy and compliance. Partial implementation — roadmap for full control.",
      minimum_readiness: 0,
    },
    {
      slug: "clonebrief" as TechnologySlug,
      required: false,
      rationale:
        "HR activity briefings — active missions, pending validations, blocked items, "
        + "actions taken. High perceived value, declared for future implementation.",
      minimum_readiness: 0,
    },
  ] as EmployeeTechnologyRequirement[],

  // ── Guard profile ────────────────────────────────────────────────────────────
  guard_profile: {
    risk_domains: [
      "recruitment_ops",
      "hiring",
      "contract",
      "amendment",
      "onboarding",
      "employee_file",
      "absence",
      "payroll_prep",
      "internal_communication",
      "hr_helpdesk",
      "performance_ops",
      "employee_relations",
      "compliance_workflow",
      "offboarding",
      "sensitive_case",
    ],
    blocks_on_black_risk: true,
    requires_human_approval_on_red: true,
    allows_autonomous_on_green: false, // conservative: HR always supervised
    policy_pipeline_enabled: true,     // ClonePolicy pipeline active within CloneGuard
    trust_pipeline_enabled: true,      // CloneTrust pipeline active within CloneGuard
  },

  // ── Policy pack ──────────────────────────────────────────────────────────────
  policy_pack: {
    pack_id: "pierre_hr_policy_v1",
    version: "1.0.0",
    domain: "hr",
    rules_count: 15, // hr-clonepolicy.ts approximate rule count
    custom_rules_allowed: false,
  },

  // ── Trust profile ────────────────────────────────────────────────────────────
  trust_profile: {
    base_autonomy_level: "supervised",
    max_autonomy_level: "semi_autonomous",
    trust_escalation_enabled: false, // V1: fixed at supervised
    human_override_always_available: true,
  },

  // ── Trace profile ─────────────────────────────────────────────────────────────
  trace_profile: {
    writes_to_global_trace: true,
    trace_event_types: [
      "mission_created",
      "task_executed",
      "document_generated",
      "email_drafted",
      "validation_requested",
      "action_blocked",
      "action_allowed",
      "mission_completed",
      "mission_resumed",
      "error_occurred",
    ],
    audit_level: "full",
    export_available: true,
  },

  // ── ADN usage profile ────────────────────────────────────────────────────────
  adn_usage_profile: {
    reads_enterprise_memory: true,
    reads_tone_preferences: true,
    reads_communication_rules: true,
    reads_validation_circuits: true,
    writes_to_adn: false, // V1: Pierre reads CloneADN, does not write to it
  },

  // ── Review profile ───────────────────────────────────────────────────────────
  review_profile: {
    enabled: true,
    review_before_send: true,
    review_before_document_generation: true,
    minimum_score: 70,
  },

  // ── Signals profile ──────────────────────────────────────────────────────────
  signals_profile: {
    enabled: false,
    signal_types: [],
    proactive_alerts: false,
  },

  // ── Brief profile ────────────────────────────────────────────────────────────
  brief_profile: {
    enabled: false, // TECH-09 — CloneBrief to implement
    morning_brief: false,
    evening_brief: false,
    mission_summary: false,
  },

  // ── Permissions ──────────────────────────────────────────────────────────────
  // Pierre is a supervised HR ASSISTANT. He prepares, drafts, and coordinates.
  // He does NOT make legal decisions, run official payroll, or terminate employees.
  permissions: {
    can_prepare_documents: true,
    can_send_email_draft: true,
    can_send_email_live: "governed",   // governed by CloneGuard approval
    can_read_employee_data: true,
    can_generate_pdf: true,
    can_make_legal_decision: false,              // ALWAYS FALSE — structural constraint
    can_run_payroll_officially: false,           // ALWAYS FALSE — structural constraint
    can_terminate_employee_autonomously: false,  // ALWAYS FALSE — structural constraint
    can_sign_contracts: false,                   // ALWAYS FALSE — structural constraint
    requires_human_validation_for: [
      "contract_signature",
      "official_termination",
      "legal_decision",
      "payroll_execution",
      "disciplinary_sanction",
      "sensitive_case_action",
      "external_communication_live",
    ],
  },

  // ── Unavailable reasons ──────────────────────────────────────────────────────
  unavailable_reasons: [],

  // ── Launch readiness ─────────────────────────────────────────────────────────
  launch_readiness: {
    product_runtime_ready: true,
    public_launch_ready: false, // controlled by Go-Live gate (GO-LIVE 01–10), NOT this contract
    demo_ready: true,
    onboarding_ready: true,
    internal_blockers: [],
    external_blockers: [
      "societe_non_immatriculee",    // Aurexia/CloneStore not registered
      "stripe_live_pending",         // Stripe live mode not activated
      "juriste_pending",             // Legal review pending
      "rls_production_pending",      // Supabase RLS production not deployed
      "e2e_live_pending",            // End-to-end live test not completed
    ],
  },

  // ── Metadata ─────────────────────────────────────────────────────────────────
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

// ── Employee Runtime Registry ─────────────────────────────────────────────────
// The single source of truth for all registered CloneStore AI employees.
// Only ACTIVE employees with a real implementation are registered here.
// Roadmap employees (Emma, Lucas, Sophie, Adrien, Nolan) are NOT registered yet.

export const EMPLOYEE_RUNTIME_REGISTRY: EmployeeRuntimeContract[] = [
  PIERRE_EMPLOYEE_RUNTIME_CONTRACT,
  // Future employees will be added here after TECH-02 contract is formally validated
  // and their domain packs are implemented.
  // Emma (Support) — roadmap — do not add until support pack is built
  // Lucas (Finance) — roadmap — do not add until finance pack is built
  // Sophie (Legal) — roadmap — do not add until legal pack is built
];

// ── Registry accessors ────────────────────────────────────────────────────────

export function getEmployeeRuntimeContract(slug: string): EmployeeRuntimeContract | null {
  if (!slug || slug.trim().length === 0) return null;
  return EMPLOYEE_RUNTIME_REGISTRY.find((e) => e.slug === slug.trim()) ?? null;
}

export function listEmployeeRuntimeContracts(): EmployeeRuntimeContract[] {
  return [...EMPLOYEE_RUNTIME_REGISTRY];
}

export function listLaunchReadyEmployees(): EmployeeRuntimeContract[] {
  return EMPLOYEE_RUNTIME_REGISTRY.filter(
    (e) => e.status === "active" && e.launch_readiness.product_runtime_ready,
  );
}

export function listEmployeesByDomain(domain: string): EmployeeRuntimeContract[] {
  if (!domain) return [];
  return EMPLOYEE_RUNTIME_REGISTRY.filter((e) => e.domain === domain);
}

export function listEmployeesByTechnology(technologySlug: TechnologySlug): EmployeeRuntimeContract[] {
  if (!technologySlug) return [];
  return EMPLOYEE_RUNTIME_REGISTRY.filter((e) =>
    e.required_technologies.some((t) => t.slug === technologySlug),
  );
}

export function isEmployeeLaunchReady(slug: string): boolean {
  const contract = getEmployeeRuntimeContract(slug);
  if (!contract) return false;
  return (
    contract.status === "active" &&
    contract.launch_readiness.product_runtime_ready &&
    contract.launch_readiness.internal_blockers.length === 0
  );
}

export function getEmployeeRequiredTechnologies(
  slug: string,
): EmployeeTechnologyRequirement[] {
  const contract = getEmployeeRuntimeContract(slug);
  if (!contract) return [];
  return [...contract.required_technologies];
}

export function getEmployeeHardRequiredTechnologies(
  slug: string,
): EmployeeTechnologyRequirement[] {
  return getEmployeeRequiredTechnologies(slug).filter((t) => t.required);
}
