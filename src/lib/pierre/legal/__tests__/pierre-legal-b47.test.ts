// B47 — Pierre Legal Module Tests
// Tests for all Pierre legal modules: taxonomy, guardrails, sensitive HR policy,
// document policy, payroll policy, email policy, commercial claims, legal verdict.
// No Supabase. No Next.js. No async.

import { describe, it, expect } from "vitest";

// Pierre legal taxonomy
import {
  getAllTaxonomyDefinitions,
  getTaxonomyDefinition,
  classifyHrTextCategory,
  isCategoryAutonomousAllowed,
  isCategoryHumanValidationRequired,
  getPolicyForCategory,
  getSensitiveCategoryRiskLevel,
} from "../pierre-legal-taxonomy";

// Pierre legal guardrails
import {
  evaluatePierreActionLegalSafety,
  enforcePierreLegalGuardrails,
  buildPierreLegalSafeNextActions,
  getPierreHumanValidationRequirement,
} from "../pierre-legal-guardrails";

// Pierre sensitive HR policy
import {
  getPierreSensitiveHrCapability,
  getAllSensitiveHrCapabilities,
  isSensitiveHrCategory,
  buildSensitiveCaseSummary,
} from "../pierre-sensitive-hr-policy";

// Pierre document legal policy
import {
  evaluatePierreDocumentLegalPolicy,
  requireValidationForDocumentType,
  getOfficialDocumentDisclaimers,
  assertDocumentDoesNotClaimLegalFinality,
  isOfficialDocumentType,
  getAllDocumentPolicies,
} from "../pierre-document-legal-policy";

// Pierre payroll policy
import {
  getPierrePayrollTaskPolicy,
  isPierrePayrollTaskAllowed,
  isPierrePayrollTaskBlocked,
  getAllPayrollTaskPolicies,
  getBlockedPayrollTasks,
  getAllowedPayrollTasks,
  assertPierrePayrollNotOfficialSoftware,
  buildPayrollCapabilitySummary,
} from "../pierre-payroll-policy";

// Pierre email legal policy
import {
  getPierreEmailActionPolicy,
  isPierreEmailActionAllowed,
  isPierreEmailActionBlocked,
  getAllEmailActionPolicies,
  getBlockedEmailActions,
  getAllowedEmailActions,
  buildEmailCapabilitySummary,
} from "../pierre-email-legal-policy";

// Pierre commercial claims
import {
  getAllPierreSafeClaims,
  getAllPierreForbiddenClaims,
  isPierreClaimSafe,
  getPierreSafeRewrite,
  evaluatePierreCommercialClaim,
  getPierrePositioningStatement,
  getPierreLegalLimitStatement,
} from "../pierre-commercial-claims";

// Pierre legal verdict
import {
  buildPierreLegalVerdict,
  isPierreSafeToLaunchInB48,
  getPierreHardLimits,
} from "../pierre-legal-verdict";

// ── 1. Legal taxonomy ─────────────────────────────────────────────────────────

describe("pierre-legal-taxonomy — getAllTaxonomyDefinitions", () => {
  it("returns at least 10 categories", () => {
    expect(getAllTaxonomyDefinitions().length).toBeGreaterThanOrEqual(10);
  });

  it("all definitions have category, risk_level, keywords, policy", () => {
    for (const def of getAllTaxonomyDefinitions()) {
      expect(def).toHaveProperty("category");
      expect(def).toHaveProperty("risk_level");
      expect(Array.isArray(def.keywords)).toBe(true);
      expect(def).toHaveProperty("policy");
    }
  });
});

describe("pierre-legal-taxonomy — getTaxonomyDefinition", () => {
  it("returns dismissal definition", () => {
    const def = getTaxonomyDefinition("dismissal");
    expect(def).toBeTruthy();
    expect(def!.category).toBe("dismissal");
    expect(def!.risk_level).toBe("critical");
  });

  it("returns null for unknown category", () => {
    expect(getTaxonomyDefinition("unknown" as never)).toBeNull();
  });
});

