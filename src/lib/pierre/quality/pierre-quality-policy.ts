// src/lib/pierre/quality/pierre-quality-policy.ts
// B38D — Pierre quality policy: maps Pierre use-cases to quality classes.
// Integration layer between B32 use-cases and B38D quality routing.
// Pure: no async, no env.

import type { AiUseCaseQualityClass } from "../../cloneos/ai/quality-policy/types";
import type { CloneAIUseCase } from "../../cloneos/ai/types";
import { decideAiQualityRoute, type AiQualityRouterInput } from "../../cloneos/ai/quality-policy/quality-router";

// ── Pierre use-case → quality class mapping ───────────────────────────────────

const PIERRE_USE_CASE_QUALITY_CLASS: Record<string, AiUseCaseQualityClass> = {
  // ── Orchestration / planning (economy) ────────────────────────────────────
  "pierre.brain.missing_info":          "orchestration",
  "pierre.brain.answer":                "orchestration",
  "pierre.brain.risk_review":           "orchestration",
  "pierre.brain.quality_gate":          "status_update",
  "platform.routing.classify":          "orchestration",
  "platform.generic.structured":        "status_update",

  // ── Task planning (economy) ───────────────────────────────────────────────
  "pierre.tasks.plan":                  "task_planning",
  "pierre.brain.task_plan":             "task_planning",

  // ── HR analysis (balanced) ────────────────────────────────────────────────
  "pierre.mission.interpret":           "hr_analysis",
  "pierre.brain.final_interpret":       "hr_analysis",
  "pierre.employee_file.summarize":     "hr_analysis",
  "pierre.customer_success.summarize":  "hr_analysis",
  "pierre.document.review":            "hr_analysis",

  // ── Document drafts (balanced → client-visible elevates) ──────────────────
  "pierre.document.draft":             "document_draft",
  "pierre.document.generate":          "premium_document",
  "pierre.hr_letter.generate":         "premium_document",
  "pierre.client_fiche.generate":      "premium_document",
  "pierre.spreadsheet.generate":       "document_draft",

  // ── Premium / PDF (premium_guarded) ──────────────────────────────────────
  "pierre.pdf.generate":               "pdf_deliverable",
  "pierre.final_report.generate":      "executive_report",

  // ── Sensitive (premium_guarded + human validation) ────────────────────────
  "pierre.risk.precheck":              "hr_analysis",
  "pierre.risk.sensitive":             "sensitive_analysis",

  // ── Demo (0€ static) ──────────────────────────────────────────────────────
  "platform.chat.answer":              "public_demo",
};

// ── Access level helper ───────────────────────────────────────────────────────

function isPaidLevel(
  level: string,
): level is "paid_customer" | "internal_admin" {
  return level === "paid_customer" || level === "internal_admin";
}

function isUnpaidLevel(level: string): boolean {
  return ["anonymous", "logged_unpaid", "qualified_prospect", "trial_limited"].includes(level);
}

// ── Main function ─────────────────────────────────────────────────────────────

export function getPierreQualityClass(useCase: string): AiUseCaseQualityClass {
  return PIERRE_USE_CASE_QUALITY_CLASS[useCase] ?? "hr_analysis";
}

export function decidePierreAiRoute(params: {
  useCase: CloneAIUseCase | string;
  accessLevel: string;
  isClientVisible?: boolean;
  isOfficialDocument?: boolean;
  isSensitive?: boolean;
  isPublicDemo?: boolean;
}) {
  const qualityClass = getPierreQualityClass(params.useCase);

  const routerInput: AiQualityRouterInput = {
    use_case: params.useCase,
    quality_class: qualityClass,
    access_level: params.accessLevel as AiQualityRouterInput["access_level"],
    is_client_visible: params.isClientVisible ?? false,
    is_official_document: params.isOfficialDocument ?? false,
    is_sensitive: params.isSensitive ?? false,
    is_public_demo: params.isPublicDemo ?? (params.accessLevel === "public_demo"),
    is_unpaid: isUnpaidLevel(params.accessLevel),
  };

  return decideAiQualityRoute(routerInput);
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

export function pierreUseCaseRequiresPremium(useCase: string): boolean {
  const cls = getPierreQualityClass(useCase);
  return cls === "premium_document" || cls === "pdf_deliverable" || cls === "executive_report" || cls === "sensitive_analysis";
}

export function pierreUseCaseRequiresHumanValidation(useCase: string): boolean {
  const cls = getPierreQualityClass(useCase);
  return cls === "sensitive_analysis" || cls === "executive_report";
}

export function pierreUseCaseAllowedForAccessLevel(useCase: string, accessLevel: string): boolean {
  const cls = getPierreQualityClass(useCase);
  if (cls === "public_demo") return true;
  if (isUnpaidLevel(accessLevel)) return false;
  return isPaidLevel(accessLevel);
}
