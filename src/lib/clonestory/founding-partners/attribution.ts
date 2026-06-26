// CloneStory — Le Cercle des Partenaires Fondateurs
// attribution.ts — Règles d'attribution DIRECTE et de RÉSEAU.
//
// Trois méthodes d'attribution : lien personnel, code personnel, introduction
// déclarée puis confirmée par le prospect. Une contribution crédite AU PLUS un
// partenaire direct ; l'impact réseau remonte la chaîne des branches sans jamais
// voler le mérite direct.
//
// Cas de référence (verrouillé par les tests) :
//   Jérémie introduit Paul. Paul devient partenaire. Paul apporte six clients.
//   → Paul obtient le crédit DIRECT des six clients.
//   → Jérémie conserve la reconnaissance d'avoir créé la branche (origine) et son
//     impact de RÉSEAU, sans voler le mérite direct de Paul.

import type { AttributionMethod, Introduction, Partner } from "./types";

// ── Résolution de l'attribution directe d'une introduction ───────────────────

export interface AttributionCandidate {
  readonly partnerId: string;
  readonly method: AttributionMethod;
  /** Horodatage de l'introduction (déclaration / clic lien / saisie code). ISO. */
  readonly declaredAt: string;
}

export interface AttributionResolution {
  readonly partnerId: string | null;
  readonly method: AttributionMethod | null;
  readonly reason:
    | "single_candidate"
    | "earliest_valid_candidate"
    | "no_candidate"
    | "ambiguous_same_instant";
}

/**
 * Priorité des méthodes en cas d'égalité STRICTE d'horodatage (peu probable) :
 * une introduction déclarée+confirmée par le prospect est la preuve la plus forte,
 * puis le code (saisi volontairement), puis le lien.
 */
const METHOD_PRIORITY: Record<AttributionMethod, number> = {
  declared: 3,
  code: 2,
  link: 1,
};

/**
 * Choisit le partenaire DIRECT d'une introduction parmi des candidats.
 * Règle « première attribution valide gagne » : le candidat dont l'horodatage
 * d'introduction est le plus ancien l'emporte (l'introduction doit précéder
 * l'achat — vérifié par anti-fraud). À horodatage égal, on départage par
 * priorité de méthode ; si toujours égal et partenaires différents → ambigu
 * (escalade en revue manuelle, aucun crédit automatique).
 */
export function resolveDirectAttribution(
  candidates: readonly AttributionCandidate[],
): AttributionResolution {
  if (candidates.length === 0) {
    return { partnerId: null, method: null, reason: "no_candidate" };
  }
  if (candidates.length === 1) {
    return { partnerId: candidates[0].partnerId, method: candidates[0].method, reason: "single_candidate" };
  }

  const sorted = [...candidates].sort((a, b) => {
    const t = a.declaredAt.localeCompare(b.declaredAt);
    if (t !== 0) return t;
    return METHOD_PRIORITY[b.method] - METHOD_PRIORITY[a.method];
  });

  const first = sorted[0];
  const second = sorted[1];
  const sameInstant = first.declaredAt === second.declaredAt;
  const samePriority = METHOD_PRIORITY[first.method] === METHOD_PRIORITY[second.method];
  if (sameInstant && samePriority && first.partnerId !== second.partnerId) {
    return { partnerId: null, method: null, reason: "ambiguous_same_instant" };
  }
  return { partnerId: first.partnerId, method: first.method, reason: "earliest_valid_candidate" };
}

// ── Graphe de branches (qui a introduit qui) ─────────────────────────────────

export interface BranchGraph {
  /** partnerId → partnerId de l'introducteur (origine de branche), ou null. */
  readonly introducedBy: ReadonlyMap<string, string | null>;
}

export function buildBranchGraph(partners: readonly Pick<Partner, "id" | "introducedByPartnerId">[]): BranchGraph {
  const introducedBy = new Map<string, string | null>();
  for (const p of partners) introducedBy.set(p.id, p.introducedByPartnerId ?? null);
  return { introducedBy };
}

/**
 * Ancêtres (chaîne d'origine) d'un partenaire, du parent direct vers la racine.
 * Protégé contre les cycles (un graphe corrompu ne boucle pas indéfiniment).
 */
