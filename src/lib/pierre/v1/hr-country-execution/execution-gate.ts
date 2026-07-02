// src/lib/pierre/v1/hr-country-execution/execution-gate.ts
// PHASE 8.12 — the FAIL-CLOSED country execution gate. Given a mission pack + jurisdiction, it
// resolves the required country rules, freezes a rule snapshot, and evaluates every rule: the
// automated legally-sensitive path is allowed ONLY if every required rule is VERIFIED (human-
// reviewed) + fresh. Otherwise the mission is routed to the governed manual / human path — never
// executed on an unsourced or stale rule. Because P8.12 has 0 VERIFIED rules (no human reviewer),
// every country-dependent mission correctly routes to GOVERNED_MANUAL / HUMAN_DECISION.

import type { HrMissionPackDefinition } from "../hr-mission-packs/types";
import type { CountryExecutionContext, ExecutionGateResult } from "./types";
import { resolveRequiredRules, requiredRuleFamilies } from "./required-rules";
import { evaluateRules } from "../hr-canon/country-packs/rule-evaluator";
import { freezeRules } from "../hr-canon/country-packs/rule-snapshot";

export function evaluateExecutionGate(pack: HrMissionPackDefinition, ctx: CountryExecutionContext): ExecutionGateResult {
  const requiredFamilies = requiredRuleFamilies(pack);
  const { families } = resolveRequiredRules(pack, ctx.jurisdiction);
  const allRules = families.flatMap((f) => f.rules);
  const snapshot = freezeRules(ctx.jurisdiction, allRules.map((r) => ({ rule: r.rule, family: r.family })), ctx.nowIso);

  // families that are required but absent from the country pack are a hard block
  const missingFamilies = families.filter((f) => !f.found).map((f) => f.family);
  const evaluation = evaluateRules(allRules, { nowIso: ctx.nowIso });

  const blockedByFamily = new Map<string, string[]>();
  for (const b of evaluation.blocked) {
    const fam = allRules.find((r) => r.rule.key === b.key)?.family ?? "unknown";
    blockedByFamily.set(fam, [...(blockedByFamily.get(fam) ?? []), b.key]);
  }
  const blockedRules = [
    ...missingFamilies.map((fam) => ({ family: fam, ruleKeys: [], reason: "required rule family absent from country pack" })),
    ...[...blockedByFamily.entries()].map(([family, ruleKeys]) => ({ family, ruleKeys, reason: "rule not VERIFIED/fresh — legally-sensitive automation blocked" })),
  ];

  const allowed = requiredFamilies.length > 0 && missingFamilies.length === 0 && evaluation.allUsable && snapshot.allVerified;
  // route: verified-automated if allowed; else the pack's governed fallback (human decision vs manual)
  const route = allowed ? "AUTOMATED_VERIFIED"
    : pack.runtimeStatus === "HUMAN_DECISION_REQUIRED" ? "HUMAN_DECISION"
    : pack.runtimeStatus === "RUNTIME_READY_EXTERNAL_BLOCKED" ? "EXTERNAL_BLOCKED"
    : "GOVERNED_MANUAL";

  return {
    packId: pack.id, jurisdiction: ctx.jurisdiction, allowed, requiredFamilies,
    blockedRules, snapshotId: snapshot.snapshotId,
    route,
    reason: allowed ? "all required rules VERIFIED + fresh" : `blocked: ${blockedRules.length} rule family/families not usable → routed to ${route}`,
  };
}