describe("pierre-legal-taxonomy — classifyHrTextCategory", () => {
  it("classifies licenciement as dismissal", () => {
    expect(classifyHrTextCategory("Je veux licencier un salarié.")).toBe("dismissal");
  });

  it("classifies sanction as sanction", () => {
    expect(classifyHrTextCategory("Avertissement disciplinaire pour absence.")).toBe("sanction");
  });

  it("classifies harcèlement as harassment", () => {
    expect(classifyHrTextCategory("Signalement de harcèlement moral.")).toBe("harassment");
  });

  it("classifies paie as payroll", () => {
    expect(classifyHrTextCategory("Préparer les éléments de paie du mois.")).toBe("payroll");
  });

  it("classifies maladie as health", () => {
    expect(classifyHrTextCategory("Arrêt maladie de 10 jours.")).toBe("health");
  });

  it("classifies contrat as contract", () => {
    expect(classifyHrTextCategory("Rédiger un avenant au contrat de travail.")).toBe("contract");
  });

  it("returns other for unrelated text", () => {
    expect(classifyHrTextCategory("Bonjour comment ça va ?")).toBe("other");
  });
});

describe("pierre-legal-taxonomy — isCategoryAutonomousAllowed", () => {
  it("returns false for dismissal", () => {
    expect(isCategoryAutonomousAllowed("dismissal")).toBe(false);
  });

  it("returns false for sanction", () => {
    expect(isCategoryAutonomousAllowed("sanction")).toBe(false);
  });

  it("returns false for harassment", () => {
    expect(isCategoryAutonomousAllowed("harassment")).toBe(false);
  });
});

describe("pierre-legal-taxonomy — isCategoryHumanValidationRequired", () => {
  it("returns true for dismissal", () => {
    expect(isCategoryHumanValidationRequired("dismissal")).toBe(true);
  });

  it("returns true for sanction", () => {
    expect(isCategoryHumanValidationRequired("sanction")).toBe(true);
  });

  it("returns true for health", () => {
    expect(isCategoryHumanValidationRequired("health")).toBe(true);
  });

  it("returns true for payroll", () => {
    expect(isCategoryHumanValidationRequired("payroll")).toBe(true);
  });
});

describe("pierre-legal-taxonomy — getSensitiveCategoryRiskLevel", () => {
  it("returns critical for dismissal", () => {
    expect(getSensitiveCategoryRiskLevel("dismissal")).toBe("critical");
  });

  it("returns critical for sanction", () => {
    expect(getSensitiveCategoryRiskLevel("sanction")).toBe("critical");
  });

  it("returns high for health", () => {
    expect(getSensitiveCategoryRiskLevel("health")).toBe("high");
  });
});

describe("pierre-legal-taxonomy — getPolicyForCategory", () => {
  it("returns policy for dismissal", () => {
    const policy = getPolicyForCategory("dismissal");
    expect(policy).toBeTruthy();
    expect(policy!.autonomous_allowed).toBe(false);
    expect(policy!.send_allowed).toBe(false);
  });

  it("has human_validation_required=true for critical categories", () => {
    const policy = getPolicyForCategory("harassment");
    expect(policy!.human_validation_required).toBe(true);
  });
});

// ── 2. Legal guardrails ───────────────────────────────────────────────────────

describe("pierre-legal-guardrails — evaluatePierreActionLegalSafety", () => {
  it("classifies licenciement as dismissal", () => {
    const res = evaluatePierreActionLegalSafety("auto_send", "licenciement d'un salarié");
    expect(res.category).toBe("dismissal");
    expect(res.autonomous_allowed).toBe(false);
  });

  it("blocks auto_send_dismissal action", () => {
    const res = evaluatePierreActionLegalSafety("auto_send_dismissal");
    expect(res.blocked_actions.length).toBeGreaterThan(0);
  });

  it("blocks licenciement in action string", () => {
    const res = evaluatePierreActionLegalSafety("send licenciement notice");
    expect(res.blocked_actions.length).toBeGreaterThan(0);
  });

  it("returns safe_next_actions for sensitive category", () => {
    const res = evaluatePierreActionLegalSafety("prepare_draft", "sanction disciplinaire");
    expect(res.safe_next_actions.length).toBeGreaterThan(0);
  });
});

