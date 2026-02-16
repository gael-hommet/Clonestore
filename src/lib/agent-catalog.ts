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
    role: "Clone RH autonome — rédaction, structuration & exécution RH (CloneOS)",
    forWho: [
      "Dirigeants de PME",
      "Responsables RH",
      "Office managers",
      "Fondateurs sans RH dédié",
      "Managers qui recrutent",
    ],
    does: [
      "Rédige et standardise des documents RH prêts à envoyer (mails, courriers, notes, process)",
      "Offres d’emploi complètes (fiche + annonce prête à publier)",
      "Fiches de poste (missions, compétences, niveau, contexte, conditions)",
      "Mails candidats types (refus, convocation, relance, confirmation, onboarding) avec un ton adapté",
      "Scripts d’entretien + grilles simples + critères de décision",
      "Comptes rendus d’entretien (notes brutes → résumé structuré exploitable)",
      "Plans d’onboarding 1 à 3 mois (30/60/90 jours) + documents internes",
      "Peut fonctionner en mode autonome : prépare le livrable complet sans aller-retours inutiles",
      "Compatible CloneOS : peut être déclenché automatiquement via le Router par des règles/événements ou par un autre clone",
      "Optionnel : peut exécuter des actions selon configuration (ex: envoyer un mail / générer un document / s’intégrer à un flux)",
      "Optionnel : adresse email au nom de l’entreprise via DNS (ex: pierre@monentreprise.com) selon setup",
      "Optionnel : liaison support/SAV selon le setup (ex: réponses et traitement mail) ",
    ],
    doesNot: [
      "Analyse/scoring de CV (réservé à Clara)",
      "Conseil juridique formel",
      "Promesses contractuelles inventées",
      "Deviner des informations absentes (il demande ce qui manque)",
    ],
    examples: [
      "Rédige une annonce de Responsable Marketing (PME SaaS B2B, hybride, CDI).",
      "Écris un mail de refus poli en gardant le candidat en shortlist.",
      "Structure un compte rendu d’entretien à partir de notes brutes.",
      "Crée une fiche de poste complète + grille d’entretien pour un profil Sales B2B.",
      "Écris un mail de convocation entretien + les créneaux proposés + les pièces à préparer.",
    ],
    pricingNote: "Tarif défini sur la page de paiement CloneStore.",
  },

  {
    slug: "clara",
    name: "Clara",
    role: "Clone recruteuse IA autonome — analyse & scoring candidats (CloneOS)",
    forWho: ["PME", "RH", "Fondateurs sans RH dédié", "Managers recruteurs"],
    does: [
      "Analyse de CV (extraction des infos utiles + synthèse)",
      "Scoring des profils selon tes critères (must-have / nice-to-have / seniorité)",
      "Shortlists claires avec raisons (pourquoi oui / pourquoi non)",
      "Comparaison de candidats et justification structurée",
      "Aide à préparer les entretiens (questions ciblées selon poste + CV)",
      "Peut fonctionner en mode autonome : tri, scoring et shortlist sans micro-management",
      "Compatible CloneOS : peut collaborer avec Pierre via le Router (ex: shortlist → Pierre prépare les mails et docs RH)",
      "Optionnel : intégrations RH selon configuration (ATS / outils RH) — si activé dans ton setup",
      "Optionnel : adresse email au nom de l’entreprise via DNS selon setup",
    ],
    doesNot: [
      "Rédaction de documents RH complets (c’est Pierre)",
      "Promesses juridiques",
      "Deviner des infos absentes dans les CV",
      "Remplacer un entretien humain (elle prépare la décision, elle ne la “subit” pas)",
    ],
    examples: [
      "Score ces 30 CV pour un poste de Sales B2B (critères: closing, prospection, CRM, 2+ ans).",
      "Fais une shortlist des 5 meilleurs profils et explique pourquoi.",
      "Compare ces 3 candidats et recommande le meilleur profil selon le poste.",
      "Génère 10 questions d’entretien pertinentes à partir du CV et de l’offre.",
    ],
    pricingNote: "En construction",
  },

  {
    slug: "alex",
    name: "Alex",
    role: "Clone Ops / organisation (CloneOS) — bientôt",
    forWho: ["PME", "Ops", "Managers"],
    does: ["Contenu en cours de finalisation."],
    doesNot: ["Contenu en cours de finalisation."],
    examples: ["Contenu en cours de finalisation."],
    pricingNote: "En construction",
  },

  {
    slug: "emma",
    name: "Emma",
    role: "Clone Support & mails (CloneOS) — bientôt",
    forWho: ["PME", "Support", "Service client", "SAV"],
    does: ["Contenu en cours de finalisation."],
    doesNot: ["Contenu en cours de finalisation."],
    examples: ["Contenu en cours de finalisation."],
    pricingNote: "En construction",
  },

  {
    slug: "noah",
    name: "Noah",
    role: "Clone Assistant direction (CloneOS) — bientôt",
    forWho: ["Dirigeants", "PME", "Assistants", "Managers"],
    does: ["Contenu en cours de finalisation."],
    doesNot: ["Contenu en cours de finalisation."],
    examples: ["Contenu en cours de finalisation."],
    pricingNote: "En construction",
  },
];
