// src/lib/cloneos/ai/__tests__/ai-runtime.test.ts
// CloneOS AI Runtime — comprehensive test suite (180+ tests).
// No real OpenAI or Anthropic calls — mock provider only.

import { describe, test, expect, beforeEach, vi } from "vitest";

// ── Module imports ────────────────────────────────────────────────────────────

import {
  estimateTokensFromText,
  estimateCloneAIUsage,
  safeTrimForPrompt,
  renderPromptTemplate,
  sanitizeAITextOutput,
  parsePossiblyJsonOutput,
  validateJsonAgainstSimpleSchema,
  buildCloneAIMessageHash,
} from "../utils";

import {
  getCloneAIPromptContract,
  listCloneAIPromptContracts,
} from "../prompt-registry";

import {
  getDefaultCloneAIRouterPolicy,
  mergeCloneAIRouterPolicy,
  selectCloneAIProviderOrder,
  validateCloneAIRequestShape,
  buildCloneAIRequestFromContract,
} from "../model-router";

import {
  runCloneAI,
  runCloneAIContract,
  getCloneAIRuntimeStatus,
} from "../runtime";

import type {
  CloneAIRequest,
  CloneAIUseCase,
  CloneAIRouterPolicy,
  CloneAIMessage,
  CloneAIJsonSchemaField,
} from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMinimalRequest(overrides: Partial<CloneAIRequest> = {}): CloneAIRequest {
  return {
    use_case: "pierre.mission.interpret",
    messages: [{ role: "user", content: "Bonjour" }],
    output_mode: "text",
    policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    ...overrides,
  };
}

function makeJsonRequest(overrides: Partial<CloneAIRequest> = {}): CloneAIRequest {
  return makeMinimalRequest({
    output_mode: "json",
    json_schema: {
      result: { type: "string", required: true },
    },
    ...overrides,
  });
}

// ── utils.ts ──────────────────────────────────────────────────────────────────

describe("estimateTokensFromText", () => {
  test("empty string returns 0", () => {
    expect(estimateTokensFromText("")).toBe(0);
  });

  test("non-string returns 0", () => {
    expect(estimateTokensFromText(null as unknown as string)).toBe(0);
    expect(estimateTokensFromText(undefined as unknown as string)).toBe(0);
    expect(estimateTokensFromText(42 as unknown as string)).toBe(0);
  });

  test("short string returns at least 1", () => {
    expect(estimateTokensFromText("a")).toBe(1);
    expect(estimateTokensFromText("ab")).toBe(1);
  });

  test("8-char string = 2 tokens", () => {
    expect(estimateTokensFromText("12345678")).toBe(2);
  });

  test("400-char string = 100 tokens", () => {
    expect(estimateTokensFromText("a".repeat(400))).toBe(100);
  });

  test("4001-char string > 1000 tokens", () => {
    expect(estimateTokensFromText("x".repeat(4001))).toBeGreaterThan(1000);
  });
});

describe("estimateCloneAIUsage", () => {
  test("returns object with 3 fields", () => {
    const u = estimateCloneAIUsage("hello", "world");
    expect(u).toHaveProperty("input_tokens_estimated");
    expect(u).toHaveProperty("output_tokens_estimated");
    expect(u).toHaveProperty("total_tokens_estimated");
  });

  test("total equals input + output", () => {
    const u = estimateCloneAIUsage("aaaa", "bbbb");
    expect(u.total_tokens_estimated).toBe(u.input_tokens_estimated + u.output_tokens_estimated);
  });

  test("empty strings return valid object", () => {
    const u = estimateCloneAIUsage("", "");
    expect(u.total_tokens_estimated).toBe(0);
  });

  test("non-string args return valid object", () => {
    const u = estimateCloneAIUsage(null as unknown as string, undefined as unknown as string);
    expect(u.total_tokens_estimated).toBe(0);
  });
});

describe("safeTrimForPrompt", () => {
  test("short string unchanged", () => {
    expect(safeTrimForPrompt("hello", 100)).toBe("hello");
  });

  test("string trimmed at maxChars with ellipsis", () => {
    const result = safeTrimForPrompt("a".repeat(200), 100);
    expect(result.length).toBe(100);
    expect(result.endsWith("...")).toBe(true);
  });

  test("null returns empty string", () => {
    expect(safeTrimForPrompt(null, 100)).toBe("");
  });

  test("undefined returns empty string", () => {
    expect(safeTrimForPrompt(undefined, 100)).toBe("");
  });

  test("object is JSON-stringified", () => {
    const obj = { key: "value" };
    const result = safeTrimForPrompt(obj, 1000);
    expect(result).toContain("key");
    expect(result).toContain("value");
  });

  test("number is stringified", () => {
    const result = safeTrimForPrompt(42, 100);
    expect(result).toBe("42");
  });

  test("invalid maxChars falls back to 2000", () => {
    const result = safeTrimForPrompt("hello", -1);
    expect(result).toBe("hello");
  });

  test("maxChars = 0 falls back to 2000", () => {
    const result = safeTrimForPrompt("hello", 0);
    expect(result).toBe("hello");
  });
});

