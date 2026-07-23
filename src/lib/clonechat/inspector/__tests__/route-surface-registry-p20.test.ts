// src/lib/clonechat/inspector/__tests__/route-surface-registry-p20.test.ts
// P20.1 — RouteSurfaceRegistry integrity: 0 fabricated routes, 0 duplicate ids, every P20 category
// present, and the hard distinction between "exists in product" and "observed by CloneInspector"
// is never blurred (observedByCloneInspector must be true for exactly the CLONESTORE_SURFACES set).

import { describe, it, expect } from "vitest";
import {
  ROUTE_SURFACE_REGISTRY,
  getRouteSurfaceEntry,
  crossCheckRouteSurfaceRegistry,
} from "../route-surface-registry";
import { CLONESTORE_SURFACES } from "../surface-registry";

describe("P20.1 — RouteSurfaceRegistry", () => {
  it("1. intégrité : 0 id dupliqué, 0 route malformée", () => {
    const check = crossCheckRouteSurfaceRegistry();
    expect(check.issues).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it("2. toutes les 19 catégories P20 sont présentes", () => {
    const categories = new Set(ROUTE_SURFACE_REGISTRY.map((e) => e.category));
    const expected = [
      "accueil", "pages_commerciales", "demo", "assistant", "pierre", "technologies",
      "onboarding", "empreinte", "cockpit", "missions", "documents", "fichiers",
      "historique", "support", "profil", "facturation", "pages_legales", "mobile", "pwa",
    ];
    for (const c of expected) expect(categories.has(c as never)).toBe(true);
  });

  it("3. observedByCloneInspector est vrai UNIQUEMENT pour les routes réellement dans CLONESTORE_SURFACES — jamais inventé", () => {
    const observedRoutes = new Set(CLONESTORE_SURFACES.map((s) => s.route));
    for (const e of ROUTE_SURFACE_REGISTRY) {
      if (e.observedByCloneInspector) expect(observedRoutes.has(e.route)).toBe(true);
    }
    // And conversely: every real CLONESTORE_SURFACES route that also appears in this registry must be flagged observed.
    for (const e of ROUTE_SURFACE_REGISTRY) {
      if (observedRoutes.has(e.route)) expect(e.observedByCloneInspector).toBe(true);
    }
  });

  it("4. aucune entrée ne prétend à une couverture responsive vérifiée (jamais fabriquée sans test navigateur réel)", () => {
    for (const e of ROUTE_SURFACE_REGISTRY) expect(e.responsiveVerified).toBe(false);
  });

  it("5. la catégorie pierre pointe vers /agents/pierre, le seul surface réellement observée par CloneInspector à ce jour", () => {
    const pierre = getRouteSurfaceEntry("pierre");
    expect(pierre.length).toBe(1);
    expect(pierre[0].route).toBe("/agents/pierre");
    expect(pierre[0].observedByCloneInspector).toBe(true);
  });

  it("6. les catégories sans route trouvée (fichiers, mobile) sont marquées NOT_FOUND, jamais une route devinée", () => {
    for (const cat of ["fichiers", "mobile"] as const) {
      const entries = getRouteSurfaceEntry(cat);
      expect(entries.length).toBe(1);
      expect(entries[0].route).toBe("NOT_FOUND");
    }
  });
});
