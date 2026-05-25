// src/lib/cloneos/ai/quality-policy/model-tier-policy.ts
// B38D — Deterministic model tier table.
// Maps AiUseCaseQualityClass → provider/tier/costs.
// OpenAI-only current config. Anthropic deferred (disabled, not blocking).
// Pure: no async, no env reads, no side effects.

import type { AiModelTier, AiUseCaseQualityClass, AiModelRoutingDecision } from "./types";

// ── Tier → model profile mapping ─────────────────────────────────────────────

export const TIER_MODEL_PROFILES: Record<AiModelTier, string> = {
  economy:          "micro_task",         // GPT mini — gpt-4.1-mini
  balanced:         "structured_reasoning",// GPT fort — gpt-4.1
  premium:          "orchestration",      // GPT fort — gpt-4.1 (Anthropic later)
  premium_guarded:  "premium_generation", // GPT fort + shield + ledger + validation
  disabled:         "mock",
};

// ── Max cost per tier (cents) ─────────────────────────────────────────────────

export const TIER_MAX_COST_CENTS: Record<AiModelTier, number> = {
  economy:          5,
  balanced:         20,
  premium:          50,
  premium_guarded:  100,
  disabled:         0,
};

// ── Quality class → routing decision ─────────────────────────────────────────

const QUALITY_CLASS_ROUTES: Record<AiUseCaseQualityClass, Omit<AiModelRoutingDecision, "use_case">> = {

  // ── 0€ — public demo / unpaid ─────────────────────────────────────────────

  public_demo: {
    quality_class: "public_demo",
    model_tier: "disabled",
    provider: "static",
    model_profile: "mock",
    requires_cost_shield: false,
    requires_ledger: false,
    requires_human_validation: false,
    allow_for_public_demo: true,
    allow_for_unpaid: false,
    allow_for_paid_customer: false,
    max_estimated_cost_cents: 0,
    reason: "Public demo — static content only, 0€ AI",
    future_provider_candidates: [],
  },

  unpaid_user: {
    quality_class: "unpaid_user",
    model_tier: "disabled",
    provider: "mock",
    model_profile: "mock",
    requires_cost_shield: true,
    requires_ledger: false,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: true,
    allow_for_paid_customer: false,
    max_estimated_cost_cents: 0,
    reason: "Non-paying user — mock provider only, 0€ AI",
    future_provider_candidates: [],
  },

  // ── Economy — orchestration / micro-tâches ─────────────────────────────────

  orchestration: {
    quality_class: "orchestration",
    model_tier: "economy",
    provider: "openai",
    model_profile: "micro_task",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 5,
    reason: "Orchestration — GPT mini, economy tier",
    future_provider_candidates: [],
  },

  status_update: {
    quality_class: "status_update",
    model_tier: "economy",
    provider: "openai",
    model_profile: "micro_task",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 3,
    reason: "Status update — GPT mini, cheap & fast",
    future_provider_candidates: [],
  },

  task_planning: {
    quality_class: "task_planning",
    model_tier: "economy",
    provider: "openai",
    model_profile: "micro_task",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 5,
    reason: "Task planning — GPT mini, economy tier",
    future_provider_candidates: [],
  },

  context_summary: {
    quality_class: "context_summary",
    model_tier: "economy",
    provider: "openai",
    model_profile: "micro_task",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 5,
    reason: "Context summary — GPT mini, internal only",
    future_provider_candidates: [],
  },

  internal_test: {
    quality_class: "internal_test",
    model_tier: "premium_guarded",
    provider: "openai",
    model_profile: "orchestration",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 100,
    reason: "Internal test / B38B validation — premium guarded access",
    future_provider_candidates: [],
  },

  // ── Balanced — analyse RH / drafts ────────────────────────────────────────

  hr_analysis: {
    quality_class: "hr_analysis",
    model_tier: "balanced",
    provider: "openai",
    model_profile: "structured_reasoning",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 20,
    reason: "HR analysis — GPT fort, balanced tier",
    future_provider_candidates: ["anthropic"],
  },

  email_draft: {
    quality_class: "email_draft",
    model_tier: "balanced",
    provider: "openai",
    model_profile: "structured_reasoning",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 15,
    reason: "Email draft — GPT fort, balanced, never auto-send",
    future_provider_candidates: ["anthropic"],
  },

  document_draft: {
    quality_class: "document_draft",
    model_tier: "balanced",
    provider: "openai",
    model_profile: "structured_reasoning",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 20,
    reason: "Document draft — GPT fort, internal draft quality",
    future_provider_candidates: ["anthropic"],
  },

  // ── Premium guarded — livrables visibles / sensibles ─────────────────────

  sensitive_analysis: {
    quality_class: "sensitive_analysis",
    model_tier: "premium_guarded",
    provider: "openai",
    model_profile: "orchestration",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: true,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 50,
    reason: "Sensitive analysis — premium guarded, human validation required",
    future_provider_candidates: ["anthropic"],
  },

  premium_document: {
    quality_class: "premium_document",
    model_tier: "premium_guarded",
    provider: "openai",
    model_profile: "orchestration",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 50,
    reason: "Premium document — client-visible, premium guarded, style kit via B45",
    future_provider_candidates: ["anthropic"],
  },

  pdf_deliverable: {
    quality_class: "pdf_deliverable",
    model_tier: "premium_guarded",
    provider: "openai",
    model_profile: "orchestration",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 80,
    reason: "PDF deliverable — premium guarded, no raw markdown, style kit B45",
    future_provider_candidates: ["anthropic"],
  },

  executive_report: {
    quality_class: "executive_report",
    model_tier: "premium_guarded",
    provider: "openai",
    model_profile: "orchestration",
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: true,
    allow_for_public_demo: false,
    allow_for_unpaid: false,
    allow_for_paid_customer: true,
    max_estimated_cost_cents: 100,
    reason: "Executive report — premium guarded, dirigeant-level quality, human validation",
    future_provider_candidates: ["anthropic"],
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getQualityClassRoute(
  qualityClass: AiUseCaseQualityClass,
  useCase: string = qualityClass,
): AiModelRoutingDecision {
  const route = QUALITY_CLASS_ROUTES[qualityClass];
  return { ...route, use_case: useCase };
}

export function getModelTierForQualityClass(qualityClass: AiUseCaseQualityClass): AiModelTier {
  return QUALITY_CLASS_ROUTES[qualityClass].model_tier;
}

export function getMaxCostCentsForTier(tier: AiModelTier): number {
  return TIER_MAX_COST_CENTS[tier];
}

export function isAnthropicCurrentlyDefault(_qualityClass: AiUseCaseQualityClass): false {
  // Anthropic is deferred. OpenAI is the current default for all classes.
  // Do NOT change this until B38B+ validates Anthropic live + budget is allocated.
  return false;
}

export function listAllQualityClasses(): AiUseCaseQualityClass[] {
  return Object.keys(QUALITY_CLASS_ROUTES) as AiUseCaseQualityClass[];
}
