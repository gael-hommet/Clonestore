// CloneStory — Catalogue des distinctions du Cercle (source unique, statique).
//
// NON gamification : aucune mécanique enfantine, aucun « point », aucune récompense
// commerciale ni promesse financière. Ce sont des DISTINCTIONS honorifiques,
// institutionnelles et permanentes, dérivées de contributions RÉELLES ou attribuées
// manuellement. Aucun faux acquis : une distinction n'est « obtenue » que si la règle
// réelle est satisfaite (auto) ou si elle a été explicitement accordée (manuel).
//
// Les libellés évitent strictement le vocabulaire interdit (voir vocabulary.ts :
// récompense, points, action(s), commission, parrainage, affiliation, etc.).

export type DistinctionCategory = "statut" | "etape" | "engagement" | "honneur";
export type DistinctionGrant = "auto" | "manuel";

/** Statistiques réelles d'un partenaire utilisées pour l'éligibilité automatique. */
export interface PartnerStatsForDistinction {
  status: string;
  introductionsDeclared: number;
  prospectsConfirmed: number;
  accountsCreated: number;
  clientsAttributed: number;
  contributionsVerified: number;
  isFoundingPartner: boolean;
}

export interface DistinctionDef {
  /** identifiant stable (jamais traduit, jamais réutilisé). */
  code: string;
  /** libellé noble — JAMAIS un terme interdit. */
  name: string;
  description: string;
  category: DistinctionCategory;
  /** attribution automatique (dérivée de stats réelles) ou manuelle (admin). */
  grant: DistinctionGrant;
  /** règle d'éligibilité automatique (absente pour les distinctions manuelles). */
  rule?: (s: PartnerStatsForDistinction) => boolean;
}

/**
 * Catalogue verrouillé. L'ordre = ordre d'affichage (du statut à l'honneur).
 * Les distinctions « manuel » ne s'obtiennent jamais automatiquement.
 */
export const DISTINCTIONS: readonly DistinctionDef[] = [
  {
    code: "founding_member",
    name: "Membre du Cercle Fondateur",
    description: "Entrée vérifiée dans le Cercle des Partenaires Fondateurs.",
    category: "statut",
    grant: "auto",
    rule: (s) => ["email_verified", "identity_verified", "active_contributor", "founding_partner"].includes(s.status),
  },
  {
    code: "founding_partner",
    name: "Partenaire Fondateur",
    description: "Titre permanent accordé après une première contribution vérifiée au commencement de CloneStore.",
    category: "honneur",
    grant: "auto",
    rule: (s) => s.isFoundingPartner,
  },
  {
    code: "first_introduction",
    name: "Première introduction",
    description: "Première entreprise présentée à CloneStore.",
    category: "etape",
    grant: "auto",
    rule: (s) => s.introductionsDeclared >= 1,
  },
  {
    code: "first_confirmed",
    name: "Premier prospect confirmé",
    description: "Une première mise en relation confirmée par le contact.",
    category: "etape",
    grant: "auto",
    rule: (s) => s.prospectsConfirmed >= 1,
  },
  {
    code: "first_client",
    name: "Premier client",
    description: "Une entreprise présentée est devenue cliente de CloneStore.",
    category: "etape",
    grant: "auto",
    rule: (s) => s.clientsAttributed >= 1,
  },
  {
    code: "builder_5",
    name: "Bâtisseur du Cercle",
    description: "Cinq contributions vérifiées au développement de CloneStore.",
    category: "engagement",
    grant: "auto",
    rule: (s) => s.contributionsVerified >= 5,
  },
  {
    code: "ambassador_10",
    name: "Ambassadeur du Cercle",
    description: "Dix contributions vérifiées au développement de CloneStore.",
    category: "engagement",
    grant: "auto",
    rule: (s) => s.contributionsVerified >= 10,
  },
  {
    code: "pioneer",
    name: "Pionnier du Cercle",
    description: "Distinction réservée aux tout premiers partenaires du Cercle.",
    category: "honneur",
    grant: "manuel",
  },
  {
    code: "architect",
    name: "Architecte du Cercle",
    description: "Distinction exceptionnelle, accordée manuellement pour une contribution majeure.",
    category: "honneur",
    grant: "manuel",
  },
] as const;

/** Distinction calculée pour un partenaire : `earned` (obtenue) ou `locked` (future). */
export interface ComputedDistinction {
  code: string;
  name: string;
  description: string;
  category: DistinctionCategory;
  grant: DistinctionGrant;
  earned: boolean;
  locked: boolean;
}

/**
 * Calcule l'état des distinctions à partir de stats RÉELLES + d'éventuelles
 * attributions manuelles persistées (codes). Aucune valeur inventée : une distinction
 * automatique n'est obtenue que si sa règle est vraie ; une manuelle que si accordée.
 */
export function computeDistinctions(
  stats: PartnerStatsForDistinction,
  manualGrants: readonly string[] = [],
): ComputedDistinction[] {
  const manual = new Set(manualGrants);
  return DISTINCTIONS.map((d) => {
    const earned = d.grant === "auto" ? Boolean(d.rule && d.rule(stats)) : manual.has(d.code);
    return {
      code: d.code,
      name: d.name,
      description: d.description,
      category: d.category,
      grant: d.grant,
      earned,
      locked: !earned,
    };
  });
}

/** Nombre de distinctions réellement obtenues. */
export function countEarned(distinctions: readonly ComputedDistinction[]): number {
  return distinctions.filter((d) => d.earned).length;
}
