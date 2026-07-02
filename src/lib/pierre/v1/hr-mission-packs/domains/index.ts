// src/lib/pierre/v1/hr-mission-packs/domains/index.ts
// PHASE 8.11 — aggregate every declarative domain pack into ALL_DOMAIN_PACKS.
import type { HrMissionPackDefinition } from "../types";
import { ORGANISATION_PACKS } from "./organisation";
import { RECRUITMENT_PACKS } from "./recruitment";
import { OFFER_PACKS } from "./offers";
import { CONTRACT_CHANGE_PACKS } from "./contract-changes";
import { ONBOARDING_PACKS } from "./onboarding";
import { EMPLOYEE_ADMIN_PACKS } from "./employee-admin";
import { ABSENCE_PACKS } from "./absence-time";
import { PAYROLL_PACKS } from "./payroll-operations";
import { COMPENSATION_PACKS } from "./compensation";
import { PERFORMANCE_PACKS } from "./performance";
import { TRAINING_PACKS } from "./training";
import { CAREER_PACKS } from "./career-mobility";
import { RELATIONS_PACKS } from "./employee-relations";
import { DISCIPLINARY_PACKS } from "./disciplinary";
import { HEALTH_PACKS } from "./health-safety";
import { COMMUNICATION_PACKS } from "./communications";
import { POLICY_PACKS } from "./policies";
import { OFFBOARDING_PACKS } from "./offboarding";
import { REPORTING_PACKS } from "./reporting";
import { PROACTIVE_PACKS } from "./proactive";
import { ADMINISTRATION_PACKS } from "./administration";

export const ALL_DOMAIN_PACKS: readonly HrMissionPackDefinition[] = [
  ...ORGANISATION_PACKS, ...RECRUITMENT_PACKS, ...OFFER_PACKS, ...CONTRACT_CHANGE_PACKS, ...ONBOARDING_PACKS,
  ...EMPLOYEE_ADMIN_PACKS, ...ABSENCE_PACKS, ...PAYROLL_PACKS, ...COMPENSATION_PACKS, ...PERFORMANCE_PACKS,
  ...TRAINING_PACKS, ...CAREER_PACKS, ...RELATIONS_PACKS, ...DISCIPLINARY_PACKS, ...HEALTH_PACKS,
  ...COMMUNICATION_PACKS, ...POLICY_PACKS, ...OFFBOARDING_PACKS, ...REPORTING_PACKS, ...PROACTIVE_PACKS,
  ...ADMINISTRATION_PACKS,
];
