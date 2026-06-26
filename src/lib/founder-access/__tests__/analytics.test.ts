// E-R1 §3 — séparation stricte des taxonomies client / serveur + session stricte.
import { describe, it, expect } from "vitest";
import { isClientAnalyticsEvent, isServerFunnelEvent, isAnalyticsEvent, isValidSessionId } from "../analytics";
import { CLIENT_ANALYTICS_EVENTS, SERVER_FUNNEL_EVENTS } from "../types";

describe("E-R1 — taxonomies client/serveur", () => {
  it("accepte les événements client", () => {
    expect(isClientAnalyticsEvent("site_viewed")).toBe(true);
    expect(isClientAnalyticsEvent("founder_checkout_started")).toBe(true);
    for (const e of CLIENT_ANALYTICS_EVENTS) expect(isClientAnalyticsEvent(e)).toBe(true);
  });
  it("REFUSE les événements de vérité serveur côté client", () => {
    expect(isClientAnalyticsEvent("founder_payment_completed")).toBe(false);
    expect(isClientAnalyticsEvent("founder_email_verified")).toBe(false);
    expect(isClientAnalyticsEvent("founder_reservation_created")).toBe(false);
    for (const e of SERVER_FUNNEL_EVENTS) {
      expect(isClientAnalyticsEvent(e)).toBe(false);
      expect(isServerFunnelEvent(e)).toBe(true);
    }
  });
  it("refuse un événement inconnu", () => {
    expect(isAnalyticsEvent("rm_rf")).toBe(false);
    expect(isAnalyticsEvent("")).toBe(false);
  });
  it("valide strictement l'id de session (UUID v4)", () => {
    expect(isValidSessionId("3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a")).toBe(true);
    expect(isValidSessionId("not-a-uuid")).toBe(false);
    expect(isValidSessionId("3f1a8c2e-1b2c-1d3e-8f9a-0b1c2d3e4f5a")).toBe(false); // v1, pas v4
    expect(isValidSessionId(12345)).toBe(false);
  });
});
