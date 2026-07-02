import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");

describe("Auth boundary (Étape 1)", () => {
  const layout = read("src/app/profile/layout.tsx");
  const home = read("src/app/profile/page.tsx");
  const onboarding = read("src/app/profile/onboarding/page.tsx");
  const technologies = read("src/app/profile/technologies/page.tsx");

  it("le layout exige une session, PAS un employé actif (verrou général retiré)", () => {
    expect(layout).toContain("<AppShell>{children}</AppShell>");
    expect(layout).not.toContain("resolveOperationalAccess");
    expect(layout).not.toContain("buildGeneralCockpitLock");
  });

  it("toutes les routes /profile ciblées ont un garde client (redirection anonyme)", () => {
    expect(home).toContain("useRequireAuth()");
    expect(onboarding).toContain("useRequireAuth()");
    expect(technologies).toContain("useRequireAuth()");
  });
});

describe("Home My CloneStore — données réelles, pas de mock", () => {
  const home = read("src/app/profile/page.tsx");

  it("branche les données réelles (session + orders + profiles + catalogue)", () => {
    expect(home).toContain("getSessionClient");
    expect(home).toContain('.from("orders")');
    expect(home).toContain('.from("profiles")');
    expect(home).toContain("PIERRE_PUBLIC");
  });

  it("utilise les machines pures P9.2 (accès cockpit + prochaine action + possession)", () => {
    expect(home).toContain("resolveCockpitAccess");
    expect(home).toContain("resolveNextAction");
    expect(home).toContain("summarizeOwnedEmployee");
  });

  it("couvre les états (loading, erreur, session expirée) et les blocs", () => {
    expect(home).toContain('"loading"');
    expect(home).toContain('"error"');
    expect(home).toContain('"unauthenticated"');
    for (const block of ["Démarrage", "Mes employés IA", "Mon entreprise", "Compte"]) {
      expect(home).toContain(block);
    }
  });

  it("ne présente aucune donnée fictive (pas de demo/fake/mock dans la home)", () => {
    expect(home).not.toMatch(/\bdemo[_-]?data\b/i);
    expect(home).not.toMatch(/\bmock\b/i);
    expect(home).not.toMatch(/\bfake\b/i);
  });
});
