import type {
  AssistantAccountContext,
  AssistantIntent,
  AssistantKnowledgeMatch,
  AssistantLinkCard,
  AssistantStatusCard,
} from "./types";

type KnowledgeArticle = {
  id: string;
  title: string;
  tags: string[];
  body: string;
};

export const DEFAULT_ASSISTANT_CONTEXT: AssistantAccountContext = {
  isAuthenticated: false,
  hasPierreAccess: false,
  onboardingCompleted: false,
  companyName: "",
  contactFirstName: "",
  contactJobTitle: "",
  usualTone: "",
  preferredLanguage: "fr",
  senderMode: "",
  senderStatus: "",
  domainStatus: "",
  senderEmailRequested: "",
  senderEmailEffective: "",
  replyToEmail: "",
};

const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "clonestore-positioning",
    title: "Positionnement central de CloneStore",
    tags: [
      "clonestore",
      "vision",
      "positionnement",
      "produit",
      "systeme",
      "os",
      "employes ia",
      "employés ia",
    ],
    body: [
      "CloneStore n'est pas censé être présenté comme une collection de petits outils IA.",
      "CloneStore est un système d'exploitation d'employés IA pour entreprises, avec logique premium, cockpit, gouvernance, mémoire et traçabilité.",
      "Le vocabulaire à privilégier est employés IA, pas gadgets ni agents bricolés.",
      "Le produit doit toujours être perçu comme sérieux, pilotable, haut de gamme et orienté exécution réelle.",
    ].join("\n"),
  },
  {
    id: "current-public-truth",
    title: "Vérité produit actuelle côté public",
    tags: [
      "verite",
      "vérité",
      "etat",
      "état",
      "pret",
      "prêt",
      "public",
      "disponible",
      "construction",
    ],
    body: [
      "L'employé le plus concret aujourd'hui est Pierre.",
      "Pierre est l'entrée la plus crédible pour un utilisateur qui veut une valeur réelle maintenant.",
      "Les autres employés visibles peuvent exister dans l'univers produit, mais ils ne doivent pas être vendus comme totalement prêts si ce n'est pas réellement le cas.",
      "Quand l'utilisateur demande quoi choisir aujourd'hui, il faut répondre franchement : Pierre est le meilleur choix immédiat.",
    ].join("\n"),
  },
  {
    id: "pierre-positioning",
    title: "Positionnement réel de Pierre",
    tags: [
      "pierre",
      "rh",
      "poste rh",
      "assistant rh",
      "employe rh",
      "employé rh",
      "documents",
      "emails",
      "relances",
    ],
    body: [
      "Pierre est un poste RH opérationnel automatisé.",
      "Il sert à comprendre une demande RH libre, produire des documents RH, préparer des emails, relancer, suivre une mission et garder une trace claire.",
      "Il ne doit pas être réduit à un simple générateur de texte.",
      "La logique produit de Pierre repose sur mission -> tâches -> validations éventuelles -> exécution -> suivi -> historique.",
    ].join("\n"),
  },
  {
    id: "pierre-strengths",
    title: "Ce que Pierre fait bien",
    tags: [
      "capacites",
      "capacités",
      "ce que fait pierre",
      "documents",
      "emails",
      "pdf",
      "historique",
      "mission libre",
    ],
    body: [
      "Pierre est fort sur la rédaction RH exploitable et sur la structuration opérationnelle.",
      "Il couvre notamment convocations, refus, relances, onboarding, documents RH, emails, PDF, missions, historique et continuité.",
      "Il peut fonctionner comme un vrai centre de missions RH contrôlé, pas seulement comme une zone de texte.",
      "Pierre doit aider à retirer de la charge mentale au client dès la première semaine.",
    ].join("\n"),
  },
  {
    id: "pierre-limits",
    title: "Limites réelles de Pierre",
    tags: [
      "limites",
      "ne fait pas",
      "pas juridique",
      "pas scoring cv",
      "cv",
      "juridique",
      "risque",
    ],
    body: [
      "Pierre ne doit pas être présenté comme un conseiller juridique formel.",
      "Pierre ne doit pas inventer des informations manquantes.",
      "Pierre ne doit pas être vendu comme un moteur de scoring massif de CV : cette logique relève plutôt de Clara quand Clara sera réellement prête.",
      "Pierre doit refuser, bloquer ou remonter les cas sensibles qui exigent une validation humaine.",
    ].join("\n"),
  },
  {
    id: "post-payment-flow",
    title: "Parcours après paiement",
    tags: [
      "paiement",
      "post paiement",
      "post-payment",
      "activation",
      "acces",
      "accès",
      "succes",
      "succès",
    ],
    body: [
      "La logique simple après paiement est : accès actif -> onboarding utile -> cockpit d'usage.",
      "Pour Pierre, le bon enchaînement est : activation, puis setup / Empreinte Entreprise, puis page Pierre Use.",
      "Le produit ne doit jamais laisser une sensation de vide après paiement.",
      "Le support doit toujours répondre avec le meilleur prochain pas concret.",
    ].join("\n"),
  },
  {
    id: "onboarding-role",
    title: "Rôle du setup / onboarding Pierre",
    tags: [
      "onboarding",
      "setup",
      "formulaire",
      "empreinte entreprise",
      "cloneadn",
      "memoire",
      "mémoire",
    ],
    body: [
      "L'onboarding Pierre sert à transmettre l'identité entreprise, le ton, les règles, les valideurs, la logique d'autonomie et l'identité d'envoi.",
      "Ce n'est pas un simple formulaire décoratif.",
      "C'est le socle CloneADN de Pierre pour cette entreprise.",
      "Plus cette base est propre, plus Pierre agit de façon cohérente dès le départ.",
    ].join("\n"),
  },
  {
    id: "onboarding-priority",
    title: "Blocs les plus importants du setup Pierre",
    tags: [
      "priorite",
      "priorité",
      "important",
      "setup pierre",
      "formulaire pierre",
      "setup important",
    ],
    body: [
      "Les blocs les plus critiques sont : identité entreprise, contexte RH, ton, valideurs, actions autorisées / interdites et identité email.",
      "Ce sont eux qui influencent le plus directement la qualité réelle des sorties de Pierre.",
      "Si le client veut aller vite, il faut commencer par ces zones-là au lieu de remplir au hasard.",
    ].join("\n"),
  },
  {
    id: "pierre-use-page",
    title: "Rôle de la page Pierre Use",
    tags: [
      "use",
      "page use",
      "pierre use",
      "mission center",
      "centre de missions",
      "studios",
      "artifacts",
      "history",
      "memory",
    ],
    body: [
      "La page Pierre Use est le cockpit opérationnel de Pierre.",
      "Elle réunit mission libre, compréhension, tâches, suivi, artefacts, historique et mémoire.",
      "Le client doit pouvoir parler à Pierre comme à un employé, puis produire, suivre, corriger et exploiter les sorties.",
      "Cette page n'est pas un simple chat : c'est un centre de commandement.",
    ].join("\n"),
  },
  {
    id: "email-pdf-logic",
    title: "Logique email et PDF dans Pierre",
    tags: [
      "email",
      "pdf",
      "piece jointe",
      "pièce jointe",
      "envoi",
      "document",
      "version active",
      "artefact",
    ],
    body: [
      "Les emails et PDF doivent partir de la version active du contenu.",
      "Si le contenu a été modifié puis enregistré, c'est cette version qui devient la base pour l'envoi ou l'export.",
      "Si un PDF a été généré avant une modification importante, il doit être régénéré pour rester aligné avec le contenu actif.",
      "Le support doit toujours expliquer cela simplement, sans jargon inutile.",
    ].join("\n"),
  },
  {
    id: "sender-identity",
    title: "Identité d'envoi et domaine entreprise",
    tags: [
      "sender",
      "email identity",
      "identite d'envoi",
      "identité d'envoi",
      "domaine",
      "dns",
      "reply-to",
      "reply to",
      "fallback",
    ],
    body: [
      "L'objectif produit est de permettre à Pierre d'envoyer au nom de l'entreprise via une vraie identité email.",
      "Tant que le domaine n'est pas correctement vérifié / configuré, le système peut rester sur une identité de fallback.",
      "Une fois le domaine prêt, l'identité cible peut devenir l'identité active.",
      "Le support doit l'expliquer comme une bascule contrôlée, pas comme un détail obscur de développeur.",
    ].join("\n"),
  },
  {
    id: "profile-and-cockpit",
    title: "Différence entre Mon espace, Mes employés et la boutique",
    tags: [
      "mon espace",
      "mes employes",
      "mes employés",
      "boutique",
      "navigation",
      "difference",
      "différence",
      "cockpit",
    ],
    body: [
      "Mon espace sert au pilotage global du compte, des accès, de la structure et des grands réglages.",
      "Mes employés sert à voir et ouvrir les employés IA activés ou visibles dans l'univers CloneStore.",
      "La boutique sert à découvrir l'offre publique et les employés proposés.",
      "Le support doit orienter vite vers la bonne zone selon l'intention réelle de l'utilisateur.",
    ].join("\n"),
  },
  {
    id: "clonechat-role",
    title: "Rôle de CloneChat",
    tags: [
      "clonechat",
      "assistant",
      "support",
      "orientation",
      "questions",
      "help",
      "aide",
    ],
    body: [
      "CloneChat est censé absorber l'immense majorité des questions de support simples, produit, parcours et compréhension.",
      "Il doit expliquer, orienter, rassurer et donner le meilleur prochain pas.",
      "Il fait partie du coeur de CloneStore et doit connaître le produit en profondeur.",
      "Il ne doit pas répondre comme une FAQ molle mais comme un employé poumon du système.",
    ].join("\n"),
  },
  {
    id: "future-visible-tech",
    title: "Technologies visibles CloneStore",
    tags: [
      "cloneos",
      "cloneadn",
      "cloneguard",
      "clonetrace",
      "clonevoice",
      "technologies",
      "vision produit",
    ],
    body: [
      "CloneOS est la couche d'orchestration des missions et des employés.",
      "CloneADN représente la mémoire et l'alignement entreprise.",
      "CloneGuard couvre gouvernance, risque, validation et refus.",
      "CloneTrace couvre traçabilité, timeline et auditabilité.",
      "CloneVoice est la couche de commande naturelle vocale prévue pour l'expérience premium future.",
    ].join("\n"),
  },
  {
    id: "pricing-truth",
    title: "Vérité tarifaire actuelle",
    tags: [
      "prix",
      "pricing",
      "tarif",
      "combien",
      "449",
      "pierre prix",
    ],
    body: [
      "Pierre est affiché à 449€/mois dans le parcours actuel.",
      "Le support ne doit pas inventer d'autres prix si rien d'autre n'est confirmé.",
      "Quand un utilisateur demande quel employé choisir tout de suite, le support doit parler valeur réelle, pas seulement tarif.",
    ].join("\n"),
  },
  {
    id: "support-style",
    title: "Style de réponse attendu",
    tags: [
      "style",
      "ton",
      "reponse",
      "réponse",
      "support premium",
    ],
    body: [
      "Les réponses doivent être directes, propres, crédibles et orientées action.",
      "Quand il faut choisir, il faut choisir franchement.",
      "Quand il faut dire qu'un employé n'est pas encore prêt, il faut le dire franchement aussi.",
      "Le meilleur prochain pas doit être concret.",
    ].join("\n"),
  },
];

