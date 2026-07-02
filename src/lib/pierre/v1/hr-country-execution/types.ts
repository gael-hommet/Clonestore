// src/lib/pierre/v1/hr-country-execution/types.ts
// PHASE 8.12 — types binding a P8.11 mission pack to a P8.10 country pack for real, country-aware
// execution. The execution gate is FAIL-CLOSED: a legally-sensitive mission only proceeds when every
// required rule is VERIFIED (human-reviewed) + fresh; otherwise it is routed to the governed manual /
// human path with the outstanding legal review packets attached.

import type { Jurisdiction } from "../hr-canon/country-packs/types";

export type CountryExecutionContext = {
  packId: string;
  jurisdiction: Jurisdiction;
  subRegion?: string | null;
  nowIso: string;              // supplied by caller, never invented
};

export type RequiredRuleRef = { family: string; required: boolean };

export type GateBlockedRule = { family: string; ruleKeys: string[]; reason: string };

export type ExecutionGateResult = {
  packId: string;
  jurisdiction: Jurisdiction;
  allowed: boolean;                 // may the legally-sensitive path run?
  requiredFamilies: string[];
  blockedRules: GateBlockedRule[];  // non-empty ⇒ not allowed
  snapshotId: string | null;
  route: "AUTOMATED_VERIFIED" | "GOVERNED_MANUAL" | "HUMAN_DECISION" | "EXTERNAL_BLOCKED";
  reason: string;
};
