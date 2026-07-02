// src/lib/pierre/v1/hr-mission-packs/domains/administration.ts
// PHASE 8.11 — Pierre administration (domain V). Gap: country_config (jurisdiction resolution +
// country-pack binding). Uses the P8.10 country-pack architecture; legal VALUES stay P8.12.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, cc } from "../schema";

export const ADMINISTRATION_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "pierre_admin.country_config", domain: "pierre_admin", title: "Configure company country / jurisdiction",
    description: "Resolve the company/site jurisdiction and bind the P8.10 country pack; fail closed on unsupported jurisdictions (never guess). Legal rule values remain P8.12.",
    capabilityIds: ["pierre_admin.country_config"], subjectTypes: ["company", "site"],
    steps: [
      ...intakeSkeleton(),
      svc("resolve_country", "validate", "Resolve jurisdiction (site>company, fail-closed)", "pierre_admin.country_config", { dependsOn: ["validate"] }),
      rt("bind_pack", "mutate_record", "Bind the country pack (scaffold; values are P8.12)", "mission.noop", { dependsOn: ["resolve_country"] }),
      rt("approve", "request_approval", "Confirm the country configuration", "approval.request", { dependsOn: ["bind_pack"], autonomy: "execute_with_validation" }),
      ...closeSkeleton("approve"),
    ],
    approvals: [{ when: "always", approver: "admin", reason: "country configuration governs legal behaviour" }],
    countryRuleRequirements: [{ ruleFamily: "collective_agreements", required: false, notes: "actual rule values loaded in P8.12" }],
    completionCriteria: [cc("country.bound", "Country pack bound.", "mutation"), cc("country.closed", "Terminal state.", "state")],
    runtimeStatus: "COUNTRY_RULES_REQUIRED",
  }),
];
