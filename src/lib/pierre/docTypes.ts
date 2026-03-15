// src/lib/pierre/docTypes.ts

export const PIERRE_SCHEMA_VERSION = "1.0" as const;

export const PierreTone = {
  PRO: "pro",
  CONVIVIAL: "convivial",
} as const;

export type PierreTone = (typeof PierreTone)[keyof typeof PierreTone];

export const PierreDocType = {
  JOB_OFFER: "JOB_OFFER",
  JOB_DESCRIPTION: "JOB_DESCRIPTION",

  CANDIDATE_EMAIL_REJECTION: "CANDIDATE_EMAIL_REJECTION",
  CANDIDATE_EMAIL_INVITE: "CANDIDATE_EMAIL_INVITE",
  CANDIDATE_EMAIL_FOLLOWUP: "CANDIDATE_EMAIL_FOLLOWUP",
  CANDIDATE_EMAIL_ONBOARDING: "CANDIDATE_EMAIL_ONBOARDING",

  INTERVIEW_SCORECARD: "INTERVIEW_SCORECARD",
  INTERVIEW_REPORT: "INTERVIEW_REPORT",

  PLAN_30_60_90: "PLAN_30_60_90",
  INTERNAL_PROCEDURE: "INTERNAL_PROCEDURE",

  UNKNOWN: "UNKNOWN",
} as const;

export type PierreDocType = (typeof PierreDocType)[keyof typeof PierreDocType];

export const PIERRE_CONFIDENCE_THRESHOLD = 0.72;
export const PIERRE_DEFAULT_LANGUAGE = "fr-FR" as const;

// Ton par défaut (si onboarding pas renseigné)
export const PIERRE_DEFAULT_TONE: PierreTone = PierreTone.PRO;
