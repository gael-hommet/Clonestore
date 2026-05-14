import { describe, expect, it } from "vitest";

import {
  detectPierreScheduleIso,
  isScheduledIsoInFuture,
} from "@/lib/pierre/mission/schedule";

describe("Pierre schedule", () => {
  it("retourne null si aucune heure n'est trouvée", () => {
    const value = detectPierreScheduleIso("Prépare le document RH");
    expect(value).toBeNull();
  });

  it("retourne un ISO valide pour une heure explicite", () => {
    const value = detectPierreScheduleIso("À 17h envoie le mail");
    expect(typeof value).toBe("string");

    const dt = new Date(value as string);
    expect(Number.isNaN(dt.getTime())).toBe(false);
  });

  it("isScheduledIsoInFuture valide un futur proche", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isScheduledIsoInFuture(future)).toBe(true);
  });

  it("isScheduledIsoInFuture refuse une date passée", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isScheduledIsoInFuture(past)).toBe(false);
  });

  it("isScheduledIsoInFuture refuse une date invalide", () => {
    expect(isScheduledIsoInFuture("not-a-date")).toBe(false);
  });
});