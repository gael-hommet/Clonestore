// src/lib/pierre/v1/final-certification/types.ts
// PHASE 8.13 — final HR certification types. TWO SEPARATE DIMENSIONS that must never be mixed:
//   A. FUNCTIONAL COMPLETENESS — does every HR capability have a real, governed, CERTIFIED path
//      (automated / after-approval / human-decision / manual-governed / fail-closed)?
//   B. COUNTRY PRODUCTION AUTHORIZATION — does a country have VERIFIED rules + live providers +
//      owner sign-off? (In this environment: none — 0 launch-grade.)
// A capability can be FUNCTIONALLY CERTIFIED while its automatic country execution stays BLOCKED.

export type HrCertificationState =
  | "CERTIFIED_AUTOMATED"            // verified autonomous execution
  | "CERTIFIED_AFTER_APPROVAL"       // executes after a required human validation
  | "CERTIFIED_HUMAN_DECISION"       // a legally-reserved human decision Pierre only assists/records
  | "CERTIFIED_MANUAL_GOVERNED_PATH" // a governed manual handoff completes it (provider not integrated)
  | "CERTIFIED_FAIL_CLOSED"          // correctly blocks pending a precondition (certified behaviour)
  | "BLOCKED_EXTERNAL"               // NO governed path without a real provider
  | "BLOCKED_LEGAL_REVIEW"           // NO governed path without a VERIFIED country rule
  | "NOT_CERTIFIED";                 // no path at all — a real gap

export const CERTIFIED_STATES: readonly HrCertificationState[] = [
  "CERTIFIED_AUTOMATED", "CERTIFIED_AFTER_APPROVAL", "CERTIFIED_HUMAN_DECISION",
  "CERTIFIED_MANUAL_GOVERNED_PATH", "CERTIFIED_FAIL_CLOSED",
];
export function isCertified(s: HrCertificationState): boolean { return CERTIFIED_STATES.includes(s); }

export type CertificationMode = "AUTOMATED" | "AFTER_APPROVAL" | "HUMAN_DECISION" | "MANUAL_GOVERNED" | "FAIL_CLOSED";
export type Country = "GENERIC" | "FR" | "BE" | "LU" | "CH";
export type TerminalState = "COMPLETED" | "BLOCKED" | "AWAITING_HUMAN" | "AWAITING_EXTERNAL" | "CANCELLED";

// Per-capability certification entry (dimension A).
export type CapabilityCertification = {
  capabilityId: string;
  domain: string;
  implementation: string;         // canon status
  autonomy: string;
  missionPackIds: string[];
  state: HrCertificationState;
  mode: CertificationMode | null;
  automationBlocker: "none" | "external_provider" | "legal_review" | "human_reserved";
  evidenceRefs: string[];         // where the proof lives (test / prior-P8 proof / pack compile)
  rationale: string;
};

// A runnable certification scenario (derived from the canon + packs).
export type HrCertificationScenario = {
  id: string;
  domain: string;
  capabilityIds: string[];
  missionPackIds: string[];
  country: Country;
  companyProfile: string;
  actorRole: string;
  subjectType: string;
  mode: CertificationMode;
  expectedTerminalState: TerminalState;
  forbiddenEffects: string[];     // e.g. "fabricated_provider_success", "invented_law", "unapproved_mutation"
};

export type ScenarioOutcome = {
  scenarioId: string;
  ran: boolean;
  compiled: boolean;              // mission pack compiled on the real runtime
  terminalState: TerminalState;
  route: string;
  producedEvidence: string[];
  forbiddenEffectsObserved: string[];
  ok: boolean;
  notes: string;
};

// Dimension B — country + provider readiness.
export type CountryReadiness = {
  country: Exclude<Country, "GENERIC">;
  officialSources: number;
  rulesTotal: number;
  rulesVerified: number;
  reviewPackets: number;
  providersLive: number;
  ownerSignOff: boolean;
  launchGrade: boolean;
  blockers: string[];
};

export type FinalDecision = {
  functionalCertification: "CERTIFIED" | "INCOMPLETE";
  countryAuthorization: Record<string, boolean>;
  productionUnblock: "NOT_AUTHORIZED" | "AUTHORIZED";
  answers: Record<string, string>;     // the 5 owner questions
};
