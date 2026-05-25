// src/lib/cloneos/ai/cost-shield/decision.ts
// B38A — Core decision engine. Pure, deterministic, no async, no DB.
// evaluateAiCostShield() is the single source of truth for allow/block decisions.

import type {
  AiCostShieldRequest,
  AiCostShieldDecision,
  AiCostShieldDecisionStatus,
  AiCostShieldProvider,
  AiBudgetSnapshot,
  AiCostShieldContext,
} from "./types";
import { getAiCostShieldConfig } from "./config";
import { getAccessLevelPolicy, evaluateProviderPolicy, isPremiumModelAllowed } from "./policy";
import { resolveRequestCostEstimate } from "./estimator";
import { isPremiumModel } from "./pricing";

// ── Decision builder helpers ──────────────────────────────────────────────────

function block(
  status: AiCostShieldDecisionStatus,
  reason: string,
  userMessage: string,
  request: AiCostShieldRequest,
  estimatedCents: number,
): AiCostShieldDecision {
  const isStaticDemo = status === "allow_static_demo";
  const isMockOnly =
    status === "allow_mock_only" ||
    status === "block_not_paid" ||
    status === "block_budget_exceeded" ||
    status === "block_global_cap";

  return {
    status,
    allowed: status === "allow" || status === "allow_mock_only",
    runtime_mode: getAiCostShieldConfig().shield_mode,
    provider: "mock" as AiCostShieldProvider,
    model: "mock",
    estimated_cost_cents: estimatedCents,
    remaining_budget_cents: 0,
    reason,
    user_message: userMessage,
    internal_code: status,
    should_log: true,
    fallback_to_mock: isMockOnly && !isStaticDemo,
    fallback_to_static_demo: isStaticDemo,
    requires_approval: status === "require_human_approval",
  };
}

function allow(
  provider: AiCostShieldProvider,
  model: string,
  estimatedCents: number,
  remainingCents: number,
): AiCostShieldDecision {
  return {
    status: "allow",
    allowed: true,
    runtime_mode: getAiCostShieldConfig().shield_mode,
    provider,
    model,
    estimated_cost_cents: estimatedCents,
    remaining_budget_cents: remainingCents,
    reason: "Accès autorisé — budget OK, provider autorisé.",
    user_message: "",
    internal_code: "allow",
    should_log: false,
    fallback_to_mock: false,
    fallback_to_static_demo: false,
    requires_approval: false,
  };
}

// ── Budget snapshot check ─────────────────────────────────────────────────────

function checkBudgetSnapshots(
  snapshots: AiBudgetSnapshot[],
  estimatedCents: number,
): { exceeded: boolean; snapshot: AiBudgetSnapshot | null } {
  for (const snap of snapshots) {
    if (snap.exceeded || estimatedCents > snap.remaining_cents) {
      return { exceeded: true, snapshot: snap };
    }
  }
  return { exceeded: false, snapshot: null };
}

// ── Main decision function ────────────────────────────────────────────────────

