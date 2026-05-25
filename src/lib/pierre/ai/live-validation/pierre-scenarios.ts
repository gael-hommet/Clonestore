// src/lib/pierre/ai/live-validation/pierre-scenarios.ts
// B38B — Pierre layer: scenario enrichment + Pierre-specific scenario selection.
// Delegates scenario catalog to platform layer. Adds Pierre mission context.

import type { LiveValidationScenario } from "../../../cloneos/ai/live-validation/types";
import {
  LIVE_VALIDATION_SCENARIOS,
  getLiveValidationScenario,
  getDefaultScenarioSelection,
  getSensitiveBlockScenarios,
} from "../../../cloneos/ai/live-validation/scenarios";

// ── Pierre mission context metadata ──────────────────────────────────────────

export type PierreScenarioContext = {
  scenario: LiveValidationScenario;
  pierre_domain: string;
  pierre_sensitivity: "low" | "medium" | "high";
  pierre_expected_json_fields: string[];
  pierre_compliance_notes: string;
};

function derivePierreDomain(scenario: LiveValidationScenario): string {
  const id = scenario.id;
  if (id.includes("recrutement")) return "recrutement";
  if (id.includes("onboarding")) return "onboarding";
  if (id.includes("absence")) return "gestion_absence";
  if (id.includes("prepaie")) return "preparation_paie";
  if (id.includes("document")) return "documents_rh";
  if (id.includes("sensible")) return "cas_sensible_disciplinaire";
  if (id.includes("dossier")) return "dossier_salarie";
  if (id.includes("reporting")) return "reporting_rh";
  if (id.includes("email")) return "communication_rh";
  if (id.includes("multi")) return "mission_multi_actions";
  return "rh_general";
}

function derivePierreSensitivity(scenario: LiveValidationScenario): "low" | "medium" | "high" {
  if (scenario.is_sensitive_block_test) return "high";
  if (scenario.expected_behavior.should_require_human_validation) return "medium";
  return "low";
}

function deriveExpectedJsonFields(scenario: LiveValidationScenario): string[] {
  const base = ["intent", "summary", "domain", "risk_level"];
  if (scenario.expected_behavior.should_produce_tasks) base.push("suggested_tasks");
  if (scenario.expected_behavior.should_require_human_validation) base.push("requires_human_validation");
  if (scenario.is_sensitive_block_test) base.push("requires_human_validation", "missing_info");
  return [...new Set(base)];
}

function derivePierreComplianceNotes(scenario: LiveValidationScenario): string {
  if (scenario.is_sensitive_block_test) {
    return "Pierre must refuse execution. requires_human_validation=true mandatory. No auto-send.";
  }
  if (scenario.expected_behavior.should_require_human_validation) {
    return "Human validation expected. No auto-execution of sensitive actions.";
  }
  if (scenario.expected_behavior.should_produce_tasks) {
    return "Tasks expected in structured JSON. No auto-send. Draft mode only for emails.";
  }
  return "Standard HR mission. Structured JSON output. No auto-execution.";
}

// ── Public API ────────────────────────────────────────────────────────────────

export function enrichScenarioWithPierreContext(
  scenario: LiveValidationScenario,
): PierreScenarioContext {
  return {
    scenario,
    pierre_domain: derivePierreDomain(scenario),
    pierre_sensitivity: derivePierreSensitivity(scenario),
    pierre_expected_json_fields: deriveExpectedJsonFields(scenario),
    pierre_compliance_notes: derivePierreComplianceNotes(scenario),
  };
}

export function getAllPierreScenarioContexts(): PierreScenarioContext[] {
  return LIVE_VALIDATION_SCENARIOS.map(enrichScenarioWithPierreContext);
}

export function getPierreScenarioContext(id: string): PierreScenarioContext | null {
  const scenario = getLiveValidationScenario(id);
  return scenario ? enrichScenarioWithPierreContext(scenario) : null;
}

export function getDefaultPierreScenarioSelection(maxCount: number): PierreScenarioContext[] {
  return getDefaultScenarioSelection(maxCount).map(enrichScenarioWithPierreContext);
}

export function getSensitivePierreScenarios(): PierreScenarioContext[] {
  return getSensitiveBlockScenarios().map(enrichScenarioWithPierreContext);
}

export function getPierreScenariosForDomain(domain: string): PierreScenarioContext[] {
  return getAllPierreScenarioContexts().filter((ctx) => ctx.pierre_domain === domain);
}

export function getPierreHighSensitivityScenarios(): PierreScenarioContext[] {
  return getAllPierreScenarioContexts().filter((ctx) => ctx.pierre_sensitivity === "high");
}

export function validatePierreScenarioSet(scenarios: LiveValidationScenario[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (scenarios.length === 0) {
    errors.push("No scenarios provided.");
  }
  if (scenarios.length > 10) {
    errors.push(`Too many scenarios: ${scenarios.length} > 10 max.`);
  }

  const hasSensitiveTest = scenarios.some((s) => s.is_sensitive_block_test);
  if (!hasSensitiveTest) {
    errors.push(
      "No sensitive block test scenario included. At least one is_sensitive_block_test=true scenario is strongly recommended.",
    );
  }

  const ids = scenarios.map((s) => s.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push("Duplicate scenario IDs detected.");
  }

  const totalCost = scenarios.reduce((s, sc) => s + sc.max_cost_cents, 0);
  if (totalCost > 150) {
    errors.push(`Estimated total cost (${totalCost}¢) exceeds absolute max (150¢).`);
  }

  return { valid: errors.length === 0, errors };
}

// Re-export platform catalog for convenience
export { LIVE_VALIDATION_SCENARIOS };