describe("pierre-legal-guardrails — enforcePierreLegalGuardrails", () => {
  it("blocks auto send for dismissal", () => {
    const res = enforcePierreLegalGuardrails("auto_send", "licenciement");
    expect(res.allowed).toBe(false);
    expect(res.reason).toBeTruthy();
  });

  it("blocks sanction auto-send", () => {
    const res = enforcePierreLegalGuardrails("auto_send_sanction");
    expect(res.allowed).toBe(false);
  });

  it("allows prepare_draft for dismissal", () => {
    const res = enforcePierreLegalGuardrails("prepare_draft", "licenciement");
    expect(res.allowed).toBe(true);
  });

  it("blocks decide_alone for sensitive categories", () => {
    const res = enforcePierreLegalGuardrails("auto_decide", "licenciement");
    expect(res.allowed).toBe(false);
  });

  it("includes the evaluation in the result", () => {
    const res = enforcePierreLegalGuardrails("prepare_summary", "sanction");
    expect(res).toHaveProperty("evaluation");
  });
});

describe("pierre-legal-guardrails — buildPierreLegalSafeNextActions", () => {
  it("returns safe next actions array", () => {
    const actions = buildPierreLegalSafeNextActions("prepare_draft", "licenciement");
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
  });
});

describe("pierre-legal-guardrails — getPierreHumanValidationRequirement", () => {
  it("requires validation for dismissal", () => {
    const req = getPierreHumanValidationRequirement("prepare_draft", "licenciement");
    expect(req.required).toBe(true);
    expect(req.reason).toBeTruthy();
  });

  it("requires validation for high risk even if not flagged", () => {
    const req = getPierreHumanValidationRequirement("prepare_draft", "arrêt maladie");
    expect(req.required).toBe(true);
  });
});

// ── 3. Sensitive HR policy ────────────────────────────────────────────────────

describe("pierre-sensitive-hr-policy — getPierreSensitiveHrCapability", () => {
  it("dismissal: can_prepare=true, can_send=false, can_decide=false", () => {
    const cap = getPierreSensitiveHrCapability("dismissal");
    expect(cap.can_prepare).toBe(true);
    expect(cap.can_send).toBe(false);
    expect(cap.can_decide).toBe(false);
  });

  it("dismissal: can_export=false", () => {
    expect(getPierreSensitiveHrCapability("dismissal").can_export).toBe(false);
  });

  it("sanction: can_prepare=true, can_send=false", () => {
    const cap = getPierreSensitiveHrCapability("sanction");
    expect(cap.can_prepare).toBe(true);
    expect(cap.can_send).toBe(false);
  });

  it("harassment: can_decide=false", () => {
    expect(getPierreSensitiveHrCapability("harassment").can_decide).toBe(false);
  });

  it("returns a note string", () => {
    const cap = getPierreSensitiveHrCapability("contract");
    expect(typeof cap.note).toBe("string");
    expect(cap.note.length).toBeGreaterThan(0);
  });
});

describe("pierre-sensitive-hr-policy — getAllSensitiveHrCapabilities", () => {
  it("returns at least 10 capabilities", () => {
    expect(getAllSensitiveHrCapabilities().length).toBeGreaterThanOrEqual(10);
  });
});

describe("pierre-sensitive-hr-policy — isSensitiveHrCategory", () => {
  it("detects licenci as sensitive", () => {
    expect(isSensitiveHrCategory("Licenciement d'un salarié.")).toBe(true);
  });

  it("detects harcel as sensitive", () => {
    expect(isSensitiveHrCategory("Signalement de harcèlement.")).toBe(true);
  });

  it("detects paie as sensitive", () => {
    expect(isSensitiveHrCategory("Bulletins de paie du mois.")).toBe(true);
  });

  it("returns false for non-sensitive text", () => {
    expect(isSensitiveHrCategory("Réunion d'équipe demain.")).toBe(false);
  });
});

describe("pierre-sensitive-hr-policy — buildSensitiveCaseSummary", () => {
  it("returns what_pierre_can_do and what_pierre_cannot_do arrays", () => {
    const summary = buildSensitiveCaseSummary("dismissal");
    expect(Array.isArray(summary.what_pierre_can_do)).toBe(true);
    expect(Array.isArray(summary.what_pierre_cannot_do)).toBe(true);
  });

  it("cannot_do includes 'Envoyer seul'", () => {
    const summary = buildSensitiveCaseSummary("dismissal");
    expect(summary.what_pierre_cannot_do.some((s) => s.includes("Envoyer"))).toBe(true);
  });

  it("cannot_do includes promise not to certify legality", () => {
    const summary = buildSensitiveCaseSummary("sanction");
    expect(summary.what_pierre_cannot_do.some((s) => s.toLowerCase().includes("légalit"))).toBe(true);
  });

  it("has required_next_step", () => {
    const summary = buildSensitiveCaseSummary("harassment");
    expect(typeof summary.required_next_step).toBe("string");
    expect(summary.required_next_step.length).toBeGreaterThan(0);
  });
});

