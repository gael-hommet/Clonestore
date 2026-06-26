// TECH-09 — CloneBrief Executive Summaries — Validation
// 25 règles de validation pour les briefings CloneBrief.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneBriefExecutiveSummary,
  CloneBriefGenerationInput,
  CloneBriefValidationIssue,
  CloneBriefValidationReport,
} from "./clonebrief-types";

// ── Patterns interdits ────────────────────────────────────────────────────────

const FORBIDDEN_TOKENS = [
  "sk_live_",
  "whsec_",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "password",
  "secret",
];

const FORBIDDEN_PHRASES = [
  "conformité garantie",
  "zéro erreur",
  "zero erreur",
  "public launch ready",
  "0 erreur",
];

function containsForbiddenToken(text: string): string | null {
  const lower = text.toLowerCase();
  for (const token of FORBIDDEN_TOKENS) {
    if (lower.includes(token.toLowerCase())) return token;
  }
  return null;
}

function containsForbiddenPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

// ── Validation rules ──────────────────────────────────────────────────────────

function issue(code: string, field: string, message: string, severity: "error" | "warning" | "info" = "error"): CloneBriefValidationIssue {
  return { code, field, message, severity };
}

/**
 * Valide un briefing CloneBrief avec 25 règles.
 */
export function validateCloneBrief(brief: CloneBriefExecutiveSummary): CloneBriefValidationIssue[] {
  const issues: CloneBriefValidationIssue[] = [];

  // BV01 — brief_id non vide
  if (!brief.brief_id?.trim()) {
    issues.push(issue("BV01", "brief_id", "brief_id est requis."));
  }

  // BV02 — company_id non vide
  if (!brief.company_id?.trim()) {
    issues.push(issue("BV02", "company_id", "company_id est requis."));
  }

  // BV03 — brief_type valide
  const validTypes = ["daily","weekly","monthly","mission","employee","risk","validation","incident","executive"];
  if (!validTypes.includes(brief.brief_type)) {
    issues.push(issue("BV03", "brief_type", `brief_type "${brief.brief_type}" n'est pas valide.`));
  }

  // BV04 — period présent
  if (!brief.period?.from || !brief.period?.to) {
    issues.push(issue("BV04", "period", "period.from et period.to sont requis."));
  }

  // BV05 — title non vide
  if (!brief.title?.trim()) {
    issues.push(issue("BV05", "title", "title est requis."));
  }

  // BV06 — executive_summary non vide sauf status empty
  if (!brief.executive_summary?.trim() && brief.status !== "empty") {
    issues.push(issue("BV06", "executive_summary", "executive_summary ne peut pas être vide sauf si status=empty."));
  }

  // BV07 — sections est un tableau
  if (!Array.isArray(brief.sections)) {
    issues.push(issue("BV07", "sections", "sections doit être un tableau."));
  }

  // BV08 — source_refs est un tableau
  if (!Array.isArray(brief.source_refs)) {
    issues.push(issue("BV08", "source_refs", "source_refs doit être un tableau."));
  }

  // BV09 — generated_at présent
  if (!brief.generated_at?.trim()) {
    issues.push(issue("BV09", "generated_at", "generated_at est requis."));
  }

  // BV10 — no sensitive token in summary
  const summaryToken = containsForbiddenToken(brief.executive_summary ?? "");
  if (summaryToken) {
    issues.push(issue("BV10", "executive_summary", `Donnée sensible détectée dans executive_summary: "${summaryToken}".`));
  }

  // BV11 — no sk_live_ in summary
  if ((brief.executive_summary ?? "").includes("sk_live_")) {
    issues.push(issue("BV11", "executive_summary", "sk_live_ détecté dans le résumé — donnée sensible interdite."));
  }

  // BV12 — no whsec_ in summary
  if ((brief.executive_summary ?? "").includes("whsec_")) {
    issues.push(issue("BV12", "executive_summary", "whsec_ détecté dans le résumé — donnée sensible interdite."));
  }

  // BV13 — no OPENAI_API_KEY anywhere
  const fullText = JSON.stringify(brief);
  if (fullText.includes("OPENAI_API_KEY")) {
    issues.push(issue("BV13", "brief", "OPENAI_API_KEY détecté dans le briefing — données sensibles interdites."));
  }

  // BV14 — no ANTHROPIC_API_KEY anywhere
  if (fullText.includes("ANTHROPIC_API_KEY")) {
    issues.push(issue("BV14", "brief", "ANTHROPIC_API_KEY détecté dans le briefing — données sensibles interdites."));
  }

  // BV15 — no "conformité garantie"
  const forbiddenPhrase = containsForbiddenPhrase(fullText);
  if (forbiddenPhrase) {
    issues.push(issue("BV15", "brief", `Phrase interdite détectée: "${forbiddenPhrase}".`));
  }

  // BV16 — no "zéro erreur"
  if (fullText.toLowerCase().includes("zéro erreur") || fullText.toLowerCase().includes("zero erreur")) {
    issues.push(issue("BV16", "brief", `Phrase interdite: "zéro erreur" / "zero erreur".`));
  }

  // BV17 — no "public launch ready"
  if (fullText.toLowerCase().includes("public launch ready")) {
    issues.push(issue("BV17", "brief", "Phrase interdite: 'public launch ready'."));
  }

  // BV18 — blocked items ne doivent pas être omis si blocages présents en sources
  // (validation logique uniquement — les sections blocked_actions doivent refléter la réalité)
  // Vérification: si des events ont action_blocked/action_refused mais blocked_items est vide ET sections blocked est vide
  const hasBlockedSection = Array.isArray(brief.sections) &&
    brief.sections.some((s) => s.type === "blocked_actions" && !s.is_empty);
  if (brief.blocked_items.length > 0 && !hasBlockedSection) {
    issues.push(issue("BV18", "sections", "blocked_items présents mais section blocked_actions manquante ou vide.", "warning"));
  }

  // BV19 — validation pending doit apparaître dans validation_items
  const hasValidationSection = Array.isArray(brief.sections) &&
    brief.sections.some((s) => s.type === "validations_required" && !s.is_empty);
  if (brief.validation_items.length > 0 && !hasValidationSection) {
    issues.push(issue("BV19", "sections", "validation_items présents mais section validations_required manquante ou vide.", "warning"));
  }

  // BV20 — critical risk doit apparaître dans risk_items
  const hasCriticalRisk = brief.risk_items.some((r) => r.risk_level === "critical");
  const hasRiskSection = Array.isArray(brief.sections) &&
    brief.sections.some((s) => s.type === "risks" && !s.is_empty);
  if (hasCriticalRisk && !hasRiskSection) {
    issues.push(issue("BV20", "sections", "Risques critiques présents mais section risks manquante ou vide.", "warning"));
  }

  // BV21 — pas d'employé slug inventé (slug doit être "pierre" ou "unknown" en V1)
  const knownSlugs = ["pierre", "unknown", "system", ""];
  for (const emp of brief.employee_summaries) {
    if (!knownSlugs.includes(emp.employee_slug) && !emp.employee_slug.startsWith("emp_")) {
      issues.push(issue("BV21", `employee_summaries[${emp.employee_slug}]`,
        `Employé "${emp.employee_slug}" n'est pas déclaré dans le registry en V1.`, "warning"));
    }
  }

  // BV22 — CloneVoice ne doit pas être décrit comme actif en production
  if (fullText.toLowerCase().includes("clonevoice") && fullText.toLowerCase().includes("actif en production")) {
    issues.push(issue("BV22", "brief", "CloneVoice ne peut pas être décrit comme actif en production."));
  }

  // BV23 — aucune action marquée completed si la source était blocked/refused
  for (const action of brief.action_items) {
    if (
      action.status === "completed" &&
      (action.title.toLowerCase().includes("refusé") || action.title.toLowerCase().includes("bloqué"))
    ) {
      issues.push(issue("BV23", `action_items[${action.item_id}]`,
        "Action marquée completed mais titre suggère un blocage — vérifier cohérence.", "warning"));
    }
  }

  // BV24 — no Supabase write pattern
  if (fullText.includes("supabase.from(") || fullText.includes(".insert(") || fullText.includes("service_role")) {
    issues.push(issue("BV24", "brief", "Pattern Supabase write détecté dans le briefing — interdit."));
  }

  // BV25 — no OpenAI/Anthropic call
  if (fullText.includes("openai.chat") || fullText.includes("anthropic.messages")) {
    issues.push(issue("BV25", "brief", "Appel IA détecté dans le briefing — interdit."));
  }

  return issues;
}