export function ancestorsOf(graph: BranchGraph, partnerId: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([partnerId]);
  let cursor = graph.introducedBy.get(partnerId) ?? null;
  while (cursor && !seen.has(cursor)) {
    chain.push(cursor);
    seen.add(cursor);
    cursor = graph.introducedBy.get(cursor) ?? null;
  }
  return chain;
}

/** Descendants (toute la sous-branche) d'un partenaire. */
export function descendantsOf(graph: BranchGraph, partnerId: string): Set<string> {
  // children index
  const children = new Map<string, string[]>();
  for (const [child, parent] of graph.introducedBy.entries()) {
    if (parent) {
      const arr = children.get(parent) ?? [];
      arr.push(child);
      children.set(parent, arr);
    }
  }
  const out = new Set<string>();
  const stack = [...(children.get(partnerId) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const c of children.get(cur) ?? []) stack.push(c);
  }
  return out;
}

// ── Calcul des impacts direct & réseau ───────────────────────────────────────

export interface DirectVerifiedByPartner {
  /** partnerId → nombre de contributions DIRECTES vérifiées de ce partenaire. */
  readonly counts: ReadonlyMap<string, number>;
}

export interface PartnerImpact {
  readonly partnerId: string;
  /** Contributions vérifiées dont le partenaire est l'auteur DIRECT. */
  readonly direct: number;
  /** Contributions vérifiées de toute sa sous-branche (descendants), hors direct. */
  readonly network: number;
}

/**
 * Calcule l'impact direct et réseau d'un partenaire. L'impact réseau est la somme
 * des contributions DIRECTES vérifiées de ses descendants — il ne contient JAMAIS
 * les contributions directes du partenaire lui-même (pas de double comptage), et
 * ne retranche jamais le mérite direct des descendants.
 */
export function computePartnerImpact(
  graph: BranchGraph,
  verified: DirectVerifiedByPartner,
  partnerId: string,
): PartnerImpact {
  const direct = verified.counts.get(partnerId) ?? 0;
  let network = 0;
  for (const d of descendantsOf(graph, partnerId)) {
    network += verified.counts.get(d) ?? 0;
  }
  return { partnerId, direct, network };
}

/**
 * Origine de branche d'un prospect/partenaire : le partenaire racine de la chaîne.
 * Sert à reconnaître « qui a créé la branche » sans toucher au crédit direct.
 */
export function branchOrigin(graph: BranchGraph, partnerId: string): string | null {
  const chain = ancestorsOf(graph, partnerId);
  return chain.length ? chain[chain.length - 1] : null;
}

// ── Preuve formelle de l'attribution par identifiants uniques ────────────────
// L'invariant de comptage seul (impacts agrégés) ne suffit pas à prouver qu'aucun
// crédit n'est volé. On raisonne donc sur des CONTRIBUTIONS IDENTIFIÉES, chacune
// avec un unique propriétaire direct, et on vérifie que :
//   1) une contribution a exactement un propriétaire direct ;
//   2) une entreprise n'est revendiquée que par un seul partenaire ;
//   3) une contribution comptée en DIRECT d'un partenaire n'est jamais comptée
//      dans son RÉSEAU (un ancêtre n'obtient jamais le crédit direct d'un descendant) ;
//   4) le graphe est acyclique (un partenaire ne peut être son propre ancêtre).

/** Une contribution vérifiée, identifiée, avec son propriétaire direct. */
export interface VerifiedContributionRef {
  readonly id: string;
  readonly directOwnerId: string;
  readonly companyFingerprint?: string | null;
}

export type AttributionIntegrityCode =
  | "CYCLE_DETECTED"
  | "DUPLICATE_CONTRIBUTION"
  | "DOUBLE_DIRECT_ATTRIBUTION"
  | "DUPLICATE_COMPANY_ATTRIBUTION"
  | "DIRECT_NETWORK_OVERLAP";

export class AttributionIntegrityError extends Error {
  constructor(public readonly code: AttributionIntegrityCode, message: string) {
    super(message);
    this.name = "AttributionIntegrityError";
  }
}

export interface PartnerImpactSets {
  readonly direct: Set<string>;
  readonly network: Set<string>;
}