// ── 4. Document legal policy ──────────────────────────────────────────────────

describe("pierre-document-legal-policy — getAllDocumentPolicies", () => {
  it("returns at least 10 policies", () => {
    expect(getAllDocumentPolicies().length).toBeGreaterThanOrEqual(10);
  });
});

describe("pierre-document-legal-policy — evaluatePierreDocumentLegalPolicy", () => {
  it("contract has risk_level=critical", () => {
    expect(evaluatePierreDocumentLegalPolicy("contract").risk_level).toBe("critical");
  });

  it("contract has human_validation_required=true", () => {
    expect(evaluatePierreDocumentLegalPolicy("contract").human_validation_required).toBe(true);
  });

  it("dismissal_letter has export_allowed_without_validation=false", () => {
    expect(evaluatePierreDocumentLegalPolicy("dismissal_letter").export_allowed_without_validation).toBe(false);
  });

  it("dismissal_letter has auto_send_allowed=false", () => {
    expect(evaluatePierreDocumentLegalPolicy("dismissal_letter").auto_send_allowed).toBe(false);
  });

  it("onboarding_document has risk_level=low", () => {
    expect(evaluatePierreDocumentLegalPolicy("onboarding_document").risk_level).toBe("low");
  });

  it("hr_internal_note has export_allowed_without_validation=true", () => {
    expect(evaluatePierreDocumentLegalPolicy("hr_internal_note").export_allowed_without_validation).toBe(true);
  });

  it("payroll_document has human_validation_required=true", () => {
    expect(evaluatePierreDocumentLegalPolicy("payroll_document").human_validation_required).toBe(true);
  });

  it("sanction has legal_review_recommended=true", () => {
    expect(evaluatePierreDocumentLegalPolicy("sanction").legal_review_recommended).toBe(true);
  });
});

describe("pierre-document-legal-policy — requireValidationForDocumentType", () => {
  it("returns true for contract", () => {
    expect(requireValidationForDocumentType("contract")).toBe(true);
  });

  it("returns true for sanction", () => {
    expect(requireValidationForDocumentType("sanction")).toBe(true);
  });

  it("returns false for hr_internal_note", () => {
    expect(requireValidationForDocumentType("hr_internal_note")).toBe(false);
  });
});

describe("pierre-document-legal-policy — isOfficialDocumentType", () => {
  it("returns true for contract", () => {
    expect(isOfficialDocumentType("contract")).toBe(true);
  });

  it("returns true for attestation", () => {
    expect(isOfficialDocumentType("attestation")).toBe(true);
  });

  it("returns true for dismissal_letter", () => {
    expect(isOfficialDocumentType("dismissal_letter")).toBe(true);
  });

  it("returns false for hr_internal_note", () => {
    expect(isOfficialDocumentType("hr_internal_note")).toBe(false);
  });

  it("returns false for onboarding_document", () => {
    expect(isOfficialDocumentType("onboarding_document")).toBe(false);
  });
});

describe("pierre-document-legal-policy — assertDocumentDoesNotClaimLegalFinality", () => {
  it("returns ok=true for safe text", () => {
    const res = assertDocumentDoesNotClaimLegalFinality("Ce document est un brouillon à valider.");
    expect(res.ok).toBe(true);
  });

  it("returns ok=false for 'valeur juridique garantie'", () => {
    const res = assertDocumentDoesNotClaimLegalFinality("Ce document a une valeur juridique garantie.");
    expect(res.ok).toBe(false);
  });

  it("returns ok=false for 'certifié par l'ia'", () => {
    const res = assertDocumentDoesNotClaimLegalFinality("Document certifié par l'IA — conforme.");
    expect(res.ok).toBe(false);
  });
});

// ── 5. Payroll policy ─────────────────────────────────────────────────────────

