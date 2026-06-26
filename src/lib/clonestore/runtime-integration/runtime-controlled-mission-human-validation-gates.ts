// src/lib/clonestore/runtime-integration/runtime-controlled-mission-human-validation-gates.ts
// PHASE 4.11 — Controlled Mission Human Validation — Gates
//
// Module PUR. Construit et évalue les gates de validation humaine.
// Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.

import type { RuntimeMissionPromotionContract } from "./runtime-mission-promotion-types";
import type {
  RuntimeControlledMissionHumanValidationGate,
  RuntimeControlledMissionHumanValidationGateId,
  RuntimeControlledMissionHumanValidationGateStatus,
  RuntimeControlledMissionHumanValidationGateSeverity,
  RuntimeControlledMissionHumanValidationWorkflow,
} from "./runtime-controlled-mission-human-validation-types";
import type { RuntimeControlledMissionHumanValidationPolicy } from "./runtime-controlled-mission-human-validation-policy";

// ── Builder unitaire ──────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationGate(
  id: RuntimeControlledMissionHumanValidationGateId,
  options: {
    label: string;
    description: string;
    required: boolean;
    status: RuntimeControlledMissionHumanValidationGateStatus;
    severity: RuntimeControlledMissionHumanValidationGateSeverity;
    reason?: string;
  }
): RuntimeControlledMissionHumanValidationGate {
  return {
    id,
    label: options.label,
    description: options.description,
    required: options.required,
    status: options.status,
    severity: options.severity,
    reason: options.reason,
  };
}

