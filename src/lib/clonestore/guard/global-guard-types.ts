// TECH-06 — CloneGuard + ClonePolicy Global Rules — Types
// Couche globale de gouvernance CloneStore. Pure types.
// No async, no Supabase, no Next.js, no side effects.
//
// Architecture :
//   Request / Task / Action
//   → Employee Runtime Contract
//   → GlobalEnterpriseMemory / CloneADN context
//   → ClonePolicy rule evaluation       (global-policy-evaluator)
//   → CloneGuard risk decision          (global-guard-evaluator)
//   → CloneTrust autonomy hint          (TECH-07+)
//   → CloneTrace event                  (TECH-07+)
//   → result: allow / prepare_only / require_validation / block / refuse
//
// IMPORTANT :
//   CloneGuard n'est PAS "le guard de Pierre".
//   CloneGuard est la couche globale de gouvernance de toute la plateforme.
//   ClonePolicy est interne à CloneGuard — pas une technologie client séparée.
//   Pierre est seulement le premier consommateur RH.

// ── Décisions ─────────────────────────────────────────────────────────────────

export type GlobalGuardDecision =
  | "allow"             // Action autorisée, peut s'exécuter
  | "prepare_only"      // Action préparée seulement, jamais exécutée automatiquement
  | "require_validation" // Validation humaine obligatoire avant exécution
  | "block"             // Action bloquée — règle système
  | "refuse";           // Action refusée — règle absolue (légal/éthique)

// ── Niveaux de risque ────────────────────────────────────────────────────────

export type GlobalGuardRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

// ── Types d'action ────────────────────────────────────────────────────────────

export type GlobalGuardActionType =
  | "read_context"          // Lire un contexte ou mémoire
  | "draft_document"        // Préparer un document (non officiel)
  | "draft_email"           // Préparer un email (non envoyé)
  | "send_email"            // Envoyer un email réel
  | "create_task"           // Créer une tâche
  | "update_memory"         // Mettre à jour la mémoire entreprise
  | "modify_record"         // Modifier un enregistrement
  | "export_data"           // Exporter des données
  | "legal_decision"        // Décision légale — JAMAIS autonome
  | "payroll_execution"     // Exécution paie officielle — JAMAIS autonome
  | "termination_decision"  // Décision licenciement — JAMAIS autonome
  | "contract_signature"    // Signature contrat — JAMAIS autonome
  | "external_api_call"     // Appel API externe
  | "delete_data"           // Suppression données — restreint
  | "custom";               // Action personnalisée

// ── Domaines métier ───────────────────────────────────────────────────────────

export type GlobalGuardDomain =
  | "hr"
  | "legal"
  | "finance"
  | "ops"
  | "support"
  | "sales"
  | "marketing"
  | "data"
  | "compliance"
  | "security"
  | "payroll"
  | "recruitment"
  | "onboarding"
  | "offboarding"
  | "contract"
  | "communication"
  | "custom"
  | "*";  // Wildcard — s'applique à tous les domaines

// ── Types de sujet ────────────────────────────────────────────────────────────

export type GlobalGuardSubjectType =
  | "employee_record"
  | "hr_document"
  | "payroll_data"
  | "contract"
  | "legal_file"
  | "company_memory"
  | "email"
  | "task"
  | "external_system"
  | "audit_log"
  | "custom";

// ── Modes d'exécution ─────────────────────────────────────────────────────────

export type GlobalGuardExecutionMode =
  | "suggest_only"     // Suggestion uniquement, jamais exécuté
  | "supervised"       // Exécution avec supervision humaine
  | "human_required"   // Validation humaine obligatoire avant tout
  | "blocked";         // Bloqué, ne peut pas s'exécuter

// ── Prérequis de validation ───────────────────────────────────────────────────

export type GlobalGuardValidationRequirement =
  | "none"              // Aucune validation requise
  | "trace_only"        // Traçage requis, pas de validation humaine
  | "supervisor_review" // Revue superviseur recommandée
  | "human_approval"    // Approbation humaine obligatoire
  | "admin_required"    // Admin/direction requis
  | "legal_review";     // Revue juridique requise

