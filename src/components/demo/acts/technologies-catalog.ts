// /demo — SECTION TECHNOLOGIES : catalogue de contenu dédié (périmètre strictement
// local à cette section). Quinze technologies transversales CloneStore en trois
// familles. Hiérarchie inversée OBLIGATOIRE : grand titre HUMAIN d'abord, nom
// propriétaire en sous-titre (« CloneX — technologie CloneStore ») — jamais le nom
// technique seul comme titre principal. Pierre n'est PAS une technologie : il est
// l'employé IA qui les mobilise.
//
// P20 CONVERGENCE : l'identité (quelles technologies existent), leur statut public
// (Disponible/À venir) et leur ownership viennent EXCLUSIVEMENT de la projection
// publique canonique P20 (`technologies/canonical/public-technology-projection.ts`).
// Ce fichier ne possède plus de liste indépendante : TECH_CATALOG est DÉRIVÉ en
// joignant TECH_CONTENT (le texte commercial riche, propriété de cette section démo)
// avec la projection canonique par id. Toute divergence (id manquant d'un côté ou de
// l'autre) fait échouer le chargement du module — impossible de créer une technologie
// fantôme ou d'en oublier une silencieusement.
//
// STATUTS PUBLICS (vérité commerciale du lancement, VALIDÉE PAR LE FONDATEUR, portée
// par la projection canonique — jamais redéclarée ici) :
//   Disponible : les treize technologies du lancement, CloneVoice V1 incluse
//                (décision produit fondateur : la V1 vocale fait partie du lancement).
//   À venir    : CloneCall et CloneRoom.
// Les états techniques internes du registre runtime (états de fournisseurs externes,
// niveaux d'architecture, branchements) sont volontairement ABSENTS de la démo
// publique : ils ne remplacent pas la vérité commerciale validée. Aucune date inventée.

import { buildPublicTechnologyProjection } from "@/lib/clonestore/technologies/canonical/public-technology-projection";

export type TechFamilyId = "organiser" | "encadrer" | "communiquer";
export type TechStatus = "Disponible" | "À venir";

export interface TechFamily {
  readonly id: TechFamilyId;
  readonly nav: string;
  readonly label: string;
}

export const TECH_FAMILIES: readonly TechFamily[] = [
  { id: "organiser", nav: "Organiser", label: "Comprendre et organiser" },
  { id: "encadrer", nav: "Encadrer", label: "Encadrer, prouver et apprendre" },
  { id: "communiquer", nav: "Communiquer", label: "Communiquer et interagir" },
];

export interface TechProofChip {
  readonly text: string;
  readonly tone?: "ok" | "warn" | "block" | "neutral";
}

export interface TechEntry {
  readonly id: string;
  readonly family: TechFamilyId;
  /** Verbe/catégorie courte, en capitales. */
  readonly verb: string;
  /** GRAND TITRE HUMAIN — la fonction comprise en < 2 s. */
  readonly humanTitle: string;
  /** Nom propriétaire (sous-titre : « {name} — technologie CloneStore »). */
  readonly name: string;
  /** Explication, max deux lignes. */
  readonly explanation: string;
  /** Libellé humain court de l'onglet. */
  readonly tabLabel: string;
  readonly status: TechStatus;
  /** Mise en avant dans la première navigation visible (8 technologies). */
  readonly featured?: boolean;
  /** Sujet d'approfondissement (tiroir DeepDive) quand il existe. */
  readonly topic?: "cloneos" | "empreinte" | "cloneguard" | "clonecontinuum" | "clonetrace";
  /** Preuve principale : chips simples (les preuves riches sont rendues par la section). */
  readonly proofChips?: readonly TechProofChip[];
  /** Preuve principale : citation/exemple concret. */
  readonly proofQuote?: string;
  /** Note de preuve (légende courte sous la preuve). */
  readonly proofNote?: string;
}

