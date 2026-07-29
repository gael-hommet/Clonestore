// src/lib/clonechat/product-truth/types.ts
//
// CloneChat BLOC 1 — PRODUCT TRUTH ENGINE.
//
// Une vérité produit UNIQUE, versionnée et traçable, projetée depuis les sources de CODE réelles
// déjà existantes (route-registry, public-catalog, country-pricing, commercial-state, technologies,
// hr-canon) — jamais de prose réinventée. Chaque vérité porte une enveloppe complète qui permet à
// CloneChat (BLOC 2+) de distinguer VÉRITÉ PRODUIT (ce que CloneStore sait faire) de son état, sa
// fraîcheur, son environnement et sa preuve. Module PUR (aucun I/O, aucun node:*, aucun Date.now
// au niveau module) → déterministe et testable.

/** Domaine de la vérité. Aligné sur les registres réels du produit. */
export type TruthArea =
  | "vision"
  | "route"
  | "employee"
  | "future_department"
  | "technology"
  | "pricing"
  | "country"
  | "launch"
  | "capability"
  | "limitation"
  | "promise"
  | "governance";

/**
 * Statut de la vérité. `active`/`gated` = surface produit RÉELLE et servie ; `beta`/`disabled`/
 * `planned` = existe mais partielle/optionnelle/à venir (jamais survendue) ; `stub`/`deprecated`/
 * `internal` = hors surface publique servie.
 */
export type TruthStatus =
  | "active"
  | "gated"
  | "beta"
  | "disabled"
  | "planned"
  | "stub"
  | "deprecated"
  | "internal";

/** Environnement où la vérité s'applique. */
export type TruthEnvironment = "production" | "preview" | "all";

/** Niveau de certitude de la source. */
export type TruthCertainty = "verified" | "derived" | "declared";

/** Une vérité produit atomique, avec enveloppe complète (BLOC 1 §Product Truth Engine). */
export interface ProductTruth {
  /** Identifiant STABLE et unique, ex. "route:/reserver/pierre", "pricing:CH". */
  readonly id: string;
  readonly area: TruthArea;
  readonly status: TruthStatus;
  /** Valeur/résumé concret de la vérité (une phrase exploitable). */
  readonly value: string;
  /** Version déterministe (hash de contenu) : change dès que la vérité change → traçabilité. */
  readonly version: string;
  /** Chemin de fichier RÉEL source de vérité. */
  readonly source: string;
  /** Module/rôle responsable de cette vérité. */
  readonly owner: string;
  /** Date ISO de dernière mise à jour connaissable, sinon null (jamais un faux timestamp). */
  readonly lastUpdatedAt: string | null;
  /** Début de validité (vérités datées : lancement). */
  readonly validFrom: string | null;
  /** Fin de validité (vérités datées : fermeture fondateur). */
  readonly validUntil: string | null;
  readonly environment: TruthEnvironment;
  /** Preuve exacte (constante/texte de code) qui établit la vérité. */
  readonly evidence: string;
  readonly certainty: TruthCertainty;
  /** Clé de dédoublonnage/contradiction dans un même domaine (ex. pays, chemin). */
  readonly key: string;
  readonly routes?: readonly string[];
}

/** Un statut est-il réellement servi en Production comme vérité produit établie ? */
export const PRODUCTION_SERVABLE_STATUSES: ReadonlySet<TruthStatus> = new Set<TruthStatus>([
  "active",
  "gated",
]);

export function isProductionServable(t: ProductTruth): boolean {
  return t.environment !== "preview" && PRODUCTION_SERVABLE_STATUSES.has(t.status);
}

/** Hash déterministe court (FNV-1a 32-bit → hex) — pas de crypto, sûr en bundle client. */
export function truthVersionHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Owner canonique par domaine (rôle/module responsable de la vérité). */
export const AREA_OWNER: Readonly<Record<TruthArea, string>> = {
  vision: "product",
  route: "nav/route-registry",
  employee: "catalog/public-catalog",
  future_department: "catalog/public-catalog",
  technology: "technologies/canonical",
  pricing: "pricing/country-pricing",
  country: "pricing/country-pricing",
  launch: "demo/commercial-state",
  capability: "pierre/hr-canon",
  limitation: "pierre/hr-canon",
  promise: "commercial-governance",
  governance: "clonechat/governance",
};