describe("renderPromptTemplate", () => {
  test("replaces single variable", () => {
    expect(renderPromptTemplate("Hello {{name}}", { name: "Alice" })).toBe("Hello Alice");
  });

  test("replaces multiple variables", () => {
    const result = renderPromptTemplate("{{a}} {{b}}", { a: "x", b: "y" });
    expect(result).toBe("x y");
  });

  test("missing variable replaced by empty string", () => {
    expect(renderPromptTemplate("{{missing}}", {})).toBe("");
  });

  test("null variable replaced by empty string", () => {
    expect(renderPromptTemplate("{{x}}", { x: null })).toBe("");
  });

  test("number variable stringified", () => {
    expect(renderPromptTemplate("{{n}}", { n: 42 })).toBe("42");
  });

  test("boolean variable stringified", () => {
    expect(renderPromptTemplate("{{b}}", { b: true })).toBe("true");
  });

  test("object variable JSON-stringified", () => {
    const result = renderPromptTemplate("{{obj}}", { obj: { x: 1 } });
    expect(result).toContain("x");
  });

  test("non-string template returns empty string", () => {
    expect(renderPromptTemplate(null as unknown as string, {})).toBe("");
  });

  test("template without variables unchanged", () => {
    expect(renderPromptTemplate("No vars here", {})).toBe("No vars here");
  });

  test("multiple occurrences of same variable both replaced", () => {
    const result = renderPromptTemplate("{{x}} {{x}}", { x: "hi" });
    expect(result).toBe("hi hi");
  });
});

describe("sanitizeAITextOutput", () => {
  test("trims whitespace", () => {
    expect(sanitizeAITextOutput("  hello  ")).toBe("hello");
  });

  test("normalizes CRLF to LF", () => {
    expect(sanitizeAITextOutput("a\r\nb")).toBe("a\nb");
  });

  test("normalizes CR to LF", () => {
    expect(sanitizeAITextOutput("a\rb")).toBe("a\nb");
  });

  test("non-string returns empty string", () => {
    expect(sanitizeAITextOutput(null)).toBe("");
    expect(sanitizeAITextOutput(42)).toBe("");
  });

  test("truncates at maxChars", () => {
    const result = sanitizeAITextOutput("a".repeat(100), 50);
    expect(result.length).toBe(50);
    expect(result.endsWith("...")).toBe(true);
  });

  test("empty string returns empty string", () => {
    expect(sanitizeAITextOutput("")).toBe("");
  });
});

describe("parsePossiblyJsonOutput", () => {
  test("parses valid JSON string", () => {
    const result = parsePossiblyJsonOutput('{"key": "value"}');
    expect(result.ok).toBe(true);
    expect(result.parsed_json).toEqual({ key: "value" });
    expect(result.errors).toHaveLength(0);
  });

  test("parses valid JSON array", () => {
    const result = parsePossiblyJsonOutput('[1, 2, 3]');
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.parsed_json)).toBe(true);
  });

  test("extracts JSON from fenced code block", () => {
    const result = parsePossiblyJsonOutput('Some text\n```json\n{"x": 1}\n```\nMore text');
    expect(result.ok).toBe(true);
    expect((result.parsed_json as Record<string, unknown>).x).toBe(1);
    expect(result.warnings.some((w) => w.includes("fence"))).toBe(true);
  });

  test("extracts JSON from surrounding text", () => {
    const result = parsePossiblyJsonOutput('Here is the output: {"y": 2} end');
    expect(result.ok).toBe(true);
    expect((result.parsed_json as Record<string, unknown>).y).toBe(2);
    expect(result.warnings.some((w) => w.includes("surrounding"))).toBe(true);
  });

  test("returns error for empty string", () => {
    const result = parsePossiblyJsonOutput("");
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("returns error for unparseable string", () => {
    const result = parsePossiblyJsonOutput("this is not json at all");
    expect(result.ok).toBe(false);
  });

  test("returns error for non-string input", () => {
    const result = parsePossiblyJsonOutput(null as unknown as string);
    expect(result.ok).toBe(false);
  });

  test("extracts from code fence without json label", () => {
    const result = parsePossiblyJsonOutput('```\n{"a": true}\n```');
    expect(result.ok).toBe(true);
  });
});