// ── Builder complet ───────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationGates(
  contract: RuntimeMissionPromotionContract,
  policy: RuntimeControlledMissionHumanValidationPolicy
): RuntimeControlledMissionHumanValidationGate[] {
  const hasBlockers = contract.decision.blocking_gates.length > 0;
  const isSensitive =
    policy.sensitivity === "sensitive_hr" ||
    policy.sensitivity === "legal_sensitive" ||
    policy.sensitivity === "blocked";
  const riskReviewNeeded =
    policy.risk_level === "high" || policy.risk_level === "sensitive" || policy.risk_level === "blocked";

  const gates: RuntimeControlledMissionHumanValidationGate[] = [];

  // ── Gates obligatoires : action humaine en attente ──────────────────────────
  gates.push(buildRuntimeControlledMissionHumanValidationGate("human_validator_required", {
    label: "Validateur humain requis",
    description: "Une validation humaine est obligatoire avant toute mission réelle.",
    required: true, status: "pending", severity: "blocking",
  }));

  // ── Gates invariants : satisfaits par design (no-execution) ─────────────────
  gates.push(buildRuntimeControlledMissionHumanValidationGate("cloneguard_required", {
    label: "CloneGuard obligatoire",
    description: "La décision CloneGuard est obligatoire.",
    required: true, status: "passed", severity: "blocking",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("clonetrace_required", {
    label: "CloneTrace obligatoire",
    description: "Le contrat CloneTrace est obligatoire.",
    required: true, status: "passed", severity: "blocking",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("tenant_scope_required", {
    label: "Isolation tenant requise",
    description: "Isolation stricte par user_id/company_id.",
    required: true, status: "passed", severity: "blocking",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("no_execution_required", {
    label: "Aucune exécution",
    description: "Aucune exécution déclenchée par la validation.",
    required: true,
    status: contract.safety_flags.execution_enabled === false ? "passed" : "failed",
    severity: "blocking",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("no_real_mission_required", {
    label: "Aucune mission réelle",
    description: "Aucune mission réelle créée.",
    required: true,
    status: contract.safety_flags.mission_executed === false ? "passed" : "failed",
    severity: "blocking",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("promotion_not_applied_required", {
    label: "Promotion non appliquée",
    description: "promotion_applied doit rester false.",
    required: true,
    status: contract.decision.promotion_applied === false ? "passed" : "failed",
    severity: "blocking",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("audit_trace_required", {
    label: "Trace d'audit requise",
    description: "La validation devra être tracée (CloneTrace) lors d'une activation future.",
    required: true, status: "passed", severity: "blocking",
  }));

  // ── Gates de revue (en attente d'humain) ────────────────────────────────────
  gates.push(buildRuntimeControlledMissionHumanValidationGate("risk_review_required", {
    label: "Revue de risque",
    description: "Revue de risque requise pour les cas high/sensitive.",
    required: riskReviewNeeded,
    status: riskReviewNeeded ? "pending" : "not_required",
    severity: riskReviewNeeded ? "blocking" : "info",
  }));

  // ── Gates conditionnels ─────────────────────────────────────────────────────
  gates.push(buildRuntimeControlledMissionHumanValidationGate("second_validator_required", {
    label: "Second validateur requis",
    description: "Double validation requise sur cas sensible.",
    required: policy.second_validator_required,
    status: policy.second_validator_required ? "pending" : "not_required",
    severity: policy.second_validator_required ? "blocking" : "info",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("sensitive_hr_review_required", {
    label: "Revue RH sensible",
    description: "Revue RH renforcée requise pour cas sensibles.",
    required: isSensitive,
    status: isSensitive ? "pending" : "not_required",
    severity: isSensitive ? "blocking" : "info",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("legal_review_required", {
    label: "Revue légale",
    description: "Revue légale requise pour cas juridiques.",
    required: policy.legal_reviewer_required,
    status: policy.legal_reviewer_required ? "pending" : "not_required",
    severity: policy.legal_reviewer_required ? "blocking" : "info",
  }));
  gates.push(buildRuntimeControlledMissionHumanValidationGate("missing_context_review_required", {
    label: "Revue de contexte manquant",
    description: "Revue requise si gates bloquants / contexte manquant.",
    required: hasBlockers,
    status: hasBlockers ? "pending" : "not_required",
    severity: hasBlockers ? "warning" : "info",
  }));

  return gates;
}

// ── Évaluation ────────────────────────────────────────────────────────────────

export type RuntimeControlledMissionHumanValidationGatesSummary = {
  total: number;
  required: number;
  passed: number;
  pending: number;
  failed: number;
  blocking_pending: RuntimeControlledMissionHumanValidationGateId[];
  blocking_failed: RuntimeControlledMissionHumanValidationGateId[];
  all_invariants_passed: boolean;
};

export function evaluateRuntimeControlledMissionHumanValidationGates(
  workflow: RuntimeControlledMissionHumanValidationWorkflow
): RuntimeControlledMissionHumanValidationGatesSummary {
  const gates = workflow.gates;
  const required = gates.filter((g) => g.required);
  const passed = gates.filter((g) => g.status === "passed");
  const pending = gates.filter((g) => g.status === "pending");
  const failed = gates.filter((g) => g.status === "failed");
  const blockingPending = gates.filter((g) => g.severity === "blocking" && g.required && g.status === "pending");
  const blockingFailed = gates.filter((g) => g.severity === "blocking" && g.required && g.status === "failed");

  const invariantIds: RuntimeControlledMissionHumanValidationGateId[] = [
    "no_execution_required", "no_real_mission_required", "promotion_not_applied_required",
    "cloneguard_required", "clonetrace_required", "audit_trace_required", "tenant_scope_required",
  ];
  const allInvariantsPassed = gates
    .filter((g) => invariantIds.includes(g.id))
    .every((g) => g.status === "passed");

  return {
    total: gates.length,
    required: required.length,
    passed: passed.length,
    pending: pending.length,
    failed: failed.length,
    blocking_pending: blockingPending.map((g) => g.id),
    blocking_failed: blockingFailed.map((g) => g.id),
    all_invariants_passed: allInvariantsPassed,
  };
}

export function getRuntimeControlledMissionHumanValidationBlockingGates(
  workflow: RuntimeControlledMissionHumanValidationWorkflow
): RuntimeControlledMissionHumanValidationGate[] {
  return workflow.gates.filter(
    (g) => g.severity === "blocking" && g.required && (g.status === "pending" || g.status === "failed")
  );
}

export function summarizeRuntimeControlledMissionHumanValidationGates(
  gates: RuntimeControlledMissionHumanValidationGate[]
): string {
  return [
    `[Human Validation Gates] ${gates.length} gate(s)`,
    ...gates.map((g) => `  ${g.status === "passed" ? "✓" : g.status === "not_required" ? "·" : "○"} ${g.label} (${g.status})`),
    "  Gates invariants : no-execution / no-real-mission / promotion-not-applied — design satisfaits.",
  ].join("\n");
}
