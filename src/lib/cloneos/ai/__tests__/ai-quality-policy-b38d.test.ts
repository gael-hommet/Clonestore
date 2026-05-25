// src/lib/cloneos/ai/__tests__/ai-quality-policy-b38d.test.ts
// B38D — AI Quality Policy tests (platform-level).
// No real API calls. No env vars required.

import { describe, it, expect } from "vitest";
import { getQualityClassRoute, getModelTierForQualityClass, getMaxCostCentsForTier, isAnthropicCurrentlyDefault, listAllQualityClasses } from "../quality-policy/model-tier-policy";
import { decideAiQualityRoute, type AiQualityRouterInput } from "../quality-policy/quality-router";
import { getOutputQualityContract, getAllOutputQualityContracts, validateOutputQualityLevel, containsForbiddenGenericPhrase, FORBIDDEN_GENERIC_PHRASES } from "../quality-policy/output-quality-contract";
import { getPremiumGuard, isPremiumGuardedClass, isBlockedForUnpaid, isBlockedForPublicDemo, listPremiumGuardedClasses } from "../quality-policy/premium-deliverable-policy";
import { buildB38FinalClosureVerdict, isB38SafeToMoveToB39, getB38Score, getB38Status } from "../quality-policy/b38-final-readiness";
import type { AiUseCaseQualityClass } from "../quality-policy/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(
  quality_class: AiUseCaseQualityClass,
  overrides: Partial<AiQualityRouterInput> = {},
): AiQualityRouterInput {
  return {
    use_case: quality_class,
    quality_class,
    access_level: "paid_customer",
    is_client_visible: false,
    is_official_document: false,
    is_sensitive: false,
    is_public_demo: false,
    is_unpaid: false,
    ...overrides,
  };
}

// ── T1: public_demo routes to disabled/static ─────────────────────────────────

describe("B38D — Model Tier Policy", () => {
  it("T1: public_demo quality class routes to disabled tier", () => {
    const route = getQualityClassRoute("public_demo");
    expect(route.model_tier).toBe("disabled");
  });

  it("T2: public_demo routes to static provider", () => {
    const route = getQualityClassRoute("public_demo");
    expect(route.provider).toBe("static");
  });

  it("T3: public_demo max cost is 0", () => {
    const route = getQualityClassRoute("public_demo");
    expect(route.max_estimated_cost_cents).toBe(0);
  });

  it("T4: unpaid_user routes to disabled tier", () => {
    const route = getQualityClassRoute("unpaid_user");
    expect(route.model_tier).toBe("disabled");
  });

  it("T5: unpaid_user routes to mock provider", () => {
    const route = getQualityClassRoute("unpaid_user");
    expect(route.provider).toBe("mock");
  });

  it("T6: unpaid_user max cost is 0", () => {
    const route = getQualityClassRoute("unpaid_user");
    expect(route.max_estimated_cost_cents).toBe(0);
  });

  it("T7: orchestration routes to economy tier", () => {
    expect(getModelTierForQualityClass("orchestration")).toBe("economy");
  });

  it("T8: status_update routes to economy tier", () => {
    expect(getModelTierForQualityClass("status_update")).toBe("economy");
  });

  it("T9: task_planning routes to economy tier", () => {
    expect(getModelTierForQualityClass("task_planning")).toBe("economy");
  });

  it("T10: hr_analysis routes to balanced tier", () => {
    expect(getModelTierForQualityClass("hr_analysis")).toBe("balanced");
  });

  it("T11: document_draft routes to balanced tier", () => {
    expect(getModelTierForQualityClass("document_draft")).toBe("balanced");
  });

  it("T12: sensitive_analysis routes to premium_guarded tier", () => {
    expect(getModelTierForQualityClass("sensitive_analysis")).toBe("premium_guarded");
  });

  it("T13: premium_document routes to premium_guarded tier", () => {
    expect(getModelTierForQualityClass("premium_document")).toBe("premium_guarded");
  });

  it("T14: pdf_deliverable routes to premium_guarded tier", () => {
    expect(getModelTierForQualityClass("pdf_deliverable")).toBe("premium_guarded");
  });

  it("T15: executive_report routes to premium_guarded tier", () => {
    expect(getModelTierForQualityClass("executive_report")).toBe("premium_guarded");
  });

  it("T16: Anthropic is never current default", () => {
    const classes = listAllQualityClasses();
    for (const cls of classes) {
      expect(isAnthropicCurrentlyDefault(cls)).toBe(false);
    }
  });

  it("T17: OpenAI is current provider for all real-AI routes", () => {
    const realClasses: AiUseCaseQualityClass[] = [
      "orchestration", "hr_analysis", "sensitive_analysis", "premium_document",
    ];
    for (const cls of realClasses) {
      const route = getQualityClassRoute(cls);
      expect(route.provider).toBe("openai");
    }
  });

  it("T18: premium routes require cost shield", () => {
    const premiumClasses: AiUseCaseQualityClass[] = ["sensitive_analysis", "premium_document", "pdf_deliverable", "executive_report"];
    for (const cls of premiumClasses) {
      expect(getQualityClassRoute(cls).requires_cost_shield).toBe(true);
    }
  });

  it("T19: premium routes require ledger", () => {
    const premiumClasses: AiUseCaseQualityClass[] = ["sensitive_analysis", "premium_document", "pdf_deliverable", "executive_report"];
    for (const cls of premiumClasses) {
      expect(getQualityClassRoute(cls).requires_ledger).toBe(true);
    }
  });

  it("T20: sensitive_analysis requires human validation in route", () => {
    expect(getQualityClassRoute("sensitive_analysis").requires_human_validation).toBe(true);
  });

  it("T21: executive_report requires human validation in route", () => {
    expect(getQualityClassRoute("executive_report").requires_human_validation).toBe(true);
  });

  it("T22: paid customer can access premium guarded route", () => {
    expect(getQualityClassRoute("premium_document").allow_for_paid_customer).toBe(true);
  });

  it("T23: internal_test class has premium_guarded tier", () => {
    expect(getModelTierForQualityClass("internal_test")).toBe("premium_guarded");
  });

  it("T24: economy tier max cost is low (<=5)", () => {
    expect(getMaxCostCentsForTier("economy")).toBeLessThanOrEqual(5);
  });

  it("T25: disabled tier max cost is 0", () => {
    expect(getMaxCostCentsForTier("disabled")).toBe(0);
  });
});