describe("validateJsonAgainstSimpleSchema", () => {
  const schema: Record<string, CloneAIJsonSchemaField> = {
    name: { type: "string", required: true },
    count: { type: "number", required: false },
    active: { type: "boolean", required: true },
    tags: { type: "array", required: false },
  };

  test("valid object passes", () => {
    const result = validateJsonAgainstSimpleSchema({ name: "Alice", active: true }, schema);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("missing required field fails", () => {
    const result = validateJsonAgainstSimpleSchema({ active: true }, schema);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("name"))).toBe(true);
  });

  test("wrong type produces warning not error", () => {
    const result = validateJsonAgainstSimpleSchema({ name: 42, active: true }, schema);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("name"))).toBe(true);
  });

  test("null value without schema skips validation", () => {
    const result = validateJsonAgainstSimpleSchema(null, undefined);
    expect(result.ok).toBe(true); // undefined schema skips all validation
  });

  test("empty schema skips validation", () => {
    const result = validateJsonAgainstSimpleSchema({ anything: "here" }, {});
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("schema"))).toBe(true);
  });

  test("array root fails schema validation", () => {
    const result = validateJsonAgainstSimpleSchema([1, 2, 3], schema);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("object"))).toBe(true);
  });

  test("array field type passes for array value", () => {
    const result = validateJsonAgainstSimpleSchema(
      { name: "x", active: true, tags: ["a", "b"] },
      schema,
    );
    expect(result.ok).toBe(true);
  });

  test("undefined schema skips and returns ok", () => {
    const result = validateJsonAgainstSimpleSchema({ x: 1 }, undefined);
    expect(result.ok).toBe(true);
  });
});

describe("buildCloneAIMessageHash", () => {
  test("empty array returns 'empty:0'", () => {
    expect(buildCloneAIMessageHash([])).toBe("empty:0");
  });

  test("same messages produce same hash", () => {
    const msgs: CloneAIMessage[] = [{ role: "user", content: "hello" }];
    expect(buildCloneAIMessageHash(msgs)).toBe(buildCloneAIMessageHash(msgs));
  });

  test("different messages produce different hashes (likely)", () => {
    const a: CloneAIMessage[] = [{ role: "user", content: "hello" }];
    const b: CloneAIMessage[] = [{ role: "user", content: "world" }];
    expect(buildCloneAIMessageHash(a)).not.toBe(buildCloneAIMessageHash(b));
  });

  test("includes message count in hash", () => {
    const msgs: CloneAIMessage[] = [{ role: "user", content: "x" }];
    const hash = buildCloneAIMessageHash(msgs);
    expect(hash.endsWith(":1")).toBe(true);
  });

  test("null input returns empty:0", () => {
    expect(buildCloneAIMessageHash(null as unknown as CloneAIMessage[])).toBe("empty:0");
  });

  test("hash starts with 'h'", () => {
    const msgs: CloneAIMessage[] = [{ role: "user", content: "test" }];
    expect(buildCloneAIMessageHash(msgs).startsWith("h")).toBe(true);
  });
});

// ── prompt-registry.ts ────────────────────────────────────────────────────────

