import { describe, it, expect } from "vitest";
import {
  APP_NAV_GROUPS,
  isNavItemActive,
  resolveAppNavGroups,
} from "../app-shell-nav";
import { getRouteEntry, ROUTE_REGISTRY } from "../route-registry";

describe("AppShell nav — dérivée du registre de routes", () => {
  it("chaque path déclaré dans la nav EXISTE dans le registre (aucune route inventée)", () => {
    for (const group of APP_NAV_GROUPS) {
      for (const item of group.items) {
        expect(getRouteEntry(item.path), `path nav absent du registre: ${item.path}`).not.toBeNull();
      }
    }
  });

  it("les labels proviennent du registre quand aucun override n'est fourni", () => {
    const groups = resolveAppNavGroups();
    const onboarding = groups
      .flatMap((g) => g.items)
      .find((i) => i.path === "/profile/onboarding");
    expect(onboarding?.label).toBe(getRouteEntry("/profile/onboarding")?.label);
    expect(onboarding?.label).toBe("Empreinte Entreprise");
  });

  it("un override contextuel prime sur le label canonique (ex. /agents → Boutique)", () => {
    const groups = resolveAppNavGroups();
    const agents = groups.flatMap((g) => g.items).find((i) => i.path === "/agents");
    // Registre = « Employés IA », nav connectée = « Boutique ».
    expect(getRouteEntry("/agents")?.label).toBe("Employés IA");
    expect(agents?.label).toBe("Boutique");

    const profile = groups.flatMap((g) => g.items).find((i) => i.path === "/profile");
    expect(getRouteEntry("/profile")?.label).toBe("Mon CloneStore");
    expect(profile?.label).toBe("Vue générale");
  });

  it("préserve l'ordre et les titres de groupes", () => {
    const groups = resolveAppNavGroups();
    expect(groups.map((g) => g.title)).toEqual([
      "Organisation",
      "Opérations",
      "Configuration",
      "Compte",
    ]);
  });

  it("écarte proprement un path inconnu du registre (garde-fou de résolution)", () => {
    // Simulation : un item pointant vers une route absente ne doit pas remonter.
    const resolved = resolveAppNavGroups();
    const allPaths = resolved.flatMap((g) => g.items.map((i) => i.path));
    for (const p of allPaths) {
      expect(ROUTE_REGISTRY.some((e) => e.path === p)).toBe(true);
    }
  });

  it("isNavItemActive : exact pour /profile, préfixe sinon", () => {
    expect(isNavItemActive("/profile", "/profile")).toBe(true);
    expect(isNavItemActive("/profile/onboarding", "/profile")).toBe(false); // exact only
    expect(isNavItemActive("/profile/onboarding", "/profile/onboarding")).toBe(true);
    expect(isNavItemActive("/agents/pierre/use/x", "/agents/pierre/use")).toBe(true);
    expect(isNavItemActive("/agents/pierre/setup", "/agents/pierre/use")).toBe(false);
  });
});
