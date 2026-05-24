// src/lib/cloneos/ai/runtime.ts
// CloneOS AI Runtime Orchestrator — routes requests through providers with fallback.
// B32: adds mode check (disabled/mock/production), budget enforcement, usage logging.

import type {
  CloneAIRequest,
  CloneAIResponse,
  CloneAIUseCase,
  CloneAIRouterPolicy,
  CloneAIProviderHealth,
  CloneAIProviderId,
} from "./types";
import {
  getDefaultCloneAIRouterPolicy,
  mergeCloneAIRouterPolicy,
  selectCloneAIProviderOrder,
  validateCloneAIRequestShape,
  buildCloneAIRequestFromContract,
} from "./model-router";
import {
  createMockCloneAIProvider,
  createOpenAICloneAIProvider,
  createAnthropicCloneAIProvider,
  listCloneAIProviderHealth,
  type CloneAIProviderAdapter,
} from "./providers";
import {
  getCloneAIPromptContract,
  listCloneAIPromptContracts,
} from "./prompt-registry";
import { parsePossiblyJsonOutput, validateJsonAgainstSimpleSchema, estimateCloneAIUsage } from "./utils";
import { getAiRuntimeMode, isAiDisabled, isAiMockMode } from "./mode";
import { estimateAiCost } from "./cost";
import { checkSingleCallBudget } from "./budgets";
import { buildAiUsageLog, traceAiUsageLog } from "./usage-log";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEnvSafe(key: string): string | null {
  try {
    const v = process.env[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

// Derives a model ID string for cost estimation based on policy — mirrors providers.ts logic.
function deriveModelForBudget(policy: CloneAIRouterPolicy): { provider: CloneAIProviderId; modelId: string } {
  const p = policy.preferred_provider;
  if (p === "mock") return { provider: "mock", modelId: "mock" };

  if (p === "anthropic") {
    if (policy.model_profile === "premium_generation") {
      return { provider: "anthropic", modelId: getEnvSafe("AI_ANTHROPIC_OPUS_MODEL") ?? "claude-opus-4-7" };
    }
    if (policy.model_profile === "fast_classification" || policy.model_profile === "micro_task") {
      return { provider: "anthropic", modelId: getEnvSafe("AI_ANTHROPIC_FAST_MODEL") ?? "claude-haiku-4-5-20251001" };
    }
    return { provider: "anthropic", modelId: getEnvSafe("AI_ANTHROPIC_SONNET_MODEL") ?? "claude-sonnet-4-6" };
  }

  if (p === "openai") {
    if (policy.model_profile === "micro_task" || policy.model_profile === "fast_classification" || policy.model_profile === "conversation") {
      return { provider: "openai", modelId: getEnvSafe("AI_OPENAI_FAST_MODEL") ?? "gpt-4.1-mini" };
    }
    return { provider: "openai", modelId: getEnvSafe("AI_OPENAI_STRONG_MODEL") ?? "gpt-4.1" };
  }

  return { provider: "mock", modelId: "mock" };
}

// ── Provider registry ─────────────────────────────────────────────────────────


function buildProviderMap(): Map<string, CloneAIProviderAdapter> {
  const map = new Map<string, CloneAIProviderAdapter>();
  map.set("mock", createMockCloneAIProvider());
  map.set("openai", createOpenAICloneAIProvider());
  map.set("anthropic", createAnthropicCloneAIProvider());
  return map;
}

// ── Main runtime ──────────────────────────────────────────────────────────────

export async function runCloneAI(request: CloneAIRequest): Promise<CloneAIResponse> {
  const warnings: string[] = [];
  const runtimeMode = getAiRuntimeMode();

  // B32: mode check — block early if AI is disabled
  if (isAiDisabled()) {
    return {
      ok: false,
      provider: "mock",
      model_profile: "structured_reasoning",
      content: "",
      json: null,
      usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
      latency_ms: 0,
      warnings: [],
      error: "AI runtime is disabled (AI_RUNTIME_MODE=disabled).",
    };
  }

  // Validate request shape
  const validation = validateCloneAIRequestShape(request);
  if (!validation.ok) {
    return {
      ok: false,
      provider: "mock",
      model_profile: "structured_reasoning",
      content: "",
      json: null,
      usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
      latency_ms: 0,
      warnings: [...validation.warnings, ...validation.errors],
      error: `Invalid request: ${validation.errors.join("; ")}`,
    };
  }
  warnings.push(...validation.warnings);

  // Determine policy
  const basePolicy = getDefaultCloneAIRouterPolicy(request.use_case);
  let policy: CloneAIRouterPolicy = mergeCloneAIRouterPolicy(basePolicy, request.policy);

  // B32: mock mode — force mock provider, skip real API calls
  if (isAiMockMode()) {
    policy = { ...policy, preferred_provider: "mock", fallback_providers: [] };
  }

  // B32: budget pre-check for production mode
  if (runtimeMode === "production") {
    const { provider: budgetProvider, modelId: budgetModel } = deriveModelForBudget(policy);
    if (budgetProvider !== "mock") {
      const inputStr = request.messages.map((m) => m.content).join("\n");
      const inputEst = estimateCloneAIUsage(inputStr, "");
      const outputEst = policy.max_output_tokens ?? 2048;
      const costEst = estimateAiCost(budgetProvider, budgetModel, inputEst.input_tokens_estimated, outputEst);
      const budgetCheck = checkSingleCallBudget(costEst.estimated_cost_cents);
      if (!budgetCheck.allowed) {
        return {
          ok: false,
          provider: budgetProvider,
          model_profile: policy.model_profile,
          content: "",
          json: null,
          usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
          latency_ms: 0,
          warnings,
          error: `Budget exceeded: ${budgetCheck.reason}`,
        };
      }
    }
  }

  // Get provider order
  const providerOrder = selectCloneAIProviderOrder(policy);
  const providerMap = buildProviderMap();

  let lastResponse: CloneAIResponse | null = null;

  for (const providerId of providerOrder) {
    const adapter = providerMap.get(providerId);
    if (!adapter) continue;

    if (!adapter.isConfigured()) {
      warnings.push(`Provider "${providerId}" is not configured — skipping.`);
      continue;
    }

    let attempt = 0;
    const maxRetries = providerId === "mock" ? 0 : (policy.max_retries ?? 1);

    while (attempt <= maxRetries) {
      let response: CloneAIResponse;
      try {
        response = await adapter.generate(request, policy);
      } catch {
        response = {
          ok: false,
          provider: providerId,
          model_profile: policy.model_profile,
          content: "",
          json: null,
          usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
          latency_ms: 0,
          warnings: [],
          error: `Unexpected error from provider "${providerId}".`,
        };
      }

      warnings.push(...(response.warnings ?? []));

      if (!response.ok) {
        warnings.push(`Provider "${providerId}" failed (attempt ${attempt + 1}): ${response.error ?? "unknown error"}`);
        attempt++;
        if (attempt <= maxRetries) continue;
        lastResponse = response;
        break;
      }

      // If JSON mode, validate the output
      if (request.output_mode === "json") {
        if (response.json === null) {
          // Try parsing again from content
          const reParse = parsePossiblyJsonOutput(response.content);
          if (reParse.ok) {
            response = { ...response, json: reParse.parsed_json };
            warnings.push(...reParse.warnings);
          } else {
            warnings.push(`Provider "${providerId}" returned non-JSON output for json mode.`);
            attempt++;
            if (attempt <= maxRetries) continue;
            lastResponse = response;
            break;
          }
        }

        // Validate schema
        if (request.json_schema && Object.keys(request.json_schema).length > 0) {
          const schemaValidation = validateJsonAgainstSimpleSchema(response.json, request.json_schema);
          warnings.push(...schemaValidation.warnings);
          if (!schemaValidation.ok) {
            warnings.push(`Schema validation failed: ${schemaValidation.errors.join("; ")}`);
          }
        }
      }

      // B32: usage log on success (fire-and-forget, no PII by default)
      try {
        const successResponse = { ...response, warnings };
        const usageLog = buildAiUsageLog({
          agent_slug: (request.metadata?.contract_id as string | undefined) ?? request.use_case ?? "unknown",
          use_case: request.use_case ?? "unknown",
          provider: providerId,
          model_id: response.model_profile,
          runtime_mode: runtimeMode,
          input_tokens: response.usage.input_tokens_estimated,
          output_tokens: response.usage.output_tokens_estimated,
          estimated_cost_cents: (() => {
            const { provider: cp, modelId: cm } = deriveModelForBudget(policy);
            return cp !== "mock" ? estimateAiCost(cp, cm, response.usage.input_tokens_estimated, response.usage.output_tokens_estimated).estimated_cost_cents : 0;
          })(),
          latency_ms: response.latency_ms,
          status: "ok",
          metadata: { use_case: request.use_case, model_profile: policy.model_profile },
        });
        traceAiUsageLog(usageLog);
        return successResponse;
      } catch {
        // Logging failure must never break the response
        return { ...response, warnings };
      }
    }
  }

  // All providers failed — return last error or generic
  return {
    ok: false,
    provider: "mock",
    model_profile: policy.model_profile,
    content: "",
    json: null,
    usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
    latency_ms: 0,
    warnings,
    error: lastResponse?.error ?? "All providers failed or are unconfigured.",
  };
}

export async function runCloneAIContract(params: {
  useCase: CloneAIUseCase;
  variables: Record<string, unknown>;
  policy?: Partial<CloneAIRouterPolicy>;
}): Promise<CloneAIResponse> {
  const { useCase, variables, policy } = params;

  const contract = getCloneAIPromptContract(useCase);
  if (!contract) {
    return {
      ok: false,
      provider: "mock",
      model_profile: "structured_reasoning",
      content: "",
      json: null,
      usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
      latency_ms: 0,
      warnings: [],
      error: `No prompt contract found for use_case: "${useCase}".`,
    };
  }

  const request = buildCloneAIRequestFromContract({
    contract,
    variables: variables ?? {},
    policy,
  });

  return runCloneAI(request);
}

export function getCloneAIRuntimeStatus(): {
  mode: ReturnType<typeof getAiRuntimeMode>;
  providers: CloneAIProviderHealth[];
  prompt_contracts_count: number;
  supported_use_cases: CloneAIUseCase[];
} {
  const contracts = listCloneAIPromptContracts();
  const useCases = contracts.map((c) => c.use_case);

  return {
    mode: getAiRuntimeMode(),
    providers: listCloneAIProviderHealth(),
    prompt_contracts_count: contracts.length,
    supported_use_cases: useCases,
  };
}
