import type { PierreClassification, PierreTaskType } from "./types";

export const PIERRE_NAME = "Pierre";

export const PIERRE_PRODUCT_LABEL = "Employé IA RH";

export const PIERRE_ALLOWED_SCOPE = [
  "documents RH simples",
  "communications RH simples",
  "onboarding",
  "convocations",
  "refus candidats",
  "relances",
  "rappels de procédure",
  "notes RH internes",
  "comptes rendus simples",
  "organisation de tâches RH",
  "suivi et continuité RH",
] as const;

export const PIERRE_BLOCKED_SCOPE_KEYWORDS = [
  "licencier",
  "licenciement",
  "sanction disciplinaire",
  "blâme",
  "mise à pied",
  "discrimination",
  "choix juridique",
  "fraude",
  "mensonge RH",
  "faux document",
] as const;

export const PIERRE_VALIDATION_KEYWORDS = [
  "attends ma validation",
  "après validation",
  "à valider",
  "soumets-moi",
  "avant envoi",
  "avant d'envoyer",
  "avant de l'envoyer",
  "fais valider",
] as const;

export const PIERRE_MULTI_ACTION_SEPARATORS = [
  " puis ",
  " ensuite ",
  " et ",
  ", puis ",
  ";",
] as const;

export const PIERRE_CLASSIFICATION_KEYWORDS: Array<{
  classification: PierreClassification;
  keywords: string[];
}> = [
  {
    classification: "convocation",
    keywords: ["convocation", "convoque", "entretien", "rendez-vous entretien"],
  },
  {
    classification: "candidate_refusal",
    keywords: ["refus", "refuser candidature", "refus candidat", "candidature refusée"],
  },
  {
    classification: "candidate_followup",
    keywords: ["relance candidat", "relancer candidat", "sans réponse candidat"],
  },
  {
    classification: "onboarding",
    keywords: ["onboarding", "intégration", "message d'accueil", "arrivée lundi"],
  },
  {
    classification: "internal_hr_communication",
    keywords: ["note interne", "communication interne", "message manager", "message interne"],
  },
  {
    classification: "procedure_reminder",
    keywords: ["procédure", "rappel procédure", "rappel administratif", "consigne RH"],
  },
  {
    classification: "interview_summary",
    keywords: ["compte rendu", "synthèse entretien", "résumé entretien"],
  },
  {
    classification: "document_request",
    keywords: ["document", "prépare le document", "génère un document", "pdf"],
  },
  {
    classification: "planning",
    keywords: ["organise", "planifie", "programme", "demain", "semaine", "planning"],
  },
  {
    classification: "followup_mission",
    keywords: ["relance", "suis", "suivi", "si pas de réponse", "rappelle-moi"],
  },
  {
    classification: "application",
    keywords: ["candidature", "poste", "offre d'emploi", "recrutement"],
  },
];

export const PIERRE_CLASSIFICATION_TO_PRIMARY_TASK: Record<
  PierreClassification,
  PierreTaskType
> = {
  recruitment: "doc.generate",
  application: "email.draft",
  convocation: "doc.generate",
  candidate_refusal: "email.draft",
  candidate_followup: "followup.schedule",
  onboarding: "email.draft",
  internal_hr_communication: "email.draft",
  procedure_reminder: "doc.generate",
  hr_note: "doc.generate",
  interview_summary: "doc.generate",
  simple_hr_letter: "doc.generate",
  document_request: "doc.generate",
  planning: "doc.generate",
  followup_mission: "followup.schedule",
  internal_followup: "followup.schedule",
  external_followup: "followup.schedule",
  sensitive_request: "email.draft",
  out_of_scope: "doc.generate",
  unknown: "doc.generate",
};

export const PIERRE_DEFAULT_LANGUAGE = "fr";

export const PIERRE_DEFAULT_TONE = "professional";

export const PIERRE_MAX_MISSING_INFO_QUESTIONS = 6;
