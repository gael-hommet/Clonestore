// src/lib/clonestore/runtime-integration/runtime-integration-intent-router.ts
// PHASE 4.1 — Runtime Operational Integration — Intent Router
//
// Route une commande vers un employee_key (principalement "pierre" pour RH).
// Réutilise le Global Employee Context Registry (P3.20) sans exécution.
// Pas de Supabase, pas de write, pas d'import Pierre, pas d'exécution CloneOS.

import type {
  RuntimeIntegrationCommand,
  RuntimeIntegrationIntent,
  RuntimeIntegrationIntentRoute,
  RuntimeIntegrationDomain,
  RuntimeIntegrationValidationMode,
  RuntimeIntegrationIssue,
} from "./runtime-integration-types";
import {
  classifyRuntimeIntegrationRisk,
} from "./runtime-integration-guardrails";
import type {
  EmployeeContextRegistry,
  EmployeeContextRegistryEmployee,
} from "@/lib/clonestore/employee-context-registry";
import {
  buildDefaultEmployeeContextRegistry,
  filterActiveEmployeeContexts,
  findEmployeeContextByKey,
} from "@/lib/clonestore/employee-context-registry";

// ── Domain inference ──────────────────────────────────────────────────────────

const HR_KEYWORDS = [
  "rh", "ressources humaines", "salarié", "salarie", "employé", "employe",
  "absence", "contrat", "onboarding", "paie", "salaire", "congé", "conge",
  "document rh", "entretien", "formation", "bulletin", "avenant", "licenciement",
  "arrêt maladie", "arret maladie", "embauche", "offboarding",
];

export function inferRuntimeIntegrationDomain(text: string): RuntimeIntegrationDomain {
  const lower = (text ?? "").toLowerCase();
  if (HR_KEYWORDS.some((k) => lower.includes(k))) return "hr";
  if (lower.includes("facture") || lower.includes("comptab") || lower.includes("finance")) return "finance";
  if (lower.includes("support") || lower.includes("ticket") || lower.includes("client")) return "support";
  if (lower.includes("juridique") || lower.includes("légal") || lower.includes("legal")) return "legal";
  return "unknown";
}

// ── Candidate employees ───────────────────────────────────────────────────────

export function inferRuntimeIntegrationCandidateEmployees(
  text: string,
  registry: EmployeeContextRegistry
): string[] {
  const domain = inferRuntimeIntegrationDomain(text);
  const active = filterActiveEmployeeContexts(registry);
  // En V1, seul Pierre (RH) est actif. On ne route que vers des employés actifs.
  if (domain === "hr") {
    return active.filter((e) => e.employee_key === "pierre").map((e) => e.employee_key);
  }
  return [];
}

// ── Capabilities lookup ───────────────────────────────────────────────────────

export function findRuntimeIntegrationEmployeeCapabilities(
  employee: EmployeeContextRegistryEmployee,
  domain: RuntimeIntegrationDomain
): { capability_keys: string[]; function_keys: string[] } {
  void domain;
  return {
    capability_keys: employee.capabilities.map((c) => c.capability_key),
    function_keys: employee.functions.map((f) => f.function_key),
  };
}

// ── Build intent ──────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationIntent(
  command: RuntimeIntegrationCommand,
  registry?: EmployeeContextRegistry
): RuntimeIntegrationIntent {
  const reg = registry ?? buildDefaultEmployeeContextRegistry();
  const normalized = (command.raw_text ?? "").toLowerCase().trim();
  const domain = inferRuntimeIntegrationDomain(normalized);
  const risk = classifyRuntimeIntegrationRisk(normalized);
  const candidates = inferRuntimeIntegrationCandidateEmployees(normalized, reg);

  const validationMode: RuntimeIntegrationValidationMode =
    risk === "blocked" ? "blocked"
    : risk === "sensitive" ? "human_validation_required"
    : risk === "high" ? "human_validation_required"
    : risk === "medium" ? "human_review_recommended"
    : "none";

  const missingContext: string[] = [];
  if (!command.company_id) missingContext.push("company_context");
  if (domain === "unknown") missingContext.push("domain_unclear");
  if (candidates.length === 0) missingContext.push("no_active_employee_for_domain");

  const confidence = domain === "hr" && candidates.length > 0 ? 0.8 : domain === "unknown" ? 0.2 : 0.4;

  return {
    intent_id: `rtint_${command.command_id}`,
    command_id: command.command_id,
    normalized_text: normalized,
    requested_employee_key: candidates[0],
    candidate_employee_keys: candidates,
    domain,
    risk_level: risk,
    validation_mode: validationMode,
    confidence,
    missing_context: missingContext,
    created_at: new Date().toISOString(),
    plan_only: true,
  };
}

// ── Route intent ──────────────────────────────────────────────────────────────

export function routeRuntimeIntegrationIntent(
  intent: RuntimeIntegrationIntent,
  registry?: EmployeeContextRegistry
): RuntimeIntegrationIntentRoute {
  const reg = registry ?? buildDefaultEmployeeContextRegistry();
  const routeId = `rtroute_${intent.intent_id}`;

  const candidateKey = intent.candidate_employee_keys[0] ?? null;
  const employee = candidateKey ? findEmployeeContextByKey(reg, candidateKey) : null;

  // Aucun candidat / employé inactif / placeholder futur → blocked / simulated_only.
  if (!employee || employee.status !== "active" || !employee.active_for_company) {
    return {
      route_id: routeId,
      intent_id: intent.intent_id,
      employee_key: null,
      route_reason:
        intent.domain === "hr"
          ? "Aucun employé IA actif disponible pour ce domaine."
          : "Domaine non couvert par un employé IA actif — simulation uniquement.",
      route_confidence: 0,
      available_capability_keys: [],
      available_function_keys: [],
      blocked_reason: "no_active_employee_for_domain",
      requires_human_validation: false,
      plan_only: true,
    };
  }

  const caps = findRuntimeIntegrationEmployeeCapabilities(employee, intent.domain);
  const requiresValidation =
    intent.validation_mode === "human_validation_required" ||
    intent.validation_mode === "blocked";

  return {
    route_id: routeId,
    intent_id: intent.intent_id,
    employee_key: employee.employee_key,
    route_reason: `Demande ${intent.domain} routée vers ${employee.display_name} (plan-only).`,
    route_confidence: intent.confidence,
    available_capability_keys: caps.capability_keys,
    available_function_keys: caps.function_keys,
    requires_human_validation: requiresValidation,
    plan_only: true,
  };
}

// ── Explain / issues ──────────────────────────────────────────────────────────

export function explainRuntimeIntegrationRoute(route: RuntimeIntegrationIntentRoute): string {
  return [
    `[Intent Route] ${route.employee_key ?? "aucun employé actif"}`,
    `  Raison : ${route.route_reason}`,
    `  Confiance : ${route.route_confidence}`,
    `  Validation humaine : ${route.requires_human_validation}`,
    `  Plan-only — aucune exécution runtime.`,
  ].join("\n");
}

export function buildRuntimeIntegrationRoutingIssues(
  intent: RuntimeIntegrationIntent,
  route: RuntimeIntegrationIntentRoute
): RuntimeIntegrationIssue[] {
  const issues: RuntimeIntegrationIssue[] = [];
  if (!route.employee_key) {
    issues.push({ code: "no_route", message: "Aucun employé IA actif pour router cette demande.", severity: "warning" });
  }
  if (intent.missing_context.length > 0) {
    issues.push({ code: "missing_context", message: `Contexte manquant : ${intent.missing_context.join(", ")}.`, severity: "info" });
  }
  return issues;
}
