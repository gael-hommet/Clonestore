import { describe, it, expect } from "vitest";
import { proposeAction, canExecute, requiresConfirmation } from "../action-policy";
import { permissionsFromKeys, DEFAULT_PERMISSIONS } from "@/lib/client-cockpit";

describe("CloneChat — politique d'action gouvernée", () => {
  it("risque + confirmation par type", () => {
    expect(requiresConfirmation("create_mission")).toBe(true);
    expect(requiresConfirmation("decide_validation")).toBe(true);
    expect(requiresConfirmation("cancel_mission")).toBe(true);
    expect(requiresConfirmation("open_mission")).toBe(false);
    expect(requiresConfirmation("navigate")).toBe(false);
  });

  it("mode public : seule la navigation est permise, l'opérationnel refusé honnêtement", () => {
    const nav = proposeAction({ kind: "navigate", label: "Voir la démo", mode: "public", permissions: DEFAULT_PERMISSIONS, href: "/demo/pierre" });
    expect(nav.allowed).toBe(true);
    const create = proposeAction({ kind: "create_mission", label: "Créer", mode: "public", permissions: DEFAULT_PERMISSIONS });
    expect(create.allowed).toBe(false);
    expect(create.reason).toMatch(/connectez-vous/i);
  });

  it("création mission gouvernée par permission", () => {
    const ok = proposeAction({ kind: "create_mission", label: "Créer", mode: "authenticated", permissions: permissionsFromKeys(["mission.create"]) });
    expect(ok.allowed).toBe(true);
    expect(ok.requiresConfirmation).toBe(true);
    const denied = proposeAction({ kind: "create_mission", label: "Créer", mode: "authenticated", permissions: permissionsFromKeys(["mission.read"]) });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/rôle/i);
  });

  it("décision de validation gouvernée par permission", () => {
    const denied = proposeAction({ kind: "decide_validation", label: "Approuver", mode: "authenticated", permissions: permissionsFromKeys(["mission.read"]) });
    expect(denied.allowed).toBe(false);
  });

  it("canExecute : jamais optimiste — sensible exige confirmation", () => {
    const create = proposeAction({ kind: "create_mission", label: "Créer", mode: "authenticated", permissions: DEFAULT_PERMISSIONS });
    expect(canExecute(create, false).ok).toBe(false); // pas confirmé
    expect(canExecute(create, true).ok).toBe(true);   // confirmé
    const open = proposeAction({ kind: "open_mission", label: "Ouvrir", mode: "authenticated", permissions: DEFAULT_PERMISSIONS });
    expect(canExecute(open, false).ok).toBe(true);     // low risk, pas de confirmation
  });

  it("canExecute refuse une action non autorisée même confirmée", () => {
    const denied = proposeAction({ kind: "create_mission", label: "Créer", mode: "authenticated", permissions: permissionsFromKeys(["mission.read"]) });
    expect(canExecute(denied, true).ok).toBe(false);
  });
});
