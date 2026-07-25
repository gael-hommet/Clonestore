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
  return await fn();
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

// ── B38C: withAiCostShieldAndLedger ──────────────────────────────────────────
// Wraps withAiCostShield with persistent ledger recording.
// Records estimated before call, actual after success, blocked/failed on error.
// Derives ledger event input from the shield request (no duplicate params).
// The AiCostLedger is injected — never imported globally here.
// B38A tests are unaffected (they don't use this function).

import type { AiCostLedger, AiCostLedgerWriteInput } from "../cost-ledger/types";
import { redactSensitiveMetadata } from "../cost-ledger/summaries";

export async function withAiCostShieldAndLedger<T>(
  request: AiCostShieldRequest,
  context: AiCostShieldContext,
  fn: () => Promise<T>,
  ledger: AiCostLedger,
): Promise<T | BlockedAiResponse> {
  const decision = evaluateAiCostShield(request, context);

  const eventBase: AiCostLedgerWriteInput = {
    company_id: request.company_id,
    user_id: request.user_id,
    agent_slug: request.agent_slug,
    employee_slug: request.employee_slug,
    mission_id: request.mission_id,
    task_id: request.task_id,
    provider: request.provider,
    model: request.model,
    use_case: request.use_case,
    access_level: request.access_level,
    input_tokens: request.input_token_estimate,
    output_tokens: request.max_output_tokens,
    estimated_cost_cents: decision.estimated_cost_cents,
    actual_cost_cents: 0,
    is_live: true,
    is_demo: request.is_demo,
    is_public: request.is_public,
    is_paid_customer: request.is_paid_customer,
    metadata: redactSensitiveMetadata(request.metadata ?? {}),
    cost_shield_decision_status: decision.status,
  };

  if (!decision.allowed) {
    try {
      await ledger.recordBlocked(eventBase);
    } catch (e) {
      console.warn("[B38C] recordBlocked failed:", e instanceof Error ? e.message : String(e));
    }
    return buildBlockedAiResponse(decision, request.use_case);
  }

  // Record estimated before AI call
  try {
    await ledger.recordEstimated(eventBase);
  } catch (e) {
    console.warn("[B38C] recordEstimated failed:", e instanceof Error ? e.message : String(e));
  }

  try {
    const result = await fn();

    // Record actual after success
    try {
      await ledger.recordActual(eventBase);
    } catch (e) {
      console.warn("[B38C] recordActual failed:", e instanceof Error ? e.message : String(e));
    }

    return result;
  } catch (err) {
    // Record failed event on provider error
    try {
      await ledger.recordActual({ ...eventBase, actual_cost_cents: 0 });
    } catch (e) {
      console.warn("[B38C] recordActual(failed) failed:", e instanceof Error ? e.message : String(e));
    }
    throw err;
  }
}

// ── Re-exports for convenience ────────────────────────────────────────────────

export { evaluateAiCostShield } from "./decision";
export { AiCostShieldError, isAiCostShieldError } from "./errors";
export type { AiCostShieldRequest, AiCostShieldDecision, AiCostShieldContext } from "./types";
