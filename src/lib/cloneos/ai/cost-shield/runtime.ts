// src/lib/cloneos/ai/cost-shield/runtime.ts
// B38A — Shield runtime: withAiCostShield, assertAiCallAllowedOrThrow, buildBlockedAiResponse.
// This is the integration layer callers use. Pure except for the wrapped fn.

import type {
  AiCostShieldRequest,
  AiCostShieldDecision,
  AiCostShieldContext,
} from "./types";
import { evaluateAiCostShield } from "./decision";
import { AiCostShieldError } from "./errors";

// ── Blocked AI response shape (matches CloneAIResponse for easy swap) ─────────

export type BlockedAiResponse = {
  ok: false;
  provider: string;
  model_profile: string;
  content: string;
  json: null;
  usage: { input_tokens_estimated: 0; output_tokens_estimated: 0; total_tokens_estimated: 0 };
  latency_ms: 0;
  warnings: string[];
  error: string;
  shield_decision: AiCostShieldDecision;
};

export function buildBlockedAiResponse(
  decision: AiCostShieldDecision,
  useCase?: string,
): BlockedAiResponse {
  return {
    ok: false,
    provider: decision.provider,
    model_profile: "mock",
    content: "",
    json: null,
    usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
    latency_ms: 0,
    warnings: [
      `[AiCostShield] ${decision.status}: ${decision.reason}`,
      ...(useCase ? [`use_case: ${useCase}`] : []),
    ],
    error: decision.user_message || "Appel IA bloqué par le Cost Shield.",
    shield_decision: decision,
  };
}

// ── Assert helper: throws AiCostShieldError if blocked ───────────────────────

export function assertAiCallAllowedOrThrow(
  request: AiCostShieldRequest,
  context: AiCostShieldContext = {},
): AiCostShieldDecision {
  const decision = evaluateAiCostShield(request, context);
  if (!decision.allowed) {
    throw new AiCostShieldError(decision);
  }
  return decision;
}

// ── withAiCostShield: primary integration point ───────────────────────────────
//
// Usage:
//   const result = await withAiCostShield(request, context, () => runCloneAI(cloneRequest));
//
// If blocked: returns BlockedAiResponse without calling fn.
// If allowed: calls fn and returns its result.
// Never calls fn when decision.allowed === false.

export async function withAiCostShield<T>(
  request: AiCostShieldRequest,
  context: AiCostShieldContext,
  fn: () => Promise<T>,
): Promise<T | BlockedAiResponse> {
  const decision = evaluateAiCostShield(request, context);

  if (!decision.allowed) {
    return buildBlockedAiResponse(decision, request.use_case);
  }

  // Allowed — execute the wrapped AI call
  try {
    return await fn();
  } catch (err) {
    // Propagate non-shield errors normally
    throw err;
  }
}

// ── Static demo helper ────────────────────────────────────────────────────────
// Returns a zero-cost "allowed" response that signals the caller to use static content.

export type StaticDemoResponse = {
  ok: true;
  is_static_demo: true;
  content: string;
  provider: "mock";
  cost_cents: 0;
  shield_decision: AiCostShieldDecision;
};

export function buildStaticDemoResponse(
  decision: AiCostShieldDecision,
  staticContent = "",
): StaticDemoResponse {
  return {
    ok: true,
    is_static_demo: true,
    content: staticContent,
    provider: "mock",
    cost_cents: 0,
    shield_decision: decision,
  };
}

// ── Re-exports for convenience ────────────────────────────────────────────────

export { evaluateAiCostShield } from "./decision";
export { AiCostShieldError, isAiCostShieldError } from "./errors";
export type { AiCostShieldRequest, AiCostShieldDecision, AiCostShieldContext } from "./types";
