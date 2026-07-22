// src/lib/clonestore/cloneadn/canonical/__tests__/canonical-adn-p19.test.ts
// P19 — the canonical CloneADN convergence: 3 legacy substrates → one value, conflicts explicit, geo country
// authoritative (never FR seed), no cross-tenant/entity contamination, in-memory never authoritative.

import { describe, it, expect } from "vitest";
import {
  fromCloneAdnB28, fromEnterpriseEmpreinteB44, fromGlobalEnterpriseMemoryTech05, resolveCanonicalAdn,
} from "../canonical-adn";
import { applyApprovedLearningToAdn } from "../../../clonelearn/canonical/learning-loop";

describe("P19 — same info from B28 and B44 → same canonical value", () => {
  it("agreeing tone yields no conflict", () => {
    const canon = resolveCanonicalAdn({
      company_id: "A", geoLegalCountry: "FR",
      sources: [
        fromCloneAdnB28({ communication: { tone: "chaleureux" } }),
        fromEnterpriseEmpreinteB44({ communication: { tone: "chaleureux" } }),
      ],
    });
    expect(canon.fields.tone).toBe("chaleureux");
    expect(canon.conflicts.find((c) => c.field === "tone")).toBeUndefined();
  });
});

describe("P19 — conflicting values are recorded explicitly (no silent overwrite)", () => {
  it("B28 tone formal vs B44 tone warm → conflict, higher-confidence chosen", () => {
    const canon = resolveCanonicalAdn({
      company_id: "A", geoLegalCountry: "FR",
      sources: [
        fromCloneAdnB28({ communication: { tone: "formel" } }),        // confidence 0.8
        fromEnterpriseEmpreinteB44({ communication: { tone: "chaleureux" } }), // confidence 0.85 → wins
      ],
    });
    expect(canon.fields.tone).toBe("chaleureux");
    const conflict = canon.conflicts.find((c) => c.field === "tone")!;
    expect(conflict.chosen.value).toBe("chaleureux");
    expect(conflict.rejected.map((r) => r.value)).toContain("formel");
  });
});

describe("P19 — geo country is authoritative; the legacy FR seed never wins", () => {
  it("legacy declares FR but geo says CH → canonical country CH + recorded conflict", () => {
    const canon = resolveCanonicalAdn({
      company_id: "A", geoLegalCountry: "CH",
      sources: [
        fromEnterpriseEmpreinteB44({ company_id: "A", company_identity: { country_code: "FR" }, data_governance: { region: "eu" } }),
      ],
    });
    expect(canon.legal_country).toBe("CH");        // never the FR seed
    expect(canon.conflicts.find((c) => c.field === "legal_country")?.rejected[0].value).toBe("FR");
  });
  it("unknown geo country → canonical null (never silent FR)", () => {
    const canon = resolveCanonicalAdn({ company_id: "A", geoLegalCountry: null, sources: [fromCloneAdnB28({ country_code: "FR" })] });
    expect(canon.legal_country).toBeNull();
  });
});

describe("P19 — in-memory TECH-05 is never authoritative", () => {
  it("TECH-05-only field is kept but flagged non-authoritative; durable source always wins", () => {
    const canon = resolveCanonicalAdn({
      company_id: "A", geoLegalCountry: "FR",
      sources: [
        fromCloneAdnB28({ communication: { tone: "sobre" } }),                    // durable
        fromGlobalEnterpriseMemoryTech05({ identity: { name: "Acme" }, language: "en" }), // in-memory
      ],
    });
    // durable B28 has no identity_name → TECH-05 provides it but flagged
    expect(canon.nonAuthoritativeIgnored).toContain("identity_name");
    expect(canon.fields.tone).toBe("sobre");
  });
  it("durable vs in-memory disagreement → durable wins, in-memory not authoritative", () => {
    const canon = resolveCanonicalAdn({
      company_id: "A", geoLegalCountry: "FR",
      sources: [
        fromCloneAdnB28({ communication: { preferred_language: "fr" } }),          // durable 0.8
        fromGlobalEnterpriseMemoryTech05({ language: "en" }),                      // in-memory 0.2
      ],
    });
    expect(canon.fields.default_language).toBe("fr");
    expect(canon.field_provenance.default_language.provenance).toBe("B28:clone_adn");
  });
});

describe("P19 — no cross-tenant/entity contamination; feeds CloneLearn", () => {
  it("each company resolves independently and CloneLearn patches the right tenant", () => {
    const a = resolveCanonicalAdn({ company_id: "A", geoLegalCountry: "FR", sources: [fromCloneAdnB28({ communication: { tone: "a" } })] });
    const b = resolveCanonicalAdn({ company_id: "B", geoLegalCountry: "CH", sources: [fromCloneAdnB28({ communication: { tone: "b" } })] });
    expect(a.company_id).toBe("A");
    expect(b.company_id).toBe("B");
    // CloneADN satisfies VersionedAdnLike → CloneLearn can version it
    const a2 = applyApprovedLearningToAdn(a, { status: "approved", company_id: "A", field: "tone", value: "warmer", reviewer_user_id: "o", reviewed_at: "t", confidence: 0.9 });
    expect(a2.version).toBe(2);
    expect(a2.fields.tone).toBe("warmer");
    expect(b.fields.tone).toBe("b"); // B untouched
    // cross-tenant application into B refused
    expect(() => applyApprovedLearningToAdn(b, { status: "approved", company_id: "A", field: "tone", value: "x", reviewer_user_id: "o", reviewed_at: "t", confidence: 0.9 })).toThrow(/cross-tenant/);
  });
});
