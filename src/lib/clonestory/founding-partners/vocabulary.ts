// CloneStory — Le Cercle des Partenaires Fondateurs
// vocabulary.ts — VOCABULAIRE OFFICIEL VERROUILLÉ.
//
// CloneStory est un univers séparé, institutionnel et historique : la mémoire
// officielle de CloneStore et des personnes ayant contribué de manière vérifiée
// à son commencement. Ce module est la source unique du langage du produit.
//
// Il ne s'agit JAMAIS d'un programme d'affiliation, de parrainage commercial,
// d'un jeu, d'un concours, d'un système de points, ni d'une promesse de parts,
// d'actions ou de revenus. C'est un REGISTRE HISTORIQUE OFFICIEL : une
// reconnaissance permanente d'une contribution vérifiée au lancement de CloneStore.

/** Nom de l'univers institutionnel. */
export const UNIVERSE_NAME = "CloneStory" as const;

/** Nom officiel du programme. */
export const PROGRAM_NAME = "Le Cercle des Partenaires Fondateurs" as const;

/** Titre français accordé après contribution vérifiée. */
export const TITLE_FR = "Partenaire Fondateur de CloneStore" as const;

/** Badge international. */
export const TITLE_INTL = "Founding Partner" as const;

/**
 * Phrase doctrinale — DOIT apparaître dans l'expérience, de manière claire mais
 * élégante, sans casser le prestige de la page principale. Verbatim verrouillé.
 */
export const DOCTRINE: string =
  "CloneStory n'est ni un programme d'affiliation ni un système de parrainage commercial. " +
  "Il constitue le registre officiel des personnes ayant contribué de manière vérifiée " +
  "au commencement de CloneStore.";

/**
 * Séquence de l'expérience d'entrée cinématographique (1ʳᵉ visite). Verbatim
 * verrouillé — affichée progressivement avant la révélation de la page principale.
 */
export const INTRO_SEQUENCE = [
  "Certaines personnes découvriront CloneStore lorsqu'elle sera déjà connue.",
  "D'autres auront contribué à son commencement.",
  "Leur nom restera inscrit dans son histoire.",
] as const;

/**
 * Précision juridique : « fondateur » désigne ici une contribution AU COMMENCEMENT,
 * et non la fondation juridique de la société. À rappeler dans les conditions.
 */
export const FOUNDER_MEANING_NOTE: string =
  "Le terme « fondateur » désigne ici une contribution vérifiée au commencement de " +
  "CloneStore, et non la fondation juridique de la société. Il ne confère aucune part, " +
  "action, droit de vote ni revenu sur CloneStore.";

/**
 * Termes STRICTEMENT INTERDITS comme désignation principale du statut ou du
 * programme. La présence de l'un d'eux dans un libellé officiel est un défaut.
 * (On vérifie des mots entiers, insensibles à la casse — voir `assertNoForbiddenTerm`.)
 */
export const FORBIDDEN_PRINCIPAL_TERMS = [
  "affiliation",
  "affilié",
  "affiliée",
  "parrainage",
  "parrain",
  "filleul",
  "concours",
  "jeu",
  "points",
  "récompense",
  "cofondateur",
  "co-fondateur",
  "associé",
  "actionnaire",
  "action",
  "actions",
  "parts",
  "vendeur",
  "commission",
  "ambassadeur commercial",
] as const;

/**
 * « Founder » employé SEUL est interdit comme titre (ambigu avec la fondation
 * juridique). Le badge correct est « Founding Partner ».
 */
export const FORBIDDEN_STANDALONE_FOUNDER = "founder" as const;

/**
 * Construit le badge de registre, ex. « FOUNDING PARTNER #017 ».
 * Le numéro est toujours zéro-paddé sur au moins 3 chiffres et précédé de #.
 */
export function formatRegistryBadge(registryNumber: number): string {
  if (!Number.isInteger(registryNumber) || registryNumber < 1) {
    throw new Error("registryNumber doit être un entier positif");
  }
  return `${TITLE_INTL.toUpperCase()} #${formatRegistryNumber(registryNumber)}`;
}

/** Numéro de registre formaté (zéro-paddé sur 3, ex. 17 → "017", 1042 → "1042"). */
export function formatRegistryNumber(registryNumber: number): string {
  if (!Number.isInteger(registryNumber) || registryNumber < 1) {
    throw new Error("registryNumber doit être un entier positif");
  }
  return String(registryNumber).padStart(3, "0");
}

/**
 * Ligne « Depuis <mois> <année> » à partir d'une date d'entrée au registre.
 * Mois en français, en minuscule (ex. « Depuis juillet 2026 »).
 */
const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

export function formatSinceLine(joinedAt: Date): string {
  if (Number.isNaN(joinedAt.getTime())) throw new Error("date invalide");
  return `Depuis ${MONTHS_FR[joinedAt.getUTCMonth()]} ${joinedAt.getUTCFullYear()}`;
}

/**
 * Identité officielle complète d'un Partenaire Fondateur (pour le registre et la
 * page publique). Toutes les chaînes proviennent de cette source unique.
 */
export interface FoundingPartnerIdentity {
  badge: string; // FOUNDING PARTNER #017
  titleFr: string; // Partenaire Fondateur de CloneStore
  since: string; // Depuis juillet 2026
}

export function buildIdentity(registryNumber: number, joinedAt: Date): FoundingPartnerIdentity {
  return {
    badge: formatRegistryBadge(registryNumber),
    titleFr: TITLE_FR,
    since: formatSinceLine(joinedAt),
  };
}

/**
 * Vérifie qu'un libellé officiel n'emploie aucun terme interdit comme désignation
 * principale, ni « founder » seul. Lève une erreur explicite sinon. Utilisé par les
 * tests d'invariants et utilisable comme garde au moment de composer un libellé.
 *
 * Détection par mot entier (frontières de mot Unicode-safe) pour éviter les faux
 * positifs (ex. « fraction » ne déclenche pas « action »).
 */
export function assertNoForbiddenTerm(label: string): void {
  const violation = findForbiddenTerm(label);
  if (violation) {
    throw new Error(`Libellé interdit : « ${violation} » ne peut désigner le statut/programme (${label}).`);
  }
}

/** Retourne le premier terme interdit trouvé dans le libellé, ou null. */
export function findForbiddenTerm(label: string): string | null {
  const haystack = ` ${label.toLowerCase().normalize("NFC")} `;
  for (const term of [...FORBIDDEN_PRINCIPAL_TERMS, FORBIDDEN_STANDALONE_FOUNDER]) {
    // Frontière : tout ce qui n'est ni lettre ni chiffre (espaces, ponctuation, tirets).
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term.toLowerCase())}(?![\\p{L}\\p{N}])`, "u");
    if (re.test(haystack)) return term;
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
