// src/lib/clonestore/production/__tests__/p11-legal-tax-readiness.test.ts
// P11 §9 — legal/tax readiness: no external proof → not ready; cannot self-verify.
import { describe, it, expect } from "vitest";
import { evaluateLegalTaxReadiness, LEGAL_TAX_COUNTRIES } from "../p11-legal-tax-readiness";

describe("P11 legal/tax readiness", () => {
  it("no external proof → LEGAL_TAX_READY false", () => {
    const r = evaluateLegalTaxReadiness({});
    expect(r.legalTaxReady).toBe(false);
    expect(r.ready).toBe(false);
    expect(r.blockers.length).toBeGreaterThan(0);
    expect(r.requiredExternalReviews.length).toBeGreaterThan(0);
  });

  it("lists all four launch countries", () => {
    const r = evaluateLegalTaxReadiness({});
    expect(r.countryChecklist.map((c) => c.country).sort()).toEqual(["BE", "CH", "FR", "LU"]);
    expect(LEGAL_TAX_COUNTRIES).toEqual(["FR", "BE", "LU", "CH"]);
  });

  it("lists all required documents (CGU/CGV/DPA/privacy/mentions/refund/payment/AI-disclaimer/HR-boundary/subprocessors/country-notes)", () => {
    const r = evaluateLegalTaxReadiness({});
    const keys = r.documentChecklist.map((d) => d.key);
    for (const k of ["cgu", "cgv", "dpa_gdpr", "privacy", "mentions_legales", "refund_cancellation", "payment_terms", "ai_employee_disclaimer", "hr_legal_boundary", "subprocessors", "country_billing_tax_notes"]) {
      expect(keys).toContain(k);
    }
  });

  it("without proof, every document + country is external_pending (never verified)", () => {
    const r = evaluateLegalTaxReadiness({});
    expect(r.documentChecklist.every((d) => d.status === "external_pending")).toBe(true);
    expect(r.countryChecklist.every((c) => c.status === "external_pending")).toBe(true);
    expect(r.documentChecklist.some((d) => d.status === "verified")).toBe(false);
  });

  it("cross-border tax questions present (CHF/EUR, reverse charge, entity, Swiss-launch-while-French)", () => {
    const r = evaluateLegalTaxReadiness({});
    const blob = r.crossBorderTaxQuestions.map((q) => q.q).join(" ").toLowerCase();
    expect(blob).toContain("chf");
    expect(blob).toContain("reverse charge");
    expect(blob).toContain("suisse");
  });

  it("becomes verified ONLY with BOTH owner-attestation artifacts (owner-gated; P11 does not perform the review)", () => {
    const withProof = evaluateLegalTaxReadiness({ CLONESTORE_LEGAL_REVIEW_PROOF: "true", CLONESTORE_TAX_REVIEW_PROOF: "true" });
    expect(withProof.legalTaxReady).toBe(true);
    expect(withProof.countryChecklist.every((c) => c.status === "verified")).toBe(true);
    // only legal proof, no tax proof → still not ready
    const legalOnly = evaluateLegalTaxReadiness({ CLONESTORE_LEGAL_REVIEW_PROOF: "true" });
    expect(legalOnly.legalTaxReady).toBe(false);
  });
});
