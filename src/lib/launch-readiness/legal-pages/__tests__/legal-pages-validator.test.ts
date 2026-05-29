// P-FINAL 01 — Phase 2 — Tests for legal pages validator library.
// All simulate-route: pure functions only, no Supabase, no Next, no async.

import { describe, it, expect } from "vitest";
import {
  getAllLegalPageIds,
  getRequiredForLaunchPageIds,
  getLegalPageDefinition,
} from "../legal-page-registry";
import {
  runContentGuard,
  hasForbiddenClaims,
  hasRequiredDisclaimers,
  checkPierreHardLimitsInContent,
} from "../legal-page-content-guard";
import {
  buildPresenceChecks,
  buildManualValidationCheck,
  getPageStatusFromFlags,
  getDefaultManualLegalPageFlags,
} from "../legal-page-checks";
import {
  buildLegalPageReport,
  buildLegalPagesVerdict,
  buildDefaultLegalPagesVerdict,
  isLegalPagesPublicLaunchBlocked,
} from "../legal-page-verdict";
import {
  FIXTURE_ALL_PAGES_PRESENT,
  FIXTURE_PARTIAL_PAGES,
  FIXTURE_NO_PAGES,
  FIXTURE_FLAGS_ALL_FALSE,
  FIXTURE_FLAGS_ALL_TRUE,
  FIXTURE_FLAGS_PARTIAL,
  FIXTURE_CGU_CLEAN_CONTENT,
  FIXTURE_CGU_FORBIDDEN_CONTENT,
  FIXTURE_CGU_MISSING_DISCLAIMER_CONTENT,
  FIXTURE_CONFIDENTIALITE_CLEAN_CONTENT,
} from "../fixtures";

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("legal-page-registry", () => {
  it("returns all 5 legal page ids", () => {
    const ids = getAllLegalPageIds();
    expect(ids).toHaveLength(5);
    expect(ids).toContain("cgu");
    expect(ids).toContain("cgv");
    expect(ids).toContain("dpa");
    expect(ids).toContain("mentions");
    expect(ids).toContain("confidentialite");
  });

  it("all 5 pages are required for launch", () => {
    const required = getRequiredForLaunchPageIds();
    expect(required).toHaveLength(5);
  });

  it("cgu has required sections including limites_ia", () => {
    const def = getLegalPageDefinition("cgu");
    const sectionIds = def.required_sections.map((s) => s.id);
    expect(sectionIds).toContain("limites_ia");
    expect(sectionIds).toContain("usages_interdits");
    expect(sectionIds).toContain("donnees_rh");
  });

  it("cgv has tarifs and exclusions sections", () => {
    const def = getLegalPageDefinition("cgv");
    const sectionIds = def.required_sections.map((s) => s.id);
    expect(sectionIds).toContain("tarifs");
    expect(sectionIds).toContain("exclusions");
    expect(sectionIds).toContain("remboursement");
  });

  it("dpa has sous_traitants section", () => {
    const def = getLegalPageDefinition("dpa");
    const sectionIds = def.required_sections.map((s) => s.id);
    expect(sectionIds).toContain("sous_traitants");
    expect(sectionIds).toContain("violation");
  });

  it("mentions has editeur section", () => {
    const def = getLegalPageDefinition("mentions");
    const sectionIds = def.required_sections.map((s) => s.id);
    expect(sectionIds).toContain("editeur");
    expect(sectionIds).toContain("hebergement");
  });

  it("cgu forbidden claims include Pierre garantit la conformité légale", () => {
    const def = getLegalPageDefinition("cgu");
    expect(def.forbidden_claims).toContain("Pierre garantit la conformité légale");
  });

  it("cgv forbidden claims include essai gratuit illimité", () => {
    const def = getLegalPageDefinition("cgv");
    expect(def.forbidden_claims).toContain("essai gratuit illimité");
  });

  it("cgv forbidden claims include essai gratuit de 7 jours", () => {
    const def = getLegalPageDefinition("cgv");
    expect(def.forbidden_claims).toContain("essai gratuit de 7 jours");
  });

  it("each page has a non-empty title and path", () => {
    for (const id of getAllLegalPageIds()) {
      const def = getLegalPageDefinition(id);
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.path).toMatch(/^\/legal\//);
    }
  });

  it("required_for_public_launch is true for all 5 pages", () => {
    for (const id of getAllLegalPageIds()) {
      const def = getLegalPageDefinition(id);
      expect(def.required_for_public_launch).toBe(true);
    }
  });
});