// ── Types de règle politique ──────────────────────────────────────────────────

export type GlobalGuardPolicyRuleType =
  | "hard_block"       // Règle absolue — jamais contournable
  | "soft_block"       // Règle bloquante — peut être levée par admin
  | "validation_gate"  // Porte de validation — humain requis
  | "trace_gate"       // Porte de traçage — trace obligatoire
  | "advisory"         // Avertissement — non bloquant
  | "allow_explicit";  // Permission explicite

// ── Sévérité des règles ───────────────────────────────────────────────────────

export type GlobalGuardPolicyRuleSeverity =
  | "info"
  | "warning"
  | "enforcement"
  | "critical"
  | "absolute";  // Jamais contournable, même par admin

// ── Effet d'une règle ─────────────────────────────────────────────────────────

export type GlobalGuardPolicyEffect =
  | "allow"
  | "allow_with_warning"
  | "prepare_only"
  | "require_validation"
  | "block"
  | "refuse";

// ── Conditions d'une règle ────────────────────────────────────────────────────

export interface GlobalGuardPolicyCondition {
  domains: string[];           // Domaines concernés (* = tous)
  action_types: string[];      // Types d'actions concernés (* = tous)
  risk_levels: string[];       // Niveaux de risque concernés (* = tous)
  employee_slugs: string[];    // Employés IA concernés (vide = tous)
  subject_types: string[];     // Types de sujet concernés (vide = tous)
  keywords: string[];          // Mots-clés déclencheurs (optionnel)
  requires_approval: boolean | null;  // État d'approbation requis (null = indifférent)
}

// ── Règle politique globale ───────────────────────────────────────────────────

export interface GlobalGuardPolicyRule {
  rule_id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: GlobalGuardPolicyRuleType;
  domains: string[];               // (* = tous)
  employee_slugs: string[];        // (vide = tous les employés IA)
  action_types: GlobalGuardActionType[];
  risk_levels: GlobalGuardRiskLevel[];
  conditions: GlobalGuardPolicyCondition[];
  effect: GlobalGuardPolicyEffect;
  severity: GlobalGuardPolicyRuleSeverity;
  requires_human_validation: boolean;
  blocks_execution: boolean;
  refusal_message: string | null;
  trace_required: boolean;
  validation_requirement: GlobalGuardValidationRequirement;
  source: "platform" | "company_policy" | "legal_compliance" | "system_default";
  created_at: string;
  updated_at: string;
}

// ── Contexte de la requête ────────────────────────────────────────────────────

export interface GlobalGuardRequestContext {
  request_id: string;
  company_id: string;
  employee_slug: string;
  action_type: GlobalGuardActionType;
  domain: GlobalGuardDomain;
  subject_type: GlobalGuardSubjectType;
  risk_level: GlobalGuardRiskLevel;
  payload_summary: string;
  human_validation_present: boolean;
  approval_required: boolean;
  timestamp: string;
}

// ── Contexte de l'employé IA ──────────────────────────────────────────────────

export interface GlobalGuardEmployeeContext {
  employee_slug: string;
  domain: string;
  status: string;              // active | beta | roadmap | disabled
  allowed_action_types: GlobalGuardActionType[];
  blocked_action_types: GlobalGuardActionType[];
  max_execution_mode: GlobalGuardExecutionMode;
  requires_supervision: boolean;
}

// ── Contexte entreprise ───────────────────────────────────────────────────────

export interface GlobalGuardEnterpriseContext {
  company_id: string;
  language: string;
  has_validation_circuits: boolean;
  domains_requiring_validation: string[];
  has_custom_policy_rules: boolean;
}

// ── Input d'évaluation ────────────────────────────────────────────────────────

