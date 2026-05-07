// src/lib/pierre/dataset.seed.ts

import { PierreTone } from "./docTypes";

export type PierreSeedCase = {
  id: string;
  input: string;
  tone?: (typeof PierreTone)[keyof typeof PierreTone];
  expected_doc_type:
    | "JOB_OFFER"
    | "JOB_DESCRIPTION"
    | "CANDIDATE_EMAIL_REJECTION"
    | "CANDIDATE_EMAIL_INVITE"
    | "CANDIDATE_EMAIL_FOLLOWUP"
    | "CANDIDATE_EMAIL_ONBOARDING"
    | "INTERVIEW_SCORECARD"
    | "INTERVIEW_REPORT"
    | "PLAN_30_60_90"
    | "INTERNAL_PROCEDURE"
    | "UNKNOWN";
};

export const PIERRE_SEED_DATASET: PierreSeedCase[] = [
  {
    id: "mail-refus-junior-humain",
    input:
      "Besoin dâ€™un mail de refus pour un candidat junior. Ton humain. 2 phrases sur la raison (manque de fit sur lâ€™expÃ©rience). Poste: assistant commercial. Il a passÃ© un entretien visio hier.",
    tone: PierreTone.CONVIVIAL,
    expected_doc_type: "CANDIDATE_EMAIL_REJECTION",
  },
  {
    id: "mail-convocation-entretien",
    input:
      "Ã‰cris un mail de convocation pour un entretien. Poste: technicien maintenance. Entretien mardi 10h, sur site Ã  Nanterre. DurÃ©e 45 min. Avec qui: responsable maintenance + RH. Demander de venir 10 min avant.",
    tone: PierreTone.PRO,
    expected_doc_type: "CANDIDATE_EMAIL_INVITE",
  },
  {
    id: "mail-relance-candidat",
    input:
      "Relance un candidat qui nâ€™a pas rÃ©pondu Ã  notre proposition de crÃ©neau. Poste: dÃ©veloppeur front. Ton pro, court. Proposer 2 crÃ©neaux la semaine prochaine.",
    tone: PierreTone.PRO,
    expected_doc_type: "CANDIDATE_EMAIL_FOLLOWUP",
  },
  {
    id: "mail-onboarding-avant-arrivee",
    input:
      "Mail onboarding avant lâ€™arrivÃ©e dâ€™une nouvelle recrue. Poste: comptable. Date dâ€™arrivÃ©e: 3 mars. Expliquer documents Ã  apporter, horaires du 1er jour, personne de contact. Ton chaleureux mais pro.",
    tone: PierreTone.CONVIVIAL,
    expected_doc_type: "CANDIDATE_EMAIL_ONBOARDING",
  },
  {
    id: "offre-emploi-commercial",
    input:
      "RÃ©dige une offre dâ€™emploi: commercial B2B. CDI. Paris. Fixe 35k + variable. Secteur: logiciels. Missions: prospection, dÃ©mos, closing. Profil: 2 ans exp, Ã  lâ€™aise au tel, autonome.",
    tone: PierreTone.PRO,
    expected_doc_type: "JOB_OFFER",
  },
  {
    id: "fiche-poste-rh-generaliste",
    input:
      "Fiche de poste RH gÃ©nÃ©raliste. PME 80 personnes. Missions: admin du personnel, recrutement, onboarding, relations sociales. Rattachement: DG. Lieu: Boulogne. Niveau: confirmÃ©.",
    tone: PierreTone.PRO,
    expected_doc_type: "JOB_DESCRIPTION",
  },
  {
    id: "grille-entretien-support-client",
    input:
      "CrÃ©e une grille dâ€™entretien simple + questions pour un poste support client. Ã‰valuer: communication, gestion stress, rÃ©solution, sens service. Ajouter barÃ¨me 1-5.",
    tone: PierreTone.PRO,
    expected_doc_type: "INTERVIEW_SCORECARD",
  },
  {
    id: "compte-rendu-entretien-notes",
    input:
      "Transforme ces notes en compte rendu dâ€™entretien structurÃ©. Poste: assistant logistique. Notes: ponctuel, expÃ©rience 1 an, hÃ©sitant sur excel, bon relationnel, motivÃ©, dispo immÃ©diate. Reco: Ã  revoir pour 2e entretien.",
    tone: PierreTone.PRO,
    expected_doc_type: "INTERVIEW_REPORT",
  },
  {
    id: "plan-306090-sales",
    input:
      "Plan 30/60/90 jours pour un nouveau business developer SaaS. Objectifs: maÃ®triser produit, pipeline, 3 deals signÃ©s Ã  90 jours. Ton pro.",
    tone: PierreTone.PRO,
    expected_doc_type: "PLAN_30_60_90",
  },
  {
    id: "procedure-teletravail",
    input:
      "ProcÃ©dure interne tÃ©lÃ©travail. RÃ¨gles: 2 jours/semaine max, validation manager, disponibilitÃ© 9h-12h / 14h-18h, sÃ©curitÃ© (VPN), matÃ©riel fourni, exceptions possibles. Ton pro.",
    tone: PierreTone.PRO,
    expected_doc_type: "INTERNAL_PROCEDURE",
  },
];
