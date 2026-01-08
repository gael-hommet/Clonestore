export type AgentSpec = {
  slug: string;
  name: string;
  role: string;
  forWho: string[];
  does: string[];
  doesNot: string[];
  examples: string[];
  pricingNote?: string;
};

export const AGENTS: AgentSpec[] = [
  {
    slug: "pierre",
    name: "Pierre",
    role: "Agent RH rédacteur & structurant",
    forWho: ["Dirigeants de PME", "Responsables RH", "Office managers", "Fondateurs sans RH dédié"],
    does: [
      "Offres d’emploi complètes (fiche + annonce prête à publier)",
      "Mails RH types (refus, convocation, relance, onboarding, confirmation)",
      "Fiches de poste",
      "Scripts d’entretien + grilles simples",
      "Comptes rendus d’entretien (notes brutes -> résumé structuré)",
      "Plans d’onboarding 1 à 3 mois",
    ],
    doesNot: [
      "Analyse/scoring de CV (réservé à Clara)",
      "Conseil juridique formel",
      "Promesses contractuelles inventées",
    ],
    examples: [
      "Rédige une annonce de Responsable Marketing (PME SaaS B2B, hybride, CDI).",
      "Écris un mail de refus poli en gardant le candidat en shortlist.",
      "Structure un compte rendu d’entretien à partir de notes brutes.",
    ],
    pricingNote: "Tarif défini sur la page de paiement CloneStore.",
  },
{
  slug: "clara",
  name: "Clara",
  role: "Recruteuse IA (analyse & scoring)",
  forWho: ["PME", "RH", "fondateurs sans RH dédié"],
  does: [
    "Analyse de CV",
    "Scoring selon critères",
    "Shortlists",
    "Synthèses candidats",
    "Aide à préparer les entretiens",
  ],
  doesNot: [
    "Rédaction de documents RH complets (c’est Pierre)",
    "Promesses juridiques",
    "Deviner des infos absentes",
  ],
  examples: [
    "Score ces 30 CV pour un poste de sales B2B",
    "Fais une shortlist des 5 meilleurs profils",
    "Compare ces 3 candidats et justifie",
  ],
  pricingNote: "Bientôt disponible",
},
];
