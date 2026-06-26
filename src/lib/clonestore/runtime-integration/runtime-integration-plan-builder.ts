// src/lib/clonestore/runtime-integration/runtime-integration-plan-builder.ts
// PHASE 4.1 — Runtime Operational Integration — Plan Builder
//
// Construit un plan d'exécution runtime GOUVERNÉ et NON exécuté.
// plan_only true · execution_enabled false · read_only true.
// Pas de Supabase, pas de write, pas d'import Pierre, pas d'exécution CloneOS.

import type {
  RuntimeIntegrationCommand,
  RuntimeIntegrationIntent,
  RuntimeIntegrationIntentRoute,
  RuntimeIntegrationPlan,
  RuntimeIntegrationPlanStep,
  RuntimeIntegrationStatus,
  RuntimeIntegrationGuardDecision,
  RuntimeIntegrationValidationMode,
  RuntimeIntegrationRiskLevel,
} from "./runtime-integration-types";
import type { EmployeeContextRegistry } from "@/lib/clonestore/employee-context-registry";
import { buildDefaultEmployeeContextRegistry } from "@/lib/clonestore/employee-context-registry";
import { buildRuntimeIntegrationGuardDecision } from "./runtime-integration-guardrails";
import { buildRuntimeIntegrationTraceContract } from "./runtime-integration-trace-contract";
import {
  buildRuntimeIntegrationScaleHints,
  buildRuntimeIntegrationQueueHints,
  buildRuntimeIntegrationCostHints,
  buildRuntimeIntegrationIdempotencyContract,
} from "./runtime-integration-scale-readiness";

// ── Missing context steps ─────────────────────────────────────────────────────

export function buildRuntimeIntegrationMissingContextSteps(
  intent: RuntimeIntegrationIntent
): RuntimeIntegrationPlanStep[] {
  return intent.missing_context.map((ctx, i) => ({
    step_id: `step_missing_${i}`,
    label: `Contexte manquant : ${ctx}`,
    description: "Compléter ce contexte avant toute exécution future.",
    risk_level: "low" as RuntimeIntegrationRiskLevel,
    validation_mode: "human_review_recommended" as RuntimeIntegrationValidationMode,
    requires_human_validation: false,
    status: "blocked" as RuntimeIntegrationStatus,
    plan_only: true,
    execution_enabled: false,
  }));
}

// ── Validation steps ──────────────────────────────────────────────────────────

export function buildRuntimeIntegrationValidationSteps(
  route: RuntimeIntegrationIntentRoute
): RuntimeIntegrationPlanStep[] {
  if (!route.requires_human_validation) return [];
  return [
    {
      step_id: "step_human_validation",
      label: "Validation humaine requise",
      description: "Une validation humaine est nécessaire via CloneGuard avant toute exécution.",
      risk_level: "sensitive",
      validation_mode: "human_validation_required",
      requires_human_validation: true,
      status: "awaiting_validation",
      plan_only: true,
      execution_enabled: false,
    },
  ];
}

