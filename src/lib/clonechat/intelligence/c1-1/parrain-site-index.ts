// src/lib/clonechat/intelligence/c1-1/parrain-site-index.ts
// C1.1 — Index VIVANT du site : dérivé du registre de routes réel (src/lib/nav) fusionné
// avec les descriptions C1 (source éditoriale vérifiée). Jamais de page inventée : une
// route absente est déclarée absente avec la page réelle la plus proche. Les routes
// authentifiées ne sont JAMAIS exposées comme publiques.

import { ROUTE_REGISTRY, type RouteEntry } from "@/lib/nav/route-registry";
import { CLONESTORE_SITE_PAGES, UNAVAILABLE_ROUTES, getSitePage, resolveLink } from "../c1/clonechat-site-map";
import { computeCanonicalFingerprints } from "./parrain-freshness";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import { parrainNormalize, type ParrainKnowledgeChunk, type ParrainVisibility } from "./parrain-types";

export interface ParrainSitePage {
  readonly route: string;
  readonly dynamicParams: readonly string[];
  readonly title: string;
  readonly description: string;
  readonly purpose: string;
  readonly audience: "public" | "authenticated" | "internal";
  readonly authRequired: boolean;
  readonly flagRequired: string | null;
  readonly availability: "active" | "gated" | "stub" | "deprecated" | "internal";
  readonly primaryCTA: string | null;
  readonly relatedRoutes: readonly string[];
  readonly directLink: string;
  readonly safeToShowFor: readonly ("public" | "client" | "founder")[];
  readonly sourceHash: string;
  readonly knownIssues: readonly string[];
  readonly aliases: readonly string[];
}

const ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "/demo": ["démo", "demonstration", "voir le produit"],
  "/reserver/pierre": ["réserver", "réservation", "accès fondateur", "reserve"],
  "/agents/pierre": ["page pierre", "fiche pierre", "produit pierre"],
  "/comprendre-clonestore": ["pitch", "comprendre", "présentation", "tarifs", "pricing", "prix"],
  "/questions": ["support", "contact", "faq", "aide"],
  "/legal/cgu": ["cgu", "conditions d'utilisation"],
  "/legal/cgv": ["cgv", "conditions de vente"],
  "/legal/mentions": ["mentions légales", "mentions-legales"],
  "/legal/confidentialite": ["privacy", "confidentialité", "politique de confidentialité"],
  "/legal/dpa": ["dpa", "data processing agreement"],
  "/cockpit": ["cockpit", "console"],
  "/cockpit/pierre": ["cockpit pierre", "missions", "validations"],
  "/cockpit/room": ["cloneroom", "salle", "salon"],
  "/assistant": ["clonechat", "chat", "assistant"],
});