function clean(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesOne(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(clean(term)));
}

function scoreArticle(
  rawQuery: string,
  intent: AssistantIntent,
  article: KnowledgeArticle
): number {
  const query = clean(rawQuery);
  if (!query) return 0;

  let score = 0;

  for (const tag of article.tags) {
    if (query.includes(clean(tag))) score += 4;
  }

  const titleWords = clean(article.title).split(" ").filter(Boolean);
  for (const word of titleWords) {
    if (word.length >= 4 && query.includes(word)) score += 2;
  }

  if (intent === "clone_choice" && article.id === "current-public-truth") score += 8;
  if (intent === "clone_choice" && article.id === "pierre-positioning") score += 6;

  if (intent === "post_payment" && article.id === "post-payment-flow") score += 10;

  if (intent === "onboarding" && article.id === "onboarding-role") score += 10;
  if (intent === "onboarding" && article.id === "onboarding-priority") score += 6;

  if (intent === "use_page" && article.id === "pierre-use-page") score += 10;
  if (intent === "email_pdf_action" && article.id === "email-pdf-logic") score += 10;
  if (intent === "email_identity" && article.id === "sender-identity") score += 10;

  if (intent === "limits" && article.id === "pierre-limits") score += 10;
  if (intent === "pricing" && article.id === "pricing-truth") score += 10;

  if (intent === "navigation" && article.id === "profile-and-cockpit") score += 10;
  if (intent === "support" && article.id === "clonechat-role") score += 10;
  if (intent === "product_vision" && article.id === "future-visible-tech") score += 8;

  if (intent === "general" && article.id === "support-style") score += 2;

  return score;
}