// ── Plan steps ────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationPlanSteps(
  intent: RuntimeIntegrationIntent,
  route: RuntimeIntegrationIntentRoute,
  registry?: EmployeeContextRegistry
): RuntimeIntegrationPlanStep[] {
  void registry;

  // Aucun employé actif → simulated_only avec contexte manquant.
  if (!route.employee_key) {
    return [
      {
        step_id: "step_no_route",
        label: "Aucun employé IA actif",
        description: "Aucun employé IA actif pour ce domaine — simulation uniquement.",
        risk_level: "low",
        validation_mode: "none",
        requires_human_validation: false,
        status: "simulated_only",
        plan_only: true,
        execution_enabled: false,
      },
      ...buildRuntimeIntegrationMissingContextSteps(intent),
    ];
  }

  const baseValidation: RuntimeIntegrationValidationMode = intent.validation_mode;
  const requiresValidation = route.requires_human_validation;

  const steps: RuntimeIntegrationPlanStep[] = [
    {
      step_id: "step_analyze",
      label: "Analyser la demande",
      description: "Analyser la demande RH et identifier l'objectif (plan-only).",
      capability_key: "hr_risk_review",
      risk_level: intent.risk_level,
      validation_mode: "none",
      requires_human_validation: false,
      status: "planned",
      plan_only: true,
      execution_enabled: false,
    },
    {
      step_id: "step_context",
      label: "Vérifier le contexte Enterprise Footprint / CloneADN",
      description: "Lire le contexte entreprise en read-only pour cadrer la mission.",
      risk_level: "low",
      validation_mode: "none",
      requires_human_validation: false,
      status: "planned",
      plan_only: true,
      execution_enabled: false,
    },
    {
      step_id: "step_prepare_mission",
      label: "Préparer la mission Pierre (plan-only)",
      description: "Préparer un plan de mission Pierre — jamais exécuté automatiquement.",
      function_key: route.available_function_keys[0],
      capability_key: route.available_capability_keys[0],
      risk_level: intent.risk_level,
      validation_mode: baseValidation,
      requires_human_validation: requiresValidation,
      status: "planned",
      plan_only: true,
      execution_enabled: false,
    },
    {
      step_id: "step_guard",
      label: "Appliquer CloneGuard",
      description: "CloneGuard évalue le risque — obligatoire avant toute action sensible.",
      risk_level: intent.risk_level,
      validation_mode: baseValidation,
      requires_human_validation: requiresValidation,
      status: "planned",
      plan_only: true,
      execution_enabled: false,
    },
    ...buildRuntimeIntegrationValidationSteps(route),
    {
      step_id: "step_trace",
      label: "Tracer via CloneTrace",
      description: "Journaliser le contexte et la décision — aucune action invisible.",
      risk_level: "low",
      validation_mode: "none",
      requires_human_validation: false,
      status: "planned",
      plan_only: true,
      execution_enabled: false,
    },
    {
      step_id: "step_ready_later",
      label: "Prêt pour future exécution contrôlée",
      description: "Le plan est prêt pour une exécution future gouvernée (Phase 4.2+). Non exécuté ici.",
      risk_level: intent.risk_level,
      validation_mode: baseValidation,
      requires_human_validation: requiresValidation,
      status: intent.risk_level === "blocked" ? "blocked" : "ready_to_execute_later",
      plan_only: true,
      execution_enabled: false,
    },
  ];

  return steps;
}

// ── Plan status ───────────────────────────────────────────────────────────────

export function deriveRuntimeIntegrationPlanStatus(
  steps: RuntimeIntegrationPlanStep[],
  guardDecision: RuntimeIntegrationGuardDecision
): RuntimeIntegrationStatus {
  if (guardDecision.decision === "block") return "blocked";
  if (steps.some((s) => s.status === "simulated_only")) return "simulated_only";
  if (guardDecision.human_validation_required) return "awaiting_validation";
  if (steps.every((s) => s.status === "planned" || s.status === "ready_to_execute_later")) {
    return "ready_to_execute_later";
  }
  return "planned";
}

// ── Build plan ────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationPlan(
  command: RuntimeIntegrationCommand,
  intent: RuntimeIntegrationIntent,
  route: RuntimeIntegrationIntentRoute,
  registry?: EmployeeContextRegistry
): RuntimeIntegrationPlan {
  const reg = registry ?? buildDefaultEmployeeContextRegistry();
  const steps = buildRuntimeIntegrationPlanSteps(intent, route, reg);
  const guardDecision = buildRuntimeIntegrationGuardDecision(intent, route, steps);
  const status = deriveRuntimeIntegrationPlanStatus(steps, guardDecision);
  const traceContract = buildRuntimeIntegrationTraceContract(command, intent, route);

  const plan: RuntimeIntegrationPlan = {
    plan_id: `rtplan_${command.command_id}`,
    command_id: command.command_id,
    intent_id: intent.intent_id,
    employee_key: route.employee_key,
    status,
    steps,
    guard_decision: guardDecision,
    trace_contract: traceContract,
    scale_hints: buildRuntimeIntegrationScaleHints(),
    queue_hints: buildRuntimeIntegrationQueueHints(),
    cost_hints: buildRuntimeIntegrationCostHints(),
    idempotency: buildRuntimeIntegrationIdempotencyContract(command, intent),
    read_only: true,
    execution_enabled: false,
    created_at: new Date().toISOString(),
  };

  // Recalcule queue priority en fonction du plan complet.
  plan.queue_hints = buildRuntimeIntegrationQueueHints(plan);
  return plan;
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeIntegrationPlan(plan: RuntimeIntegrationPlan): string {
  return [
    `[Runtime Plan] plan_id=${plan.plan_id} · status=${plan.status}`,
    `  Employé : ${plan.employee_key ?? "aucun (simulation)"}`,
    `  Étapes : ${plan.steps.length}`,
    `  CloneGuard : ${plan.guard_decision.decision}`,
    `  Validation humaine : ${plan.guard_decision.human_validation_required}`,
    `  execution_enabled : ${plan.execution_enabled} · plan-only`,
    `  Idempotency : ${plan.idempotency.required}`,
    `  Scale 80k prouvé : ${!plan.scale_hints.scale_80k_not_proven} (NON prouvé).`,
  ].join("\n");
}
