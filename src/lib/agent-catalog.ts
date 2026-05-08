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
    role: "Employé IA RH opérationnel automatisé",
    forWho: [
      "Dirigeants de PME",
      "Responsables RH",
      "Office managers",
      "Fondateurs sans RH dédié",
      "Managers qui recrutent",
    ],
    does: [
      "Comprend une demande RH libre et la transforme en mission structurée",
      "Rédige et standardise des documents RH prêts à relire, valider ou envoyer",
      "Produit convocations, refus, relances, onboarding, notes internes, courriers RH simples et synthèses",
      "Prépare des emails RH avec ton adapté selon l’entreprise et le contexte",
      "Peut générer des PDF propres à partir du contenu actif",
      "Demande les informations manquantes quand une demande n’est pas suffisamment cadrée",
      "Peut maintenir une continuité sur plusieurs tâches et plusieurs étapes",
      "Peut préparer des actions email selon le cadre d’autonomie défini",
      "Peut s’appuyer sur l’Empreinte Entreprise pour aligner le ton, les règles et l’identité d’envoi",
      "Laisse une trace exploitable dans l’historique et la logique de mission",
    ],
    doesNot: [
      "Ne remplace pas un conseil juridique formel",
      "Ne prend pas seul des décisions disciplinaires sensibles",
      "N’invente pas les informations absentes",
      "N’est pas vendu comme moteur de scoring massif de CV",
    ],
    examples: [
      "Prépare une convocation pour demain à 14h avec un ton professionnel et humain.",
      "Relance ce candidat demain matin si je n’ai pas de réponse ce soir.",
      "Prépare un mail d’onboarding pour l’arrivée de Léa lundi.",
      "Refais ce message en plus humain et plus professionnel.",
      "Prépare le PDF et garde le document prêt à validation.",
    ],
    pricingNote: "449€/mois",
  },

  {
    slug: "clara",
    name: "Clara",
    role: "Employé IA recrutement premium",
    forWho: [
      "Dirigeants",
      "Responsables recrutement",
      "RH internes",
      "Managers qui recrutent beaucoup",
    ],
    does: [
      "Positionnement cible : coordination recrutement, lecture candidats, shortlist et continuité de pipeline",
      "Vision produit : absorber une part massive du travail opérationnel recrutement",
      "Doit à terme gérer plusieurs postes et plusieurs flux en parallèle",
    ],
    doesNot: [
      "Ne doit pas être présentée comme totalement finalisée tant que son niveau réel n’est pas confirmé dans le produit",
      "Ne doit pas être vendue comme disponible immédiatement si ce n’est pas le cas",
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
    role: "Employé IA support & communication",
    forWho: [
      "Entreprises avec volume support",
      "Service client",
      "SAV",
      "Équipes opérationnelles",
    ],
    does: [
      "Positionnement cible : réponses, suivi, communication et continuité relationnelle",
    ],
    doesNot: [
      "Ne doit pas être présentée comme finalisée si le produit réel ne l’est pas encore",
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
    role: "Employé IA opérations",
    forWho: [
      "Managers",
      "PME",
      "Équipes d’exploitation",
    ],
    does: [
      "Positionnement cible : coordination d’opérations structurées et suivi transverse",
    ],
    doesNot: [
      "Ne doit pas être survendu tant que son produit réel n’est pas prêt",
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
    role: "Employé IA assistant direction",
    forWho: [
      "Dirigeants",
      "Managers",
      "Assistants de direction",
      "Structures avec forte charge de pilotage",
    ],
    does: [
      "Positionnement cible : transformer des notes et des sujets flous en plans clairs, priorités, décisions et suivis",
      "Vision cible : comptes rendus, arbitrages, cadrage et pilotage plus lisible",
    ],
    doesNot: [
      "Ne doit pas être présenté comme complètement prêt si ce n’est pas réellement confirmé",
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
    role: "Employé IA commandes & opérations",
    forWho: [
      "Entreprises avec flux de commandes",
      "Opérations",
      "Back-office",
    ],
    does: [
      "Positionnement cible : gérer les commandes avec fiabilité, rigueur et coût réduit",
    ],
    doesNot: [
      "Ne doit pas être présenté comme déjà pleinement opérationnel sans confirmation produit",
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
    role: "Employé IA finance opérationnelle",
    forWho: [
      "Dirigeants",
      "Finance",
      "Administration",
    ],
    does: [
      "Positionnement cible : flux finance, facturation, relances et lecture plus claire des opérations financières",
    ],
    doesNot: [
      "Ne doit pas être présenté comme prêt tant que le produit réel ne l’est pas",
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
    role: "Employé IA direction administrative automatisée",
    forWho: [
      "Dirigeants",
      "Administration",
      "Back-office",
    ],
    does: [
      "Positionnement cible : absorber une part forte de l’administratif et de la coordination interne",
    ],
    doesNot: [
      "Ne doit pas être présentée comme active si elle n’est pas réellement disponible",
    ],
    examples: [
      "En construction",
      "En construction",
      "En construction",
    ],
    pricingNote: "En construction",
  },
];