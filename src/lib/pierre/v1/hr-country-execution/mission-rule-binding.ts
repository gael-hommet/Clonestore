// src/lib/pierre/v1/hr-country-execution/mission-rule-binding.ts
// PHASE 8.12 — bind a P8.11 mission pack to a jurisdiction: resolve required rules, freeze a rule
// snapshot, run the fail-closed gate. This is the single call a runtime makes to know whether a
// country-dependent mission may run automatically or must take the governed manual/human path.

import type { HrMissionPackDefinition } from "../hr-mission-packs/types";
import type { Jurisdiction } from "../hr-canon/country-packs/types";
import { evaluateExecutionGate } from "./execution-gate";
import { resolveRequiredRules } from "./required-rules";
import { freezeRules } from "../hr-canon/country-packs/rule-snapshot";
import type { ExecutionGateResult } from "./types";
import type { RuleSnapshot } from "../hr-canon/country-packs/rule-snapshot";

export type MissionRuleBinding = {
  packId: string;
  jurisdiction: Jurisdiction;
  snapshot: RuleSnapshot;
  gate: ExecutionGateResult;
  requiredFamilies: string[];
};

export function bindMissionToJurisdiction(pack: HrMissionPackDefinition, jurisdiction: Jurisdiction, nowIso: string): MissionRuleBinding {
  const { families } = resolveRequiredRules(pack, jurisdiction);
  const snapshot = freezeRules(jurisdiction, families.flatMap((f) => f.rules).map((r) => ({ rule: r.rule, family: r.family })), nowIso);
  const gate = evaluateExecutionGate(pack, { packId: pack.id, jurisdiction, nowIso });
  return { packId: pack.id, jurisdiction, snapshot, gate, requiredFamilies: families.map((f) => f.family) };
}