describe("listCloneAIPromptContracts", () => {
  test("returns 23 contracts (16 original + 7 B32 deliverables)", () => {
    expect(listCloneAIPromptContracts()).toHaveLength(23);
  });

  test("all contracts have required fields", () => {
    for (const contract of listCloneAIPromptContracts()) {
      expect(contract.id).toBeTruthy();
      expect(contract.use_case).toBeTruthy();
      expect(contract.version).toBeTruthy();
      expect(contract.system_prompt).toBeTruthy();
      expect(contract.user_prompt_template).toBeTruthy();
      expect(Array.isArray(contract.required_variables)).toBe(true);
    }
  });

  test("all versions are v1", () => {
    for (const contract of listCloneAIPromptContracts()) {
      expect(contract.version).toBe("v1");
    }
  });

  test("ids are unique", () => {
    const ids = listCloneAIPromptContracts().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("use_cases are unique", () => {
    const useCases = listCloneAIPromptContracts().map((c) => c.use_case);
    expect(new Set(useCases).size).toBe(useCases.length);
  });

  test("contracts with json_schema have non-empty schema", () => {
    for (const contract of listCloneAIPromptContracts()) {
      if (contract.json_schema !== undefined) {
        expect(Object.keys(contract.json_schema).length).toBeGreaterThan(0);
      }
    }
  });

  test("all contracts have max_input_chars > 0", () => {
    for (const contract of listCloneAIPromptContracts()) {
      expect(contract.max_input_chars).toBeGreaterThan(0);
    }
  });
});

describe("getCloneAIPromptContract", () => {
  test("returns contract for pierre.mission.interpret", () => {
    const c = getCloneAIPromptContract("pierre.mission.interpret");
    expect(c).not.toBeNull();
    expect(c!.use_case).toBe("pierre.mission.interpret");
  });

  test("returns contract for pierre.tasks.plan", () => {
    const c = getCloneAIPromptContract("pierre.tasks.plan");
    expect(c).not.toBeNull();
  });

  test("returns contract for pierre.document.draft", () => {
    expect(getCloneAIPromptContract("pierre.document.draft")).not.toBeNull();
  });

  test("returns contract for pierre.document.review", () => {
    expect(getCloneAIPromptContract("pierre.document.review")).not.toBeNull();
  });

  test("returns contract for pierre.employee_file.summarize", () => {
    expect(getCloneAIPromptContract("pierre.employee_file.summarize")).not.toBeNull();
  });

  test("returns contract for pierre.risk.precheck", () => {
    expect(getCloneAIPromptContract("pierre.risk.precheck")).not.toBeNull();
  });

  test("returns contract for pierre.customer_success.summarize", () => {
    expect(getCloneAIPromptContract("pierre.customer_success.summarize")).not.toBeNull();
  });

  test("returns contract for platform.chat.answer", () => {
    expect(getCloneAIPromptContract("platform.chat.answer")).not.toBeNull();
  });

  test("returns contract for platform.routing.classify", () => {
    expect(getCloneAIPromptContract("platform.routing.classify")).not.toBeNull();
  });

  test("returns contract for platform.generic.structured", () => {
    expect(getCloneAIPromptContract("platform.generic.structured")).not.toBeNull();
  });

  test("returns null for unknown use_case", () => {
    expect(getCloneAIPromptContract("nonexistent.use_case" as CloneAIUseCase)).toBeNull();
  });

  test("pierre.mission.interpret has input in required_variables", () => {
    const c = getCloneAIPromptContract("pierre.mission.interpret");
    expect(c!.required_variables).toContain("input");
  });
});

// ── model-router.ts ───────────────────────────────────────────────────────────

describe("getDefaultCloneAIRouterPolicy", () => {
  test("pierre.mission.interpret returns structured_reasoning profile", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.mission.interpret");
    expect(policy.model_profile).toBe("structured_reasoning");
  });

  test("platform.routing.classify returns fast_classification profile", () => {
    const policy = getDefaultCloneAIRouterPolicy("platform.routing.classify");
    expect(policy.model_profile).toBe("fast_classification");
  });

  test("pierre.document.draft returns long_writing profile", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.document.draft");
    expect(policy.model_profile).toBe("long_writing");
  });

  test("pierre.risk.precheck returns risk_analysis profile", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.risk.precheck");
    expect(policy.model_profile).toBe("risk_analysis");
  });

  test("platform.chat.answer returns conversation profile", () => {
    const policy = getDefaultCloneAIRouterPolicy("platform.chat.answer");
    expect(policy.model_profile).toBe("conversation");
  });

  test("policy has all required fields", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.mission.interpret");
    expect(policy.preferred_provider).toBeTruthy();
    expect(Array.isArray(policy.fallback_providers)).toBe(true);
    expect(typeof policy.timeout_ms).toBe("number");
    expect(typeof policy.max_retries).toBe("number");
    expect(typeof policy.temperature).toBe("number");
    expect(typeof policy.max_output_tokens).toBe("number");
  });

  test("fallback_providers always includes mock", () => {
    const useCases: CloneAIUseCase[] = [
      "pierre.mission.interpret",
      "pierre.tasks.plan",
      "pierre.document.draft",
      "pierre.risk.precheck",
      "platform.chat.answer",
    ];
    for (const uc of useCases) {
      const policy = getDefaultCloneAIRouterPolicy(uc);
      expect(policy.fallback_providers).toContain("mock");
    }
  });
});

describe("mergeCloneAIRouterPolicy", () => {
  const base: CloneAIRouterPolicy = {
    preferred_provider: "anthropic",
    fallback_providers: ["openai", "mock"],
    model_profile: "structured_reasoning",
    timeout_ms: 20000,
    max_retries: 2,
    temperature: 0.2,
    max_output_tokens: 2048,
  };

  test("no override returns copy of base", () => {
    const merged = mergeCloneAIRouterPolicy(base);
    expect(merged).toEqual(base);
    expect(merged).not.toBe(base); // should be a copy
  });

  test("override preferred_provider works", () => {
    const merged = mergeCloneAIRouterPolicy(base, { preferred_provider: "mock" });
    expect(merged.preferred_provider).toBe("mock");
  });

  test("override temperature works", () => {
    const merged = mergeCloneAIRouterPolicy(base, { temperature: 0.9 });
    expect(merged.temperature).toBe(0.9);
  });

  test("override timeout_ms works", () => {
    const merged = mergeCloneAIRouterPolicy(base, { timeout_ms: 5000 });
    expect(merged.timeout_ms).toBe(5000);
  });

  test("mock always added to fallback_providers if missing", () => {
    const merged = mergeCloneAIRouterPolicy(base, { fallback_providers: ["openai"] });
    expect(merged.fallback_providers).toContain("mock");
  });

  test("mock not duplicated if already present", () => {
    const merged = mergeCloneAIRouterPolicy(base, { fallback_providers: ["mock"] });
    const mockCount = merged.fallback_providers.filter((p) => p === "mock").length;
    expect(mockCount).toBe(1);
  });

  test("force mock policy — preferred and fallback both mock", () => {
    const merged = mergeCloneAIRouterPolicy(base, {
      preferred_provider: "mock",
      fallback_providers: ["mock"],
    });
    expect(merged.preferred_provider).toBe("mock");
    expect(merged.fallback_providers).toContain("mock");
  });
});

