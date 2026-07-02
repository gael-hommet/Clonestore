import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MY_CLONESTORE_TOUR,
  MY_CLONESTORE_TOUR_ID,
  MY_CLONESTORE_WELCOME,
} from "../registry/my-clonestore-tour";
import { PUBLIC_DISCOVERY_TOUR } from "../registry/public-discovery-tour";
import { getTour, hasTour, listTours } from "../tour-registry";

const EMOJI = /\p{Extended_Pictographic}/u;
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");

describe("Tour authentifié Mon CloneStore (P9.2)", () => {
  it("est enregistré, distinct du tour public", () => {
    expect(hasTour(MY_CLONESTORE_TOUR_ID)).toBe(true);
    expect(getTour(MY_CLONESTORE_TOUR_ID)).toBe(MY_CLONESTORE_TOUR);
    expect(MY_CLONESTORE_TOUR_ID).not.toBe(PUBLIC_DISCOVERY_TOUR.id);
    expect(listTours().length).toBeGreaterThanOrEqual(2);
  });

  it("couvre les 6 étapes attendues et leurs cibles", () => {
    expect(MY_CLONESTORE_TOUR.steps.map((s) => s.id)).toEqual([
      "accueil",
      "demarrage",
      "empreinte",
      "employes",
      "cockpit",
      "compte",
    ]);
    expect(MY_CLONESTORE_TOUR.steps.map((s) => s.targetId)).toEqual([
      "mycs-header",
      "mycs-startup",
      "mycs-company",
      "mycs-employees",
      "mycs-cockpit",
      "mycs-account",
    ]);
  });

  it("est ancré sur /profile (authentifié), sans emoji", () => {
    for (const step of MY_CLONESTORE_TOUR.steps) {
      expect(step.route).toBe("/profile");
      expect(EMOJI.test(step.title)).toBe(false);
      expect(EMOJI.test(step.body)).toBe(false);
    }
    expect(EMOJI.test(MY_CLONESTORE_WELCOME.title)).toBe(false);
  });

  it("clés de progression séparées (aucune collision avec le tour public)", () => {
    // Ids différents → clés localStorage `clonestore.guidedTour.<id>` distinctes.
    expect(MY_CLONESTORE_TOUR.id).not.toBe(PUBLIC_DISCOVERY_TOUR.id);
  });
});

describe("Câblage : provider contextuel + cibles sur la home", () => {
  const provider = read("src/components/guided-tour/GuidedTourProvider.tsx");
  const home = read("src/app/profile/page.tsx");

  it("le provider sélectionne le tour selon la route et reprend les deux tours", () => {
    expect(provider).toContain("selectContextualTour");
    expect(provider).toContain('pathname === "/profile"');
    expect(provider).toContain("MY_CLONESTORE_TOUR");
    expect(provider).toContain("resolveResumeIndex(storeRef.current, MY_CLONESTORE_TOUR)");
    expect(provider).toContain("resolveResumeIndex(storeRef.current, PUBLIC_DISCOVERY_TOUR)");
  });

  it("la home porte les 6 cibles invisibles du tour authentifié", () => {
    for (const t of ["mycs-header", "mycs-startup", "mycs-company", "mycs-employees", "mycs-cockpit", "mycs-account"]) {
      expect(home).toContain(`data-tour-id="${t}"`);
    }
  });
});
