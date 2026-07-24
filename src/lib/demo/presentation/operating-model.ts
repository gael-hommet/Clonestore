// /demo — Acte 6 « Le coût de continuer comme avant » : MODÈLE OPÉRATIONNEL PUR.
//
// Décrit une même situation exécutée de deux manières : par une organisation
// traditionnelle sous pression, puis par la même organisation augmentée d'un
// employé IA CloneStore.
//
// CE MODÈLE N'EST PAS SPÉCIFIQUE À PIERRE.
// La structure est celle d'un PÉRIMÈTRE MÉTIER (`OperatingDomain`) : les RH sont
// le premier domaine disponible parce que Pierre est le premier employé IA ouvert,
// mais le même moteur accueillera les périmètres suivants sans changer une ligne
// de composant — il suffira d'ajouter un domaine et ses scénarios.
//
// RÈGLES VERROUILLÉES :
//
//   1. AUCUNE CARICATURE. Le côté traditionnel décrit une organisation COMPÉTENTE
//      mais fragmentée : recherches, recopies, changements d'outil, attentes,
//      reprises de contexte. Jamais une équipe incompétente. Le contraste vient de
//      la DENSITÉ et de la CONTINUITÉ, pas d'un procès fait aux équipes.
//
//   2. AUCUNE MÉTRIQUE INVENTÉE. Le nombre d'étapes, d'outils mobilisés,
//      d'interruptions, de validations et le temps mobilisé sont TOUS DÉRIVÉS des
//      étapes déclarées (voir les fonctions en bas de fichier). Rien n'est saisi
//      « à la main » pour impressionner.
//
//   3. LES DURÉES SONT DES ORDRES DE GRANDEUR ILLUSTRATIFS, présentés comme tels
//      dans l'interface. Le temps compté est l'EFFORT HUMAIN mobilisé — une attente
//      ne consomme pas d'effort (elle vaut 0 minute) mais rompt la continuité.
//
//   4. LE CÔTÉ CLONESTORE NE PROMET PAS L'IMPOSSIBLE. Les actions sensibles
//      passent par une validation humaine, les informations manquantes sont
//      signalées et jamais inventées.
//
// Module PUR : aucun effet de bord, aucun import node:*. Sûr en SSR comme en client.

// ──────────────────────────────────────────────────────────────────────────
// Périmètres métier
// ──────────────────────────────────────────────────────────────────────────

export type OperatingDomainId =
  | "hr"
  | "support"
  | "finance"
  | "admin"
  | "operations";

export interface OperatingDomain {
  readonly id: OperatingDomainId;
  readonly label: string;
  /** Nom de l'employé IA — uniquement s'il est réellement ouvert. Sinon null. */
  readonly employee: string | null;
  /** true → un employé IA est disponible aujourd'hui pour ce périmètre. */
  readonly available: boolean;
}

/**
 * Pierre est le SEUL employé IA nommé publiquement (cf. src/lib/catalog/public-catalog.ts).
 * Les autres périmètres sont déclarés sans nom, sans prix et sans date — ils
 * montrent la trajectoire du produit, ils ne promettent rien.
 */
export const OPERATING_DOMAINS: readonly OperatingDomain[] = [
  { id: "hr", label: "Ressources humaines", employee: "Pierre", available: true },
  { id: "support", label: "Support & relation client", employee: null, available: false },
  { id: "finance", label: "Finance opérationnelle", employee: null, available: false },
  { id: "admin", label: "Administration", employee: null, available: false },
  { id: "operations", label: "Opérations", employee: null, available: false },
];

// ──────────────────────────────────────────────────────────────────────────
// Étapes
// ──────────────────────────────────────────────────────────────────────────

/** Nature d'une étape exécutée manuellement. */
export type ManualStepKind =
  | "search" // retrouver une information dispersée
  | "copy" // recopier d'un support vers un autre
  | "verify" // contrôler à la main
  | "chase" // relancer une personne
  | "wait" // dépendance : l'exécution s'arrête
  | "switch" // changement d'outil
  | "interrupt" // sollicitation qui coupe le travail en cours
  | "consolidate"; // rassembler pour produire un état

