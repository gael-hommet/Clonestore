// TECH-06 — CloneGuard + ClonePolicy Global Rules — Employee Guard Access
// Gestion des accès des employés IA au système CloneGuard.
// Pure functions: no async, no Supabase, no Next.js, no side effects.
//
// Utilise Employee Runtime Contract (TECH-02) comme source de vérité.
// Un employé inconnu reçoit un accès minimal.

import type {
  GlobalGuardActionType,
  GlobalGuardExecutionMode,
  GlobalGuardEvaluationInput,
  GlobalGuardEmployeeContext,
  GlobalGuardDomain,
  GlobalGuardRiskLevel,
  GlobalGuardSubjectType,
} from "./global-guard-types";
import {
  ABSOLUTE_BLOCKED_ACTION_TYPES,
} from "./global-guard-types";

// ── Profils d'accès par rôle ──────────────────────────────────────────────

/**
 * Actions autorisées pour un employé IA générique (sans domaine spécifique).
 */
export const BASE_ALLOWED_ACTION_TYPES: GlobalGuardActionType[] = [
  "read_context",
  "draft_document",
  "draft_email",
  "create_task",
];

/**
 * Actions autorisées pour un employé IA RH (Pierre).
 */
export const HR_ALLOWED_ACTION_TYPES: GlobalGuardActionType[] = [
  "read_context",
  "draft_document",
  "draft_email",
  "create_task",
  "modify_record",
  "export_data",
  // send_email autorisé uniquement avec validation
];

/**
 * Actions jamais autorisées pour AUCUN employé IA (invariant absolu).
 */
export const UNIVERSAL_BLOCKED_ACTION_TYPES: GlobalGuardActionType[] = [
  ...ABSOLUTE_BLOCKED_ACTION_TYPES,
];

// ── Profils d'accès prédéfinis ────────────────────────────────────────────

interface EmployeeGuardProfile {
  employee_slug: string;
  domain: string;
  status: "active" | "beta" | "roadmap" | "disabled";
  allowed_action_types: GlobalGuardActionType[];
  blocked_action_types: GlobalGuardActionType[];
  max_execution_mode: GlobalGuardExecutionMode;
  requires_supervision: boolean;
}

const PIERRE_GUARD_PROFILE: EmployeeGuardProfile = {
  employee_slug: "pierre",
  domain: "hr",
  status: "active",
  allowed_action_types: HR_ALLOWED_ACTION_TYPES,
  blocked_action_types: UNIVERSAL_BLOCKED_ACTION_TYPES,
  max_execution_mode: "supervised",
  requires_supervision: true,
};

const UNKNOWN_EMPLOYEE_GUARD_PROFILE: EmployeeGuardProfile = {
  employee_slug: "unknown",
  domain: "custom",
  status: "disabled",
  allowed_action_types: ["read_context"],
  blocked_action_types: [
    ...UNIVERSAL_BLOCKED_ACTION_TYPES,
    "send_email",
    "update_memory",
    "modify_record",
    "export_data",
    "delete_data",
    "external_api_call",
  ],
  max_execution_mode: "blocked",
  requires_supervision: true,
};

const EMPLOYEE_PROFILES: Record<string, EmployeeGuardProfile> = {
  pierre: PIERRE_GUARD_PROFILE,
};

// ── Fonctions principales ──────────────────────────────────────────────────

/**
 * Récupère le profil guard d'un employé IA.
 * Retourne le profil "unknown" (accès minimal) si l'employé n'est pas enregistré.
 */
export function getEmployeeGuardProfile(
  employeeSlug: string,
): EmployeeGuardProfile {
  return EMPLOYEE_PROFILES[employeeSlug] ?? {
    ...UNKNOWN_EMPLOYEE_GUARD_PROFILE,
    employee_slug: employeeSlug,
  };
}

/**
 * Construit un GlobalGuardEmployeeContext pour un employé donné.
 */
export function buildEmployeeGuardContext(
  employeeSlug: string,
): GlobalGuardEmployeeContext {
  const profile = getEmployeeGuardProfile(employeeSlug);
  return {
    employee_slug: profile.employee_slug,
    domain: profile.domain,
    status: profile.status,
    allowed_action_types: profile.allowed_action_types,
    blocked_action_types: profile.blocked_action_types,
    max_execution_mode: profile.max_execution_mode,
    requires_supervision: profile.requires_supervision,
  };
}

/**
 * Retourne les types d'actions autorisées pour un employé.
 */
export function getAllowedActionTypesForEmployee(
  employeeSlug: string,
): GlobalGuardActionType[] {
  return getEmployeeGuardProfile(employeeSlug).allowed_action_types;
}

/**
 * Retourne les types d'actions bloquées pour un employé.
 * Inclut toujours les invariants absolus.
 */
export function getBlockedActionTypesForEmployee(
  employeeSlug: string,
): GlobalGuardActionType[] {
  const profile = getEmployeeGuardProfile(employeeSlug);
  const allBlocked = new Set([
    ...profile.blocked_action_types,
    ...UNIVERSAL_BLOCKED_ACTION_TYPES,
  ]);
  return [...allBlocked];
}

/**
 * Vérifie si un employé peut demander une action donnée.
 * Les invariants absolus retournent toujours false.
 */
export function canEmployeeRequestAction(
  employeeSlug: string,
  actionType: GlobalGuardActionType,
): boolean {
  // Invariants absolus : jamais autorisés
  if (UNIVERSAL_BLOCKED_ACTION_TYPES.includes(actionType)) return false;

  const profile = getEmployeeGuardProfile(employeeSlug);

  // Profil inconnu ou désactivé : only read_context
  if (profile.status === "disabled" || profile.status === "roadmap") {
    return actionType === "read_context";
  }

  // Vérifier si explicitement bloqué
  if (profile.blocked_action_types.includes(actionType)) return false;

  // Vérifier si dans les autorisées
  return profile.allowed_action_types.includes(actionType);
}

/**
 * Construit un GlobalGuardEvaluationInput complet pour une action d'employé.
 */
export function buildGuardInputForEmployeeAction(params: {
  company_id: string;
  employee_slug: string;
  action_type: GlobalGuardActionType;
  domain: GlobalGuardDomain;
  risk_level?: GlobalGuardRiskLevel;
  subject_type?: GlobalGuardSubjectType;
  payload_summary?: string;
  human_validation_present?: boolean;
}): GlobalGuardEvaluationInput {
  const profile = getEmployeeGuardProfile(params.employee_slug);

  // Déterminer le mode d'exécution selon le profil
  const mode: GlobalGuardExecutionMode =
    profile.status === "disabled" || profile.status === "roadmap"
      ? "blocked"
      : profile.max_execution_mode;

  return {
    request_id: `req_${params.employee_slug}_${Date.now()}`,
    company_id: params.company_id,
    employee_slug: params.employee_slug,
    domain: params.domain,
    action_type: params.action_type,
    requested_execution_mode: mode,
    risk_level: params.risk_level ?? "medium",
    subject_type: params.subject_type ?? "custom",
    payload_summary: params.payload_summary ?? "",
    human_validation_present: params.human_validation_present ?? false,
    enterprise_context_available: false,
    trace_context_available: false,
    metadata: { employee_domain: profile.domain },
  };
}
