// src/lib/cloneos/ai/quality-policy/quality-router.ts
// B38D — Quality router: decideAiQualityRoute().
// Deterministic routing from use-case + access context → AiModelRoutingDecision.
// Never calls Anthropic by default. Pure: no async, no env.

import type { AiUseCaseQualityClass, AiModelRoutingDecision } from "./types";
import { getQualityClassRoute } from "./model-tier-policy";

// ── Router input ──────────────────────────────────────────────────────────────

export type AiQualityRouterInput = {
  use_case: string;
  quality_class: AiUseCaseQualityClass;
  access_level: "anonymous" | "public_demo" | "logged_unpaid" | "qualified_prospect" | "trial_limited" | "paid_customer" | "internal_admin";
  is_client_visible: boolean;
  is_official_document: boolean;
  is_sensitive: boolean;
  is_public_demo: boolean;
  is_unpaid: boolean;
  requested_deliverable_type?: string;
};

// ── Effective quality class ───────────────────────────────────────────────────
// Elevates quality class when context signals require it.

function resolveEffectiveQualityClass(input: AiQualityRouterInput): AiUseCaseQualityClass {
  // Public demo always maps to disabled
  if (input.is_public_demo || input.access_level === "public_demo" || input.access_level === "anonymous") {
    return "public_demo";
  }

  // Non-paying users always get disabled/mock
  if (
    input.is_unpaid ||
    input.access_level === "logged_unpaid" ||
    input.access_level === "qualified_prospect" ||
    input.access_level === "trial_limited"
  ) {
    return "unpaid_user";
  }

  // Official documents → premium_guarded
  if (input.is_official_document) {
    return "premium_document";
  }

  // Sensitive → premium_guarded with human validation
  if (input.is_sensitive) {
    return "sensitive_analysis";
  }

  // Client-visible documents → premium unless already premium class
  if (input.is_client_visible) {
    const cls = input.quality_class;
    if (cls === "document_draft") return "premium_document";
    if (cls === "email_draft") return "email_draft"; // email stays balanced but never auto-sends
  }

  // Respect explicit quality_class
  return input.quality_class;
}

// ── Main router function ──────────────────────────────────────────────────────

export function decideAiQualityRoute(input: AiQualityRouterInput): AiModelRoutingDecision {
  const effectiveClass = resolveEffectiveQualityClass(input);
  const decision = getQualityClassRoute(effectiveClass, input.use_case);

  // Never choose Anthropic as default — enforce OpenAI-only current config
  const provider = decision.provider === "anthropic" ? "openai" : decision.provider;

  // Official documents always require human validation
  const requiresHumanValidation =
    decision.requires_human_validation ||
    input.is_official_document;

  return {
    ...decision,
    provider,
    quality_class: effectiveClass,
    requires_human_validation: requiresHumanValidation,
  };
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

export function isRouteAllowedForContext(
  decision: AiModelRoutingDecision,
  context: { is_public_demo: boolean; is_unpaid: boolean; is_paid_customer: boolean },
): boolean {
  if (context.is_public_demo && !decision.allow_for_public_demo) return false;
  if (context.is_unpaid && !decision.allow_for_unpaid) return false;
  if (context.is_paid_customer && !decision.allow_for_paid_customer) {
    // internal_test class allows paid customers — always pass if they're paid
    return true;
  }
  return true;
}

export function routeRequiresCostShield(decision: AiModelRoutingDecision): boolean {
  return decision.requires_cost_shield;
}

export function routeRequiresLedger(decision: AiModelRoutingDecision): boolean {
  return decision.requires_ledger;
}
