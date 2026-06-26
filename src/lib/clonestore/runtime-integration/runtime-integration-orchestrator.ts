// src/lib/clonestore/runtime-integration/runtime-integration-orchestrator.ts
// PHASE 4.1 — Runtime Operational Integration — Orchestrator (simulation only)
//
// Simule la chaîne CloneOS command → intent → route → plan, SANS exécution.
// Pas de Supabase, pas d'API, pas de runtime Pierre, pas d'exécution CloneOS,
// pas d'activation CloneVoice, pas d'appel IA.

import type {
  RuntimeIntegrationMode,
  RuntimeIntegrationReadResult,
  RuntimeIntegrationRecommendation,
  RuntimeIntegrationAction,
  RuntimeIntegrationIssue,
} from "./runtime-integration-types";
import type { EmployeeContextRegistry } from "@/lib/clonestore/employee-context-registry";
import {
  buildDefaultEmployeeContextRegistry,
  buildEmployeeContextRegistryFromEnterpriseFootprint,
} from "@/lib/clonestore/employee-context-registry";
import {
  buildRuntimeIntegrationCommand,
  buildRuntimeIntegrationCommandIssues,
  buildRuntimeIntegrationCommandRecommendations,
  type RuntimeIntegrationCommandInput,
} from "./runtime-integration-command-contract";
import {
  buildRuntimeIntegrationIntent,
  routeRuntimeIntegrationIntent,
  buildRuntimeIntegrationRoutingIssues,
} from "./runtime-integration-intent-router";
import { buildRuntimeIntegrationPlan } from "./runtime-integration-plan-builder";
import { buildRuntimeIntegrationGuardIssues } from "./runtime-integration-guardrails";

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimeIntegrationOrchestratorOptions = {
  registry?: EmployeeContextRegistry;
  enterprise_footprint?: { company_id?: string; company?: { company_name?: string } } | null;
  mode?: RuntimeIntegrationMode;
  user_id?: string;
  company_id?: string;
};

function resolveRegistry(options?: RuntimeIntegrationOrchestratorOptions): EmployeeContextRegistry {
  if (options?.registry) return options.registry;
  if (options?.enterprise_footprint?.company_id) {
    return buildEmployeeContextRegistryFromEnterpriseFootprint(options.enterprise_footprint);
  }
  return buildDefaultEmployeeContextRegistry();
}

// ── Read result ───────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationReadResult(
  commandInput: RuntimeIntegrationCommandInput,
  options?: RuntimeIntegrationOrchestratorOptions
): RuntimeIntegrationReadResult {
  const registry = resolveRegistry(options);
  const mode: RuntimeIntegrationMode = options?.mode ?? "design_only";

  const command = buildRuntimeIntegrationCommand({
    ...commandInput,
    user_id: commandInput.user_id ?? options?.user_id,
    company_id: commandInput.company_id ?? options?.company_id ?? options?.enterprise_footprint?.company_id,
  });
  const intent = buildRuntimeIntegrationIntent(command, registry);
  const route = routeRuntimeIntegrationIntent(intent, registry);
  const plan = buildRuntimeIntegrationPlan(command, intent, route, registry);

  const result: RuntimeIntegrationReadResult = {
    mode,
    command,
    intent,
    route,
    plan,
    recommendations: [],
    issues: [],
    actions: [],
    read_only: true,
    execution_enabled: false,
    public_launch_external_validated: false,
  };
  result.issues = buildRuntimeIntegrationIssues(result);
  result.recommendations = buildRuntimeIntegrationRecommendations(result);
  result.actions = buildRuntimeIntegrationActions(result);
  return result;
}

// ── Simulation (alias sémantique) ─────────────────────────────────────────────

export function simulateCloneOSToPierreRuntimePlan(
  commandInput: RuntimeIntegrationCommandInput,
  options?: RuntimeIntegrationOrchestratorOptions
): RuntimeIntegrationReadResult {
  return buildRuntimeIntegrationReadResult(commandInput, {
    ...(options ?? {}),
    mode: "simulation",
  });
}

// ── Issues ────────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationIssues(
  result: RuntimeIntegrationReadResult
): RuntimeIntegrationIssue[] {
  return [
    ...buildRuntimeIntegrationCommandIssues(result.command),
    ...buildRuntimeIntegrationRoutingIssues(result.intent, result.route),
    ...buildRuntimeIntegrationGuardIssues(result.intent, result.route),
  ];
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function buildRuntimeIntegrationRecommendations(
  result: RuntimeIntegrationReadResult
): RuntimeIntegrationRecommendation[] {
  const recs = [...buildRuntimeIntegrationCommandRecommendations(result.command)];

  if (result.plan.guard_decision.decision === "block") {
    recs.push({
      id: "rec-blocked",
      text: "Action finale bloquée — décision humaine exclusive requise.",
      href: "/agents/pierre/use",
      action_label: "Cockpit Pierre",
    });
  } else if (result.plan.guard_decision.human_validation_required) {
    recs.push({
      id: "rec-validation",
      text: "Validation humaine requise avant toute exécution future.",
      href: "/agents/pierre/use",
      action_label: "Cockpit Pierre",
    });
  }

  if (!result.route.employee_key) {
    recs.push({
      id: "rec-no-route",
      text: "Aucun employé IA actif pour ce domaine — Pierre couvre le RH en V1.",
      href: "/profile/agents",
      action_label: "Mon espace",
    });
  }

  return recs;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationActions(
  result: RuntimeIntegrationReadResult
): RuntimeIntegrationAction[] {
  void result;
  return [
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: true },
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: false },
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
    { id: "go-pierre-setup", label: "Pierre Setup", href: "/agents/pierre/setup", primary: false },
    { id: "go-pierre-use", label: "Cockpit Pierre", href: "/agents/pierre/use", primary: false },
  ];
}
