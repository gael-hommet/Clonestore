import { describe, it, expect } from "vitest";
import {
  QUICK_START_SCREENS,
  QUICK_START_SIZES,
  createEmptyQuickStart,
  estimateRemaining,
  firstIncompleteScreenIndex,
  isQuickStartComplete,
  isScreenComplete,
  nextScreenIndex,
  prevScreenIndex,
  quickStartProgress,
  toQuickStartContract,
  validateField,
  type QuickStartDraft,
} from "../quick-start";

const complete: QuickStartDraft = {
  companyName: "Acme SAS",
  companySize: "11-50",
  sector: "Services",
  country: "France",
  firstObjective: "Préparer les contrats d'embauche et les relances RH.",
};

describe("Quick Start — validation des champs", () => {
  it("companyName requis, longueur minimale", () => {
    expect(validateField("companyName", "")).not.toBeNull();
    expect(validateField("companyName", "A")).not.toBeNull();
    expect(validateField("companyName", "Acme")).toBeNull();
  });

  it("companySize doit venir de la liste", () => {
    expect(validateField("companySize", "")).not.toBeNull();
    expect(validateField("companySize", "999")).not.toBeNull();
    expect(validateField("companySize", QUICK_START_SIZES[0])).toBeNull();
  });

  it("firstObjective requis + détail minimal", () => {
    expect(validateField("firstObjective", "")).not.toBeNull();
    expect(validateField("firstObjective", "court")).not.toBeNull();
    expect(validateField("firstObjective", "Gérer les contrats RH")).toBeNull();
  });

  it("secteur et pays requis", () => {
    expect(validateField("sector", "")).not.toBeNull();
    expect(validateField("country", "")).not.toBeNull();
    expect(validateField("sector", "Tech")).toBeNull();
    expect(validateField("country", "France")).toBeNull();
  });
});

describe("Quick Start — progression & complétude", () => {
  it("vide → progression 0, non complet", () => {
    const empty = createEmptyQuickStart();
    expect(quickStartProgress(empty)).toBe(0);
    expect(isQuickStartComplete(empty)).toBe(false);
  });

  it("complet → progression 1, complet", () => {
    expect(quickStartProgress(complete)).toBe(1);
    expect(isQuickStartComplete(complete)).toBe(true);
  });

  it("partiel → progression fractionnaire", () => {
    const partial = { ...createEmptyQuickStart(), companyName: "Acme", companySize: "11-50" };
    expect(quickStartProgress(partial)).toBeCloseTo(2 / 5, 5);
  });

  it("isScreenComplete par écran", () => {
    const partial = { ...createEmptyQuickStart(), companyName: "Acme", companySize: "11-50" };
    expect(isScreenComplete(QUICK_START_SCREENS[0], partial)).toBe(true);
    expect(isScreenComplete(QUICK_START_SCREENS[1], partial)).toBe(false);
  });
});

describe("Quick Start — reprise & navigation (sans boucle)", () => {
  it("firstIncompleteScreenIndex = point de reprise exact", () => {
    expect(firstIncompleteScreenIndex(createEmptyQuickStart())).toBe(0);
    const s1done = { ...createEmptyQuickStart(), companyName: "Acme", companySize: "11-50" };
    expect(firstIncompleteScreenIndex(s1done)).toBe(1);
    expect(firstIncompleteScreenIndex(complete)).toBe(QUICK_START_SCREENS.length - 1);
  });

  it("nextScreenIndex n'avance que si l'écran courant est complet, et ne dépasse pas", () => {
    const empty = createEmptyQuickStart();
    expect(nextScreenIndex(0, empty)).toBe(0); // écran 0 incomplet → reste
    const s0 = { ...empty, companyName: "Acme", companySize: "11-50" };
    expect(nextScreenIndex(0, s0)).toBe(1);
    expect(nextScreenIndex(2, complete)).toBe(2); // dernier → borné
  });

  it("prevScreenIndex ne passe pas sous 0", () => {
    expect(prevScreenIndex(0)).toBe(0);
    expect(prevScreenIndex(2)).toBe(1);
  });
});

describe("Quick Start — sortie", () => {
  it("estimateRemaining lisible et < 5 min", () => {
    expect(estimateRemaining(complete)).toBe("Terminé");
    expect(estimateRemaining(createEmptyQuickStart())).toContain("5 minutes");
  });

  it("toQuickStartContract : null si incomplet, contrat trimé si complet", () => {
    expect(toQuickStartContract(createEmptyQuickStart())).toBeNull();
    const contract = toQuickStartContract({ ...complete, companyName: "  Acme SAS  " });
    expect(contract?.companyName).toBe("Acme SAS");
    expect(contract?.firstObjective.length).toBeGreaterThan(0);
  });
});
