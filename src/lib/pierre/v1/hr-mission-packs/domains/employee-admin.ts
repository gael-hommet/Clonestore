// src/lib/pierre/v1/hr-mission-packs/domains/employee-admin.ts
// PHASE 8.11 — Employee 360 administration + data rights (domains F & S). The employee360 mutations
// are VERIFIED_EXISTING; the P8.11 gap here is data_gdpr.right_to_object. This pack composes the
// verified admin primitives with the objection workflow.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, cc } from "../schema";

export const EMPLOYEE_ADMIN_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "data_gdpr.right_to_object", domain: "data_gdpr", title: "Right to object / opt-out of a processing category",
    description: "Record an employee's objection to a processing category, apply the restriction, confirm, and keep the proof.",
    capabilityIds: ["data_gdpr.right_to_object"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("record_objection", "mutate_record", "Record the objection + scope", "mission.noop", { dependsOn: ["validate"] }),
      svc("apply_restriction", "mutate_record", "Apply the processing restriction (comms preferences/consent)", "communications.preferences", { dependsOn: ["record_objection"] }),
      rt("confirm", "communicate", "Confirm the restriction to the employee", "communication.create_intent", { dependsOn: ["apply_restriction"] }),
      ...closeSkeleton("confirm"),
    ],
    countryRuleRequirements: [{ ruleFamily: "data_protection", required: true, notes: "national GDPR specifics = P8.12" }],
    permissions: [{ permission: "gdpr.admin", scope: "company" }],
    completionCriteria: [cc("objection.applied", "Restriction applied.", "mutation"), cc("objection.confirmed", "Employee confirmed.", "communication")],
    runtimeStatus: "COUNTRY_RULES_REQUIRED",
  }),
];
