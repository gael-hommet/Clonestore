// src/lib/pierre/v1/hr-country-execution/deadline-binding.ts
// PHASE 8.12 — which mission deadlines are STATUTORY (country-defined) vs operational. A statutory
// deadline's duration is a VERIFIED country rule; until then Pierre may watch/alert on the deadline
// but cannot assert the exact legal delay. Derived from the pack's country rule requirements.
import type { HrMissionPackDefinition } from "../hr-mission-packs/types";

// rule families that define statutory deadlines
const DEADLINE_FAMILIES = new Set(["notice_periods", "disciplinary_procedure", "probation_periods", "fixed_term_rules", "document_retention", "sick_leave", "parental_leave"]);

export type DeadlineBinding = { ruleFamily: string; statutory: boolean; note: string };

export function deadlineBindings(pack: HrMissionPackDefinition): DeadlineBinding[] {
  return pack.countryRuleRequirements
    .filter((r) => DEADLINE_FAMILIES.has(r.ruleFamily))
    .map((r) => ({ ruleFamily: r.ruleFamily, statutory: true, note: "exact legal delay requires a VERIFIED country rule (P8.12); Pierre watches/alerts meanwhile" }));
}
