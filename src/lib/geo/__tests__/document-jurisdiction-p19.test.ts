// src/lib/geo/__tests__/document-jurisdiction-p19.test.ts
// P19 — the document jurisdiction bridge: a Pierre document type is classified against the P18 country
// authority. FR contract/amendment/exit templates are NEVER served (finalizable) to BE/LU/CH; unknown
// country on a jurisdictional document is blocked (never a silent France fallback); generic HR
// correspondence is allowed everywhere but never over-claims local legal framing outside FR.

import { describe, it, expect } from "vitest";
import {
  resolveDocumentJurisdiction,
  jurisdictionalTemplateKeyForDocType,
  isJurisdictionalDocType,
} from "../document-jurisdiction";

describe("P19 — docType → jurisdictional template mapping", () => {
  it("maps contract-ish types to employment_contract", () => {
    expect(jurisdictionalTemplateKeyForDocType("contract")).toBe("employment_contract");
    expect(jurisdictionalTemplateKeyForDocType("contrat de travail")).toBe("employment_contract");
    expect(jurisdictionalTemplateKeyForDocType("hr_contract_draft")).toBe("employment_contract");
    expect(jurisdictionalTemplateKeyForDocType("CDI")).toBe("employment_contract");
  });
  it("maps avenant/amendment to amendment", () => {
    expect(jurisdictionalTemplateKeyForDocType("amendment")).toBe("amendment");
    expect(jurisdictionalTemplateKeyForDocType("avenant au contrat")).toBe("amendment");
    expect(jurisdictionalTemplateKeyForDocType("hr_contract_amendment")).toBe("amendment");
  });
  it("maps exit/offboarding/work-certificate to exit_certificate", () => {
    expect(jurisdictionalTemplateKeyForDocType("offboarding_checklist")).toBe("exit_certificate");
    expect(jurisdictionalTemplateKeyForDocType("certificat de travail")).toBe("exit_certificate");
    expect(jurisdictionalTemplateKeyForDocType("documents de sortie")).toBe("exit_certificate");
  });
  it("maps the B45 employment_certificate (certificat de travail) to exit_certificate — it IS jurisdictional", () => {
    // Regression: the B45 registry ships `employment_certificate`; it previously slipped through as generic
    // correspondence and would have been generatable for BE/LU/CH with the French framing.
    expect(jurisdictionalTemplateKeyForDocType("employment_certificate")).toBe("exit_certificate");
    expect(jurisdictionalTemplateKeyForDocType("employment certificate")).toBe("exit_certificate");
    expect(resolveDocumentJurisdiction("CH", "employment_certificate").status).toBe("blocked_no_local_template");
    expect(resolveDocumentJurisdiction("FR", "employment_certificate").finalizationAllowed).toBe(false);
  });
  it("does NOT over-match a bare certificate (a training attestation is not a legal exit document)", () => {
    expect(jurisdictionalTemplateKeyForDocType("training_certificate")).toBeNull();
    expect(jurisdictionalTemplateKeyForDocType("certificate")).toBeNull();
  });
  it("classifies generic correspondence as non-jurisdictional", () => {
    for (const t of ["offre_emploi", "convocation_entretien", "refus_candidat", "relance_rh", "note_rh", "hr_weekly_briefing", "manager_notification", "onboarding", ""]) {
      expect(jurisdictionalTemplateKeyForDocType(t)).toBeNull();
      expect(isJurisdictionalDocType(t)).toBe(false);
    }
    expect(isJurisdictionalDocType("contrat")).toBe(true);
  });
});

describe("P19 — FR verified/draftable jurisdictional documents", () => {
  it("FR employment_contract is draftable with mandatory human validation (never auto-final)", () => {
    const d = resolveDocumentJurisdiction("FR", "contrat de travail");
    expect(d.jurisdictional).toBe(true);
    expect(d.templateKey).toBe("employment_contract");
    expect(d.country).toBe("FR");
    // FR employment_contract availability is HUMAN_VALIDATION_REQUIRED → draft, not final.
    expect(d.finalizationAllowed).toBe(false);
    expect(d.draftAllowed).toBe(true);
    expect(d.requiresHumanValidation).toBe(true);
    expect(d.status).toBe("draft_human_validation_required");
    expect(d.notice).toContain("FR");
  });
  it("FR exit_certificate is disabled until verified (blocked, never final)", () => {
    const d = resolveDocumentJurisdiction("FR", "documents de sortie");
    expect(d.status).toBe("blocked_no_local_template");
    expect(d.finalizationAllowed).toBe(false);
  });
});

describe("P19 — the D6 defect is closed: no FR template served to BE/LU/CH", () => {
  for (const country of ["BE", "LU", "CH"] as const) {
    it(`${country} employment_contract is BLOCKED — never the French model`, () => {
      const d = resolveDocumentJurisdiction(country, "contrat de travail");
      expect(d.jurisdictional).toBe(true);
      expect(d.country).toBe(country);
      expect(d.finalizationAllowed).toBe(false);
      expect(d.draftAllowed).toBe(false);
      expect(d.status).toBe("blocked_no_local_template");
      expect(d.notice).toMatch(/jamais le modèle français/i);
    });
    it(`${country} amendment is BLOCKED`, () => {
      expect(resolveDocumentJurisdiction(country, "avenant").status).toBe("blocked_no_local_template");
    });
    it(`${country} generic correspondence is allowed but flagged non-verified`, () => {
      const d = resolveDocumentJurisdiction(country, "offre_emploi");
      expect(d.jurisdictional).toBe(false);
      expect(d.status).toBe("generated");
      expect(d.notice).toContain(country);
      expect(d.notice).toMatch(/générique/i);
    });
  }
});

describe("P19 — fail-closed on unknown/missing/unsupported country (never France)", () => {
  it("missing country on a jurisdictional document → country required, blocked", () => {
    const d = resolveDocumentJurisdiction(null, "contrat de travail");
    expect(d.status).toBe("blocked_country_required");
    expect(d.finalizationAllowed).toBe(false);
    expect(d.country).toBeNull();
  });
  it("empty string country on a jurisdictional document → country required", () => {
    expect(resolveDocumentJurisdiction("", "avenant").status).toBe("blocked_country_required");
  });
  it("unsupported country on a jurisdictional document → unsupported, blocked (no FR fallback)", () => {
    const d = resolveDocumentJurisdiction("US", "contrat de travail");
    expect(d.status).toBe("blocked_country_unsupported");
    expect(d.finalizationAllowed).toBe(false);
  });
  it("missing country on generic correspondence is still allowed (no legal template involved)", () => {
    const d = resolveDocumentJurisdiction(null, "note_rh");
    expect(d.status).toBe("generated");
    expect(d.notice).toBeNull();
  });
});
