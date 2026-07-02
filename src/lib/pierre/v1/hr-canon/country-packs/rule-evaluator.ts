// src/lib/pierre/v1/hr-canon/country-packs/rule-evaluator.ts
// PHASE 8.12 — evaluate a country rule for OPERATIONAL use. FAIL-CLOSED: a rule may only be relied on
// if it is VERIFIED (human-reviewed) AND fresh AND carries a value. Anything else → not usable, with
// an explicit reason. This is what stops a legally-sensitive act from running on an unsourced or
// stale rule.

import type { CountryRule } from "./types";
import { isRuleReliable } from "./source-contract";
import { evaluateFreshness } from "./source-freshness";

export type RuleUsability = {
  usable: boolean;
  status: CountryRule["status"];
  value: CountryRule["value"];
  reason: string;
};

export function evaluateRule(rule: CountryRule, ruleFamily: string, opts: { retrievedAt?: string | null; nowIso?: string } = {}): RuleUsability {
  if (!isRuleReliable(rule)) return { usable: false, status: rule.status, value: null, reason: `not VERIFIED (status=${rule.status}) — legally-sensitive use blocked` };
  if (rule.value === null || rule.value === undefined) return { usable: false, status: rule.status, value: null, reason: "VERIFIED but no value — blocked" };
  if (opts.nowIso) {
    const fresh = evaluateFreshness(ruleFamily, opts.retrievedAt ?? null, opts.nowIso);
    if (!fresh.fresh) return { usable: false, status: rule.status, value: rule.value, reason: `stale: ${fresh.reason} — re-source + re-review required` };
  }
  return { usable: true, status: rule.status, value: rule.value, reason: "verified + fresh" };
}

/** Evaluate a set of rules; usable only if ALL are usable. Returns the blocking reasons. */
export function evaluateRules(rules: { rule: CountryRule; family: string }[], opts: { nowIso?: string } = {}): { allUsable: boolean; blocked: { key: string; reason: string }[] } {
  const blocked: { key: string; reason: string }[] = [];
  for (const { rule, family } of rules) {
    const r = evaluateRule(rule, family, opts);
    if (!r.usable) blocked.push({ key: rule.key, reason: r.reason });
  }
  return { allUsable: blocked.length === 0, blocked };
}
