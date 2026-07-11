// src/lib/clonestore/pricing/__tests__/pricing-audit.test.ts
// P10 §9 — audit privacy-safe (jamais d'IP brute ; hash salé tronqué).
import { describe, it, expect } from "vitest";
import { hashIp, buildPricingAuditRecord, recordPricingDecision } from "../pricing-audit";

describe("P10 pricing audit trail", () => {
  it("hashIp never returns the raw IP; deterministic with salt; null without ip/salt", () => {
    const h = hashIp("203.0.113.7", "s3cr3t-salt");
    expect(h).not.toContain("203.0.113.7");
    expect(h).toMatch(/^ip_[0-9a-f]{20}$/);
    expect(hashIp("203.0.113.7", "s3cr3t-salt")).toBe(h); // deterministic
    expect(hashIp("203.0.113.8", "s3cr3t-salt")).not.toBe(h); // different ip → different hash
    expect(hashIp(null, "s")).toBeNull();
    expect(hashIp("1.2.3.4", null)).toBeNull();
  });

  it("buildPricingAuditRecord captures all fields and hashes the ip (no raw ip stored)", () => {
    const rec = buildPricingAuditRecord({
      requestId: "req-1", userId: "u1", selectedCountry: "FR", resolvedCountry: "CH", geoCountry: "CH",
      companyCountry: "CH", requestedPriceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", resolvedPriceKey: "STRIPE_PRICE_PIERRE_CHF_MONTHLY",
      currency: "CHF", decision: "blocked", reasonCode: "COMPANY_COUNTRY_CONFLICT", ip: "198.51.100.42", at: "2026-07-08T10:00:00.000Z",
    }, { salt: "salt" });
    expect(rec.auditId).toMatch(/^pa_/);
    expect(rec.decision).toBe("blocked");
    expect(rec.reasonCode).toBe("COMPANY_COUNTRY_CONFLICT");
    expect(rec.resolvedCountry).toBe("CH");
    expect(rec.ipHash).toMatch(/^ip_/);
    // the record must NOT contain the raw ip anywhere
    expect(JSON.stringify(rec)).not.toContain("198.51.100.42");
    expect((rec as unknown as { ip?: string }).ip).toBeUndefined();
  });

  it("recordPricingDecision returns an auditId and writes to an injected sink", () => {
    const seen: unknown[] = [];
    const id = recordPricingDecision(
      { decision: "country_required", reasonCode: "COUNTRY_REQUIRED", at: "2026-07-08T10:00:00.000Z" },
      { sink: (r) => seen.push(r), salt: "salt", auditId: "pa_fixed" },
    );
    expect(id).toBe("pa_fixed");
    expect(seen).toHaveLength(1);
    expect((seen[0] as { reasonCode: string }).reasonCode).toBe("COUNTRY_REQUIRED");
  });

  it("audit is best-effort: a throwing sink does not throw out", () => {
    expect(() => recordPricingDecision(
      { decision: "allowed", reasonCode: "ALLOWED", at: "2026-07-08T10:00:00.000Z" },
      { sink: () => { throw new Error("sink down"); } },
    )).not.toThrow();
  });
});
