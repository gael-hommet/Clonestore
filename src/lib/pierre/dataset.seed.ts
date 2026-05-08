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
      "Besoin d’un mail de refus pour un candidat junior. Ton humain. 2 phrases sur la raison (manque de fit sur l’expérience). Poste: assistant commercial. Il a passé un entretien visio hier.",
    tone: PierreTone.CONVIVIAL,
    expected_doc_type: "CANDIDATE_EMAIL_REJECTION",
  },
  {
    id: "mail-convocation-entretien",
    input:
      "Écris un mail de convocation pour un entretien. Poste: technicien maintenance. Entretien mardi 10h, sur site à Nanterre. Durée 45 min. Avec qui: responsable maintenance + RH. Demander de venir 10 min avant.",
    tone: PierreTone.PRO,
    expected_doc_type: "CANDIDATE_EMAIL_INVITE",
  },
  {
    id: "mail-relance-candidat",
    input:
      "Relance un candidat qui n’a pas répondu à notre proposition de créneau. Poste: développeur front. Ton pro, court. Proposer 2 créneaux la semaine prochaine.",
    tone: PierreTone.PRO,
    expected_doc_type: "CANDIDATE_EMAIL_FOLLOWUP",
  },
  {
    id: "mail-onboarding-avant-arrivee",
    input:
      "Mail onboarding avant l’arrivée d’une nouvelle recrue. Poste: comptable. Date d’arrivée: 3 mars. Expliquer documents à apporter, horaires du 1er jour, personne de contact. Ton chaleureux mais pro.",
    tone: PierreTone.CONVIVIAL,
    expected_doc_type: "CANDIDATE_EMAIL_ONBOARDING",
  },
  {
    id: "offre-emploi-commercial",
    input:
      "Rédige une offre d’emploi: commercial B2B. CDI. Paris. Fixe 35k + variable. Secteur: logiciels. Missions: prospection, démos, closing. Profil: 2 ans exp, à l’aise au tel, autonome.",
    tone: PierreTone.PRO,
    expected_doc_type: "JOB_OFFER",
  },
  {
    id: "fiche-poste-rh-generaliste",
    input:
      "Fiche de poste RH généraliste. PME 80 personnes. Missions: admin du personnel, recrutement, onboarding, relations sociales. Rattachement: DG. Lieu: Boulogne. Niveau: confirmé.",
    tone: PierreTone.PRO,
    expected_doc_type: "JOB_DESCRIPTION",
  },
  {
    id: "grille-entretien-support-client",
    input:
      "Crée une grille d’entretien simple + questions pour un poste support client. Évaluer: communication, gestion stress, résolution, sens service. Ajouter barème 1-5.",
    tone: PierreTone.PRO,
    expected_doc_type: "INTERVIEW_SCORECARD",
  },
  {
    id: "compte-rendu-entretien-notes",
    input:
      "Transforme ces notes en compte rendu d’entretien structuré. Poste: assistant logistique. Notes: ponctuel, expérience 1 an, hésitant sur excel, bon relationnel, motivé, dispo immédiate. Reco: à revoir pour 2e entretien.",
    tone: PierreTone.PRO,
    expected_doc_type: "INTERVIEW_REPORT",
  },
  {
    id: "plan-306090-sales",
    input:
      "Plan 30/60/90 jours pour un nouveau business developer SaaS. Objectifs: maîtriser produit, pipeline, 3 deals signés à 90 jours. Ton pro.",
    tone: PierreTone.PRO,
    expected_doc_type: "PLAN_30_60_90",
  },
  {
    id: "procedure-teletravail",
    input:
      "Procédure interne télétravail. Règles: 2 jours/semaine max, validation manager, disponibilité 9h-12h / 14h-18h, sécurité (VPN), matériel fourni, exceptions possibles. Ton pro.",
    tone: PierreTone.PRO,
    expected_doc_type: "INTERNAL_PROCEDURE",
  },
];
