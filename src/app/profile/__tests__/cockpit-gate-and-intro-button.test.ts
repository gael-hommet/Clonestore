// Verrou du cockpit général /profile (employé payé + actif) + lisibilité du bouton
// « Faire une introduction ». Tests purs (machine à états) + scans de source.
// Aucun réseau, Supabase, Stripe ou donnée réelle.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("cockpit général /profile — verrou derrière un employé payé et actif", () => {
  it("seul employee_active déverrouille (réservation seule & activation en attente restent fermées)", async () => {
    const { isOperationalUnlocked } = await import("@/lib/access/operational-access");
    // employee_active = accès autorisé
    expect(isOperationalUnlocked("employee_active")).toBe(true);
    // « réservation seule » et « sans achat » se résolvent en authenticated_without_employee
    expect(isOperationalUnlocked("authenticated_without_employee")).toBe(false);
    expect(isOperationalUnlocked("payment_pending")).toBe(false);
    expect(isOperationalUnlocked("activation_pending")).toBe(false);
    expect(isOperationalUnlocked("subscription_suspended")).toBe(false);
    expect(isOperationalUnlocked("subscription_ended")).toBe(false);
  });

  it("buildGeneralCockpitLock : ouvert si actif, verrouillé sinon, jamais de boucle vers /profile", async () => {
    const { buildGeneralCockpitLock } = await import("@/lib/access/operational-access");
    expect(buildGeneralCockpitLock("employee_active")).toBeNull();

    for (const state of [
      "authenticated_without_employee",
      "payment_pending",
      "activation_pending",
      "subscription_suspended",
      "subscription_ended",
    ] as const) {
      const lock = buildGeneralCockpitLock(state);
      expect(lock).not.toBeNull();
      expect(lock!.title).toMatch(/cockpit.*pas encore actif/i);
      expect(lock!.actions.length).toBeGreaterThan(0);
      // Jamais de fausse promesse d'employé actif.
      expect(lock!.description.toLowerCase()).not.toContain("pierre est actif");
      // CTA orientés achat/activation : aucun renvoi en boucle vers /profile.
      for (const action of lock!.actions) {
        expect(action.href).not.toBe("/profile");
      }
    }
  });

  it("P9.2 : le layout /profile n'impose PLUS de verrou général (My CloneStore accessible avec session, sans employé)", () => {
    const layout = read("src/app/profile/layout.tsx");
    // La home est désormais accessible à tout compte connecté : plus de hard-lock au layout.
    expect(layout).not.toContain("buildGeneralCockpitLock");
    expect(layout).not.toContain("AccessLockScreen");
    // L'auth reste garantie par le garde client de la page (redirection /login).
    // force-dynamic conservé (pas de cache d'un espace personnel).
    expect(layout).toContain("force-dynamic");
    expect(layout).toContain("AppShell");
  });

  it("le verrou opérationnel reste appliqué là où il doit l'être (cockpit Pierre + messagerie), inchangé", () => {
    // Cockpit Pierre : verrou serveur via OperationalRouteShell gate=cockpit.
    const cockpit = read("src/app/agents/pierre/use/layout.tsx");
    expect(cockpit).toContain('gate="cockpit"');
    expect(cockpit).toContain("force-dynamic");
    const shell = read("src/components/app/OperationalRouteShell.tsx");
    expect(shell).toContain("resolveOperationalAccess");
    expect(shell).toContain("buildOperationalLock");
    expect(shell).toContain("AccessLockScreen");
    // Messagerie : verrou serveur propre, indépendant du layout /profile.
    const messages = read("src/app/profile/messages/layout.tsx");
    expect(messages).toContain("resolveOperationalAccess");
    expect(messages).toContain('buildOperationalLock(access.state, "messagerie")');
    expect(messages).toContain("AccessLockScreen");
    expect(messages).toContain("force-dynamic");
  });

  it("la décision « actif » n'est pas codée uniquement autour de Pierre", () => {
    const src = read("src/lib/access/operational-access.ts");
    // Cockpit général : n'importe quel employé IA actif.
    expect(src).toContain("hasAnyActiveEmployee");
    // La source canonique Pierre reste utilisée pour le cockpit Pierre / messagerie.
    expect(src).toContain("hasPierreAccess");
  });
});

describe("bouton « Faire une introduction » — texte blanc lisible", () => {
  const CARD = read("src/app/profile/_ui/CloneStoryCockpitCard.tsx");

  it("le CTA force un texte blanc explicite, sur un fond sombre conservé", () => {
    const idx = CARD.indexOf("Faire une introduction");
    expect(idx).toBeGreaterThan(-1);
    // La balise <Link> du bouton (avant le libellé) force la couleur blanche en inline,
    // qui bat le `a { color: inherit }` non-layeré de Tailwind v4.
    const block = CARD.slice(Math.max(0, idx - 500), idx);
    expect(block).toMatch(/color:\s*["']#ffffff["']/i);
    // Le fond sombre (graphite) est conservé.
    expect(CARD).toContain("bg-[var(--cs-graphite)]");
  });
});
