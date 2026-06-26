// src/lib/clonestore/employee-context-registry/employee-context-registry-validation.ts
// PHASE 3.20 — Global Employee Context Registry Design — Validation / Sanitization
//
// Module pur. Vérifie les invariants design-only et bloque tout ce qui ressemble
// à un secret ou à une exécution en phase design.
// Pas de Supabase, pas de réseau, pas de write, pas d'import Pierre.

import type {
  EmployeeContextRegistry,
  EmployeeContextRegistryEmployee,
  EmployeeContextRegistryCapability,
  EmployeeContextRegistryFunction,
  EmployeeContextRegistryIssue,
} from "./employee-context-registry-types";

// ── Patterns interdits (détection — jamais des valeurs réelles) ───────────────
// Ces chaînes sont des motifs à DÉTECTER et BLOQUER. Ce ne sont pas des secrets.

export const EMPLOYEE_CONTEXT_REGISTRY_FORBIDDEN_PATTERNS: string[] = [
  "sk_live_",
  "whsec_",
  "openai_api_key",
  "anthropic_api_key",
  "supabase_service_role_key",
  "private_key",
  "secret_key",
  "api_key",
  "bearer token",
  "public launch go",
  "zéro erreur",
  "conformité garantie",
  "clonevoice actif production",
];

// ── Détection texte non sûr ───────────────────────────────────────────────────

export function detectUnsafeEmployeeContextRegistryText(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  return EMPLOYEE_CONTEXT_REGISTRY_FORBIDDEN_PATTERNS.filter((p) => lower.includes(p));
}

// ── Clés produit safe ─────────────────────────────────────────────────────────

export function isSafeEmployeeContextRegistryKey(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  // lowercase snake_case, pas d'espaces, pas de motif secret
  if (!/^[a-z0-9_]+$/.test(value)) return false;
  if (detectUnsafeEmployeeContextRegistryText(value).length > 0) return false;
  return true;
}