function buildKnowledgeArticleBlock(article: KnowledgeArticle): string {
  return `## ${article.title}\n${article.body}`;
}

export function classifyIntent(question: string): AssistantIntent {
  const q = clean(question);

  if (!q) return "general";

  if (
    includesOne(q, [
      "quel employe",
      "quel employé",
      "lequel choisir",
      "tu me conseilles lequel",
      "tu me conseilles quoi",
      "entre pierre et",
      "quel clone",
      "qui prendre",
    ])
  ) {
    return "clone_choice";
  }

  if (
    includesOne(q, [
      "apres paiement",
      "apres avoir paye",
      "apres avoir payé",
      "je viens de payer",
      "activation",
      "paiement succes",
      "paiement succes",
      "paiement annulé",
      "paiement annule",
      "post paiement",
    ])
  ) {
    return "post_payment";
  }

  if (
    includesOne(q, [
      "onboarding",
      "setup",
      "empreinte entreprise",
      "formulaire",
      "configuration pierre",
      "configurer pierre",
      "remplir pierre",
    ])
  ) {
    return "onboarding";
  }

  if (
    includesOne(q, [
      "page use",
      "utiliser pierre",
      "centre de missions",
      "mission libre",
      "studios",
      "artifacts",
      "artefacts",
      "historique pierre",
      "memoire pierre",
      "mémoire pierre",
    ])
  ) {
    return "use_page";
  }

  if (
    includesOne(q, [
      "sender",
      "identite d'envoi",
      "identité d'envoi",
      "reply-to",
      "reply to",
      "domaine",
      "dns",
      "fallback",
      "email entreprise",
      "adresse d'envoi",
    ])
  ) {
    return "email_identity";
  }

  if (
    includesOne(q, [
      "pdf",
      "piece jointe",
      "pièce jointe",
      "envoyer le mail",
      "envoyer un mail",
      "document actif",
      "version active",
      "brouillon",
      "email",
    ])
  ) {
    return "email_pdf_action";
  }

  if (
    includesOne(q, [
      "limites",
      "ce que pierre ne fait pas",
      "ne fait pas",
      "hors perimetre",
      "hors périmètre",
      "risque",
      "juridique",
    ])
  ) {
    return "limits";
  }

  if (
    includesOne(q, [
      "clara",
      "emma",
      "alex",
      "noah",
      "sophie",
      "lucas",
      "autres employes",
      "autres employés",
    ])
  ) {
    return "status_other_employees";
  }

  if (
    includesOne(q, [
      "prix",
      "tarif",
      "combien",
      "449",
      "combien coute",
      "combien coûte",
      "abonnement",
    ])
  ) {
    return "pricing";
  }

  if (
    includesOne(q, [
      "mon espace",
      "mes employes",
      "mes employés",
      "boutique",
      "ou aller",
      "où aller",
      "navigation",
      "cockpit",
      "difference",
      "différence",
    ])
  ) {
    return "navigation";
  }

  if (
    includesOne(q, [
      "clonechat",
      "support",
      "question",
      "aide",
      "bug",
      "probleme",
      "problème",
    ])
  ) {
    return "support";
  }

  if (
    includesOne(q, [
      "cloneos",
      "cloneadn",
      "cloneguard",
      "clonetrace",
      "clonevoice",
      "vision",
      "architecture",
      "technologies",
    ])
  ) {
    return "product_vision";
  }

  return "general";
}