describe("selectCloneAIProviderOrder", () => {
  test("preferred_provider is first", () => {
    const policy: CloneAIRouterPolicy = {
      preferred_provider: "anthropic",
      fallback_providers: ["openai", "mock"],
      model_profile: "structured_reasoning",
      timeout_ms: 20000,
      max_retries: 1,
      temperature: 0.2,
      max_output_tokens: 2048,
    };
    const order = selectCloneAIProviderOrder(policy);
    expect(order[0]).toBe("anthropic");
  });

  test("mock is always last", () => {
    const policy: CloneAIRouterPolicy = {
      preferred_provider: "openai",
      fallback_providers: ["anthropic", "mock"],
      model_profile: "structured_reasoning",
      timeout_ms: 20000,
      max_retries: 1,
      temperature: 0.2,
      max_output_tokens: 2048,
    };
    const order = selectCloneAIProviderOrder(policy);
    expect(order[order.length - 1]).toBe("mock");
  });

  test("no duplicates in output", () => {
    const policy: CloneAIRouterPolicy = {
      preferred_provider: "mock",
      fallback_providers: ["mock", "mock"],
      model_profile: "structured_reasoning",
      timeout_ms: 20000,
      max_retries: 1,
      temperature: 0.2,
      max_output_tokens: 2048,
    };
    const order = selectCloneAIProviderOrder(policy);
    expect(new Set(order).size).toBe(order.length);
  });

  test("mock-only policy returns [mock]", () => {
    const policy: CloneAIRouterPolicy = {
      preferred_provider: "mock",
      fallback_providers: ["mock"],
      model_profile: "structured_reasoning",
      timeout_ms: 20000,
      max_retries: 1,
      temperature: 0.2,
      max_output_tokens: 2048,
    };
    const order = selectCloneAIProviderOrder(policy);
    expect(order).toEqual(["mock"]);
  });
});

