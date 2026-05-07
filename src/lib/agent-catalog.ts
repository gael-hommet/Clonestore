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
    role: "EmployÃ© IA RH opÃ©rationnel automatisÃ©",
    forWho: [
      "Dirigeants de PME",
      "Responsables RH",
      "Office managers",
      "Fondateurs sans RH dÃ©diÃ©",
      "Managers qui recrutent",
    ],
    does: [
      "Comprend une demande RH libre et la transforme en mission structurÃ©e",
      "RÃ©dige et standardise des documents RH prÃªts Ã  relire, valider ou envoyer",
      "Produit convocations, refus, relances, onboarding, notes internes, courriers RH simples et synthÃ¨ses",
      "PrÃ©pare des emails RH avec ton adaptÃ© selon lâ€™entreprise et le contexte",
      "Peut gÃ©nÃ©rer des PDF propres Ã  partir du contenu actif",
      "Demande les informations manquantes quand une demande nâ€™est pas suffisamment cadrÃ©e",
      "Peut maintenir une continuitÃ© sur plusieurs tÃ¢ches et plusieurs Ã©tapes",
      "Peut prÃ©parer des actions email selon le cadre dâ€™autonomie dÃ©fini",
      "Peut sâ€™appuyer sur lâ€™Empreinte Entreprise pour aligner le ton, les rÃ¨gles et lâ€™identitÃ© dâ€™envoi",
      "Laisse une trace exploitable dans lâ€™historique et la logique de mission",
    ],
    doesNot: [
      "Ne remplace pas un conseil juridique formel",
      "Ne prend pas seul des dÃ©cisions disciplinaires sensibles",
      "Nâ€™invente pas les informations absentes",
      "Nâ€™est pas vendu comme moteur de scoring massif de CV",
    ],
    examples: [
      "PrÃ©pare une convocation pour demain Ã  14h avec un ton professionnel et humain.",
      "Relance ce candidat demain matin si je nâ€™ai pas de rÃ©ponse ce soir.",
      "PrÃ©pare un mail dâ€™onboarding pour lâ€™arrivÃ©e de LÃ©a lundi.",
      "Refais ce message en plus humain et plus professionnel.",
      "PrÃ©pare le PDF et garde le document prÃªt Ã  validation.",
    ],
    pricingNote: "449â‚¬/mois",
  },

  {
    slug: "clara",
    name: "Clara",
    role: "EmployÃ© IA recrutement premium",
    forWho: [
      "Dirigeants",
      "Responsables recrutement",
      "RH internes",
      "Managers qui recrutent beaucoup",
    ],
    does: [
      "Positionnement cible : coordination recrutement, lecture candidats, shortlist et continuitÃ© de pipeline",
      "Vision produit : absorber une part massive du travail opÃ©rationnel recrutement",
      "Doit Ã  terme gÃ©rer plusieurs postes et plusieurs flux en parallÃ¨le",
    ],
    doesNot: [
      "Ne doit pas Ãªtre prÃ©sentÃ©e comme totalement finalisÃ©e tant que son niveau rÃ©el nâ€™est pas confirmÃ© dans le produit",
      "Ne doit pas Ãªtre vendue comme disponible immÃ©diatement si ce nâ€™est pas le cas",
    ],
    examples: [
      "En construction",
      "En construction",
      "En construction",
    ],
    pricingNote: "En construction",
  },

  {
    slug: "emma",
    name: "Emma",
    role: "EmployÃ© IA support & communication",
    forWho: [
      "Entreprises avec volume support",
      "Service client",
      "SAV",
      "Ã‰quipes opÃ©rationnelles",
    ],
    does: [
      "Positionnement cible : rÃ©ponses, suivi, communication et continuitÃ© relationnelle",
    ],
    doesNot: [
      "Ne doit pas Ãªtre prÃ©sentÃ©e comme finalisÃ©e si le produit rÃ©el ne lâ€™est pas encore",
    ],
    examples: [
      "En construction",
      "En construction",
      "En construction",
    ],
    pricingNote: "En construction",
  },

  {
    slug: "alex",
    name: "Alex",
    role: "EmployÃ© IA opÃ©rations",
    forWho: [
      "Managers",
      "PME",
      "Ã‰quipes dâ€™exploitation",
    ],
    does: [
      "Positionnement cible : coordination dâ€™opÃ©rations structurÃ©es et suivi transverse",
    ],
    doesNot: [
      "Ne doit pas Ãªtre survendu tant que son produit rÃ©el nâ€™est pas prÃªt",
    ],
    examples: [
      "En construction",
      "En construction",
      "En construction",
    ],
    pricingNote: "En construction",
  },

  {
    slug: "noah",
    name: "Noah",
    role: "EmployÃ© IA assistant direction",
    forWho: [
      "Dirigeants",
      "Managers",
      "Assistants de direction",
      "Structures avec forte charge de pilotage",
    ],
    does: [
      "Positionnement cible : transformer des notes et des sujets flous en plans clairs, prioritÃ©s, dÃ©cisions et suivis",
      "Vision cible : comptes rendus, arbitrages, cadrage et pilotage plus lisible",
    ],
    doesNot: [
      "Ne doit pas Ãªtre prÃ©sentÃ© comme complÃ¨tement prÃªt si ce nâ€™est pas rÃ©ellement confirmÃ©",
    ],
    examples: [
      "En construction",
      "En construction",
      "En construction",
    ],
    pricingNote: "En construction",
  },

  {
    slug: "adrien",
    name: "Adrien",
    role: "EmployÃ© IA commandes & opÃ©rations",
    forWho: [
      "Entreprises avec flux de commandes",
      "OpÃ©rations",
      "Back-office",
    ],
    does: [
      "Positionnement cible : gÃ©rer les commandes avec fiabilitÃ©, rigueur et coÃ»t rÃ©duit",
    ],
    doesNot: [
      "Ne doit pas Ãªtre prÃ©sentÃ© comme dÃ©jÃ  pleinement opÃ©rationnel sans confirmation produit",
    ],
    examples: [
      "En construction",
      "En construction",
      "En construction",
    ],
    pricingNote: "En construction",
  },

  {
    slug: "lucas",
    name: "Lucas",
    role: "EmployÃ© IA finance opÃ©rationnelle",
    forWho: [
      "Dirigeants",
      "Finance",
      "Administration",
    ],
    does: [
      "Positionnement cible : flux finance, facturation, relances et lecture plus claire des opÃ©rations financiÃ¨res",
    ],
    doesNot: [
      "Ne doit pas Ãªtre prÃ©sentÃ© comme prÃªt tant que le produit rÃ©el ne lâ€™est pas",
    ],
    examples: [
      "En construction",
      "En construction",
      "En construction",
    ],
    pricingNote: "En construction",
  },

  {
    slug: "sophie",
    name: "Sophie",
    role: "EmployÃ© IA direction administrative automatisÃ©e",
    forWho: [
      "Dirigeants",
      "Administration",
      "Back-office",
    ],
    does: [
      "Positionnement cible : absorber une part forte de lâ€™administratif et de la coordination interne",
    ],
    doesNot: [
      "Ne doit pas Ãªtre prÃ©sentÃ©e comme active si elle nâ€™est pas rÃ©ellement disponible",
    ],
    examples: [
      "En construction",
      "En construction",
      "En construction",
    ],
    pricingNote: "En construction",
  },
];