// ─── Content Guard ────────────────────────────────────────────────────────────

describe("legal-page-content-guard", () => {
  it("clean CGU content passes forbidden checks", () => {
    const result = runContentGuard("cgu", FIXTURE_CGU_CLEAN_CONTENT);
    expect(result.forbidden_found).toHaveLength(0);
    expect(result.passes).toBe(true);
  });

  it("forbidden CGU content fails content guard", () => {
    const result = runContentGuard("cgu", FIXTURE_CGU_FORBIDDEN_CONTENT);
    expect(result.forbidden_found.length).toBeGreaterThan(0);
    expect(result.passes).toBe(false);
  });

  it("forbidden content produces blocking checks that fail", () => {
    const result = runContentGuard("cgu", FIXTURE_CGU_FORBIDDEN_CONTENT);
    const failingBlocking = result.checks.filter(
      (c) => c.severity === "blocking" && !c.passes
    );
    expect(failingBlocking.length).toBeGreaterThan(0);
  });

  it("clean content has no failing blocking checks", () => {
    const result = runContentGuard("cgu", FIXTURE_CGU_CLEAN_CONTENT);
    const failingBlocking = result.checks.filter(
      (c) => c.severity === "blocking" && !c.passes
    );
    expect(failingBlocking).toHaveLength(0);
  });

  it("hasForbiddenClaims returns true for forbidden content", () => {
    expect(hasForbiddenClaims("cgu", FIXTURE_CGU_FORBIDDEN_CONTENT)).toBe(true);
  });

  it("hasForbiddenClaims returns false for clean content", () => {
    expect(hasForbiddenClaims("cgu", FIXTURE_CGU_CLEAN_CONTENT)).toBe(false);
  });

  it("hasRequiredDisclaimers returns true for clean content", () => {
    expect(hasRequiredDisclaimers("cgu", FIXTURE_CGU_CLEAN_CONTENT)).toBe(true);
  });

  it("hasRequiredDisclaimers returns false for content missing disclaimers", () => {
    expect(hasRequiredDisclaimers("cgu", FIXTURE_CGU_MISSING_DISCLAIMER_CONTENT)).toBe(false);
  });

  it("case-insensitive: forbidden check ignores case", () => {
    const upperForbidden = "PIERRE GARANTIT LA CONFORMITÉ LÉGALE de tous les documents";
    const result = runContentGuard("cgu", upperForbidden);
    expect(result.forbidden_found.length).toBeGreaterThan(0);
  });

  it("confidentialite clean content passes", () => {
    const result = runContentGuard("confidentialite", FIXTURE_CONFIDENTIALITE_CLEAN_CONTENT);
    expect(result.passes).toBe(true);
  });

  it("checkPierreHardLimitsInContent returns no violations for clean content", () => {
    const result = checkPierreHardLimitsInContent(FIXTURE_CGU_CLEAN_CONTENT);
    expect(result.violations).toHaveLength(0);
    expect(result.passes).toBe(true);
  });

  it("checkPierreHardLimitsInContent detects violation", () => {
    const result = checkPierreHardLimitsInContent(
      "Pierre garantit la conformité de tous vos documents RH."
    );
    expect(result.passes).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("runContentGuard returns checks array with items", () => {
    const result = runContentGuard("cgv", "essai gratuit de 7 jours disponible sans engagement.");
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it("DPA content guard: no forbidden claims for clean content", () => {
    const clean = "Ce DPA régit le traitement des données. Validation juridique requise. RGPD applicable.";
    const result = runContentGuard("dpa", clean);
    expect(result.passes).toBe(true);
  });
});

// ─── Presence Checks ──────────────────────────────────────────────────────────

describe("legal-page-checks — presence", () => {
  it("page not present → page_exists check fails with blocking severity", () => {
    const checks = buildPresenceChecks("cgu", {
      page_id: "cgu",
      exists: false,
      has_draft_banner: false,
      sections_present: [],
    });
    const existsCheck = checks.find((c) => c.id === "cgu_page_exists");
    expect(existsCheck).toBeDefined();
    expect(existsCheck!.passes).toBe(false);
    expect(existsCheck!.severity).toBe("blocking");
  });

  it("page not present → only existence check returned", () => {
    const checks = buildPresenceChecks("cgu", {
      page_id: "cgu",
      exists: false,
      has_draft_banner: false,
      sections_present: [],
    });
    expect(checks).toHaveLength(1);
  });

  it("page present → more than 1 check", () => {
    const checks = buildPresenceChecks("cgu", {
      page_id: "cgu",
      exists: true,
      has_draft_banner: true,
      sections_present: ["objet", "acceptation", "acces", "limites_ia", "donnees_rh", "usages_interdits", "suspension", "propriete"],
    });
    expect(checks.length).toBeGreaterThan(1);
  });

  it("page present, draft banner missing → warning check fails", () => {
    const checks = buildPresenceChecks("cgu", {
      page_id: "cgu",
      exists: true,
      has_draft_banner: false,
      sections_present: ["objet"],
    });
    const bannerCheck = checks.find((c) => c.id === "cgu_has_draft_banner");
    expect(bannerCheck).toBeDefined();
    expect(bannerCheck!.passes).toBe(false);
    expect(bannerCheck!.severity).toBe("warning");
  });

  it("all required sections present → all section checks pass", () => {
    const def = getLegalPageDefinition("cgu");
    const allSectionIds = def.required_sections
      .filter((s) => s.required_for_public_launch)
      .map((s) => s.id);
    const checks = buildPresenceChecks("cgu", {
      page_id: "cgu",
      exists: true,
      has_draft_banner: true,
      sections_present: allSectionIds,
    });
    const sectionChecks = checks.filter((c) => c.id.startsWith("cgu_section_"));
    const failingSections = sectionChecks.filter((c) => !c.passes);
    expect(failingSections).toHaveLength(0);
  });

  it("missing section → section check fails with warning", () => {
    const checks = buildPresenceChecks("cgu", {
      page_id: "cgu",
      exists: true,
      has_draft_banner: true,
      sections_present: ["objet"],
    });
    const failingSections = checks.filter(
      (c) => c.id.startsWith("cgu_section_") && !c.passes
    );
    expect(failingSections.length).toBeGreaterThan(0);
    expect(failingSections[0].severity).toBe("warning");
  });
});

// ─── Manual Validation Check ──────────────────────────────────────────────────

describe("legal-page-checks — manual validation", () => {
  it("is_manual: true when validation check", () => {
    const check = buildManualValidationCheck("cgu", false);
    expect(check.is_manual).toBe(true);
  });

  it("passes: false when not validated", () => {
    const check = buildManualValidationCheck("cgu", false);
    expect(check.passes).toBe(false);
    expect(check.severity).toBe("blocking");
  });

  it("passes: true when validated", () => {
    const check = buildManualValidationCheck("cgu", true);
    expect(check.passes).toBe(true);
  });

  it("getDefaultManualLegalPageFlags all false", () => {
    const flags = getDefaultManualLegalPageFlags();
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  it("getPageStatusFromFlags missing page → missing", () => {
    const status = getPageStatusFromFlags(
      "cgu",
      { page_id: "cgu", exists: false, has_draft_banner: false, sections_present: [] },
      FIXTURE_FLAGS_ALL_TRUE
    );
    expect(status).toBe("missing");
  });

  it("getPageStatusFromFlags present + validated → present_validated", () => {
    const status = getPageStatusFromFlags(
      "cgu",
      { page_id: "cgu", exists: true, has_draft_banner: true, sections_present: [] },
      FIXTURE_FLAGS_ALL_TRUE
    );
    expect(status).toBe("present_validated");
  });

  it("getPageStatusFromFlags present + not validated → present_draft", () => {
    const status = getPageStatusFromFlags(
      "cgu",
      { page_id: "cgu", exists: true, has_draft_banner: true, sections_present: [] },
      FIXTURE_FLAGS_ALL_FALSE
    );
    expect(status).toBe("present_draft");
  });
});

// ─── Page Report ──────────────────────────────────────────────────────────────

describe("buildLegalPageReport", () => {
  it("missing page → blocking_count > 0", () => {
    const report = buildLegalPageReport(
      { page_id: "cgu", exists: false, has_draft_banner: false, sections_present: [] },
      FIXTURE_FLAGS_ALL_FALSE
    );
    expect(report.blocking_count).toBeGreaterThan(0);
    expect(report.status).toBe("missing");
  });

  it("present + validated + all sections → blocking only from manual (passes now)", () => {
    const def = getLegalPageDefinition("cgu");
    const allSections = def.required_sections.map((s) => s.id);
    const report = buildLegalPageReport(
      { page_id: "cgu", exists: true, has_draft_banner: true, sections_present: allSections },
      FIXTURE_FLAGS_ALL_TRUE
    );
    expect(report.status).toBe("present_validated");
    expect(report.passes_all_blocking).toBe(true);
    expect(report.blocking_count).toBe(0);
  });

  it("present + not validated → manual validation check fails", () => {
    const def = getLegalPageDefinition("cgv");
    const allSections = def.required_sections.map((s) => s.id);
    const report = buildLegalPageReport(
      { page_id: "cgv", exists: true, has_draft_banner: true, sections_present: allSections },
      FIXTURE_FLAGS_ALL_FALSE
    );
    expect(report.status).toBe("present_draft");
    expect(report.passes_all_blocking).toBe(false);
    expect(report.blocking_count).toBe(1); // only manual check
  });

  it("with forbidden content → additional blocking checks", () => {
    const report = buildLegalPageReport(
      { page_id: "cgu", exists: true, has_draft_banner: true, sections_present: [] },
      FIXTURE_FLAGS_ALL_FALSE,
      FIXTURE_CGU_FORBIDDEN_CONTENT
    );
    // blocking from manual + forbidden content
    expect(report.blocking_count).toBeGreaterThan(1);
  });

  it("with clean content → no extra blocking from content guard", () => {
    const def = getLegalPageDefinition("cgu");
    const allSections = def.required_sections.map((s) => s.id);
    const report = buildLegalPageReport(
      { page_id: "cgu", exists: true, has_draft_banner: true, sections_present: allSections },
      FIXTURE_FLAGS_ALL_FALSE,
      FIXTURE_CGU_CLEAN_CONTENT
    );
    // Only 1 blocking: manual validation
    expect(report.blocking_count).toBe(1);
  });

  it("report includes all check types", () => {
    const report = buildLegalPageReport(
      { page_id: "cgu", exists: true, has_draft_banner: true, sections_present: [] },
      FIXTURE_FLAGS_ALL_FALSE
    );
    expect(report.checks.length).toBeGreaterThan(1);
  });
});

// ─── Verdict ──────────────────────────────────────────────────────────────────

describe("buildLegalPagesVerdict", () => {
  it("no pages → all pages missing, launch blocked", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_NO_PAGES, FIXTURE_FLAGS_ALL_FALSE);
    expect(verdict.pages_missing).toHaveLength(5);
    expect(verdict.all_required_pages_present).toBe(false);
    expect(verdict.is_public_launch_blocked).toBe(true);
  });

  it("all pages present + flags false → launch blocked (manual not done)", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_ALL_FALSE);
    expect(verdict.all_required_pages_present).toBe(true);
    expect(verdict.all_required_pages_validated).toBe(false);
    expect(verdict.is_public_launch_blocked).toBe(true);
  });

  it("all pages present + all flags true → launch NOT blocked", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_ALL_TRUE);
    expect(verdict.all_required_pages_present).toBe(true);
    expect(verdict.all_required_pages_validated).toBe(true);
    expect(verdict.is_public_launch_blocked).toBe(false);
  });

  it("partial pages (only cgu/cgv) → pages_missing contains dpa, mentions, confidentialite", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_PARTIAL_PAGES, FIXTURE_FLAGS_ALL_FALSE);
    expect(verdict.pages_missing).toContain("dpa");
    expect(verdict.pages_missing).toContain("mentions");
    expect(verdict.pages_missing).toContain("confidentialite");
  });

  it("partial flags → pages_validated contains only validated pages", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_PARTIAL);
    expect(verdict.pages_validated).toContain("cgu");
    expect(verdict.pages_validated).toContain("cgv");
    expect(verdict.pages_validated).not.toContain("dpa");
    expect(verdict.pages_validated).not.toContain("mentions");
  });

  it("verdict has evaluated_at timestamp", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_ALL_TRUE);
    expect(verdict.evaluated_at).toBeTruthy();
    expect(() => new Date(verdict.evaluated_at)).not.toThrow();
  });

  it("verdict reports array has one entry per page", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_ALL_FALSE);
    expect(verdict.reports).toHaveLength(5);
  });

  it("total_blocking_count is zero when all pages present and validated", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_ALL_TRUE);
    expect(verdict.total_blocking_count).toBe(0);
  });

  it("pages_draft contains pages present but not validated", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_ALL_FALSE);
    expect(verdict.pages_draft).toHaveLength(5);
    expect(verdict.pages_validated).toHaveLength(0);
  });

  it("pages_present empty when no pages exist", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_NO_PAGES, FIXTURE_FLAGS_ALL_FALSE);
    expect(verdict.pages_present).toHaveLength(0);
  });
});

