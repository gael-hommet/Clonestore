// src/lib/cloneos/ai/cost-shield/policy.ts
// B38A — Access-level rules. Pure, no async.
// Each AiCommercialAccessLevel has a fixed policy: what's allowed and what's not.

import type {
  AiCommercialAccessLevel,
  AiCostShieldDecisionStatus,
  AiCostShieldProvider,
} from "./types";
import type { AiCostShieldConfig } from "./config";

// ── Policy per access level ───────────────────────────────────────────────────

export type AccessLevelPolicy = {
  allow_real_ai: boolean;
  allow_mock: boolean;
  allow_static_demo: boolean;
  requires_paid: boolean;
  requires_company_id: boolean;
  max_cost_cents_per_call: number; // 0 = no real calls
  block_status: AiCostShieldDecisionStatus;
  user_message_if_blocked: string;
};

export function getAccessLevelPolicy(
  level: AiCommercialAccessLevel,
  cfg: AiCostShieldConfig,
): AccessLevelPolicy {
  switch (level) {
    case "anonymous":
      return {
        allow_real_ai: false,
        allow_mock: false,
        allow_static_demo: true,
        requires_paid: false,
        requires_company_id: false,
        max_cost_cents_per_call: 0,
        block_status: "allow_static_demo",
        user_message_if_blocked:
          "Découvrez Pierre en démo interactive — créez un compte pour accéder à l'assistant complet.",
      };

    case "public_demo":
      return {
        allow_real_ai: cfg.public_demo_allow_real_calls, // false by default
        allow_mock: true,
        allow_static_demo: true,
        requires_paid: false,
        requires_company_id: false,
        max_cost_cents_per_call: 0,
        block_status: "allow_static_demo",
        user_message_if_blocked:
          "Cette démo est interactive mais n'utilise pas l'IA en direct. Abonnez-vous pour accéder à Pierre réel.",
      };

    case "logged_unpaid":
      return {
        allow_real_ai: cfg.unpaid_allow_real_calls, // false by default
        allow_mock: true,
        allow_static_demo: false,
        requires_paid: false,
        requires_company_id: false,
        max_cost_cents_per_call: 0,
        block_status: "block_not_paid",
        user_message_if_blocked:
          "L'IA de Pierre est réservée aux clients abonnés. Activez votre abonnement pour commencer.",
      };

    case "qualified_prospect":
      return {
        allow_real_ai: false, // Sales team must explicitly enable per company
        allow_mock: true,
        allow_static_demo: true,
        requires_paid: false,
        requires_company_id: false,
        max_cost_cents_per_call: 0,
        block_status: "block_not_paid",
        user_message_if_blocked:
          "Votre accès prospectus donne droit à une démo guidée. Contactez notre équipe pour un accès complet.",
      };

    case "trial_limited":
      // No open-bar 7-day trial — blocked by default until policy changes
      return {
        allow_real_ai: cfg.trial_allow_real_calls, // false by default
        allow_mock: true,
        allow_static_demo: true,
        requires_paid: false,
        requires_company_id: false,
        max_cost_cents_per_call: 0,
        block_status: "block_not_paid",
        user_message_if_blocked:
          "La période d'essai est en cours de configuration. Contactez notre équipe pour activer Pierre.",
      };

    case "paid_customer":
      return {
        allow_real_ai: true,
        allow_mock: true,
        allow_static_demo: false,
        requires_paid: true,
        requires_company_id: true,
        max_cost_cents_per_call: cfg.company_daily_cap_cents,
        block_status: "block_budget_exceeded",
        user_message_if_blocked:
          "Le budget IA de votre compte a été atteint pour aujourd'hui. Il sera réinitialisé demain.",
      };

    case "internal_admin":
      return {
        allow_real_ai: true,
        allow_mock: true,
        allow_static_demo: false,
        requires_paid: false,
        requires_company_id: false,
        max_cost_cents_per_call: cfg.global_daily_cap_cents,
        block_status: "block_global_cap",
        user_message_if_blocked:
          "Le budget global quotidien a été atteint. Augmentez AI_GLOBAL_DAILY_CAP_CENTS pour continuer.",
      };
  }
}

// ── Provider access check ─────────────────────────────────────────────────────

export type ProviderPolicyResult = {
  allowed: boolean;
  effective_provider: AiCostShieldProvider;
  status: AiCostShieldDecisionStatus | null;
  user_message: string | null;
};

export function evaluateProviderPolicy(
  requestedProvider: AiCostShieldProvider,
  requestedModel: string,
  cfg: AiCostShieldConfig,
): ProviderPolicyResult {
  // Mock is always allowed
  if (requestedProvider === "mock") {
    return { allowed: true, effective_provider: "mock", status: null, user_message: null };
  }

  // Anthropic: disabled globally until B38B+
  if (requestedProvider === "anthropic") {
    if (!cfg.anthropic_enabled) {
      if (cfg.openai_enabled && !cfg.openai_only) {
        // Could fallback to OpenAI if configured, but for B38A we block
      }
      return {
        allowed: false,
        effective_provider: "mock",
        status: "block_provider_disabled",
        user_message: "Le provider Anthropic/Claude est désactivé. OpenAI est utilisé comme provider principal.",
      };
    }
  }

  // OpenAI: check if enabled
  if (requestedProvider === "openai" && !cfg.openai_enabled) {
    return {
      allowed: false,
      effective_provider: "mock",
      status: "block_provider_disabled",
      user_message: "Le provider OpenAI est désactivé.",
    };
  }

  // Check provider is in allowed list
  if (!cfg.allowed_providers.includes(requestedProvider)) {
    return {
      allowed: false,
      effective_provider: "mock",
      status: "block_provider_disabled",
      user_message: `Provider "${requestedProvider}" non autorisé dans cette configuration.`,
    };
  }

  return { allowed: true, effective_provider: requestedProvider, status: null, user_message: null };
}

// ── Premium model guard ───────────────────────────────────────────────────────

export function isPremiumModelAllowed(
  level: AiCommercialAccessLevel,
  cfg: AiCostShieldConfig,
): boolean {
  if (level === "paid_customer") return cfg.paid_premium_model_cap_cents > 0;
  if (level === "internal_admin") return cfg.premium_model_daily_cap_cents > 0;
  // anonymous, public_demo, logged_unpaid, qualified_prospect, trial_limited → never
  return false;
}