describe("pierre-payroll-policy — getAllPayrollTaskPolicies", () => {
  it("returns at least 8 policies", () => {
    expect(getAllPayrollTaskPolicies().length).toBeGreaterThanOrEqual(8);
  });
});

describe("pierre-payroll-policy — isPierrePayrollTaskAllowed", () => {
  it("allows variable_elements_collection", () => {
    expect(isPierrePayrollTaskAllowed("variable_elements_collection")).toBe(true);
  });

  it("allows prepayroll_summary", () => {
    expect(isPierrePayrollTaskAllowed("prepayroll_summary")).toBe(true);
  });

  it("does not allow payslip_generation", () => {
    expect(isPierrePayrollTaskAllowed("payslip_generation")).toBe(false);
  });

  it("does not allow dsn_submission", () => {
    expect(isPierrePayrollTaskAllowed("dsn_submission")).toBe(false);
  });

  it("does not allow official_payroll_calculation", () => {
    expect(isPierrePayrollTaskAllowed("official_payroll_calculation")).toBe(false);
  });

  it("does not allow payroll_certification", () => {
    expect(isPierrePayrollTaskAllowed("payroll_certification")).toBe(false);
  });
});

describe("pierre-payroll-policy — isPierrePayrollTaskBlocked", () => {
  it("payslip_generation is blocked", () => {
    expect(isPierrePayrollTaskBlocked("payslip_generation")).toBe(true);
  });

  it("dsn_submission is blocked", () => {
    expect(isPierrePayrollTaskBlocked("dsn_submission")).toBe(true);
  });

  it("variable_elements_collection is not blocked", () => {
    expect(isPierrePayrollTaskBlocked("variable_elements_collection")).toBe(false);
  });
});

describe("pierre-payroll-policy — getBlockedPayrollTasks", () => {
  it("returns at least 5 blocked tasks", () => {
    expect(getBlockedPayrollTasks().length).toBeGreaterThanOrEqual(5);
  });

  it("all returned tasks are blocked", () => {
    for (const task of getBlockedPayrollTasks()) {
      expect(task.is_blocked).toBe(true);
    }
  });
});

describe("pierre-payroll-policy — getAllowedPayrollTasks", () => {
  it("returns at least 3 allowed tasks", () => {
    expect(getAllowedPayrollTasks().length).toBeGreaterThanOrEqual(3);
  });

  it("all returned tasks are allowed (pierre_can_do=true)", () => {
    for (const task of getAllowedPayrollTasks()) {
      expect(task.pierre_can_do).toBe(true);
      expect(task.is_blocked).toBe(false);
    }
  });
});

describe("pierre-payroll-policy — assertPierrePayrollNotOfficialSoftware", () => {
  it("returns ok=true for safe claim", () => {
    const res = assertPierrePayrollNotOfficialSoftware("Pierre prépare les éléments variables.");
    expect(res.ok).toBe(true);
  });

  it("returns ok=false for 'logiciel de paie' claim", () => {
    const res = assertPierrePayrollNotOfficialSoftware("Pierre est un logiciel de paie certifié.");
    expect(res.ok).toBe(false);
  });

  it("returns ok=false for 'reemplace la dsn'", () => {
    const res = assertPierrePayrollNotOfficialSoftware("Pierre remplace la DSN officielle.");
    expect(res.ok).toBe(false);
  });
});

describe("pierre-payroll-policy — buildPayrollCapabilitySummary", () => {
  it("returns can_do and cannot_do arrays", () => {
    const summary = buildPayrollCapabilitySummary();
    expect(Array.isArray(summary.can_do)).toBe(true);
    expect(Array.isArray(summary.cannot_do)).toBe(true);
  });

  it("key_limit is a non-empty string", () => {
    expect(buildPayrollCapabilitySummary().key_limit.length).toBeGreaterThan(0);
  });
});

// ── 6. Email legal policy ─────────────────────────────────────────────────────

describe("pierre-email-legal-policy — getAllEmailActionPolicies", () => {
  it("returns at least 8 policies", () => {
    expect(getAllEmailActionPolicies().length).toBeGreaterThanOrEqual(8);
  });
});

