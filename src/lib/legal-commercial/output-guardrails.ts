// B47 — Output Legal/Commercial Guardrails
// Evaluates and enforces legal safety on any Pierre output.
// Pure: no Supabase, no Next, no async. No throw.

import type { OutputContext, OutputGuardrailResult, ClaimDecision, LegalRiskLevel } from "./types";
import { findForbiddenPhrases } from "./forbidden-phrases";
import { getMissingRequiredDisclaimers, injectRequiredDisclaimers } from "./disclaimers";
import { evaluateCommercialClaim } from "./claims-policy";

// ── Context defaults ──────────────────────────────────────────────────────────

export function buildDefaultOutputContext(overrides?: Partial<OutputContext>): OutputContext {
  return {
    surface: "cockpit",
    domain: "general",
    is_sensitive: false,
    is_official_document: false,
    is_public_claim: false,
    is_demo: false,
    is_paid_customer: false,
    ...overrides,
  };
}

// ── Requires human validation ─────────────────────────────────────────────────

export function requireHumanValidationForContext(context: OutputContext): boolean {
  if (context.is_official_document) return true;
  if (context.is_sensitive) return true;
  if (context.domain === "payroll") return true;
  if (context.domain === "legal") return true;
  if (context.surface === "email" && context.is_sensitive) return true;
  return false;
}

// ── Risk from context ─────────────────────────────────────────────────────────

function contextualRisk(context: OutputContext): LegalRiskLevel {
  if (context.is_official_document) return "high";
  if (context.domain === "payroll" || context.domain === "legal") return "high";
  if (context.is_sensitive) return "medium";
  if (context.surface === "marketing" && context.is_public_claim) return "medium";
  if (context.is_demo && !context.is_paid_customer) return "low";
  return "none";
}

// ── Evaluate output ───────────────────────────────────────────────────────────

export function evaluateOutputLegalCommercialSafety(
  text: string,
  context: Partial<OutputContext>,
): OutputGuardrailResult {
  const ctx = buildDefaultOutputContext(context);
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Forbidden phrases
  const forbidden_phrases_found = findForbiddenPhrases(text);
  if (forbidden_phrases_found.length > 0) {
    errors.push(`Phrases interdites détectées : ${forbidden_phrases_found.join(", ")}`);
  }

  // 2. Claim evaluation (for public/marketing surfaces)
  let claimDecision: ClaimDecision = "allowed";
  if (ctx.surface === "marketing" || ctx.is_public_claim) {
    const eval_ = evaluateCommercialClaim(text);
    if (eval_.decision === "forbidden") {
      claimDecision = "forbidden";
      errors.push(eval_.reason ?? "Claim commercial interdit détecté.");
    } else if (eval_.decision === "needs_human_review") {
      claimDecision = "needs_human_review";
      warnings.push("Ce contenu nécessite une revue humaine avant publication.");
    } else if (eval_.decision === "allowed_with_disclaimer") {
      claimDecision = "allowed_with_disclaimer";
      warnings.push("Ce contenu nécessite un disclaimer.");
    }
  }

  // 3. Missing disclaimers
  const missing_required_disclaimers = getMissingRequiredDisclaimers(text, {
    surface: ctx.surface,
    domain: ctx.domain,
    is_sensitive: ctx.is_sensitive,
    is_official_document: ctx.is_official_document,
    is_demo: ctx.is_demo,
  });
  if (missing_required_disclaimers.length > 0) {
    warnings.push(`Disclaimers manquants : ${missing_required_disclaimers.join(", ")}`);
  }

  // 4. Official doc without validation
  if (ctx.is_official_document) {
    warnings.push("Document officiel : validation humaine obligatoire avant usage.");
  }

  // 5. Demo enforcement
  if (ctx.is_demo) {
    const demoForbidden = ["envoi", "email réel", "document officiel", "action réelle"];
    for (const f of demoForbidden) {
      if (text.toLowerCase().includes(f)) {
        errors.push(`Action réelle détectée en mode démo : "${f}"`);
        claimDecision = "forbidden";
      }
    }
  }

  // 6. Non-payant access to paid features
  if (!ctx.is_paid_customer && ctx.surface !== "demo") {
    if (text.toLowerCase().includes("mission réelle") || text.toLowerCase().includes("envoi réel")) {
      warnings.push("Fonctionnalité réelle accessible aux clients payants uniquement.");
    }
  }

  const risk_level: LegalRiskLevel =
    errors.length > 0 ? "critical" :
    claimDecision === "needs_human_review" ? "high" :
    contextualRisk(ctx);

  const ok = errors.length === 0 && forbidden_phrases_found.length === 0;
  const decision: ClaimDecision =
    forbidden_phrases_found.length > 0 || claimDecision === "forbidden" ? "forbidden" :
    claimDecision === "needs_human_review" ? "needs_human_review" :
    missing_required_disclaimers.length > 0 ? "allowed_with_disclaimer" :
    claimDecision;

  return {
    ok,
    decision,
    risk_level,
    forbidden_phrases_found,
    missing_required_disclaimers,
    required_human_validation: requireHumanValidationForContext(ctx),
    safe_rewrite: ok ? null : buildSafeOutputRewrite(text, { forbidden_phrases_found, missing_required_disclaimers }),
    warnings,
    errors,
  };
}

// ── Enforce (throws-safe, returns result) ─────────────────────────────────────

export function enforceOutputGuardrails(
  text: string,
  context: Partial<OutputContext>,
): OutputGuardrailResult {
  return evaluateOutputLegalCommercialSafety(text, context);
}

// ── Safe rewrite ─────────────────────────────────────────────────────────────

export function buildSafeOutputRewrite(
  text: string,
  issues: { forbidden_phrases_found: string[]; missing_required_disclaimers: string[] },
): string {
  let result = text;

  // Strip forbidden phrases (basic replacement)
  for (const phrase of issues.forbidden_phrases_found) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(re, "[⚠️ formulation révisée]");
  }

  // Inject missing disclaimer stubs
  if (issues.missing_required_disclaimers.length > 0) {
    result += `\n\n[Note : ${issues.missing_required_disclaimers.join(", ")} requis]`;
  }

  return result;
}
