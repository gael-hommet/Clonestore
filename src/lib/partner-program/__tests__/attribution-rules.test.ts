// Règles d'attribution pures — priorités, remplacement, expiration, auto-parrainage.

import { describe, it, expect } from "vitest";
import { sourcePriority, canSupersede, isTouchValid, detectSelfReferral } from "../attribution-rules";

describe("sourcePriority", () => {
  it("admin > introduction > invitation > code > lien", () => {
    expect(sourcePriority("admin")).toBeGreaterThan(sourcePriority("introduction"));
    expect(sourcePriority("introduction")).toBeGreaterThan(sourcePriority("invitation"));
    expect(sourcePriority("invitation")).toBeGreaterThan(sourcePriority("code"));
    expect(sourcePriority("code")).toBeGreaterThan(sourcePriority("link"));
  });
});

describe("canSupersede", () => {
  it("aucune attribution courante → oui", () => {
    expect(canSupersede({ current: null, candidate: "link" })).toBe(true);
  });
  it("attribution VERROUILLÉE → jamais remplacée", () => {
    expect(canSupersede({ current: { source: "link", status: "locked" }, candidate: "admin" })).toBe(false);
  });
  it("priorité strictement supérieure remplace un pending", () => {
    expect(canSupersede({ current: { source: "link", status: "pending" }, candidate: "introduction" })).toBe(true);
  });
  it("priorité égale ne remplace pas (première valide gagne)", () => {
    expect(canSupersede({ current: { source: "link", status: "pending" }, candidate: "link" })).toBe(false);
  });
  it("priorité inférieure ne remplace pas", () => {
    expect(canSupersede({ current: { source: "introduction", status: "pending" }, candidate: "link" })).toBe(false);
  });
});

describe("isTouchValid", () => {
  it("valide avant expiration", () => { expect(isTouchValid({ expiresAt: 100, at: 50 })).toBe(true); });
  it("invalide après expiration", () => { expect(isTouchValid({ expiresAt: 100, at: 101 })).toBe(false); });
});

describe("detectSelfReferral", () => {
  const base = { partnerAccountUserId: "p-user", subjectUserId: "s-user", partnerSelfDomains: ["cabinet.fr"], subjectEmailDomain: "client.fr", partnerStripeCustomerId: "cus_p", subjectStripeCustomerId: "cus_s" };
  it("aucun signal en cas normal", () => {
    expect(detectSelfReferral(base)).toEqual([]);
  });
  it("même compte", () => {
    expect(detectSelfReferral({ ...base, subjectUserId: "p-user" })).toContain("same_account");
  });
  it("domaine partagé (insensible à la casse)", () => {
    expect(detectSelfReferral({ ...base, subjectEmailDomain: "CABINET.FR" })).toContain("shared_domain");
  });
  it("même Stripe Customer", () => {
    expect(detectSelfReferral({ ...base, subjectStripeCustomerId: "cus_p" })).toContain("same_stripe_customer");
  });
});
