// src/lib/cloneos/ai/types.ts
// CloneOS AI Runtime — Pure types shared across all agents (Pierre, Clara, Emma, etc.)
// No Supabase, no Next, no async, no env.

export type CloneAIProviderId =
  | "mock"
  | "openai"
  | "anthropic";

export type CloneAIModelProfile =
  | "fast_classification"
  | "structured_reasoning"
  | "long_writing"
  | "quality_review"
  | "risk_analysis"
  | "conversation"
  | "premium_generation"
  | "orchestration"
  | "micro_task";

export type CloneAIUseCase =
  | "pierre.mission.interpret"
  | "pierre.tasks.plan"
  | "pierre.document.draft"
  | "pierre.document.review"
  | "pierre.employee_file.summarize"
  | "pierre.risk.precheck"
  | "pierre.customer_success.summarize"
  | "pierre.brain.final_interpret"
  | "pierre.brain.task_plan"
  | "pierre.brain.missing_info"
  | "pierre.brain.risk_review"
  | "pierre.brain.answer"
  | "pierre.brain.quality_gate"
  | "platform.chat.answer"
  | "platform.routing.classify"
  | "platform.generic.structured"
  // ── B32: Pierre deliverable use cases (premium_generation → Opus 4.7) ────────
  | "pierre.document.generate"
  | "pierre.pdf.generate"
  | "pierre.spreadsheet.generate"
  | "pierre.client_fiche.generate"
  | "pierre.final_report.generate"
  | "pierre.hr_letter.generate"
  | "pierre.risk.sensitive";

// ── B32: Runtime mode ─────────────────────────────────────────────────────────

export type AiRuntimeMode = "mock" | "disabled" | "production";

// ── B32: Model presets ────────────────────────────────────────────────────────

export type AiModelPresetKey =
  | "deliverable_premium"
  | "document_generation"
  | "pdf_content_generation"
  | "spreadsheet_content_generation"
  | "client_fiche_generation"
  | "final_report_generation"
  | "contract_draft_generation"
  | "hr_letter_generation"
  | "premium_delivery_review"
  | "mission_planning"
  | "task_orchestration"
  | "status_update"
  | "intent_detection"
  | "field_extraction"
  | "risk_analysis_standard"
  | "risk_analysis_sensitive"
  | "embeddings_quality"
  | "embeddings_cost";

export type AiModelPreset = {
  key: AiModelPresetKey;
  label: string;
  provider: CloneAIProviderId;
  model_profile: CloneAIModelProfile;
  model_env_key: string;
  default_model_id: string;
  is_premium: boolean;
};

// ── B32: Cost estimation ──────────────────────────────────────────────────────

export type AiCostTier = "negligible" | "low" | "medium" | "high";

export type AiCostEstimate = {
  provider: CloneAIProviderId;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_cents: number;
  cost_tier: AiCostTier;
};

// ── B32: Budget enforcement ───────────────────────────────────────────────────

export type AiBudgetScope = {
  agent_slug: string;
  period: "daily" | "monthly";
  max_cents: number;
  used_cents: number;
};

export type AiBudgetDecision = {
  allowed: boolean;
  reason: string;
  remaining_cents: number;
  estimated_cost_cents: number;
};

// ── B32: Usage logging ────────────────────────────────────────────────────────

export type AiUsageLogStatus = "ok" | "error" | "budget_blocked" | "disabled" | "mock";

export type AiUsageLogInput = {
  agent_slug: string;
  use_case: string;
  provider: CloneAIProviderId;
  model_id: string;
  runtime_mode: AiRuntimeMode;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_cents: number;
  latency_ms: number;
  status: AiUsageLogStatus;
  error_code?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type CloneAIOutputMode =
  | "json"
  | "text"
  | "markdown";

export type CloneAIRiskMode =
  | "safe"
  | "sensitive"
  | "blocked";

export type CloneAIMessageRole =
  | "system"
  | "user"
  | "assistant";

export type CloneAIMessage = {
  role: CloneAIMessageRole;
  content: string;
};

export type CloneAIJsonSchemaField = {
  type: "string" | "number" | "boolean" | "array" | "object" | "null";
  required?: boolean;
  description?: string;
};

export type CloneAIPromptContract = {
  id: string;
  version: string;
  use_case: CloneAIUseCase;
  title: string;
  description: string;
  output_mode: CloneAIOutputMode;
  risk_mode: CloneAIRiskMode;
  model_profile: CloneAIModelProfile;
  system_prompt: string;
  user_prompt_template: string;
  required_variables: string[];
  optional_variables: string[];
  json_schema?: Record<string, CloneAIJsonSchemaField>;
  max_input_chars: number;
  max_output_chars: number;
};

export type CloneAIRouterPolicy = {
  preferred_provider: CloneAIProviderId;
  fallback_providers: CloneAIProviderId[];
  model_profile: CloneAIModelProfile;
  timeout_ms: number;
  max_retries: number;
  temperature: number;
  max_output_tokens: number;
};

export type CloneAIRequest = {
  use_case: CloneAIUseCase;
  messages: CloneAIMessage[];
  output_mode: CloneAIOutputMode;
  json_schema?: Record<string, CloneAIJsonSchemaField>;
  variables?: Record<string, unknown>;
  policy?: Partial<CloneAIRouterPolicy>;
  metadata?: Record<string, unknown>;
};

export type CloneAIUsage = {
  input_tokens_estimated: number;
  output_tokens_estimated: number;
  total_tokens_estimated: number;
};

export type CloneAIResponse = {
  ok: boolean;
  provider: CloneAIProviderId;
  model_profile: CloneAIModelProfile;
  content: string;
  json: unknown | null;
  usage: CloneAIUsage;
  latency_ms: number;
  warnings: string[];
  error: string | null;
  raw?: unknown;
};

export type CloneAIProviderHealth = {
  provider: CloneAIProviderId;
  configured: boolean;
  available: boolean;
  reason: string | null;
};

export type CloneAIValidationResult = {
  ok: boolean;
  parsed_json: unknown | null;
  errors: string[];
  warnings: string[];
};