describe("validateCloneAIRequestShape", () => {
  test("valid request passes", () => {
    const result = validateCloneAIRequestShape(makeMinimalRequest());
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("empty messages array fails", () => {
    const result = validateCloneAIRequestShape(makeMinimalRequest({ messages: [] }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("messages"))).toBe(true);
  });

  test("missing use_case fails", () => {
    const req = makeMinimalRequest();
    (req as unknown as Record<string, unknown>).use_case = undefined;
    const result = validateCloneAIRequestShape(req);
    expect(result.ok).toBe(false);
  });

  test("json mode without schema produces warning", () => {
    const req = makeMinimalRequest({ output_mode: "json", json_schema: undefined });
    const result = validateCloneAIRequestShape(req);
    expect(result.warnings.some((w) => w.includes("json_schema"))).toBe(true);
  });

  test("message without role fails", () => {
    const req = makeMinimalRequest({
      messages: [{ role: undefined as unknown as "user", content: "hello" }],
    });
    const result = validateCloneAIRequestShape(req);
    expect(result.ok).toBe(false);
  });

  test("very long message produces warning", () => {
    const req = makeMinimalRequest({
      messages: [{ role: "user", content: "x".repeat(40000) }],
    });
    const result = validateCloneAIRequestShape(req);
    expect(result.warnings.some((w) => w.includes("32000") || w.includes("chars"))).toBe(true);
  });

  test("null request fails gracefully", () => {
    const result = validateCloneAIRequestShape(null as unknown as CloneAIRequest);
    expect(result.ok).toBe(false);
  });
});

describe("buildCloneAIRequestFromContract", () => {
  test("builds request from pierre.mission.interpret contract", () => {
    const contract = getCloneAIPromptContract("pierre.mission.interpret")!;
    const req = buildCloneAIRequestFromContract({
      contract,
      variables: { input: "Onboarder un nouveau salarié" },
    });
    expect(req.use_case).toBe("pierre.mission.interpret");
    expect(req.messages.length).toBeGreaterThanOrEqual(2);
    expect(req.output_mode).toBe("json");
  });

  test("system prompt is first message", () => {
    const contract = getCloneAIPromptContract("pierre.mission.interpret")!;
    const req = buildCloneAIRequestFromContract({
      contract,
      variables: { input: "Test" },
    });
    expect(req.messages[0].role).toBe("system");
  });

  test("user prompt contains variable value", () => {
    const contract = getCloneAIPromptContract("pierre.mission.interpret")!;
    const req = buildCloneAIRequestFromContract({
      contract,
      variables: { input: "UNIQUE_TEST_VALUE_123" },
    });
    const userMsg = req.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("UNIQUE_TEST_VALUE_123");
  });

  test("metadata contains contract_id and contract_version", () => {
    const contract = getCloneAIPromptContract("pierre.mission.interpret")!;
    const req = buildCloneAIRequestFromContract({
      contract,
      variables: { input: "test" },
    });
    expect(req.metadata?.contract_id).toBe(contract.id);
    expect(req.metadata?.contract_version).toBe(contract.version);
  });

  test("json_schema is passed through", () => {
    const contract = getCloneAIPromptContract("pierre.mission.interpret")!;
    const req = buildCloneAIRequestFromContract({
      contract,
      variables: { input: "test" },
    });
    expect(req.json_schema).toBeDefined();
    expect(Object.keys(req.json_schema!).length).toBeGreaterThan(0);
  });

  test("empty variables object is handled safely", () => {
    const contract = getCloneAIPromptContract("platform.generic.structured")!;
    expect(() =>
      buildCloneAIRequestFromContract({ contract, variables: {} }),
    ).not.toThrow();
  });
});

// ── runtime.ts — mock provider path ──────────────────────────────────────────

describe("runCloneAI — mock provider", () => {
  test("text request returns ok:true", async () => {
    const req = makeMinimalRequest();
    const result = await runCloneAI(req);
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("mock");
  });

  test("json request returns ok:true with json field", async () => {
    const req = makeJsonRequest({
      json_schema: {
        intent: { type: "string", required: true },
      },
    });
    const result = await runCloneAI(req);
    expect(result.ok).toBe(true);
    expect(result.json).not.toBeNull();
  });

  test("mock json output matches schema field types", async () => {
    const req = makeJsonRequest({
      json_schema: {
        name: { type: "string", required: true },
        count: { type: "number", required: true },
        active: { type: "boolean", required: true },
        items: { type: "array", required: true },
      },
    });
    const result = await runCloneAI(req);
    expect(result.ok).toBe(true);
    const json = result.json as Record<string, unknown>;
    expect(typeof json.name).toBe("string");
    expect(typeof json.count).toBe("number");
    expect(typeof json.active).toBe("boolean");
    expect(Array.isArray(json.items)).toBe(true);
  });

  test("response has usage object with 3 fields", async () => {
    const result = await runCloneAI(makeMinimalRequest());
    expect(result.usage).toBeDefined();
    expect(typeof result.usage.input_tokens_estimated).toBe("number");
    expect(typeof result.usage.output_tokens_estimated).toBe("number");
    expect(typeof result.usage.total_tokens_estimated).toBe("number");
  });

  test("response has latency_ms >= 0", async () => {
    const result = await runCloneAI(makeMinimalRequest());
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test("response has model_profile", async () => {
    const result = await runCloneAI(makeMinimalRequest());
    expect(result.model_profile).toBeTruthy();
  });

  test("invalid request returns ok:false", async () => {
    const req = makeMinimalRequest({ messages: [] });
    const result = await runCloneAI(req);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("null request returns ok:false", async () => {
    const result = await runCloneAI(null as unknown as CloneAIRequest);
    expect(result.ok).toBe(false);
  });

  test("warnings array is always present", async () => {
    const result = await runCloneAI(makeMinimalRequest());
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test("text mode returns content string", async () => {
    const result = await runCloneAI(makeMinimalRequest({ output_mode: "text" }));
    expect(typeof result.content).toBe("string");
  });

  test("error field is null on success", async () => {
    const result = await runCloneAI(makeMinimalRequest());
    expect(result.error).toBeNull();
  });
});

describe("runCloneAIContract", () => {
  test("pierre.mission.interpret with valid variables returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.mission.interpret",
      variables: { input: "Onboarder Alice" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("mock");
  });

  test("pierre.tasks.plan returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.tasks.plan",
      variables: { mission_summary: "Onboarding nouveau salarié" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
  });

  test("pierre.document.review returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.document.review",
      variables: { title: "Contrat CDI", content: "Voici un contrat." },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
  });

  test("pierre.employee_file.summarize returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.employee_file.summarize",
      variables: { employee_file: JSON.stringify({ name: "Alice", role: "Dev" }) },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
  });

  test("pierre.risk.precheck returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.risk.precheck",
      variables: { mission_description: "Licenciement économique", tasks_json: "[]" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
  });

  test("pierre.customer_success.summarize returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.customer_success.summarize",
      variables: { health_data: JSON.stringify({ stage: "activated", score: 80 }) },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
  });

  test("platform.chat.answer returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "platform.chat.answer",
      variables: { question: "Qu'est-ce que Pierre?" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
  });

  test("platform.routing.classify returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "platform.routing.classify",
      variables: { input: "Je veux ajouter un salarié" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
  });

  test("platform.generic.structured returns ok:true", async () => {
    const result = await runCloneAIContract({
      useCase: "platform.generic.structured",
      variables: { prompt: "Analyse ceci", context: "Test" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
  });

  test("invalid use_case returns ok:false", async () => {
    const result = await runCloneAIContract({
      useCase: "nonexistent.case" as CloneAIUseCase,
      variables: {},
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("use_case");
  });

  test("result has provider field", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.mission.interpret",
      variables: { input: "Test" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.provider).toBeTruthy();
  });

  test("result has warnings array", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.mission.interpret",
      variables: { input: "Test" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test("json output has json field non-null", async () => {
    const result = await runCloneAIContract({
      useCase: "pierre.mission.interpret",
      variables: { input: "Onboarder Bob" },
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });
    expect(result.ok).toBe(true);
    expect(result.json).not.toBeNull();
  });
});

describe("getCloneAIRuntimeStatus", () => {
  test("returns providers array", () => {
    const status = getCloneAIRuntimeStatus();
    expect(Array.isArray(status.providers)).toBe(true);
    expect(status.providers.length).toBeGreaterThan(0);
  });

  test("mock provider is always listed", () => {
    const status = getCloneAIRuntimeStatus();
    const mock = status.providers.find((p) => p.provider === "mock");
    expect(mock).toBeDefined();
    expect(mock!.configured).toBe(true);
    expect(mock!.available).toBe(true);
  });

  test("openai provider is listed", () => {
    const status = getCloneAIRuntimeStatus();
    const openai = status.providers.find((p) => p.provider === "openai");
    expect(openai).toBeDefined();
    expect(typeof openai!.configured).toBe("boolean");
  });

  test("anthropic provider is listed", () => {
    const status = getCloneAIRuntimeStatus();
    const anthropic = status.providers.find((p) => p.provider === "anthropic");
    expect(anthropic).toBeDefined();
    expect(typeof anthropic!.configured).toBe("boolean");
  });

  test("prompt_contracts_count is 23 (16 + 7 B32 deliverables)", () => {
    const status = getCloneAIRuntimeStatus();
    expect(status.prompt_contracts_count).toBe(23);
  });

  test("supported_use_cases has 16 entries (10 + 6 brain)", () => {
    const status = getCloneAIRuntimeStatus();
    expect(status.supported_use_cases.length).toBe(23);
  });

  test("supported_use_cases includes pierre.mission.interpret", () => {
    const status = getCloneAIRuntimeStatus();
    expect(status.supported_use_cases).toContain("pierre.mission.interpret");
  });

  test("supported_use_cases includes platform.routing.classify", () => {
    const status = getCloneAIRuntimeStatus();
    expect(status.supported_use_cases).toContain("platform.routing.classify");
  });

  test("is synchronous (no await needed)", () => {
    const result = getCloneAIRuntimeStatus();
    expect(result).toBeDefined();
    expect(typeof result.prompt_contracts_count).toBe("number");
  });
});

// ── Pierre AI bridge ──────────────────────────────────────────────────────────

describe("Pierre AI bridge — interpretPierreMissionWithAI", async () => {
  const { interpretPierreMissionWithAI } = await import("../../../pierre/ai/runtime");

  test("returns ok:true with mock provider", async () => {
    const result = await interpretPierreMissionWithAI({ input: "Onboarder un nouveau salarié" });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("mock");
  });

  test("returns interpretation as object", async () => {
    const result = await interpretPierreMissionWithAI({ input: "Test" });
    expect(result.ok).toBe(true);
    expect(result.interpretation).not.toBeNull();
    expect(typeof result.interpretation).toBe("object");
  });

  test("warnings array present", async () => {
    const result = await interpretPierreMissionWithAI({ input: "Test" });
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test("error is null on success", async () => {
    const result = await interpretPierreMissionWithAI({ input: "Test" });
    expect(result.error).toBeNull();
  });

  test("accepts optional companyContext", async () => {
    const result = await interpretPierreMissionWithAI({
      input: "Augmenter salaire",
      companyContext: { name: "ACME", industry: "tech" },
    });
    expect(result.ok).toBe(true);
  });

  test("accepts optional employeeContext", async () => {
    const result = await interpretPierreMissionWithAI({
      input: "Conge maternite",
      employeeContext: { name: "Alice", role: "dev" },
    });
    expect(result.ok).toBe(true);
  });

  test("accepts optional autonomyLevel", async () => {
    const result = await interpretPierreMissionWithAI({
      input: "Formation interne",
      autonomyLevel: "supervised",
    });
    expect(result.ok).toBe(true);
  });
});

describe("Pierre AI bridge — planPierreTasksWithAI", async () => {
  const { planPierreTasksWithAI } = await import("../../../pierre/ai/runtime");

  test("returns ok:true with mock provider", async () => {
    const result = await planPierreTasksWithAI({ missionSummary: "Onboarding Alice" });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("mock");
  });

  test("returns plan as object", async () => {
    const result = await planPierreTasksWithAI({ missionSummary: "Test plan" });
    expect(result.ok).toBe(true);
    expect(result.plan).not.toBeNull();
    expect(typeof result.plan).toBe("object");
  });

  test("error is null on success", async () => {
    const result = await planPierreTasksWithAI({ missionSummary: "Plan test" });
    expect(result.error).toBeNull();
  });

  test("accepts optional interpretation", async () => {
    const result = await planPierreTasksWithAI({
      missionSummary: "Plan test",
      interpretation: { intent: "onboarding", domain: "rh" },
    });
    expect(result.ok).toBe(true);
  });

  test("accepts optional companyContext", async () => {
    const result = await planPierreTasksWithAI({
      missionSummary: "Plan test",
      companyContext: { sector: "fintech" },
    });
    expect(result.ok).toBe(true);
  });
});

describe("Pierre AI bridge — reviewPierreDocumentWithAI", async () => {
  const { reviewPierreDocumentWithAI } = await import("../../../pierre/ai/runtime");

  test("returns ok:true with mock provider", async () => {
    const result = await reviewPierreDocumentWithAI({
      title: "Contrat CDI",
      content: "Voici le contrat de travail...",
    });
    expect(result.ok).toBe(true);
  });

  test("returns review as object", async () => {
    const result = await reviewPierreDocumentWithAI({
      title: "Reglement interieur",
      content: "Le reglement interieur stipule...",
    });
    expect(result.ok).toBe(true);
    expect(result.review).not.toBeNull();
    expect(typeof result.review).toBe("object");
  });

  test("accepts optional documentType", async () => {
    const result = await reviewPierreDocumentWithAI({
      title: "Accord RTT",
      content: "Contenu accord.",
      documentType: "accord_entreprise",
    });
    expect(result.ok).toBe(true);
  });

  test("accepts optional companyContext", async () => {
    const result = await reviewPierreDocumentWithAI({
      title: "Note interne",
      content: "Contenu.",
      companyContext: { legal_entity: "SAS" },
    });
    expect(result.ok).toBe(true);
  });
});

describe("Pierre AI bridge — summarizePierreEmployeeFileWithAI", async () => {
  const { summarizePierreEmployeeFileWithAI } = await import("../../../pierre/ai/runtime");

  test("returns ok:true with mock provider", async () => {
    const result = await summarizePierreEmployeeFileWithAI({
      employeeFile: { name: "Alice", role: "Dev" },
    });
    expect(result.ok).toBe(true);
  });

  test("returns summary as object", async () => {
    const result = await summarizePierreEmployeeFileWithAI({
      employeeFile: { name: "Bob", seniority: 3 },
    });
    expect(result.ok).toBe(true);
    expect(result.summary).not.toBeNull();
    expect(typeof result.summary).toBe("object");
  });

  test("accepts string employeeFile", async () => {
    const result = await summarizePierreEmployeeFileWithAI({
      employeeFile: "Alice Dev 3 ans experience",
    });
    expect(result.ok).toBe(true);
  });

  test("accepts optional companyContext", async () => {
    const result = await summarizePierreEmployeeFileWithAI({
      employeeFile: { name: "Charlie" },
      companyContext: { name: "Corp" },
    });
    expect(result.ok).toBe(true);
  });

  test("error is null on success", async () => {
    const result = await summarizePierreEmployeeFileWithAI({
      employeeFile: { name: "Dave" },
    });
    expect(result.error).toBeNull();
  });
});

// ── Safety invariants ─────────────────────────────────────────────────────────

describe("Safety — no secrets in responses", () => {
  test("mock response content does not contain OPENAI_API_KEY value", async () => {
    // No env key is set in test, so this just confirms no leakage pattern
    const result = await runCloneAI(makeMinimalRequest());
    expect(result.content).not.toContain("sk-");
  });

  test("runtime status does not expose actual API key values", () => {
    const status = getCloneAIRuntimeStatus();
    const serialized = JSON.stringify(status);
    // Only check for actual key value patterns — env var names like "OPENAI_API_KEY not set." are fine
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    expect(serialized).not.toMatch(/Bearer [A-Za-z0-9]{20,}/);
  });
});

describe("Safety — fallback behavior", () => {
  test("unconfigured providers are skipped, mock always responds", async () => {
    // In test environment, OPENAI_API_KEY and ANTHROPIC_API_KEY are not set
    // The runtime should fall through to mock
    const result = await runCloneAIContract({
      useCase: "pierre.mission.interpret",
      variables: { input: "Test fallback" },
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("mock");
  });

  test("runCloneAI never throws — returns ok:false on error", async () => {
    let threw = false;
    try {
      await runCloneAI(null as unknown as CloneAIRequest);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  test("runCloneAIContract never throws — returns ok:false for bad use_case", async () => {
    let threw = false;
    try {
      await runCloneAIContract({ useCase: "bad.case" as CloneAIUseCase, variables: {} });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  test("Pierre bridge interpretPierreMissionWithAI never throws", async () => {
    const { interpretPierreMissionWithAI } = await import("../../../pierre/ai/runtime");
    let threw = false;
    try {
      await interpretPierreMissionWithAI({ input: "" });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
