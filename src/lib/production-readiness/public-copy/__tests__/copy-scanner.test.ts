// P-FINAL 01 — Phase 8 — Tests for public copy scanner.
// All simulate-route: pure functions only, no Supabase, no Next, no async.

import { describe, it, expect } from "vitest";
import {
  FORBIDDEN_COPY_RULES,
  REQUIRED_DISCLAIMERS,
  getForbiddenRulesForContext,
  getRequiredDisclaimersForContext,
  getBlockingRulesCount,
} from "../copy-scanner-rules";
import {
  scanPublicCopy,
  scanMultiplePages,
} from "../copy-scanner";
import {
  FIXTURE_CLEAN_HOMEPAGE,
  FIXTURE_FORBIDDEN_HOMEPAGE,
  FIXTURE_FORBIDDEN_PRICING,
  FIXTURE_CLEAN_CGU,
  FIXTURE_CLEAN_DEMO,
  FIXTURE_FORBIDDEN_EMAIL,
} from "../copy-scanner-fixtures";

// ── Rules ─────────────────────────────────────────────────────────────────────

describe("copy-scanner-rules", () => {
  it("FORBIDDEN_COPY_RULES is not empty", () => {
    expect(FORBIDDEN_COPY_RULES.length).toBeGreaterThan(0);
  });

  it("all rules have id, severity, explanation, suggested_fix", () => {
    for (const rule of FORBIDDEN_COPY_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.severity).toMatch(/^(blocking|warning|info)$/);
      expect(rule.explanation).toBeTruthy();
      expect(rule.suggested_fix).toBeTruthy();
    }
  });

  it("rule ids are unique", () => {
    const ids = FORBIDDEN_COPY_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all rules are blocking severity", () => {
    for (const rule of FORBIDDEN_COPY_RULES) {
      expect(rule.severity).toBe("blocking");
    }
  });

  it("pierre_garantit_conformite rule exists", () => {
    const rule = FORBIDDEN_COPY_RULES.find((r) => r.id === "pierre_garantit_conformite");
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe("blocking");
  });

  it("essai_gratuit_7_jours rule exists and applies to homepage/pricing/demo", () => {
    const rule = FORBIDDEN_COPY_RULES.find((r) => r.id === "essai_gratuit_7_jours");
    expect(rule).toBeDefined();
    const applies = rule!.applies_to as string[];
    expect(applies).toContain("homepage");
    expect(applies).toContain("pricing");
  });

  it("getBlockingRulesCount > 5", () => {
    expect(getBlockingRulesCount()).toBeGreaterThan(5);
  });

  it("getForbiddenRulesForContext homepage includes all-context rules", () => {
    const rules = getForbiddenRulesForContext("homepage");
    const allRules = FORBIDDEN_COPY_RULES.filter((r) => r.applies_to === "all");
    for (const r of allRules) {
      expect(rules.find((fr) => fr.id === r.id)).toBeDefined();
    }
  });

  it("REQUIRED_DISCLAIMERS is not empty", () => {
    expect(REQUIRED_DISCLAIMERS.length).toBeGreaterThan(0);
  });

  it("getRequiredDisclaimersForContext demo returns illustrative disclaimer", () => {
    const disclaimers = getRequiredDisclaimersForContext("demo");
    const illustrative = disclaimers.find((d) => d.id === "demo_illustrative");
    expect(illustrative).toBeDefined();
  });
});

// ── Scanner ───────────────────────────────────────────────────────────────────

