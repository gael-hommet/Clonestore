// B47 — Legal Commercial Guardrails Tests
// Tests for claims policy, forbidden phrases, disclaimers, output guardrails,
// marketing guardrails, pricing, demo policy, acceptance checklist, legal verdict.
// No Supabase. No Next.js. No async.

import { describe, it, expect } from "vitest";

// Claims policy
import {
  getAllClaims,
  getAllowedClaims,
  getForbiddenClaims,
  evaluateCommercialClaim,
  rewriteUnsafeClaim,
  classifyCommercialClaim,
} from "../claims-policy";

// Forbidden phrases
import {
  findForbiddenPhrases,
  assertNoForbiddenLegalCommercialPhrases,
  normalizeForPhraseCheck,
} from "../forbidden-phrases";

// Disclaimers
import {
  getAllDisclaimers,
  getDisclaimer,
  getRequiredDisclaimersForContext,
  getMissingRequiredDisclaimers,
} from "../disclaimers";

// Output guardrails
import {
  evaluateOutputLegalCommercialSafety,
  enforceOutputGuardrails,
  buildDefaultOutputContext,
  requireHumanValidationForContext,
} from "../output-guardrails";

// Marketing guardrails
import {
  validatePierreMarketingCopy,
  validateCloneStoreMarketingCopy,
  rewriteMarketingCopySafely,
  getPierrePositioningStatements,
} from "../marketing-guardrails";

// Pricing policy
import {
  getPierrePricingPolicy,
  getDemoVsPaidCapabilities,
  PIERRE_MONTHLY_PRICE_EUR,
} from "../pricing-policy";

// Demo policy
import {
  assertDemoCannotPerformAction,
  getDemoCapabilitySummary,
  isDemoAction,
} from "../demo-policy";

// Acceptance checklist
import {
  buildB47AcceptanceChecklist,
  computeLegalCommercialReadiness,
  getB48LegalPrerequisites,
  getLegalReviewRequiredItems,
} from "../acceptance-checklist";

// Legal verdict
import { buildLegalCommercialVerdict } from "../legal-verdict";

// Fixtures
import {
  buildMarketingOutputContext,
  buildPayrollOutputContext,
  buildOfficialDocumentContext,
  buildDemoContext,
  buildCockpitContext,
  SAFE_PRODUCTIVITY_CLAIM,
  SAFE_COST_SAVING_CLAIM,
  SAFE_AUTOMATION_CLAIM,
  FORBIDDEN_LEGAL_CLAIM,
  FORBIDDEN_CONFORMITY_CLAIM,
  FORBIDDEN_ZERO_ERROR_CLAIM,
  FORBIDDEN_DSN_CLAIM,
  FORBIDDEN_PAYROLL_CLAIM,
  FORBIDDEN_DISMISSAL_CLAIM,
  FORBIDDEN_AUTO_SANCTION,
  FORBIDDEN_FULL_AUTONOMY,
} from "../fixtures";

// ── 1. Claims policy ──────────────────────────────────────────────────────────

describe("claims-policy — getAllClaims", () => {
  it("returns a non-empty array", () => {
    expect(getAllClaims().length).toBeGreaterThan(0);
  });

  it("all items have required fields", () => {
    for (const c of getAllClaims()) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("category");
      expect(c).toHaveProperty("claim");
      expect(c).toHaveProperty("decision");
      expect(c).toHaveProperty("risk_level");
    }
  });
});

describe("claims-policy — getAllowedClaims", () => {
  it("returns only allowed/allowed_with_disclaimer decisions", () => {
    for (const c of getAllowedClaims()) {
      expect(["allowed", "allowed_with_disclaimer"]).toContain(c.decision);
    }
  });

  it("returns at least 1 allowed claim", () => {
    expect(getAllowedClaims().length).toBeGreaterThan(0);
  });
});

describe("claims-policy — getForbiddenClaims", () => {
  it("returns only forbidden decisions", () => {
    for (const c of getForbiddenClaims()) {
      expect(c.decision).toBe("forbidden");
    }
  });

  it("returns at least 5 forbidden claims", () => {
    expect(getForbiddenClaims().length).toBeGreaterThanOrEqual(5);
  });
});

