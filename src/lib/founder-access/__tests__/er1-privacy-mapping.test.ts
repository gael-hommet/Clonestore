// E-R1 — tests unitaires : confidentialité analytics (§14), mapping Stripe (§6),
// éligibilité checkout fondateur (§8).
import { describe, it, expect } from "vitest";
import { looksLikePii, sanitizeReferrer, sanitizePath, sanitizeUtm, sanitizeBrowserFamily, sanitizeMetadata, referrerDomain } from "../privacy";
import { mapStripeSubscriptionStatus } from "@/lib/billing/stripe-activation";
import { evaluateFounderCheckout } from "../checkout-eligibility";
import type { ReservationForActivation } from "../store";

describe("§14 — confidentialité analytics", () => {
  it("refuse toute valeur ressemblant à de la PII / un secret", () => {
    expect(looksLikePii("user@example.com")).toBe(true);
    expect(looksLikePii("?token=abc")).toBe(true);
    expect(looksLikePii("authorization: Bearer x")).toBe(true);
    expect(looksLikePii("secret_key")).toBe(true);
    expect(looksLikePii("/demo/pierre")).toBe(false);
  });
  it("referrer réduit à origin + path (sans query/fragment/credentials)", () => {
    expect(sanitizeReferrer("https://user:pw@google.com/search?q=secret#frag")).toBe("https://google.com/search");
    expect(referrerDomain("https://www.google.com/x")).toBe("google.com");
  });
  it("path : pathname seul, query/fragment supprimés (donc le token de la query disparaît)", () => {
    expect(sanitizePath("/reserver/pierre?token=abc")).toBe("/reserver/pierre"); // query retirée → plus de token
    expect(sanitizePath("/reserver/pierre?utm=x#y")).toBe("/reserver/pierre");
    expect(sanitizePath("https://x.test/demo?a=1")).toBe("/demo");
    expect(sanitizePath("/verify/user@example.com/x")).toBe(null); // PII dans le pathname → rejeté
  });
  it("UTM borné sans PII ; browser family générale", () => {
    expect(sanitizeUtm("newsletter")).toBe("newsletter");
    expect(sanitizeUtm("email=a@b.com")).toBe(null);
    expect(sanitizeBrowserFamily("Mozilla/5.0 Chrome/120")).toBe("chrome");
    expect(sanitizeBrowserFamily("weird")).toBe("other");
  });
  it("métadonnées : clés/valeurs PII retirées, taille bornée", () => {
    const out = sanitizeMetadata({ ctaVariant: "violet", email: "a@b.com", authToken: "x", ok: "1" });
    expect(out.ctaVariant).toBe("violet");
    expect(out.email).toBeUndefined();
    expect(out.authToken).toBeUndefined();
  });
});

describe("§6 — mapping Stripe exhaustif", () => {
  it("mappe chaque statut Stripe, y compris incomplete", () => {
    for (const s of ["active", "trialing", "incomplete", "incomplete_expired", "past_due", "unpaid", "canceled", "paused"]) {
      expect(mapStripeSubscriptionStatus(s)).toBe(s);
    }
    expect(mapStripeSubscriptionStatus("unknown_future")).toBe("none");
    expect(mapStripeSubscriptionStatus(null)).toBe("none");
  });
});

describe("§8 — éligibilité checkout fondateur", () => {
  const base: ReservationForActivation = { id: "r1", email_normalized: "a@acme.fr", company_name: "Acme", status: "confirmed", verified: true, unsubscribed: false, user_id: null };
  const ev = (over: Partial<ReservationForActivation> | null, extra: Partial<Parameters<typeof evaluateFounderCheckout>[0]> = {}) =>
    evaluateFounderCheckout({ reservation: over === null ? null : { ...base, ...over }, phase: "launched", userId: "u1", userEmailNormalized: "a@acme.fr", ...extra });

  it("accepte une réservation confirmée, email correspondant, fenêtre ouverte", () => {
    expect(ev({}).ok).toBe(true);
  });
  it("refuse chaque cas invalide avec un code", () => {
    expect(ev(null)).toMatchObject({ ok: false, code: "FOUNDER_RESERVATION_NOT_FOUND" });
    expect(ev({ unsubscribed: true })).toMatchObject({ ok: false, code: "FOUNDER_RESERVATION_UNSUBSCRIBED" });
    expect(ev({ verified: false })).toMatchObject({ ok: false, code: "FOUNDER_EMAIL_NOT_CONFIRMED" });
    expect(ev({ email_normalized: "autre@x.fr" })).toMatchObject({ ok: false, code: "FOUNDER_EMAIL_MISMATCH" });
    expect(ev({ user_id: "u2" })).toMatchObject({ ok: false, code: "FOUNDER_RESERVATION_CLAIMED" });
    expect(ev({}, { phase: "before_launch" })).toMatchObject({ ok: false, code: "FOUNDER_WINDOW_CLOSED" });
    expect(ev({}, { userEmailNormalized: null })).toMatchObject({ ok: false, code: "FOUNDER_EMAIL_UNKNOWN" });
  });
});
