import { describe, it, expect } from "vitest";
import {
  clearProgress,
  clearSnooze,
  isSnoozed,
  isTourCompleted,
  progressKey,
  readProgress,
  readSnoozeUntil,
  resolveResumeIndex,
  shouldOfferTour,
  snoozeKey,
  writeProgress,
  writeSnooze,
} from "../progress-storage";
import type { KeyValueStore } from "../progress-storage";
import type { Tour, TourProgress } from "../types";

function fakeStore(seed: Record<string, string> = {}): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const TOUR: Tour = {
  id: "public-discovery",
  version: 1,
  name: "n",
  steps: [
    { id: "a", targetId: "a", title: "a", body: "a" },
    { id: "b", targetId: "b", title: "b", body: "b" },
    { id: "c", targetId: null, title: "c", body: "c" },
  ],
};

const progress = (over: Partial<TourProgress> = {}): TourProgress => ({
  tourId: TOUR.id,
  version: TOUR.version,
  status: "running",
  stepIndex: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("progressKey", () => {
  it("préfixe versionné et namespacé", () => {
    expect(progressKey("public-discovery")).toBe("clonestore.guidedTour.public-discovery");
  });
});

describe("write / read (persistance)", () => {
  it("écrit puis relit la progression", () => {
    const store = fakeStore();
    writeProgress(store, progress());
    expect(readProgress(store, TOUR.id)).toEqual(progress());
  });

  it("tolère un store null", () => {
    expect(readProgress(null, TOUR.id)).toBeNull();
    expect(() => writeProgress(null, progress())).not.toThrow();
    expect(() => clearProgress(null, TOUR.id)).not.toThrow();
  });

  it("tolère des données corrompues", () => {
    const store = fakeStore({ [progressKey(TOUR.id)]: "{not json" });
    expect(readProgress(store, TOUR.id)).toBeNull();
  });

  it("rejette une entrée d'un autre tour", () => {
    const store = fakeStore({
      [progressKey(TOUR.id)]: JSON.stringify({ ...progress(), tourId: "other" }),
    });
    expect(readProgress(store, TOUR.id)).toBeNull();
  });

  it("clearProgress supprime", () => {
    const store = fakeStore();
    writeProgress(store, progress());
    clearProgress(store, TOUR.id);
    expect(readProgress(store, TOUR.id)).toBeNull();
  });
});

describe("shouldOfferTour", () => {
  it("propose si aucune progression", () => {
    expect(shouldOfferTour(fakeStore(), TOUR)).toBe(true);
  });

  it("ne propose pas si déjà engagé même version", () => {
    const store = fakeStore();
    writeProgress(store, progress({ status: "skipped" }));
    expect(shouldOfferTour(store, TOUR)).toBe(false);
  });

  it("repropose si la version stockée est périmée", () => {
    const store = fakeStore();
    writeProgress(store, progress({ version: 0, status: "completed" }));
    expect(shouldOfferTour(store, TOUR)).toBe(true);
  });
});

describe("resolveResumeIndex (reprise)", () => {
  it("reprend un tour running de même version", () => {
    const store = fakeStore();
    writeProgress(store, progress({ status: "running", stepIndex: 1 }));
    expect(resolveResumeIndex(store, TOUR)).toBe(1);
  });

  it("ne reprend pas un tour terminé/passé", () => {
    const store = fakeStore();
    writeProgress(store, progress({ status: "completed" }));
    expect(resolveResumeIndex(store, TOUR)).toBeNull();
  });

  it("ne reprend pas une version périmée", () => {
    const store = fakeStore();
    writeProgress(store, progress({ version: 0, status: "running" }));
    expect(resolveResumeIndex(store, TOUR)).toBeNull();
  });

  it("borne l'index de reprise", () => {
    const store = fakeStore();
    writeProgress(store, progress({ status: "running", stepIndex: 99 }));
    expect(resolveResumeIndex(store, TOUR)).toBe(2);
  });
});

describe("snooze « Plus tard » (Étape 6)", () => {
  const NOW = 1_000_000;

  it("clé de snooze distincte", () => {
    expect(snoozeKey(TOUR.id)).toBe("clonestore.guidedTour.public-discovery.snooze");
    expect(snoozeKey(TOUR.id)).not.toBe(progressKey(TOUR.id));
  });

  it("écrit/lit une échéance de snooze", () => {
    const store = fakeStore();
    writeSnooze(store, TOUR.id, NOW + 5000);
    expect(readSnoozeUntil(store, TOUR.id)).toBe(NOW + 5000);
    expect(isSnoozed(store, TOUR.id, NOW)).toBe(true);
    expect(isSnoozed(store, TOUR.id, NOW + 6000)).toBe(false);
  });

  it("« Plus tard » NE marque PAS le tour skipped/completed", () => {
    const store = fakeStore();
    writeSnooze(store, TOUR.id, NOW + 5000);
    // Aucune progression écrite → une progression réellement commencée resterait reprenable.
    expect(readProgress(store, TOUR.id)).toBeNull();
  });

  it("snooze actif → ne propose pas ; snooze expiré → repropose", () => {
    const store = fakeStore();
    writeSnooze(store, TOUR.id, NOW + 5000);
    expect(shouldOfferTour(store, TOUR, NOW)).toBe(false); // dans la fenêtre
    expect(shouldOfferTour(store, TOUR, NOW + 6000)).toBe(true); // après expiration
  });

  it("un tour running reste reprenable même avec un snooze", () => {
    const store = fakeStore();
    writeProgress(store, progress({ status: "running", stepIndex: 2 }));
    writeSnooze(store, TOUR.id, NOW + 5000);
    expect(resolveResumeIndex(store, TOUR)).toBe(2);
  });

  it("clearSnooze supprime", () => {
    const store = fakeStore();
    writeSnooze(store, TOUR.id, NOW + 5000);
    clearSnooze(store, TOUR.id);
    expect(readSnoozeUntil(store, TOUR.id)).toBeNull();
    expect(isSnoozed(store, TOUR.id, NOW)).toBe(false);
  });
});

describe("isTourCompleted", () => {
  it("vrai seulement si completed à la version courante", () => {
    const store = fakeStore();
    writeProgress(store, progress({ status: "completed" }));
    expect(isTourCompleted(store, TOUR)).toBe(true);
    writeProgress(store, progress({ status: "completed", version: 0 }));
    expect(isTourCompleted(store, TOUR)).toBe(false);
  });
});
