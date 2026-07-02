// src/lib/pierre/v1/hr-canon/country-packs/rule-conflicts.ts
// PHASE 8.12 — detect conflicts when several layers (statutory / sector / company / contract) speak
// to the same rule. Uses the P8.10 precedence model to pick the winner (structural only — never a
// legal value). Flags conflicts a human must arbitrate.

import type { RuleLayer, LayeredValue } from "./precedence";
import { resolvePrecedence } from "./precedence";

export type RuleConflict<T> = { ruleKey: string; layers: RuleLayer[]; winner: RuleLayer | null; needsHumanArbitration: boolean; rationale: string };

export function detectConflict<T>(ruleKey: string, layered: LayeredValue<T>[], opts: { favourabilityApplies?: boolean } = {}): RuleConflict<T> {
  const distinct = new Map<string, LayeredValue<T>>();
  for (const v of layered) distinct.set(JSON.stringify(v.value), v);
  const differing = distinct.size > 1;
  const res = resolvePrecedence(layered, { favourabilityApplies: !!opts.favourabilityApplies });
  // if favourability could apply but we can't prove it (no verified country rule), a human must arbitrate
  const needsHumanArbitration = differing && (opts.favourabilityApplies === undefined);
  return { ruleKey, layers: layered.map((l) => l.layer), winner: res.winner?.layer ?? null, needsHumanArbitration, rationale: res.rationale };
}
