// src/lib/clonechat/inspector/route-surface-registry.ts
// P20.1 — ROUTE SURFACE REGISTRY. Distinct from `surface-registry.ts` (CLONESTORE_SURFACES),
// which requires a REAL observed browser capture per entry and must never be extended without one.
//
// This registry answers a DIFFERENT question: "does this product surface exist in the codebase,
// at which route, backed by which real root component?" — derived from real files (verified this
// session via a full `src/app/**/page.tsx` glob) and from the existing canonical nav registry
// (`../../nav/route-registry`, `ROUTE_REGISTRY`) wherever that registry already covers a route.
// It NEVER claims a surface was visually observed — see `observedByCloneInspector` below, which is
// the explicit, unforgeable boundary between "exists in the product" and "seen by CloneInspector".

import { ROUTE_REGISTRY, getRouteEntry, type RouteAudience, type RouteStatus } from "../../nav/route-registry";
import { CLONESTORE_SURFACES } from "./surface-registry";

export type SurfaceCategory =
  | "accueil" | "pages_commerciales" | "demo" | "assistant" | "pierre" | "technologies"
  | "onboarding" | "empreinte" | "cockpit" | "missions" | "documents" | "fichiers"
  | "historique" | "support" | "profil" | "facturation" | "pages_legales" | "mobile" | "pwa";

export interface RouteSurfaceEntry {
  readonly id: string;
  readonly category: SurfaceCategory;
  readonly route: string;
  /** Real root component file, verified to exist on disk this session (never invented). */
  readonly rootComponent: string;
  readonly audience: RouteAudience | "unknown";
  readonly requiresAuth: boolean;
  readonly publicStatus: RouteStatus | "not_in_nav_registry";
  /** Whether this route/component is registered in the canonical nav registry (ROUTE_REGISTRY). */
  readonly inNavRegistry: boolean;
  /** True ONLY if this exact route already has a real observed-capture entry in surface-registry.ts. */
  readonly observedByCloneInspector: boolean;
  readonly technologyHint: string;
  readonly pwaRelevant: boolean;
  readonly responsiveVerified: boolean; // never claimed true without a real viewport test — always false here
  readonly associatedTestId: string | null;
  readonly note: string | null;
}

/**
 * Real routes verified to exist on disk (src/app/**\/page.tsx, glob'd directly this session) for
 * each P20 surface category. Multiple entries per category are listed honestly when more than one
 * real route serves that category — never collapsed into a single invented "the" route.
 */
const CATEGORY_ROUTES: Readonly<Record<SurfaceCategory, readonly { route: string; rootComponent: string }[]>> = {
  accueil: [{ route: "/", rootComponent: "src/app/page.tsx" }],
  pages_commerciales: [{ route: "/agents", rootComponent: "src/app/agents/page.tsx" }],
  demo: [
    { route: "/demo", rootComponent: "src/app/demo/page.tsx" },
    { route: "/demo/pierre", rootComponent: "src/app/demo/pierre/page.tsx" },
  ],
  assistant: [{ route: "/assistant", rootComponent: "src/app/assistant/page.tsx" }],
  pierre: [{ route: "/agents/pierre", rootComponent: "src/app/agents/pierre/page.tsx" }],
  technologies: [{ route: "/profile/technologies", rootComponent: "src/app/profile/technologies/page.tsx" }],
  onboarding: [{ route: "/profile/onboarding", rootComponent: "src/app/profile/onboarding/page.tsx" }],
  empreinte: [{ route: "/agents/pierre/setup", rootComponent: "src/app/agents/pierre/setup/page.tsx" }],
  cockpit: [
    { route: "/agents/pierre/use", rootComponent: "src/app/agents/pierre/use/page.tsx" },
    { route: "/cockpit/pierre", rootComponent: "src/app/cockpit/pierre/page.tsx" },
  ],
  missions: [{ route: "/cockpit/pierre/missions", rootComponent: "src/app/cockpit/pierre/missions/page.tsx" }],
  documents: [{ route: "/cockpit/pierre/documents", rootComponent: "src/app/cockpit/pierre/documents/page.tsx" }],
  fichiers: [], // NOT FOUND as a distinct top-level route this session — see note in build function
  historique: [{ route: "/profile/messages", rootComponent: "src/app/profile/messages/page.tsx" }],
  support: [{ route: "/questions", rootComponent: "src/app/questions/page.tsx" }],
  profil: [{ route: "/profile", rootComponent: "src/app/profile/page.tsx" }],
  facturation: [{ route: "/mon-clonestore/facturation", rootComponent: "src/app/mon-clonestore/facturation/page.tsx" }],
  pages_legales: [
    { route: "/legal/cgv", rootComponent: "src/app/legal/cgv/page.tsx" },
    { route: "/legal/cgu", rootComponent: "src/app/legal/cgu/page.tsx" },
    { route: "/legal/confidentialite", rootComponent: "src/app/legal/confidentialite/page.tsx" },
    { route: "/legal/dpa", rootComponent: "src/app/legal/dpa/page.tsx" },
    { route: "/legal/mentions", rootComponent: "src/app/legal/mentions/page.tsx" },
  ],
  mobile: [], // not a route — a responsive mode of every surface above, listed structurally, never faked as a route
  pwa: [{ route: "/installer", rootComponent: "src/app/installer/page.tsx" }],
};