// TECH_CONTENT — texte commercial riche par id (propriété de cette section démo). Le champ
// `status` ici est vestigial/documentaire seulement : la valeur RÉELLE et AUTORITAIRE vient
// TOUJOURS de la projection canonique (voir TECH_CATALOG plus bas, qui l'écrase).
const TECH_CONTENT: readonly TechEntry[] = [
  // ── A. COMPRENDRE ET ORGANISER ──────────────────────────────────────────────
  {
    // CloneOS = le SYSTÈME D'ORGANISATION CENTRAL de CloneStore : il organise tout
    // le travail (missions, priorités, employés IA, technologies, contexte,
    // dépendances, validations, transmissions, résultats) — jamais un simple
    // gestionnaire de tâches ni un routeur, jamais limité à une mission RH isolée.
    // Les décisions sensibles restent humaines lorsque la gouvernance l'exige.
    id: "cloneos",
    family: "organiser",
    verb: "ORCHESTRE",
    humanTitle: "Tout votre travail organisé, tous vos employés IA coordonnés",
    name: "CloneOS",
    explanation:
      "CloneOS organise l'ensemble du travail de votre entreprise : les missions, les priorités, les employés IA mobilisés, les technologies utilisées, le contexte, les dépendances, les validations, les transmissions et les résultats attendus. Il transforme chaque demande en organisation claire et coordonne tout ce qui doit avancer jusqu'au résultat final.",
    tabLabel: "L'organisation",
    status: "Disponible",
    featured: true,
    topic: "cloneos",
    // Preuve riche rendue par la section : organisation globale (CLONEOS_COORDINATION).
  },
  {
    id: "cloneadn",
    family: "organiser",
    verb: "ADAPTE",
    humanTitle: "Un employé adapté à votre entreprise",
    name: "CloneADN",
    explanation:
      "Adapte chaque mission à vos règles, vos habitudes, vos modèles, votre ton et votre organisation.",
    tabLabel: "L'adaptation",
    status: "Disponible",
    featured: true,
    topic: "empreinte",
    proofChips: [
      { text: "Ton" }, { text: "Modèle" }, { text: "Validateur" },
      { text: "Procédure" }, { text: "Précédent" }, { text: "Format" },
    ],
    proofNote: "Éléments de votre Empreinte Entreprise réellement mobilisés.",
  },
  {
    id: "clonecontinuum",
    family: "organiser",
    verb: "SUIT",
    humanTitle: "Le suivi qui ne laisse rien tomber",
    name: "CloneContinuum",
    explanation:
      "Maintient les missions actives, suit les dépendances et relance jusqu'à leur clôture.",
    tabLabel: "Le suivi",
    status: "Disponible",
    featured: true,
    topic: "clonecontinuum",
    proofChips: [
      { text: "2 boucles ouvertes", tone: "warn" },
      { text: "Échéance vendredi" },
      { text: "1 élément manquant signalé", tone: "warn" },
      { text: "Prochaine action : relance manager" },
      { text: "Relance programmée J+2" },
    ],
  },
  {
    id: "clonepolicy",
    family: "organiser",
    verb: "APPLIQUE",
    humanTitle: "Les règles propres à votre entreprise",
    name: "ClonePolicy",
    explanation:
      "Applique les politiques internes, les limites, les procédures et les règles propres à votre organisation.",
    tabLabel: "Les règles",
    status: "Disponible",
    proofQuote: "Tout avenant supérieur à 5 000 € doit être validé par la direction RH.",
    proofNote: "Une règle d'entreprise qui modifie l'action autorisée : l'avenant passe en validation.",
  },
  {
    id: "clonesignals",
    family: "organiser",
    verb: "DÉTECTE",
    humanTitle: "Les événements importants détectés",
    name: "CloneSignals",
    explanation:
      "Détecte les changements, échéances, anomalies et informations qui doivent déclencher une action.",
    tabLabel: "Les signaux",
    status: "Disponible",
    proofChips: [
      { text: "Échéance proche", tone: "warn" },
      { text: "Dossier incomplet", tone: "warn" },
      { text: "Absence de réponse" },
      { text: "Document expirant" },
      { text: "Anomalie détectée", tone: "block" },
    ],
  },

  // ── B. ENCADRER, PROUVER ET APPRENDRE ───────────────────────────────────────
  {
    id: "cloneguard",
    family: "encadrer",
    verb: "ENCADRE",
    humanTitle: "Chaque action reste sous contrôle",
    name: "CloneGuard",
    explanation:
      "Détermine ce qui peut être exécuté, préparé, bloqué ou soumis à validation.",
    tabLabel: "Le contrôle",
    status: "Disponible",
    featured: true,
    topic: "cloneguard",
    proofChips: [
      { text: "Exécuté", tone: "ok" },
      { text: "Prêt à valider", tone: "warn" },
      { text: "Bloqué", tone: "block" },
    ],
    proofNote: "Les trois états d'une action — jamais une autonomie aveugle.",
  },
  {
    id: "clonetrace",
    family: "encadrer",
    verb: "PROUVE",
    humanTitle: "L'historique complet de chaque action",
    name: "CloneTrace",
    explanation:
      "Conserve les actions, sources, validations, décisions et résultats — dès qu'une technologie CloneStore est branchée sur le journal d'événements.",
    tabLabel: "Les preuves",
    status: "Disponible",
    featured: true,
    topic: "clonetrace",
    // Preuve riche : timeline horodatée (DEMO_TRACE) rendue par la section.
  },
  {
    id: "clonetrust",
    family: "encadrer",
    verb: "VÉRIFIE",
    humanTitle: "La fiabilité vérifiée avant d'agir",
    name: "CloneTrust",
    explanation:
      "Vérifie si les informations et les conditions sont suffisamment fiables pour continuer.",
    tabLabel: "La confiance",
    status: "Disponible",
    proofChips: [
      { text: "4 informations confirmées", tone: "ok" },
      { text: "Sources présentes", tone: "ok" },
      { text: "1 incertitude", tone: "warn" },
      { text: "1 élément manquant", tone: "warn" },
    ],
    proofNote: "Le niveau de confiance conditionne la suite — jamais deviné.",
  },
  {
    id: "clonereview",
    family: "encadrer",
    verb: "RELIT",
    humanTitle: "Une dernière relecture avant l'action",
    name: "CloneReview",
    explanation:
      "Vérifie la cohérence du travail avant une action importante ou une validation humaine.",
    tabLabel: "La relecture",
    status: "Disponible",
    proofChips: [
      { text: "Document contrôlé", tone: "ok" },
      { text: "Incohérence détectée", tone: "warn" },
      { text: "Montant vérifié", tone: "ok" },
      { text: "Validation demandée", tone: "warn" },
    ],
  },
  {
    id: "clonebrief",
    family: "encadrer",
    verb: "RÉSUME",
    humanTitle: "L'essentiel restitué clairement",
    name: "CloneBrief",
    explanation:
      "Résume ce qui a été fait, ce qui reste ouvert et ce qui attend une décision.",
    tabLabel: "Le brief",
    status: "Disponible",
    // Preuve riche : brief réel (actions terminées, blocages, prochaine étape,
    // décision attendue) — données SCENE_SYSTEM.brief.
  },
  {
    id: "clonelearn",
    family: "encadrer",
    verb: "APPREND",
    humanTitle: "Un employé qui apprend de l'entreprise",
    name: "CloneLearn",
    explanation:
      "Transforme les corrections, les habitudes et les précédents validés en amélioration continue.",
    tabLabel: "L'apprentissage",
    status: "Disponible",
    featured: true,
    proofQuote: "Toujours envoyer ce type de document au manager avant la direction RH.",
    proofNote: "Une correction humaine devenue préférence réutilisable — validée, jamais devinée.",
  },

  // ── C. COMMUNIQUER ET INTERAGIR ─────────────────────────────────────────────
  {
    id: "clonechat",
    family: "communiquer",
    verb: "ÉCHANGE",
    humanTitle: "Une conversation naturelle avec votre employé IA",
    name: "CloneChat",
    explanation:
      "Permet de confier une mission, poser une question et suivre le travail en langage naturel.",
    tabLabel: "La conversation",
    status: "Disponible",
    proofQuote: "« Préparez l'arrivée de notre responsable commerciale lundi. »",
    proofNote: "La demande libre devient une mission structurée — 7 tâches, 1 validation.",
  },
  {
    id: "clonevoice",
    family: "communiquer",
    verb: "PARLE",
    humanTitle: "Votre employé IA vous parle naturellement",
    name: "CloneVoice",
    explanation:
      "Permet à votre employé IA de restituer un brief, une alerte ou l'avancement d'une mission avec une voix naturelle adaptée à son rôle.",
    tabLabel: "La voix",
    status: "Disponible",
    featured: true,
    proofQuote: "« Trois actions sont terminées. L'avenant de Nora attend votre validation. »",
    proofNote: "Version vocale V1 disponible au lancement. La conversation téléphonique directe relève de CloneCall.",
  },
  {
    id: "clonecall",
    family: "communiquer",
    verb: "APPELLE",
    humanTitle: "Appelez directement votre employé IA",
    name: "CloneCall",
    explanation:
      "Échangez en direct avec votre employé IA comme avec un collaborateur : confiez-lui une mission, demandez-lui un point d'avancement ou recevez son compte rendu oralement.",
    tabLabel: "Les appels",
    status: "À venir",
    featured: true,
    // Preuve riche : les DEUX usages + garde-fou, rendus par la section.
  },
  {
    // CloneRoom n'est PAS un outil de visioconférence ni un résumé de réunions
    // humaines : c'est le SALON DE TRAVAIL PARTAGÉ des employés IA CloneStore.
    // (La présence en réunions humaines autorisées = extension future secondaire.)
    id: "cloneroom",
    family: "communiquer",
    verb: "RÉUNIT",
    humanTitle: "Tous vos employés IA réunis dans un même salon",
    name: "CloneRoom",
    explanation:
      "Un espace commun où vos employés IA partagent le contexte, collaborent, se transmettent des missions et coordonnent leur travail autour de votre entreprise.",
    tabLabel: "Le salon",
    status: "À venir",
    // Preuve riche rendue par la section (CLONEROOM_*) : salon avec mission commune,
    // plusieurs employés IA, transmissions, tâches, contexte partagé, validation
    // humaine, résultat consolidé.
  },
];

