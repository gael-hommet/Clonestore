// Règles de versement pures — éligibilité, seuil, réserve, litige, période.

import { describe, it, expect } from "vitest";
import { decidePayout, previousMonthBounds, monthPeriodKey } from "../payout-rules";

const ok = {
  partnerStatus: "active" as const,
  payoutsEnabled: true,
  onboardingStatus: "complete" as const,
  availableMinor: 20_000,
  frozenMinor: 0,
  thresholdMinor: 10_000,
  hasOpenDispute: false,
};

describe("decidePayout", () => {
  it("cabinet prêt, au-dessus du seuil → éligible pour le montant disponible", () => {
    const d = decidePayout(ok);
    expect(d.eligible).toBe(true);
    if (d.eligible) expect(d.amountMinor).toBe(20_000);
  });
  it("cabinet non actif → refusé", () => {
    expect(decidePayout({ ...ok, partnerStatus: "suspended" }).eligible).toBe(false);
  });
  it("onboarding Stripe incomplet → refusé", () => {
    expect(decidePayout({ ...ok, onboardingStatus: "pending" }).eligible).toBe(false);
  });
  it("payouts désactivés → refusé", () => {
    expect(decidePayout({ ...ok, payoutsEnabled: false }).eligible).toBe(false);
  });
  it("litige ouvert → refusé (gel de sécurité)", () => {
    expect(decidePayout({ ...ok, hasOpenDispute: true }).eligible).toBe(false);
  });
  it("sous le seuil → refusé (reporté)", () => {
    expect(decidePayout({ ...ok, availableMinor: 9_999 }).eligible).toBe(false);
  });
  it("solde nul ou négatif → refusé", () => {
    expect(decidePayout({ ...ok, availableMinor: 0 }).eligible).toBe(false);
    expect(decidePayout({ ...ok, availableMinor: -500 }).eligible).toBe(false);
  });
});

describe("période mensuelle", () => {
  it("monthPeriodKey formate YYYY-MM", () => {
    expect(monthPeriodKey({ getUTCFullYear: () => 2026, getUTCMonth: () => 7 })).toBe("2026-08");
  });
  it("previousMonthBounds calcule le mois précédent", () => {
    const b = previousMonthBounds(new Date("2026-08-15T10:00:00Z"));
    expect(b.key).toBe("2026-07");
    expect(b.start).toBe("2026-07-01T00:00:00.000Z");
    expect(b.end).toBe("2026-08-01T00:00:00.000Z");
  });
  it("gère le passage d'année (janvier → décembre précédent)", () => {
    const b = previousMonthBounds(new Date("2026-01-10T00:00:00Z"));
    expect(b.key).toBe("2025-12");
  });
});
