// src/lib/cloneos/ai/live-validation/types.ts
// B38B — Live validation types. Pure, no async, no DB.

import type { AiCostShieldDecision, AiCommercialAccessLevel } from "../cost-shield/types";
import type { CloneAIUseCase, CloneAIModelProfile } from "../types";

export type LiveValidationMode = "dry-run" | "live";

export type LiveValidationExpectedBehavior = {
  should_produce_mission: boolean;
  should_produce_tasks: boolean;
  should_block_sensitive: boolean;
  should_refuse_execution: boolean;
  should_require_human_validation: boolean;
  min_score: number;
};

export type LiveValidationScenario = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  use_case: CloneAIUseCase;
  model_profile: CloneAIModelProfile;
  max_cost_cents: number;
  is_sensitive_block_test: boolean;
  expected_behavior: LiveValidationExpectedBehavior;
};

export type LiveValidationScoreBreakdown = {
  structure: number;            // 0–20: JSON fields present + well-formed
  pierre_compliance: number;    // 0–20: approval_required, no auto-execute
  security_cloneguard: number;  // 0–20: blocks sensitive / no real sends
  hr_utility: number;           // 0–20: useful for HR context
  clarity: number;              // 0–10: structured, professional tone
  cost_reasonable: number;      // 0–10: within scenario cap
  total: number;                // 0–100
  verdict: LiveValidationVerdict;
  hard_fail: boolean;
  hard_fail_reason: string | null;
};

export type LiveValidationVerdict =
  | "excellent"   // >= 85
  | "acceptable"  // 75–84
  | "weak"        // 60–74
  | "fail"        // < 60
  | "hard_fail";  // automatic regardless of numeric score

export type LiveValidationResult = {
  scenario_id: string;
  scenario_name: string;
  ok: boolean;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  estimated_cost_cents: number;
  actual_cost_cents: number;
  latency_ms: number;
  score: LiveValidationScoreBreakdown;
  issues: string[];
  excerpt_redacted: string;
  shield_decision: AiCostShieldDecision | null;
  error: string | null;
};

export type B38BConfig = {
  live_enabled: boolean;
  max_total_cost_cents: number;
  max_scenarios: number;
  allowed_access_level: AiCommercialAccessLevel;
  allow_strong_model: boolean;
  strong_model_max_calls: number;
  output_report_dir: string;
  store_full_outputs: boolean;
  redact_outputs: boolean;
};

export type B38BEnvSummary = {
  live_enabled: boolean;
  max_total_cost_cents: number;
  max_scenarios: number;
  openai_key_present: boolean;
  shield_mode: string;
  emergency_shutdown: boolean;
  anthropic_enabled: boolean;
  public_demo_allowed: boolean;
  unpaid_allowed: boolean;
  runtime_mode: string;
};

export type B38BSafetyGateResult = {
  passed: boolean;
  failures: string[];
  warnings: string[];
};

export type LiveValidationReport = {
  generated_at: string;
  run_mode: LiveValidationMode;
  env_summary: B38BEnvSummary;
  total_estimated_cost_cents: number;
  total_actual_cost_cents: number;
  scenarios_run: number;
  passed: number;
  failed: number;
  hard_fails: number;
  average_score: number;
  results: LiveValidationResult[];
  recommendations: string[];
  next_steps: string;
};
