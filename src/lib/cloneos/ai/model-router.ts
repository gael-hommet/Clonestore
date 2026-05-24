// src/lib/cloneos/ai/model-router.ts
// CloneOS AI Model Router — pure policy logic, no provider calls.

import type {
  CloneAIUseCase,
  CloneAIModelProfile,
  CloneAIProviderId,
  CloneAIRouterPolicy,
  CloneAIRequest,
  CloneAIPromptContract,
  CloneAIMessage,
} from "./types";
import { renderPromptTemplate, safeTrimForPrompt } from "./utils";

// ── Default policies per model profile ────────────────────────────────────────

const PROFILE_POLICIES: Record<CloneAIModelProfile, CloneAIRouterPolicy> = {
  fast_classification: {
    preferred_provider: "openai",
    fallback_providers: ["anthropic", "mock"],
    model_profile: "fast_classification",
    timeout_ms: 8000,
    max_retries: 1,
    temperature: 0.1,
    max_output_tokens: 512,
  },
  structured_reasoning: {
    preferred_provider: "anthropic",
    fallback_providers: ["openai", "mock"],
    model_profile: "structured_reasoning",
    timeout_ms: 20000,
    max_retries: 2,
    temperature: 0.2,
    max_output_tokens: 2048,
  },
  long_writing: {
    preferred_provider: "anthropic",
    fallback_providers: ["openai", "mock"],
    model_profile: "long_writing",
    timeout_ms: 30000,
    max_retries: 2,
    temperature: 0.35,
    max_output_tokens: 4096,
  },
  quality_review: {
    preferred_provider: "openai",
    fallback_providers: ["anthropic", "mock"],
    model_profile: "quality_review",
    timeout_ms: 15000,
    max_retries: 1,
    temperature: 0.1,
    max_output_tokens: 1024,
  },
  risk_analysis: {
    preferred_provider: "openai",
    fallback_providers: ["anthropic", "mock"],
    model_profile: "risk_analysis",
    timeout_ms: 15000,
    max_retries: 1,
    temperature: 0.0,
    max_output_tokens: 1024,
  },
  conversation: {
    preferred_provider: "openai",
    fallback_providers: ["anthropic", "mock"],
    model_profile: "conversation",
    timeout_ms: 15000,
    max_retries: 1,
    temperature: 0.3,
    max_output_tokens: 2048,
  },
  // ── B32: Premium deliverables → Claude Opus 4.7 ─────────────────────────────
  premium_generation: {
    preferred_provider: "anthropic",
    fallback_providers: ["openai", "mock"],
    model_profile: "premium_generation",
    timeout_ms: 60000,
    max_retries: 1,
    temperature: 0.3,
    max_output_tokens: 8192,
  },
  // ── B32: Organisation / orchestration → GPT-4.1 fort ───────────────────────
  orchestration: {
    preferred_provider: "openai",
    fallback_providers: ["anthropic", "mock"],
    model_profile: "orchestration",
    timeout_ms: 20000,
    max_retries: 2,
    temperature: 0.1,
    max_output_tokens: 2048,
  },
  // ── B32: Micro-tâches → GPT mini ────────────────────────────────────────────
  micro_task: {
    preferred_provider: "openai",
    fallback_providers: ["mock"],
    model_profile: "micro_task",
    timeout_ms: 8000,
    max_retries: 1,
    temperature: 0.0,
    max_output_tokens: 512,
  },
};

// ── Use-case to profile mapping ───────────────────────────────────────────────

const USE_CASE_TO_PROFILE: Record<CloneAIUseCase, CloneAIModelProfile> = {
  // ── Existing use cases (unchanged) ────────────────────────────────────────
  "pierre.mission.interpret": "structured_reasoning",
  "pierre.tasks.plan": "structured_reasoning",
  "pierre.document.draft": "long_writing",
  "pierre.document.review": "quality_review",
  "pierre.employee_file.summarize": "structured_reasoning",
  "pierre.risk.precheck": "risk_analysis",
  "pierre.customer_success.summarize": "structured_reasoning",
  "pierre.brain.final_interpret": "structured_reasoning",
  "pierre.brain.task_plan": "structured_reasoning",
  "pierre.brain.missing_info": "fast_classification",
  "pierre.brain.risk_review": "risk_analysis",
  "pierre.brain.answer": "conversation",
  "pierre.brain.quality_gate": "quality_review",
  "platform.chat.answer": "conversation",
  "platform.routing.classify": "fast_classification",
  "platform.generic.structured": "structured_reasoning",
  // ── B32: Pierre deliverable use cases → premium_generation (Opus 4.7) ─────
  "pierre.document.generate":       "premium_generation",
  "pierre.pdf.generate":            "premium_generation",
  "pierre.spreadsheet.generate":    "premium_generation",
  "pierre.client_fiche.generate":   "premium_generation",
  "pierre.final_report.generate":   "premium_generation",
  "pierre.hr_letter.generate":      "premium_generation",
  "pierre.risk.sensitive":          "premium_generation",
};

