// src/lib/cloneos/ai/cost-shield/errors.ts
// B38A — Cost Shield error types. Never expose API keys or prompts in errors.

import type { AiCostShieldDecision } from "./types";

export class AiCostShieldError extends Error {
  readonly decision: AiCostShieldDecision;
  readonly internal_code: string;

  constructor(decision: AiCostShieldDecision) {
    super(`[AiCostShield] ${decision.internal_code}: ${decision.reason}`);
    this.name = "AiCostShieldError";
    this.decision = decision;
    this.internal_code = decision.internal_code;
  }
}

export function isAiCostShieldError(err: unknown): err is AiCostShieldError {
  return err instanceof AiCostShieldError;
}