describe("pierre-email-legal-policy — isPierreEmailActionAllowed", () => {
  it("allows draft_email", () => {
    expect(isPierreEmailActionAllowed("draft_email")).toBe(true);
  });

  it("allows prepare_reminder", () => {
    expect(isPierreEmailActionAllowed("prepare_reminder")).toBe(true);
  });

  it("does not allow send_email_autonomous", () => {
    expect(isPierreEmailActionAllowed("send_email_autonomous")).toBe(false);
  });

  it("does not allow send_dismissal_notification", () => {
    expect(isPierreEmailActionAllowed("send_dismissal_notification")).toBe(false);
  });

  it("does not allow send_sanction_notification", () => {
    expect(isPierreEmailActionAllowed("send_sanction_notification")).toBe(false);
  });

  it("does not allow send_legal_notice", () => {
    expect(isPierreEmailActionAllowed("send_legal_notice")).toBe(false);
  });

  it("does not allow send_contract_offer", () => {
    expect(isPierreEmailActionAllowed("send_contract_offer")).toBe(false);
  });

  it("does not allow mass_email_campaign", () => {
    expect(isPierreEmailActionAllowed("mass_email_campaign")).toBe(false);
  });

  it("does not allow send_official_document_by_email", () => {
    expect(isPierreEmailActionAllowed("send_official_document_by_email")).toBe(false);
  });
});

describe("pierre-email-legal-policy — isPierreEmailActionBlocked", () => {
  it("send_email_autonomous is blocked", () => {
    expect(isPierreEmailActionBlocked("send_email_autonomous")).toBe(true);
  });

  it("draft_email is not blocked", () => {
    expect(isPierreEmailActionBlocked("draft_email")).toBe(false);
  });
});

describe("pierre-email-legal-policy — getBlockedEmailActions", () => {
  it("returns at least 6 blocked actions", () => {
    expect(getBlockedEmailActions().length).toBeGreaterThanOrEqual(6);
  });

  it("all returned actions are blocked", () => {
    for (const action of getBlockedEmailActions()) {
      expect(action.is_blocked).toBe(true);
    }
  });
});

describe("pierre-email-legal-policy — getAllowedEmailActions", () => {
  it("returns at least 2 allowed actions", () => {
    expect(getAllowedEmailActions().length).toBeGreaterThanOrEqual(2);
  });

  it("all returned actions are allowed", () => {
    for (const action of getAllowedEmailActions()) {
      expect(action.pierre_can_do).toBe(true);
      expect(action.is_blocked).toBe(false);
    }
  });
});

describe("pierre-email-legal-policy — getPierreEmailActionPolicy", () => {
  it("draft_email requires human approval before send", () => {
    expect(getPierreEmailActionPolicy("draft_email").requires_human_approval_before_send).toBe(true);
  });

  it("send_dismissal_notification has a blocked_reason", () => {
    const policy = getPierreEmailActionPolicy("send_dismissal_notification");
    expect(policy.blocked_reason).toBeTruthy();
  });
});

describe("pierre-email-legal-policy — buildEmailCapabilitySummary", () => {
  it("returns can_do and cannot_do", () => {
    const summary = buildEmailCapabilitySummary();
    expect(Array.isArray(summary.can_do)).toBe(true);
    expect(Array.isArray(summary.cannot_do)).toBe(true);
  });

  it("key_limit mentions human approval", () => {
    const summary = buildEmailCapabilitySummary();
    expect(summary.key_limit.toLowerCase()).toContain("approbation");
  });
});

// ── 7. Commercial claims ──────────────────────────────────────────────────────

describe("pierre-commercial-claims — getAllPierreSafeClaims", () => {
  it("returns at least 5 safe claims", () => {
    expect(getAllPierreSafeClaims().length).toBeGreaterThanOrEqual(5);
  });

  it("all safe claims have is_safe=true", () => {
    for (const c of getAllPierreSafeClaims()) {
      expect(c.is_safe).toBe(true);
    }
  });
});

describe("pierre-commercial-claims — getAllPierreForbiddenClaims", () => {
  it("returns at least 5 forbidden claims", () => {
    expect(getAllPierreForbiddenClaims().length).toBeGreaterThanOrEqual(5);
  });

  it("all forbidden claims have is_safe=false", () => {
    for (const c of getAllPierreForbiddenClaims()) {
      expect(c.is_safe).toBe(false);
    }
  });

  it("all forbidden claims have a safe_rewrite", () => {
    for (const c of getAllPierreForbiddenClaims()) {
      expect(typeof c.safe_rewrite).toBe("string");
      expect(c.safe_rewrite!.length).toBeGreaterThan(0);
    }
  });
});