/** Nature d'une étape exécutée par l'employé IA. */
export type GovernedStepKind =
  | "context" // mobilise le contexte réel de l'entreprise
  | "prepare" // prépare le travail
  | "execute" // exécute une action autorisée
  | "flag" // signale une information manquante ou une anomalie
  | "validate" // soumet à validation humaine
  | "trace"; // conserve l'historique vérifiable

export interface ManualStep {
  readonly label: string;
  readonly kind: ManualStepKind;
  /** Outil ou interlocuteur mobilisé — c'est ce qui fragmente l'exécution. */
  readonly on: string;
  /**
   * Effort humain mobilisé, en minutes. Une ATTENTE vaut 0 : elle ne consomme pas
   * d'effort, elle rompt la continuité. Ordre de grandeur illustratif.
   */
  readonly minutes: number;
}

export interface GovernedStep {
  readonly label: string;
  readonly kind: GovernedStepKind;
  readonly minutes: number;
}

export interface OperatingScenario {
  readonly id: string;
  readonly domain: OperatingDomainId;
  /** La situation, telle qu'un dirigeant la formulerait. */
  readonly trigger: string;
  /** Ce qui est réellement en jeu, en une phrase. */
  readonly stake: string;
  readonly current: {
    readonly steps: readonly ManualStep[];
    /** Délai calendaire constaté — hypothèse illustrative, jamais une mesure. */
    readonly delay: string;
  };
  readonly governed: {
    readonly steps: readonly GovernedStep[];
    readonly delay: string;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Scénarios — périmètre RH (premier employé IA disponible : Pierre)
// ──────────────────────────────────────────────────────────────────────────

export const HR_SCENARIOS: readonly OperatingScenario[] = [
  {
    // MISSION COMPLÈTE (scénario « choc » du chapitre valeur) : l'arrivée d'un
    // responsable commercial avec TOUT le travail périphérique — dossier, contrat,
    // avenant, accès, matériel, communications, coordination, relances, suivi
    // jusqu'au jour J. Étapes et minutes DÉCLARÉES (ordres de grandeur illustratifs,
    // règle n°2 en tête de fichier) — reconstruction déclarée : l'ancien scénario
    // « ~11 h 20 » n'a pas été retrouvé dans l'historique, celui-ci est déclaré
    // pas à pas. L'attention humaine résiduelle reste RÉALISTE : la validation d'un
    // contrat ne descend jamais à 2 minutes (doctrine : le contractuel se valide).
    id: "arrival-full",
    domain: "hr",
    trigger: "Un responsable commercial arrive — mission complète",
    stake: "Une arrivée cadre réussie mobilise une équipe entière pendant des jours. Personne n'en voit le coût total.",
    current: {
      delay: "2 à 3 semaines calendaires",
      steps: [
        { label: "Rassembler les informations dispersées (poste, équipe, site, manager)", kind: "search", on: "Dossiers partagés", minutes: 45 },
        { label: "Constituer le dossier salarié complet", kind: "consolidate", on: "SIRH", minutes: 60 },
        { label: "Retrouver et adapter le modèle de contrat cadre", kind: "search", on: "Modèles", minutes: 35 },
        { label: "Rédiger le contrat et le package variable", kind: "copy", on: "Traitement de texte", minutes: 90 },
        { label: "Préparer l'avenant véhicule / téléphone", kind: "copy", on: "Traitement de texte", minutes: 45 },
        { label: "Faire contrôler les clauses par la direction", kind: "chase", on: "Direction", minutes: 30 },
        { label: "Attendre le retour de la direction", kind: "wait", on: "Email", minutes: 0 },
        { label: "Reprendre le dossier et intégrer les corrections", kind: "verify", on: "Traitement de texte", minutes: 40 },
        { label: "Demander les accès (messagerie, CRM, badges)", kind: "switch", on: "Informatique", minutes: 30 },
        { label: "Commander le matériel (poste, téléphone, véhicule)", kind: "chase", on: "Achats", minutes: 35 },
        { label: "Attendre les confirmations accès + matériel", kind: "wait", on: "Email", minutes: 0 },
        { label: "Relancer informatique et achats", kind: "chase", on: "Email", minutes: 25 },
        { label: "Coordonner manager, équipe et RH pour la première semaine", kind: "interrupt", on: "Réunions", minutes: 60 },
        { label: "Préparer les communications (équipe, direction, nouvel arrivant)", kind: "copy", on: "Email", minutes: 45 },
        { label: "Construire le parcours d'intégration et les rendez-vous", kind: "consolidate", on: "Calendrier", minutes: 50 },
        { label: "Vérifier chaque élément à J-3", kind: "verify", on: "Tableur", minutes: 45 },
        { label: "Relancer les retardataires à J-2", kind: "chase", on: "Email", minutes: 20 },
        { label: "Contrôle final et remise du dossier au manager", kind: "verify", on: "Réunion", minutes: 40 },
      ],
    },
    governed: {
      delay: "Préparé en continu, contrôle humain à J-3",
      steps: [
        { label: "Rassemble le contexte complet (poste, équipe, site, historique)", kind: "context", minutes: 0 },
        { label: "Constitue le dossier et prépare contrat + avenant selon vos modèles", kind: "prepare", minutes: 0 },
        { label: "Coordonne accès, matériel et intervenants — relance sans oubli", kind: "execute", minutes: 0 },
        { label: "Prépare les communications et le parcours d'intégration", kind: "execute", minutes: 0 },
        { label: "Signale ce qui manque — ne l'invente jamais", kind: "flag", minutes: 0 },
        { label: "Soumet le contrat et l'avenant à validation humaine", kind: "validate", minutes: 8 },
        { label: "Présente le contrôle final à J-3", kind: "validate", minutes: 4 },
        { label: "Trace chaque action jusqu'au jour J", kind: "trace", minutes: 0 },
      ],
    },
  },
  {
    id: "onboarding",
    domain: "hr",
    trigger: "Un nouveau salarié arrive lundi",
    stake: "Tout est connu de quelqu'un. Rien n'est réuni au même endroit.",
    current: {
      delay: "3 à 5 jours ouvrés",
      steps: [
        { label: "Rassembler les informations dispersées sur le poste", kind: "search", on: "Dossiers partagés", minutes: 35 },
        { label: "Retrouver le modèle de contrat à jour", kind: "search", on: "Modèles", minutes: 15 },
        { label: "Recopier les mêmes données dans chaque document", kind: "copy", on: "Traitement de texte", minutes: 30 },
        { label: "Demander le matériel au manager", kind: "chase", on: "Email", minutes: 10 },
        { label: "Attendre sa réponse", kind: "wait", on: "Email", minutes: 0 },
        { label: "Reprendre le dossier et reconstruire le contexte", kind: "search", on: "Dossiers partagés", minutes: 15 },
        { label: "Suivre la checklist dans un autre outil", kind: "switch", on: "Tableur", minutes: 20 },
        { label: "Vérifier une dernière fois que rien ne manque", kind: "verify", on: "Tableur", minutes: 20 },
      ],
    },
    governed: {
      delay: "Le jour même",
      steps: [
        { label: "Rassemble le contexte utile de l'entreprise", kind: "context", minutes: 0 },
        { label: "Prépare le parcours d'arrivée complet", kind: "prepare", minutes: 2 },
        { label: "Génère les documents selon vos modèles", kind: "execute", minutes: 3 },
        { label: "Coordonne les étapes et les intervenants", kind: "execute", minutes: 2 },
        { label: "Signale le matériel non attribué — ne l'invente pas", kind: "flag", minutes: 0 },
        { label: "Soumet le contrat à validation humaine", kind: "validate", minutes: 10 },
        { label: "Conserve l'historique de chaque action", kind: "trace", minutes: 0 },
      ],
    },
  },
  {
    id: "amendments",
    domain: "hr",
    trigger: "Cinquante avenants doivent être préparés",
    stake: "Le travail n'est pas difficile. Il est long, répétitif et sans droit à l'erreur.",
    current: {
      delay: "Plusieurs journées mobilisées",
      steps: [
        { label: "Extraire la liste des salariés concernés", kind: "search", on: "SIRH", minutes: 40 },
        { label: "Dupliquer le modèle pour chaque dossier", kind: "copy", on: "Traitement de texte", minutes: 120 },
        { label: "Personnaliser chaque avenant à la main", kind: "copy", on: "Traitement de texte", minutes: 300 },
        { label: "Contrôler chaque document individuellement", kind: "verify", on: "Relecture", minutes: 150 },
        { label: "Reprendre les dossiers incohérents", kind: "verify", on: "Traitement de texte", minutes: 60 },
        { label: "Consolider l'état d'avancement", kind: "consolidate", on: "Tableur", minutes: 45 },
      ],
    },
    governed: {
      delay: "Préparation en série, contrôle le jour même",
      steps: [
        { label: "Prépare les cinquante avenants en série", kind: "prepare", minutes: 8 },
        { label: "Personnalise selon chaque dossier réel", kind: "execute", minutes: 5 },
        { label: "Contrôle la cohérence de chaque document", kind: "execute", minutes: 4 },
        { label: "Remonte les anomalies et les dossiers douteux", kind: "flag", minutes: 0 },
        { label: "Soumet la série à validation humaine", kind: "validate", minutes: 45 },
        { label: "Trace chaque document produit", kind: "trace", minutes: 0 },
      ],
    },
  },
  {
    id: "questions",
    domain: "hr",
    trigger: "Trois cents questions récurrentes sont posées par les salariés",
    stake: "Chaque réponse est simple. C'est leur nombre qui consomme l'équipe.",
    current: {
      delay: "Réponses étalées sur plusieurs jours",
      steps: [
        { label: "Être interrompu en pleine tâche", kind: "interrupt", on: "Bureau", minutes: 90 },
        { label: "Rechercher la règle applicable", kind: "search", on: "Accords & politiques", minutes: 120 },
        { label: "Répondre plusieurs fois à la même question", kind: "copy", on: "Email", minutes: 240 },
        { label: "Basculer entre messagerie et outils internes", kind: "switch", on: "Messagerie", minutes: 60 },
        { label: "Reprendre la tâche interrompue", kind: "search", on: "Bureau", minutes: 75 },
      ],
    },
    governed: {
      delay: "Réponse immédiate",
      steps: [
        { label: "Répond à partir de vos politiques et accords réels", kind: "context", minutes: 0 },
        { label: "Applique les droits du salarié qui demande", kind: "execute", minutes: 0 },
        { label: "Donne la même réponse à la même question", kind: "execute", minutes: 0 },
        { label: "Escalade vers l'équipe quand la situation le justifie", kind: "flag", minutes: 15 },
        { label: "Conserve l'historique des échanges", kind: "trace", minutes: 0 },
      ],
    },
  },
  {
    id: "payroll",
    domain: "hr",
    trigger: "La clôture de paie approche",
    stake: "Rien ne peut être approximatif, et tout arrive en même temps.",
    current: {
      delay: "Tension concentrée sur les derniers jours",
      steps: [
        { label: "Collecter les variables auprès de chaque service", kind: "chase", on: "Email", minutes: 120 },
        { label: "Attendre les retours manquants", kind: "wait", on: "Email", minutes: 0 },
        { label: "Relancer les retardataires", kind: "chase", on: "Email", minutes: 45 },
        { label: "Rassembler des fichiers de formats différents", kind: "consolidate", on: "Tableur", minutes: 90 },
        { label: "Vérifier les écarts et les oublis", kind: "verify", on: "Tableur", minutes: 100 },
        { label: "Transmettre au prestataire de paie", kind: "switch", on: "Prestataire paie", minutes: 30 },
      ],
    },
    governed: {
      delay: "Collecte continue, sans pic de fin de mois",
      steps: [
        { label: "Collecte les éléments de façon structurée", kind: "execute", minutes: 5 },
        { label: "Relance automatiquement ce qui manque", kind: "execute", minutes: 0 },
        { label: "Détecte les variables absentes ou incohérentes", kind: "flag", minutes: 0 },
        { label: "Prépare le dossier pour l'équipe ou le prestataire paie", kind: "prepare", minutes: 10 },
        { label: "Fait valider les points sensibles", kind: "validate", minutes: 40 },
        { label: "Trace ce qui a été transmis, et quand", kind: "trace", minutes: 0 },
      ],
    },
  },
  {
    id: "incomplete-files",
    domain: "hr",
    trigger: "Quarante dossiers sont incomplets",
    stake: "Personne ne sait précisément lesquels, ni ce qui manque exactement.",
    current: {
      delay: "Suivi rarement terminé",
      steps: [
        { label: "Ouvrir les dossiers un par un", kind: "search", on: "Dossiers partagés", minutes: 150 },
        { label: "Noter ce qui manque dans un tableur", kind: "consolidate", on: "Tableur", minutes: 60 },
        { label: "Écrire un email par salarié", kind: "copy", on: "Email", minutes: 120 },
        { label: "Attendre les pièces", kind: "wait", on: "Email", minutes: 0 },
        { label: "Retrouver qui a répondu, et qui n'a pas répondu", kind: "verify", on: "Email", minutes: 75 },
        { label: "Relancer — quand on y pense", kind: "chase", on: "Email", minutes: 45 },
      ],
    },
    governed: {
      delay: "Suivi continu jusqu'à complétude",
      steps: [
        { label: "Identifie automatiquement les dossiers incomplets", kind: "execute", minutes: 0 },
        { label: "Relance chaque salarié avec le contexte de son dossier", kind: "execute", minutes: 2 },
        { label: "Poursuit le suivi sans oubli", kind: "execute", minutes: 0 },
        { label: "Maintient un statut à jour, dossier par dossier", kind: "trace", minutes: 0 },
        { label: "Signale les situations qui n'avancent pas", kind: "flag", minutes: 10 },
      ],
    },
  },
  {
    id: "hr-state",
    domain: "hr",
    trigger: "Un dirigeant demande un état RH immédiatement",
    stake: "L'information existe. Elle n'est simplement pas consolidée.",
    current: {
      delay: "Quelques heures à quelques jours",
      steps: [
        { label: "Extraire les données de plusieurs outils", kind: "search", on: "SIRH", minutes: 60 },
        { label: "Basculer d'un export à l'autre", kind: "switch", on: "Tableur", minutes: 30 },
        { label: "Retraiter les formats incompatibles", kind: "consolidate", on: "Tableur", minutes: 75 },
        { label: "Vérifier la cohérence des totaux", kind: "verify", on: "Tableur", minutes: 45 },
        { label: "Mettre en forme le document", kind: "copy", on: "Présentation", minutes: 40 },
      ],
    },
    governed: {
      delay: "Immédiat",
      steps: [
        { label: "Produit l'état à partir des données autorisées", kind: "execute", minutes: 1 },
        { label: "Indique la source de chaque donnée", kind: "trace", minutes: 0 },
        { label: "Signale les limites et les données absentes", kind: "flag", minutes: 0 },
        { label: "Conserve la version produite et sa date", kind: "trace", minutes: 0 },
      ],
    },
  },
  {
    id: "rule-change",
    domain: "hr",
    trigger: "Une règle interne change",
    stake: "La décision est prise en une réunion. Son application prend des mois.",
    current: {
      delay: "Cohabitation durable d'anciennes pratiques",
      steps: [
        { label: "Informer chaque service", kind: "chase", on: "Email", minutes: 60 },
        { label: "Modifier chaque modèle concerné", kind: "copy", on: "Modèles", minutes: 90 },
        { label: "Retrouver les documents déjà partis avec l'ancienne règle", kind: "search", on: "Dossiers partagés", minutes: 75 },
        { label: "Vérifier que chacun applique bien la nouvelle version", kind: "verify", on: "Email", minutes: 60 },
      ],
    },
    governed: {
      delay: "Appliquée dès l'exécution suivante",
      steps: [
        { label: "Met à jour l'Empreinte Entreprise", kind: "context", minutes: 15 },
        { label: "Applique la nouvelle règle aux exécutions suivantes", kind: "execute", minutes: 0 },
        { label: "Conserve l'historique de l'ancienne règle", kind: "trace", minutes: 0 },
        { label: "Signale les dossiers en cours à reprendre", kind: "flag", minutes: 0 },
      ],
    },
  },
  {
    id: "team-reduced",
    domain: "hr",
    trigger: "L'équipe est absente, réduite ou débordée",
    stake: "Le travail ne s'arrête pas. Il s'accumule.",
    current: {
      delay: "Retard qui se rattrape rarement",
      steps: [
        { label: "Laisser les demandes s'accumuler", kind: "wait", on: "Messagerie", minutes: 0 },
        { label: "Trier ce qui est urgent, à froid", kind: "consolidate", on: "Messagerie", minutes: 90 },
        { label: "Reconstruire le contexte de chaque dossier en cours", kind: "search", on: "Dossiers partagés", minutes: 120 },
        { label: "Traiter en priorité ce qui a le plus attendu", kind: "verify", on: "Bureau", minutes: 90 },
      ],
    },
    governed: {
      delay: "Continuité maintenue",
      steps: [
        { label: "Conserve le contexte de chaque dossier en cours", kind: "context", minutes: 0 },
        { label: "Maintient les opérations autorisées", kind: "execute", minutes: 0 },
        { label: "Priorise ce qui a une échéance", kind: "execute", minutes: 0 },
        { label: "Escalade ce qui exige une décision humaine", kind: "validate", minutes: 20 },
      ],
    },
  },
  {
    id: "sensitive-action",
    domain: "hr",
    trigger: "Une action sensible doit être réalisée",
    stake: "La décision appartient à un humain. Le contexte, lui, doit être complet.",
    current: {
      delay: "Dépend de la disponibilité du bon interlocuteur",
      steps: [
        { label: "Trouver la bonne personne", kind: "search", on: "Organisation", minutes: 30 },
        { label: "Attendre sa disponibilité", kind: "wait", on: "Agenda", minutes: 0 },
        { label: "Reconstruire l'historique du dossier", kind: "search", on: "Dossiers partagés", minutes: 60 },
        { label: "Vérifier ce qui a déjà été dit et fait", kind: "verify", on: "Email", minutes: 45 },
        { label: "Décider avec une visibilité partielle", kind: "verify", on: "Réunion", minutes: 45 },
      ],
    },
    governed: {
      delay: "Décision humaine, dossier complet",
      steps: [
        { label: "Prépare l'action et son dossier", kind: "prepare", minutes: 3 },
        { label: "Présente le contexte complet et son historique", kind: "context", minutes: 0 },
        { label: "Explique ce qui va être fait, et pourquoi", kind: "context", minutes: 0 },
        { label: "Contrôle les permissions du demandeur", kind: "execute", minutes: 0 },
        { label: "Demande une validation humaine explicite", kind: "validate", minutes: 25 },
        { label: "N'exécute qu'après autorisation", kind: "trace", minutes: 0 },
      ],
    },
  },
  {
    id: "six-months-ago",
    domain: "hr",
    trigger: "Il faut comprendre ce qui a été fait six mois auparavant",
    stake: "La décision a été prise. Sa trace, elle, s'est dispersée.",
    current: {
      delay: "Reconstitution incertaine",
      steps: [
        { label: "Fouiller les emails", kind: "search", on: "Email", minutes: 75 },
        { label: "Ouvrir les anciens fichiers", kind: "search", on: "Dossiers partagés", minutes: 60 },
        { label: "Interroger les personnes encore présentes", kind: "chase", on: "Collègues", minutes: 45 },
        { label: "Recouper des souvenirs contradictoires", kind: "verify", on: "Réunion", minutes: 60 },
      ],
    },
    governed: {
      delay: "Immédiat",
      steps: [
        { label: "Restitue les actions réalisées et leur date", kind: "trace", minutes: 0 },
        { label: "Restitue les décisions et leurs validations", kind: "trace", minutes: 0 },
        { label: "Restitue les documents produits et leurs sources", kind: "trace", minutes: 0 },
        { label: "Reconstitue la chronologie complète du dossier", kind: "context", minutes: 1 },
      ],
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Métriques DÉRIVÉES (aucune n'est saisie à la main)
// ──────────────────────────────────────────────────────────────────────────

export interface CurrentMetrics {
  /** Nombre d'étapes manuelles. */
  readonly steps: number;
  /** Outils et interlocuteurs distincts mobilisés. */
  readonly surfaces: number;
  /** Ruptures : attentes + interruptions. */
  readonly breaks: number;
  /** Effort humain mobilisé, en minutes (les attentes valent 0). */
  readonly minutes: number;
  readonly delay: string;
}

export interface GovernedMetrics {
  readonly steps: number;
  /** Validations humaines requises. */
  readonly validations: number;
  /** Informations manquantes ou anomalies signalées — jamais inventées. */
  readonly flags: number;
  /** Effort humain restant (relecture, validation). */
  readonly minutes: number;
  readonly delay: string;
}

export function currentMetrics(scenario: OperatingScenario): CurrentMetrics {
  const steps = scenario.current.steps;
  const surfaces = new Set(steps.map((s) => s.on)).size;
  const breaks = steps.filter((s) => s.kind === "wait" || s.kind === "interrupt").length;
  const minutes = steps.reduce((total, s) => total + s.minutes, 0);
  return { steps: steps.length, surfaces, breaks, minutes, delay: scenario.current.delay };
}

export function governedMetrics(scenario: OperatingScenario): GovernedMetrics {
  const steps = scenario.governed.steps;
  const validations = steps.filter((s) => s.kind === "validate").length;
  const flags = steps.filter((s) => s.kind === "flag").length;
  const minutes = steps.reduce((total, s) => total + s.minutes, 0);
  return { steps: steps.length, validations, flags, minutes, delay: scenario.governed.delay };
}

/** Scénarios d'un périmètre donné. Aujourd'hui : seul « hr » en contient. */
export function scenariosForDomain(domain: OperatingDomainId): readonly OperatingScenario[] {
  return HR_SCENARIOS.filter((s) => s.domain === domain);
}

// ──────────────────────────────────────────────────────────────────────────
// PREMIER PÉRIMÈTRE — qualification honnête des situations ci-dessus
//
// Règle produit : on recommande de commencer par le travail LE MOINS SENSIBLE,
// LE PLUS RÉPÉTITIF et LE PLUS FACILE À MESURER. Conséquence directe : plusieurs
// situations, bien que parfaitement prises en charge par l'employé IA, ne sont
// PAS de bons premiers périmètres. On le dit — c'est ce qui borne le risque du
// premier engagement, et c'est plus utile au client que de tout vendre d'un coup.
// ──────────────────────────────────────────────────────────────────────────

export interface StartFit {
  /** true → bon PREMIER périmètre. false → à confier plus tard, périmètre éprouvé. */
  readonly candidate: boolean;
  /** Fréquence réelle du travail. */
  readonly repetition: string;
  /** Sensibilité — et comment elle est encadrée. */
  readonly sensitivity: string;
  /** L'indicateur observable qui permettra de juger, sans nous croire. */
  readonly measure: string;
  /** Ce que l'équipe humaine garde, dans tous les cas. */
  readonly humanKeeps: string;
  /** Pourquoi commencer par là — ou pourquoi attendre. */
  readonly note: string;
}

export const START_FIT: Readonly<Record<string, StartFit>> = {
  questions: {
    candidate: true,
    repetition: "Très élevée — chaque semaine, toute l'année",
    sensitivity: "Faible — les réponses viennent de vos politiques et accords",
    measure: "Part des demandes traitées sans intervention de l'équipe",
    humanKeeps: "Les situations individuelles et les cas non couverts par une règle",
    note: "Le meilleur point de départ : volume élevé, faible risque, résultat mesurable dès les premières semaines.",
  },
  "incomplete-files": {
    candidate: true,
    repetition: "Élevée — un stock permanent, jamais vraiment terminé",
    sensitivity: "Faible — relances et suivi, aucune décision engageante",
    measure: "Nombre de dossiers complétés, et délai moyen de complétion",
    humanKeeps: "Les relances qui n'aboutissent pas et les situations tendues",
    note: "Périmètre borné, résultat binaire : le dossier est complet, ou il ne l'est pas.",
  },
  onboarding: {
    candidate: true,
    repetition: "Régulière — à chaque arrivée",
    sensitivity: "Encadrée — le contrat est préparé, jamais envoyé sans validation",
    measure: "Arrivées préparées dans les délais, sans élément manquant le jour J",
    humanKeeps: "La validation du contrat et l'accueil humain du nouvel arrivant",
    note: "Fortement observable : au premier lundi, soit tout est prêt, soit cela se voit.",
  },
  "hr-state": {
    candidate: true,
    repetition: "Fréquente — dès qu'une décision doit être prise",
    sensitivity: "Faible — lecture de données déjà autorisées",
    measure: "Délai entre la demande d'un état et sa mise à disposition",
    humanKeeps: "L'interprétation et l'arbitrage",
    note: "Aucune action engageante : l'employé IA lit, consolide, cite ses sources et signale ses limites.",
  },

  // ── À confier plus tard, une fois le périmètre éprouvé ──
  amendments: {
    candidate: false,
    repetition: "Par vagues",
    sensitivity: "Élevée — documents contractuels",
    measure: "Avenants conformes produits, anomalies remontées",
    humanKeeps: "La validation de chaque document contractuel",
    note: "Excellent périmètre — mais après avoir constaté la qualité sur un premier travail moins engageant.",
  },
  payroll: {
    candidate: false,
    repetition: "Mensuelle",
    sensitivity: "Élevée — échéance non négociable, prestataire tiers",
    measure: "Variables collectées à temps, anomalies détectées avant clôture",
    humanKeeps: "La paie elle-même, qui reste chez votre équipe ou votre prestataire",
    note: "La date de clôture ne pardonne pas : on n'installe pas une nouveauté sur le chemin critique.",
  },
  "rule-change": {
    candidate: false,
    repetition: "Ponctuelle",
    sensitivity: "Structurante — engage toute l'organisation",
    measure: "Cohérence des documents produits après la mise à jour",
    humanKeeps: "La décision de la règle, et sa formulation",
    note: "Suppose une Empreinte Entreprise déjà constituée : cela vient avec l'usage, pas avant.",
  },
  "sensitive-action": {
    candidate: false,
    repetition: "Rare",
    sensitivity: "Maximale — la décision appartient à un humain",
    measure: "Qualité du dossier présenté avant décision",
    humanKeeps: "La décision, entièrement et toujours",
    note: "Ce n'est pas un premier périmètre : c'est ce que l'employé IA prépare, une fois qu'on lui fait confiance.",
  },
  "team-reduced": {
    candidate: false,
    repetition: "Situationnelle",
    sensitivity: "Variable",
    measure: "Continuité constatée pendant une absence",
    humanKeeps: "L'arbitrage des priorités",
    note: "C'est un bénéfice de la continuité, pas une mission qu'on lance : elle se constate d'elle-même.",
  },
  "six-months-ago": {
    candidate: false,
    repetition: "Continue",
    sensitivity: "Faible",
    measure: "Temps pour retrouver une décision et sa justification",
    humanKeeps: "L'interprétation de l'historique",
    note: "Ce n'est pas une mission : c'est la trace que laissent les missions déjà confiées.",
  },
};

/**
 * Ordre de recommandation : du MOINS sensible au plus engageant.
 *
 * C'est exactement la règle annoncée au visiteur (« commencez par le travail le
 * moins sensible, le plus répétitif et le plus facile à mesurer »). L'ordre
 * d'affichage DOIT donc être cet ordre-là — sans quoi la démo recommanderait une
 * chose et en montrerait une autre. Le premier de la liste est celui qui est
 * sélectionné par défaut.
 */
const FIRST_MISSION_ORDER = [
  "questions", // aucun engagement, volume maximal
  "incomplete-files", // relances et suivi, résultat binaire
  "hr-state", // lecture seule, sources citées
  "onboarding", // produit des documents → une validation humaine entre en jeu
] as const;

/** Les situations recommandées comme PREMIER périmètre, dans l'ordre de la règle. */
export function firstMissionCandidates(): readonly OperatingScenario[] {
  const byId = new Map(HR_SCENARIOS.map((s) => [s.id, s]));
  const ordered = FIRST_MISSION_ORDER.map((id) => byId.get(id)).filter(
    (s): s is OperatingScenario => Boolean(s) && Boolean(START_FIT[s!.id]?.candidate),
  );
  // Filet : un scénario marqué candidat mais absent de l'ordre reste affiché.
  const rest = HR_SCENARIOS.filter(
    (s) => START_FIT[s.id]?.candidate && !FIRST_MISSION_ORDER.includes(s.id as never),
  );
  return [...ordered, ...rest];
}

/** Les situations à confier plus tard — et pourquoi. */
export function laterMissions(): readonly OperatingScenario[] {
  return HR_SCENARIOS.filter((s) => START_FIT[s.id] && !START_FIT[s.id].candidate);
}
