// src/lib/clonestore/employee-context-registry/employee-context-registry-clonevoice-contract.ts
// PHASE 3.20 — Global Employee Context Registry Design — CloneVoice Context Contract
//
// DESIGN-ONLY. Définit comment CloneVoice aura PLUS TARD accès au registry,
// strictement via permissions et gouvernance. Aucune activation. Aucune exécution.
//
// CloneVoice est une interface vocale future. Elle ne contourne pas
// CloneOS / CloneGuard / CloneTrace. Elle ne fait aucune action invisible.
// CloneVoice n'est pas actif production dans ce bloc.
//
// Pas de Supabase, pas de réseau, pas de write, pas d'import Pierre.

import type {
  EmployeeContextRegistry,
} from "./employee-context-registry-types";
import {
  filterCloneVoiceVisibleEmployeeContexts,
} from "./employee-context-registry-snapshot";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CloneVoiceEmployeeContextAccessMode = "governed_context_only";

export type CloneVoiceEmployeeContextPermission = {
  permission_key: string;
  label: string;
  allowed: boolean;
  reason: string;
};

export type CloneVoiceEmployeeContextScope = {
  employee_key: string;
  display_name: string;
  readable_capabilities: string[];
  readable_functions: string[];
  read_only: true;
  execution_allowed: false;
};

export type CloneVoiceEmployeeContextGuardrail = {
  guardrail_key: string;
  label: string;
  description: string;
  enforced: true;
};

export type CloneVoiceEmployeeContextContract = {
  access_mode: CloneVoiceEmployeeContextAccessMode;
  can_read_registry: boolean;
  can_execute_actions: false;
  must_route_through_cloneos: true;
  must_pass_cloneguard: true;
  must_trace_with_clonetrace: true;
  sensitive_actions_require_human_validation: true;
  raw_secret_access: false;
  server_write_access: false;
  public_launch_validated: false;
  scopes: CloneVoiceEmployeeContextScope[];
  guardrails: CloneVoiceEmployeeContextGuardrail[];
  permissions: CloneVoiceEmployeeContextPermission[];
  notes: string[];
};

// ── Scopes ────────────────────────────────────────────────────────────────────

export function buildCloneVoiceEmployeeContextScopes(
  registry: EmployeeContextRegistry
): CloneVoiceEmployeeContextScope[] {
  return filterCloneVoiceVisibleEmployeeContexts(registry).map((e) => ({
    employee_key: e.employee_key,
    display_name: e.display_name,
    readable_capabilities: e.capabilities
      .filter((c) => c.available_in_clonevoice)
      .map((c) => c.capability_key),
    readable_functions: e.functions.map((f) => f.function_key),
    read_only: true,
    execution_allowed: false,
  }));
}

// ── Guardrails ────────────────────────────────────────────────────────────────

export function buildCloneVoiceEmployeeContextGuardrails(
  registry: EmployeeContextRegistry
): CloneVoiceEmployeeContextGuardrail[] {
  void registry;
  return [
    {
      guardrail_key: "route_through_cloneos",
      label: "Passage obligatoire par CloneOS",
      description: "CloneVoice ne contourne pas CloneOS — toute demande passe par l'orchestration.",
      enforced: true,
    },
    {
      guardrail_key: "pass_cloneguard",
      label: "Passage obligatoire par CloneGuard",
      description: "Les actions sensibles sont évaluées par CloneGuard avant toute suite.",
      enforced: true,
    },
    {
      guardrail_key: "trace_with_clonetrace",
      label: "Trace obligatoire CloneTrace",
      description: "Aucune action invisible — CloneTrace journalise le contexte.",
      enforced: true,
    },
    {
      guardrail_key: "human_validation_sensitive",
      label: "Validation humaine des actions sensibles",
      description: "Les actions sensibles nécessitent une validation humaine.",
      enforced: true,
    },
    {
      guardrail_key: "no_raw_secret_access",
      label: "Aucun accès aux secrets bruts",
      description: "CloneVoice n'accède à aucun secret brut.",
      enforced: true,
    },
  ];
}

