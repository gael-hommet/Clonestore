// src/lib/clonestore/runtime-integration/runtime-integration-trace-contract.ts
// PHASE 4.1 — Runtime Operational Integration — Trace Contract (CloneTrace)
//
// Module pur. CloneTrace est une trace OBLIGATOIRE. read_only, server_write_enabled false en P4.1.
// Pas de Supabase, pas de write, pas d'import Pierre.

import type {
  RuntimeIntegrationCommand,
  RuntimeIntegrationIntent,
  RuntimeIntegrationIntentRoute,
  RuntimeIntegrationPlan,
  RuntimeIntegrationTraceContract,
  RuntimeIntegrationTraceEvent,
} from "./runtime-integration-types";

const PERSONAL_DATA_HINTS = ["salarié", "salarie", "employé", "employe", "salaire", "paie", "données personnelles", "rgpd", "contrat"];

function containsPersonalData(text: string): boolean {
  const lower = (text ?? "").toLowerCase();
  return PERSONAL_DATA_HINTS.some((k) => lower.includes(k));
}

// ── Build trace contract ──────────────────────────────────────────────────────

export function buildRuntimeIntegrationTraceContract(
  command: RuntimeIntegrationCommand,
  intent: RuntimeIntegrationIntent,
  route: RuntimeIntegrationIntentRoute
): RuntimeIntegrationTraceContract {
  const now = new Date().toISOString();
  const events: RuntimeIntegrationTraceEvent[] = [
    { event_key: "command_received", label: "Commande reçue", at: now },
    { event_key: "intent_built", label: "Intention construite", at: now },
    { event_key: "route_selected", label: "Routage sélectionné", at: now },
  ];

  return {
    trace_id: `rttrace_${command.command_id}`,
    command_id: command.command_id,
    intent_id: intent.intent_id,
    route_id: route.route_id,
    employee_key: route.employee_key,
    events,
    audit_required: true,
    clonetrace_required: true,
    contains_personal_data: containsPersonalData(intent.normalized_text),
    retention_hint: "audit_retention_per_company_policy",
    read_only: true,
    server_write_enabled: false,
  };
}

// ── Build trace events depuis un plan ─────────────────────────────────────────

export function buildRuntimeIntegrationTraceEvents(
  plan: RuntimeIntegrationPlan
): RuntimeIntegrationTraceEvent[] {
  const now = new Date().toISOString();
  const events: RuntimeIntegrationTraceEvent[] = [
    { event_key: "command_received", label: "Commande reçue", at: now },
    { event_key: "intent_built", label: "Intention construite", at: now },
    { event_key: "route_selected", label: "Routage sélectionné", at: now },
    { event_key: "plan_created", label: "Plan créé (plan-only)", at: now },
    { event_key: "guard_evaluated", label: "CloneGuard évalué", at: now },
  ];
  if (plan.guard_decision.human_validation_required) {
    events.push({ event_key: "validation_required", label: "Validation humaine requise", at: now });
  }
  events.push({ event_key: "execution_not_started", label: "Exécution non démarrée (P4.1)", at: now });
  return events;
}

// ── Summarize / validate ──────────────────────────────────────────────────────

export function summarizeRuntimeIntegrationTraceContract(
  trace: RuntimeIntegrationTraceContract
): string {
  return [
    `[CloneTrace] trace_id=${trace.trace_id}`,
    `  Événements : ${trace.events.length}`,
    `  Données personnelles : ${trace.contains_personal_data}`,
    `  CloneTrace requis : ${trace.clonetrace_required}`,
    `  Écriture serveur activée : ${trace.server_write_enabled}`,
  ].join("\n");
}

export function validateRuntimeIntegrationTraceContract(
  trace: RuntimeIntegrationTraceContract
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (trace.clonetrace_required !== true) issues.push("clonetrace_required doit être true.");
  if (trace.server_write_enabled !== false) issues.push("server_write_enabled doit être false en P4.1.");
  if (trace.read_only !== true) issues.push("read_only doit être true.");
  if (trace.events.length === 0) issues.push("Aucun événement de trace.");
  return { valid: issues.length === 0, issues };
}
