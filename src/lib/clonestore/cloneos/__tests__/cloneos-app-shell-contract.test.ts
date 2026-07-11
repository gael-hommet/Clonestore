// src/lib/clonestore/cloneos/__tests__/cloneos-app-shell-contract.test.ts
// P12 §13.1-13.3 — le contrat d'app shell distingue les zones, interdit les confusions produit,
// et encode le contrat de routage/redirection (sans affaiblir l'auth).
import { describe, it, expect } from "vitest";
import {
  APP_AREAS, CLONEOS_ROUTES, SHELL_SURFACES, RESPONSIVE_MODES, FORBIDDEN_CONFUSIONS, COPY_RULES,
  CLONEROOM_PARTICIPANTS, CLONEOS_SUGGESTED_COMMANDS, resolveLandingRoute, areaForRoute,
  isCockpitSurfaceRoute, contractComplete,
} from "../cloneos-app-shell-contract";

describe("P12 CloneOS app-shell contract", () => {
  it("1. distinguishes the 5 areas (public / Mon CloneStore / Global Cockpit / Pierre Cockpit / CloneRoom)", () => {
    expect(contractComplete()).toBe(true);
    const ids = APP_AREAS.map((a) => a.id).sort();
    expect(ids).toEqual(["cloneroom", "employee_cockpit", "global_cockpit", "mon_clonestore", "public_site"]);
    // distinct routes
    expect(new Set(APP_AREAS.map((a) => a.route)).size).toBe(5);
    expect(CLONEOS_ROUTES.cockpit).toBe("/cockpit");
    expect(CLONEOS_ROUTES.pierre).toBe("/cockpit/pierre");
    expect(CLONEOS_ROUTES.cloneRoom).toBe("/cockpit/room");
    expect(CLONEOS_ROUTES.monClonestore).toBe("/mon-clonestore");
  });

  it("2. no product confusion (CloneOS≠Pierre, CloneRoom≠Cockpit, Mon CloneStore≠Cockpit, Pierre≠assistant)", () => {
    const blob = FORBIDDEN_CONFUSIONS.join(" ").toLowerCase();
    expect(blob).toContain("cloneos n'est pas pierre");
    expect(blob).toContain("2e cerveau rh");
    expect(blob).toContain("cloneroom n'est pas le global cockpit");
    expect(blob).toContain("mon clonestore n'est pas le cockpit");
    expect(blob).toContain("global cockpit n'est pas le cockpit de pierre");
    expect(blob).toMatch(/pierre n'est pas un assistant/);
    // copy rules encode Pierre framing + forbidden terms
    expect(COPY_RULES.pierreFraming).toContain("employé IA RH");
    for (const bad of ["assistant", "chatbot", "copilote"]) expect(COPY_RULES.pierreForbidden).toContain(bad);
    // CloneOS framing is coordinate/route, never executes HR
    expect(COPY_RULES.cloneosForbidden.join(" ").toLowerCase()).toContain("exécute le rh");
  });

  it("3. routing/redirect contract (visitor→public, non-client→purchase, incomplete→setup, ready→cockpit)", () => {
    expect(resolveLandingRoute({ connected: false, isClient: false, onboardingComplete: false })).toEqual({ kind: "public", route: "/" });
    expect(resolveLandingRoute({ connected: true, isClient: false, onboardingComplete: false })).toEqual({ kind: "purchase", route: "/agents/pierre" });
    expect(resolveLandingRoute({ connected: true, isClient: true, onboardingComplete: false })).toEqual({ kind: "setup", route: "/mon-clonestore/setup" });
    expect(resolveLandingRoute({ connected: true, isClient: true, onboardingComplete: true })).toEqual({ kind: "cockpit", route: "/cockpit" });
    // E: a connected ready client is NEVER sent back to the public marketing site
    expect(resolveLandingRoute({ connected: true, isClient: true, onboardingComplete: true }).route).not.toBe("/");
  });

  it("areaForRoute resolves the most specific area; cockpit surfaces are flagged", () => {
    expect(areaForRoute("/cockpit")?.id).toBe("global_cockpit");
    expect(areaForRoute("/cockpit/pierre")?.id).toBe("employee_cockpit");
    expect(areaForRoute("/cockpit/pierre/missions")?.id).toBe("employee_cockpit");
    expect(areaForRoute("/cockpit/room")?.id).toBe("cloneroom");
    expect(areaForRoute("/mon-clonestore")?.id).toBe("mon_clonestore");
    expect(areaForRoute("/")?.id).toBe("public_site");
    // no-page-scroll invariant applies to cockpit surfaces, not to public / mon-clonestore
    expect(isCockpitSurfaceRoute("/cockpit")).toBe(true);
    expect(isCockpitSurfaceRoute("/cockpit/pierre")).toBe(true);
    expect(isCockpitSurfaceRoute("/cockpit/room")).toBe(true);
    expect(isCockpitSurfaceRoute("/mon-clonestore")).toBe(false);
    expect(isCockpitSurfaceRoute("/")).toBe(false);
  });

  it("shell surfaces + responsive modes are defined (top bar / rail / bottom nav / main / context)", () => {
    const surfaceIds = SHELL_SURFACES.map((s) => s.id).sort();
    expect(surfaceIds).toEqual(["bottom_nav", "context_pane", "left_rail", "main_work", "top_bar"]);
    // mobile has bottom nav (not left rail); desktop has left rail + context pane
    expect(SHELL_SURFACES.find((s) => s.id === "bottom_nav")?.mobile).toBe(true);
    expect(SHELL_SURFACES.find((s) => s.id === "bottom_nav")?.desktop).toBe(false);
    expect(SHELL_SURFACES.find((s) => s.id === "left_rail")?.mobile).toBe(false);
    expect(SHELL_SURFACES.find((s) => s.id === "context_pane")?.desktop).toBe(true);
    expect(RESPONSIVE_MODES.map((m) => m.id)).toEqual(["mobile", "tablet", "laptop", "large"]);
    expect(RESPONSIVE_MODES.find((m) => m.id === "mobile")?.minWidth).toBe(0);
  });

  it("5. CloneRoom participants include CloneOS + Pierre + Empreinte Entreprise conceptually", () => {
    const kinds = CLONEROOM_PARTICIPANTS.map((p) => p.kind);
    expect(kinds).toContain("cloneos");
    expect(kinds).toContain("employee_ai");
    expect(kinds).toContain("footprint");
    expect(kinds).toContain("company_memory");
    expect(CLONEROOM_PARTICIPANTS.find((p) => p.kind === "employee_ai")?.label.toLowerCase()).toContain("rh");
  });

  it("CloneOS suggested commands route/coordinate (open Pierre, validations, CloneRoom) — never claim HR execution", () => {
    const blob = CLONEOS_SUGGESTED_COMMANDS.join(" ").toLowerCase();
    expect(blob).toContain("ouvre pierre");
    expect(blob).toContain("validations");
    expect(blob).toContain("cloneroom");
    // none of the suggested commands claims CloneOS itself performs HR logic
    expect(CLONEOS_SUGGESTED_COMMANDS.every((c) => !/cloneos (exécute|traite) le rh/i.test(c))).toBe(true);
  });
});
