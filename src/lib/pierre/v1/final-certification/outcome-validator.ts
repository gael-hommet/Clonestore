// src/lib/pierre/v1/final-certification/outcome-validator.ts
// PHASE 8.13 — validate a scenario outcome: it reached the expected terminal state, compiled on the
// real runtime, and NO forbidden effect occurred (fabricated provider success, invented law, etc.).
import type { HrCertificationScenario, ScenarioOutcome } from "./types";

export function validateOutcome(sc: HrCertificationScenario, out: ScenarioOutcome): string[] {
  const e: string[] = [];
  if (!out.ran) e.push(`${sc.id}: did not run`);
  if (!out.compiled) e.push(`${sc.id}: mission pack did not compile on the real runtime`);
  if (out.terminalState !== sc.expectedTerminalState) e.push(`${sc.id}: terminal ${out.terminalState} != expected ${sc.expectedTerminalState}`);
  for (const f of out.forbiddenEffectsObserved) e.push(`${sc.id}: FORBIDDEN effect observed: ${f}`);
  return e;
}

export function validateAllOutcomes(pairs: { sc: HrCertificationScenario; out: ScenarioOutcome }[]): { ok: boolean; errors: string[] } {
  const errors = pairs.flatMap(({ sc, out }) => validateOutcome(sc, out));
  return { ok: errors.length === 0, errors };
}
