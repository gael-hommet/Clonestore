import { describe, it, expect } from "vitest";
import {
  IDLE_STATE,
  clampStepIndex,
  createInitialState,
  isFirstStep,
  isLastStep,
  isResolutionReady,
  isTourActive,
  selectCurrentStep,
  selectProgress,
  stepResolutionKey,
  tourReducer,
} from "../tour-machine";
import type { Tour, TourState } from "../types";

const TOUR: Tour = {
  id: "t",
  version: 1,
  name: "Test",
  steps: [
    { id: "s0", targetId: "a", title: "0", body: "b0" },
    { id: "s1", targetId: "b", title: "1", body: "b1" },
    { id: "s2", targetId: null, title: "2", body: "b2" },
  ],
};

const start = (atStep?: number): TourState =>
  tourReducer(IDLE_STATE, { type: "START", tour: TOUR, atStep }, null);

describe("clampStepIndex", () => {
  it("borne dans [0, length-1] et gère les valeurs invalides", () => {
    expect(clampStepIndex(-3, 3)).toBe(0);
    expect(clampStepIndex(5, 3)).toBe(2);
    expect(clampStepIndex(1, 3)).toBe(1);
    expect(clampStepIndex(1, 0)).toBe(0);
    expect(clampStepIndex(Number.NaN, 3)).toBe(0);
  });
});

describe("createInitialState", () => {
  it("est idle", () => {
    expect(createInitialState()).toEqual(IDLE_STATE);
    expect(isTourActive(createInitialState())).toBe(false);
  });
});

describe("START (ouverture)", () => {
  it("démarre en running à l'étape 0", () => {
    const s = start();
    expect(s.status).toBe("running");
    expect(s.tourId).toBe("t");
    expect(s.version).toBe(1);
    expect(s.stepIndex).toBe(0);
    expect(isTourActive(s)).toBe(true);
  });

  it("peut démarrer à une étape donnée (reprise), bornée", () => {
    expect(start(1).stepIndex).toBe(1);
    expect(start(99).stepIndex).toBe(2);
    expect(start(-1).stepIndex).toBe(0);
  });

  it("ne démarre pas un tour sans étape", () => {
    const empty: Tour = { id: "e", version: 1, name: "e", steps: [] };
    const s = tourReducer(IDLE_STATE, { type: "START", tour: empty }, null);
    expect(s.status).toBe("idle");
  });
});

describe("NEXT / PREV (navigation)", () => {
  it("NEXT avance sans dépasser, puis COMPLETE à la fin (aucune boucle)", () => {
    let s = start();
    s = tourReducer(s, { type: "NEXT" }, TOUR);
    expect(s.stepIndex).toBe(1);
    s = tourReducer(s, { type: "NEXT" }, TOUR);
    expect(s.stepIndex).toBe(2);
    s = tourReducer(s, { type: "NEXT" }, TOUR);
    expect(s.status).toBe("completed");
    expect(s.stepIndex).toBe(2);
  });

  it("PREV recule sans passer sous 0", () => {
    let s = start(2);
    s = tourReducer(s, { type: "PREV" }, TOUR);
    expect(s.stepIndex).toBe(1);
    s = tourReducer(s, { type: "PREV" }, TOUR);
    expect(s.stepIndex).toBe(0);
    s = tourReducer(s, { type: "PREV" }, TOUR);
    expect(s.stepIndex).toBe(0);
  });

  it("GO_TO saute à une étape bornée", () => {
    const s = tourReducer(start(), { type: "GO_TO", index: 5 }, TOUR);
    expect(s.stepIndex).toBe(2);
  });

  it("ignore NEXT/PREV quand pas en cours", () => {
    expect(tourReducer(IDLE_STATE, { type: "NEXT" }, TOUR)).toEqual(IDLE_STATE);
    expect(tourReducer(IDLE_STATE, { type: "PREV" }, TOUR)).toEqual(IDLE_STATE);
  });
});

describe("SKIP / COMPLETE / STOP (fermeture)", () => {
  it("SKIP marque skipped", () => {
    const s = tourReducer(start(1), { type: "SKIP" }, TOUR);
    expect(s.status).toBe("skipped");
    expect(s.stepIndex).toBe(1);
  });

  it("COMPLETE marque completed à la dernière étape", () => {
    const s = tourReducer(start(), { type: "COMPLETE" }, TOUR);
    expect(s.status).toBe("completed");
    expect(s.stepIndex).toBe(2);
  });

  it("STOP réinitialise à idle", () => {
    const s = tourReducer(start(1), { type: "STOP" }, TOUR);
    expect(s).toEqual(IDLE_STATE);
  });
});

describe("identité de résolution (anti stale-step)", () => {
  it("stepResolutionKey identifie tour+version+index, null hors running", () => {
    expect(stepResolutionKey(start())).toBe("t:1:0");
    expect(stepResolutionKey(start(2))).toBe("t:1:2");
    expect(stepResolutionKey(IDLE_STATE)).toBeNull();
  });

  it("la clé change quand l'étape change", () => {
    const k0 = stepResolutionKey(start(0));
    const k1 = stepResolutionKey(start(1));
    expect(k0).not.toBe(k1);
  });

  it("isResolutionReady : vrai seulement si les clés correspondent exactement", () => {
    expect(isResolutionReady("t:1:2", "t:1:2")).toBe(true);
    expect(isResolutionReady("t:1:1", "t:1:2")).toBe(false); // rect de l'étape précédente
    expect(isResolutionReady(null, "t:1:2")).toBe(false);
    expect(isResolutionReady("t:1:2", null)).toBe(false);
    expect(isResolutionReady(undefined, undefined)).toBe(false);
  });
});

describe("sélecteurs", () => {
  it("selectCurrentStep retourne l'étape courante ou null hors running", () => {
    expect(selectCurrentStep(start(1), TOUR)?.id).toBe("s1");
    expect(selectCurrentStep(IDLE_STATE, TOUR)).toBeNull();
    expect(selectCurrentStep(start(), null)).toBeNull();
  });

  it("isFirstStep / isLastStep", () => {
    expect(isFirstStep(start())).toBe(true);
    expect(isFirstStep(start(1))).toBe(false);
    expect(isLastStep(start(2), TOUR)).toBe(true);
    expect(isLastStep(start(0), TOUR)).toBe(false);
  });

  it("selectProgress donne current/total/ratio", () => {
    expect(selectProgress(start(), TOUR)).toEqual({ current: 1, total: 3, ratio: 1 / 3 });
    expect(selectProgress(start(2), TOUR)).toEqual({ current: 3, total: 3, ratio: 1 });
    expect(selectProgress(IDLE_STATE, null)).toEqual({ current: 0, total: 0, ratio: 0 });
  });
});
