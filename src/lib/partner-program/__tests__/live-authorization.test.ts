// Chantier 1.1 — la garde d'autorisation des versements LIVE est fail-closed.
// Aucune variable ne peut, à elle seule, autoriser un transfert Live.

import { describe, expect, it } from "vitest";
import { evaluateLivePayoutAuthorization, isPartnerLivePayoutAuthorized, explainLiveBlock } from "../live-authorization";

/** Environnement où TOUTES les gardes sont satisfaites (le seul cas autorisant). */
const FULLY_AUTHORIZED: Record<string, string> = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  PARTNER_PAYOUTS_ENABLED: "true",
  PARTNER_PAYOUT_DRY_RUN: "false",
  PARTNER_PAYOUT_LIVE_AUTHORIZED: "true",
  STRIPE_SECRET_KEY: "sk_live_exemple_non_reel",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_exemple_non_reel",
  PARTNER_PAYOUT_CRON_SECRET: "secret-cron",
};

describe("garde Live — fail-closed", () => {
  it("environnement VIDE → refus (l'absence vaut toujours non)", () => {
    const d = evaluateLivePayoutAuthorization({});
    expect(d.authorized).toBe(false);
    expect(isPartnerLivePayoutAuthorized({})).toBe(false);
  });

  it("PARTNER_PAYOUT_LIVE_AUTHORIZED absente → refus explicite", () => {
    const env = { ...FULLY_AUTHORIZED };
    delete env.PARTNER_PAYOUT_LIVE_AUTHORIZED;
    const d = evaluateLivePayoutAuthorization(env);
    expect(d.authorized).toBe(false);
    expect(d.authorized === false && d.blockedBy).toContain("PARTNER_PAYOUT_LIVE_AUTHORIZED");
  });

  it("PARTNER_PAYOUT_DRY_RUN=false SEUL n'autorise JAMAIS un transfert Live", () => {
    const d = evaluateLivePayoutAuthorization({ PARTNER_PAYOUT_DRY_RUN: "false" });
    expect(d.authorized).toBe(false);
    // Il manque tout le reste : c'est nommé, pas deviné.
    expect(d.authorized === false && d.blockedBy).toEqual(
      expect.arrayContaining(["NODE_ENV", "PARTNER_PAYOUTS_ENABLED", "PARTNER_PAYOUT_LIVE_AUTHORIZED", "STRIPE_SECRET_KEY", "VERCEL_ENV"]),
    );
  });

  it("dry-run encore actif → refus, même si tout le reste est prêt", () => {
    const d = evaluateLivePayoutAuthorization({ ...FULLY_AUTHORIZED, PARTNER_PAYOUT_DRY_RUN: "true" });
    expect(d.authorized).toBe(false);
    expect(d.authorized === false && d.blockedBy).toContain("PARTNER_PAYOUT_DRY_RUN");
  });

  it("clé Stripe TEST avec autorisation Live → refus (incohérence nommée)", () => {
    const d = evaluateLivePayoutAuthorization({ ...FULLY_AUTHORIZED, STRIPE_SECRET_KEY: "sk_test_exemple" });
    expect(d.authorized).toBe(false);
    expect(d.authorized === false && d.blockedBy).toContain("STRIPE_SECRET_KEY");
    expect(d.authorized === false && d.blockedBy).toContain("NO_TEST_KEY");
  });

  it("environnement Vercel PREVIEW → refus", () => {
    const d = evaluateLivePayoutAuthorization({ ...FULLY_AUTHORIZED, VERCEL_ENV: "preview" });
    expect(d.authorized).toBe(false);
    expect(d.authorized === false && d.blockedBy).toContain("VERCEL_ENV");
  });

  it("environnement development → refus", () => {
    const d = evaluateLivePayoutAuthorization({ ...FULLY_AUTHORIZED, NODE_ENV: "development", VERCEL_ENV: "development" });
    expect(d.authorized).toBe(false);
  });

  it("secret de cron manquant → refus", () => {
    const env = { ...FULLY_AUTHORIZED };
    delete env.PARTNER_PAYOUT_CRON_SECRET;
    const d = evaluateLivePayoutAuthorization(env);
    expect(d.authorized).toBe(false);
    expect(d.authorized === false && d.blockedBy).toContain("PARTNER_PAYOUT_CRON_SECRET");
  });

  it("incohérence : clé secrète Live + clé publique Test → refus", () => {
    const d = evaluateLivePayoutAuthorization({ ...FULLY_AUTHORIZED, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_exemple" });
    expect(d.authorized).toBe(false);
    expect(d.authorized === false && d.blockedBy).toContain("NO_TEST_WEBHOOK_MIX");
  });

  it("payouts non activés → refus", () => {
    const d = evaluateLivePayoutAuthorization({ ...FULLY_AUTHORIZED, PARTNER_PAYOUTS_ENABLED: "false" });
    expect(d.authorized).toBe(false);
  });

  it("TOUTES les gardes satisfaites → autorisation (seul cas)", () => {
    const d = evaluateLivePayoutAuthorization(FULLY_AUTHORIZED);
    expect(d.authorized).toBe(true);
    expect(isPartnerLivePayoutAuthorized(FULLY_AUTHORIZED)).toBe(true);
  });

  it("chaque refus EXPLIQUE ce qui manque, sans révéler aucun secret", () => {
    const msg = explainLiveBlock({ ...FULLY_AUTHORIZED, PARTNER_PAYOUT_LIVE_AUTHORIZED: "false" });
    expect(msg).toContain("BLOQUÉS");
    expect(msg).toContain("PARTNER_PAYOUT_LIVE_AUTHORIZED");
    expect(msg).not.toContain("sk_live_");
    expect(msg).not.toContain("secret-cron");
  });

  it("une valeur bizarre (« yes », « 1 », espace) ne vaut jamais true", () => {
    for (const v of ["yes", "1", "TRUE ", "oui", ""]) {
      const d = evaluateLivePayoutAuthorization({ ...FULLY_AUTHORIZED, PARTNER_PAYOUT_LIVE_AUTHORIZED: v });
      // Seul « true » (insensible à la casse, trimé) autorise.
      const expected = v.trim().toLowerCase() === "true";
      expect(d.authorized).toBe(expected);
    }
  });
});