/** Détecte un cycle dans les chaînes d'origine de branche. Renvoie le chemin ou null. */
export function detectBranchCycle(graph: BranchGraph): string[] | null {
  for (const start of graph.introducedBy.keys()) {
    const path: string[] = [];
    const seen = new Set<string>();
    let cur: string | null = start;
    while (cur && graph.introducedBy.has(cur)) {
      if (seen.has(cur)) {
        const idx = path.indexOf(cur);
        return path.slice(idx >= 0 ? idx : 0).concat(cur);
      }
      seen.add(cur);
      path.push(cur);
      cur = graph.introducedBy.get(cur) ?? null;
    }
  }
  return null;
}

export function assertAcyclicBranchGraph(graph: BranchGraph): void {
  const cycle = detectBranchCycle(graph);
  if (cycle) {
    throw new AttributionIntegrityError("CYCLE_DETECTED", `Cycle de branche détecté : ${cycle.join(" → ")}`);
  }
}

/**
 * Calcule, par partenaire, les ENSEMBLES d'identifiants de contributions comptés
 * en direct et en réseau. `direct(p)` = contributions dont p est propriétaire ;
 * `network(p)` = contributions appartenant à un descendant STRICT de p. Les deux
 * sont disjoints sur un graphe acyclique, et une contribution n'est jamais comptée
 * deux fois dans le même ensemble (Set par identifiant).
 */
export function computeImpactFromContributions(
  graph: BranchGraph,
  contributions: readonly VerifiedContributionRef[],
): Map<string, PartnerImpactSets> {
  const impact = new Map<string, PartnerImpactSets>();
  const ensure = (p: string): PartnerImpactSets => {
    let e = impact.get(p);
    if (!e) {
      e = { direct: new Set<string>(), network: new Set<string>() };
      impact.set(p, e);
    }
    return e;
  };
  for (const c of contributions) {
    ensure(c.directOwnerId).direct.add(c.id);
    for (const ancestor of ancestorsOf(graph, c.directOwnerId)) ensure(ancestor).network.add(c.id);
  }
  return impact;
}

/**
 * Assertion réelle de non-vol de crédit direct. Lève `AttributionIntegrityError`
 * dès qu'un invariant est violé. Prouve formellement le cas Jérémie/Paul : les six
 * contributions de Paul lui restent en DIRECT, n'apparaissent qu'en RÉSEAU chez
 * Jérémie, et aucune ne peut être comptée deux fois ni revendiquée par deux partenaires.
 */
export function assertNoDirectCreditTheft(
  graph: BranchGraph,
  contributions: readonly VerifiedContributionRef[],
): void {
  // (4) graphe acyclique.
  assertAcyclicBranchGraph(graph);

  // (1) une contribution = un seul propriétaire direct.
  const ownerById = new Map<string, string>();
  for (const c of contributions) {
    const prev = ownerById.get(c.id);
    if (prev !== undefined) {
      if (prev === c.directOwnerId) {
        throw new AttributionIntegrityError("DUPLICATE_CONTRIBUTION", `Contribution ${c.id} présente deux fois`);
      }
      throw new AttributionIntegrityError(
        "DOUBLE_DIRECT_ATTRIBUTION",
        `Contribution ${c.id} attribuée en direct à ${prev} ET ${c.directOwnerId}`,
      );
    }
    ownerById.set(c.id, c.directOwnerId);
  }

  // (2) une entreprise = un seul propriétaire direct.
  const ownerByCompany = new Map<string, string>();
  for (const c of contributions) {
    const fp = c.companyFingerprint;
    if (!fp) continue;
    const prev = ownerByCompany.get(fp);
    if (prev !== undefined && prev !== c.directOwnerId) {
      throw new AttributionIntegrityError(
        "DUPLICATE_COMPANY_ATTRIBUTION",
        `Entreprise ${fp} revendiquée par ${prev} ET ${c.directOwnerId}`,
      );
    }
    ownerByCompany.set(fp, c.directOwnerId);
  }

  // (3) direct ∩ réseau = ∅ par partenaire (filet de sécurité explicite).
  const impact = computeImpactFromContributions(graph, contributions);
  for (const [partnerId, sets] of impact) {
    for (const id of sets.direct) {
      if (sets.network.has(id)) {
        throw new AttributionIntegrityError(
          "DIRECT_NETWORK_OVERLAP",
          `Contribution ${id} comptée en direct ET en réseau pour ${partnerId}`,
        );
      }
    }
  }
}
