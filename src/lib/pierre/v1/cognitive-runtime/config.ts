// src/lib/pierre/v1/cognitive-runtime/config.ts
// PHASE 8.14 — cognitive-runtime configuration. All model/cost/retrieval knobs are server-side and
// env-driven. The cognitive (LLM) planner is authoritative when a real model is available; without one
// (mock/disabled AI mode and no explicit opt-in) Pierre falls back to the deterministic degraded mode.

import { getAiRuntimeMode } from "../../../cloneos/ai/mode";

export const COGNITIVE_LIMITS = {
  maxContextEmployees: Number(process.env.PIERRE_COG_MAX_CTX_EMPLOYEES ?? 12),
  maxContextDocuments: Number(process.env.PIERRE_COG_MAX_CTX_DOCS ?? 12),
  maxCandidateCapabilities: Number(process.env.PIERRE_COG_MAX_CAPABILITIES ?? 16),
  maxPlanSteps: Number(process.env.PIERRE_RUNTIME_MAX_STEPS ?? 200),
  maxToolRounds: Number(process.env.PIERRE_COG_MAX_TOOL_ROUNDS ?? 6),
} as const;

/**
 * Is the LLM cognitive planner authoritative on the live path right now?
 * - true when the AI runtime is in "production" (a real server-side key is wired), OR an explicit opt-in
 *   flag is set (used by cognitive integration tests with an injected proposer).
 * - false in "mock"/"disabled" mode without opt-in → deterministic degraded mode (owner-permitted).
 * This makes the LLM the primary intelligence in production while never regressing key-less environments.
 */
export function isCognitivePlannerEnabled(): boolean {
  if (process.env.PIERRE_COGNITIVE_PLANNER === "1") return true;
  if (process.env.PIERRE_COGNITIVE_PLANNER === "0") return false;
  return getAiRuntimeMode() === "production";
}