export function normalizeEmployeeContextRegistryKey(value: string): string {
  if (!value || typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ── Assertions secrets ────────────────────────────────────────────────────────

export function assertEmployeeContextRegistryNoSecrets(
  registry: EmployeeContextRegistry
): { safe: boolean; issues: EmployeeContextRegistryIssue[] } {
  const issues: EmployeeContextRegistryIssue[] = [];
  let serialized = "";
  try {
    serialized = JSON.stringify(registry);
  } catch {
    serialized = "";
  }
  const found = detectUnsafeEmployeeContextRegistryText(serialized);
  for (const f of found) {
    issues.push({
      code: "secret_like_pattern_detected",
      message: `Motif interdit détecté : ${f}`,
      severity: "blocking",
    });
  }
  return { safe: issues.length === 0, issues };
}

// ── Validation capability ─────────────────────────────────────────────────────

export function validateEmployeeContextRegistryCapability(
  capability: EmployeeContextRegistryCapability
): { valid: boolean; issues: EmployeeContextRegistryIssue[] } {
  const issues: EmployeeContextRegistryIssue[] = [];

  if (!isSafeEmployeeContextRegistryKey(capability.capability_key)) {
    issues.push({
      code: "invalid_capability_key",
      message: "capability_key doit être lowercase snake_case et safe.",
      severity: "blocking",
    });
  }
  if (capability.execution_enabled) {
    issues.push({
      code: "execution_enabled_in_design_phase",
      message: "execution_enabled doit être false en phase design.",
      severity: "blocking",
    });
  }
  if (capability.available_in_clonevoice && !capability.available_in_cloneos) {
    issues.push({
      code: "clonevoice_visibility_without_cloneos",
      message: "available_in_clonevoice requiert available_in_cloneos.",
      severity: "blocking",
    });
  }
  return { valid: issues.length === 0, issues };
}

// ── Validation function ───────────────────────────────────────────────────────

export function validateEmployeeContextRegistryFunction(
  fn: EmployeeContextRegistryFunction
): { valid: boolean; issues: EmployeeContextRegistryIssue[] } {
  const issues: EmployeeContextRegistryIssue[] = [];

  if (!isSafeEmployeeContextRegistryKey(fn.function_key)) {
    issues.push({
      code: "invalid_function_key",
      message: "function_key doit être lowercase snake_case et safe.",
      severity: "blocking",
    });
  }
  if (fn.execution_enabled) {
    issues.push({
      code: "execution_enabled_in_design_phase",
      message: "execution_enabled doit être false en phase design.",
      severity: "blocking",
    });
  }
  return { valid: issues.length === 0, issues };
}

// ── Validation employee ───────────────────────────────────────────────────────

export function validateEmployeeContextRegistryEmployee(
  employee: EmployeeContextRegistryEmployee
): { valid: boolean; issues: EmployeeContextRegistryIssue[] } {
  const issues: EmployeeContextRegistryIssue[] = [];

  if (!isSafeEmployeeContextRegistryKey(employee.employee_key)) {
    issues.push({
      code: "invalid_employee_key",
      message: "employee_key doit être lowercase snake_case et safe.",
      severity: "blocking",
    });
  }
  if (employee.clonevoice_visible && !employee.cloneos_visible) {
    issues.push({
      code: "clonevoice_visibility_without_cloneos",
      message: "clonevoice_visible requiert cloneos_visible.",
      severity: "blocking",
    });
  }

  for (const cap of employee.capabilities) {
    issues.push(...validateEmployeeContextRegistryCapability(cap).issues);
  }
  for (const fn of employee.functions) {
    issues.push(...validateEmployeeContextRegistryFunction(fn).issues);
  }

  const textBlob = [
    employee.definition,
    employee.role_title,
    ...employee.context_sources,
  ].join(" ");
  for (const f of detectUnsafeEmployeeContextRegistryText(textBlob)) {
    issues.push({
      code: "unsafe_text_detected",
      message: `Texte interdit détecté : ${f}`,
      severity: "blocking",
    });
  }

  return { valid: issues.filter((i) => i.severity === "blocking").length === 0, issues };
}

// ── Validation registry ───────────────────────────────────────────────────────

export function validateEmployeeContextRegistry(
  registry: EmployeeContextRegistry
): { valid: boolean; issues: EmployeeContextRegistryIssue[] } {
  const issues: EmployeeContextRegistryIssue[] = [];

  if (registry.execution_enabled) {
    issues.push({
      code: "registry_execution_enabled",
      message: "execution_enabled doit être false (design-only).",
      severity: "blocking",
    });
  }
  if (registry.read_only !== true) {
    issues.push({
      code: "registry_not_read_only",
      message: "read_only doit être true.",
      severity: "blocking",
    });
  }

  for (const emp of registry.employees) {
    issues.push(...validateEmployeeContextRegistryEmployee(emp).issues);
  }

  issues.push(...assertEmployeeContextRegistryNoSecrets(registry).issues);

  return { valid: issues.filter((i) => i.severity === "blocking").length === 0, issues };
}

// ── Sanitization ──────────────────────────────────────────────────────────────

export function sanitizeEmployeeContextRegistry(
  registry: EmployeeContextRegistry
): EmployeeContextRegistry {
  return {
    ...registry,
    read_only: true,
    execution_enabled: false,
    employees: registry.employees.map((emp) => ({
      ...emp,
      employee_key: normalizeEmployeeContextRegistryKey(emp.employee_key),
      capabilities: emp.capabilities.map((c) => ({
        ...c,
        execution_enabled: false,
      })),
      functions: emp.functions.map((f) => ({
        ...f,
        execution_enabled: false,
      })),
      // clonevoice_visible ne peut pas être true sans cloneos_visible
      clonevoice_visible: emp.clonevoice_visible && emp.cloneos_visible,
    })),
  };
}
