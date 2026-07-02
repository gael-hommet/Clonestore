// src/lib/pierre/v1/hr-canon/country-packs/__tests__/p812-sourcing-engine.test.ts
// PHASE 8.12 — the sourcing/rule engine enforces "never invent law": the source register carries only
// official-authority POINTERS (no content, no rule values), a rule is usable only when VERIFIED +
// fresh, and a rule can only become VERIFIED via a valid NAMED HUMAN attestation — an AI/model/system
// can never be the reviewer.

import { describe, it, expect } from "vitest";
import { OFFICIAL_SOURCES, validateOfficialSource, sourcesForRuleFamily } from "../source-registry";
import { evaluateRule } from "../rule-evaluator";
import { evaluateFreshness } from "../source-freshness";
import { verifyRuleWithAttestation, isValidHumanReviewer, validateAttestation, buildReviewPacket } from "../legal-review";
import { buildSnapshot, validateSnapshot } from "../source-snapshot";
import { sourceRequired } from "../source-contract";
import { COUNTRY_PACKS, validateAllPacks } from "../index";

describe("P8.12 official source register", () => {
  it("contains only POINTER_ONLY official sources (no content, no dates, https portals)", () => {
    for (const s of OFFICIAL_SOURCES) {
      expect(validateOfficialSource(s), s.id).toEqual([]);
      expect(s.retrievalStatus).toBe("POINTER_ONLY");
      expect(s.contentHash).toBeNull();
      expect(s.retrievedAt).toBeNull();
      expect(s.officialUrl.startsWith("https://")).toBe(true);
    }
  });
  it("covers all four jurisdictions and maps rule families", () => {
    for (const j of ["FR", "BE", "LU", "CH"] as const) expect(OFFICIAL_SOURCES.some((s) => s.jurisdiction === j)).toBe(true);
    expect(sourcesForRuleFamily("FR", "payroll_contributions").length).toBeGreaterThan(0);
  });
});

describe("P8.12 never invent law", () => {
  it("all country-pack rules remain unVERIFIED with null values (0 invented)", () => {
    const r = validateAllPacks();
    expect(r.ok).toBe(true);
    for (const pack of COUNTRY_PACKS) for (const fam of pack.families) for (const rule of fam.rules) {
      expect(rule.status).not.toBe("VERIFIED");
      expect(rule.value).toBeNull();
    }
  });
  it("an unVERIFIED rule is NOT usable (fail-closed)", () => {
    const rule = sourceRequired("paid_leave.annual_entitlement", "x", ["primary_legislation"]);
    expect(evaluateRule(rule, "paid_leave").usable).toBe(false);
  });
  it("an AI/model/system can NEVER be the legal reviewer", () => {
    expect(isValidHumanReviewer("Claude")).toBe(false);
    expect(isValidHumanReviewer("Pierre AI")).toBe(false);
    expect(isValidHumanReviewer("the model")).toBe(false);
    expect(isValidHumanReviewer("Maître Dupont")).toBe(true);
  });
  it("verifyRuleWithAttestation refuses without a valid human attestation", () => {
    const rule = sourceRequired("notice_periods.resignation_notice", "x", ["primary_legislation"]);
    const bad = verifyRuleWithAttestation(rule, "cite", 30, { reviewerName: "Claude", reviewerQualification: "AI", reviewerContact: "-", attestedAt: "2026-07-02T10:00:00Z", statement: "ok", signatureRef: "sig" });
    expect(bad.verified).toBe(false);
    // even a well-formed human attestation only flips THAT rule (still requires value+citation)
    const good = verifyRuleWithAttestation(rule, "Code du travail art. X", 30, { reviewerName: "Maître Dupont", reviewerQualification: "avocat en droit social", reviewerContact: "x@cabinet.fr", attestedAt: "2026-07-02T10:00:00Z", statement: "confirmed", signatureRef: "sig-123" });
    expect(good.verified).toBe(true);
    expect(good.rule.status).toBe("VERIFIED");
    expect(good.rule.reviewedBy).toContain("Maître Dupont");
    // and once VERIFIED it becomes usable when fresh
    expect(evaluateRule(good.rule, "notice_periods", { retrievedAt: "2026-07-01T00:00:00Z", nowIso: "2026-07-02T00:00:00Z" }).usable).toBe(true);
  });
  it("a VERIFIED-but-stale rule is blocked", () => {
    const rule = { ...sourceRequired("minimum_wage.statutory_minimum", "x", ["primary_legislation"]), status: "VERIFIED" as const, value: 1, sourceCitation: "cite", reviewedBy: "Maître X" };
    const stale = evaluateRule(rule, "minimum_wage", { retrievedAt: "2020-01-01T00:00:00Z", nowIso: "2026-07-02T00:00:00Z" });
    expect(stale.usable).toBe(false);
    expect(stale.reason).toMatch(/stale/);
  });
});

describe("P8.12 snapshot integrity + review packet", () => {
  it("cannot snapshot a POINTER_ONLY source; a real snapshot needs a sha256", () => {
    expect(() => buildSnapshot(OFFICIAL_SOURCES[0], Buffer.from("x"), "2026-07-02T10:00:00Z", "ref")).toThrow();
    const snap = buildSnapshot({ ...OFFICIAL_SOURCES[0], retrievalStatus: "ARCHIVED" }, Buffer.from("official text"), "2026-07-02T10:00:00Z", "archive://x");
    expect(validateSnapshot(snap)).toEqual([]);
  });
  it("builds a review packet awaiting sourcing", () => {
    const rule = sourceRequired("paid_leave.annual_entitlement", "x", ["primary_legislation"]);
    const packet = buildReviewPacket(rule, "FR", "paid_leave", sourcesForRuleFamily("FR", "paid_leave"));
    expect(packet.status).toBe("AWAITING_SOURCING");
    expect(packet.officialSources.length).toBeGreaterThan(0);
  });
  it("freshness marks never-retrieved as not fresh", () => {
    expect(evaluateFreshness("paid_leave", null, "2026-07-02T00:00:00Z").fresh).toBe(false);
  });
});