describe("scanPublicCopy", () => {
  it("clean homepage → is_safe_for_launch: true", () => {
    const result = scanPublicCopy(FIXTURE_CLEAN_HOMEPAGE, "homepage");
    expect(result.is_safe_for_launch).toBe(true);
    expect(result.blocking_violation_count).toBe(0);
  });

  it("forbidden homepage → is_safe_for_launch: false", () => {
    const result = scanPublicCopy(FIXTURE_FORBIDDEN_HOMEPAGE, "homepage");
    expect(result.is_safe_for_launch).toBe(false);
    expect(result.blocking_violation_count).toBeGreaterThan(0);
  });

  it("forbidden homepage detects pierre_garantit_conformite", () => {
    const result = scanPublicCopy(FIXTURE_FORBIDDEN_HOMEPAGE, "homepage");
    const violation = result.violations.find((v) => v.id === "pierre_garantit_conformite");
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe("blocking");
  });

  it("forbidden homepage detects zero_erreur", () => {
    const result = scanPublicCopy(FIXTURE_FORBIDDEN_HOMEPAGE, "homepage");
    const violation = result.violations.find((v) => v.id === "zero_erreur");
    expect(violation).toBeDefined();
  });

  it("forbidden homepage detects essai_gratuit_7_jours", () => {
    const result = scanPublicCopy(FIXTURE_FORBIDDEN_HOMEPAGE, "homepage");
    const violation = result.violations.find((v) => v.id === "essai_gratuit_7_jours");
    expect(violation).toBeDefined();
  });

  it("forbidden pricing detects essai_gratuit_illimite", () => {
    const result = scanPublicCopy(FIXTURE_FORBIDDEN_PRICING, "pricing");
    const violation = result.violations.find((v) => v.id === "essai_gratuit_illimite");
    expect(violation).toBeDefined();
  });

  it("clean CGU → is_safe_for_launch: true", () => {
    const result = scanPublicCopy(FIXTURE_CLEAN_CGU, "legal_cgu");
    expect(result.is_safe_for_launch).toBe(true);
  });

  it("clean demo → is_safe_for_launch: true, no violations", () => {
    const result = scanPublicCopy(FIXTURE_CLEAN_DEMO, "demo");
    expect(result.is_safe_for_launch).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("forbidden email detects envoie_emails_seul", () => {
    const result = scanPublicCopy(FIXTURE_FORBIDDEN_EMAIL, "email_template");
    const violation = result.violations.find((v) => v.id === "envoie_emails_seul");
    expect(violation).toBeDefined();
  });

  it("result has scanned_at timestamp", () => {
    const result = scanPublicCopy(FIXTURE_CLEAN_HOMEPAGE, "generic");
    expect(result.scanned_at).toBeTruthy();
    expect(() => new Date(result.scanned_at)).not.toThrow();
  });

  it("violations have explanation and suggested_fix", () => {
    const result = scanPublicCopy(FIXTURE_FORBIDDEN_HOMEPAGE, "homepage");
    for (const v of result.violations) {
      expect(v.explanation).toBeTruthy();
      expect(v.suggested_fix).toBeTruthy();
      expect(v.found_text).toBeTruthy();
    }
  });

  it("empty content → no violations", () => {
    const result = scanPublicCopy("", "homepage");
    expect(result.violations).toHaveLength(0);
    expect(result.is_safe_for_launch).toBe(true);
  });

  it("case-insensitive detection: uppercase Pierre GARANTIT", () => {
    const result = scanPublicCopy("PIERRE GARANTIT LA CONFORMITÉ DE VOS DOCUMENTS.", "homepage");
    const violation = result.violations.find((v) => v.id === "pierre_garantit_conformite");
    expect(violation).toBeDefined();
  });
});

// ── Multi-page scanner ────────────────────────────────────────────────────────

describe("scanMultiplePages", () => {
  it("all clean pages → all_safe: true", () => {
    const result = scanMultiplePages([
      { content: FIXTURE_CLEAN_HOMEPAGE, context: "homepage" },
      { content: FIXTURE_CLEAN_CGU, context: "legal_cgu" },
      { content: FIXTURE_CLEAN_DEMO, context: "demo" },
    ]);
    expect(result.all_safe).toBe(true);
    expect(result.total_blocking).toBe(0);
    expect(result.unsafe_contexts).toHaveLength(0);
  });

  it("one forbidden page → all_safe: false", () => {
    const result = scanMultiplePages([
      { content: FIXTURE_CLEAN_HOMEPAGE, context: "homepage" },
      { content: FIXTURE_FORBIDDEN_PRICING, context: "pricing" },
    ]);
    expect(result.all_safe).toBe(false);
    expect(result.unsafe_contexts).toContain("pricing");
  });

  it("results array has one entry per page", () => {
    const result = scanMultiplePages([
      { content: FIXTURE_CLEAN_HOMEPAGE, context: "homepage" },
      { content: FIXTURE_CLEAN_CGU, context: "legal_cgu" },
    ]);
    expect(result.results).toHaveLength(2);
  });

  it("total_violations sums across pages", () => {
    const result = scanMultiplePages([
      { content: FIXTURE_FORBIDDEN_HOMEPAGE, context: "homepage" },
      { content: FIXTURE_FORBIDDEN_EMAIL, context: "email_template" },
    ]);
    expect(result.total_violations).toBeGreaterThan(1);
  });
});

// ── Additional pattern tests ──────────────────────────────────────────────────

describe("specific forbidden patterns", () => {
  it("detects remplace un avocat", () => {
    const result = scanPublicCopy("Pierre remplace un avocat pour vos contrats RH.", "generic");
    const v = result.violations.find((v) => v.id === "remplace_avocat");
    expect(v).toBeDefined();
    expect(result.is_safe_for_launch).toBe(false);
  });

  it("detects remplace expert-comptable", () => {
    const result = scanPublicCopy("Pierre remplace un expert-comptable.", "generic");
    const v = result.violations.find((v) => v.id === "remplace_expert_comptable");
    expect(v).toBeDefined();
  });

  it("detects resultat garanti", () => {
    const result = scanPublicCopy("Résultats garantis en 30 jours.", "homepage");
    const v = result.violations.find((v) => v.id === "resultats_garantis");
    expect(v).toBeDefined();
  });

  it("detects logiciel de paie officiel", () => {
    const result = scanPublicCopy("Pierre génère des bulletins de salaire certifiés.", "generic");
    const v = result.violations.find((v) => v.id === "logiciel_paie_officiel");
    expect(v).toBeDefined();
  });

  it("detects decisions autonomes", () => {
    const result = scanPublicCopy("Pierre prend des décisions autonomes pour vous.", "generic");
    const v = result.violations.find((v) => v.id === "decisions_autonomes");
    expect(v).toBeDefined();
  });

  it("detects satisfait ou remboursé on pricing", () => {
    const result = scanPublicCopy("Satisfait ou remboursé à 100%.", "pricing");
    const v = result.violations.find((v) => v.id === "satisfaction_garantie");
    expect(v).toBeDefined();
  });

  it("clean text with validation humaine → no validation_humaine warning", () => {
    const result = scanPublicCopy(
      "Pierre propose des brouillons soumis à validation humaine obligatoire.",
      "homepage"
    );
    const hasMissingDisclaimer = result.missing_disclaimers.includes("validation_humaine_required");
    expect(hasMissingDisclaimer).toBe(false);
  });

  it("homepage without validation humaine → missing disclaimer warning", () => {
    const result = scanPublicCopy(
      "Pierre est votre assistant RH. Abonnez-vous dès maintenant.",
      "homepage"
    );
    expect(result.missing_disclaimers).toContain("validation_humaine_required");
  });

  it("detects conforme a la loi", () => {
    const result = scanPublicCopy("Pierre est légalement conforme à toutes les lois.", "generic");
    const v = result.violations.find((v) => v.id === "conforme_a_la_loi");
    expect(v).toBeDefined();
  });

  it("result context matches input context", () => {
    const result = scanPublicCopy(FIXTURE_CLEAN_HOMEPAGE, "pricing");
    expect(result.context).toBe("pricing");
  });

  it("getForbiddenRulesForContext legal_cgu excludes pricing-only rules", () => {
    const cguRules = getForbiddenRulesForContext("legal_cgu");
    // satisfaction_garantie applies only to homepage/pricing
    const satisfactionRule = cguRules.find((r) => r.id === "satisfaction_garantie");
    expect(satisfactionRule).toBeUndefined();
  });

  it("scanMultiplePages: empty pages array → all_safe: true", () => {
    const result = scanMultiplePages([]);
    expect(result.all_safe).toBe(true);
    expect(result.total_violations).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("violations have ids matching rule ids", () => {
    const result = scanPublicCopy(FIXTURE_FORBIDDEN_HOMEPAGE, "homepage");
    const ruleIds = new Set(FORBIDDEN_COPY_RULES.map((r) => r.id));
    for (const v of result.violations) {
      expect(ruleIds.has(v.id)).toBe(true);
    }
  });
});
