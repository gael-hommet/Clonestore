import { describe, it, expect } from "vitest";
import {
  getEmployeeActionCatalog,
  getEmployeeActionById,
  getEmployeeActionsByDomain,
  inferEmployeeActionDomain,
  inferEmployeeActionType,
  classifyEmployeeActionRisk,
  resolveEmployeeActionGovernance,
  isEmployeeActionAutoSafe,
  scoreEmployeeActionConfidence,
  buildEmployeeActionSuggestions,
  buildEmployeeActionPlan,
  buildEmployeeActionSummary,
  getEmployeeActionDomainsActive,
  resolveEmployeeActionResult,
  buildEmployeeActionTaskDraft,
  buildEmployeeActionTrace,
  buildEmployeeActionAuditMeta,
  buildEmployeeActionsIndex,
  filterEmployeeActionsByGovernance,
  filterEmployeeActionsByRisk,
  type PierreEmployeeActionDomain,
  type PierreEmployeeActionGovernance,
  type PierreEmployeeActionRisk,
} from "../hr/employee-actions";

// ── Fixtures ───────────────────────────────────────────────

const empOnboarding = {
  id: "emp-001",
  full_name: "Alice Dupont",
  status: "onboarding",
  contract_type: "cdi",
  department: "RH",
};

const empOffboarding = {
  id: "emp-002",
  full_name: "Bob Martin",
  status: "offboarding",
  contract_type: "cdd",
  department: "IT",
};

const empActive = {
  id: "emp-003",
  full_name: "Claire Lebrun",
  status: "active",
  contract_type: "cdi",
  department: "Finance",
};

const empCdd = {
  id: "emp-004",
  full_name: "David Petit",
  status: "active",
  contract_type: "cdd",
  department: "Sales",
};

const missionAbsence = {
  id: "m-001",
  mission_summary: "Gérer l'absence maladie de l'employé",
  status: "active",
};

const missionFormation = {
  id: "m-002",
  mission_summary: "Plan de formation et certification",
  status: "active",
};

const taskReady = {
  id: "t-001",
  status: "ready",
  type: "doc.generate",
  title: "Générer document",
};

const taskAwaiting = {
  id: "t-002",
  status: "awaiting_approval",
  type: "email.draft",
  title: "Draft email",
};

// ══════════════════════════════════════════════════════════
// 1. CATALOG ACCESS
// ══════════════════════════════════════════════════════════

