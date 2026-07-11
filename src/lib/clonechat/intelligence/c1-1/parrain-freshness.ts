// src/lib/clonechat/intelligence/c1-1/parrain-freshness.ts
// C1.1 — Fraîcheur : empreintes LIVE des modules canoniques. Un index généré dont le
// hash source a changé est STALE (jamais présenté comme courant). Les sources dérivées
// à la demande (live_derived) sont fraîches par construction.

import { ROUTE_REGISTRY } from "@/lib/nav/route-registry";
import { HR_CAPABILITIES } from "@/lib/pierre/v1/hr-canon";
import { listTechnologyRegistryEntries } from "@/lib/clonestore/technologies/t1";
import { listProductTechnologyRegistryEntries } from "@/lib/clonestore/product-technologies/t2";
import { publicPricingCatalog } from "@/lib/clonestore/pricing/country-pricing";
import { CLONESTORE_SITE_PAGES } from "../c1/clonechat-site-map";
import { parrainHash, type ParrainFreshness, type ParrainFreshnessStrategy } from "./parrain-types";

export interface CanonicalFingerprints {
  readonly routeRegistry: string;
  readonly capabilityRegistry: string;
  readonly capabilityCount: number;
  readonly t1Registry: string;
  readonly t2Registry: string;
  readonly pricing: string;
  readonly c1SiteMap: string;
}

/** Empreintes calculées en LIVE depuis les modules canoniques réels. */
export function computeCanonicalFingerprints(): CanonicalFingerprints {
  const routes = ROUTE_REGISTRY.map((r) => `${r.path}|${r.label}|${r.audience}|${r.status}`).join("\n");
  const caps = HR_CAPABILITIES.map((c) => `${c.id}|${c.version}|${c.implementation}|${c.autonomy}`).join("\n");
  const t1 = listTechnologyRegistryEntries().map((e) => `${e.id}|${e.status}`).join("\n");
  const t2 = listProductTechnologyRegistryEntries().map((e) => `${e.id}|${e.status}`).join("\n");
  const pricing = publicPricingCatalog().map((p) => `${p.group}|${p.amount}|${p.currency}`).join("\n");
  const site = CLONESTORE_SITE_PAGES.map((p) => `${p.route}|${p.status}`).join("\n");
  return Object.freeze({
    routeRegistry: parrainHash(routes),
    capabilityRegistry: parrainHash(caps),
    capabilityCount: HR_CAPABILITIES.length,
    t1Registry: parrainHash(t1),
    t2Registry: parrainHash(t2),
    pricing: parrainHash(pricing),
    c1SiteMap: parrainHash(site),
  });
}

export interface FreshnessCheck {
  readonly status: ParrainFreshness;
  readonly liveHash: string | null;
  readonly recordedHash: string | null;
  readonly reason: string;
}

/**
 * Vérifie la fraîcheur d'une source : live_derived/session_snapshot → CURRENT ;
 * generated_index/static_verified → STALE si le hash live diffère du hash enregistré.
 */
export function checkSourceFreshness(
  strategy: ParrainFreshnessStrategy,
  recordedHash: string | null,
  liveHash: string | null,
): FreshnessCheck {
  if (strategy === "live_derived" || strategy === "session_snapshot") {
    return { status: "CURRENT", liveHash, recordedHash, reason: "Dérivé à la demande de la source canonique." };
  }
  if (liveHash === null) {
    return { status: "UNKNOWN", liveHash, recordedHash, reason: "Empreinte live indisponible pour cette source." };
  }
  if (recordedHash === null) {
    return { status: "STALE", liveHash, recordedHash, reason: "Index jamais généré — considéré périmé (fail-closed)." };
  }
  if (recordedHash !== liveHash) {
    return { status: "STALE", liveHash, recordedHash, reason: "La source canonique a changé depuis la génération de l'index." };
  }
  return { status: "CURRENT", liveHash, recordedHash, reason: "Empreinte identique à la source canonique." };
}

/** Rapport de fraîcheur global (utilisé par le command center + le script de vérif). */
export interface FreshnessReport {
  readonly fingerprints: CanonicalFingerprints;
  readonly staleSourceIds: readonly string[];
  readonly checkedAt: string;
}

export function buildFreshnessReport(
  checks: readonly { readonly sourceId: string; readonly check: FreshnessCheck }[],
  at: string,
): FreshnessReport {
  return Object.freeze({
    fingerprints: computeCanonicalFingerprints(),
    staleSourceIds: checks.filter((c) => c.check.status !== "CURRENT").map((c) => c.sourceId),
    checkedAt: at,
  });
}
