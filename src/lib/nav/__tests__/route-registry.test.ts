import { describe, it, expect } from "vitest";
import {
  ROUTE_REGISTRY,
  allDeclaredTourTargets,
  getRouteEntry,
  isConnectedSpacePath,
  primaryNavRoutes,
  routeLabel,
  routesForSpace,
} from "../route-registry";
import { PUBLIC_DISCOVERY_TOUR } from "@/lib/guided-tour";

describe("Registre de routes — cohérence", () => {
  it("aucun chemin dupliqué (prévention des doublons)", () => {
    const paths = ROUTE_REGISTRY.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("couvre les espaces produit fondamentaux", () => {
    const spaces = new Set(ROUTE_REGISTRY.map((e) => e.space));
    for (const space of [
      "public",
      "guided-discovery",
      "my-clonestore",
      "client-cockpit",
      "production-cockpit",
      "clonechat",
    ]) {
      expect(spaces.has(space as never)).toBe(true);
    }
  });

  it("expose une navigation principale non vide", () => {
    expect(primaryNavRoutes().length).toBeGreaterThan(0);
    expect(primaryNavRoutes().every((e) => e.primaryNav === true)).toBe(true);
  });

  it("getRouteEntry / routeLabel", () => {
    expect(getRouteEntry("/agents")?.label).toBe("Employés IA");
    expect(routeLabel("/agents")).toBe("Employés IA");
    expect(routeLabel("/inconnu", "Défaut")).toBe("Défaut");
  });

  it("routesForSpace filtre par espace", () => {
    expect(routesForSpace("client-cockpit").every((e) => e.space === "client-cockpit")).toBe(true);
  });

  it("ne supprime aucune route obsolète (conserve les stubs)", () => {
    const slug = getRouteEntry("/agents/[slug]");
    expect(slug?.status).toBe("stub");
  });
});

describe("Registre de routes — cohérence avec le tour public", () => {
  it("déclare les six cibles de tour de la homepage", () => {
    const declared = allDeclaredTourTargets();
    const tourTargets = PUBLIC_DISCOVERY_TOUR.steps
      .map((s) => s.targetId)
      .filter((t): t is string => !!t);
    for (const target of tourTargets) {
      expect(declared).toContain(target);
    }
  });
});

describe("Registre de routes — pont avec le contrat connecté existant", () => {
  it("s'aligne sur isConnectedRoute", () => {
    expect(isConnectedSpacePath("/profile")).toBe(true);
    expect(isConnectedSpacePath("/agents/pierre/use")).toBe(true);
    expect(isConnectedSpacePath("/")).toBe(false);
    expect(isConnectedSpacePath("/agents")).toBe(false);
  });
});