describe("claims-policy — evaluateCommercialClaim", () => {
  it("returns allowed for safe productivity claim", () => {
    const res = evaluateCommercialClaim(SAFE_PRODUCTIVITY_CLAIM);
    expect(["allowed", "allowed_with_disclaimer"]).toContain(res.decision);
  });

  it("returns forbidden for FORBIDDEN_LEGAL_CLAIM", () => {
    const res = evaluateCommercialClaim(FORBIDDEN_LEGAL_CLAIM);
    expect(res.decision).toBe("forbidden");
  });

  it("returns forbidden for FORBIDDEN_CONFORMITY_CLAIM", () => {
    const res = evaluateCommercialClaim(FORBIDDEN_CONFORMITY_CLAIM);
    expect(res.decision).toBe("forbidden");
  });

  it("returns forbidden for FORBIDDEN_ZERO_ERROR_CLAIM", () => {
    const res = evaluateCommercialClaim(FORBIDDEN_ZERO_ERROR_CLAIM);
    expect(res.decision).toBe("forbidden");
  });

  it("returns forbidden for FORBIDDEN_DSN_CLAIM", () => {
    const res = evaluateCommercialClaim(FORBIDDEN_DSN_CLAIM);
    expect(res.decision).toBe("forbidden");
  });

  it("returns forbidden for FORBIDDEN_PAYROLL_CLAIM", () => {
    const res = evaluateCommercialClaim(FORBIDDEN_PAYROLL_CLAIM);
    expect(res.decision).toBe("forbidden");
  });

  it("returns forbidden for FORBIDDEN_DISMISSAL_CLAIM", () => {
    const res = evaluateCommercialClaim(FORBIDDEN_DISMISSAL_CLAIM);
    expect(res.decision).toBe("forbidden");
  });

  it("returns forbidden for FORBIDDEN_AUTO_SANCTION", () => {
    const res = evaluateCommercialClaim(FORBIDDEN_AUTO_SANCTION);
    expect(res.decision).toBe("forbidden");
  });

  it("returns forbidden for FORBIDDEN_FULL_AUTONOMY", () => {
    const res = evaluateCommercialClaim(FORBIDDEN_FULL_AUTONOMY);
    expect(res.decision).toBe("forbidden");
  });

  it("returns an object with risk_level", () => {
    const res = evaluateCommercialClaim("Pierre aide les équipes RH.");
    expect(res).toHaveProperty("risk_level");
  });
});

describe("claims-policy — rewriteUnsafeClaim", () => {
  it("returns a non-empty string for any input", () => {
    expect(rewriteUnsafeClaim(FORBIDDEN_LEGAL_CLAIM)).toBeTruthy();
  });

  it("returns a safe rewrite for the input claim", () => {
    const rewrite = rewriteUnsafeClaim(FORBIDDEN_LEGAL_CLAIM);
    expect(typeof rewrite).toBe("string");
    expect(rewrite.length).toBeGreaterThan(0);
  });
});

describe("claims-policy — classifyCommercialClaim", () => {
  it("classifies a legal claim correctly", () => {
    const cat = classifyCommercialClaim("Pierre remplace un avocat.");
    expect(cat).toBe("legal");
  });

  it("classifies a payroll claim correctly", () => {
    const cat = classifyCommercialClaim("Pierre remplace la DSN.");
    expect(cat).toBe("payroll");
  });
});

// ── 2. Forbidden phrases ──────────────────────────────────────────────────────

describe("forbidden-phrases — normalizeForPhraseCheck", () => {
  it("lowercases the text", () => {
    expect(normalizeForPhraseCheck("HELLO")).toBe("hello");
  });

  it("strips French accents", () => {
    expect(normalizeForPhraseCheck("éàü")).toContain("eau");
  });

  it("normalizes whitespace", () => {
    expect(normalizeForPhraseCheck("a  b")).toBe("a b");
  });
});