export interface GlobalGuardEvaluationInput {
  request_id: string;
  company_id: string;
  employee_slug: string;
  domain: GlobalGuardDomain;
  action_type: GlobalGuardActionType;
  requested_execution_mode: GlobalGuardExecutionMode;
  risk_level: GlobalGuardRiskLevel;
  subject_type: GlobalGuardSubjectType;
  payload_summary: string;
  human_validation_present: boolean;
  enterprise_context_available: boolean;
  trace_context_available: boolean;
  metadata: Record<string, string | number | boolean | null>;
}

// ── Résultat d'évaluation ─────────────────────────────────────────────────────

export interface GlobalGuardEvaluationResult {
  decision: GlobalGuardDecision;
  risk_level: GlobalGuardRiskLevel;
  execution_mode: GlobalGuardExecutionMode;
  matched_rules: string[];
  required_validations: GlobalGuardValidationRequirement[];
  blocked_reasons: string[];
  refusal_message: string | null;
  trace_required: boolean;
  can_execute: boolean;
  can_prepare: boolean;
  human_validation_required: boolean;
  audit_notes: string[];
  evaluated_at: string;
}

// ── Résultat d'évaluation politique ──────────────────────────────────────────

export interface GlobalPolicyEvaluationResult {
  matched_rules: GlobalGuardPolicyRule[];
  dominant_effect: GlobalGuardPolicyEffect;
  has_hard_block: boolean;
  has_soft_block: boolean;
  has_validation_gate: boolean;
  requires_human_validation: boolean;
  trace_required: boolean;
  blocked_reasons: string[];
  refusal_message: string | null;
  audit_notes: string[];
  evaluated_at: string;
}

// ── Problème de validation ────────────────────────────────────────────────────

export interface GlobalGuardValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

// ── Rapport de validation ─────────────────────────────────────────────────────

export interface GlobalGuardValidationReport {
  ok: boolean;
  errors: GlobalGuardValidationIssue[];
  warnings: GlobalGuardValidationIssue[];
  rule_count: number;
  enabled_count: number;
  blocker_rule_count: number;
  validation_rule_count: number;
  trace_required_count: number;
  checked_at: string;
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

export interface GlobalGuardSnapshot {
  total_rules: number;
  enabled_rules: number;
  blocker_rules: number;
  validation_rules: number;
  trace_required_rules: number;
  covered_action_types: GlobalGuardActionType[];
  covered_domains: string[];
  coverage_score: number;
  critical_invariants_ok: boolean;
  generated_at: string;
}

// ── Helpers scalaires ────────────────────────────────────────────────────────

/** Rank numérique pour comparer deux décisions (plus haut = plus restrictif) */
export const GLOBAL_GUARD_DECISION_RANK: Record<GlobalGuardDecision, number> = {
  allow: 0,
  prepare_only: 1,
  require_validation: 2,
  block: 3,
  refuse: 4,
};

/** Rank numérique pour comparer deux effets */
export const GLOBAL_GUARD_EFFECT_RANK: Record<GlobalGuardPolicyEffect, number> = {
  allow: 0,
  allow_with_warning: 1,
  prepare_only: 2,
  require_validation: 3,
  block: 4,
  refuse: 5,
};

/** Rank numérique pour comparer deux niveaux de risque */
export const GLOBAL_GUARD_RISK_RANK: Record<GlobalGuardRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Actions qui ne peuvent JAMAIS être exécutées automatiquement par un employé IA.
 * Invariant absolu — jamais contournable.
 */
export const ABSOLUTE_BLOCKED_ACTION_TYPES: GlobalGuardActionType[] = [
  "legal_decision",
  "payroll_execution",
  "termination_decision",
  "contract_signature",
];

/**
 * Actions qui nécessitent toujours une validation humaine.
 */
export const ALWAYS_VALIDATION_REQUIRED_ACTIONS: GlobalGuardActionType[] = [
  "legal_decision",
  "payroll_execution",
  "termination_decision",
  "contract_signature",
  "delete_data",
  "export_data",
];