// ─── Convenience exports ──────────────────────────────────────────────────────

describe("buildDefaultLegalPagesVerdict and isLegalPagesPublicLaunchBlocked", () => {
  it("buildDefaultLegalPagesVerdict with no flags → launch blocked", () => {
    const verdict = buildDefaultLegalPagesVerdict();
    expect(verdict.is_public_launch_blocked).toBe(true);
  });

  it("buildDefaultLegalPagesVerdict with all flags true → launch not blocked", () => {
    const verdict = buildDefaultLegalPagesVerdict(FIXTURE_FLAGS_ALL_TRUE);
    expect(verdict.is_public_launch_blocked).toBe(false);
  });

  it("isLegalPagesPublicLaunchBlocked returns true without flags", () => {
    expect(isLegalPagesPublicLaunchBlocked()).toBe(true);
  });

  it("isLegalPagesPublicLaunchBlocked returns false with all flags true", () => {
    expect(isLegalPagesPublicLaunchBlocked(FIXTURE_FLAGS_ALL_TRUE)).toBe(false);
  });

  it("isLegalPagesPublicLaunchBlocked returns true with partial flags", () => {
    expect(isLegalPagesPublicLaunchBlocked(FIXTURE_FLAGS_PARTIAL)).toBe(true);
  });
});

