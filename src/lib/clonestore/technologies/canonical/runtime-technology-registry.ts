// src/lib/clonestore/technologies/canonical/runtime-technology-registry.ts
// P19 — THE SINGLE CANONICAL RUNTIME TECHNOLOGY REGISTRY. Before P19 five divergent lists (T1 15, T2 14,
// global-config 13, Bloc-18 12, B46 6) each claimed to describe "the technologies". This module is the ONE
// source: it COMPOSES the real T1 capability registry (low-level internal capabilities) and the real T2
// product-technology registry (the 14 CloneXxx product technologies) into a single per-technology view with
// an honest provider state + readiness. The legacy lists become PROJECTIONS of this — never competing truths.
// It does NOT re-declare technologies; it reads the real registries. Pure.

import { buildProductTechnologyRegistry } from "../../product-technologies/t2/product-technology-registry";
import { buildTechnologyRegistry } from "../t1/technology-registry";
import type { ProductTechnologyId } from "../../product-technologies/t2/product-technology-types";

export type CanonicalProviderState =
  | "LOCAL_REAL"                 // runs fully locally, no external provider
  | "FAKE_DETERMINISTIC"        // deterministic local stand-in for a future provider
  | "PROVIDER_READY_DISABLED"   // real adapter exists, disabled/fail-closed by default
  | "ARCHITECTURE_ONLY";        // contract declared, runtime advisory only

export type CanonicalReadiness = "operational" | "operational_local" | "provider_disabled" | "architecture_only";

export type CanonicalTechnologyEntry = {
  readonly id: ProductTechnologyId;
  readonly definition: string;
  readonly responsibility: string;
  readonly dependencies: readonly ProductTechnologyId[];
  readonly t1Capabilities: readonly string[];        // low-level T1 capabilities consumed
  readonly providerState: CanonicalProviderState;
  readonly readiness: CanonicalReadiness;
  readonly claimableNow: string;
  readonly mustNotClaim: readonly string[];
  readonly canonicalModule: string | null;           // the P19 canonical composition module, if any
  readonly version: string;
};

// Per-technology provider state + the P19 canonical module that now backs it (honest, from this session).
const CANONICAL_OVERLAY: Record<ProductTechnologyId, { providerState: CanonicalProviderState; canonicalModule: string | null }> = {
  cloneos:        { providerState: "LOCAL_REAL", canonicalModule: "src/lib/clonestore/cloneos/canonical/cloneos-orchestrator.ts" },
  cloneadn:       { providerState: "LOCAL_REAL", canonicalModule: "src/lib/clonestore/cloneadn/canonical/canonical-adn.ts" },
  cloneguard:     { providerState: "LOCAL_REAL", canonicalModule: "src/lib/pierre/v1/governance/canonical-decision.ts" },
  clonetrace:     { providerState: "LOCAL_REAL", canonicalModule: "src/lib/pierre/v1/trace/canonical-event.ts" },
  clonevoice:     { providerState: "PROVIDER_READY_DISABLED", canonicalModule: null },
  clonepolicy:    { providerState: "LOCAL_REAL", canonicalModule: "src/lib/pierre/v1/governance/canonical-decision.ts" },
  clonecontinuum: { providerState: "LOCAL_REAL", canonicalModule: "src/lib/pierre/v1/runtime-scheduler.ts" },
  clonetrust:     { providerState: "LOCAL_REAL", canonicalModule: "src/lib/pierre/v1/governance/canonical-decision.ts" },
  clonereview:    { providerState: "LOCAL_REAL", canonicalModule: "src/lib/clonestore/clonereview/canonical/review.ts" },
  clonesignals:   { providerState: "LOCAL_REAL", canonicalModule: "src/lib/pierre/v1/runtime-scheduler.ts" },
  clonelearn:     { providerState: "LOCAL_REAL", canonicalModule: "src/lib/clonestore/clonelearn/canonical/learning-loop.ts" },
  clonebrief:     { providerState: "LOCAL_REAL", canonicalModule: "src/lib/clonestore/clonebrief/canonical/brief.ts" },
  clonecall:      { providerState: "PROVIDER_READY_DISABLED", canonicalModule: null },
  cloneroom:      { providerState: "ARCHITECTURE_ONLY", canonicalModule: null },
};

function readinessFor(state: CanonicalProviderState): CanonicalReadiness {
  switch (state) {
    case "LOCAL_REAL": return "operational_local";
    case "PROVIDER_READY_DISABLED": return "provider_disabled";
    case "FAKE_DETERMINISTIC": return "operational_local";
    case "ARCHITECTURE_ONLY": return "architecture_only";
  }
}

/** Build the single canonical technology registry (14 product technologies over the T1 capability set). Pure. */
export function buildCanonicalTechnologyRegistry(): readonly CanonicalTechnologyEntry[] {
  const t2 = buildProductTechnologyRegistry();
  const t1Ids = new Set<string>(buildTechnologyRegistry().map((e) => e.id));

  return t2.map((entry) => {
    const overlay = CANONICAL_OVERLAY[entry.id];
    // Only keep T1 capabilities that genuinely exist in the T1 registry (projection integrity).
    const t1Capabilities = entry.t1TechnologiesConsumed.filter((c) => t1Ids.has(c));
    return {
      id: entry.id,
      definition: entry.definition,
      responsibility: entry.role,
      dependencies: entry.dependencies,
      t1Capabilities,
      providerState: overlay.providerState,
      readiness: readinessFor(overlay.providerState),
      claimableNow: entry.claimableNow,
      mustNotClaim: entry.mustNotClaim,
      canonicalModule: overlay.canonicalModule,
      version: "p19-canonical-1",
    };
  });
}

export function getCanonicalTechnology(id: string): CanonicalTechnologyEntry | undefined {
  return buildCanonicalTechnologyRegistry().find((e) => e.id === id);
}

/** Cross-check that this canonical registry is complete + consistent (single source of truth). Pure. */
export function crossCheckCanonicalRegistry(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const reg = buildCanonicalTechnologyRegistry();
  if (reg.length !== 14) issues.push(`Registre canonique: ${reg.length} technologies produit au lieu de 14.`);
  const t1Ids = new Set<string>(buildTechnologyRegistry().map((e) => e.id));
  if (t1Ids.size !== 15) issues.push(`Registre T1: ${t1Ids.size} capacités au lieu de 15.`);
  for (const e of reg) {
    if (!e.definition || !e.responsibility) issues.push(`${e.id}: définition/responsabilité manquante.`);
    for (const c of e.t1Capabilities) if (!t1Ids.has(c)) issues.push(`${e.id}: capacité T1 inconnue « ${c} ».`);
  }
  return { ok: issues.length === 0, issues };
}