// ── Permissions ───────────────────────────────────────────────────────────────

function buildCloneVoiceEmployeeContextPermissions(): CloneVoiceEmployeeContextPermission[] {
  return [
    { permission_key: "read_registry_context", label: "Lire le contexte registry", allowed: true, reason: "Contexte gouverné lecture seule." },
    { permission_key: "execute_actions", label: "Exécuter des actions", allowed: false, reason: "Aucune exécution — design-only." },
    { permission_key: "server_write", label: "Écriture serveur", allowed: false, reason: "Aucun write serveur." },
    { permission_key: "raw_secret_access", label: "Accès secrets bruts", allowed: false, reason: "Interdit." },
    { permission_key: "bypass_cloneguard", label: "Contourner CloneGuard", allowed: false, reason: "Interdit." },
  ];
}

// ── Contract builder ──────────────────────────────────────────────────────────

export function buildCloneVoiceEmployeeContextContract(
  registry: EmployeeContextRegistry
): CloneVoiceEmployeeContextContract {
  return {
    access_mode: "governed_context_only",
    can_read_registry: true,
    can_execute_actions: false,
    must_route_through_cloneos: true,
    must_pass_cloneguard: true,
    must_trace_with_clonetrace: true,
    sensitive_actions_require_human_validation: true,
    raw_secret_access: false,
    server_write_access: false,
    public_launch_validated: false,
    scopes: buildCloneVoiceEmployeeContextScopes(registry),
    guardrails: buildCloneVoiceEmployeeContextGuardrails(registry),
    permissions: buildCloneVoiceEmployeeContextPermissions(),
    notes: [
      "CloneVoice est une interface vocale future.",
      "CloneVoice peut accéder au contexte global uniquement via permissions.",
      "CloneVoice ne contourne pas CloneOS/CloneGuard/CloneTrace.",
      "CloneVoice ne fait aucune action invisible.",
      "CloneVoice n'est pas actif production dans ce bloc.",
      "lancement public externe non validé.",
    ],
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateCloneVoiceEmployeeContextContract(
  contract: CloneVoiceEmployeeContextContract
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (contract.access_mode !== "governed_context_only") {
    issues.push("access_mode doit être governed_context_only.");
  }
  if (contract.can_execute_actions !== false) {
    issues.push("can_execute_actions doit être false.");
  }
  if (contract.must_route_through_cloneos !== true) {
    issues.push("must_route_through_cloneos doit être true.");
  }
  if (contract.must_pass_cloneguard !== true) {
    issues.push("must_pass_cloneguard doit être true.");
  }
  if (contract.must_trace_with_clonetrace !== true) {
    issues.push("must_trace_with_clonetrace doit être true.");
  }
  if (contract.raw_secret_access !== false) {
    issues.push("raw_secret_access doit être false.");
  }
  if (contract.server_write_access !== false) {
    issues.push("server_write_access doit être false.");
  }
  if (contract.public_launch_validated !== false) {
    issues.push("public_launch_validated doit être false.");
  }
  for (const scope of contract.scopes) {
    if (scope.execution_allowed !== false) {
      issues.push(`Scope ${scope.employee_key} : execution_allowed doit être false.`);
    }
  }

  return { valid: issues.length === 0, issues };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeCloneVoiceEmployeeContextContract(
  contract: CloneVoiceEmployeeContextContract
): string {
  return [
    `[CloneVoice Governed Context Contract] access_mode=${contract.access_mode}`,
    `  can_execute_actions : ${contract.can_execute_actions}`,
    `  must_route_through_cloneos : ${contract.must_route_through_cloneos}`,
    `  must_pass_cloneguard : ${contract.must_pass_cloneguard}`,
    `  must_trace_with_clonetrace : ${contract.must_trace_with_clonetrace}`,
    `  scopes : ${contract.scopes.length}`,
    `  guardrails : ${contract.guardrails.length}`,
    `  CloneVoice n'est pas actif production. lancement public externe non validé.`,
  ].join("\n");
}
