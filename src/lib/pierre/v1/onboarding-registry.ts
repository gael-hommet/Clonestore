// src/lib/pierre/v1/onboarding-registry.ts
// PHASE 8.6 — versioned, server-authoritative ONBOARDING registry (spec §20/§21).
//
// The onboarding is NOT a front-end progress bar. The SERVER decides whether a step is really complete.
// This registry is the single source of the canonical Pierre onboarding: the ordered steps, which are
// required, the permission needed to complete each, dependencies, re-openability and sensitivity. The
// provisioning service seeds pierre_rt_onboarding_steps from this registry; the onboarding service
// validates completion against it.

export type OnboardingSensitivity = "normal" | "sensitive";

export type OnboardingStepDefinition = {
  step_key: string;
  version: string;
  /** A required step must be completed before the company can become `ready`. */
  required: boolean;
  /** Permission a member must hold to complete this step. */
  permission: string;
  /** Step keys that must be completed first. */
  dependencies: string[];
  /** May an administrator/governance re-open this step after completion. */
  can_reopen: boolean;
  sensitivity: OnboardingSensitivity;
  /** Human-facing title (private UI). */
  title: string;
};

export const ONBOARDING_SCHEMA_VERSION = "1";

/** Canonical Pierre onboarding steps, in order. */
export const PIERRE_ONBOARDING_STEPS: readonly OnboardingStepDefinition[] = [
  { step_key: "company_identity",           version: "1", required: true,  permission: "company.write", dependencies: [],                                       can_reopen: true,  sensitivity: "normal",    title: "Identité de l'entreprise" },
  { step_key: "company_legal_information",  version: "1", required: true,  permission: "company.write", dependencies: ["company_identity"],                      can_reopen: true,  sensitivity: "normal",    title: "Informations légales" },
  { step_key: "hr_contacts",                version: "1", required: true,  permission: "company.admin", dependencies: ["company_identity"],                      can_reopen: true,  sensitivity: "normal",    title: "Responsables RH" },
  { step_key: "approval_responsibilities",  version: "1", required: true,  permission: "company.admin", dependencies: ["hr_contacts"],                          can_reopen: true,  sensitivity: "normal",    title: "Responsabilités de validation" },
  { step_key: "signature_configuration",    version: "1", required: true,  permission: "company.admin", dependencies: ["hr_contacts"],                          can_reopen: true,  sensitivity: "sensitive", title: "Configuration des signatures" },
  { step_key: "communication_preferences",  version: "1", required: true,  permission: "company.write", dependencies: ["company_identity"],                      can_reopen: true,  sensitivity: "normal",    title: "Préférences de communication" },
  { step_key: "team_members",               version: "1", required: true,  permission: "tenancy.admin", dependencies: ["hr_contacts"],                          can_reopen: true,  sensitivity: "normal",    title: "Membres de l'équipe" },
  { step_key: "employee_data",              version: "1", required: false, permission: "employee.write", dependencies: ["company_identity"],                     can_reopen: true,  sensitivity: "normal",    title: "Premiers salariés" },
  { step_key: "hr_policies",                version: "1", required: true,  permission: "company.admin", dependencies: ["approval_responsibilities"],            can_reopen: true,  sensitivity: "normal",    title: "Politiques RH" },
  { step_key: "first_mission_ready",        version: "1", required: true,  permission: "mission.create", dependencies: ["approval_responsibilities","signature_configuration","hr_policies"], can_reopen: true, sensitivity: "normal", title: "Première mission prête" },
];

/** The product → registry mapping (only Pierre exists today). An unknown product is REFUSED (never
 *  silently defaulted to the Pierre registry). */
export function getOnboardingRegistry(productKey = "pierre"): readonly OnboardingStepDefinition[] {
  if (productKey === "pierre") return PIERRE_ONBOARDING_STEPS;
  const err = new Error(`unknown onboarding product: ${productKey}`);
  (err as Error & { code?: string; status?: number }).code = "unknown_product";
  (err as Error & { code?: string; status?: number }).status = 422;
  throw err;
}

/** The compact step seed (step_key + required) the provisioning function expects as JSON. */
export function onboardingStepSeed(productKey = "pierre"): Array<{ step_key: string; required: boolean }> {
  return getOnboardingRegistry(productKey).map((s) => ({ step_key: s.step_key, required: s.required }));
}

export function getOnboardingStep(stepKey: string, productKey = "pierre"): OnboardingStepDefinition | null {
  return getOnboardingRegistry(productKey).find((s) => s.step_key === stepKey) ?? null;
}
