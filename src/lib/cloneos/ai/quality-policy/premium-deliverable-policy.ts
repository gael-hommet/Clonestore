// src/lib/cloneos/ai/quality-policy/premium-deliverable-policy.ts
// B38D — Premium deliverable policy rules.
// Answers: which use-cases require premium tier, and what are their guard conditions.
// Pure: no async, no env.

import type { AiUseCaseQualityClass, AiModelTier } from "./types";

// ── Premium guard conditions ──────────────────────────────────────────────────

export type PremiumDeliverableGuard = {
  quality_class: AiUseCaseQualityClass;
  minimum_tier: AiModelTier;
  blocks_public_demo: boolean;
  blocks_unpaid: boolean;
  requires_paid_customer: boolean;
  requires_cost_shield: boolean;
  requires_ledger: boolean;
  requires_human_validation: boolean;
  anthropic_candidate_when_available: boolean;
  notes: string;
};

// ── Guard table ───────────────────────────────────────────────────────────────

const PREMIUM_GUARDS: Record<string, PremiumDeliverableGuard> = {

  pdf_deliverable: {
    quality_class: "pdf_deliverable",
    minimum_tier: "premium_guarded",
    blocks_public_demo: true,
    blocks_unpaid: true,
    requires_paid_customer: true,
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    anthropic_candidate_when_available: true,
    notes: "PDF exports require no raw markdown, style kit B45, premium guarded",
  },

  premium_document: {
    quality_class: "premium_document",
    minimum_tier: "premium_guarded",
    blocks_public_demo: true,
    blocks_unpaid: true,
    requires_paid_customer: true,
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: false,
    anthropic_candidate_when_available: true,
    notes: "Premium documents require client-visible quality and style kit via B45",
  },

  executive_report: {
    quality_class: "executive_report",
    minimum_tier: "premium_guarded",
    blocks_public_demo: true,
    blocks_unpaid: true,
    requires_paid_customer: true,
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: true,
    anthropic_candidate_when_available: true,
    notes: "Executive reports require human validation before delivery",
  },

  sensitive_analysis: {
    quality_class: "sensitive_analysis",
    minimum_tier: "premium_guarded",
    blocks_public_demo: true,
    blocks_unpaid: true,
    requires_paid_customer: true,
    requires_cost_shield: true,
    requires_ledger: true,
    requires_human_validation: true,
    anthropic_candidate_when_available: true,
    notes: "Sensitive analysis must never produce autonomous decisions",
  },
};

// ── Inferred guards (non-premium classes that still block non-paying) ─────────

const NON_PREMIUM_BLOCKED_FOR_UNPAID: AiUseCaseQualityClass[] = [
  "orchestration",
  "status_update",
  "task_planning",
  "context_summary",
  "hr_analysis",
  "email_draft",
  "document_draft",
  "internal_test",
];

// ── Public API ────────────────────────────────────────────────────────────────

export function getPremiumGuard(qualityClass: AiUseCaseQualityClass): PremiumDeliverableGuard | null {
  return PREMIUM_GUARDS[qualityClass] ?? null;
}

export function isPremiumGuardedClass(qualityClass: AiUseCaseQualityClass): boolean {
  return qualityClass in PREMIUM_GUARDS;
}

export function isBlockedForUnpaid(qualityClass: AiUseCaseQualityClass): boolean {
  if (qualityClass === "public_demo") return false;
  if (qualityClass === "unpaid_user") return false;
  const guard = PREMIUM_GUARDS[qualityClass];
  if (guard) return guard.blocks_unpaid;
  return NON_PREMIUM_BLOCKED_FOR_UNPAID.includes(qualityClass);
}

export function isBlockedForPublicDemo(qualityClass: AiUseCaseQualityClass): boolean {
  if (qualityClass === "public_demo") return false;
  const guard = PREMIUM_GUARDS[qualityClass];
  if (guard) return guard.blocks_public_demo;
  // All non-demo real AI classes block public demo
  return qualityClass !== "unpaid_user";
}

export function listPremiumGuardedClasses(): AiUseCaseQualityClass[] {
  return Object.keys(PREMIUM_GUARDS) as AiUseCaseQualityClass[];
}

export function isAnthropicCandidateWhenAvailable(qualityClass: AiUseCaseQualityClass): boolean {
  return PREMIUM_GUARDS[qualityClass]?.anthropic_candidate_when_available ?? false;
}