function dynamicParams(path: string): readonly string[] {
  return [...path.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
}

/** Fusion registre de routes réel × descriptions C1 → page vivante. */
function mergePage(entry: RouteEntry): ParrainSitePage {
  const c1 = getSitePage(entry.path);
  const fp = computeCanonicalFingerprints();
  const authRequired = entry.audience !== "public";
  const safeToShowFor: ("public" | "client" | "founder")[] =
    entry.audience === "public" ? ["public", "client", "founder"]
    : entry.audience === "authenticated" ? ["client", "founder"]
    : ["founder"];
  return Object.freeze({
    route: entry.path,
    dynamicParams: dynamicParams(entry.path),
    title: c1?.title ?? entry.label,
    description: c1?.description ?? entry.note ?? entry.label,
    purpose: c1?.purpose ?? entry.label,
    audience: entry.audience,
    authRequired,
    flagRequired: entry.path === "/assistant" ? "CLONECHAT_ENABLED" : null,
    availability: entry.status,
    primaryCTA: c1?.cta ?? null,
    relatedRoutes: c1?.relatedPages ?? [],
    directLink: entry.path,
    safeToShowFor,
    sourceHash: fp.routeRegistry,
    knownIssues: [],
    aliases: ALIASES[entry.path] ?? [],
  });
}

let CACHE: readonly ParrainSitePage[] | null = null;
let CACHE_HASH: string | null = null;

/** Index vivant : reconstruit si le registre de routes canonique a changé. */
export function buildParrainSiteIndex(): readonly ParrainSitePage[] {
  const fp = computeCanonicalFingerprints();
  if (CACHE && CACHE_HASH === fp.routeRegistry) return CACHE;
  const routesFromRegistry = ROUTE_REGISTRY.map(mergePage);
  const registryPaths = new Set(ROUTE_REGISTRY.map((r) => r.path));
  // Pages C1 vérifiées absentes du registre central (le registre P9.1 est volontairement partiel).
  const extras = CLONESTORE_SITE_PAGES.filter((p) => !registryPaths.has(p.route)).map((p) =>
    Object.freeze({
      route: p.route,
      dynamicParams: dynamicParams(p.route),
      title: p.title,
      description: p.description,
      purpose: p.purpose,
      audience: (p.status === "internal" ? "internal" : p.status === "gated" ? "authenticated" : "public") as "public" | "authenticated" | "internal",
      authRequired: p.status === "gated" || p.status === "internal",
      flagRequired: p.route === "/assistant" ? "CLONECHAT_ENABLED" : null,
      availability: (p.status === "internal" ? "internal" : p.status === "gated" ? "gated" : "active") as ParrainSitePage["availability"],
      primaryCTA: p.cta,
      relatedRoutes: p.relatedPages,
      directLink: p.route,
      safeToShowFor: (p.status === "internal" ? ["founder"] : p.status === "gated" ? ["client", "founder"] : ["public", "client", "founder"]) as ("public" | "client" | "founder")[],
      sourceHash: fp.c1SiteMap,
      knownIssues: [],
      aliases: ALIASES[p.route] ?? [],
    }),
  );
  CACHE = Object.freeze([...routesFromRegistry, ...extras]);
  CACHE_HASH = fp.routeRegistry;
  return CACHE;
}

export function sitePageByRoute(route: string): ParrainSitePage | null {
  const normalized = route.trim().replace(/\/+$/, "") || "/";
  return buildParrainSiteIndex().find((p) => p.route === normalized) ?? null;
}

export interface SiteLookupResult {
  readonly exists: boolean;
  readonly page: ParrainSitePage | null;
  readonly closest: ParrainSitePage | null;
  readonly honestNote: string | null;
}

/** Recherche honnête : route exacte → alias → route absente (jamais d'URL fabriquée). */
export function lookupSite(query: string): SiteLookupResult {
  const q = parrainNormalize(query);
  const index = buildParrainSiteIndex();
  const direct = q.startsWith("/") ? sitePageByRoute(q) : null;
  if (direct) return { exists: true, page: direct, closest: null, honestNote: null };
  const byAlias = index.find((p) => p.aliases.some((a) => q.includes(parrainNormalize(a))));
  if (byAlias) return { exists: true, page: byAlias, closest: null, honestNote: null };
  // Route absente connue (C1 : /clonecall, /pricing, /contact…)
  const absent = UNAVAILABLE_ROUTES.find((u) => q.includes(u.route.slice(1)) || q.includes(parrainNormalize(u.route)));
  if (absent) {
    const r = resolveLink(absent.route);
    const closest = r.closestExisting ? sitePageByRoute(r.closestExisting.route) : null;
    return { exists: false, page: null, closest, honestNote: absent.note };
  }
  return { exists: false, page: null, closest: sitePageByRoute("/questions"), honestNote: "Page inconnue du site actuel — je ne fabrique pas d'adresse." };
}

/** Chunks de connaissance site pour la récupération (visibilité par audience réelle). */
export function buildSiteChunks(): readonly ParrainKnowledgeChunk[] {
  return buildParrainSiteIndex().map((p) => {
    const visibility: ParrainVisibility =
      p.audience === "public" ? "PUBLIC" : p.audience === "authenticated" ? "AUTHENTICATED_CLIENT" : "FOUNDER_INTERNAL";
    return makeParrainChunk({
      id: `site.${p.route}`,
      sourceId: "src.site_index",
      title: p.title,
      text: `${p.route} — ${p.title}. ${p.description} ${p.purpose}${p.authRequired ? " (connexion requise)" : ""}${p.flagRequired ? ` (fonctionnalité verrouillée par ${p.flagRequired}, désactivée par défaut)` : ""}`,
      sourceType: p.audience === "public" ? "public_page" : p.audience === "authenticated" ? "authenticated_page" : "internal_page",
      authority: "canonical_registry",
      visibility,
      citationLabel: `la page ${p.route}`,
      routes: [p.route],
    });
  });
}