// ─── Per-page definition checks ──────────────────────────────────────────────

describe("per-page definition — cgu", () => {
  it("cgu path is /legal/cgu", () => {
    expect(getLegalPageDefinition("cgu").path).toBe("/legal/cgu");
  });
  it("cgu required_disclaimers includes validation humaine", () => {
    expect(getLegalPageDefinition("cgu").required_disclaimers).toContain("validation humaine");
  });
  it("cgu objet section required_for_public_launch", () => {
    const section = getLegalPageDefinition("cgu").required_sections.find((s) => s.id === "objet");
    expect(section?.required_for_public_launch).toBe(true);
  });
});

describe("per-page definition — cgv", () => {
  it("cgv path is /legal/cgv", () => {
    expect(getLegalPageDefinition("cgv").path).toBe("/legal/cgv");
  });
  it("cgv forbidden_claims includes satisfaction garantie ou remboursé", () => {
    expect(getLegalPageDefinition("cgv").forbidden_claims).toContain("satisfaction garantie ou remboursé");
  });
  it("cgv responsabilite section present", () => {
    const def = getLegalPageDefinition("cgv");
    expect(def.required_sections.map((s) => s.id)).toContain("responsabilite");
  });
});

describe("per-page definition — dpa", () => {
  it("dpa required_disclaimers includes RGPD", () => {
    expect(getLegalPageDefinition("dpa").required_disclaimers).toContain("RGPD");
  });
  it("dpa securite section present", () => {
    const def = getLegalPageDefinition("dpa");
    expect(def.required_sections.map((s) => s.id)).toContain("securite");
  });
  it("dpa parties section required", () => {
    const section = getLegalPageDefinition("dpa").required_sections.find((s) => s.id === "parties");
    expect(section?.required_for_public_launch).toBe(true);
  });
});