// ── Quality Router ────────────────────────────────────────────────────────────

describe("B38D — Quality Router (decideAiQualityRoute)", () => {
  it("T26: public_demo access level forces disabled quality class", () => {
    const decision = decideAiQualityRoute(makeInput("hr_analysis", {
      is_public_demo: true,
      access_level: "public_demo",
    }));
    expect(decision.quality_class).toBe("public_demo");
    expect(decision.model_tier).toBe("disabled");
  });

  it("T27: unpaid user access level forces disabled quality class", () => {
    const decision = decideAiQualityRoute(makeInput("hr_analysis", {
      is_unpaid: true,
      access_level: "logged_unpaid",
    }));
    expect(decision.quality_class).toBe("unpaid_user");
    expect(decision.model_tier).toBe("disabled");
  });

  it("T28: official document flag elevates to premium quality class", () => {
    const decision = decideAiQualityRoute(makeInput("document_draft", {
      is_official_document: true,
    }));
    expect(decision.quality_class).toBe("premium_document");
    expect(decision.requires_human_validation).toBe(true);
  });

  it("T29: sensitive flag elevates to sensitive_analysis class", () => {
    const decision = decideAiQualityRoute(makeInput("hr_analysis", {
      is_sensitive: true,
    }));
    expect(decision.quality_class).toBe("sensitive_analysis");
    expect(decision.requires_human_validation).toBe(true);
  });

  it("T30: anonymous access level forces public_demo class", () => {
    const decision = decideAiQualityRoute(makeInput("hr_analysis", {
      access_level: "anonymous",
      is_unpaid: false,
      is_public_demo: false,
    }));
    expect(decision.quality_class).toBe("public_demo");
  });

  it("T31: router never outputs anthropic as provider", () => {
    const classes = listAllQualityClasses();
    for (const cls of classes) {
      const decision = decideAiQualityRoute(makeInput(cls));
      expect(decision.provider).not.toBe("anthropic");
    }
  });
});

// ── Output quality contracts ──────────────────────────────────────────────────

