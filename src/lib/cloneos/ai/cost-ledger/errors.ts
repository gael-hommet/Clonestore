// src/lib/cloneos/ai/cost-ledger/errors.ts
// B38C — Ledger error types. Never expose API keys, prompts, or completions.

export class AiCostLedgerError extends Error {
  readonly code: string;

  constructor(message: string, code = "LEDGER_ERROR") {
    super(message);
    this.name = "AiCostLedgerError";
    this.code = code;
  }
}

export class AiCostLedgerWriteError extends AiCostLedgerError {
  constructor(message: string) {
    super(message, "LEDGER_WRITE_ERROR");
    this.name = "AiCostLedgerWriteError";
  }
}

export class AiCostLedgerUnavailableError extends AiCostLedgerError {
  constructor(message: string) {
    super(message, "LEDGER_UNAVAILABLE");
    this.name = "AiCostLedgerUnavailableError";
  }
}

export function isAiCostLedgerError(err: unknown): err is AiCostLedgerError {
  return err instanceof AiCostLedgerError;
}