describe("forbidden-phrases — findForbiddenPhrases", () => {
  it("returns empty array for safe text", () => {
    expect(findForbiddenPhrases(SAFE_PRODUCTIVITY_CLAIM)).toHaveLength(0);
  });

  it("detects 'remplace un avocat'", () => {
    const violations = findForbiddenPhrases("Pierre remplace un avocat en droit du travail.");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("detects 'garantit la conformite'", () => {
    const violations = findForbiddenPhrases("Ce logiciel garantit la conformité légale.");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("detects 'garantit zero erreur'", () => {
    const violations = findForbiddenPhrases("Notre outil garantit zéro erreur dans les documents.");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("detects 'remplace la dsn'", () => {
    const violations = findForbiddenPhrases("Pierre remplace la DSN.");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("detects 'remplace un logiciel de paie'", () => {
    const violations = findForbiddenPhrases("Pierre remplace un logiciel de paie.");
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe("forbidden-phrases — assertNoForbiddenLegalCommercialPhrases", () => {
  it("returns ok=true for safe text", () => {
    expect(assertNoForbiddenLegalCommercialPhrases(SAFE_AUTOMATION_CLAIM).ok).toBe(true);
  });

  it("returns ok=false for forbidden text", () => {
    const res = assertNoForbiddenLegalCommercialPhrases(FORBIDDEN_LEGAL_CLAIM);
    expect(res.ok).toBe(false);
    expect(res.violations.length).toBeGreaterThan(0);
  });

  it("handles empty string as safe", () => {
    expect(assertNoForbiddenLegalCommercialPhrases("").ok).toBe(true);
  });
});

// ── 3. Disclaimers ────────────────────────────────────────────────────────────

describe("disclaimers — getAllDisclaimers", () => {
  it("returns at least 5 disclaimers", () => {
    expect(getAllDisclaimers().length).toBeGreaterThanOrEqual(5);
  });

  it("all disclaimers have id, short_text, full_text", () => {
    for (const d of getAllDisclaimers()) {
      expect(d).toHaveProperty("id");
      expect(typeof d.short_text).toBe("string");
      expect(typeof d.full_text).toBe("string");
    }
  });
});

describe("disclaimers — getDisclaimer", () => {
  it("returns the HUMAN_RESPONSIBILITY disclaimer", () => {
    const d = getDisclaimer("HUMAN_RESPONSIBILITY");
    expect(d).toBeTruthy();
    expect(d!.id).toBe("HUMAN_RESPONSIBILITY");
  });

  it("returns null for unknown id", () => {
    expect(getDisclaimer("NONEXISTENT")).toBeNull();
  });
});

describe("disclaimers — getRequiredDisclaimersForContext", () => {
  it("returns PAYROLL_LIMIT for payroll context", () => {
    const disclaimers = getRequiredDisclaimersForContext(buildPayrollOutputContext());
    const ids = disclaimers.map((d) => d.id);
    expect(ids).toContain("PAYROLL_LIMIT");
  });

  it("returns OFFICIAL_DOCUMENT_VALIDATION for official document context", () => {
    const disclaimers = getRequiredDisclaimersForContext(buildOfficialDocumentContext());
    const ids = disclaimers.map((d) => d.id);
    expect(ids).toContain("OFFICIAL_DOCUMENT_VALIDATION");
  });

  it("returns DEMO_LIMIT for demo context", () => {
    const disclaimers = getRequiredDisclaimersForContext(buildDemoContext());
    const ids = disclaimers.map((d) => d.id);
    expect(ids).toContain("DEMO_LIMIT");
  });

  it("returns at least 1 disclaimer for marketing context", () => {
    expect(getRequiredDisclaimersForContext(buildMarketingOutputContext()).length).toBeGreaterThan(0);
  });
});

describe("disclaimers — getMissingRequiredDisclaimers", () => {
  it("returns missing ids when text has none", () => {
    const missing = getMissingRequiredDisclaimers("Document de paie", buildPayrollOutputContext());
    expect(missing).toContain("PAYROLL_LIMIT");
  });

  it("returns empty array when text contains the disclaimer short_text", () => {
    const required = getRequiredDisclaimersForContext(buildPayrollOutputContext());
    const textWithAll = required.map((d) => d.short_text).join(" ");
    const missing = getMissingRequiredDisclaimers(textWithAll, buildPayrollOutputContext());
    expect(missing).toHaveLength(0);
  });
});

// ── 4. Output guardrails ──────────────────────────────────────────────────────

describe("output-guardrails — buildDefaultOutputContext", () => {
  it("returns a valid context", () => {
    const ctx = buildDefaultOutputContext();
    expect(ctx).toHaveProperty("surface");
    expect(ctx).toHaveProperty("domain");
    expect(typeof ctx.is_sensitive).toBe("boolean");
  });
});

describe("output-guardrails — requireHumanValidationForContext", () => {
  it("returns true for official document context", () => {
    expect(requireHumanValidationForContext(buildOfficialDocumentContext())).toBe(true);
  });

  it("returns true for payroll context", () => {
    expect(requireHumanValidationForContext(buildPayrollOutputContext())).toBe(true);
  });

  it("returns false for marketing context by default", () => {
    expect(requireHumanValidationForContext(buildMarketingOutputContext())).toBe(false);
  });
});

describe("output-guardrails — evaluateOutputLegalCommercialSafety", () => {
  it("returns ok=true for safe text in cockpit context", () => {
    const res = evaluateOutputLegalCommercialSafety(SAFE_PRODUCTIVITY_CLAIM, buildCockpitContext());
    expect(res).toHaveProperty("ok");
    expect(typeof res.ok).toBe("boolean");
  });

  it("returns ok=false for forbidden phrase in marketing context", () => {
    const res = evaluateOutputLegalCommercialSafety(FORBIDDEN_LEGAL_CLAIM, buildMarketingOutputContext());
    expect(res.ok).toBe(false);
  });

  it("returns ok=false for forbidden phrase in any context", () => {
    const res = evaluateOutputLegalCommercialSafety(FORBIDDEN_ZERO_ERROR_CLAIM, buildCockpitContext());
    expect(res.ok).toBe(false);
  });

  it("includes missing_required_disclaimers in result", () => {
    const res = evaluateOutputLegalCommercialSafety("Document officiel", buildOfficialDocumentContext());
    expect(res).toHaveProperty("missing_required_disclaimers");
  });

  it("enforces required_human_validation for official document", () => {
    const res = evaluateOutputLegalCommercialSafety("Document", buildOfficialDocumentContext());
    expect(res.required_human_validation).toBe(true);
  });
});

describe("output-guardrails — enforceOutputGuardrails", () => {
  it("returns ok=false for forbidden content", () => {
    const res = enforceOutputGuardrails(FORBIDDEN_LEGAL_CLAIM, buildMarketingOutputContext());
    expect(res.ok).toBe(false);
  });

  it("returns ok=true for safe content in cockpit", () => {
    const res = enforceOutputGuardrails(SAFE_PRODUCTIVITY_CLAIM, buildCockpitContext());
    expect(res.ok).toBe(true);
  });

  it("has forbidden_phrases_found array", () => {
    const res = enforceOutputGuardrails(FORBIDDEN_LEGAL_CLAIM, buildMarketingOutputContext());
    expect(Array.isArray(res.forbidden_phrases_found)).toBe(true);
  });
});

// ── 5. Marketing guardrails ───────────────────────────────────────────────────

describe("marketing-guardrails — validatePierreMarketingCopy", () => {
  it("returns ok=true for safe claim", () => {
    const res = validatePierreMarketingCopy(SAFE_PRODUCTIVITY_CLAIM);
    expect(res.ok).toBe(true);
  });

  it("returns ok=false for forbidden legal claim", () => {
    const res = validatePierreMarketingCopy(FORBIDDEN_LEGAL_CLAIM);
    expect(res.ok).toBe(false);
  });

  it("returns ok=false for forbidden conformity claim", () => {
    const res = validatePierreMarketingCopy(FORBIDDEN_CONFORMITY_CLAIM);
    expect(res.ok).toBe(false);
  });

  it("returns ok=false for zero error promise", () => {
    const res = validatePierreMarketingCopy(FORBIDDEN_ZERO_ERROR_CLAIM);
    expect(res.ok).toBe(false);
  });

  it("includes forbidden_phrases_found in result when failing", () => {
    const res = validatePierreMarketingCopy(FORBIDDEN_LEGAL_CLAIM);
    expect(res.forbidden_phrases_found.length).toBeGreaterThan(0);
  });

  it("includes a safe_rewrite when failing", () => {
    const res = validatePierreMarketingCopy(FORBIDDEN_LEGAL_CLAIM);
    expect(res.safe_rewrite).toBeTruthy();
  });
});

describe("marketing-guardrails — validateCloneStoreMarketingCopy", () => {
  it("returns ok=true for safe automation claim", () => {
    const res = validateCloneStoreMarketingCopy(SAFE_AUTOMATION_CLAIM);
    expect(res.ok).toBe(true);
  });

  it("returns ok=false for forbidden full autonomy claim", () => {
    const res = validateCloneStoreMarketingCopy(FORBIDDEN_FULL_AUTONOMY);
    expect(res.ok).toBe(false);
  });
});

describe("marketing-guardrails — rewriteMarketingCopySafely", () => {
  it("returns a non-empty string", () => {
    expect(rewriteMarketingCopySafely(FORBIDDEN_LEGAL_CLAIM).length).toBeGreaterThan(0);
  });
});

describe("marketing-guardrails — getPierrePositioningStatements", () => {
  it("returns an array of safe statements", () => {
    const statements = getPierrePositioningStatements();
    expect(statements.length).toBeGreaterThan(0);
    for (const s of statements) {
      expect(typeof s).toBe("string");
    }
  });
});

// ── 6. Pricing policy ─────────────────────────────────────────────────────────

describe("pricing-policy — PIERRE_MONTHLY_PRICE_EUR", () => {
  it("is 449", () => {
    expect(PIERRE_MONTHLY_PRICE_EUR).toBe(449);
  });
});

describe("pricing-policy — getPierrePricingPolicy", () => {
  it("returns a pricing policy object", () => {
    const policy = getPierrePricingPolicy();
    expect(policy).toHaveProperty("monthly_price_eur");
    expect(policy.monthly_price_eur).toBe(449);
  });

  it("has founder_pricing_enabled=true", () => {
    expect(getPierrePricingPolicy().founder_pricing_enabled).toBe(true);
  });

  it("has free_trial_enabled=false", () => {
    expect(getPierrePricingPolicy().free_trial_enabled).toBe(false);
  });
});

describe("pricing-policy — getDemoVsPaidCapabilities", () => {
  it("returns a capabilities map", () => {
    const caps = getDemoVsPaidCapabilities();
    expect(typeof caps).toBe("object");
  });

  it("demo cannot use real AI generation", () => {
    const caps = getDemoVsPaidCapabilities();
    expect(caps["real_ai_generation"]?.demo).toBe(false);
  });

  it("paid customer can use real AI generation", () => {
    const caps = getDemoVsPaidCapabilities();
    expect(caps["real_ai_generation"]?.paid).toBe(true);
  });

  it("demo cannot export official documents", () => {
    const caps = getDemoVsPaidCapabilities();
    expect(caps["official_document_export"]?.demo).toBe(false);
  });
});

// ── 7. Demo policy ────────────────────────────────────────────────────────────

describe("demo-policy — assertDemoCannotPerformAction", () => {
  it("blocks email.send in demo", () => {
    const res = assertDemoCannotPerformAction("email.send");
    expect(res.blocked).toBe(true);
    expect(res.reason).toBeTruthy();
  });

  it("blocks official_document_export in demo", () => {
    const res = assertDemoCannotPerformAction("official_document_export");
    expect(res.blocked).toBe(true);
  });

  it("blocks real_ai_generation in demo", () => {
    const res = assertDemoCannotPerformAction("real_ai_generation");
    expect(res.blocked).toBe(true);
  });

  it("does not block demo_ai_simulation", () => {
    const res = assertDemoCannotPerformAction("demo_ai_simulation");
    expect(res.blocked).toBe(false);
  });

  it("blocks payroll_generation in demo", () => {
    const res = assertDemoCannotPerformAction("payroll_generation");
    expect(res.blocked).toBe(true);
  });
});

describe("demo-policy — isDemoAction", () => {
  it("returns true for blocked actions", () => {
    expect(isDemoAction("email.send")).toBe(true);
  });

  it("returns false for allowed actions", () => {
    expect(isDemoAction("demo_ai_simulation")).toBe(false);
  });
});

describe("demo-policy — getDemoCapabilitySummary", () => {
  it("returns a summary object with demo_blocked", () => {
    const summary = getDemoCapabilitySummary();
    expect(summary).toHaveProperty("demo_blocked");
    expect(summary).toHaveProperty("demo_allowed");
  });

  it("demo_blocked includes emails reels", () => {
    const summary = getDemoCapabilitySummary();
    expect(summary.demo_blocked.some((a: string) => a.toLowerCase().includes("email"))).toBe(true);
  });

  it("demo_description is non-empty", () => {
    expect(getDemoCapabilitySummary().demo_description.length).toBeGreaterThan(0);
  });
});

// ── 8. Acceptance checklist ───────────────────────────────────────────────────

describe("acceptance-checklist — buildB47AcceptanceChecklist", () => {
  it("returns at least 10 items", () => {
    expect(buildB47AcceptanceChecklist().length).toBeGreaterThanOrEqual(10);
  });

  it("all items have id, description, blocking_b48", () => {
    for (const item of buildB47AcceptanceChecklist()) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("blocking_b48");
    }
  });
});

describe("acceptance-checklist — computeLegalCommercialReadiness", () => {
  it("returns a readiness object", () => {
    const r = computeLegalCommercialReadiness();
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("blocking_items");
  });

  it("score is between 0 and 100", () => {
    const { score } = computeLegalCommercialReadiness();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("acceptance-checklist — getB48LegalPrerequisites", () => {
  it("returns at least 5 blocking items", () => {
    expect(getB48LegalPrerequisites().length).toBeGreaterThanOrEqual(5);
  });

  it("all items have blocking_b48=true", () => {
    for (const item of getB48LegalPrerequisites()) {
      expect(item.blocking_b48).toBe(true);
    }
  });
});

describe("acceptance-checklist — getLegalReviewRequiredItems", () => {
  it("returns items requiring legal review", () => {
    expect(getLegalReviewRequiredItems().length).toBeGreaterThan(0);
    for (const item of getLegalReviewRequiredItems()) {
      expect(item.legal_review_needed).toBe(true);
    }
  });
});

// ── 9. Legal verdict ──────────────────────────────────────────────────────────

describe("legal-verdict — buildLegalCommercialVerdict", () => {
  it("returns a verdict object", () => {
    const v = buildLegalCommercialVerdict();
    expect(v).toHaveProperty("status");
    expect(v).toHaveProperty("score_0_to_100");
    expect(v).toHaveProperty("safe_to_continue_to_b48");
    expect(v).toHaveProperty("legal_review_required");
  });

  it("safe_to_continue_to_b48 is true", () => {
    expect(buildLegalCommercialVerdict().safe_to_continue_to_b48).toBe(true);
  });

  it("legal_review_required is true", () => {
    expect(buildLegalCommercialVerdict().legal_review_required).toBe(true);
  });

  it("score is between 0 and 100", () => {
    const { score_0_to_100 } = buildLegalCommercialVerdict();
    expect(score_0_to_100).toBeGreaterThanOrEqual(0);
    expect(score_0_to_100).toBeLessThanOrEqual(100);
  });

  it("covered_policies includes claims_policy", () => {
    expect(buildLegalCommercialVerdict().covered_policies).toContain("claims_policy");
  });

  it("has launch_blockers listing CGU/CGV", () => {
    const blockers = buildLegalCommercialVerdict().launch_blockers;
    expect(blockers.some((b) => b.toLowerCase().includes("cgu") || b.toLowerCase().includes("cgv"))).toBe(true);
  });
});

// ── 10. Fixtures ──────────────────────────────────────────────────────────────

describe("fixtures — context builders", () => {
  it("buildMarketingOutputContext returns is_public_claim=true", () => {
    expect(buildMarketingOutputContext().is_public_claim).toBe(true);
  });

  it("buildPayrollOutputContext returns domain=payroll", () => {
    expect(buildPayrollOutputContext().domain).toBe("payroll");
  });

  it("buildOfficialDocumentContext returns is_official_document=true", () => {
    expect(buildOfficialDocumentContext().is_official_document).toBe(true);
  });

  it("buildDemoContext returns is_demo=true", () => {
    expect(buildDemoContext().is_demo).toBe(true);
  });

  it("buildCockpitContext returns surface=cockpit", () => {
    expect(buildCockpitContext().surface).toBe("cockpit");
  });

  it("overrides work for buildMarketingOutputContext", () => {
    const ctx = buildMarketingOutputContext({ is_demo: true });
    expect(ctx.is_demo).toBe(true);
    expect(ctx.is_public_claim).toBe(true);
  });
});