const CONTENT_BY_ID = new Map<string, TechEntry>(TECH_CONTENT.map((e) => [e.id, e]));

// ── TECH_CATALOG — DÉRIVÉ de la projection publique canonique P20 ──────────────
// Membership (quelles technologies, dans quel ordre) ET status (Disponible/À venir) viennent
// EXCLUSIVEMENT de buildPublicTechnologyProjection(). Ce fichier ne fait plus que joindre son
// texte commercial riche par id — il ne décide plus lui-même quelles technologies existent.
// Échoue au chargement si une technologie publique canonique n'a aucun contenu démo authored
// (fantôme impossible) — actuellement les 15 ids ont tous leur contenu.
export const TECH_CATALOG: readonly TechEntry[] = buildPublicTechnologyProjection().map((entry) => {
  const content = CONTENT_BY_ID.get(entry.id);
  if (!content) {
    throw new Error(
      `P20 convergence: la technologie publique canonique "${entry.id}" n'a aucun contenu démo (TECH_CONTENT) — ajoute-le avant de la publier.`,
    );
  }
  return { ...content, status: entry.launchStatus };
});

/** Ids présents dans TECH_CONTENT mais absents de la projection canonique — contenu orphelin
 *  (n'apparaît plus dans TECH_CATALOG). Utilisé par les tests de convergence, jamais par le runtime. */
