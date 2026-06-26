// E-R2 — tests unitaires : mapping strict (§4), preuve commerciale (§2),
// ordre total déterministe (§3).
import { describe, it, expect } from "vitest";
import {
  mapStripeSubscriptionStatusStrict, validateFounderStripeCommercialProof,
  compareStripeEventOrder, decideStripeApplication, stripeStatusGrants,
} from "../stripe-proof";

describe("§4 — statut Stripe inconnu fail-closed", () => {
  it("mappe les statuts supportés", () => {
    for (const s of ["active", "trialing", "incomplete", "incomplete_expired", "past_due", "unpaid", "canceled", "paused"]) {
      expect(mapStripeSubscriptionStatusStrict(s)).toEqual({ ok: true, status: s });
    }
    expect(stripeStatusGrants("active")).toBe(true);
    expect(stripeStatusGrants("canceled")).toBe(false);
  });
  it("statut inconnu → { ok:false, unsupported_stripe_status } (jamais 'none')", () => {
    expect(mapStripeSubscriptionStatusStrict("future_status")).toEqual({ ok: false, reason: "unsupported_stripe_status", raw_status: "future_status" });
    expect(mapStripeSubscriptionStatusStrict(null)).toMatchObject({ ok: false, reason: "unsupported_stripe_status" });
  });
});

describe("§2 — preuve commerciale stricte", () => {
  const ok = {
    priceId: "price_pierre", productMatches: true, amountCents: 44900, currency: "eur", interval: "month",
    subscriptionId: "sub_1", customerId: "cus_1", reservationId: "r1", livemode: false,
  };
  const opts = { expectedPriceId: "price_pierre", envIsProduction: false };
  const run = (over: Partial<typeof ok>) => validateFounderStripeCommercialProof({ ...ok, ...over }, opts);

  it("accepte une preuve COMPLÈTE et conforme", () => {
    expect(run({})).toMatchObject({ allowed: true, reservationId: "r1", amount_cents: 44900 });
  });
  it("refuse toute preuve absente (null/undefined) ou divergente — jamais de laissez-passer", () => {
    expect(run({ amountCents: 1 })).toMatchObject({ allowed: false, reason: "amount_mismatch" });
    expect(run({ currency: "usd" })).toMatchObject({ allowed: false, reason: "currency_mismatch" });
    expect(run({ priceId: "price_other" })).toMatchObject({ allowed: false, reason: "price_id_mismatch" });
    expect(run({ priceId: null })).toMatchObject({ allowed: false, reason: "missing_price_id" });
    // produit : null/undefined/false sont tous refusés (preuve obligatoire = true)
    expect(run({ productMatches: false })).toMatchObject({ allowed: false, reason: "product_not_verified" });
    expect(run({ productMatches: null })).toMatchObject({ allowed: false, reason: "product_not_verified" });
    expect(run({ productMatches: undefined })).toMatchObject({ allowed: false, reason: "product_not_verified" });
    expect(run({ subscriptionId: null })).toMatchObject({ allowed: false, reason: "missing_subscription" });
    expect(run({ customerId: null })).toMatchObject({ allowed: false, reason: "missing_customer" });
    expect(run({ reservationId: null })).toMatchObject({ allowed: false, reason: "missing_reservation" });
    expect(run({ amountCents: null })).toMatchObject({ allowed: false, reason: "missing_amount" });
    expect(run({ currency: null })).toMatchObject({ allowed: false, reason: "missing_currency" });
    expect(run({ interval: "year" })).toMatchObject({ allowed: false, reason: "interval_mismatch" });
    // intervalle/livemode absents → refus (et non « optionnels »)
    expect(run({ interval: null })).toMatchObject({ allowed: false, reason: "missing_interval" });
    expect(run({ livemode: undefined })).toMatchObject({ allowed: false, reason: "missing_livemode" });
  });
  it("refuse si Price ID non configuré", () => {
    expect(validateFounderStripeCommercialProof(ok, { expectedPriceId: null, envIsProduction: false })).toMatchObject({ allowed: false, reason: "price_not_configured" });
  });
  it("refuse une incohérence live/test avec l'environnement", () => {
    expect(validateFounderStripeCommercialProof({ ...ok, livemode: true }, { expectedPriceId: "price_pierre", envIsProduction: false })).toMatchObject({ allowed: false, reason: "livemode_mismatch" });
  });
  it("refuse un email client divergent de la réservation", () => {
    expect(run({ customerEmailNormalized: "a@x.fr", reservationEmailNormalized: "b@x.fr" } as never)).toMatchObject({ allowed: false, reason: "customer_email_mismatch" });
  });
});

describe("§3 — ordre total déterministe", () => {
  it("compare created puis event_id (déterministe)", () => {
    expect(compareStripeEventOrder({ created: 1, event_id: "a" }, { created: 2, event_id: "a" })).toBe(-1);
    expect(compareStripeEventOrder({ created: 2, event_id: "a" }, { created: 2, event_id: "b" })).toBe(-1);
    expect(compareStripeEventOrder({ created: 2, event_id: "z" }, { created: 2, event_id: "z" })).toBe(0);
  });
  it("ignore un événement strictement plus ancien", () => {
    const d = decideStripeApplication({ incoming: { created: 1, event_id: "x" }, last: { created: 2, event_id: "y" }, incomingGrants: true, currentUnfavorable: true });
    expect(d).toEqual({ apply: false, reason: "stale" });
  });
  it("ignore la même clé d'ordre", () => {
    const d = decideStripeApplication({ incoming: { created: 2, event_id: "y" }, last: { created: 2, event_id: "y" }, incomingGrants: true, currentUnfavorable: false });
    expect(d).toEqual({ apply: false, reason: "same_order" });
  });
  it("précédence terminale : un grant au MÊME timestamp ne réactive pas un état défavorable", () => {
    // canceled à t=2 (event 'm'), puis active à t=2 (event 'z' > 'm') → terminal_precedence
    const d = decideStripeApplication({ incoming: { created: 2, event_id: "z" }, last: { created: 2, event_id: "m" }, incomingGrants: true, currentUnfavorable: true });
    expect(d).toEqual({ apply: false, reason: "terminal_precedence" });
  });
  it("applique un événement strictement plus récent", () => {
    const d = decideStripeApplication({ incoming: { created: 3, event_id: "a" }, last: { created: 2, event_id: "z" }, incomingGrants: false, currentUnfavorable: false });
    expect(d).toEqual({ apply: true });
  });
});
