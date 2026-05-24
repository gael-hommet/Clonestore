// src/lib/cloneos/ai/providers.ts
// CloneOS AI Providers — mock + OpenAI + Anthropic adapters.
// Can use async, fetch, AbortController, process.env.

import type {
  CloneAIProviderId,
  CloneAIRequest,
  CloneAIResponse,
  CloneAIProviderHealth,
  CloneAIRouterPolicy,
  CloneAIUsage,
} from "./types";
import {
  estimateCloneAIUsage,
  parsePossiblyJsonOutput,
  sanitizeAITextOutput,
  safeTrimForPrompt,
} from "./utils";

// ── Provider adapter interface ────────────────────────────────────────────────

export type CloneAIProviderAdapter = {
  id: CloneAIProviderId;
  isConfigured(): boolean;
  health(): CloneAIProviderHealth;
  generate(request: CloneAIRequest, policy: CloneAIRouterPolicy): Promise<CloneAIResponse>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEnvSafe(key: string): string | null {
  try {
    const v = process.env[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

function makeErrorResponse(
  provider: CloneAIProviderId,
  profile: CloneAIRouterPolicy["model_profile"],
  error: string,
  latency_ms: number,
  warnings: string[] = [],
): CloneAIResponse {
  return {
    ok: false,
    provider,
    model_profile: profile,
    content: "",
    json: null,
    usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
    latency_ms,
    warnings,
    error,
  };
}

function buildMessageString(messages: CloneAIRequest["messages"]): string {
  return messages.map((m) => `[${m.role}] ${m.content}`).join("\n\n");
}

function parseOutputForResponse(
  raw: string,
  request: CloneAIRequest,
  warnings: string[],
): { content: string; json: unknown | null } {
  const content = sanitizeAITextOutput(raw);
  if (request.output_mode !== "json") {
    return { content, json: null };
  }
  const parsed = parsePossiblyJsonOutput(raw);
  if (!parsed.ok) {
    warnings.push("Output mode is json but could not parse valid JSON from response.");
  }
  for (const w of parsed.warnings) warnings.push(w);
  return { content, json: parsed.ok ? parsed.parsed_json : null };
}

// ── Mock Provider ─────────────────────────────────────────────────────────────

function buildMockJSONOutput(request: CloneAIRequest): string {
  const schema = request.json_schema;
  if (!schema || Object.keys(schema).length === 0) {
    return JSON.stringify({ mock: true, use_case: request.use_case, note: "Mock AI response — no schema provided." });
  }

  const obj: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    if (field.type === "string") obj[key] = `mock_${key}`;
    else if (field.type === "number") obj[key] = 42;
    else if (field.type === "boolean") obj[key] = false;
    else if (field.type === "array") obj[key] = [];
    else if (field.type === "object") obj[key] = {};
    else obj[key] = null;
  }
  return JSON.stringify(obj, null, 2);
}

function buildMockTextOutput(request: CloneAIRequest): string {
  const useCase = request.use_case ?? "unknown";
  return `[Mock AI Response — ${useCase}]\n\nCeci est une réponse générée par le provider mock de CloneStore AI Runtime.\nAucun appel à un vrai provider n'a été effectué.\n\nUse case : ${useCase}\nOutput mode : ${request.output_mode}`;
}

export function createMockCloneAIProvider(): CloneAIProviderAdapter {
  return {
    id: "mock",

    isConfigured(): boolean {
      return true;
    },

    health(): CloneAIProviderHealth {
      return { provider: "mock", configured: true, available: true, reason: null };
    },

    async generate(request: CloneAIRequest, policy: CloneAIRouterPolicy): Promise<CloneAIResponse> {
      const start = Date.now();
      const warnings: string[] = [];

      try {
        const rawOutput =
          request.output_mode === "json"
            ? buildMockJSONOutput(request)
            : buildMockTextOutput(request);

        const inputStr = buildMessageString(request.messages);
        const usage: CloneAIUsage = estimateCloneAIUsage(inputStr, rawOutput);
        const { content, json } = parseOutputForResponse(rawOutput, request, warnings);

        return {
          ok: true,
          provider: "mock",
          model_profile: policy.model_profile,
          content,
          json,
          usage,
          latency_ms: Date.now() - start,
          warnings,
          error: null,
        };
      } catch (err) {
        return makeErrorResponse("mock", policy.model_profile, String(err), Date.now() - start, warnings);
      }
    },
  };
}

// ── OpenAI Provider ───────────────────────────────────────────────────────────

function getOpenAIModel(profile: CloneAIRouterPolicy["model_profile"]): string {
  // B32: micro_task uses fast/cheap model
  if (profile === "micro_task" || profile === "fast_classification" || profile === "conversation") {
    return (
      getEnvSafe("AI_OPENAI_FAST_MODEL") ??
      getEnvSafe("OPENAI_FAST_MODEL") ??
      getEnvSafe("OPENAI_MODEL") ??
      "gpt-4.1-mini"
    );
  }
  // B32: orchestration + reasoning use strong model
  return (
    getEnvSafe("AI_OPENAI_STRONG_MODEL") ??
    getEnvSafe("AI_OPENAI_REASONING_MODEL") ??
    getEnvSafe("OPENAI_REASONING_MODEL") ??
    getEnvSafe("PIERRE_BRAIN_MODEL") ??
    getEnvSafe("OPENAI_MODEL") ??
    "gpt-4.1"
  );
}

export function createOpenAICloneAIProvider(): CloneAIProviderAdapter {
  return {
    id: "openai",

    isConfigured(): boolean {
      return getEnvSafe("OPENAI_API_KEY") !== null;
    },

    health(): CloneAIProviderHealth {
      const configured = this.isConfigured();
      return {
        provider: "openai",
        configured,
        available: configured,
        reason: configured ? null : "OPENAI_API_KEY not set.",
      };
    },

    async generate(request: CloneAIRequest, policy: CloneAIRouterPolicy): Promise<CloneAIResponse> {
      const start = Date.now();
      const warnings: string[] = [];
      const apiKey = getEnvSafe("OPENAI_API_KEY");

      if (!apiKey) {
        return makeErrorResponse("openai", policy.model_profile, "OPENAI_API_KEY not configured.", Date.now() - start);
      }

      const model = getOpenAIModel(policy.model_profile);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), policy.timeout_ms ?? 20000);

      try {
        const messages = request.messages.map((m) => ({
          role: m.role,
          content: safeTrimForPrompt(m.content, 30000),
        }));

        const body = JSON.stringify({
          model,
          messages,
          temperature: policy.temperature ?? 0.2,
          max_tokens: policy.max_output_tokens ?? 2048,
          ...(request.output_mode === "json" ? { response_format: { type: "json_object" } } : {}),
        });

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "unknown error");
          return makeErrorResponse("openai", policy.model_profile, `OpenAI API error ${resp.status}: ${errorText.slice(0, 200)}`, Date.now() - start, warnings);
        }

        const data = await resp.json() as Record<string, unknown>;
        const choices = Array.isArray(data.choices) ? data.choices : [];
        const firstChoice = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : null;
        const message = firstChoice && typeof firstChoice.message === "object" && firstChoice.message !== null ? firstChoice.message as Record<string, unknown> : null;
        const rawContent = typeof message?.content === "string" ? message.content : "";

        const usageRaw = data.usage && typeof data.usage === "object" ? data.usage as Record<string, unknown> : {};
        const usage: CloneAIUsage = {
          input_tokens_estimated: typeof usageRaw.prompt_tokens === "number" ? usageRaw.prompt_tokens : estimateCloneAIUsage(buildMessageString(request.messages), "").input_tokens_estimated,
          output_tokens_estimated: typeof usageRaw.completion_tokens === "number" ? usageRaw.completion_tokens : estimateCloneAIUsage("", rawContent).output_tokens_estimated,
          total_tokens_estimated: typeof usageRaw.total_tokens === "number" ? usageRaw.total_tokens : 0,
        };

        const { content, json } = parseOutputForResponse(rawContent, request, warnings);

        return {
          ok: true,
          provider: "openai",
          model_profile: policy.model_profile,
          content,
          json,
          usage,
          latency_ms: Date.now() - start,
          warnings,
          error: null,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err instanceof Error && err.name === "AbortError";
        const msg = isAbort ? `OpenAI request timed out after ${policy.timeout_ms}ms.` : `OpenAI provider error: ${String(err)}`;
        return makeErrorResponse("openai", policy.model_profile, msg, Date.now() - start, warnings);
      }
    },
  };
}

