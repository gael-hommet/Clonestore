// TECH-08 — CloneOS Command Center — Pierre → CloneOS Bridge
// Permet à Pierre d'être planifié via CloneOS sans modifier son moteur.
// Non-invasif : src/lib/pierre/** n'est pas modifié.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSCommandInput,
  CloneOSCommandCenterResult,
  CloneOSMissionPlan,
  CloneOSCommandIntent,
  CloneOSCommandSource,
} from "./cloneos-command-types";
import { processCloneOSCommand } from "./cloneos-command-center";

// ── Types bridge Pierre ───────────────────────────────────────────────────────

export interface PierreCloneOSCommandInput {
  company_id: string;
  raw_request: string;
  user_id?: string;
  source?: CloneOSCommandSource;
  session_id?: string;
  mission_type?: string;
  domain_hint?: string;
  risk_hint?: string;
  is_demo?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PierreLegacyMissionFallback {
  can_use_legacy: boolean;
  legacy_mission_type?: string;
  legacy_risk_level?: string;
  fallback_reason?: string;
  pierre_contract_slug: "pierre";
}

// ── Mappers ───────────────────────────────────────────────────────────────────

/**
 * Mappe un mission_type Pierre natif vers un intent CloneOS.
 */
export function mapCloneOSMissionPlanToPierreIntent(
  plan: CloneOSMissionPlan,
): string {
  const intentMap: Record<CloneOSCommandIntent, string> = {
    create_document: "hr_document_generation",
    prepare_email: "hr_email_drafting",
    send_email: "hr_email_drafting",
    ask_information: "hr_policy_query",
    hr_operation: "hr_document_generation",
    update_memory: "employee_record_management",
    analyze_file: "employee_record_management",
    plan_followup: "hr_policy_query",
    create_task: "hr_policy_query",
    support_operation: "hr_policy_query",
    finance_operation: "hr_policy_query",
    admin_operation: "hr_policy_query",
    unknown: "hr_policy_query",
  };
  return intentMap[plan.intent] ?? "hr_policy_query";
}

/**
 * Construit un fallback legacy Pierre si CloneOS ne peut pas traiter la commande.
 */
export function buildPierreLegacyMissionFallback(
  result: CloneOSCommandCenterResult,
): PierreLegacyMissionFallback {
  if (result.ok) {
    return {
      can_use_legacy: false,
      pierre_contract_slug: "pierre",
      fallback_reason: "CloneOS a traité la commande avec succès — legacy non requis.",
    };
  }

  // Si bloqué ou refusé → legacy aussi ne peut pas exécuter
  if (result.status === "refused") {
    return {
      can_use_legacy: false,
      pierre_contract_slug: "pierre",
      fallback_reason: "Action refusée par invariant absolu — legacy aussi bloqué.",
    };
  }

  // Si pas d'employé → legacy possible pour Pierre directement
  if (result.status === "blocked") {
    return {
      can_use_legacy: true,
      legacy_mission_type: "hr_document_generation",
      legacy_risk_level: "medium",
      pierre_contract_slug: "pierre",
      fallback_reason: "Aucun employé CloneOS disponible — fallback vers Pierre legacy.",
    };
  }

  return {
    can_use_legacy: false,
    pierre_contract_slug: "pierre",
    fallback_reason: "Fallback non applicable.",
  };
}

// ── Bridge principal ──────────────────────────────────────────────────────────

/**
 * Construit un CloneOSCommandInput depuis une demande Pierre native.
 */
export function buildPierreCloneOSCommand(
  input: PierreCloneOSCommandInput,
): CloneOSCommandInput {
  return {
    company_id: input.company_id,
    user_id: input.user_id,
    source: input.source ?? "pierre_cockpit",
    raw_request: input.raw_request,
    preferred_employee_slug: "pierre",  // toujours Pierre via ce bridge
    attached_file_refs: [],
    metadata: {
      ...(input.metadata ?? {}),
      pierre_mission_type: input.mission_type ?? "",
      pierre_domain_hint: input.domain_hint ?? "hr",
      pierre_risk_hint: input.risk_hint ?? "medium",
    },
    is_demo: input.is_demo ?? false,
    session_id: input.session_id,
  };
}

/**
 * Traite une commande Pierre à travers le pipeline CloneOS.
 * Ne modifie pas le moteur Pierre. Ne crée pas de DB. Ne fait qu'un plan.
 */
export function processPierreCommandThroughCloneOS(
  input: PierreCloneOSCommandInput,
): CloneOSCommandCenterResult {
  const cloneOSInput = buildPierreCloneOSCommand(input);
  return processCloneOSCommand(cloneOSInput);
}
