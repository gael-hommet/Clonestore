import { describe, it, expect } from "vitest";
import {
  PUBLIC_DISCOVERY_TOUR,
  PUBLIC_DISCOVERY_TOUR_ID,
  PUBLIC_DISCOVERY_WELCOME,
} from "../registry/public-discovery-tour";
import { getTour, hasTour, listTours } from "../tour-registry";

// Interdit les emojis dans la copy (règle Étape 6).
const EMOJI = /\p{Extended_Pictographic}/u;

describe("Tour public de découverte (multi-page)", () => {
  it("est enregistré et récupérable par id", () => {
    expect(hasTour(PUBLIC_DISCOVERY_TOUR_ID)).toBe(true);
    expect(getTour(PUBLIC_DISCOVERY_TOUR_ID)).toBe(PUBLIC_DISCOVERY_TOUR);
    expect(listTours().length).toBeGreaterThanOrEqual(1);
  });

  it("couvre les six étapes fondamentales + une étape finale d'action", () => {
    const ids = PUBLIC_DISCOVERY_TOUR.steps.map((s) => s.id);
    expect(ids).toEqual([
      "clonestore",
      "boutique",
      "pierre",
      "clonechat",
      "demo",
      "my-clonestore",
      "next",
    ]);
  });

  it("cible les data-tour-id fondamentaux, dans l'ordre du récit", () => {
    const targets = PUBLIC_DISCOVERY_TOUR.steps.map((s) => s.targetId);
    expect(targets).toEqual([
      "homepage-primary",
      "boutique-entry",
      "pierre-page-entry",
      "clonechat-entry",
      "demo-entry",
      "client-space-entry",
      null, // étape finale centrée
    ]);
  });

  it("TRAVERSE réellement plusieurs pages (routes distinctes)", () => {
    const routes = PUBLIC_DISCOVERY_TOUR.steps.map((s) => s.route);
    expect(routes).toEqual([
      "/",
      "/agents",
      "/agents/pierre",
      "/assistant",
      "/demo/pierre",
      "/login",
      "/",
    ]);
    const distinct = new Set(routes.filter(Boolean));
    // Au moins 5 routes distinctes réellement traversées.
    expect(distinct.size).toBeGreaterThanOrEqual(5);
  });

  it("n'ouvre aucun espace authentifié (routes 100% publiques)", () => {
    const AUTH_PREFIXES = ["/profile", "/agents/pierre/use", "/agents/pierre/setup", "/agents/pierre/employees"];
    for (const step of PUBLIC_DISCOVERY_TOUR.steps) {
      const route = step.route ?? "/";
      expect(AUTH_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`))).toBe(false);
    }
  });

  it("est versionné (v2) pour invalider l'ancienne progression single-page", () => {
    expect(PUBLIC_DISCOVERY_TOUR.version).toBeGreaterThanOrEqual(2);
  });

  it("étape finale : non bloquante, propose boutique/démo/continuer", () => {
    const last = PUBLIC_DISCOVERY_TOUR.steps[PUBLIC_DISCOVERY_TOUR.steps.length - 1];
    expect(last.targetId).toBeNull();
    expect(last.placement).toBe("center");
    expect(last.route).toBe("/"); // retour homepage
    const behaviors = (last.actions ?? []).map((a) => a.behavior);
    expect(behaviors).toContain("navigate");
    expect(behaviors).toContain("finish");
    const hrefs = (last.actions ?? []).map((a) => a.href).filter(Boolean);
    expect(hrefs).toContain("/agents");
    expect(hrefs).toContain("/demo/pierre");
  });

  it("copy sans emoji, titres et corps non vides", () => {
    for (const step of PUBLIC_DISCOVERY_TOUR.steps) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(0);
      expect(EMOJI.test(step.title)).toBe(false);
      expect(EMOJI.test(step.body)).toBe(false);
    }
  });

  it("invitation de bienvenue : courte, sans emoji, avec accept/decline", () => {
    expect(PUBLIC_DISCOVERY_WELCOME.accept.length).toBeGreaterThan(0);
    expect(PUBLIC_DISCOVERY_WELCOME.decline.length).toBeGreaterThan(0);
    expect(EMOJI.test(PUBLIC_DISCOVERY_WELCOME.title)).toBe(false);
    expect(EMOJI.test(PUBLIC_DISCOVERY_WELCOME.body)).toBe(false);
  });

  it("chaque id d'étape est unique", () => {
    const ids = PUBLIC_DISCOVERY_TOUR.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
