// B42 — Orchestrator: run all 8 workflow scenarios

import type {
  PierreWorkflowScenario,
  PierreWorkflowExecutionResult,
  B42WorkflowAdapters,
} from "./types";
import { runWorkflowScenario } from "./workflow-runtime";
import { buildFakeB42Adapters } from "./workflow-fixtures";
import { B42_WORKFLOW_SCENARIOS } from "./workflow-scenarios";

// ── Run a set of scenarios ────────────────────────────────────────────────────

export async function runWorkflowScenarios(
  scenarios: PierreWorkflowScenario[],
  adapters: B42WorkflowAdapters,
  now: Date = new Date(),
): Promise<PierreWorkflowExecutionResult[]> {
  const results: PierreWorkflowExecutionResult[] = [];

  for (const scenario of scenarios) {
    const result = await runWorkflowScenario(scenario, adapters, now);
    results.push(result);
  }

  return results;
}

// ── Run all B42 scenarios with fake adapters ──────────────────────────────────

export async function runAllB42Workflows(
  now: Date = new Date(),
): Promise<{ results: PierreWorkflowExecutionResult[]; adapterState: ReturnType<typeof buildFakeB42Adapters>["state"] }> {
  const { adapters, state } = buildFakeB42Adapters();
  const results = await runWorkflowScenarios(B42_WORKFLOW_SCENARIOS, adapters, now);
  return { results, adapterState: state };
}

// ── Run a single scenario by id ───────────────────────────────────────────────

export async function runScenarioById(
  id: string,
  now: Date = new Date(),
): Promise<PierreWorkflowExecutionResult | null> {
  const scenario = B42_WORKFLOW_SCENARIOS.find((s) => s.id === id);
  if (!scenario) return null;
  const { adapters } = buildFakeB42Adapters();
  return runWorkflowScenario(scenario, adapters, now);
}
