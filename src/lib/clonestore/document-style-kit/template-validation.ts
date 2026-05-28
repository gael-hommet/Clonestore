// B45 — Document template validation
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { DocumentTemplate, DocumentValidationRequirement } from "./types";
import { DEFAULT_FORBIDDEN_PHRASES } from "./defaults";

export interface TemplateValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface TemplateValidationResult {
  valid: boolean;
  issues: TemplateValidationIssue[];
  error_count: number;
  warning_count: number;
}

const OFFICIAL_VALIDATION_REQUIREMENTS: DocumentValidationRequirement[] = [
  "required",
  "required_before_send",
  "required_before_export",
  "blocked_without_human",
];

// ── Forbidden phrase check ────────────────────────────────────────────────────

export function assertTemplateHasNoForbiddenPhrases(
  template: DocumentTemplate,
  extraPhrases: string[] = [],
): string | null {
  const phrases = [...DEFAULT_FORBIDDEN_PHRASES, ...extraPhrases];
  const allContent = [
    template.label,
    template.description,
    ...template.sections.map((s) => s.content_template),
  ].join(" ");
  const lower = allContent.toLowerCase();
  for (const phrase of phrases) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

// ── Required variables check ──────────────────────────────────────────────────

export function assertTemplateHasRequiredVariables(
  template: DocumentTemplate,
): boolean {
  return template.required_variables.length > 0;
}

// ── Official template requires validation ─────────────────────────────────────

export function assertOfficialTemplateRequiresValidation(
  template: DocumentTemplate,
): boolean {
  if (!template.official_document) return true;
  return OFFICIAL_VALIDATION_REQUIREMENTS.includes(
    template.default_validation_requirement,
  );
}

// ── Validate a single template ────────────────────────────────────────────────

export function validateDocumentTemplate(
  template: unknown,
): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  if (!template || typeof template !== "object") {
    return {
      valid: false,
      issues: [{ code: "NOT_OBJECT", field: "template", message: "Template doit être un objet.", severity: "error" }],
      error_count: 1,
      warning_count: 0,
    };
  }

  const t = template as Partial<DocumentTemplate>;

  if (!t.id || typeof t.id !== "string" || !t.id.trim()) {
    issues.push({ code: "MISSING_ID", field: "id", message: "Template sans id.", severity: "error" });
  }
  if (!t.document_type || typeof t.document_type !== "string") {
    issues.push({ code: "MISSING_TYPE", field: "document_type", message: "document_type manquant.", severity: "error" });
  }
  if (!t.label || typeof t.label !== "string") {
    issues.push({ code: "MISSING_LABEL", field: "label", message: "label manquant.", severity: "error" });
  }
  if (!Array.isArray(t.required_variables) || t.required_variables.length === 0) {
    issues.push({ code: "NO_REQUIRED_VARS", field: "required_variables", message: "Template sans variables obligatoires.", severity: "error" });
  }
  if (!Array.isArray(t.sections) || t.sections.length === 0) {
    issues.push({ code: "NO_SECTIONS", field: "sections", message: "Template sans sections.", severity: "error" });
  }

  // Official document must require validation
  if (t.official_document && t.default_validation_requirement) {
    if (!OFFICIAL_VALIDATION_REQUIREMENTS.includes(t.default_validation_requirement)) {
      issues.push({
        code: "OFFICIAL_NEEDS_VALIDATION",
        field: "default_validation_requirement",
        message: "Document officiel doit avoir une validation humaine requise.",
        severity: "error",
      });
    }
  }

  // Forbidden phrases check
  if (t.id && t.label && t.sections) {
    const forbidden = assertTemplateHasNoForbiddenPhrases(t as DocumentTemplate);
    if (forbidden) {
      issues.push({
        code: "FORBIDDEN_PHRASE",
        field: "sections.content_template",
        message: `Phrase interdite détectée : "${forbidden}"`,
        severity: "error",
      });
    }
  }

  // Bracket placeholder check
  const allContent = [
    t.label ?? "",
    t.description ?? "",
    ...(t.sections ?? []).map((s) => s.content_template ?? ""),
  ].join(" ");
  const bracketPattern = /\[[A-ZÀ-Ü][^\]]{0,59}\]/;
  if (bracketPattern.test(allContent)) {
    issues.push({
      code: "UGLY_PLACEHOLDER",
      field: "sections.content_template",
      message: "Placeholder style [Votre nom] détecté — utiliser {{variable_name}}.",
      severity: "error",
    });
  }

  // Prepayroll DSN disclaimer
  if (t.category === "prepayroll" || t.document_type?.includes("prepayroll")) {
    const hasDsn = (t.sections ?? []).some(
      (s) => s.content_template.toLowerCase().includes("dsn") ||
        s.content_template.toLowerCase().includes("paie") &&
        s.content_template.toLowerCase().includes("avertissement"),
    );
    if (!hasDsn) {
      issues.push({
        code: "MISSING_PAYROLL_DISCLAIMER",
        field: "sections",
        message: "Template pré-paie sans disclaimer DSN/paie.",
        severity: "error",
      });
    }
  }

  const error_count = issues.filter((i) => i.severity === "error").length;
  const warning_count = issues.filter((i) => i.severity === "warning").length;

  return { valid: error_count === 0, issues, error_count, warning_count };
}

// ── Validate registry ─────────────────────────────────────────────────────────

export interface RegistryValidationResult {
  valid: boolean;
  template_count: number;
  ids: string[];
  duplicate_ids: string[];
  issues_by_template: Record<string, TemplateValidationIssue[]>;
  total_errors: number;
}

export function validateTemplateRegistry(
  templates: DocumentTemplate[],
): RegistryValidationResult {
  const ids: string[] = [];
  const seen = new Set<string>();
  const duplicate_ids: string[] = [];
  const issues_by_template: Record<string, TemplateValidationIssue[]> = {};
  let total_errors = 0;

  for (const t of templates) {
    const result = validateDocumentTemplate(t);
    if (result.issues.length > 0) {
      issues_by_template[t.id ?? "unknown"] = result.issues;
    }
    total_errors += result.error_count;

    if (t.id) {
      if (seen.has(t.id)) duplicate_ids.push(t.id);
      else seen.add(t.id);
      ids.push(t.id);
    }
  }

  if (duplicate_ids.length > 0) total_errors += duplicate_ids.length;

  return {
    valid: total_errors === 0 && duplicate_ids.length === 0,
    template_count: templates.length,
    ids,
    duplicate_ids,
    issues_by_template,
    total_errors,
  };
}
