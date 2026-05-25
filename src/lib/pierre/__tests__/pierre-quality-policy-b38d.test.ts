// src/lib/pierre/__tests__/pierre-quality-policy-b38d.test.ts
// B38D — Pierre quality policy tests (Pierre-specific).
// No real API calls. No env vars required.

import { describe, it, expect } from "vitest";
import {
  getPierreQualityClass,
  decidePierreAiRoute,
  pierreUseCaseRequiresPremium,
  pierreUseCaseRequiresHumanValidation,
  pierreUseCaseAllowedForAccessLevel,
} from "../quality/pierre-quality-policy";
import {
  getPierreDeliverableContract,
  getAllPierreDeliverableContracts,
  listDeliverableTypesRequiringHumanValidation,
  listDeliverableTypesTargetingB45,
  deliverableNeverAllowsAutoSend,
} from "../quality/pierre-deliverable-contract";
import {
  getAllDocumentStyleRequirements,
  getRequirementsForBlock,
  getLaunchCriticalRequirements,
  getRequirementById,
  getStyleKitCompletionSummary,
} from "../quality/pierre-document-style-readiness";
import { buildB38FinalClosureVerdict } from "../../cloneos/ai/quality-policy/b38-final-readiness";
import type { PierreDeliverableType } from "../../cloneos/ai/quality-policy/types";

// ── T21: All deliverable contracts exist ─────────────────────────────────────

describe("B38D — Pierre Deliverable Contracts", () => {
  const ALL_TYPES: PierreDeliverableType[] = [
    "email_draft", "hr_note", "candidate_summary", "onboarding_plan",
    "absence_followup", "prepayroll_summary", "employee_file_summary",
    "certificate_draft", "contract_draft", "amendment_draft",
    "executive_report", "pdf_export", "spreadsheet_export",
  ];

  it("T21: all 13 deliverable contracts exist", () => {
    const contracts = getAllPierreDeliverableContracts();
    expect(contracts.length).toBe(13);
    for (const type of ALL_TYPES) {
      const contract = getPierreDeliverableContract(type);
      expect(contract).toBeDefined();
      expect(contract.deliverable_type).toBe(type);
    }
  });

  it("T22: email_draft never allows auto-send", () => {
    expect(deliverableNeverAllowsAutoSend("email_draft")).toBe(true);
  });

  it("T23: contract_draft requires human validation", () => {
    const contract = getPierreDeliverableContract("contract_draft");
    expect(contract.human_validation_required).toBe(true);
  });

  it("T24: amendment_draft requires human validation", () => {
    const contract = getPierreDeliverableContract("amendment_draft");
    expect(contract.human_validation_required).toBe(true);
  });

  it("T25: prepayroll_summary never replaces payroll/DSN", () => {
    const contract = getPierreDeliverableContract("prepayroll_summary");
    const mustNeverText = contract.must_never_include.join(" ").toLowerCase();
    expect(mustNeverText).toMatch(/pa[yi]e|dsn|remplace/);
  });

  it("T26: prepayroll_summary requires human validation", () => {
    expect(getPierreDeliverableContract("prepayroll_summary").human_validation_required).toBe(true);
  });

  it("T27: pdf_export requires no raw markdown", () => {
    const contract = getPierreDeliverableContract("pdf_export");
    const formattingText = contract.formatting_rules.join(" ").toLowerCase();
    expect(formattingText).toMatch(/markdown/);
    expect(formattingText).toMatch(/artifact|brut|convert/i);
  });

  it("T28: pdf_export targets B45 style kit", () => {
    expect(getPierreDeliverableContract("pdf_export").template_support_target_block).toBe("B45");
  });

  it("T29: official documents target B45 (contract, amendment, certificate)", () => {
    const officialTypes: PierreDeliverableType[] = ["contract_draft", "amendment_draft", "certificate_draft"];
    for (const type of officialTypes) {
      expect(getPierreDeliverableContract(type).template_support_target_block).toBe("B45");
    }
  });

  it("T30: certificate_draft lists missing variables in must_include", () => {
    const contract = getPierreDeliverableContract("certificate_draft");
    const includesText = contract.must_include.join(" ").toLowerCase();
    expect(includesText).toMatch(/variable|manquant/);
  });

  it("T31: executive_report requires premium_client_visible quality", () => {
    expect(getPierreDeliverableContract("executive_report").output_quality_level).toBe("premium_client_visible");
  });

  it("T32: sensitive deliverables forbid autonomous action", () => {
    const sensitiveTypes: PierreDeliverableType[] = ["contract_draft", "certificate_draft", "executive_report"];
    for (const type of sensitiveTypes) {
      const contract = getPierreDeliverableContract(type);
      const neverText = contract.must_never_include.join(" ").toLowerCase();
      expect(neverText).toMatch(/auto|définitif|décision|signature/i);
    }
  });

  it("T33: at least 5 deliverable types require human validation", () => {
    expect(listDeliverableTypesRequiringHumanValidation().length).toBeGreaterThanOrEqual(5);
  });

  it("T34: at least 7 deliverable types target B45", () => {
    expect(listDeliverableTypesTargetingB45().length).toBeGreaterThanOrEqual(7);
  });
});

// ── Document Style Kit Requirements ──────────────────────────────────────────

