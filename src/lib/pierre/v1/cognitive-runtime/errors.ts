// src/lib/pierre/v1/cognitive-runtime/errors.ts
// PHASE 8.14 — typed, fail-closed errors for the cognitive runtime. Never leak secrets, prompts, raw
// model reasoning, or another tenant's context in an error message.

export type CognitiveErrorCode =
  | "EMPTY_INSTRUCTION"
  | "PROPOSER_FAILED"
  | "NO_STEPS_PROPOSED"
  | "INVENTED_ACTION"          // model proposed an action_key not in the closed registry
  | "PLAN_COMPILE_REJECTED"    // compileMissionPlan returned blockers
  | "BUDGET_EXCEEDED"
  | "TENANT_MISMATCH"
  | "UNSUPPORTED";

export class CognitiveError extends Error {
  readonly code: CognitiveErrorCode;
  readonly detail: string;
  constructor(code: CognitiveErrorCode, detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.name = "CognitiveError";
    this.code = code;
    this.detail = detail;
  }
}

export function isCognitiveError(e: unknown): e is CognitiveError {
  return e instanceof CognitiveError;
}
