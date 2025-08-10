// src/lib/clonechat/product-truth/registry.ts
//
// PRODUCT TRUTH ENGINE — assemblage + requêtes + intégrité. Assemble toutes les projections des
// sources RÉELLES en un registre unique, mis en cache par process (recalculé depuis le code, donc
// frais à chaque déploiement). Fournit : accès filtré Production (`active`/`gated` uniquement),
// requête par domaine, détection de CONTRADICTION active et de vérité PÉRIMÉE (stale), et une
// version globale traçable. Pur & déterministe (aucun Date.now au niveau module).

import { isProductionServable, truthVersionHash, type ProductTruth, type TruthArea } from "./types";
import {
  projectVision, projectRoutes, projectEmployees, projectFutureDepartments,
  projectPricing, projectLaunch, projectTechnologies, projectCapabilities, projectGovernance,
} from "./projectors";

/** Construit le registre complet depuis les sources réelles. Déterministe. */
export function buildProductTruth(): readonly ProductTruth[] {
  return Object.freeze([
    ...projectVision(),
    ...projectRoutes(),
    ...projectEmployees(),
    ...projectFutureDepartments(),
    ...projectPricing(),
    ...projectLaunch(),
    ...projectTechnologies(),
    ...projectCapabilities(),
    ...projectGovernance(),
  ]);
}

let CACHE: readonly ProductTruth[] | null = null;
export function productTruth(): readonly ProductTruth[] {
  return (CACHE ??= buildProductTruth());
}
export function invalidateProductTruthCache(): void { CACHE = null; }

/** Vérités RÉELLEMENT servies en Production (status active/gated). Le reste (beta/planned/disabled/
 *  deprecated/stub/internal) existe mais n'est jamais présenté comme une vérité produit établie. */
export function activeProductTruth(): ProductTruth[] {
  return productTruth().filter(isProductionServable);
}

export function truthsForArea(area: TruthArea): ProductTruth[] {
  return productTruth().filter((t) => t.area === area);
}

export function getTruthById(id: string): ProductTruth | null {
  return productTruth().find((t) => t.id === id) ?? null;
}

/** Version globale déterministe du registre (change si une vérité active change). */
export function productTruthVersion(): string {
  const material = activeProductTruth()
    .map((t) => `${t.id}@${t.version}`)
    .sort()
    .join("|");
  return `pt-${truthVersionHash(material)}`;
}

// ── INTÉGRITÉ ────────────────────────────────────────────────────────────────

export interface Contradiction {
  readonly area: TruthArea;
  readonly key: string;
  readonly ids: readonly string[];
  readonly values: readonly string[];
}

/**
 * Contradiction ACTIVE = deux vérités servies (active/gated) dans le MÊME domaine et la MÊME clé
 * mais avec des VALEURS différentes. Production ne doit jamais servir deux vérités incompatibles.
 */
export function findActiveContradictions(): Contradiction[] {
  const byKey = new Map<string, ProductTruth[]>();
  for (const t of activeProductTruth()) {
    const k = `${t.area}::${t.key}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(t);
  }
  const out: Contradiction[] = [];
  for (const [, group] of byKey) {
    const values = new Set(group.map((t) => t.value));
    if (group.length > 1 && values.size > 1) {
      out.push({ area: group[0].area, key: group[0].key, ids: group.map((t) => t.id), values: [...values] });
    }
  }
  return out;
}

/**
 * Vérité PÉRIMÉE (stale) = vérité active dont la fin de validité (`validUntil`) est déjà passée à
 * l'instant `nowISO`. `nowISO` est INJECTÉ (jamais Date.now au niveau module) pour rester déterministe.
 */
export function findStaleTruths(nowISO: string): ProductTruth[] {
  const now = Date.parse(nowISO);
  if (Number.isNaN(now)) return [];
  return activeProductTruth().filter((t) => {
    if (!t.validUntil) return false;
    const until = Date.parse(t.validUntil);
    return !Number.isNaN(until) && until < now;
  });
}

/** Toute vérité active ne référence QUE la date de lancement en vigueur (8 septembre 2026), jamais une
 *  date de lancement supersédée (5 août 2026 initial, puis 12 août 2026). Garde anti-régression de
 *  fraîcheur des dates. */
export function findSupersededDateReferences(): ProductTruth[] {
  return activeProductTruth().filter((t) => /\b(?:5|12)\s*(?:aout|août)\s*2026\b/i.test(t.value));
}
