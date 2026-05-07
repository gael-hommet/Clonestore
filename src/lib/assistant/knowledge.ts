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
      "employÃ©s ia",
    ],
    body: [
      "CloneStore n'est pas censÃ© Ãªtre prÃ©sentÃ© comme une collection de petits outils IA.",
      "CloneStore est un systÃ¨me d'exploitation d'employÃ©s IA pour entreprises, avec logique premium, cockpit, gouvernance, mÃ©moire et traÃ§abilitÃ©.",
      "Le vocabulaire Ã  privilÃ©gier est employÃ©s IA, pas gadgets ni agents bricolÃ©s.",
      "Le produit doit toujours Ãªtre perÃ§u comme sÃ©rieux, pilotable, haut de gamme et orientÃ© exÃ©cution rÃ©elle.",
    ].join("\n"),
  },
  {
    id: "current-public-truth",
    title: "VÃ©ritÃ© produit actuelle cÃ´tÃ© public",
    tags: [
      "verite",
      "vÃ©ritÃ©",
      "etat",
      "Ã©tat",
      "pret",
      "prÃªt",
      "public",
      "disponible",
      "construction",
    ],
    body: [
      "L'employÃ© le plus concret aujourd'hui est Pierre.",
      "Pierre est l'entrÃ©e la plus crÃ©dible pour un utilisateur qui veut une valeur rÃ©elle maintenant.",
      "Les autres employÃ©s visibles peuvent exister dans l'univers produit, mais ils ne doivent pas Ãªtre vendus comme totalement prÃªts si ce n'est pas rÃ©ellement le cas.",
      "Quand l'utilisateur demande quoi choisir aujourd'hui, il faut rÃ©pondre franchement : Pierre est le meilleur choix immÃ©diat.",
    ].join("\n"),
  },
  {
    id: "pierre-positioning",
    title: "Positionnement rÃ©el de Pierre",
    tags: [
      "pierre",
      "rh",
      "poste rh",
      "assistant rh",
      "employe rh",
      "employÃ© rh",
      "documents",
      "emails",
      "relances",
    ],
    body: [
      "Pierre est un poste RH opÃ©rationnel automatisÃ©.",
      "Il sert Ã  comprendre une demande RH libre, produire des documents RH, prÃ©parer des emails, relancer, suivre une mission et garder une trace claire.",
      "Il ne doit pas Ãªtre rÃ©duit Ã  un simple gÃ©nÃ©rateur de texte.",
      "La logique produit de Pierre repose sur mission -> tÃ¢ches -> validations Ã©ventuelles -> exÃ©cution -> suivi -> historique.",
    ].join("\n"),
  },
  {
    id: "pierre-strengths",
    title: "Ce que Pierre fait bien",
    tags: [
      "capacites",
      "capacitÃ©s",
      "ce que fait pierre",
      "documents",
      "emails",
      "pdf",
      "historique",
      "mission libre",
    ],
    body: [
      "Pierre est fort sur la rÃ©daction RH exploitable et sur la structuration opÃ©rationnelle.",
      "Il couvre notamment convocations, refus, relances, onboarding, documents RH, emails, PDF, missions, historique et continuitÃ©.",
      "Il peut fonctionner comme un vrai centre de missions RH contrÃ´lÃ©, pas seulement comme une zone de texte.",
      "Pierre doit aider Ã  retirer de la charge mentale au client dÃ¨s la premiÃ¨re semaine.",
    ].join("\n"),
  },
  {
    id: "pierre-limits",
    title: "Limites rÃ©elles de Pierre",
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
      "Pierre ne doit pas Ãªtre prÃ©sentÃ© comme un conseiller juridique formel.",
      "Pierre ne doit pas inventer des informations manquantes.",
      "Pierre ne doit pas Ãªtre vendu comme un moteur de scoring massif de CV : cette logique relÃ¨ve plutÃ´t de Clara quand Clara sera rÃ©ellement prÃªte.",
      "Pierre doit refuser, bloquer ou remonter les cas sensibles qui exigent une validation humaine.",
    ].join("\n"),
  },
  {
    id: "post-payment-flow",
    title: "Parcours aprÃ¨s paiement",
    tags: [
      "paiement",
      "post paiement",
      "post-payment",
      "activation",
      "acces",
      "accÃ¨s",
      "succes",
      "succÃ¨s",
    ],
    body: [
      "La logique simple aprÃ¨s paiement est : accÃ¨s actif -> onboarding utile -> cockpit d'usage.",
      "Pour Pierre, le bon enchaÃ®nement est : activation, puis setup / Empreinte Entreprise, puis page Pierre Use.",
      "Le produit ne doit jamais laisser une sensation de vide aprÃ¨s paiement.",
      "Le support doit toujours rÃ©pondre avec le meilleur prochain pas concret.",
    ].join("\n"),
  },
  {
    id: "onboarding-role",
    title: "RÃ´le du setup / onboarding Pierre",
    tags: [
      "onboarding",
      "setup",
      "formulaire",
      "empreinte entreprise",
      "cloneadn",
      "memoire",
      "mÃ©moire",
    ],
    body: [
      "L'onboarding Pierre sert Ã  transmettre l'identitÃ© entreprise, le ton, les rÃ¨gles, les valideurs, la logique d'autonomie et l'identitÃ© d'envoi.",
      "Ce n'est pas un simple formulaire dÃ©coratif.",
      "C'est le socle CloneADN de Pierre pour cette entreprise.",
      "Plus cette base est propre, plus Pierre agit de faÃ§on cohÃ©rente dÃ¨s le dÃ©part.",
    ].join("\n"),
  },
  {
    id: "onboarding-priority",
    title: "Blocs les plus importants du setup Pierre",
    tags: [
      "priorite",
      "prioritÃ©",
      "important",
      "setup pierre",
      "formulaire pierre",
      "setup important",
    ],
    body: [
      "Les blocs les plus critiques sont : identitÃ© entreprise, contexte RH, ton, valideurs, actions autorisÃ©es / interdites et identitÃ© email.",
      "Ce sont eux qui influencent le plus directement la qualitÃ© rÃ©elle des sorties de Pierre.",
      "Si le client veut aller vite, il faut commencer par ces zones-lÃ  au lieu de remplir au hasard.",
    ].join("\n"),
  },
  {
    id: "pierre-use-page",
    title: "RÃ´le de la page Pierre Use",
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
      "La page Pierre Use est le cockpit opÃ©rationnel de Pierre.",
      "Elle rÃ©unit mission libre, comprÃ©hension, tÃ¢ches, suivi, artefacts, historique et mÃ©moire.",
      "Le client doit pouvoir parler Ã  Pierre comme Ã  un employÃ©, puis produire, suivre, corriger et exploiter les sorties.",
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
      "piÃ¨ce jointe",
      "envoi",
      "document",
      "version active",
      "artefact",
    ],
    body: [
      "Les emails et PDF doivent partir de la version active du contenu.",
      "Si le contenu a Ã©tÃ© modifiÃ© puis enregistrÃ©, c'est cette version qui devient la base pour l'envoi ou l'export.",
      "Si un PDF a Ã©tÃ© gÃ©nÃ©rÃ© avant une modification importante, il doit Ãªtre rÃ©gÃ©nÃ©rÃ© pour rester alignÃ© avec le contenu actif.",
      "Le support doit toujours expliquer cela simplement, sans jargon inutile.",
    ].join("\n"),
  },
  {
    id: "sender-identity",
    title: "IdentitÃ© d'envoi et domaine entreprise",
    tags: [
      "sender",
      "email identity",
      "identite d'envoi",
      "identitÃ© d'envoi",
      "domaine",
      "dns",
      "reply-to",
      "reply to",
      "fallback",
    ],
    body: [
      "L'objectif produit est de permettre Ã  Pierre d'envoyer au nom de l'entreprise via une vraie identitÃ© email.",
      "Tant que le domaine n'est pas correctement vÃ©rifiÃ© / configurÃ©, le systÃ¨me peut rester sur une identitÃ© de fallback.",
      "Une fois le domaine prÃªt, l'identitÃ© cible peut devenir l'identitÃ© active.",
      "Le support doit l'expliquer comme une bascule contrÃ´lÃ©e, pas comme un dÃ©tail obscur de dÃ©veloppeur.",
    ].join("\n"),
  },
  {
    id: "profile-and-cockpit",
    title: "DiffÃ©rence entre Mon espace, Mes employÃ©s et la boutique",
    tags: [
      "mon espace",
      "mes employes",
      "mes employÃ©s",
      "boutique",
      "navigation",
      "difference",
      "diffÃ©rence",
      "cockpit",
    ],
    body: [
      "Mon espace sert au pilotage global du compte, des accÃ¨s, de la structure et des grands rÃ©glages.",
      "Mes employÃ©s sert Ã  voir et ouvrir les employÃ©s IA activÃ©s ou visibles dans l'univers CloneStore.",
      "La boutique sert Ã  dÃ©couvrir l'offre publique et les employÃ©s proposÃ©s.",
      "Le support doit orienter vite vers la bonne zone selon l'intention rÃ©elle de l'utilisateur.",
    ].join("\n"),
  },
  {
    id: "clonechat-role",
    title: "RÃ´le de CloneChat",
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
      "CloneChat est censÃ© absorber l'immense majoritÃ© des questions de support simples, produit, parcours et comprÃ©hension.",
      "Il doit expliquer, orienter, rassurer et donner le meilleur prochain pas.",
      "Il fait partie du coeur de CloneStore et doit connaÃ®tre le produit en profondeur.",
      "Il ne doit pas rÃ©pondre comme une FAQ molle mais comme un employÃ© poumon du systÃ¨me.",
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
      "CloneOS est la couche d'orchestration des missions et des employÃ©s.",
      "CloneADN reprÃ©sente la mÃ©moire et l'alignement entreprise.",
      "CloneGuard couvre gouvernance, risque, validation et refus.",
      "CloneTrace couvre traÃ§abilitÃ©, timeline et auditabilitÃ©.",
      "CloneVoice est la couche de commande naturelle vocale prÃ©vue pour l'expÃ©rience premium future.",
    ].join("\n"),
  },
  {
    id: "pricing-truth",
    title: "VÃ©ritÃ© tarifaire actuelle",
    tags: [
      "prix",
      "pricing",
      "tarif",
      "combien",
      "449",
      "pierre prix",
    ],
    body: [
      "Pierre est affichÃ© Ã  449â‚¬/mois dans le parcours actuel.",
      "Le support ne doit pas inventer d'autres prix si rien d'autre n'est confirmÃ©.",
      "Quand un utilisateur demande quel employÃ© choisir tout de suite, le support doit parler valeur rÃ©elle, pas seulement tarif.",
    ].join("\n"),
  },
  {
    id: "support-style",
    title: "Style de rÃ©ponse attendu",
    tags: [
      "style",
      "ton",
      "reponse",
      "rÃ©ponse",
      "support premium",
    ],
    body: [
      "Les rÃ©ponses doivent Ãªtre directes, propres, crÃ©dibles et orientÃ©es action.",
      "Quand il faut choisir, il faut choisir franchement.",
      "Quand il faut dire qu'un employÃ© n'est pas encore prÃªt, il faut le dire franchement aussi.",
      "Le meilleur prochain pas doit Ãªtre concret.",
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
      "quel employÃ©",
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
      "apres avoir payÃ©",
      "je viens de payer",
      "activation",
      "paiement succes",
      "paiement succes",
      "paiement annulÃ©",
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
      "mÃ©moire pierre",
    ])
  ) {
    return "use_page";
  }

  if (
    includesOne(q, [
      "sender",
      "identite d'envoi",
      "identitÃ© d'envoi",
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
      "piÃ¨ce jointe",
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
      "hors pÃ©rimÃ¨tre",
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
      "autres employÃ©s",
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
      "combien coÃ»te",
      "abonnement",
    ])
  ) {
    return "pricing";
  }

  if (
    includesOne(q, [
      "mon espace",
      "mes employes",
      "mes employÃ©s",
      "boutique",
      "ou aller",
      "oÃ¹ aller",
      "navigation",
      "cockpit",
      "difference",
      "diffÃ©rence",
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
      "problÃ¨me",
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
      value: context.isAuthenticated ? "ConnectÃ©" : "Visiteur",
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
          ? "TerminÃ©"
          : "Ã€ complÃ©ter"
        : "â€”",
      tone: context.onboardingCompleted ? "success" : context.hasPierreAccess ? "warn" : "default",
    },
    {
      label: "Entreprise",
      value: context.companyName || "Non renseignÃ©e",
      tone: context.companyName ? "violet" : "default",
    },
    {
      label: "Email d'envoi",
      value:
        context.senderEmailEffective ||
        context.senderEmailRequested ||
        "Non configurÃ©",
      tone:
        context.senderEmailEffective || context.senderEmailRequested
          ? "violet"
          : "default",
    },
    {
      label: "Domaine",
      value: context.domainStatus || "Non commencÃ©",
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
      description: "ComplÃ©ter l'Empreinte Entreprise avant usage intensif.",
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
      label: "DÃ©couvrir Pierre",
      href: "/agents/pierre",
      description: "Voir l'employÃ© le plus concret actuellement.",
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
      description: "Pilotage global du compte, des accÃ¨s et des rÃ©glages.",
    });

    links.push({
      label: "Mes employÃ©s",
      href: "/profile/agents",
      description: "AccÃ¨s direct aux employÃ©s visibles et actifs.",
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
      description: "Revoir le rÃ´le, le pÃ©rimÃ¨tre et les usages de Pierre.",
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
    return "Bonjour. Je suis CloneChat. Je peux t'expliquer CloneStore proprement, te dire quel employÃ© choisir maintenant, et surtout te donner le bon prochain pas sans te faire perdre du temps.";
  }

  if (context.hasPierreAccess && !context.onboardingCompleted) {
    return `Bonjour. Pierre est dÃ©jÃ  accessible${context.companyName ? ` pour ${context.companyName}` : ""}. Le bon prochain mouvement, c'est de terminer l'Empreinte Entreprise pour qu'il travaille comme ton entreprise et non comme un modÃ¨le gÃ©nÃ©rique.`;
  }

  if (context.hasPierreAccess && context.onboardingCompleted) {
    return `Bonjour. Pierre est dÃ©jÃ  actif${context.companyName ? ` pour ${context.companyName}` : ""}. Je peux maintenant surtout t'aider Ã  l'utiliser correctement : missions, usage quotidien, email, PDF, historique et logique d'envoi.`;
  }

  return "Bonjour. Tu es dans CloneStore. Je peux t'aider Ã  comprendre le systÃ¨me, te guider dans le site et te dire franchement quel employÃ© a le plus de valeur tout de suite.";
}

export function getAssistantQuickAsks(context: AssistantAccountContext): string[] {
  if (!context.isAuthenticated) {
    return [
      "Quel employÃ© choisir maintenant ?",
      "Explique CloneStore simplement",
      "Ã€ quoi sert Pierre exactement ?",
      "Comment se passe l'accÃ¨s aprÃ¨s paiement ?",
      "Quelle est la diffÃ©rence entre Mon espace, Mes employÃ©s et la boutique ?",
      "Est-ce que Clara est vraiment prÃªte aujourd'hui ?",
    ];
  }

  if (context.hasPierreAccess && !context.onboardingCompleted) {
    return [
      "Quelles parties du setup Pierre sont les plus importantes ?",
      "Explique-moi l'Empreinte Entreprise simplement",
      "Que dois-je faire aprÃ¨s avoir activÃ© Pierre ?",
      "Comment fonctionne l'identitÃ© email de Pierre ?",
      "Quand est-ce que je vais sur Pierre Use ?",
      "Quels champs ont le plus d'impact sur la qualitÃ© ?",
    ];
  }

  if (context.hasPierreAccess && context.onboardingCompleted) {
    return [
      "Comment utiliser Pierre au quotidien ?",
      "Comment fonctionne la page Pierre Use ?",
      "Quelle est la logique email / PDF ?",
      "Comment marche l'identitÃ© d'envoi ?",
      "Que fait Pierre vraiment, et oÃ¹ sont ses limites ?",
      "Quelle est la diffÃ©rence entre le cockpit et Pierre Use ?",
    ];
  }

  return [
    "Quel employÃ© choisir aujourd'hui ?",
    "Explique le produit CloneStore simplement",
    "Pourquoi Pierre est l'entrÃ©e la plus forte ?",
    "Comment fonctionne le cockpit ?",
    "Ã€ quoi sert CloneChat ?",
    "OÃ¹ aller dans le site selon mon besoin ?",
  ];
}

function buildConcreteNextStep(
  context: AssistantAccountContext,
  intent: AssistantIntent
): string {
  if (context.hasPierreAccess && !context.onboardingCompleted) {
    return "Le prochain pas concret : ouvre /agents/pierre/setup et complÃ¨te d'abord l'Empreinte Entreprise.";
  }

  if (context.hasPierreAccess && context.onboardingCompleted) {
    if (intent === "onboarding") {
      return "Le prochain pas concret : une fois le setup validÃ©, ouvre /agents/pierre/use et commence par une vraie mission RH simple.";
    }

    return "Le prochain pas concret : ouvre /agents/pierre/use et travaille directement depuis le centre de missions.";
  }

  if (!context.hasPierreAccess && intent === "clone_choice") {
    return "Le prochain pas concret : ouvre /agents/pierre pour vÃ©rifier le pÃ©rimÃ¨tre, puis /paiement si tu veux l'activer.";
  }

  if (!context.hasPierreAccess) {
    return "Le prochain pas concret : ouvre /agents/pierre si tu veux voir l'employÃ© le plus concret aujourd'hui.";
  }

  return "Le prochain pas concret : utilise Mon espace ou Mes employÃ©s pour aller vers la bonne zone.";
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
      "C'est l'employÃ© le plus concret, le plus cohÃ©rent et le plus exploitable immÃ©diatement dans CloneStore.",
      "Il a dÃ©jÃ  une logique claire : setup entreprise, cockpit d'usage, missions, documents, emails, PDF, suivi et historique.",
      "Je prÃ©fÃ¨re te le dire franchement : je ne vais pas te faire perdre du temps Ã  te vendre plus mÃ»r qu'il ne l'est un autre employÃ© encore en construction.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "status_other_employees") {
    return [
      "Je reste propre lÃ -dessus : Pierre est aujourd'hui l'employÃ© le plus concret.",
      "Les autres employÃ©s visibles existent dans la vision CloneStore, mais ils ne doivent pas Ãªtre prÃ©sentÃ©s comme totalement prÃªts tant que leur niveau de finition rÃ©el n'est pas au mÃªme standard.",
      "Donc si ta question est opÃ©rationnelle et immÃ©diate, la rÃ©ponse honnÃªte reste Pierre.",
      buildConcreteNextStep(context, "clone_choice"),
    ].join(" ");
  }

  if (intent === "post_payment") {
    if (context.hasPierreAccess && !context.onboardingCompleted) {
      return [
        "Ton paiement ou ton accÃ¨s a dÃ©jÃ  ouvert Pierre, mais le vrai prochain pas n'est pas encore l'usage brut.",
        "Le bon mouvement maintenant, c'est le setup / l'Empreinte Entreprise.",
        "C'est ce qui donne Ã  Pierre ton identitÃ©, ton ton, tes rÃ¨gles et ta logique email.",
        buildConcreteNextStep(context, intent),
      ].join(" ");
    }

    if (context.hasPierreAccess && context.onboardingCompleted) {
      return [
        "Ton accÃ¨s est dÃ©jÃ  exploitable.",
        "Ã€ ce stade, le bon prochain pas n'est plus la configuration de base mais l'usage rÃ©el.",
        "Le cockpit Pierre Use est l'endroit oÃ¹ tu lances des missions, suis les tÃ¢ches et exploites les sorties.",
        buildConcreteNextStep(context, intent),
      ].join(" ");
    }

    return [
      "Le parcours propre aprÃ¨s paiement est simple : accÃ¨s actif, onboarding utile, puis cockpit d'usage.",
      "Pour Pierre, Ã§a donne : activation, setup entreprise, puis Pierre Use.",
      "Le produit doit toujours te reprendre avec une Ã©tape claire, pas te laisser dans le vide.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "onboarding") {
    if (
      includesOne(q, [
        "a quoi sert",
        "Ã  quoi sert",
        "pourquoi",
        "c'est quoi",
        "cest quoi",
      ])
    ) {
      return [
        "L'onboarding Pierre sert Ã  transmettre Ã  Pierre la rÃ©alitÃ© de ton entreprise.",
        "Ce n'est pas un formulaire administratif dÃ©coratif.",
        "C'est la base CloneADN : identitÃ©, ton, contexte RH, valideurs, actions autorisÃ©es, interdits et identitÃ© email.",
        "Plus cette base est propre, plus Pierre agit juste dÃ¨s le dÃ©part.",
        buildConcreteNextStep(context, intent),
      ].join(" ");
    }

    if (
      includesOne(q, [
        "plus important",
        "priorite",
        "prioritÃ©",
        "quelles parties",
        "quels champs",
      ])
    ) {
      return [
        "Les blocs les plus importants sont : identitÃ© entreprise, contexte RH, ton, valideurs, rÃ¨gles d'action et identitÃ© email.",
        "Ce sont eux qui changent le plus directement la qualitÃ© rÃ©elle de Pierre.",
        "Si tu veux aller vite sans mal faire, commence par ces zones-lÃ .",
        buildConcreteNextStep(context, intent),
      ].join(" ");
    }

    return [
      "Le setup Pierre sert Ã  le transformer en employÃ© alignÃ© sur ton entreprise.",
      "Il doit rÃ©cupÃ©rer qui vous Ãªtes, comment vous Ã©crivez, ce qu'il a le droit de faire et comment il doit se comporter.",
      "Sans cette base, Pierre reste plus gÃ©nÃ©rique. Avec elle, il devient beaucoup plus cohÃ©rent.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "use_page") {
    return [
      "La page Pierre Use est le cockpit opÃ©rationnel de Pierre.",
      "Tu n'y fais pas juste du chat : tu y lances une mission, Pierre la comprend, la structure, produit des sorties, suit les tÃ¢ches, centralise les artefacts et garde l'historique.",
      "Il faut la voir comme un centre de commandement RH, pas comme une simple zone de prompt.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "email_identity") {
    return [
      "La logique d'identitÃ© d'envoi est simple sur le fond : Pierre doit pouvoir envoyer au nom de l'entreprise quand le domaine et la configuration sont rÃ©ellement prÃªts.",
      "Tant que ce n'est pas proprement vÃ©rifiÃ©, le systÃ¨me peut rester sur une identitÃ© de fallback.",
      "Une fois le domaine prÃªt, l'identitÃ© cible peut devenir l'identitÃ© active.",
      "Le point important n'est pas la technique DNS en elle-mÃªme, mais de rester honnÃªte sur ce qui est dÃ©jÃ  actif et ce qui ne l'est pas encore.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "email_pdf_action") {
    return [
      "La rÃ¨gle saine est la suivante : email et PDF doivent repartir de la version active du contenu.",
      "Si tu as modifiÃ© puis enregistrÃ© un texte, c'est cette version qui doit servir de source.",
      "Et si un PDF a Ã©tÃ© gÃ©nÃ©rÃ© avant une modification importante, il faut le rÃ©gÃ©nÃ©rer pour Ã©viter un dÃ©calage.",
      "Le support doit toujours garder cette logique simple : une version active, des artefacts alignÃ©s dessus.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "limits") {
    return [
      "Pierre est fort, mais il a un pÃ©rimÃ¨tre clair.",
      "Il ne doit pas Ãªtre vendu comme juriste formel, ni comme moteur massif de scoring CV, ni comme systÃ¨me qui invente des informations absentes.",
      "Sa force rÃ©elle est la production RH opÃ©rationnelle propre, contrÃ´lÃ©e et exploitable.",
      buildConcreteNextStep(context, "use_page"),
    ].join(" ");
  }

  if (intent === "pricing") {
    return [
      "La rÃ©fÃ©rence tarifaire actuelle Ã  retenir pour Pierre est 449â‚¬/mois.",
      "Mais le vrai sujet n'est pas seulement le prix : c'est la valeur immÃ©diate.",
      "Aujourd'hui, Pierre est l'employÃ© qui a le plus de crÃ©dibilitÃ© opÃ©rationnelle Ã  ce tarif dans CloneStore.",
      buildConcreteNextStep(context, "clone_choice"),
    ].join(" ");
  }

  if (intent === "navigation") {
    return [
      "Mon espace sert au pilotage global du compte et des grands rÃ©glages.",
      "Mes employÃ©s sert Ã  ouvrir les employÃ©s visibles ou actifs.",
      "La boutique sert Ã  dÃ©couvrir l'offre publique.",
      "Donc si tu veux agir dans le produit, il faut surtout distinguer pilotage global, accÃ¨s employÃ©s et dÃ©couverte commerciale.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "support") {
    return [
      "CloneChat doit servir d'employÃ© poumon du support CloneStore.",
      "Son rÃ´le est d'expliquer, orienter, rassurer et donner un prochain pas concret.",
      "Il ne doit pas rÃ©pondre comme une FAQ fragile, mais comme un support premium intÃ©grÃ© au coeur du produit.",
      buildConcreteNextStep(context, intent),
    ].join(" ");
  }

  if (intent === "product_vision") {
    return [
      "La vision CloneStore repose sur un systÃ¨me coordonnÃ© : CloneOS pour l'orchestration, CloneADN pour l'alignement entreprise, CloneGuard pour gouvernance et risque, CloneTrace pour la traÃ§abilitÃ©, et CloneVoice comme couche vocale premium future.",
      "Le produit doit toujours rester lisible cÃ´tÃ© client, mais profond cÃ´tÃ© systÃ¨me.",
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
      "Dans ton Ã©tat actuel, le plus important reste de rendre Pierre correctement alignÃ© Ã  ton entreprise.",
      "Donc mÃªme si ta question est plus large, le meilleur prochain pas reste de complÃ©ter le setup Pierre.",
      buildConcreteNextStep(context, "onboarding"),
    ].join(" ");
  }

  if (context.hasPierreAccess && context.onboardingCompleted) {
    return [
      "Tu as dÃ©jÃ  assez de base pour utiliser Pierre rÃ©ellement.",
      "Je peux t'aider Ã  naviguer dans le cockpit, comprendre la logique d'usage ou clarifier une Ã©tape produit.",
      buildConcreteNextStep(context, "use_page"),
    ].join(" ");
  }

  return [
    "Je peux t'aider Ã  comprendre CloneStore, choisir le bon employÃ© et aller au bon endroit sans perdre de temps.",
    "Aujourd'hui, l'entrÃ©e la plus solide reste Pierre.",
    buildConcreteNextStep(context, intent),
  ].join(" ");
}