// /demo — Contenu rédactionnel VERROUILLÉ (source de vérité unique)
//
// Tous les textes ci-dessous proviennent mot pour mot du master prompt
// (§12 à §21 et §28). Ils ne doivent pas être réécrits, "marketingisés" ni
// remplacés par des formulations génériques. Les scènes E2.1 → E2.10 importent
// ces constantes : un seul endroit à relire pour vérifier la fidélité.
//
// Apostrophes droites utilisées uniformément (choix de rendu, le libellé est
// strictement préservé).

export const DEMO_SCENE_ORDER = [
  "opening", // E2.1
  "fragmentation", // E2.2
  "category", // E2.3
  "system", // E2.4
  "footprint", // E2.5
  "scale", // E2.6
  "trust", // E2.7
  "pierreScope", // E2.8
  "organization", // E2.9
  "completion", // E2.10
] as const;

export type DemoSceneKey = (typeof DEMO_SCENE_ORDER)[number];

export const PIERRE_DEMO_ROUTE = "/demo/pierre";

// ──────────────────────────────────────────────────────────────────────────
// E2.1 — OUVERTURE
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_OPENING = {
  brandLine: "CLONESTORE — EMPLOYÉS IA POUR ENTREPRISES",
  title: ["Votre entreprise utilise déjà des logiciels.", "CloneStore lui apporte des employés IA."],
  subtext:
    "Vous formulez l'objectif. CloneStore organise la mission, mobilise l'employé compétent et suit chaque action jusqu'au résultat — selon les règles de votre entreprise.",
  primaryCta: "Découvrir CloneStore en 5 minutes",
  secondaryCta: "Voir directement Pierre",
  initialMission:
    "Prépare l'arrivée de notre nouvelle responsable commerciale à Lyon. Coordonne les documents, les validations et les communications nécessaires pour lundi.",
  comprehension: {
    understood: "Mission comprise",
    mobilized: "Pierre mobilisé",
    organized: "7 tâches organisées",
    validation: "1 validation nécessaire",
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.2 — FRAGMENTATION DU TRAVAIL
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_FRAGMENTATION = {
  title: ["LE TRAVAIL NE MANQUE PAS.", "IL SE DISPERSE."],
  paragraphs: [
    "Dans une entreprise, une demande simple traverse souvent plusieurs outils, plusieurs personnes et plusieurs validations avant d'être réellement terminée.",
    "Les équipes savent quoi faire. Mais elles doivent encore retrouver les informations, coordonner les intervenants, relancer, vérifier, documenter et rendre compte.",
    "À mesure que l'entreprise grandit, cette charge augmente plus vite que sa capacité à l'absorber.",
    "CloneStore réunit ce travail dans une mission claire, suivie jusqu'à son terme.",
  ],
  keyPhrase:
    "À mesure que l'entreprise grandit, le travail opérationnel augmente plus vite que la capacité des équipes à le suivre.",
  fragments: [
    "Informations collaborateur",
    "Modèle de document",
    "Manager",
    "Email",
    "Matériel",
    "Accès",
    "Rendez-vous",
    "Pièces manquantes",
    "Échéance",
    "Règles du site",
  ],
  zones: ["Messagerie", "Fichiers", "Logiciel RH", "Calendrier", "Tableau", "Messages internes"],
  statuses: [
    "Information manquante",
    "Validation en attente",
    "Version à vérifier",
    "Réponse non reçue",
    "Échéance proche",
  ],
  consolidated: ["7 tâches", "3 intervenants", "1 validation", "Échéance lundi", "Suivi actif"],
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.3 — LOGICIEL, AUTOMATISATION, AGENT, EMPLOYÉ IA
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_CATEGORY = {
  title: ["UN OUTIL ATTEND UNE ACTION.", "UN EMPLOYÉ PREND EN CHARGE LE TRAVAIL."],
  paragraphs: [
    "Un logiciel aide vos équipes à effectuer leurs tâches.",
    "Une automatisation suit un scénario défini.",
    "Un agent IA peut accomplir une action ou répondre à une demande.",
    "Un employé IA reçoit un objectif, organise le travail nécessaire, l'exécute dans son périmètre, sollicite les validations utiles et poursuit la mission jusqu'à son terme.",
    "CloneStore ne vous demande pas de construire vos propres agents.",
    "Il met à disposition des employés IA déjà spécialisés, prêts à s'adapter à votre entreprise.",
  ],
  sharedObjective: "Préparer et coordonner l'arrivée d'une collaboratrice lundi.",
  states: [
    {
      key: "logiciel",
      label: "Logiciel",
      provides: ["Dossier", "Document", "Calendrier", "Tâches", "Messagerie"],
      message: ["Le logiciel organise l'information.", "L'humain organise encore le travail."],
    },
    {
      key: "automatisation",
      label: "Automatisation",
      provides: ["Nouveau collaborateur", "Dossier", "Email", "Manager"],
      message: [
        "L'automatisation exécute ce qui a été prévu.",
        "Elle dépend du scénario qui lui a été donné.",
      ],
    },
    {
      key: "agent",
      label: "Agent IA",
      provides: ["Email", "Checklist", "Résumé", "Document"],
      message: ["L'agent IA accomplit une action intelligente."],
    },
    {
      key: "employe",
      label: "Employé IA CloneStore",
      provides: [
        "Comprend",
        "Structure",
        "Décompose",
        "Identifie",
        "Exécute",
        "Attend",
        "Reprend",
        "Demande une validation",
        "Trace",
        "Rend compte",
      ],
      message: ["L'employé IA prend en charge la mission."],
    },
  ],
  employeeFollowUp: "Il comprend, organise, exécute, suit et rend compte.",
  conclusion: [
    "Vous ne pilotez plus chaque tâche.",
    "Vous confiez un objectif et conservez le contrôle.",
    "C'est la différence entre utiliser un outil et travailler avec un employé IA.",
  ],
  pierreLabel: "Pierre — Employé IA RH",
  pierreLines: [
    "Pierre ne réalise pas une tâche RH isolée.",
    "Il prend en charge le travail opérationnel d'une fonction RH entière.",
  ],
  transition:
    "Comment un employé IA peut-il organiser autant de travail sans perdre le contexte ni le contrôle ?",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.4 — SYSTÈME CLONESTORE
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_SYSTEM = {
  title: ["UNE DEMANDE.", "TOUT UN SYSTÈME SE MET AU TRAVAIL."],
  paragraphs: [
    "CloneStore transforme chaque objectif en une mission structurée.",
    "CloneOS organise le travail.",
    "CloneADN applique le fonctionnement propre à votre entreprise.",
    "CloneGuard encadre l'autonomie et les actions sensibles.",
    "L'employé IA compétent exécute la mission dans son domaine.",
    "CloneTrace conserve chaque étape, chaque validation et chaque décision.",
    "CloneBrief vous restitue l'essentiel.",
  ],
  headline: ["Vous formulez l'objectif.", "CloneStore coordonne le reste."],
  layers: [
    {
      key: "cloneos",
      name: "CloneOS",
      role: "Organise",
      missionTitle: "Mission RH — Onboarding responsable commerciale",
      facts: ["7 tâches", "3 dépendances", "4 intervenants", "1 validation", "Échéance lundi"],
      message: "CloneOS transforme l'objectif en travail organisé.",
      secondary: "Comprendre. Décomposer. Prioriser. Coordonner.",
    },
    {
      key: "cloneadn",
      name: "CloneADN",
      role: "Adapte",
      facts: ["Ton", "Modèle", "Validateur", "Procédure", "Format", "Habitude"],
      message: "CloneADN adapte la mission au fonctionnement réel de l'entreprise.",
      secondary: "Votre organisation. Vos règles. Vos habitudes. Vos formats.",
    },
    {
      key: "cloneguard",
      name: "CloneGuard",
      role: "Encadre",
      facts: ["Exécution autorisée", "Validation requise", "Action bloquée"],
      message: "CloneGuard ajuste l'autonomie à chaque action.",
      secondary: "",
    },
    {
      key: "pierre",
      name: "Pierre",
      role: "Exécute",
      facts: [
        "Mission",
        "Tâches",
        "Dossier",
        "Documents",
        "Communications",
        "Validations",
        "Échéances",
        "Suivi",
      ],
      message: "Pierre exécute le travail RH opérationnel.",
      secondary:
        "Il ne réalise pas une tâche isolée. Il prend en charge la mission dans son ensemble.",
    },
    {
      key: "clonetrace",
      name: "CloneTrace",
      role: "Retrace",
      facts: [
        "Demande",
        "Mission",
        "Tâches",
        "Contexte",
        "Documents",
        "Validations",
        "Décisions",
        "Communications",
        "États",
      ],
      message: "CloneTrace rend chaque étape visible et retrouvable.",
      secondary: "",
    },
    {
      key: "clonebrief",
      name: "CloneBrief",
      role: "Rend compte",
      facts: [],
      message: "CloneBrief vous restitue ce qui mérite réellement votre attention.",
      secondary: "",
    },
  ],
  brief: {
    title: "Arrivée de Clara — état de la mission",
    lines: [
      "6 actions terminées",
      "2 documents préparés",
      "3 communications prêtes ou envoyées",
      "1 validation attendue",
      "Aucun blocage critique",
      "Prochaine échéance : vendredi, 15 h",
    ],
    decisionTitle: "Décision attendue",
    decision: "Valider l'avenant préparé avant l'envoi.",
  },
  summary: [
    "CloneOS — Organise",
    "CloneADN — Adapte",
    "CloneGuard — Encadre",
    "Pierre — Exécute",
    "CloneTrace — Retrace",
    "CloneBrief — Rend compte",
  ],
  transition:
    "Comment CloneStore peut-il produire un travail aussi spécifique dès son arrivée dans une nouvelle entreprise ?",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.5 — EMPREINTE ENTREPRISE
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_FOOTPRINT = {
  title: ["CHAQUE ENTREPRISE FONCTIONNE DIFFÉREMMENT."],
  paragraphs: [
    "CloneStore ne demande pas à votre organisation de s'adapter à un système générique.",
    "Grâce à l'Empreinte Entreprise, Pierre apprend votre structure, vos règles, vos documents, vos habitudes et vos circuits de validation.",
    "En quelques jours, son environnement de travail devient propre à votre entreprise.",
    "Puis chaque mission, chaque validation et chaque correction améliore encore sa précision.",
    "Pierre ne travaille pas seulement pour votre entreprise.",
    "Il apprend à travailler comme elle.",
  ],
  genericMessage: [
    "Pierre possède déjà les compétences RH.",
    "Il lui manque encore votre manière de les appliquer.",
  ],
  dimensions: [
    "Identité",
    "Sites",
    "Équipes",
    "Rôles",
    "Responsables",
    "Politiques",
    "Documents",
    "Chartes",
    "Ton",
    "Validations",
    "Autonomie",
    "Outils",
    "Préférences",
    "Habitudes",
  ],
  before: ["Contenu générique", "Processus standard", "Personnalisation limitée"],
  after: [
    "Ton réel",
    "Identité documentaire",
    "Bons validateurs",
    "Procédure du site",
    "Modèle approuvé",
    "Habitudes",
    "Autonomie correcte",
  ],
  timeline: [
    "Jour 1 : structure et rôles",
    "Jour 2 : règles, validations et documents",
    "Jour 3 : premières missions adaptées",
    "Jours suivants : amélioration continue",
  ],
  correction: "Préférer une formulation plus courte pour les managers régionaux.",
  preference: ["Préférence observée", "Utiliser des messages plus courts pour les managers régionaux."],
  choices: ["Confirmer", "Appliquer au contexte", "Ignorer"],
  learningMessage:
    "CloneStore apprend des usages réels sans transformer chaque exception en règle.",
  documentMessage:
    "Les livrables de Pierre ne ressemblent pas à des documents générés. Ils respectent les standards de votre entreprise.",
  documentDims: [
    "Logo",
    "Typographie",
    "Structure",
    "En-tête",
    "Pied de page",
    "Style",
    "Mentions",
    "Signataire",
    "Validation",
  ],
  privacy: [
    "CloneStore utilise uniquement les informations utiles et autorisées pour accomplir les missions confiées.",
    "Vous contrôlez les sources, les accès, les règles et les niveaux d'autonomie.",
  ],
  conclusion: [
    "Pierre ne travaille pas seulement pour votre entreprise.",
    "Il apprend à travailler comme elle.",
    "En quelques jours pour s'adapter. À chaque mission pour devenir plus précis.",
  ],
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.6 — VALEUR SELON LA TAILLE
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_SCALE = {
  title: ["UNE MÊME CAPACITÉ.", "ADAPTÉE À CHAQUE ORGANISATION."],
  paragraphs: [
    "Dans une petite entreprise, Pierre peut prendre en charge une fonction RH qui repose encore largement sur le dirigeant ou l'administration.",
    "Dans une PME, il absorbe le travail opérationnel quotidien, coordonne les demandes et permet aux équipes RH de se concentrer sur les situations qui exigent réellement leur expertise.",
    "Dans une entreprise de plusieurs centaines de salariés, il exécute les processus à grande échelle, maintient leur cohérence et suit chaque dossier jusqu'à sa résolution.",
    "Dans un groupe multisite, il adapte son travail aux entités, aux rôles, aux politiques et aux circuits de validation propres à chaque organisation.",
    "Pierre ne remplace pas un fonctionnement par un modèle unique.",
    "Il augmente la capacité de l'entreprise, selon la manière dont elle choisit de l'utiliser.",
  ],
  tiers: [
    {
      key: "small",
      label: "Petite entreprise",
      detail: "Environ 20 salariés — dirigeant, administration, managers.",
      actions: ["Prépare", "Suit", "Coordonne", "Présente les validations"],
      message:
        "Dans une petite entreprise, Pierre apporte une capacité RH complète sans alourdir la structure.",
    },
    {
      key: "pme",
      label: "PME",
      detail: "Équipe RH, managers, services — arrivées, absences, demandes, échéances.",
      actions: [],
      message:
        "Dans une PME, Pierre ne remplace pas l'expertise RH. Il lui rend du temps et de la capacité.",
    },
    {
      key: "enterprise",
      label: "Entreprise de 500 salariés",
      detail:
        "Cockpit avec missions multiples : recrutements, onboardings, absences, dossiers, évaluations, formations, offboardings, validations.",
      metrics: [
        "46 missions actives",
        "182 tâches suivies",
        "31 documents en préparation",
        "12 validations attendues",
        "7 échéances prioritaires",
      ],
      message: [
        "À plusieurs centaines de salariés, la difficulté n'est plus seulement d'effectuer le travail.",
        "Il faut maintenir sa cohérence, son rythme et sa traçabilité à grande échelle.",
      ],
      messageSecondary:
        "Pierre peut prendre en charge l'ensemble du travail RH opérationnel qui lui est confié, pendant que l'équipe humaine pilote, arbitre et accompagne les situations qui nécessitent son expertise.",
    },
    {
      key: "group",
      label: "Groupe multisite",
      detail:
        "Siège, filiales, sites — politiques globales, règles locales, validateurs, variantes documentaires.",
      message: [
        "Dans un groupe multisite, CloneStore associe cohérence globale et exécution locale.",
        "Chaque entité conserve ses règles. La direction conserve une vision commune.",
      ],
    },
  ],
  conclusion: [
    "La valeur de Pierre ne dépend pas de la taille de l'entreprise.",
    "Elle dépend du travail qu'elle choisit de lui confier.",
  ],
  selector: ["1–49", "50–249", "250–999", "1 000+"],
  transition: [
    "Qui décide de ce que Pierre peut faire seul ?",
    "Que se passe-t-il lorsqu'une action devient sensible ?",
    "Comment l'entreprise conserve-t-elle le contrôle ?",
  ],
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.7 — CONFIANCE ET GOUVERNANCE
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_TRUST = {
  title: ["LA CONFIANCE N'EST PAS UNE PROMESSE.", "C'EST UNE ARCHITECTURE."],
  paragraphs: [
    "Chaque action de Pierre est évaluée selon son contexte, sa sensibilité, les droits de la personne qui la demande et les règles définies par l'entreprise.",
    "Les opérations autorisées peuvent être exécutées.",
    "Les actions sensibles sont préparées puis soumises aux validations appropriées.",
    "Les décisions critiques, interdites ou hors périmètre sont bloquées.",
    "L'entreprise définit les règles.",
    "CloneStore les applique.",
    "CloneTrace conserve la preuve de chaque étape.",
    "Pierre peut disposer d'une autonomie importante sans jamais disposer d'une autonomie aveugle.",
  ],
  exampleMission: "Clôture complètement le départ de Paul vendredi.",
  context: ["Demandeur", "Entreprise", "Entité", "Collaborateur", "Mission", "Date", "Politiques", "Sensibilité"],
  contextMessage: "Avant d'agir, CloneStore détermine le contexte exact de la demande.",
  permissions: [
    { label: "Checklist", verdict: "Autorisé", tone: "ok" },
    { label: "Dossier utile", verdict: "Accès limité", tone: "warn" },
    { label: "Autre entité", verdict: "Refusé", tone: "block" },
    { label: "Contrat", verdict: "Permission insuffisante", tone: "block" },
  ],
  permissionMessage: [
    "Pierre n'accède pas à tout parce qu'il appartient à CloneStore.",
    "Il accède uniquement à ce qui est nécessaire, autorisé et pertinent pour la mission.",
  ],
  policyRules: [
    "Document contractuel validé par direction RH",
    "Relance automatique à J+2",
    "Désactivation confirmée par informatique",
  ],
  policyMessage: "ClonePolicy transforme les règles de l'entreprise en comportement opérationnel.",
  trustLevels: [
    "Préparation",
    "Recommandation",
    "Après validation",
    "Autonomie autorisée",
    "Humain uniquement",
  ],
  trustMessage:
    "L'autonomie de Pierre s'adapte à chaque entreprise, chaque rôle et chaque type d'action.",
  outcomes: ["Exécuter", "Préparer", "Demander une validation", "Bloquer/refuser"],
  outcomeMessage: [
    "Exécuter. Préparer. Faire valider. Refuser.",
    "Chaque action suit le chemin approprié.",
  ],
  validationCard: [
    "Action",
    "Résultat",
    "Données",
    "Conséquences",
    "Raison",
    "Vigilance",
    "Délai",
    "Correction",
  ],
  validationMessage: [
    "Une validation n'est pas un obstacle ajouté au travail.",
    "Elle intervient uniquement lorsque la nature de l'action le justifie.",
  ],
  refusalRequest: "Supprime toutes les traces de ce dossier après le départ du salarié.",
  refusalResponse: [
    "Cette action ne peut pas être exécutée.",
    "La suppression demandée pourrait entrer en conflit avec les règles de conservation définies par l'entreprise.",
    "Le dossier peut être archivé selon la politique applicable ou transmis à la personne responsable pour examen.",
  ],
  traceSteps: [
    "Demande",
    "Périmètre",
    "Actions",
    "Documents",
    "Validation",
    "Blocage",
    "Communication",
    "Clôture",
  ],
  conclusion: [
    "Vous ne confiez pas simplement du travail à Pierre.",
    "Vous définissez précisément le cadre dans lequel il peut le réaliser.",
  ],
  isolation:
    "Chaque organisation dispose de son propre environnement, de ses propres règles et de ses propres données.",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.8 — PIERRE, FONCTION RH COMPLÈTE
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_PIERRE_SCOPE = {
  title: ["PIERRE NE PREND PAS EN CHARGE UNE TÂCHE RH.", "IL PREND EN CHARGE LE TRAVAIL RH."],
  paragraphs: [
    "Du premier besoin de recrutement jusqu'au départ du collaborateur, Pierre organise, prépare, exécute et suit les opérations qui font vivre la fonction RH au quotidien.",
    "Recrutement. Onboarding. Administration. Dossiers salariés. Absences. Performance. Formation. Rémunération. Conformité. Offboarding.",
    "Chaque sujet devient une mission suivie, avec ses informations, ses documents, ses échéances, ses communications et ses validations.",
    "Pierre absorbe le travail opérationnel.",
    "Les équipes humaines conservent les décisions, les relations et les responsabilités qui exigent leur expertise.",
  ],
  continuum: ["Besoin", "Candidat", "Arrivée", "Vie dans l'entreprise", "Évolution", "Départ"],
  domains: [
    {
      key: "recrutement",
      label: "Recrutement",
      actions: ["Clarifie", "Prépare", "Structure", "Suit", "Synthétise"],
      message: "Pierre structure et suit le recrutement jusqu'à la décision humaine.",
    },
    {
      key: "onboarding",
      label: "Onboarding",
      message: [
        "Une décision devient immédiatement une mission d'arrivée.",
        "Le contexte suit le collaborateur. Le travail ne repart pas de zéro.",
      ],
    },
    {
      key: "administration",
      label: "Administration",
      message: "Chaque demande devient un dossier suivi jusqu'à sa résolution.",
    },
    {
      key: "dossier",
      label: "Dossier salarié",
      context: [
        "Poste",
        "Équipe",
        "Manager",
        "Site",
        "Documents",
        "Missions",
        "Absences",
        "Formations",
        "Échéances",
        "Validations",
        "Historique",
      ],
      message: [
        "Pierre ne traite pas des demandes sans contexte.",
        "Il travaille à partir d'un dossier structuré, actualisé et limité aux informations nécessaires.",
      ],
    },
    {
      key: "absences",
      label: "Absences",
      message: [
        "Lorsqu'une mission attend, Pierre ne l'abandonne pas.",
        "Il la maintient active, la reprend et la suit jusqu'à sa clôture.",
      ],
    },
    {
      key: "performance",
      label: "Performance",
      message: [
        "Pierre ne réalise pas à la place du manager ce qui relève du management.",
        "Il organise tout ce qui permet à ce travail humain d'avoir lieu correctement.",
      ],
    },
    {
      key: "formation",
      label: "Formation",
      context: ["Besoins", "Inscription", "Documents", "Preuves", "Suivi", "Synthèse"],
      message: "",
    },
    {
      key: "remuneration",
      label: "Rémunération",
      message: [
        "Pierre prépare, coordonne et sécurise le processus.",
        "Les décisions de rémunération restent prises par les personnes responsables.",
      ],
    },
    {
      key: "conformite",
      label: "Conformité",
      message:
        "Les règles définies par l'entreprise deviennent des actions suivies, pas de simples documents oubliés.",
    },
    {
      key: "relations",
      label: "Relations collaborateurs",
      message: [
        "Pierre prépare et structure les situations sensibles.",
        "Les personnes compétentes conservent la décision et la relation humaine.",
      ],
    },
    {
      key: "offboarding",
      label: "Offboarding",
      message:
        "Le départ est traité avec la même continuité, la même précision et la même traçabilité que l'arrivée.",
    },
  ],
  finalView: [
    "Recruter",
    "Accueillir",
    "Administrer",
    "Suivre",
    "Accompagner",
    "Former",
    "Faire évoluer",
    "Clôturer",
  ],
  finalCenter: ["Pierre", "Une fonction RH opérationnelle continue."],
  compression: [
    "Ce qui mobilise habituellement plusieurs personnes pendant plusieurs jours peut être organisé, préparé et suivi dans un délai considérablement réduit.",
    "Pierre travaille en parallèle, conserve le contexte et ne perd pas la mission entre deux actions.",
  ],
  frontierPierre: [
    "Organisation",
    "Préparation",
    "Production",
    "Coordination",
    "Suivi",
    "Relances",
    "Documentation",
    "Traçabilité",
    "Signalement",
  ],
  frontierCompany: [
    "Décisions",
    "Arbitrages",
    "Responsabilité juridique",
    "Management",
    "Négociation",
    "Relation",
    "Stratégie",
  ],
  frontierPhrase: [
    "Pierre prend en charge ce qui doit avancer.",
    "Les humains conservent ce qui doit être décidé, assumé et incarné.",
  ],
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.9 — ORGANISATION MULTI-EMPLOYÉS
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_ORGANIZATION = {
  title: ["PIERRE EST LE PREMIER EMPLOYÉ.", "CLONESTORE EST L'ORGANISATION."],
  paragraphs: [
    "Aujourd'hui, Pierre prend en charge le travail RH opérationnel.",
    "CloneStore a été conçu pour accueillir progressivement d'autres employés IA spécialisés, capables de travailler dans leurs propres domaines et de collaborer lorsqu'une mission dépasse une seule fonction.",
    "Une demande peut mobiliser plusieurs expertises.",
    "CloneOS répartit alors le travail, transmet le contexte approprié, coordonne les interventions et rassemble les résultats dans une seule mission.",
    "Chaque nouvel employé enrichira l'organisation sans obliger l'entreprise à reconstruire son fonctionnement.",
  ],
  pillars: [
    "Une même Empreinte Entreprise.",
    "Une même gouvernance.",
    "Une même traçabilité.",
    "Une organisation qui continue de progresser.",
  ],
  futureDomains: [
    "Finance",
    "Ingénierie",
    "Juridique",
    "Relation client",
    "Opérations",
    "Communication",
    "Administration",
  ],
  crossMission:
    "Nous ouvrons un nouveau site à Genève dans trois mois. Préparez tout ce qui doit être opérationnel pour l'ouverture.",
  decomposition: ["RH", "Finance", "Juridique", "Opérations", "Communication"],
  orchestrationMessage: [
    "CloneOS ne demande pas à tous les employés de tout connaître.",
    "Il transmet à chacun le contexte nécessaire à sa part de la mission.",
  ],
  consolidationMessage: [
    "Les employés IA ne travaillent pas chacun dans leur coin.",
    "CloneOS coordonne leurs dépendances et rassemble leurs résultats.",
  ],
  resultMission: "Ouverture du site de Genève",
  resultMessage: [
    "Plusieurs employés peuvent intervenir.",
    "Le client conserve une seule mission, une seule visibilité et un seul résultat cohérent.",
  ],
  footprintMessage: [
    "L'entreprise configure son fonctionnement une fois.",
    "Chaque employé utilise ensuite la partie du contexte qui lui est utile et autorisée.",
  ],
  governanceMessage: "Les employés se spécialisent. La gouvernance reste cohérente.",
  evolutionTitle: "Une infrastructure conçue pour continuer d'évoluer.",
  evolution: [
    "Pierre est le premier employé IA disponible dans CloneStore.",
    "De nouvelles capacités, de nouveaux modes d'interaction et de nouveaux employés spécialisés rejoindront progressivement l'organisation.",
    "Les entreprises déjà présentes bénéficieront de cette évolution sans repartir de zéro.",
  ],
  earlyValue:
    "Les entreprises qui installent Pierre aujourd'hui construisent déjà leur Empreinte, leurs politiques et leur historique dans l'infrastructure qui accueillera la suite de CloneStore.",
  conclusion: ["Un objectif.", "Les bons employés.", "Une seule organisation coordonnée par CloneStore."],
  conclusionLong: [
    "Pierre est le premier employé IA disponible dans CloneStore.",
    "L'infrastructure est déjà conçue pour accueillir la suite.",
    "Votre entreprise ne repartira pas de zéro à chaque nouvelle capacité. CloneStore progressera à partir de ce qu'elle connaît déjà.",
  ],
  availableLabel: "Disponible",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// E2.10 — PASSAGE VERS LA PREUVE
// ──────────────────────────────────────────────────────────────────────────

export const SCENE_COMPLETION = {
  title: ["VOUS AVEZ VU COMMENT CLONESTORE FONCTIONNE.", "REGARDEZ MAINTENANT PIERRE TRAVAILLER."],
  paragraphs: [
    "Une demande devient une mission.",
    "La mission s'adapte aux règles de l'entreprise.",
    "Pierre organise, prépare, exécute et suit le travail RH opérationnel.",
    "Les actions sensibles restent soumises aux validations appropriées.",
    "Chaque étape reste visible et traçable.",
    "La présentation s'arrête ici.",
    "La preuve commence maintenant.",
  ],
  recap: ["Demande", "CloneOS", "Empreinte", "Pierre", "CloneGuard", "CloneTrace", "CloneBrief"],
  recapCard: "Mission prête à être explorée",
  reminders: [
    { title: "Fonction complète", text: "Pierre couvre la continuité du travail RH opérationnel." },
    {
      title: "Adaptation",
      text: "Son environnement se personnalise en quelques jours grâce à l'Empreinte Entreprise.",
    },
    {
      title: "Gouvernance",
      text: "L'entreprise définit ce qu'il peut exécuter, préparer ou soumettre à validation.",
    },
    {
      title: "Traçabilité",
      text: "Les missions, actions, documents et décisions restent visibles.",
    },
  ],
  primaryCta: "Voir Pierre prendre en charge une mission",
  primaryCtaSubtext: "Démonstration interactive. Aucun compte requis.",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// §28 — QUESTIONS FRÉQUENTES (bas de page, secondaire)
// ──────────────────────────────────────────────────────────────────────────

export const DEMO_FAQ = [
  {
    q: "Pierre est-il adapté à toutes les tailles d'entreprise ?",
    a: "Son périmètre, ses permissions, ses volumes et ses circuits de validation s'adaptent à l'organisation.",
  },
  {
    q: "Combien de temps faut-il pour l'adapter ?",
    a: "Son environnement personnalisé peut être préparé en quelques jours, selon la taille de l'entreprise et les éléments transmis.",
  },
  {
    q: "Pierre peut-il agir sans validation ?",
    a: "Uniquement sur les actions autorisées par les règles et permissions définies par l'entreprise.",
  },
  {
    q: "Devons-nous remplacer tous nos outils ?",
    a: "Non. Pierre peut s'intégrer progressivement à l'environnement de l'entreprise. Les connexions disponibles sont présentées selon leur état réel.",
  },
  {
    q: "La démonstration nécessite-t-elle un compte ?",
    a: "Non.",
  },
] as const;