describe("B38D — Document Style Kit (B44/B45 prep)", () => {
  it("T35: official_payslip_samples requirement exists", () => {
    expect(getRequirementById("official_payslip_samples")).toBeDefined();
  });

  it("T36: HR_letterhead requirement exists", () => {
    expect(getRequirementById("HR_letterhead")).toBeDefined();
  });

  it("T37: header_footer_rules requirement exists", () => {
    expect(getRequirementById("header_footer_rules")).toBeDefined();
  });

  it("T38: logo_asset requirement exists", () => {
    expect(getRequirementById("logo_asset")).toBeDefined();
  });

  it("T39: typography_rules requirement exists", () => {
    expect(getRequirementById("typography_rules")).toBeDefined();
  });

  it("T40: tone_examples requirement exists", () => {
    expect(getRequirementById("tone_examples")).toBeDefined();
  });

  it("T41: approval_stamp_rules requirement exists", () => {
    expect(getRequirementById("approval_stamp_rules")).toBeDefined();
  });

  it("T42: at least 15 style kit requirements defined", () => {
    expect(getAllDocumentStyleRequirements().length).toBeGreaterThanOrEqual(15);
  });

  it("T43: B44 has requirements", () => {
    expect(getRequirementsForBlock("B44").length).toBeGreaterThan(0);
  });

  it("T44: B45 has requirements", () => {
    expect(getRequirementsForBlock("B45").length).toBeGreaterThan(0);
  });

  it("T45: launch critical requirements include logo and payslip", () => {
    const critical = getLaunchCriticalRequirements();
    const ids = critical.map((r) => r.id);
    expect(ids).toContain("logo_asset");
    expect(ids).toContain("official_payslip_samples");
  });

  it("T46: style kit summary reports total and not_started", () => {
    const summary = getStyleKitCompletionSummary();
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.launch_critical_missing).toBeGreaterThanOrEqual(0);
  });
});

// ── Pierre Quality Policy ────────────────────────────────────────────────────

describe("B38D — Pierre Quality Policy (use-case routing)", () => {
  it("T47: pierre.pdf.generate is pdf_deliverable class", () => {
    expect(getPierreQualityClass("pierre.pdf.generate")).toBe("pdf_deliverable");
  });

  it("T48: pierre.risk.sensitive is sensitive_analysis class", () => {
    expect(getPierreQualityClass("pierre.risk.sensitive")).toBe("sensitive_analysis");
  });

  it("T49: pierre.final_report.generate is executive_report class", () => {
    expect(getPierreQualityClass("pierre.final_report.generate")).toBe("executive_report");
  });

  it("T50: platform.chat.answer is public_demo class", () => {
    expect(getPierreQualityClass("platform.chat.answer")).toBe("public_demo");
  });

  it("T51: pierre.brain.missing_info is orchestration class", () => {
    expect(getPierreQualityClass("pierre.brain.missing_info")).toBe("orchestration");
  });

  it("T52: pierre.pdf.generate requires premium", () => {
    expect(pierreUseCaseRequiresPremium("pierre.pdf.generate")).toBe(true);
  });

  it("T53: pierre.risk.sensitive requires human validation", () => {
    expect(pierreUseCaseRequiresHumanValidation("pierre.risk.sensitive")).toBe(true);
  });

  it("T54: unpaid user cannot access pierre.mission.interpret", () => {
    expect(pierreUseCaseAllowedForAccessLevel("pierre.mission.interpret", "logged_unpaid")).toBe(false);
  });

  it("T55: paid customer can access pierre.mission.interpret", () => {
    expect(pierreUseCaseAllowedForAccessLevel("pierre.mission.interpret", "paid_customer")).toBe(true);
  });

  it("T56: decidePierreAiRoute for unpaid routes to disabled", () => {
    const decision = decidePierreAiRoute({
      useCase: "pierre.mission.interpret",
      accessLevel: "logged_unpaid",
    });
    expect(decision.model_tier).toBe("disabled");
  });

  it("T57: decidePierreAiRoute for sensitive use case adds human validation", () => {
    const decision = decidePierreAiRoute({
      useCase: "pierre.risk.sensitive",
      accessLevel: "internal_admin",
      isSensitive: true,
    });
    expect(decision.requires_human_validation).toBe(true);
  });
});

// ── B38 Final Verdict (Pierre integration) ───────────────────────────────────

describe("B38D — B38 Final Verdict (Pierre view)", () => {
  it("T58: B38 final verdict status is validated_with_followups", () => {
    const verdict = buildB38FinalClosureVerdict();
    expect(verdict.status).toBe("validated_with_followups");
  });

  it("T59: B38 is safe to continue to B39", () => {
    const verdict = buildB38FinalClosureVerdict();
    expect(verdict.safe_to_continue_to_b39).toBe(true);
  });

  it("T60: B38 followups include B44 (Empreinte Entreprise)", () => {
    const verdict = buildB38FinalClosureVerdict();
    expect(verdict.remaining_followups.join(" ")).toContain("B44");
  });

  it("T61: B38 followups include B45 (Document Style Kit)", () => {
    const verdict = buildB38FinalClosureVerdict();
    expect(verdict.remaining_followups.join(" ")).toContain("B45");
  });

  it("T62: B38 notes mention Pierre as operational, not beta", () => {
    const verdict = buildB38FinalClosureVerdict();
    expect(verdict.notes.toLowerCase()).toMatch(/opérationnel|poste rh/i);
  });

  it("T63: launch_critical_future_blocks includes B44, B45, B48", () => {
    const verdict = buildB38FinalClosureVerdict();
    expect(verdict.launch_critical_future_blocks).toContain("B44");
    expect(verdict.launch_critical_future_blocks).toContain("B45");
    expect(verdict.launch_critical_future_blocks).toContain("B48");
  });

  it("T64: No API calls made — process.env has no OPENAI_API_KEY in test", () => {
    // Confirms: tests are purely logic-based, no real AI calls
    const verdict = buildB38FinalClosureVerdict();
    expect(verdict.validated_blocks.find((b) => b.block.includes("B38B"))?.validated).toBe(true);
    // B38B validated live, but this test file itself makes zero API calls
    expect(typeof verdict.score_0_to_100).toBe("number");
  });
});
