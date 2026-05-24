// src/lib/pierre/scenarios/validator.ts
// Pierre Golden Scenarios — Check Assertion Engine
// Pure module: no Supabase, no Next, no async, no side effects.

import type {
  PierreGoldenScenarioCheck,
  PierreGoldenScenarioCheckResult,
  PierreGoldenScenarioArtifact,
} from "./types";

// ══════════════════════════════════════════════════════════════
// 1. PATH RESOLVER
// ══════════════════════════════════════════════════════════════

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  if (!path || path === "") return obj;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ══════════════════════════════════════════════════════════════
// 2. ASSERTION ENGINE
// ══════════════════════════════════════════════════════════════

function runAssertion(
  assertion: PierreGoldenScenarioCheck["assertion"],
  actual: unknown,
  expected: unknown,
): { passed: boolean; error?: string } {
  try {
    switch (assertion) {
      case "exists":
        return { passed: actual !== undefined && actual !== null };

      case "not_null":
        return { passed: actual !== null && actual !== undefined };

      case "is_true":
        return { passed: actual === true };

      case "is_false":
        return { passed: actual === false };

      case "equals":
        return { passed: actual === expected };

      case "contains":
        if (typeof actual === "string" && typeof expected === "string") {
          return { passed: actual.includes(expected) };
        }
        if (Array.isArray(actual)) {
          return { passed: actual.includes(expected) };
        }
        return { passed: false, error: "contains: actual must be string or array" };

      case "length_gt":
        if (Array.isArray(actual)) {
          const len = actual.length;
          const min = typeof expected === "number" ? expected : 0;
          return { passed: len > min };
        }
        if (typeof actual === "string") {
          const len = actual.length;
          const min = typeof expected === "number" ? expected : 0;
          return { passed: len > min };
        }
        return { passed: false, error: "length_gt: actual must be string or array" };

      case "is_array":
        return { passed: Array.isArray(actual) };

      case "is_string":
        return { passed: typeof actual === "string" && actual.length > 0 };

      case "is_number":
        return {
          passed: typeof actual === "number" && Number.isFinite(actual),
        };

      case "matches_status":
        if (typeof actual === "string" && typeof expected === "string") {
          return { passed: actual === expected };
        }
        return { passed: false, error: "matches_status: expected string" };

      default:
        return { passed: false, error: `Unknown assertion: ${String(assertion)}` };
    }
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Assertion threw",
    };
  }
}

// ══════════════════════════════════════════════════════════════
// 3. CHECK RUNNER
// ══════════════════════════════════════════════════════════════

export function runScenarioCheck(
  check: PierreGoldenScenarioCheck,
  artifacts: PierreGoldenScenarioArtifact[],
): PierreGoldenScenarioCheckResult {
  const artifact = artifacts.find((a) => a.type === check.artifact_type);

  if (!artifact) {
    return {
      check_id: check.id,
      label: check.label,
      passed: false,
      actual: undefined,
      expected: check.expected,
      error: `Artifact '${check.artifact_type}' not found`,
    };
  }

  if (!artifact.valid) {
    return {
      check_id: check.id,
      label: check.label,
      passed: false,
      actual: undefined,
      expected: check.expected,
      error: `Artifact '${check.artifact_type}' is invalid: ${artifact.error ?? "unknown error"}`,
    };
  }

  const actual = resolvePath(artifact.data, check.path);
  const result = runAssertion(check.assertion, actual, check.expected);

  return {
    check_id: check.id,
    label: check.label,
    passed: result.passed,
    actual,
    expected: check.expected,
    error: result.error,
  };
}

export function runAllChecks(
  checks: PierreGoldenScenarioCheck[],
  artifacts: PierreGoldenScenarioArtifact[],
): PierreGoldenScenarioCheckResult[] {
  return checks.map((check) => runScenarioCheck(check, artifacts));
}

// ══════════════════════════════════════════════════════════════
// 4. VALIDATION HELPERS
// ══════════════════════════════════════════════════════════════

export function validateScenarioInput(input: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    errors.push("Input must be a non-null object");
    return { valid: false, errors };
  }
  const obj = input as Record<string, unknown>;
  if (!obj["id"] || typeof obj["id"] !== "string") {
    errors.push("Missing or invalid field: id");
  }
  if (!obj["request_text"] && obj["request_text"] !== "") {
    errors.push("Missing field: request_text");
  }
  return { valid: errors.length === 0, errors };
}

export function validateRequestText(text: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof text !== "string") {
    return { valid: false, error: "request_text must be a string" };
  }
  if (text.trim().length === 0) {
    return { valid: false, error: "request_text cannot be empty" };
  }
  return { valid: true };
}

export function buildValidationErrorArtifact(errors: string[]): import("./types").PierreGoldenScenarioArtifact {
  return {
    type: "validation_error",
    label: "Validation Error",
    data: {
      error_code: "INVALID_INPUT",
      message: errors.join("; "),
      errors,
      handled: true,
    },
    valid: true,
  };
}

// ══════════════════════════════════════════════════════════════
// 5. TASK DRAFT SAFETY CHECKS
// ══════════════════════════════════════════════════════════════

export function buildTaskDraftSafetyData(
  tasks: Record<string, unknown>[],
): Record<string, unknown> {
  const hasEmailSend = tasks.some((t) => {
    const type = String(t["type"] ?? "");
    return (
      type === "email.send" ||
      type === "email_send" ||
      type === "send_email"
    );
  });

  const hasScheduledFor = tasks.some((t) => {
    return (
      "scheduled_for" in t &&
      t["scheduled_for"] !== null &&
      t["scheduled_for"] !== undefined
    );
  });

  return {
    tasks,
    has_email_send: hasEmailSend,
    has_scheduled_for: hasScheduledFor,
    task_count: tasks.length,
  };
}

// ══════════════════════════════════════════════════════════════
// 6. RESULT AGGREGATION
// ══════════════════════════════════════════════════════════════

export function computeCheckSummary(results: PierreGoldenScenarioCheckResult[]): {
  checks_total: number;
  checks_passed: number;
  checks_failed: number;
} {
  const checks_total = results.length;
  const checks_passed = results.filter((r) => r.passed).length;
  const checks_failed = checks_total - checks_passed;
  return { checks_total, checks_passed, checks_failed };
}

export function determineScenarioStatus(
  checkResults: PierreGoldenScenarioCheckResult[],
  expectedStatus: import("./types").PierreGoldenScenarioExpectedStatus,
): import("./types").PierreGoldenScenarioExpectedStatus {
  const failed = checkResults.filter((r) => !r.passed);
  if (failed.length === 0) return "pass";
  if (failed.length < checkResults.length) return "warn";
  return "fail";
}