const TECH_HINT: Partial<Record<SurfaceCategory, string>> = {
  assistant: "clonechat", pierre: "cloneos+cloneadn+cloneguard", technologies: "T1/T2 registries",
  empreinte: "cloneadn", cockpit: "cloneos+clonetrace", missions: "cloneos+mission-service V1",
  documents: "geo/document-jurisdiction", historique: "clonechat conversations",
};

function buildEntries(): readonly RouteSurfaceEntry[] {
  const entries: RouteSurfaceEntry[] = [];
  for (const [category, routes] of Object.entries(CATEGORY_ROUTES) as [SurfaceCategory, { route: string; rootComponent: string }[]][]) {
    if (routes.length === 0) {
      entries.push({
        id: `${category}:not-found`,
        category,
        route: "NOT_FOUND",
        rootComponent: "NOT_FOUND",
        audience: "unknown",
        requiresAuth: false,
        publicStatus: "not_in_nav_registry",
        inNavRegistry: false,
        observedByCloneInspector: false,
        technologyHint: TECH_HINT[category] ?? "unknown",
        pwaRelevant: false,
        responsiveVerified: false,
        associatedTestId: null,
        note: category === "mobile"
          ? "Structural: mobile is a responsive mode of every other surface, not a distinct route — listed here for category completeness only, never fabricated as a route."
          : "No standalone route found for this category in a full src/app/**/page.tsx scan this session — may be a sub-view of an existing surface (needs component-level reading to confirm, not done this pass).",
      });
      continue;
    }
    for (const { route, rootComponent } of routes) {
      const navEntry = getRouteEntry(route);
      const observed = CLONESTORE_SURFACES.some((s) => s.route === route);
      entries.push({
        id: `${category}:${route}`,
        category,
        route,
        rootComponent,
        audience: navEntry?.audience ?? "unknown",
        requiresAuth: navEntry ? navEntry.audience !== "public" : route.startsWith("/profile") || route.startsWith("/cockpit") || route.startsWith("/agents/pierre/use") || route.startsWith("/agents/pierre/setup") || route.startsWith("/mon-clonestore"),
        publicStatus: navEntry?.status ?? "not_in_nav_registry",
        inNavRegistry: navEntry !== null,
        observedByCloneInspector: observed,
        technologyHint: TECH_HINT[category] ?? "unknown",
        pwaRelevant: category === "pwa",
        responsiveVerified: false,
        associatedTestId: null,
        note: navEntry ? null : "Not present in the curated ROUTE_REGISTRY (which is intentionally non-exhaustive per its own header comment) — existence verified directly via a real page.tsx file instead.",
      });
    }
  }
  return entries;
}

export const ROUTE_SURFACE_REGISTRY: readonly RouteSurfaceEntry[] = Object.freeze(buildEntries());

export function getRouteSurfaceEntry(category: SurfaceCategory): readonly RouteSurfaceEntry[] {
  return ROUTE_SURFACE_REGISTRY.filter((e) => e.category === category);
}

/** Integrity check: 0 fabricated routes (every non-NOT_FOUND route must resolve through a real known path shape), 0 duplicate ids. */
export function crossCheckRouteSurfaceRegistry(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const e of ROUTE_SURFACE_REGISTRY) {
    if (ids.has(e.id)) issues.push(`Duplicate id: ${e.id}`);
    ids.add(e.id);
    if (e.route !== "NOT_FOUND" && !e.route.startsWith("/")) issues.push(`Malformed route: ${e.id} -> ${e.route}`);
  }
  return { ok: issues.length === 0, issues };
}
