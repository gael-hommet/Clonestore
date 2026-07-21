// src/lib/clonechat/links/__tests__/safe-links.test.ts
// C1.8 FINAL §7/§15 — Liens cliquables, et hostiles rendus inoffensifs.

import { describe, it, expect } from "vitest";
import { parseSafeLinks, validatedLinks, isDangerousHref, isKnownInternalRoute } from "../safe-links";

const kinds = (t: string) => parseSafeLinks(t).map((s) => s.kind);
const internals = (t: string) => parseSafeLinks(t).filter((s) => s.kind === "internal");

describe("C1.8 FINAL — une route CloneStore devient un VRAI lien", () => {
  it("la réponse exacte qui échouait devient cliquable", () => {
    // Texte RÉELLEMENT renvoyé par le produit avant correction.
    const t = "Les pages clés : /demo (démo), /agents/pierre (produit), /reserver/pierre (réservation).";
    const links = internals(t);
    expect(links.map((l) => l.href)).toEqual(expect.arrayContaining(["/demo", "/agents/pierre", "/reserver/pierre"]));
    expect(links.every((l) => l.label.length > 0)).toBe(true);
  });

  it("une adresse nue reçoit un LIBELLÉ HUMAIN (jamais l'URL brute affichée)", () => {
    const [seg] = internals("Réservez ici : /reserver/pierre");
    expect(seg.label).not.toBe("/reserver/pierre");   // §7 : libellé humain visible
    expect(seg.label.length).toBeGreaterThan(3);
    expect(seg.href).toBe("/reserver/pierre");        // …et le href reste EXACT
  });

  it("un lien markdown affiche son LIBELLÉ humain et pointe la bonne route", () => {
    const [seg] = internals("Voir [Réserver Pierre](/reserver/pierre) dès maintenant.");
    expect(seg).toMatchObject({ kind: "internal", href: "/reserver/pierre", label: "Réserver Pierre" });
  });

  it("le libellé affiché et le href RÉEL concordent", () => {
    for (const s of internals("Allez sur /agents/pierre/use pour utiliser Pierre.")) {
      expect(isKnownInternalRoute(s.href)).toBe(true);
    }
  });
});

describe("C1.8 FINAL REAL-BROWSER CLOSURE — les pages légales sont de VRAIES routes cliquables", () => {
  // Défaut trouvé par la campagne navigateur 65 flux (groupe B) : ces 6 pages existent réellement
  // (page.tsx présent, destination-registry.ts les listait déjà via un allowlist parallèle
  // `REAL_UNREGISTERED_ROUTES`) mais étaient ABSENTES du registre canonique `route-registry.ts` —
  // la seule source que `isKnownInternalRoute` consulte. Une mention de route restait donc du texte
  // inerte : « Les mentions légales sont sur la page /legal/mentions » sans lien cliquable. Cause
  // systémique corrigée en enregistrant les 6 routes dans le registre canonique (pas un correctif
  // par message).
  it.each([
    "/legal/cgv", "/legal/cgu", "/legal/confidentialite", "/legal/dpa", "/legal/mentions",
    "/comprendre-clonestore",
  ])("%s est une route interne connue et devient un lien cliquable", (route) => {
    expect(isKnownInternalRoute(route)).toBe(true);
    const [seg] = internals(`Rendez-vous sur ${route} pour en savoir plus.`);
    expect(seg).toBeDefined();
    expect(seg.href).toBe(route);
    expect(seg.label).not.toBe(route);
  });
});

describe("C1.8 FINAL — on ne fabrique JAMAIS un lien mort", () => {
  it("une route INVENTÉE par le modèle reste du texte", () => {
    const t = "Rendez-vous sur /cette-page-nexiste-pas pour continuer.";
    expect(kinds(t)).not.toContain("internal");
    expect(parseSafeLinks(t).map((s) => (s.kind === "text" ? s.text : "")).join("")).toContain("/cette-page-nexiste-pas");
  });

  it("un lien markdown vers une route inventée garde le libellé, sans lien", () => {
    const segs = parseSafeLinks("Cliquez sur [Espace secret](/admin-secret-nexiste-pas).");
    expect(segs.some((s) => s.kind === "internal")).toBe(false);
  });
});

describe("C1.8 §15 — liens hostiles : jamais exécutables", () => {
  it("javascript:, data:, vbscript: ne deviennent JAMAIS des liens", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html;base64,PHN2Zz4=", "vbscript:msgbox"]) {
      expect(isDangerousHref(bad)).toBe(true);
      const segs = parseSafeLinks(`Cliquez ici : [Gagnez](${bad})`);
      // LA propriété qui compte : AUCUN lien n'est fabriqué. Ce qui reste est du texte inerte —
      // React l'échappe, il n'est ni cliquable ni exécutable. (Vérifier l'absence de la chaîne
      // « alert » serait une fausse exigence : un texte qui contient « alert » est inoffensif.)
      expect(segs.every((s) => s.kind === "text")).toBe(true);
      expect(segs.some((s) => s.kind === "internal" || s.kind === "external")).toBe(false);
    }
  });

  it("un domaine externe non autorisé reste du texte", () => {
    expect(kinds("Voir https://evil.example.com/piege")).not.toContain("external");
  });

  it("un domaine externe autorisé devient un lien sûr", () => {
    const segs = parseSafeLinks("Voir https://clonestore.pro/demo");
    expect(segs.some((s) => s.kind === "external")).toBe(true);
  });

  it("aucun HTML ne peut être injecté : la sortie est de la DONNÉE, jamais du balisage", () => {
    const segs = parseSafeLinks('<img src=x onerror="alert(1)"> et <script>alert(2)</script>');
    // Tout est du texte : React l'échappera. Aucun segment « lien » n'a été fabriqué.
    expect(segs.every((s) => s.kind === "text")).toBe(true);
  });
});

describe("C1.8 FINAL — cartes de liens renvoyées par la route", () => {
  it("les routes du registre sont conservées, les autres écartées", () => {
    const out = validatedLinks([
      { route: "/reserver/pierre", label: "Réserver Pierre" },
      { route: "/route-inventee", label: "Piège" },
      { route: "javascript:alert(1)", label: "Hostile" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ href: "/reserver/pierre", label: "Réserver Pierre", internal: true });
  });

  it("un lien sans libellé reçoit le libellé HUMAIN du registre (jamais l'URL nue)", () => {
    const [l] = validatedLinks([{ route: "/reserver/pierre" }]);
    expect(l.label).not.toBe("");
    expect(l.label).not.toBe("/reserver/pierre");
  });

  it("aucun doublon", () => {
    expect(validatedLinks([{ route: "/demo" }, { route: "/demo" }])).toHaveLength(1);
  });
});
