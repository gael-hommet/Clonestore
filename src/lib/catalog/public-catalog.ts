// Source de vérité COMMERCIALE UNIQUE pour la surface publique CloneStore.
//
// Toute page publique (boutique, fiche Pierre) lit ses informations commerciales
// ICI : nom, slug, métier, statut, prix, disponibilité, capacités publiques, CTA.
// Aucune page ne redéfinit un prix ou un statut employé en dur.
//
// Règles verrouillées (master prompt « polish global » + correction) :
//   • Pierre est le SEUL employé IA nommé publiquement (seul produit ouvert).
//   • Aucun futur employé n'est nommé tant qu'une roadmap commerciale n'est pas
//     verrouillée. On présente seulement des FUTURS MÉTIERS/DÉPARTEMENTS génériques
//     (sans nom, sans prix, sans date).
//   • Clara, Emma, Alex, Noah, Adrien, Lucas, Sophie NE sont PAS exposés
//     publiquement — leurs anciennes URLs redirigent vers la boutique.
//   • Le tarif vient de commercial-state (449 € HT/mois).
//
// Fonctions pures, sûres en SSR comme en client (aucun import node:*).

import {
  FOUNDER_PRICE,
  FOUNDER_PRICE_MONTHLY,
  getCommercialPhase,
  type CommercialPhase,
} from "@/lib/demo/presentation/commercial-state";

export type PublicEmployeeStatus = "active";

export interface PublicEmployee {
  slug: string;
  /** Métier / poste, formulé côté employé IA opérationnel (jamais « assistant »). */
  name: string;
  role: string;
  /** Phrase courte (carte boutique). */
  tagline: string;
  /** Blocs de travail couverts. */
  workAreas: string[];
  status: PublicEmployeeStatus;
}

/** Slug de l'unique employé actif. */
export const PIERRE_SLUG = "pierre";

/** Tarif commercial de référence (lu depuis la source de vérité unique). */
export const EMPLOYEE_PRICE = FOUNDER_PRICE_MONTHLY; // « 449 € HT/mois »
export const EMPLOYEE_PRICE_SHORT = FOUNDER_PRICE; // « 449 € HT »

/** Pierre — employé IA RH opérationnel, seul produit ouvert et seul employé nommé. */
export const PIERRE_PUBLIC: PublicEmployee = {
  slug: PIERRE_SLUG,
  name: "Pierre",
  role: "Employé IA RH opérationnel",
  tagline:
    "Reçoit une demande RH, la transforme en mission, prépare le travail, suit, relance et garde la trace.",
  workAreas: [
    "Missions RH structurées à partir d'une demande libre",
    "Documents RH prêts à relire, valider ou envoyer",
    "Emails, relances et continuité dans le temps",
    "Validations humaines sur le sensible + traçabilité",
  ],
  status: "active",
};

/** Catalogue public complet : Pierre uniquement (aucun futur employé nommé). */
export const PUBLIC_EMPLOYEES: PublicEmployee[] = [PIERRE_PUBLIC];

/**
 * Futurs MÉTIERS / DÉPARTEMENTS (génériques, sans nom d'employé, sans prix, sans
 * date). Sert à présenter la vision « organisation progressivement composée
 * d'employés IA » sans promettre un produit inexistant.
 */
export interface FutureDepartment {
  label: string;
  description: string;
}

export const FUTURE_DEPARTMENTS: FutureDepartment[] = [
  { label: "Support & relation client", description: "Réponses, suivi et continuité relationnelle." },
  { label: "Finance opérationnelle", description: "Facturation, relances et lecture des flux." },
  { label: "Administration", description: "Administratif récurrent et coordination interne." },
  { label: "Opérations", description: "Coordination d'opérations structurées et suivi transverse." },
];

const PUBLIC_SLUGS = new Set(PUBLIC_EMPLOYEES.map((e) => e.slug));

/** Slugs d'anciens employés retirés de la surface publique (redirection propre). */
export const RETIRED_PUBLIC_SLUGS = [
  "clara",
  "emma",
  "alex",
  "noah",
  "adrien",
  "lucas",
  "sophie",
] as const;

export function isPublicEmployeeSlug(slug: string): boolean {
  return PUBLIC_SLUGS.has(slug);
}

export function getPublicEmployee(slug: string): PublicEmployee | null {
  return PUBLIC_EMPLOYEES.find((e) => e.slug === slug) ?? null;
}

export function getActiveEmployees(): PublicEmployee[] {
  return PUBLIC_EMPLOYEES.filter((e) => e.status === "active");
}

export interface EmployeeCta {
  label: string;
  href: string;
}

/**
 * CTA d'activation cohérent avec le tunnel commercial actuel.
 * Avant lancement : réservation. Après lancement : activation.
 */
export function getActivationCta(
  phase: CommercialPhase = getCommercialPhase(),
): EmployeeCta {
  if (phase === "launched") {
    return { label: "Activer Pierre", href: "/checkout?agent=pierre" };
  }
  return { label: "Réserver Pierre", href: "/reserver/pierre" };
}