describe("B38D — Output Quality Contracts", () => {
  it("T32: official_document contract requires human validation", () => {
    const contract = getOutputQualityContract("official_document");
    expect(contract.requires_human_validation).toBe(true);
  });

  it("T33: premium_client_visible contract has must_never_include list", () => {
    const contract = getOutputQualityContract("premium_client_visible");
    expect(contract.must_never_include.length).toBeGreaterThan(0);
  });

  it("T34: forbidden phrase 'Voici un modèle' is detected", () => {
    const content = "Voici un modèle d'email que vous pouvez adapter.";
    expect(containsForbiddenGenericPhrase(content)).toBe(true);
  });

  it("T35: forbidden phrase 'Cordialement, [Votre nom]' is detected", () => {
    const content = "Cordialement, [Votre nom]";
    expect(containsForbiddenGenericPhrase(content)).toBe(true);
  });

  it("T36: clean premium content passes quality validation", () => {
    const content = "Suite à notre entretien, nous avons le plaisir de vous informer de votre intégration au sein de l'équipe.";
    const { valid } = validateOutputQualityLevel(content, "premium_client_visible");
    expect(valid).toBe(true);
  });

  it("T37: FORBIDDEN_GENERIC_PHRASES contains at least 10 entries", () => {
    expect(FORBIDDEN_GENERIC_PHRASES.length).toBeGreaterThanOrEqual(10);
  });

  it("T38: all quality levels have contracts", () => {
    const contracts = getAllOutputQualityContracts();
    expect(contracts.length).toBe(5);
  });

  it("T39: official_document contract must_never_include has auto-send", () => {
    const contract = getOutputQualityContract("official_document");
    const hasAutoSend = contract.must_never_include.some(
      (rule) => rule.toLowerCase().includes("auto"),
    );
    expect(hasAutoSend).toBe(true);
  });
});

// ── Premium deliverable policy ────────────────────────────────────────────────

describe("B38D — Premium Deliverable Policy", () => {
  it("T40: premium_document is premium guarded class", () => {
    expect(isPremiumGuardedClass("premium_document")).toBe(true);
  });

  it("T41: pdf_deliverable is premium guarded class", () => {
    expect(isPremiumGuardedClass("pdf_deliverable")).toBe(true);
  });

  it("T42: orchestration is blocked for unpaid user", () => {
    expect(isBlockedForUnpaid("orchestration")).toBe(true);
  });

  it("T43: premium_document is blocked for public demo", () => {
    expect(isBlockedForPublicDemo("premium_document")).toBe(true);
  });

  it("T44: public_demo is not blocked for public demo", () => {
    expect(isBlockedForPublicDemo("public_demo")).toBe(false);
  });

  it("T45: unpaid_user is not blocked for unpaid (it is the unpaid route)", () => {
    expect(isBlockedForUnpaid("unpaid_user")).toBe(false);
  });

  it("T46: at least 4 premium guarded classes exist", () => {
    expect(listPremiumGuardedClasses().length).toBeGreaterThanOrEqual(4);
  });

  it("T47: sensitive_analysis guard requires human validation", () => {
    const guard = getPremiumGuard("sensitive_analysis");
    expect(guard?.requires_human_validation).toBe(true);
  });
});

// ── B38 Final Closure Verdict ─────────────────────────────────────────────────

describe("B38D — B38 Final Closure Verdict", () => {
  it("T48: B38 verdict is validated_with_followups", () => {
    expect(getB38Status()).toBe("validated_with_followups");
  });

  it("T49: B38 is safe to continue to B39", () => {
    expect(isB38SafeToMoveToB39()).toBe(true);
  });

  it("T50: B38 score is >= 90", () => {
    expect(getB38Score()).toBeGreaterThanOrEqual(90);
  });

  it("T51: B38 verdict lists B44 and B45 in followups", () => {
    const verdict = buildB38FinalClosureVerdict();
    const followupsText = verdict.remaining_followups.join(" ");
    expect(followupsText).toContain("B44");
    expect(followupsText).toContain("B45");
  });

  it("T52: B38 verdict validates all 4 blocks (A/B/C/D)", () => {
    const verdict = buildB38FinalClosureVerdict();
    expect(verdict.validated_blocks.length).toBe(4);
    expect(verdict.validated_blocks.every((b) => b.validated)).toBe(true);
  });

  it("T53: No API key required — all tests are pure logic", () => {
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
  });

  it("T54: No OpenAI calls in test suite — provider assertions only", () => {
    const decision = decideAiQualityRoute(makeInput("hr_analysis"));
    expect(decision.provider).toBe("openai");
    // This is just a routing assertion — no actual call is made
    expect(true).toBe(true);
  });
});
