// src/lib/pierre/v1/hr-country-execution/communication-binding.ts
// PHASE 8.12 — which communications require country legal review before being sent. Sensitive HR
// communications (disciplinary summons, dismissal notice, contract change) carry legal wording that
// depends on VERIFIED country rules; they cannot be auto-sent until the rule is VERIFIED.
import type { HrMissionPackDefinition } from "../hr-mission-packs/types";

const LEGALLY_SENSITIVE_TEMPLATE_FAMILIES = [/dismiss/i, /disciplin/i, /termination/i, /summons/i, /convocation/i, /notice/i, /contract/i, /offer/i];

export type CommunicationBinding = { templateFamily: string; legallySensitive: boolean; requiresCountryReview: boolean };

export function communicationBindings(pack: HrMissionPackDefinition): CommunicationBinding[] {
  return pack.expectedCommunications.map((c) => {
    const sensitive = LEGALLY_SENSITIVE_TEMPLATE_FAMILIES.some((re) => re.test(c.templateFamily));
    return { templateFamily: c.templateFamily, legallySensitive: sensitive, requiresCountryReview: sensitive };
  });
}