export function orphanTechContentIds(): readonly string[] {
  const canonicalIds = new Set(buildPublicTechnologyProjection().map((e) => e.id));
  return TECH_CONTENT.map((e) => e.id).filter((id) => !canonicalIds.has(id));
}

/** Les huit technologies mises en avant dans la première navigation visible. */
export const FEATURED_TECH_IDS = [
  "cloneos", "cloneadn", "clonecontinuum", "cloneguard",
  "clonecall", "clonevoice", "clonelearn", "clonetrace",
] as const;

// ── CloneCall : les deux usages + garde-fou (copie mandatée, claims-safe) ─────

export const CLONECALL_USAGE_1 = {
  title: "Vous appelez votre employé IA",
  items: [
    "Appeler Pierre directement",
    "Lui parler en langage naturel",
    "Lui confier une mission",
    "Ajouter une information",
    "Demander l'état d'avancement",
    "Recevoir un brief oral",
    "Donner une validation pendant l'appel",
  ],
  example:
    "Vous appelez Pierre : « Où en est l'arrivée de Clara ? » — Pierre vous répond avec les actions terminées, les éléments manquants et la validation attendue.",
} as const;

export const CLONECALL_USAGE_2 = {
  title: "Votre employé IA prend en charge des appels autorisés",
  items: [
    "Contacter un candidat",
    "Conduire un entretien structuré",
    "Joindre un salarié ou un manager",
    "Contacter un prestataire",
    "Recueillir des informations",
    "Effectuer une relance",
    "Confirmer une échéance",
    "Produire un compte rendu",
  ],
  example:
    "Pierre conduit un premier entretien structuré, suit la grille validée par l'entreprise, retranscrit les réponses et prépare un compte rendu pour le recruteur.",
} as const;