describe("pierre-commercial-claims — isPierreClaimSafe", () => {
  it("returns true for safe text not matching any forbidden claim", () => {
    expect(isPierreClaimSafe("Pierre aide vos équipes RH.")).toBe(true);
  });
});

describe("pierre-commercial-claims — getPierreSafeRewrite", () => {
  it("returns null for unknown text", () => {
    expect(getPierreSafeRewrite("Bonjour")).toBeNull();
  });
});

describe("pierre-commercial-claims — evaluatePierreCommercialClaim", () => {
  it("returns a result with decision and risk_level", () => {
    const res = evaluatePierreCommercialClaim("Pierre aide vos équipes RH.");
    expect(res).toHaveProperty("decision");
    expect(res).toHaveProperty("risk_level");
  });
});

describe("pierre-commercial-claims — positioning and limit statements", () => {
  it("getPierrePositioningStatement returns a non-empty string", () => {
    expect(getPierrePositioningStatement().length).toBeGreaterThan(0);
  });

  it("getPierreLegalLimitStatement returns a non-empty string", () => {
    expect(getPierreLegalLimitStatement().length).toBeGreaterThan(0);
  });

  it("positioning statement does not claim legal autonomy", () => {
    const s = getPierrePositioningStatement().toLowerCase();
    expect(s).not.toContain("juridiquement autonome");
    expect(s).not.toContain("remplace un avocat");
  });

  it("legal limit statement mentions 'avocat'", () => {
    expect(getPierreLegalLimitStatement().toLowerCase()).toContain("avocat");
  });
});

// ── 8. Legal verdict ──────────────────────────────────────────────────────────

describe("pierre-legal-verdict — buildPierreLegalVerdict", () => {
  it("returns a verdict object", () => {
    const v = buildPierreLegalVerdict();
    expect(v).toHaveProperty("status");
    expect(v).toHaveProperty("score_0_to_100");
    expect(v).toHaveProperty("safe_to_use_in_b48");
    expect(v).toHaveProperty("legal_review_required");
  });

  it("safe_to_use_in_b48 is true", () => {
    expect(buildPierreLegalVerdict().safe_to_use_in_b48).toBe(true);
  });

  it("legal_review_required is true", () => {
    expect(buildPierreLegalVerdict().legal_review_required).toBe(true);
  });

  it("score is between 0 and 100", () => {
    const { score_0_to_100 } = buildPierreLegalVerdict();
    expect(score_0_to_100).toBeGreaterThanOrEqual(0);
    expect(score_0_to_100).toBeLessThanOrEqual(100);
  });

  it("covered_modules includes pierre_legal_taxonomy", () => {
    expect(buildPierreLegalVerdict().covered_modules).toContain("pierre_legal_taxonomy");
  });

  it("hard_limits contains at least 5 items", () => {
    expect(buildPierreLegalVerdict().hard_limits.length).toBeGreaterThanOrEqual(5);
  });

  it("capabilities_summary has correct structure", () => {
    const caps = buildPierreLegalVerdict().capabilities_summary;
    expect(typeof caps.sensitive_hr_categories).toBe("number");
    expect(typeof caps.payroll_blocked_tasks).toBe("number");
    expect(typeof caps.email_blocked_actions).toBe("number");
  });
});

describe("pierre-legal-verdict — isPierreSafeToLaunchInB48", () => {
  it("returns true", () => {
    expect(isPierreSafeToLaunchInB48()).toBe(true);
  });
});

describe("pierre-legal-verdict — getPierreHardLimits", () => {
  it("returns a non-empty array", () => {
    expect(getPierreHardLimits().length).toBeGreaterThan(0);
  });

  it("mentions licenciement", () => {
    const limits = getPierreHardLimits().join(" ").toLowerCase();
    expect(limits).toContain("licenciement");
  });

  it("mentions bulletins de paie", () => {
    const limits = getPierreHardLimits().join(" ").toLowerCase();
    expect(limits).toContain("bulletins de paie");
  });
});