/**
 * Valide un input de génération CloneBrief.
 */
export function validateCloneBriefGenerationInput(
  input: CloneBriefGenerationInput,
): CloneBriefValidationIssue[] {
  const issues: CloneBriefValidationIssue[] = [];

  if (!input.company_id?.trim()) {
    issues.push(issue("BVI01", "company_id", "company_id est requis."));
  }

  const validTypes = ["daily","weekly","monthly","mission","employee","risk","validation","incident","executive"];
  if (!validTypes.includes(input.brief_type)) {
    issues.push(issue("BVI02", "brief_type", `brief_type "${input.brief_type}" n'est pas valide.`));
  }

  return issues;
}

/**
 * Génère un rapport de validation complet.
 */
export function getCloneBriefValidationReport(
  brief: CloneBriefExecutiveSummary,
): CloneBriefValidationReport {
  const allIssues = validateCloneBrief(brief);
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity !== "error");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    section_count: Array.isArray(brief.sections) ? brief.sections.length : 0,
    action_item_count: Array.isArray(brief.action_items) ? brief.action_items.length : 0,
    risk_item_count: Array.isArray(brief.risk_items) ? brief.risk_items.length : 0,
    validation_item_count: Array.isArray(brief.validation_items) ? brief.validation_items.length : 0,
    blocked_item_count: Array.isArray(brief.blocked_items) ? brief.blocked_items.length : 0,
    checked_at: new Date().toISOString(),
  };
}