// ── Anthropic Provider ────────────────────────────────────────────────────────

function getAnthropicModel(profile: CloneAIRouterPolicy["model_profile"]): string {
  // B32: premium_generation uses Opus 4.7
  if (profile === "premium_generation") {
    return (
      getEnvSafe("AI_ANTHROPIC_OPUS_MODEL") ??
      getEnvSafe("ANTHROPIC_OPUS_MODEL") ??
      "claude-opus-4-7"
    );
  }
  if (profile === "fast_classification" || profile === "micro_task") {
    return (
      getEnvSafe("AI_ANTHROPIC_FAST_MODEL") ??
      getEnvSafe("ANTHROPIC_FAST_MODEL") ??
      "claude-haiku-4-5-20251001"
    );
  }
  return (
    getEnvSafe("AI_ANTHROPIC_SONNET_MODEL") ??
    getEnvSafe("ANTHROPIC_REASONING_MODEL") ??
    "claude-sonnet-4-6"
  );
}

export function createAnthropicCloneAIProvider(): CloneAIProviderAdapter {
  return {
    id: "anthropic",

    isConfigured(): boolean {
      return getEnvSafe("ANTHROPIC_API_KEY") !== null;
    },

    health(): CloneAIProviderHealth {
      const configured = this.isConfigured();
      return {
        provider: "anthropic",
        configured,
        available: configured,
        reason: configured ? null : "ANTHROPIC_API_KEY not set.",
      };
    },

    async generate(request: CloneAIRequest, policy: CloneAIRouterPolicy): Promise<CloneAIResponse> {
      const start = Date.now();
      const warnings: string[] = [];
      const apiKey = getEnvSafe("ANTHROPIC_API_KEY");

      if (!apiKey) {
        return makeErrorResponse("anthropic", policy.model_profile, "ANTHROPIC_API_KEY not configured.", Date.now() - start);
      }

      const model = getAnthropicModel(policy.model_profile);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), policy.timeout_ms ?? 20000);

      try {
        // Extract system prompt if first message is system
        const messages = request.messages.slice();
        let systemPrompt: string | undefined;
        if (messages.length > 0 && messages[0].role === "system") {
          systemPrompt = safeTrimForPrompt(messages[0].content, 30000);
          messages.shift();
        }

        const anthropicMessages = messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: safeTrimForPrompt(m.content, 30000),
        }));

        const body = JSON.stringify({
          model,
          max_tokens: policy.max_output_tokens ?? 2048,
          temperature: policy.temperature ?? 0.2,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: anthropicMessages,
        });

        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "unknown error");
          return makeErrorResponse("anthropic", policy.model_profile, `Anthropic API error ${resp.status}: ${errorText.slice(0, 200)}`, Date.now() - start, warnings);
        }

        const data = await resp.json() as Record<string, unknown>;
        const content = Array.isArray(data.content) ? data.content : [];
        const firstBlock = content[0] && typeof content[0] === "object" ? content[0] as Record<string, unknown> : null;
        const rawContent = typeof firstBlock?.text === "string" ? firstBlock.text : "";

        const usageRaw = data.usage && typeof data.usage === "object" ? data.usage as Record<string, unknown> : {};
        const usage: CloneAIUsage = {
          input_tokens_estimated: typeof usageRaw.input_tokens === "number" ? usageRaw.input_tokens : estimateCloneAIUsage(buildMessageString(request.messages), "").input_tokens_estimated,
          output_tokens_estimated: typeof usageRaw.output_tokens === "number" ? usageRaw.output_tokens : estimateCloneAIUsage("", rawContent).output_tokens_estimated,
          total_tokens_estimated: (typeof usageRaw.input_tokens === "number" ? usageRaw.input_tokens : 0) + (typeof usageRaw.output_tokens === "number" ? usageRaw.output_tokens : 0),
        };

        const { content: parsedContent, json } = parseOutputForResponse(rawContent, request, warnings);

        return {
          ok: true,
          provider: "anthropic",
          model_profile: policy.model_profile,
          content: parsedContent,
          json,
          usage,
          latency_ms: Date.now() - start,
          warnings,
          error: null,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err instanceof Error && err.name === "AbortError";
        const msg = isAbort ? `Anthropic request timed out after ${policy.timeout_ms}ms.` : `Anthropic provider error: ${String(err)}`;
        return makeErrorResponse("anthropic", policy.model_profile, msg, Date.now() - start, warnings);
      }
    },
  };
}

// ── Health listing ────────────────────────────────────────────────────────────

export function listCloneAIProviderHealth(): CloneAIProviderHealth[] {
  return [
    createMockCloneAIProvider().health(),
    createOpenAICloneAIProvider().health(),
    createAnthropicCloneAIProvider().health(),
  ];
}
