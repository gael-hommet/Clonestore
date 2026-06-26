// TECH-06 — CloneGuard + ClonePolicy Global Rules — Default Policy Rules
// Règles politiques globales par défaut.
// Pure module: no async, no Supabase, no Next.js, no side effects.
//
// Ces règles sont globales — elles s'appliquent à TOUS les employés IA CloneStore.
// ClonePolicy est interne à CloneGuard. Ce n'est pas une technologie client séparée.

import type {
  GlobalGuardPolicyRule,
} from "./global-guard-types";

const NOW = "2026-01-01T00:00:00.000Z";  // Stable pour les tests

// ── Règle 1 : block_legal_decision_without_human ────────────────────────────
const RULE_BLOCK_LEGAL_DECISION: GlobalGuardPolicyRule = {
  rule_id: "policy_001_block_legal_decision",
  name: "Bloquer toute décision légale autonome",
  description:
    "Aucun employé IA ne peut prendre une décision légale de façon autonome. " +
    "Les décisions légales (licenciement, sanction disciplinaire, contrat, contentieux) " +
    "doivent toujours être validées par un humain habilité.",
  enabled: true,
  type: "hard_block",
  domains: ["*"],
  employee_slugs: [],  // s'applique à tous
  action_types: ["legal_decision"],
  risk_levels: ["low", "medium", "high", "critical"],
  conditions: [],
  effect: "refuse",
  severity: "absolute",
  requires_human_validation: true,
  blocks_execution: true,
  refusal_message:
    "Les décisions légales ne peuvent pas être prises de façon autonome par un employé IA. " +
    "Cette action requiert une validation humaine habilitée.",
  trace_required: true,
  validation_requirement: "legal_review",
  source: "legal_compliance",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 2 : block_payroll_official_execution ──────────────────────────────
const RULE_BLOCK_PAYROLL: GlobalGuardPolicyRule = {
  rule_id: "policy_002_block_payroll_execution",
  name: "Bloquer l'exécution de la paie officielle",
  description:
    "Aucun employé IA ne peut exécuter la paie officielle. " +
    "La préparation de la prépaie (résumé, données agrégées) est autorisée. " +
    "L'exécution réelle de la paie (DSN, virement salaires, bulletins officiels) est refusée.",
  enabled: true,
  type: "hard_block",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["payroll_execution"],
  risk_levels: ["low", "medium", "high", "critical"],
  conditions: [],
  effect: "refuse",
  severity: "absolute",
  requires_human_validation: true,
  blocks_execution: true,
  refusal_message:
    "L'exécution de la paie officielle n'est pas autorisée pour un employé IA. " +
    "Pierre peut préparer la prépaie. L'exécution réelle requiert un humain habilité.",
  trace_required: true,
  validation_requirement: "admin_required",
  source: "legal_compliance",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 3 : block_termination_decision ────────────────────────────────────
const RULE_BLOCK_TERMINATION: GlobalGuardPolicyRule = {
  rule_id: "policy_003_block_termination_decision",
  name: "Bloquer toute décision de licenciement autonome",
  description:
    "Aucun employé IA ne peut décider d'un licenciement de façon autonome. " +
    "La préparation de dossiers, la synthèse de situations, et les drafts de courriers " +
    "peuvent être préparés. La décision finale appartient toujours à un humain.",
  enabled: true,
  type: "hard_block",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["termination_decision"],
  risk_levels: ["low", "medium", "high", "critical"],
  conditions: [],
  effect: "refuse",
  severity: "absolute",
  requires_human_validation: true,
  blocks_execution: true,
  refusal_message:
    "Les décisions de licenciement sont refusées pour un employé IA. " +
    "La préparation du dossier peut être réalisée, mais la décision finale appartient à un humain.",
  trace_required: true,
  validation_requirement: "legal_review",
  source: "legal_compliance",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 4 : block_contract_signature ──────────────────────────────────────
const RULE_BLOCK_CONTRACT_SIGNATURE: GlobalGuardPolicyRule = {
  rule_id: "policy_004_block_contract_signature",
  name: "Bloquer toute signature de contrat par un employé IA",
  description:
    "Un employé IA ne peut jamais signer un contrat. " +
    "La préparation, la rédaction et la révision de drafts de contrats sont autorisées " +
    "en mode prepare_only. La signature reste un acte humain.",
  enabled: true,
  type: "hard_block",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["contract_signature"],
  risk_levels: ["low", "medium", "high", "critical"],
  conditions: [],
  effect: "refuse",
  severity: "absolute",
  requires_human_validation: true,
  blocks_execution: true,
  refusal_message:
    "Un employé IA ne peut pas signer de contrat. " +
    "La rédaction du draft est possible, mais la signature appartient toujours à un humain.",
  trace_required: true,
  validation_requirement: "legal_review",
  source: "legal_compliance",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 5 : require_validation_for_external_email ─────────────────────────
const RULE_VALIDATE_EMAIL: GlobalGuardPolicyRule = {
  rule_id: "policy_005_require_validation_send_email",
  name: "Validation humaine pour tout envoi d'email externe",
  description:
    "L'envoi d'emails externes (hors communication interne de bas risque) " +
    "requiert une validation humaine pour les risques medium, high et critical. " +
    "Les emails low-risk en mode interne peuvent être préparés sans validation.",
  enabled: true,
  type: "validation_gate",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["send_email"],
  risk_levels: ["medium", "high", "critical"],
  conditions: [],
  effect: "require_validation",
  severity: "critical",
  requires_human_validation: true,
  blocks_execution: true,
  refusal_message: null,
  trace_required: true,
  validation_requirement: "human_approval",
  source: "platform",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 6 : require_validation_for_memory_update ──────────────────────────
const RULE_VALIDATE_MEMORY_UPDATE: GlobalGuardPolicyRule = {
  rule_id: "policy_006_require_validation_update_memory",
  name: "Validation requise pour mise à jour mémoire entreprise",
  description:
    "La mise à jour de la mémoire entreprise (GlobalEnterpriseMemory) " +
    "requiert une validation humaine en V1. " +
    "Cohérent avec TECH-05 : writable_categories = [] pour tous les employés IA en V1. " +
    "CloneLearn activera les écritures autonomes contrôlées plus tard.",
  enabled: true,
  type: "validation_gate",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["update_memory"],
  risk_levels: ["low", "medium", "high", "critical"],
  conditions: [],
  effect: "require_validation",
  severity: "enforcement",
  requires_human_validation: true,
  blocks_execution: true,
  refusal_message: null,
  trace_required: true,
  validation_requirement: "supervisor_review",
  source: "platform",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 7 : require_trace_for_all_actions ──────────────────────────────────
const RULE_REQUIRE_TRACE: GlobalGuardPolicyRule = {
  rule_id: "policy_007_require_trace_all_actions",
  name: "Traçage obligatoire pour toutes les actions",
  description:
    "Toutes les actions des employés IA doivent être tracées dans CloneTrace. " +
    "Aucune action ne peut être exécutée sans trace. " +
    "Ce prérequis ne peut pas être supprimé.",
  enabled: true,
  type: "trace_gate",
  domains: ["*"],
  employee_slugs: [],
  action_types: [
    "read_context", "draft_document", "draft_email", "send_email",
    "create_task", "update_memory", "modify_record", "export_data",
    "legal_decision", "payroll_execution", "termination_decision",
    "contract_signature", "external_api_call", "delete_data", "custom",
  ],
  risk_levels: ["low", "medium", "high", "critical"],
  conditions: [],
  effect: "allow_with_warning",
  severity: "enforcement",
  requires_human_validation: false,
  blocks_execution: false,
  refusal_message: null,
  trace_required: true,
  validation_requirement: "trace_only",
  source: "platform",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 8 : prepare_only_for_sensitive_documents ──────────────────────────
const RULE_PREPARE_ONLY_SENSITIVE_DOCS: GlobalGuardPolicyRule = {
  rule_id: "policy_008_prepare_only_sensitive_documents",
  name: "Documents sensibles en prepare_only ou validation",
  description:
    "La génération de documents sensibles (haut risque ou critique) " +
    "ne peut jamais être automatiquement envoyée ou publiée. " +
    "Le document est préparé (draft), jamais distribué automatiquement.",
  enabled: true,
  type: "soft_block",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["draft_document"],
  risk_levels: ["high", "critical"],
  conditions: [],
  effect: "prepare_only",
  severity: "critical",
  requires_human_validation: true,
  blocks_execution: false,
  refusal_message: null,
  trace_required: true,
  validation_requirement: "supervisor_review",
  source: "platform",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 9 : block_delete_data_without_admin ────────────────────────────────
const RULE_BLOCK_DELETE_DATA: GlobalGuardPolicyRule = {
  rule_id: "policy_009_block_delete_data",
  name: "Suppression de données bloquée sans validation admin",
  description:
    "La suppression de données est bloquée pour tout employé IA " +
    "sans validation admin ou humaine explicite. " +
    "Aucune suppression automatique de trace n'est permise.",
  enabled: true,
  type: "hard_block",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["delete_data"],
  risk_levels: ["low", "medium", "high", "critical"],
  conditions: [],
  effect: "block",
  severity: "critical",
  requires_human_validation: true,
  blocks_execution: true,
  refusal_message:
    "La suppression de données requiert une validation admin/humain explicite. " +
    "Les traces d'audit ne peuvent jamais être supprimées par un employé IA.",
  trace_required: true,
  validation_requirement: "admin_required",
  source: "platform",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 10 : require_validation_for_external_api_call ─────────────────────
const RULE_VALIDATE_EXTERNAL_API: GlobalGuardPolicyRule = {
  rule_id: "policy_010_require_validation_external_api",
  name: "Validation pour appels API externes",
  description:
    "Les appels vers des API externes (systèmes tiers, intégrations, webhooks) " +
    "requièrent une validation humaine ou supervision, " +
    "sauf pour des intégrations explicitement autorisées par le client.",
  enabled: true,
  type: "validation_gate",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["external_api_call"],
  risk_levels: ["low", "medium", "high", "critical"],
  conditions: [],
  effect: "require_validation",
  severity: "enforcement",
  requires_human_validation: true,
  blocks_execution: true,
  refusal_message: null,
  trace_required: true,
  validation_requirement: "supervisor_review",
  source: "platform",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 11 : allow_low_risk_read_context ───────────────────────────────────
const RULE_ALLOW_READ_CONTEXT: GlobalGuardPolicyRule = {
  rule_id: "policy_011_allow_low_risk_read_context",
  name: "Autoriser la lecture de contexte bas risque",
  description:
    "La lecture de contexte (mémoire entreprise, configuration, profil employé) " +
    "est autorisée pour les actions de risque faible, " +
    "sous réserve que le profil d'accès de l'employé IA le permette.",
  enabled: true,
  type: "allow_explicit",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["read_context"],
  risk_levels: ["low"],
  conditions: [],
  effect: "allow",
  severity: "info",
  requires_human_validation: false,
  blocks_execution: false,
  refusal_message: null,
  trace_required: true,
  validation_requirement: "trace_only",
  source: "platform",
  created_at: NOW,
  updated_at: NOW,
};

// ── Règle 12 : allow_task_creation_supervised ────────────────────────────────
const RULE_ALLOW_TASK_CREATION: GlobalGuardPolicyRule = {
  rule_id: "policy_012_allow_task_creation_supervised",
  name: "Création de tâches autorisée en mode supervisé",
  description:
    "La création de tâches (missions, actions) est autorisée pour les risques low et medium " +
    "en mode supervisé. Les tâches à risque high/critical requièrent validation humaine.",
  enabled: true,
  type: "allow_explicit",
  domains: ["*"],
  employee_slugs: [],
  action_types: ["create_task"],
  risk_levels: ["low", "medium"],
  conditions: [],
  effect: "allow",
  severity: "info",
  requires_human_validation: false,
  blocks_execution: false,
  refusal_message: null,
  trace_required: true,
  validation_requirement: "trace_only",
  source: "platform",
  created_at: NOW,
  updated_at: NOW,
};

// ── Registre des règles par défaut ────────────────────────────────────────────

/**
 * Règles politiques globales par défaut de CloneGuard.
 * Ces règles sont globales — elles s'appliquent à TOUS les employés IA CloneStore.
 * Les règles absolues (severity="absolute") ne peuvent jamais être contournées.
 */
export const DEFAULT_GLOBAL_POLICY_RULES: GlobalGuardPolicyRule[] = [
  RULE_BLOCK_LEGAL_DECISION,
  RULE_BLOCK_PAYROLL,
  RULE_BLOCK_TERMINATION,
  RULE_BLOCK_CONTRACT_SIGNATURE,
  RULE_VALIDATE_EMAIL,
  RULE_VALIDATE_MEMORY_UPDATE,
  RULE_REQUIRE_TRACE,
  RULE_PREPARE_ONLY_SENSITIVE_DOCS,
  RULE_BLOCK_DELETE_DATA,
  RULE_VALIDATE_EXTERNAL_API,
  RULE_ALLOW_READ_CONTEXT,
  RULE_ALLOW_TASK_CREATION,
];

/**
 * Vérifie que les invariants absolus sont présents dans une liste de règles.
 * Retourne true si les 4 invariants critiques sont couverts.
 */
export function areAbsoluteInvariantsPresent(rules: GlobalGuardPolicyRule[]): boolean {
  const enabledBlockers = rules.filter(
    (r) =>
      r.enabled &&
      (r.effect === "block" || r.effect === "refuse") &&
      r.blocks_execution,
  );

  const haslegalDecisionBlock = enabledBlockers.some((r) =>
    r.action_types.includes("legal_decision"),
  );
  const hasPayrollBlock = enabledBlockers.some((r) =>
    r.action_types.includes("payroll_execution"),
  );
  const hasTerminationBlock = enabledBlockers.some((r) =>
    r.action_types.includes("termination_decision"),
  );
  const hasContractBlock = enabledBlockers.some((r) =>
    r.action_types.includes("contract_signature"),
  );

  return (
    haslegalDecisionBlock &&
    hasPayrollBlock &&
    hasTerminationBlock &&
    hasContractBlock
  );
}