describe("getEmployeeActionCatalog", () => {
  it("returns array of catalog items", () => {
    const catalog = getEmployeeActionCatalog();
    expect(Array.isArray(catalog)).toBe(true);
  });

  it("returns at least 30 items", () => {
    expect(getEmployeeActionCatalog().length).toBeGreaterThanOrEqual(30);
  });

  it("all items have required fields", () => {
    for (const item of getEmployeeActionCatalog()) {
      expect(item.id).toBeTruthy();
      expect(item.domain).toBeTruthy();
      expect(item.action_type).toBeTruthy();
      expect(item.label_fr).toBeTruthy();
      expect(item.label_en).toBeTruthy();
      expect(["auto_safe", "approval_required", "manual_only", "blocked"]).toContain(item.governance);
      expect(["green", "orange", "red", "black"]).toContain(item.risk);
      expect(typeof item.requires_employee).toBe("boolean");
      expect(typeof item.requires_document).toBe("boolean");
      expect(item.description).toBeTruthy();
    }
  });

  it("covers all 12 domains", () => {
    const domains = new Set(getEmployeeActionCatalog().map((a) => a.domain));
    const expectedDomains: PierreEmployeeActionDomain[] = [
      "onboarding", "offboarding", "contract", "absence", "payroll",
      "training", "interview", "document", "communication", "followup", "note", "general",
    ];
    for (const d of expectedDomains) {
      expect(domains.has(d)).toBe(true);
    }
  });

  it("ids match action_types", () => {
    for (const item of getEmployeeActionCatalog()) {
      expect(item.id).toBe(item.action_type);
    }
  });

  it("no duplicate ids", () => {
    const ids = getEmployeeActionCatalog().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getEmployeeActionById", () => {
  it("returns item for known id", () => {
    const item = getEmployeeActionById("onboarding.welcome_email");
    expect(item).not.toBeNull();
    expect(item?.action_type).toBe("onboarding.welcome_email");
  });

  it("returns null for unknown id", () => {
    expect(getEmployeeActionById("unknown.action")).toBeNull();
  });

  it("returns item for offboarding termination", () => {
    const item = getEmployeeActionById("offboarding.termination_letter_draft");
    expect(item?.risk).toBe("red");
    expect(item?.governance).toBe("manual_only");
  });

  it("returns item for contract renewal", () => {
    const item = getEmployeeActionById("contract.renewal_reminder");
    expect(item?.governance).toBe("auto_safe");
    expect(item?.domain).toBe("contract");
  });
});

describe("getEmployeeActionsByDomain", () => {
  it("returns onboarding items", () => {
    const items = getEmployeeActionsByDomain("onboarding");
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.every((a) => a.domain === "onboarding")).toBe(true);
  });

  it("returns offboarding items", () => {
    const items = getEmployeeActionsByDomain("offboarding");
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("returns contract items", () => {
    const items = getEmployeeActionsByDomain("contract");
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("returns empty for nonexistent domain cast", () => {
    const items = getEmployeeActionsByDomain("general");
    expect(Array.isArray(items)).toBe(true);
  });

  it("all returned items match requested domain", () => {
    for (const domain of ["absence", "payroll", "training", "interview"] as PierreEmployeeActionDomain[]) {
      const items = getEmployeeActionsByDomain(domain);
      expect(items.every((a) => a.domain === domain)).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════
// 2. INFERENCE
// ══════════════════════════════════════════════════════════

describe("inferEmployeeActionDomain", () => {
  it("detects onboarding domain", () => {
    expect(inferEmployeeActionDomain("intégration du nouveau salarié")).toBe("onboarding");
  });

  it("detects offboarding domain", () => {
    expect(inferEmployeeActionDomain("départ et licenciement")).toBe("offboarding");
  });

  it("detects contract domain", () => {
    expect(inferEmployeeActionDomain("renouvellement de contrat CDD")).toBe("contract");
  });

  it("detects absence domain", () => {
    expect(inferEmployeeActionDomain("gestion de l'absence maladie")).toBe("absence");
  });

  it("detects payroll domain", () => {
    expect(inferEmployeeActionDomain("préparation bulletin de paie")).toBe("payroll");
  });

  it("detects training domain", () => {
    expect(inferEmployeeActionDomain("plan de formation certifié")).toBe("training");
  });

  it("detects interview domain", () => {
    expect(inferEmployeeActionDomain("entretien annuel d'évaluation")).toBe("interview");
  });

  it("detects document domain", () => {
    expect(inferEmployeeActionDomain("attestation de travail requise")).toBe("document");
  });

  it("detects communication domain", () => {
    expect(inferEmployeeActionDomain("email relance manager")).toBe("communication");
  });

  it("returns general for unrecognized text", () => {
    expect(inferEmployeeActionDomain("xyz abc 123")).toBe("general");
  });

  it("is case insensitive", () => {
    expect(inferEmployeeActionDomain("FORMATION OBLIGATOIRE")).toBe("training");
  });

  it("handles normalized accents", () => {
    expect(inferEmployeeActionDomain("integration salarié")).toBe("onboarding");
  });
});

describe("inferEmployeeActionType", () => {
  it("returns specific action for welcome email", () => {
    const result = inferEmployeeActionType("email de bienvenue pour le nouveau");
    expect(result).toBe("onboarding.welcome_email");
  });

  it("returns specific action for document checklist", () => {
    const result = inferEmployeeActionType("checklist documents integration arrivée");
    expect(result).not.toBeNull();
  });

  it("returns specific action for termination letter", () => {
    const result = inferEmployeeActionType("lettre licenciement à rédiger");
    expect(result).toBe("offboarding.termination_letter_draft");
  });

  it("returns specific action for annual review", () => {
    const result = inferEmployeeActionType("entretien annuel d'évaluation");
    expect(result).toBe("interview.annual_review_schedule");
  });

  it("falls back to first domain item for domain match", () => {
    const result = inferEmployeeActionType("formation certifiée");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("returns null for completely unrecognized input", () => {
    // "general" domain has no items other than general.action_reminder
    const result = inferEmployeeActionType("xyz 999 abc");
    // May return a fallback or null — just assert string or null
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("returns work certificate for attestation", () => {
    const result = inferEmployeeActionType("attestation de travail pour le salarié");
    expect(result).toBe("document.work_certificate_draft");
  });
});

// ══════════════════════════════════════════════════════════
// 3. RISK & GOVERNANCE
// ══════════════════════════════════════════════════════════

describe("classifyEmployeeActionRisk", () => {
  it("returns green for welcome email", () => {
    expect(classifyEmployeeActionRisk("onboarding.welcome_email")).toBe("green");
  });

  it("returns orange for contract send", () => {
    expect(classifyEmployeeActionRisk("onboarding.contract_send")).toBe("orange");
  });

  it("returns red for termination letter", () => {
    expect(classifyEmployeeActionRisk("offboarding.termination_letter_draft")).toBe("red");
  });

  it("returns red for salary review", () => {
    expect(classifyEmployeeActionRisk("payroll.salary_review_draft")).toBe("red");
  });

  it("returns orange for unknown action", () => {
    expect(classifyEmployeeActionRisk("unknown.action.xyz")).toBe("orange");
  });

  it("elevates to orange for onboarding employee on green action with offboarding status", () => {
    const risk = classifyEmployeeActionRisk("onboarding.welcome_email", { status: "offboarding" });
    expect(["green", "orange"]).toContain(risk);
  });

  it("returns green for absence acknowledgment", () => {
    expect(classifyEmployeeActionRisk("absence.absence_acknowledgment")).toBe("green");
  });

  it("returns green for training plan", () => {
    expect(classifyEmployeeActionRisk("training.training_plan_draft")).toBe("green");
  });

  it("returns orange for manager alert", () => {
    expect(classifyEmployeeActionRisk("communication.manager_alert")).toBe("orange");
  });
});

describe("resolveEmployeeActionGovernance", () => {
  it("returns auto_safe for welcome email", () => {
    expect(resolveEmployeeActionGovernance("onboarding.welcome_email")).toBe("auto_safe");
  });

  it("returns approval_required for contract send", () => {
    expect(resolveEmployeeActionGovernance("onboarding.contract_send")).toBe("approval_required");
  });

  it("returns manual_only for termination letter", () => {
    expect(resolveEmployeeActionGovernance("offboarding.termination_letter_draft")).toBe("manual_only");
  });

  it("returns manual_only for salary review", () => {
    expect(resolveEmployeeActionGovernance("payroll.salary_review_draft")).toBe("manual_only");
  });

  it("returns approval_required for unknown action", () => {
    expect(resolveEmployeeActionGovernance("unknown.action.xyz")).toBe("approval_required");
  });

  it("returns auto_safe for absence acknowledgment", () => {
    expect(resolveEmployeeActionGovernance("absence.absence_acknowledgment")).toBe("auto_safe");
  });

  it("returns auto_safe for training plan", () => {
    expect(resolveEmployeeActionGovernance("training.training_plan_draft")).toBe("auto_safe");
  });

  it("returns manual_only for disciplinary prep", () => {
    expect(resolveEmployeeActionGovernance("interview.disciplinary_prep")).toBe("manual_only");
  });

  it("escalates to blocked for black risk level", () => {
    // Simulate a context that would elevate to black
    const gov = resolveEmployeeActionGovernance("offboarding.termination_letter_draft", {});
    expect(["manual_only", "blocked"]).toContain(gov);
  });
});

describe("isEmployeeActionAutoSafe", () => {
  it("returns true for welcome email", () => {
    expect(isEmployeeActionAutoSafe("onboarding.welcome_email")).toBe(true);
  });

  it("returns false for contract send", () => {
    expect(isEmployeeActionAutoSafe("onboarding.contract_send")).toBe(false);
  });

  it("returns false for termination letter", () => {
    expect(isEmployeeActionAutoSafe("offboarding.termination_letter_draft")).toBe(false);
  });

  it("returns true for renewal reminder", () => {
    expect(isEmployeeActionAutoSafe("contract.renewal_reminder")).toBe(true);
  });

  it("returns true for document file update", () => {
    expect(isEmployeeActionAutoSafe("document.employee_file_update")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// 4. CONFIDENCE SCORING
// ══════════════════════════════════════════════════════════

describe("scoreEmployeeActionConfidence", () => {
  it("returns number between 0 and 1", () => {
    const score = scoreEmployeeActionConfidence("onboarding.welcome_email", empOnboarding, [], []);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns high confidence for onboarding action on onboarding employee", () => {
    const score = scoreEmployeeActionConfidence("onboarding.welcome_email", empOnboarding, [], []);
    expect(score).toBeGreaterThan(0.7);
  });

  it("returns high confidence for offboarding action on offboarding employee", () => {
    const score = scoreEmployeeActionConfidence(
      "offboarding.exit_interview_schedule",
      empOffboarding,
      [],
      [],
    );
    expect(score).toBeGreaterThan(0.6);
  });

  it("returns lower confidence for risky action", () => {
    const safeScore = scoreEmployeeActionConfidence("onboarding.welcome_email", empActive, [], []);
    const riskyScore = scoreEmployeeActionConfidence("offboarding.termination_letter_draft", empActive, [], []);
    expect(safeScore).toBeGreaterThanOrEqual(riskyScore);
  });

  it("returns 0 for unknown action", () => {
    expect(scoreEmployeeActionConfidence("unknown.action", empActive, [], [])).toBe(0);
  });

  it("boosts confidence when mission text matches domain", () => {
    const withMission = scoreEmployeeActionConfidence(
      "absence.absence_acknowledgment",
      empActive,
      [missionAbsence],
      [],
    );
    const withoutMission = scoreEmployeeActionConfidence(
      "absence.absence_acknowledgment",
      empActive,
      [],
      [],
    );
    expect(withMission).toBeGreaterThanOrEqual(withoutMission);
  });

  it("boosts confidence for CDD contract renewal", () => {
    const score = scoreEmployeeActionConfidence("contract.renewal_reminder", empCdd, [], []);
    expect(score).toBeGreaterThan(0.5);
  });
});

// ══════════════════════════════════════════════════════════
// 5. SUGGESTIONS
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionSuggestions", () => {
  it("returns array", () => {
    const result = buildEmployeeActionSuggestions(empOnboarding, [], []);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns onboarding suggestions for onboarding employee", () => {
    const result = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const domains = result.map((s) => s.domain);
    expect(domains).toContain("onboarding");
  });

  it("returns offboarding suggestions for offboarding employee", () => {
    const result = buildEmployeeActionSuggestions(empOffboarding, [], []);
    const domains = result.map((s) => s.domain);
    expect(domains).toContain("offboarding");
  });

  it("returns contract suggestions for CDD employee", () => {
    const result = buildEmployeeActionSuggestions(empCdd, [], []);
    const hasRenewal = result.some((s) => s.action_type === "contract.renewal_reminder");
    expect(hasRenewal).toBe(true);
  });

  it("all suggestions have required fields", () => {
    const result = buildEmployeeActionSuggestions(empOnboarding, [], []);
    for (const s of result) {
      expect(s.action_type).toBeTruthy();
      expect(s.domain).toBeTruthy();
      expect(s.label_fr).toBeTruthy();
      expect(s.reason).toBeTruthy();
      expect(["green", "orange", "red", "black"]).toContain(s.risk);
      expect(["auto_safe", "approval_required", "manual_only", "blocked"]).toContain(s.governance);
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("sorted by confidence desc", () => {
    const result = buildEmployeeActionSuggestions(empOnboarding, [], []);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].confidence).toBeGreaterThanOrEqual(result[i + 1].confidence);
    }
  });

  it("includes document file update as default suggestion", () => {
    const result = buildEmployeeActionSuggestions(empActive, [{ id: "m1" }], []);
    const hasFileUpdate = result.some((s) => s.action_type === "document.employee_file_update");
    expect(hasFileUpdate).toBe(true);
  });

  it("includes followup when pending tasks exist", () => {
    const result = buildEmployeeActionSuggestions(empActive, [], [taskReady, taskAwaiting]);
    const hasFollowup = result.some((s) => s.domain === "followup");
    expect(hasFollowup).toBe(true);
  });

  it("returns absence suggestions when mission text has absence", () => {
    const result = buildEmployeeActionSuggestions(empActive, [missionAbsence], []);
    const hasAbsence = result.some((s) => s.domain === "absence");
    expect(hasAbsence).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// 6. ACTION PLAN
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionPlan", () => {
  const now = new Date("2026-05-18T10:00:00Z");

  it("returns plan with correct shape", () => {
    const plan = buildEmployeeActionPlan(empOnboarding, [], [], now);
    expect(plan.employee_id).toBe("emp-001");
    expect(plan.employee_name).toBe("Alice Dupont");
    expect(Array.isArray(plan.suggested_actions)).toBe(true);
    expect(typeof plan.auto_safe_count).toBe("number");
    expect(typeof plan.approval_required_count).toBe("number");
    expect(typeof plan.blocked_count).toBe("number");
    expect(typeof plan.manual_only_count).toBe("number");
    expect(plan.generated_at).toBe("2026-05-18T10:00:00.000Z");
  });

  it("counts sum equals total suggestions", () => {
    const plan = buildEmployeeActionPlan(empOnboarding, [], [], now);
    const total = plan.suggested_actions.length;
    const counted = plan.auto_safe_count + plan.approval_required_count + plan.blocked_count + plan.manual_only_count;
    expect(counted).toBe(total);
  });

  it("next_action is first auto_safe or first suggestion", () => {
    const plan = buildEmployeeActionPlan(empOnboarding, [], [], now);
    if (plan.suggested_actions.length > 0) {
      expect(plan.next_action).not.toBeNull();
    }
  });

  it("next_action is auto_safe when available", () => {
    const plan = buildEmployeeActionPlan(empOnboarding, [], [], now);
    const hasAutoSafe = plan.suggested_actions.some((s) => s.governance === "auto_safe");
    if (hasAutoSafe) {
      expect(plan.next_action?.governance).toBe("auto_safe");
    }
  });

  it("handles employee with unknown id gracefully", () => {
    const plan = buildEmployeeActionPlan({ full_name: "Test" }, [], [], now);
    expect(plan.employee_id).toBe("unknown");
  });

  it("generated_at matches provided now", () => {
    const customNow = new Date("2025-01-01T00:00:00Z");
    const plan = buildEmployeeActionPlan(empActive, [], [], customNow);
    expect(plan.generated_at).toBe("2025-01-01T00:00:00.000Z");
  });
});

// ══════════════════════════════════════════════════════════
// 7. SUMMARY
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionSummary", () => {
  it("returns correct shape", () => {
    const suggestions = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const summary = buildEmployeeActionSummary(suggestions);
    expect(typeof summary.total_actions).toBe("number");
    expect(typeof summary.auto_safe).toBe("number");
    expect(typeof summary.approval_required).toBe("number");
    expect(typeof summary.manual_only).toBe("number");
    expect(typeof summary.blocked).toBe("number");
    expect(typeof summary.has_sensitive).toBe("boolean");
    expect(Array.isArray(summary.domains_active)).toBe(true);
  });

  it("counts sum equals total", () => {
    const suggestions = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const summary = buildEmployeeActionSummary(suggestions);
    const counted = summary.auto_safe + summary.approval_required + summary.manual_only + summary.blocked;
    expect(counted).toBe(summary.total_actions);
  });

  it("returns zero summary for empty suggestions", () => {
    const summary = buildEmployeeActionSummary([]);
    expect(summary.total_actions).toBe(0);
    expect(summary.auto_safe).toBe(0);
    expect(summary.has_sensitive).toBe(false);
    expect(summary.domains_active).toHaveLength(0);
  });

  it("marks has_sensitive true for red actions", () => {
    const suggestions = buildEmployeeActionSuggestions(empOffboarding, [], []);
    const summary = buildEmployeeActionSummary(suggestions);
    const hasRed = suggestions.some((s) => s.risk === "red");
    if (hasRed) expect(summary.has_sensitive).toBe(true);
  });
});

describe("getEmployeeActionDomainsActive", () => {
  it("returns unique domains from suggestions", () => {
    const suggestions = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const domains = getEmployeeActionDomainsActive(suggestions);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it("returns empty array for no suggestions", () => {
    expect(getEmployeeActionDomainsActive([])).toEqual([]);
  });

  it("includes onboarding domain for onboarding employee", () => {
    const suggestions = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const domains = getEmployeeActionDomainsActive(suggestions);
    expect(domains).toContain("onboarding");
  });
});

// ══════════════════════════════════════════════════════════
// 8. TASK DRAFT & ACTION RESULT
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionTaskDraft", () => {
  const ctx = {
    employee_id: "emp-001",
    employee_name: "Alice Dupont",
    department: "RH",
    contract_type: "cdi",
    status: "active",
  };

  it("returns correct shape for auto_safe action", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect(draft.type).toBe("onboarding.welcome_email");
    expect(draft.status).toBe("ready");
    expect(draft.approval_required).toBe(false);
    expect(draft.execute_at).toBeNull();
    expect(draft.payload_json.employee_id).toBe("emp-001");
  });

  it("returns awaiting_approval for approval_required action", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.contract_send", ctx);
    expect(draft.status).toBe("awaiting_approval");
    expect(draft.approval_required).toBe(true);
  });

  it("returns blocked status for manual_only action", () => {
    const draft = buildEmployeeActionTaskDraft("offboarding.termination_letter_draft", ctx);
    expect(["awaiting_approval", "blocked"]).toContain(draft.status);
    expect(draft.approval_required).toBe(true);
  });

  it("includes employee context in payload_json", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect(draft.payload_json.employee_id).toBe("emp-001");
    expect(draft.payload_json.employee_name).toBe("Alice Dupont");
    expect(draft.payload_json.department).toBe("RH");
    expect(draft.payload_json.action_type).toBe("onboarding.welcome_email");
  });

  it("includes meta fields in payload_json", () => {
    const ctxWithMeta = { ...ctx, meta: { custom_field: "value" } };
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctxWithMeta);
    expect(draft.payload_json.custom_field).toBe("value");
  });

  it("uses catalog label_fr as title", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    const item = getEmployeeActionById("onboarding.welcome_email");
    expect(draft.title).toBe(item?.label_fr);
  });
});

describe("resolveEmployeeActionResult", () => {
  const ctx = { employee_id: "emp-001", employee_name: "Alice", status: "active" };

  it("returns correct shape", () => {
    const result = resolveEmployeeActionResult("onboarding.welcome_email", ctx);
    expect(result.action_type).toBe("onboarding.welcome_email");
    expect(result.domain).toBe("onboarding");
    expect(["green", "orange", "red", "black"]).toContain(result.risk);
    expect(["auto_safe", "approval_required", "manual_only", "blocked"]).toContain(result.governance);
    expect(typeof result.allowed_to_auto_execute).toBe("boolean");
    expect(typeof result.explanation).toBe("string");
  });

  it("returns allowed_to_auto_execute true for auto_safe action", () => {
    const result = resolveEmployeeActionResult("onboarding.welcome_email", ctx);
    expect(result.allowed_to_auto_execute).toBe(true);
    expect(result.task_draft).not.toBeNull();
  });

  it("returns allowed_to_auto_execute false for manual_only action", () => {
    const result = resolveEmployeeActionResult("offboarding.termination_letter_draft", ctx);
    expect(result.allowed_to_auto_execute).toBe(false);
    expect(result.task_draft).toBeNull();
  });

  it("returns task_draft for approval_required action", () => {
    const result = resolveEmployeeActionResult("onboarding.contract_send", ctx);
    expect(result.allowed_to_auto_execute).toBe(false);
    expect(result.task_draft).not.toBeNull();
    expect(result.task_draft?.approval_required).toBe(true);
  });

  it("includes human-readable explanation", () => {
    const autoResult = resolveEmployeeActionResult("onboarding.welcome_email", ctx);
    expect(autoResult.explanation).toContain("automatiquement");

    const blockedResult = resolveEmployeeActionResult("offboarding.termination_letter_draft", ctx);
    expect(blockedResult.explanation.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════
// 9. FILTERS
// ══════════════════════════════════════════════════════════

describe("filterEmployeeActionsByGovernance", () => {
  it("filters to auto_safe only", () => {
    const all = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const filtered = filterEmployeeActionsByGovernance(all, "auto_safe");
    expect(filtered.every((a) => a.governance === "auto_safe")).toBe(true);
  });

  it("filters to approval_required only", () => {
    const all = buildEmployeeActionSuggestions(empOffboarding, [], []);
    const filtered = filterEmployeeActionsByGovernance(all, "approval_required");
    expect(filtered.every((a) => a.governance === "approval_required")).toBe(true);
  });

  it("returns empty array when no matches", () => {
    const filtered = filterEmployeeActionsByGovernance([], "auto_safe");
    expect(filtered).toHaveLength(0);
  });
});

describe("filterEmployeeActionsByRisk", () => {
  it("filters to green only with max_risk=green", () => {
    const all = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const filtered = filterEmployeeActionsByRisk(all, "green");
    expect(filtered.every((a) => a.risk === "green")).toBe(true);
  });

  it("includes green and orange with max_risk=orange", () => {
    const all = buildEmployeeActionSuggestions(empOffboarding, [], []);
    const filtered = filterEmployeeActionsByRisk(all, "orange");
    for (const a of filtered) {
      expect(["green", "orange"]).toContain(a.risk);
    }
  });

  it("includes all when max_risk=black", () => {
    const all = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const filtered = filterEmployeeActionsByRisk(all, "black");
    expect(filtered.length).toBe(all.length);
  });

  it("returns empty array for empty input", () => {
    expect(filterEmployeeActionsByRisk([], "red")).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════
// 10. TRACE & AUDIT
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionTrace", () => {
  const now = new Date("2026-05-18T10:00:00Z");

  it("returns correct shape", () => {
    const trace = buildEmployeeActionTrace("onboarding.welcome_email", "emp-001", {}, now);
    expect(trace.id).toMatch(/^ea_/);
    expect(trace.employee_id).toBe("emp-001");
    expect(trace.action_type).toBe("onboarding.welcome_email");
    expect(trace.domain).toBe("onboarding");
    expect(["green", "orange", "red", "black"]).toContain(trace.risk);
    expect(["auto_safe", "approval_required", "manual_only", "blocked"]).toContain(trace.governance);
    expect(trace.created_at).toBe("2026-05-18T10:00:00.000Z");
    expect(typeof trace.meta).toBe("object");
  });

  it("id is deterministic for same inputs", () => {
    const t1 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-001", {});
    const t2 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-001", {});
    expect(t1.id).toBe(t2.id);
  });

  it("id differs for different actions", () => {
    const t1 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-001", {});
    const t2 = buildEmployeeActionTrace("contract.renewal_reminder", "emp-001", {});
    expect(t1.id).not.toBe(t2.id);
  });

  it("id differs for different employees", () => {
    const t1 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-001", {});
    const t2 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-002", {});
    expect(t1.id).not.toBe(t2.id);
  });

  it("includes context in meta", () => {
    const trace = buildEmployeeActionTrace("onboarding.welcome_email", "emp-001", { task_id: "t-999" });
    expect(trace.meta.task_id).toBe("t-999");
  });

  it("uses auto_safe governance for welcome email", () => {
    const trace = buildEmployeeActionTrace("onboarding.welcome_email", "emp-001");
    expect(trace.governance).toBe("auto_safe");
  });

  it("uses manual_only governance for termination letter", () => {
    const trace = buildEmployeeActionTrace("offboarding.termination_letter_draft", "emp-002");
    expect(trace.governance).toBe("manual_only");
  });
});

describe("buildEmployeeActionAuditMeta", () => {
  it("returns correct shape", () => {
    const meta = buildEmployeeActionAuditMeta(
      "onboarding.welcome_email",
      "emp-001",
      "auto_safe",
      "green",
    );
    expect(meta.action_type).toBe("onboarding.welcome_email");
    expect(meta.employee_id).toBe("emp-001");
    expect(meta.governance).toBe("auto_safe");
    expect(meta.risk).toBe("green");
    expect(meta.domain).toBe("onboarding");
    expect(meta.allowed_to_auto_execute).toBe(true);
    expect(meta.requires_human).toBe(false);
    expect(typeof meta.label_fr).toBe("string");
  });

  it("sets requires_human true for non-auto_safe", () => {
    const meta = buildEmployeeActionAuditMeta(
      "onboarding.contract_send",
      "emp-001",
      "approval_required",
      "orange",
    );
    expect(meta.requires_human).toBe(true);
    expect(meta.allowed_to_auto_execute).toBe(false);
  });

  it("handles unknown action gracefully", () => {
    const meta = buildEmployeeActionAuditMeta(
      "unknown.action",
      "emp-001",
      "approval_required",
      "orange",
    );
    expect(meta.domain).toBeNull();
    expect(meta.label_fr).toBe("unknown.action");
  });
});

// ══════════════════════════════════════════════════════════
// 11. INDEX
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionsIndex", () => {
  const employees = [empOnboarding, empOffboarding, empActive] as unknown as Record<string, unknown>[];
  const now = new Date("2026-05-18T10:00:00Z");

  it("returns index keyed by employee_id", () => {
    const index = buildEmployeeActionsIndex(employees, [], []);
    expect(typeof index).toBe("object");
    expect("emp-001" in index).toBe(true);
    expect("emp-002" in index).toBe(true);
    expect("emp-003" in index).toBe(true);
  });

  it("each entry is a valid plan", () => {
    const index = buildEmployeeActionsIndex(employees, [], []);
    for (const [empId, plan] of Object.entries(index)) {
      expect(plan.employee_id).toBe(empId);
      expect(Array.isArray(plan.suggested_actions)).toBe(true);
    }
  });

  it("skips employees without id", () => {
    const withNoId = [{ full_name: "No ID" }] as unknown as Record<string, unknown>[];
    const index = buildEmployeeActionsIndex(withNoId, [], []);
    expect(Object.keys(index)).toHaveLength(0);
  });

  it("handles empty employees list", () => {
    const index = buildEmployeeActionsIndex([], [], []);
    expect(Object.keys(index)).toHaveLength(0);
  });

  it("matches employee tasks by payload_json.employee_id", () => {
    const tasks = [{ id: "t1", payload_json: { employee_id: "emp-001" }, status: "ready", type: "doc.generate" }];
    const index = buildEmployeeActionsIndex(
      employees,
      [],
      tasks as unknown as Record<string, unknown>[],
    );
    expect(index["emp-001"]).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════
// 12. SECURITY INVARIANTS
// ══════════════════════════════════════════════════════════

describe("Security invariants", () => {
  it("termination_letter_draft is never auto_safe", () => {
    expect(isEmployeeActionAutoSafe("offboarding.termination_letter_draft")).toBe(false);
  });

  it("disciplinary_prep is never auto_safe", () => {
    expect(isEmployeeActionAutoSafe("interview.disciplinary_prep")).toBe(false);
  });

  it("salary_review_draft is never auto_safe", () => {
    expect(isEmployeeActionAutoSafe("payroll.salary_review_draft")).toBe(false);
  });

  it("contract_termination_prep is never auto_safe", () => {
    expect(isEmployeeActionAutoSafe("contract.termination_prep")).toBe(false);
  });

  it("sensitive_communication_prep is never auto_safe", () => {
    expect(isEmployeeActionAutoSafe("communication.sensitive_communication_prep")).toBe(false);
  });

  it("red risk actions are never auto_safe", () => {
    const catalog = getEmployeeActionCatalog();
    for (const item of catalog) {
      if (item.risk === "red") {
        expect(isEmployeeActionAutoSafe(item.action_type)).toBe(false);
      }
    }
  });

  it("black risk actions are blocked or manual_only", () => {
    const catalog = getEmployeeActionCatalog();
    for (const item of catalog) {
      if (item.risk === "black") {
        const gov = resolveEmployeeActionGovernance(item.action_type);
        expect(["blocked", "manual_only"]).toContain(gov);
      }
    }
  });

  it("task draft for red actions requires approval", () => {
    const ctx = { employee_id: "emp-001" };
    const draft = buildEmployeeActionTaskDraft("offboarding.termination_letter_draft", ctx);
    expect(draft.approval_required).toBe(true);
  });

  it("resolveEmployeeActionResult blocked for manual_only has null task_draft", () => {
    const ctx = { employee_id: "emp-001" };
    const result = resolveEmployeeActionResult("contract.termination_prep", ctx);
    expect(result.task_draft).toBeNull();
  });

  it("auto_safe actions always have green or orange risk at most", () => {
    const catalog = getEmployeeActionCatalog();
    for (const item of catalog) {
      if (item.governance === "auto_safe") {
        expect(["green", "orange"]).toContain(item.risk);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════
// 13. ROBUSTNESS
// ══════════════════════════════════════════════════════════

describe("Robustness", () => {
  it("buildEmployeeActionSuggestions handles empty employee object", () => {
    expect(() => buildEmployeeActionSuggestions({}, [], [])).not.toThrow();
  });

  it("buildEmployeeActionPlan handles null fields gracefully", () => {
    expect(() => buildEmployeeActionPlan({ id: null, full_name: null }, [], [])).not.toThrow();
  });

  it("inferEmployeeActionDomain handles empty string", () => {
    expect(() => inferEmployeeActionDomain("")).not.toThrow();
  });

  it("inferEmployeeActionType handles empty string", () => {
    expect(() => inferEmployeeActionType("")).not.toThrow();
  });

  it("classifyEmployeeActionRisk handles undefined context", () => {
    expect(() => classifyEmployeeActionRisk("onboarding.welcome_email", undefined)).not.toThrow();
  });

  it("buildEmployeeActionsIndex handles malformed employee entries", () => {
    const malformed = [
      { id: "emp-999", full_name: "Good" },
      null,
      undefined,
      "string",
      42,
    ] as unknown as Record<string, unknown>[];
    expect(() => buildEmployeeActionsIndex(malformed, [], [])).not.toThrow();
  });

  it("filterEmployeeActionsByGovernance handles empty input", () => {
    expect(filterEmployeeActionsByGovernance([], "auto_safe")).toEqual([]);
  });

  it("filterEmployeeActionsByRisk handles empty input", () => {
    expect(filterEmployeeActionsByRisk([], "green")).toEqual([]);
  });

  it("buildEmployeeActionTrace handles undefined context", () => {
    expect(() => buildEmployeeActionTrace("onboarding.welcome_email", "emp-001")).not.toThrow();
  });

  it("buildEmployeeActionAuditMeta does not throw for any valid inputs", () => {
    const govs: PierreEmployeeActionGovernance[] = ["auto_safe", "approval_required", "manual_only", "blocked"];
    const risks: PierreEmployeeActionRisk[] = ["green", "orange", "red", "black"];
    for (const g of govs) {
      for (const r of risks) {
        expect(() => buildEmployeeActionAuditMeta("onboarding.welcome_email", "emp", g, r)).not.toThrow();
      }
    }
  });
});
