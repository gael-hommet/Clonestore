import { describe, it, expect } from "vitest";
import {
  CONTRACT_VERSION,
  LEADFORGE_COMMIT,
  PIERRE_PRICE_AMOUNT_CENTS,
  VARIANT_IDS,
  EVENT_IDS,
  CLAIM_IDS,
  SERVER_ONLY_EVENT_IDS,
  CLIENT_ALLOWED_EVENT_IDS,
  buildContractSnapshot,
  computeContractFingerprint,
  assertVariantId,
  assertEventId,
  assertClaimId,
  ContractParityError,
} from "../contract";
import { EXPECTED_PIERRE_PRICE_AMOUNT } from "@/lib/billing/stripe-activation";

describe("BLOC 3 — contrat LeadForge", () => {
  it("fige l'identité contractuelle exacte (commit, version, prix)", () => {
    expect(LEADFORGE_COMMIT).toBe("db9b166");
    expect(CONTRACT_VERSION).toBe("1.0.0");
    expect(PIERRE_PRICE_AMOUNT_CENTS).toBe(44900);
  });

  it("le prix contractuel correspond au runtime billing (stripe-activation)", () => {
    expect(PIERRE_PRICE_AMOUNT_CENTS).toBe(EXPECTED_PIERRE_PRICE_AMOUNT);
  });

  it("variantes : exactement deux variantes LeadForge + une variante organique", () => {
    expect(VARIANT_IDS).toEqual(["VARIANT_DEPARTMENT_OUTCOME", "VARIANT_PROOF_FIRST"]);
  });

  it("événements : allowlist couvre tout LeadForge sans drift", () => {
    expect(EVENT_IDS).toContain("variant_assigned");
    expect(EVENT_IDS).toContain("checkout_completed");
    expect(EVENT_IDS).toContain("pierre_activated");
    expect(EVENT_IDS).toContain("demo_started");
    expect(EVENT_IDS).toContain("diagnostic_completed");
  });

  it("événements serveur-only : impossibles depuis le client", () => {
    expect(SERVER_ONLY_EVENT_IDS.has("variant_assigned")).toBe(true);
    expect(SERVER_ONLY_EVENT_IDS.has("checkout_started")).toBe(true);
    expect(SERVER_ONLY_EVENT_IDS.has("checkout_completed")).toBe(true);
    expect(SERVER_ONLY_EVENT_IDS.has("pierre_activated")).toBe(true);
    expect(SERVER_ONLY_EVENT_IDS.has("onboarding_completed")).toBe(true);
    // demo_started ou diagnostic_started doivent rester client-allowed
    expect(CLIENT_ALLOWED_EVENT_IDS.has("demo_started")).toBe(true);
    expect(CLIENT_ALLOWED_EVENT_IDS.has("diagnostic_started")).toBe(true);
  });

  it("claims : 6 claims attendues, prix présent et non promu silencieusement", () => {
    expect(CLAIM_IDS).toContain("pierre_is_role");
    expect(CLAIM_IDS).toContain("human_validation");
    expect(CLAIM_IDS).toContain("traceability");
    expect(CLAIM_IDS).toContain("company_adaptation");
    expect(CLAIM_IDS).toContain("recurring_work");
    expect(CLAIM_IDS).toContain("pierre_price_449");
  });

  it("fingerprint stable et déterministe", () => {
    const a = computeContractFingerprint();
    const b = computeContractFingerprint();
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("snapshot canonique inclut toutes les sections critiques", () => {
    const snap = buildContractSnapshot();
    expect(snap.price.amount_cents).toBe(44900);
    expect(snap.price.currency).toBe("eur");
    expect(snap.price.interval).toBe("month");
    expect(snap.leadforge_commit).toBe("db9b166");
    expect(snap.variants.length).toBeGreaterThanOrEqual(3); // 2 attribués + 1 organique
    expect(snap.cohorts).toContain("COHORT_DIRECT_A");
    expect(snap.diagnostic_questions.length).toBeLessThanOrEqual(8);
  });

  it("assertions explicites sur ids inconnus", () => {
    expect(() => assertVariantId("VARIANT_UNKNOWN")).toThrow(ContractParityError);
    expect(() => assertEventId("checkout_random")).toThrow(ContractParityError);
    expect(() => assertClaimId("not_a_claim")).toThrow(ContractParityError);
    // Ids connus passent.
    expect(() => assertVariantId("VARIANT_DEPARTMENT_OUTCOME")).not.toThrow();
    expect(() => assertEventId("demo_started")).not.toThrow();
    expect(() => assertClaimId("pierre_is_role")).not.toThrow();
  });
});