export function buildAccountSnapshot(context: AssistantAccountContext): string {
  return [
    `isAuthenticated: ${context.isAuthenticated ? "yes" : "no"}`,
    `hasPierreAccess: ${context.hasPierreAccess ? "yes" : "no"}`,
    `onboardingCompleted: ${context.onboardingCompleted ? "yes" : "no"}`,
    `companyName: ${context.companyName || "non renseigne"}`,
    `contactFirstName: ${context.contactFirstName || "non renseigne"}`,
    `contactJobTitle: ${context.contactJobTitle || "non renseigne"}`,
    `usualTone: ${context.usualTone || "non renseigne"}`,
    `preferredLanguage: ${context.preferredLanguage || "fr"}`,
    `senderMode: ${context.senderMode || "non renseigne"}`,
    `senderStatus: ${context.senderStatus || "non renseigne"}`,
    `domainStatus: ${context.domainStatus || "non renseigne"}`,
    `senderEmailRequested: ${context.senderEmailRequested || "non renseigne"}`,
    `senderEmailEffective: ${context.senderEmailEffective || "non renseigne"}`,
    `replyToEmail: ${context.replyToEmail || "non renseigne"}`,
  ].join("\n");
}

export function findRelevantKnowledgeMatches(
  question: string,
  intent: AssistantIntent,
  limit = 5
): AssistantKnowledgeMatch[] {
  return KNOWLEDGE_ARTICLES.map((article) => ({
    id: article.id,
    title: article.title,
    score: scoreArticle(question, intent, article),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildKnowledgeContext(): string {
  return KNOWLEDGE_ARTICLES.map(buildKnowledgeArticleBlock).join("\n\n");
}

export function buildKnowledgeDigest(question: string, intent: AssistantIntent): string {
  const matches = findRelevantKnowledgeMatches(question, intent, 4);

  if (matches.length === 0) {
    return buildKnowledgeContext();
  }

  const selectedArticles = matches
    .map((match) => KNOWLEDGE_ARTICLES.find((article) => article.id === match.id))
    .filter((article): article is KnowledgeArticle => Boolean(article));

  return selectedArticles.map(buildKnowledgeArticleBlock).join("\n\n");
}

export function buildRelevantKnowledge(
  question: string,
  intent: AssistantIntent,
  context: AssistantAccountContext
): string {
  const snapshot = buildAccountSnapshot(context);
  const digest = buildKnowledgeDigest(question, intent);

  return [`## Snapshot compte`, snapshot, digest].join("\n\n");
}

export function buildSuggestedStatusCards(
  context: AssistantAccountContext
): AssistantStatusCard[] {
  return [
    {
      label: "Compte",
      value: context.isAuthenticated ? "Connecté" : "Visiteur",
      tone: context.isAuthenticated ? "success" : "default",
    },
    {
      label: "Pierre",
      value: context.hasPierreAccess ? "Actif" : "Non actif",
      tone: context.hasPierreAccess ? "success" : "warn",
    },
    {
      label: "Onboarding",
      value: context.hasPierreAccess
        ? context.onboardingCompleted
          ? "Terminé"
          : "À compléter"
        : "—",
      tone: context.onboardingCompleted ? "success" : context.hasPierreAccess ? "warn" : "default",
    },
    {
      label: "Entreprise",
      value: context.companyName || "Non renseignée",
      tone: context.companyName ? "violet" : "default",
    },
    {
      label: "Email d'envoi",
      value:
        context.senderEmailEffective ||
        context.senderEmailRequested ||
        "Non configuré",
      tone:
        context.senderEmailEffective || context.senderEmailRequested
          ? "violet"
          : "default",
    },
    {
      label: "Domaine",
      value: context.domainStatus || "Non commencé",
      tone: context.domainStatus === "verified" ? "success" : context.domainStatus ? "warn" : "default",
    },
  ];
}

export function buildSuggestedLinks(
  context: AssistantAccountContext,
  intent?: AssistantIntent
): AssistantLinkCard[] {
  const links: AssistantLinkCard[] = [];

  if (context.hasPierreAccess && !context.onboardingCompleted) {
    links.push({
      label: "Configurer Pierre",
      href: "/agents/pierre/setup",
      description: "Compléter l'Empreinte Entreprise avant usage intensif.",
    });
  }

  if (context.hasPierreAccess) {
    links.push({
      label: "Ouvrir Pierre",
      href: "/agents/pierre/use",
      description: "Entrer dans le centre de missions RH de Pierre.",
    });
  }

  if (!context.hasPierreAccess) {
    links.push({
      label: "Découvrir Pierre",
      href: "/agents/pierre",
      description: "Voir l'employé le plus concret actuellement.",
    });

    links.push({
      label: "Aller au paiement",
      href: "/paiement",
      description: "Commencer le parcours d'activation CloneStore.",
    });
  }

  if (intent === "navigation" || intent === "general") {
    links.push({
      label: "Mon espace",
      href: "/profile",
      description: "Pilotage global du compte, des accès et des réglages.",
    });

    links.push({
      label: "Mes employés",
      href: "/profile/agents",
      description: "Accès direct aux employés visibles et actifs.",
    });
  }

  if (intent === "support" || intent === "general") {
    links.push({
      label: "Questions / Support",
      href: "/questions",
      description: "Zone d'orientation et de support public.",
    });
  }

  if (
    intent === "email_identity" ||
    intent === "onboarding" ||
    intent === "use_page"
  ) {
    links.push({
      label: "Voir la fiche Pierre",
      href: "/agents/pierre",
      description: "Revoir le rôle, le périmètre et les usages de Pierre.",
    });
  }

  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  }).slice(0, 4);
}

export function getAssistantWelcome(context: AssistantAccountContext): string {
  if (!context.isAuthenticated) {
    return "Bonjour. Je suis CloneChat. Je peux t'expliquer CloneStore proprement, te dire quel employé choisir maintenant, et surtout te donner le bon prochain pas sans te faire perdre du temps.";
  }

  if (context.hasPierreAccess && !context.onboardingCompleted) {
    return `Bonjour. Pierre est déjà accessible${context.companyName ? ` pour ${context.companyName}` : ""}. Le bon prochain mouvement, c'est de terminer l'Empreinte Entreprise pour qu'il travaille comme ton entreprise et non comme un modèle générique.`;
  }

  if (context.hasPierreAccess && context.onboardingCompleted) {
    return `Bonjour. Pierre est déjà actif${context.companyName ? ` pour ${context.companyName}` : ""}. Je peux maintenant surtout t'aider à l'utiliser correctement : missions, usage quotidien, email, PDF, historique et logique d'envoi.`;
  }

  return "Bonjour. Tu es dans CloneStore. Je peux t'aider à comprendre le système, te guider dans le site et te dire franchement quel employé a le plus de valeur tout de suite.";
}

export function getAssistantQuickAsks(context: AssistantAccountContext): string[] {
  if (!context.isAuthenticated) {
    return [
      "Quel employé choisir maintenant ?",
      "Explique CloneStore simplement",
      "À quoi sert Pierre exactement ?",
      "Comment se passe l'accès après paiement ?",
      "Quelle est la différence entre Mon espace, Mes employés et la boutique ?",
      "Est-ce que Clara est vraiment prête aujourd'hui ?",
    ];
  }

  if (context.hasPierreAccess && !context.onboardingCompleted) {
    return [
      "Quelles parties du setup Pierre sont les plus importantes ?",
      "Explique-moi l'Empreinte Entreprise simplement",
      "Que dois-je faire après avoir activé Pierre ?",
      "Comment fonctionne l'identité email de Pierre ?",
      "Quand est-ce que je vais sur Pierre Use ?",
      "Quels champs ont le plus d'impact sur la qualité ?",
    ];
  }

  if (context.hasPierreAccess && context.onboardingCompleted) {
    return [
      "Comment utiliser Pierre au quotidien ?",
      "Comment fonctionne la page Pierre Use ?",
      "Quelle est la logique email / PDF ?",
      "Comment marche l'identité d'envoi ?",
      "Que fait Pierre vraiment, et où sont ses limites ?",
      "Quelle est la différence entre le cockpit et Pierre Use ?",
    ];
  }

  return [
    "Quel employé choisir aujourd'hui ?",
    "Explique le produit CloneStore simplement",
    "Pourquoi Pierre est l'entrée la plus forte ?",
    "Comment fonctionne le cockpit ?",
    "À quoi sert CloneChat ?",
    "Où aller dans le site selon mon besoin ?",
  ];
}

function buildConcreteNextStep(
  context: AssistantAccountContext,
  intent: AssistantIntent
): string {
  if (context.hasPierreAccess && !context.onboardingCompleted) {
    return "Le prochain pas concret : ouvre /agents/pierre/setup et complète d'abord l'Empreinte Entreprise.";
  }

  if (context.hasPierreAccess && context.onboardingCompleted) {
    if (intent === "onboarding") {
      return "Le prochain pas concret : une fois le setup validé, ouvre /agents/pierre/use et commence par une vraie mission RH simple.";
    }

    return "Le prochain pas concret : ouvre /agents/pierre/use et travaille directement depuis le centre de missions.";
  }

  if (!context.hasPierreAccess && intent === "clone_choice") {
    return "Le prochain pas concret : ouvre /agents/pierre pour vérifier le périmètre, puis /paiement si tu veux l'activer.";
  }

  if (!context.hasPierreAccess) {
    return "Le prochain pas concret : ouvre /agents/pierre si tu veux voir l'employé le plus concret aujourd'hui.";
  }

  return "Le prochain pas concret : utilise Mon espace ou Mes employés pour aller vers la bonne zone.";
}

export function buildDeterministicAnswer(
  question: string,
  context: AssistantAccountContext,
  intent: AssistantIntent
): string | null {
  const q = clean(question);

  if (intent === "clone_choice") {
    return [
      "Aujourd'hui, je te conseille Pierre.",
      "C'est l'employé le plus concret, le plus cohérent et le plus exploitable immédiatement dans CloneStore.",
      "Il a déjà une logique claire : setup entreprise, cockpit d'usage, missions, documents, emails, PDF, suivi et historique.",
      "Je préfère te le dire franchement : je ne vais pas te faire perdre du temps à te vendre plus mûr qu'il ne l'est un autre employé encore en construction.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "status_other_employees") {
    return [
      "Je reste propre là-dessus : Pierre est aujourd'hui l'employé le plus concret.",
      "Les autres employés visibles existent dans la vision CloneStore, mais ils ne doivent pas être présentés comme totalement prêts tant que leur niveau de finition réel n'est pas au même standard.",
      "Donc si ta question est opérationnelle et immédiate, la réponse honnête reste Pierre.",
      buildConcreteNextStep(context, "clone_choice"),
    ].join(" ");
  }

  if (intent === "post_payment") {
    if (context.hasPierreAccess && !context.onboardingCompleted) {
      return [
        "Ton paiement ou ton accès a déjà ouvert Pierre, mais le vrai prochain pas n'est pas encore l'usage brut.",
        "Le bon mouvement maintenant, c'est le setup / l'Empreinte Entreprise.",
        "C'est ce qui donne à Pierre ton identité, ton ton, tes règles et ta logique email.",
        buildConcreteNextStep(context, intent),
      ].join(" ");
    }

    if (context.hasPierreAccess && context.onboardingCompleted) {
      return [
        "Ton accès est déjà exploitable.",
        "À ce stade, le bon prochain pas n'est plus la configuration de base mais l'usage réel.",
        "Le cockpit Pierre Use est l'endroit où tu lances des missions, suis les tâches et exploites les sorties.",
        buildConcreteNextStep(context, intent),
      ].join(" ");
    }

    return [
      "Le parcours propre après paiement est simple : accès actif, onboarding utile, puis cockpit d'usage.",
      "Pour Pierre, ça donne : activation, setup entreprise, puis Pierre Use.",
      "Le produit doit toujours te reprendre avec une étape claire, pas te laisser dans le vide.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "onboarding") {
    if (
      includesOne(q, [
        "a quoi sert",
        "à quoi sert",
        "pourquoi",
        "c'est quoi",
        "cest quoi",
      ])
    ) {
      return [
        "L'onboarding Pierre sert à transmettre à Pierre la réalité de ton entreprise.",
        "Ce n'est pas un formulaire administratif décoratif.",
        "C'est la base CloneADN : identité, ton, contexte RH, valideurs, actions autorisées, interdits et identité email.",
        "Plus cette base est propre, plus Pierre agit juste dès le départ.",
        buildConcreteNextStep(context, intent),
      ].join(" ");
    }

    if (
      includesOne(q, [
        "plus important",
        "priorite",
        "priorité",
        "quelles parties",
        "quels champs",
      ])
    ) {
      return [
        "Les blocs les plus importants sont : identité entreprise, contexte RH, ton, valideurs, règles d'action et identité email.",
        "Ce sont eux qui changent le plus directement la qualité réelle de Pierre.",
        "Si tu veux aller vite sans mal faire, commence par ces zones-là.",
        buildConcreteNextStep(context, intent),
      ].join(" ");
    }

    return [
      "Le setup Pierre sert à le transformer en employé aligné sur ton entreprise.",
      "Il doit récupérer qui vous êtes, comment vous écrivez, ce qu'il a le droit de faire et comment il doit se comporter.",
      "Sans cette base, Pierre reste plus générique. Avec elle, il devient beaucoup plus cohérent.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "use_page") {
    return [
      "La page Pierre Use est le cockpit opérationnel de Pierre.",
      "Tu n'y fais pas juste du chat : tu y lances une mission, Pierre la comprend, la structure, produit des sorties, suit les tâches, centralise les artefacts et garde l'historique.",
      "Il faut la voir comme un centre de commandement RH, pas comme une simple zone de prompt.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "email_identity") {
    return [
      "La logique d'identité d'envoi est simple sur le fond : Pierre doit pouvoir envoyer au nom de l'entreprise quand le domaine et la configuration sont réellement prêts.",
      "Tant que ce n'est pas proprement vérifié, le système peut rester sur une identité de fallback.",
      "Une fois le domaine prêt, l'identité cible peut devenir l'identité active.",
      "Le point important n'est pas la technique DNS en elle-même, mais de rester honnête sur ce qui est déjà actif et ce qui ne l'est pas encore.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "email_pdf_action") {
    return [
      "La règle saine est la suivante : email et PDF doivent repartir de la version active du contenu.",
      "Si tu as modifié puis enregistré un texte, c'est cette version qui doit servir de source.",
      "Et si un PDF a été généré avant une modification importante, il faut le régénérer pour éviter un décalage.",
      "Le support doit toujours garder cette logique simple : une version active, des artefacts alignés dessus.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "limits") {
    return [
      "Pierre est fort, mais il a un périmètre clair.",
      "Il ne doit pas être vendu comme juriste formel, ni comme moteur massif de scoring CV, ni comme système qui invente des informations absentes.",
      "Sa force réelle est la production RH opérationnelle propre, contrôlée et exploitable.",
      buildConcreteNextStep(context, "use_page"),
    ].join(" ");
  }

  if (intent === "pricing") {
    return [
      "La référence tarifaire actuelle à retenir pour Pierre est 449€/mois.",
      "Mais le vrai sujet n'est pas seulement le prix : c'est la valeur immédiate.",
      "Aujourd'hui, Pierre est l'employé qui a le plus de crédibilité opérationnelle à ce tarif dans CloneStore.",
      buildConcreteNextStep(context, "clone_choice"),
    ].join(" ");
  }

  if (intent === "navigation") {
    return [
      "Mon espace sert au pilotage global du compte et des grands réglages.",
      "Mes employés sert à ouvrir les employés visibles ou actifs.",
      "La boutique sert à découvrir l'offre publique.",
      "Donc si tu veux agir dans le produit, il faut surtout distinguer pilotage global, accès employés et découverte commerciale.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "support") {
    return [
      "CloneChat doit servir d'employé poumon du support CloneStore.",
      "Son rôle est d'expliquer, orienter, rassurer et donner un prochain pas concret.",
      "Il ne doit pas répondre comme une FAQ fragile, mais comme un support premium intégré au coeur du produit.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "product_vision") {
    return [
      "La vision CloneStore repose sur un système coordonné : CloneOS pour l'orchestration, CloneADN pour l'alignement entreprise, CloneGuard pour gouvernance et risque, CloneTrace pour la traçabilité, et CloneVoice comme couche vocale premium future.",
      "Le produit doit toujours rester lisible côté client, mais profond côté système.",
      buildConcreteNextStep(context, "navigation"),
    ].join(" ");
  }

  return null;
}

export function buildFallbackAnswer(
  question: string,
  context: AssistantAccountContext,
  intent: AssistantIntent
): string {
  const deterministic = buildDeterministicAnswer(question, context, intent);
  if (deterministic) return deterministic;

  if (context.hasPierreAccess && !context.onboardingCompleted) {
    return [
      "Dans ton état actuel, le plus important reste de rendre Pierre correctement aligné à ton entreprise.",
      "Donc même si ta question est plus large, le meilleur prochain pas reste de compléter le setup Pierre.",
      buildConcreteNextStep(context, "onboarding"),
    ].join(" ");
  }

  if (context.hasPierreAccess && context.onboardingCompleted) {
    return [
      "Tu as déjà assez de base pour utiliser Pierre réellement.",
      "Je peux t'aider à naviguer dans le cockpit, comprendre la logique d'usage ou clarifier une étape produit.",
      buildConcreteNextStep(context, "use_page"),
    ].join(" ");
  }

  return [
    "Je peux t'aider à comprendre CloneStore, choisir le bon employé et aller au bon endroit sans perdre de temps.",
    "Aujourd'hui, l'entrée la plus solide reste Pierre.",
    buildConcreteNextStep(context, intent),
  ].join(" ");
}