describe("per-page definition — mentions", () => {
  it("mentions path is /legal/mentions", () => {
    expect(getLegalPageDefinition("mentions").path).toBe("/legal/mentions");
  });
  it("mentions has directeur section", () => {
    const def = getLegalPageDefinition("mentions");
    expect(def.required_sections.map((s) => s.id)).toContain("directeur");
  });
  it("mentions has contact section", () => {
    const def = getLegalPageDefinition("mentions");
    expect(def.required_sections.map((s) => s.id)).toContain("contact");
  });
});

describe("per-page definition — confidentialite", () => {
  it("confidentialite has base_legale section", () => {
    const def = getLegalPageDefinition("confidentialite");
    expect(def.required_sections.map((s) => s.id)).toContain("base_legale");
  });
  it("confidentialite required_disclaimers includes droits", () => {
    expect(getLegalPageDefinition("confidentialite").required_disclaimers).toContain("droits");
  });
  it("confidentialite conservation section required", () => {
    const section = getLegalPageDefinition("confidentialite").required_sections.find((s) => s.id === "conservation");
    expect(section?.required_for_public_launch).toBe(true);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("empty string content passes forbidden checks (nothing to find)", () => {
    const result = runContentGuard("cgu", "");
    expect(result.forbidden_found).toHaveLength(0);
    expect(result.passes).toBe(true);
  });

  it("buildLegalPagesVerdict with empty pageInfos treats all as missing", () => {
    const verdict = buildLegalPagesVerdict([], FIXTURE_FLAGS_ALL_TRUE);
    expect(verdict.pages_missing).toHaveLength(5);
    expect(verdict.is_public_launch_blocked).toBe(true);
  });

  it("content guard check ids are unique within a page", () => {
    const result = runContentGuard("cgu", FIXTURE_CGU_CLEAN_CONTENT);
    const ids = result.checks.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("presence check ids are unique", () => {
    const checks = buildPresenceChecks("cgv", {
      page_id: "cgv",
      exists: true,
      has_draft_banner: true,
      sections_present: [],
    });
    const ids = checks.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("buildLegalPageReport without content arg skips content checks", () => {
    const report = buildLegalPageReport(
      { page_id: "cgu", exists: true, has_draft_banner: true, sections_present: [] },
      FIXTURE_FLAGS_ALL_FALSE
      // no content arg
    );
    // Should still have presence checks + manual check
    expect(report.checks.length).toBeGreaterThan(0);
  });

  it("verdict pages_missing and pages_present are disjoint", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_ALL_FALSE);
    const missing = new Set(verdict.pages_missing);
    for (const id of verdict.pages_present) {
      expect(missing.has(id)).toBe(false);
    }
  });

  it("partial flags verdict has correct pages_draft count", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_PARTIAL);
    // cgu and cgv validated → 3 remain draft
    expect(verdict.pages_draft).toHaveLength(3);
    expect(verdict.pages_validated).toHaveLength(2);
  });
});

// ─── Cross-cutting invariants ─────────────────────────────────────────────────

describe("cross-cutting invariants", () => {
  it("no legal page definition has an empty forbidden_claims list", () => {
    for (const id of getAllLegalPageIds()) {
      const def = getLegalPageDefinition(id);
      expect(def.forbidden_claims.length).toBeGreaterThan(0);
    }
  });

  it("no legal page definition has an empty required_disclaimers list", () => {
    for (const id of getAllLegalPageIds()) {
      const def = getLegalPageDefinition(id);
      expect(def.required_disclaimers.length).toBeGreaterThan(0);
    }
  });

  it("every manual check has is_manual: true", () => {
    for (const id of getAllLegalPageIds()) {
      const check = buildManualValidationCheck(id, false);
      expect(check.is_manual).toBe(true);
    }
  });

  it("presence checks are never is_manual", () => {
    const checks = buildPresenceChecks("cgu", {
      page_id: "cgu",
      exists: true,
      has_draft_banner: true,
      sections_present: [],
    });
    for (const c of checks) {
      expect(c.is_manual).toBe(false);
    }
  });

  it("verdict never claims launch unblocked when any required page is missing", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_PARTIAL_PAGES, FIXTURE_FLAGS_ALL_TRUE);
    expect(verdict.is_public_launch_blocked).toBe(true);
  });

  it("verdict never claims launch unblocked when any required page is unvalidated", () => {
    const verdict = buildLegalPagesVerdict(FIXTURE_ALL_PAGES_PRESENT, FIXTURE_FLAGS_PARTIAL);
    expect(verdict.is_public_launch_blocked).toBe(true);
  });
});