// ── Public functions ──────────────────────────────────────────────────────────

export function getDefaultCloneAIRouterPolicy(
  useCase: CloneAIUseCase,
): CloneAIRouterPolicy {
  const profile = USE_CASE_TO_PROFILE[useCase] ?? "structured_reasoning";
  return { ...PROFILE_POLICIES[profile], model_profile: profile };
}

export function mergeCloneAIRouterPolicy(
  base: CloneAIRouterPolicy,
  override?: Partial<CloneAIRouterPolicy>,
): CloneAIRouterPolicy {
  if (!override) return { ...base };
  const merged: CloneAIRouterPolicy = { ...base };

  if (override.preferred_provider !== undefined) merged.preferred_provider = override.preferred_provider;
  if (override.fallback_providers !== undefined) merged.fallback_providers = override.fallback_providers;
  if (override.model_profile !== undefined) merged.model_profile = override.model_profile;
  if (override.timeout_ms !== undefined && typeof override.timeout_ms === "number") merged.timeout_ms = override.timeout_ms;
  if (override.max_retries !== undefined && typeof override.max_retries === "number") merged.max_retries = override.max_retries;
  if (override.temperature !== undefined && typeof override.temperature === "number") merged.temperature = override.temperature;
  if (override.max_output_tokens !== undefined && typeof override.max_output_tokens === "number") merged.max_output_tokens = override.max_output_tokens;

  // Always ensure mock is last fallback
  if (!merged.fallback_providers.includes("mock")) {
    merged.fallback_providers = [...merged.fallback_providers, "mock"];
  }

  return merged;
}

export function selectCloneAIProviderOrder(
  policy: CloneAIRouterPolicy,
): CloneAIProviderId[] {
  const seen = new Set<CloneAIProviderId>();
  const order: CloneAIProviderId[] = [];

  const add = (id: CloneAIProviderId) => {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  };

  add(policy.preferred_provider);
  for (const fb of policy.fallback_providers) add(fb);
  add("mock"); // always last fallback

  return order;
}

export function validateCloneAIRequestShape(
  request: CloneAIRequest,
): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!request || typeof request !== "object") {
    return { ok: false, errors: ["Request is not an object."], warnings };
  }

  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    errors.push("Request messages array is empty or missing.");
  } else {
    for (const msg of request.messages) {
      if (!msg || typeof msg.role !== "string" || typeof msg.content !== "string") {
        errors.push("Invalid message shape — each message must have role and content strings.");
        break;
      }
      if (msg.content.length > 32000) {
        warnings.push(`Message content exceeds 32000 chars (${msg.content.length}). Consider trimming.`);
      }
    }
  }

  if (request.output_mode === "json" && (!request.json_schema || Object.keys(request.json_schema).length === 0)) {
    warnings.push("output_mode is json but no json_schema provided — validation will be skipped.");
  }

  if (!request.use_case || typeof request.use_case !== "string") {
    errors.push("Request use_case is missing.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function buildCloneAIRequestFromContract(params: {
  contract: CloneAIPromptContract;
  variables: Record<string, unknown>;
  policy?: Partial<CloneAIRouterPolicy>;
}): CloneAIRequest {
  const { contract, variables, policy } = params;
  const safeVars: Record<string, unknown> = variables && typeof variables === "object" && !Array.isArray(variables) ? variables : {};

  const systemContent = contract.system_prompt;
  const userContent = renderPromptTemplate(contract.user_prompt_template, safeVars);

  const messages: CloneAIMessage[] = [
    { role: "system", content: safeTrimForPrompt(systemContent, contract.max_input_chars) },
    { role: "user", content: safeTrimForPrompt(userContent, contract.max_input_chars) },
  ];

  return {
    use_case: contract.use_case,
    messages,
    output_mode: contract.output_mode,
    json_schema: contract.json_schema,
    variables: safeVars,
    policy,
    metadata: {
      contract_id: contract.id,
      contract_version: contract.version,
    },
  };
}