export const CLONECALL_GUARDRAIL =
  "L'employé IA conduit l'échange et structure les informations. Les décisions sensibles, notamment la décision finale de recrutement, restent humaines.";

export const CLONECALL_POSITIONING = [
  "la ligne téléphonique directe entre l'entreprise et ses employés IA",
  "la capacité des employés IA à conduire des appels autorisés",
] as const;

// ── CloneOS : la coordination multi-employés (preuve riche) ───────────────────

export const CLONEOS_COORDINATION = {
  /** L'organisation GLOBALE que CloneOS tient — la preuve visuelle mandatée. */
  chips: [
    "Objectif principal", "Priorité", "Mission", "Employés IA mobilisés",
    "Technologies mobilisées", "Tâches attribuées", "Contexte partagé",
    "Dépendances", "Transmissions", "Validation humaine", "Échéance", "Résultat attendu",
  ],
  /** Fonctionnement transversal de l'infrastructure quand plusieurs employés sont présents
   *  (les futurs employés ne sont pas présentés comme déjà commercialisés). */
  example:
    "Une nouvelle arrivée est confirmée. CloneOS organise la mission, mobilise Pierre pour les étapes RH, transmet à Victor les communications nécessaires, active les technologies de contrôle et de suivi, place les validations humaines au bon moment et rassemble le résultat final.",
  /** La phrase d'essence, sous l'exemple. */
  tagline: "Une demande entre. CloneOS organise tout ce qui doit se passer ensuite.",
} as const;

// ── CloneRoom : le salon de travail partagé (preuves riches) ─────────────────

export const CLONEROOM_SALON = {
  /** Ce que le salon réunit. */
  chips: ["Mission commune", "Plusieurs employés IA", "Transmissions", "Tâches attribuées", "Contexte partagé", "Validation humaine", "Résultat consolidé"],
  exampleTransmission:
    "Pierre signale qu'une arrivée doit être communiquée. Victor récupère le contexte utile, prépare la communication et renvoie son résultat dans le même salon de travail.",
  exampleUseCases:
    "Une entreprise peut ouvrir un CloneRoom consacré à un lancement, un recrutement, un projet client ou une situation urgente, puis y mobiliser plusieurs employés IA spécialisés.",
  /** Extension future secondaire — jamais la fonction principale. */
  futureNote:
    "À terme, CloneRoom pourra également étendre cette collaboration aux réunions humaines autorisées.",
} as const;

// ── Textes d'en-tête de la section (mandat) ───────────────────────────────────

export const TECH_SECTION_HEADER = {
  title: ["Tout ce qu'il faut pour", "travailler vraiment."],
  subtitle:
    "Chaque employé IA CloneStore mobilise une infrastructure complète pour comprendre, organiser, agir, communiquer, apprendre et rester sous contrôle.",
  pierreLine:
    "Pierre ne repose pas sur une seule IA : il mobilise plusieurs technologies CloneStore selon la mission.",
} as const;
