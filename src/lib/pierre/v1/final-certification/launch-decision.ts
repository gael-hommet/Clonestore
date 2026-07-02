// src/lib/pierre/v1/final-certification/launch-decision.ts
// PHASE 8.13 — the final owner decision: the exact answers to the 5 owner questions, with the two
// dimensions kept strictly separate. Functional completeness can be CERTIFIED while country
// authorization is NOT GRANTED and production stays NOT AUTHORIZED. No dimension is inflated.
import type { FinalDecision } from "./types";
import { certifyAllCapabilities } from "./functional-coverage";
import { countryReadiness } from "./country-readiness";
import { HR_MISSION_PACKS } from "../hr-mission-packs/registry";

export function buildLaunchDecision(env: NodeJS.ProcessEnv = process.env): FinalDecision {
  const cov = certifyAllCapabilities();
  const country = countryReadiness(env);
  const countryAuthorization: Record<string, boolean> = {};
  for (const c of country.countries) countryAuthorization[c.country] = c.launchGrade;

  const functionalCertification = cov.functionallyComplete ? "CERTIFIED" : "INCOMPLETE";
  const anyCountry = country.launchGradeCount > 0;

  const answers = {
    q1_end_to_end: cov.functionallyComplete
      ? `YES (functional). All ${cov.totalCapabilities} capabilities across 22 domains have a governed certified path (automated / after-approval / human / manual-governed / explicit fail-closed).`
      : `NO. ${cov.notCertified} capabilities have no governed path.`,
    q2_real_results: `YES for verified capabilities (real mutations/documents/communications proven in P8.9–P8.11); orchestration certified on the real runtime for the rest. No fabricated results.`,
    q3_customer_self_service: `YES for functional operations (missions/approvals/manual handoffs — no code/SQL/provider wiring). Automatic country-legal execution is NOT self-service until dimension B is met.`,
    q4_launch_now: `Functional HR backend + ${cov.byState.CERTIFIED_AUTOMATED ?? 0} automated + ${cov.byState.CERTIFIED_AFTER_APPROVAL ?? 0} after-approval + ${cov.byState.CERTIFIED_MANUAL_GOVERNED_PATH ?? 0} manual-governed + ${cov.byState.CERTIFIED_HUMAN_DECISION ?? 0} human-decision capabilities. NOT automatic country-legal execution, NOT e-signature, NOT payroll computation.`,
    q5_blocked_why: `Automatic country execution (0 VERIFIED rules → legal review), providers (not integrated), Yousign (P8.7.4), production unblock (deploy-block + owner gate). ${country.launchGradeCount}/4 countries launch-grade.`,
  };

  return {
    functionalCertification,
    countryAuthorization,
    productionUnblock: "NOT_AUTHORIZED", // never auto-authorized; requires the separate owner gate + lifted blockers
    answers,
  };
}

export function decisionSummary(env: NodeJS.ProcessEnv = process.env) {
  const cov = certifyAllCapabilities();
  const country = countryReadiness(env);
  const decision = buildLaunchDecision(env);
  return {
    dimensionA_functional: { certified: cov.certified, total: cov.totalCapabilities, complete: cov.functionallyComplete, byState: cov.byState },
    dimensionB_country: { launchGrade: country.launchGradeCount, of: 4, countries: country.countries.map((c) => ({ country: c.country, launchGrade: c.launchGrade, rulesVerified: c.rulesVerified, blockers: c.blockers.length })) },
    productionUnblock: decision.productionUnblock,
    packs: HR_MISSION_PACKS.length,
    decision,
  };
}