export function evaluateAiCostShield(
  request: AiCostShieldRequest,
  context: AiCostShieldContext = {},
): AiCostShieldDecision {
  const cfg = context.shield_mode
    ? { ...getAiCostShieldConfig(), shield_mode: context.shield_mode }
    : getAiCostShieldConfig();

  // Override: explicit allow from caller (internal testing only)
  if (context.override_allow === true) {
    return allow(request.provider, request.model, 0, Infinity);
  }

  const estimatedCents = resolveRequestCostEstimate(
    request.provider,
    request.model,
    request.input_token_estimate,
    request.max_output_tokens,
    request.estimated_cost_cents,
  );

  // ── 1. Disabled mode — no enforcement ─────────────────────────────────────
  if (cfg.shield_mode === "disabled") {
    return allow(request.provider, request.model, estimatedCents, Infinity);
  }

  // ── 2. Emergency shutdown — blocks everything ──────────────────────────────
  if (cfg.emergency_shutdown) {
    return block(
      "block_emergency_shutdown",
      "Emergency shutdown active — all AI calls blocked.",
      "Le service IA est temporairement suspendu. Veuillez réessayer dans quelques minutes.",
      request,
      estimatedCents,
    );
  }

  // ── 3. Provider policy check ───────────────────────────────────────────────
  const providerCheck = evaluateProviderPolicy(request.provider, request.model, cfg);
  if (!providerCheck.allowed) {
    return block(
      providerCheck.status!,
      `Provider blocked: ${request.provider}`,
      providerCheck.user_message ?? "Provider non disponible.",
      request,
      estimatedCents,
    );
  }

  // ── 4. Access level policy ─────────────────────────────────────────────────
  const accessPolicy = getAccessLevelPolicy(request.access_level, cfg);

  // Static demo path for anonymous/public_demo
  if (
    request.access_level === "anonymous" ||
    (request.access_level === "public_demo" && !cfg.public_demo_allow_real_calls)
  ) {
    if (cfg.shield_mode === "observe") {
      // Observe: don't block but mark as static demo
      return {
        ...block(
          "allow_static_demo",
          `Observe mode: would serve static demo for ${request.access_level}`,
          accessPolicy.user_message_if_blocked,
          request,
          0,
        ),
        allowed: true,
      };
    }
    return block(
      "allow_static_demo",
      `Access level "${request.access_level}" → static demo only.`,
      accessPolicy.user_message_if_blocked,
      request,
      0,
    );
  }

  // Non-paying users: block real AI (mock provider does not bypass access policy)
  if (!accessPolicy.allow_real_ai) {
    if (cfg.shield_mode === "observe") {
      return {
        ...block(
          "allow_mock_only",
          `Observe mode: would block real AI for ${request.access_level}`,
          accessPolicy.user_message_if_blocked,
          request,
          estimatedCents,
        ),
        allowed: true,
      };
    }
    return block(
      "block_not_paid",
      `Access level "${request.access_level}" does not allow real AI calls.`,
      accessPolicy.user_message_if_blocked,
      request,
      estimatedCents,
    );
  }

  // ── 5. Company ID required for paid customers ──────────────────────────────
  if (accessPolicy.requires_company_id && !request.company_id) {
    return block(
      "block_invalid_context",
      "company_id is required for paid_customer access but was not provided.",
      "Contexte entreprise manquant. Vérifiez votre compte.",
      request,
      estimatedCents,
    );
  }

  // ── 6. Premium model guard ─────────────────────────────────────────────────
  const modelIsPremium = isPremiumModel(request.provider, request.model);
  if (modelIsPremium && !isPremiumModelAllowed(request.access_level, cfg)) {
    return block(
      "block_model_disabled",
      `Premium model "${request.model}" is not available for access level "${request.access_level}".`,
      "Ce modèle premium est réservé aux clients abonnés avec budget premium activé.",
      request,
      estimatedCents,
    );
  }

  // ── 7. Budget snapshots (cumulative caps) ──────────────────────────────────
  if (context.budget_snapshots && context.budget_snapshots.length > 0) {
    const { exceeded, snapshot } = checkBudgetSnapshots(context.budget_snapshots, estimatedCents);
    if (exceeded && snapshot) {
      const isGlobal =
        snapshot.scope === "global_daily" || snapshot.scope === "global_monthly";
      const status: AiCostShieldDecisionStatus = isGlobal
        ? "block_global_cap"
        : "block_budget_exceeded";

      const accessLevelPol = getAccessLevelPolicy(request.access_level, cfg);
      if (cfg.shield_mode === "observe") {
        return {
          ...block(
            status,
            `Observe mode: budget exceeded for scope ${snapshot.scope}`,
            accessLevelPol.user_message_if_blocked,
            request,
            estimatedCents,
          ),
          allowed: true,
          remaining_budget_cents: snapshot.remaining_cents,
        };
      }
      return {
        ...block(
          status,
          `Budget exceeded for scope "${snapshot.scope}". Used: ${(snapshot.max_cents - snapshot.remaining_cents).toFixed(2)}¢ / ${snapshot.max_cents.toFixed(2)}¢.`,
          accessLevelPol.user_message_if_blocked,
          request,
          estimatedCents,
        ),
        remaining_budget_cents: snapshot.remaining_cents,
      };
    }
  }

  // ── 8. All checks passed — allow ──────────────────────────────────────────
  const remainingCents =
    context.budget_snapshots?.length
      ? Math.min(...context.budget_snapshots.map((s) => s.remaining_cents))
      : Infinity;

  return allow(request.provider, request.model, estimatedCents, remainingCents);
}
