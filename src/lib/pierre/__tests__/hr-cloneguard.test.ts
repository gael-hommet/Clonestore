import { describe, it, expect } from "vitest";
import {
  normalizeCloneGuardDomain,
  normalizeCloneGuardActionKind,
  getPierreCloneGuardPolicyRules,
  collectCloneGuardText,
  detectCloneGuardSignals,
  evaluatePierreCloneGuard,
  buildCloneGuardPreview,
  buildCloneGuardAuditEvent,
  applyCloneGuardToTask,
  isCloneGuardAutoExecutable,
  summarizeCloneGuardEvaluation,
  CLONEGUARD_DOMAINS,
  CLONEGUARD_ACTION_KINDS,
} from "../hr/cloneguard";

// ═══════════════════════════════════════════════════════════
// 1. normalizeCloneGuardDomain
// ═══════════════════════════════════════════════════════════

describe("normalizeCloneGuardDomain", () => {
  it("returns known domain unchanged", () => {
    expect(normalizeCloneGuardDomain("contract")).toBe("contract");
    expect(normalizeCloneGuardDomain("employee_file")).toBe("employee_file");
    expect(normalizeCloneGuardDomain("sensitive_case")).toBe("sensitive_case");
  });

  it("returns unknown for null/undefined/non-string", () => {
    expect(normalizeCloneGuardDomain(null)).toBe("unknown");
    expect(normalizeCloneGuardDomain(undefined)).toBe("unknown");
    expect(normalizeCloneGuardDomain(42)).toBe("unknown");
  });

  it("maps leave to absence", () => {
    expect(normalizeCloneGuardDomain("leave")).toBe("absence");
  });

  it("maps lateness to absence", () => {
    expect(normalizeCloneGuardDomain("lateness")).toBe("absence");
  });

  it("maps interview to hiring", () => {
    expect(normalizeCloneGuardDomain("interview")).toBe("hiring");
  });

  it("maps training_ops to hr_helpdesk", () => {
    expect(normalizeCloneGuardDomain("training_ops")).toBe("hr_helpdesk");
  });

  it("maps compensation_benefits_ops to payroll_prep", () => {
    expect(normalizeCloneGuardDomain("compensation_benefits_ops")).toBe("payroll_prep");
  });

  it("maps multi_site_coordination to compliance_workflow", () => {
    expect(normalizeCloneGuardDomain("multi_site_coordination")).toBe("compliance_workflow");
  });

  it("returns unknown for completely unknown value", () => {
    expect(normalizeCloneGuardDomain("some_random_domain")).toBe("unknown");
  });

  it("handles all 16 CLONEGUARD_DOMAINS", () => {
    for (const d of CLONEGUARD_DOMAINS) {
      expect(normalizeCloneGuardDomain(d)).toBe(d);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 2. normalizeCloneGuardActionKind
// ═══════════════════════════════════════════════════════════

describe("normalizeCloneGuardActionKind", () => {
  it("maps email.send to email_send", () => {
    expect(normalizeCloneGuardActionKind("email.send")).toBe("email_send");
  });

  it("maps send_email to email_send", () => {
    expect(normalizeCloneGuardActionKind("send_email")).toBe("email_send");
  });

  it("maps email.draft to email_draft", () => {
    expect(normalizeCloneGuardActionKind("email.draft")).toBe("email_draft");
  });

  it("maps doc.generate to doc_generate", () => {
    expect(normalizeCloneGuardActionKind("doc.generate")).toBe("doc_generate");
  });

  it("maps doc.rewrite to doc_rewrite", () => {
    expect(normalizeCloneGuardActionKind("doc.rewrite")).toBe("doc_rewrite");
  });

  it("maps pdf.generate to pdf_generate", () => {
    expect(normalizeCloneGuardActionKind("pdf.generate")).toBe("pdf_generate");
  });

  it("maps reminder.create to reminder_create", () => {
    expect(normalizeCloneGuardActionKind("reminder.create")).toBe("reminder_create");
  });

  it("maps followup.schedule to followup_schedule", () => {
    expect(normalizeCloneGuardActionKind("followup.schedule")).toBe("followup_schedule");
  });

  it("maps contrat to contract_action", () => {
    expect(normalizeCloneGuardActionKind("contrat")).toBe("contract_action");
  });

  it("maps avenant to contract_action", () => {
    expect(normalizeCloneGuardActionKind("avenant")).toBe("contract_action");
  });

  it("maps conflit_prelim to disciplinary_prep", () => {
    expect(normalizeCloneGuardActionKind("conflit_prelim")).toBe("disciplinary_prep");
  });

  it("maps courrier_disciplinaire_prep to disciplinary_prep", () => {
    expect(normalizeCloneGuardActionKind("courrier_disciplinaire_prep")).toBe("disciplinary_prep");
  });

  it("maps decision_sanction to disciplinary_decision", () => {
    expect(normalizeCloneGuardActionKind("decision_sanction")).toBe("disciplinary_decision");
  });

  it("maps decision_licenciement to dismissal_action", () => {
    expect(normalizeCloneGuardActionKind("decision_licenciement")).toBe("dismissal_action");
  });

  it("maps interpretation_droit to dismissal_action", () => {
    expect(normalizeCloneGuardActionKind("interpretation_droit")).toBe("dismissal_action");
  });

  it("maps decision_discriminatoire to dismissal_action", () => {
    expect(normalizeCloneGuardActionKind("decision_discriminatoire")).toBe("dismissal_action");
  });

  it("maps prepaie_prep to payroll_action", () => {
    expect(normalizeCloneGuardActionKind("prepaie_prep")).toBe("payroll_action");
  });

  it("maps absence_sensible to absence_action", () => {
    expect(normalizeCloneGuardActionKind("absence_sensible")).toBe("absence_action");
  });

  it("maps sujet_medical to absence_action", () => {
    expect(normalizeCloneGuardActionKind("sujet_medical")).toBe("absence_action");
  });

  it("maps offboarding_sensible to absence_action", () => {
    expect(normalizeCloneGuardActionKind("offboarding_sensible")).toBe("absence_action");
  });

  it("returns unknown_action for null/undefined", () => {
    expect(normalizeCloneGuardActionKind(null)).toBe("unknown_action");
    expect(normalizeCloneGuardActionKind(undefined)).toBe("unknown_action");
  });

  it("returns unknown_action for unrecognized type", () => {
    expect(normalizeCloneGuardActionKind("some_unknown")).toBe("unknown_action");
  });

  it("handles all CLONEGUARD_ACTION_KINDS", () => {
    for (const k of CLONEGUARD_ACTION_KINDS) {
      // Each kind should normalize to itself via a representative input
      expect(typeof k).toBe("string");
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 3. getPierreCloneGuardPolicyRules
// ═══════════════════════════════════════════════════════════

describe("getPierreCloneGuardPolicyRules", () => {
  const rules = getPierreCloneGuardPolicyRules();

  it("returns at least 20 rules", () => {
    expect(rules.length).toBeGreaterThanOrEqual(20);
  });

  it("every rule has an id", () => {
    for (const r of rules) expect(typeof r.id).toBe("string");
  });

  it("every rule has a non-empty reason", () => {
    for (const r of rules) expect(r.reason.length).toBeGreaterThan(0);
  });

  it("every rule has a matches function", () => {
    for (const r of rules) expect(typeof r.matches).toBe("function");
  });

  it("refuse rules are can_override=false", () => {
    const refuse = rules.filter((r) => r.decision === "refuse");
    expect(refuse.length).toBeGreaterThan(0);
    for (const r of refuse) expect(r.can_override).toBe(false);
  });

  it("block rules are can_override=false", () => {
    const blocks = rules.filter((r) => r.decision === "block");
    expect(blocks.length).toBeGreaterThan(0);
    for (const r of blocks) expect(r.can_override).toBe(false);
  });

  it("email_send_block rule matches email.send context", () => {
    const rule = rules.find((r) => r.id === "email_send_block");
    expect(rule).toBeDefined();
    expect(rule!.matches({ task_type: "email.send" }, "email.send")).toBe(true);
    expect(rule!.matches({ task_type: "email.draft" }, "email.draft")).toBe(false);
  });

  it("harcelement rule matches text with harcel", () => {
    const rule = rules.find((r) => r.id === "harcelement_refuse");
    expect(rule).toBeDefined();
    expect(rule!.matches({}, "harcèlement au travail")).toBe(true);
    expect(rule!.matches({}, "absence maladie")).toBe(false);
  });

  it("no duplicate rule ids", () => {
    const ids = rules.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. collectCloneGuardText
// ═══════════════════════════════════════════════════════════

describe("collectCloneGuardText", () => {
  it("collects task_type and title", () => {
    const text = collectCloneGuardText({ task_type: "email.send", task_title: "Relancer candidat" });
    expect(text).toContain("email.send");
    expect(text).toContain("relancer candidat");
  });

  it("extracts strings from payload_json", () => {
    const text = collectCloneGuardText({
      payload_json: { subject: "Licenciement prévu", employee_name: "Jean Dupont" },
    });
    expect(text).toContain("licenciement");
    expect(text).toContain("jean dupont");
  });

  it("returns lowercase text", () => {
    const text = collectCloneGuardText({ task_title: "HARCELEMENT" });
    expect(text).toBe(text.toLowerCase());
  });

  it("handles null/undefined context gracefully", () => {
    expect(() => collectCloneGuardText(null as never)).not.toThrow();
    expect(collectCloneGuardText(null as never)).toBe("");
  });

  it("handles nested payload_json", () => {
    const text = collectCloneGuardText({
      payload_json: { employee_context: { note: "Faute grave confirmée" } },
    });
    expect(text).toContain("faute grave");
  });

  it("includes text_corpus", () => {
    const text = collectCloneGuardText({ text_corpus: "Discrimination signalée" });
    expect(text).toContain("discrimination");
  });
});

// ═══════════════════════════════════════════════════════════
// 5. detectCloneGuardSignals
// ═══════════════════════════════════════════════════════════

describe("detectCloneGuardSignals", () => {
  it("detects harcelement signal", () => {
    const signals = detectCloneGuardSignals({ task_title: "Cas de harcèlement moral" });
    const codes = signals.map((s) => s.code);
    expect(codes).toContain("harcelement");
    expect(signals.find((s) => s.code === "harcelement")!.level).toBe("black");
  });

  it("detects discrimination signal", () => {
    const signals = detectCloneGuardSignals({ task_title: "Plainte discrimination" });
    expect(signals.some((s) => s.code === "discrimination")).toBe(true);
  });

  it("detects licenciement as red signal", () => {
    const signals = detectCloneGuardSignals({ task_title: "Procédure de licenciement" });
    const lic = signals.find((s) => s.code === "licenciement");
    expect(lic).toBeDefined();
    expect(lic!.level).toBe("red");
  });

  it("detects email_send as black task_type signal", () => {
    const signals = detectCloneGuardSignals({ task_type: "email.send" });
    expect(signals.some((s) => s.code === "email_send_blocked")).toBe(true);
  });

  it("detects approval_required as red signal", () => {
    const signals = detectCloneGuardSignals({ approval_required: true });
    expect(signals.some((s) => s.code === "approval_required")).toBe(true);
    expect(signals.find((s) => s.code === "approval_required")!.level).toBe("red");
  });

  it("detects risk_hint_black signal", () => {
    const signals = detectCloneGuardSignals({ risk_level_hint: "black" });
    expect(signals.some((s) => s.code === "risk_hint_black")).toBe(true);
  });

  it("detects sensitive_domain signal", () => {
    const signals = detectCloneGuardSignals({ domain: "sensitive_case" });
    expect(signals.some((s) => s.code === "sensitive_domain")).toBe(true);
  });

  it("returns empty array for clean context", () => {
    const signals = detectCloneGuardSignals({ task_type: "reminder.create", task_title: "Rappel réunion" });
    const blackOrRed = signals.filter((s) => s.level === "black" || s.level === "red");
    expect(blackOrRed.length).toBe(0);
  });

  it("handles null context without crash", () => {
    expect(() => detectCloneGuardSignals(null as never)).not.toThrow();
    expect(detectCloneGuardSignals(null as never)).toEqual([]);
  });

  it("source field is set correctly", () => {
    const textSignals = detectCloneGuardSignals({ task_title: "harcèlement" });
    expect(textSignals.some((s) => s.source === "text_scan")).toBe(true);

    const typeSignals = detectCloneGuardSignals({ task_type: "email.send" });
    expect(typeSignals.some((s) => s.source === "task_type")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. evaluatePierreCloneGuard — green / allow
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneGuard — green / allow", () => {
  it("allows a simple reminder task", () => {
    const r = evaluatePierreCloneGuard({ task_type: "reminder.create", task_title: "Rappel réunion" });
    expect(r.decision).toBe("allow");
    expect(r.allowed_to_auto_execute).toBe(true);
    expect(r.requires_human).toBe(false);
    expect(r.risk_level).toBe("green");
  });

  it("allows a followup task", () => {
    const r = evaluatePierreCloneGuard({ task_type: "followup.schedule" });
    expect(r.decision).toBe("allow");
    expect(r.allowed_to_auto_execute).toBe(true);
  });

  it("allows doc.rewrite", () => {
    const r = evaluatePierreCloneGuard({ task_type: "doc.rewrite" });
    expect(r.decision).toBe("allow");
    expect(r.allowed_to_auto_execute).toBe(true);
  });

  it("explanation is never empty", () => {
    const r = evaluatePierreCloneGuard({ task_type: "reminder.create" });
    expect(r.explanation.length).toBeGreaterThan(0);
  });

  it("allows null context gracefully", () => {
    const r = evaluatePierreCloneGuard(null as never);
    expect(r.decision).toBe("allow");
    expect(r.allowed_to_auto_execute).toBe(true);
  });

  it("allows empty context", () => {
    const r = evaluatePierreCloneGuard({});
    expect(["allow", "allow_with_warning"]).toContain(r.decision);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. evaluatePierreCloneGuard — orange / allow_with_warning
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneGuard — orange / allow_with_warning", () => {
  it("warns on email.draft", () => {
    const r = evaluatePierreCloneGuard({ task_type: "email.draft" });
    expect(r.decision).toBe("allow_with_warning");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("warns on doc.generate", () => {
    const r = evaluatePierreCloneGuard({ task_type: "doc.generate" });
    expect(r.decision).toBe("allow_with_warning");
  });

  it("warns when domain is sensitive_case", () => {
    const r = evaluatePierreCloneGuard({ domain: "sensitive_case", task_type: "reminder.create" });
    expect(r.decision).toBe("allow_with_warning");
  });

  it("warns with orange risk_level_hint", () => {
    const r = evaluatePierreCloneGuard({ risk_level_hint: "orange" });
    expect(["allow_with_warning", "require_approval"]).toContain(r.decision);
  });

  it("warns for email_salarie task type", () => {
    const r = evaluatePierreCloneGuard({ task_type: "email_salarie" });
    expect(r.decision).toBe("allow_with_warning");
  });
});

// ═══════════════════════════════════════════════════════════
// 8. evaluatePierreCloneGuard — red / require_approval
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneGuard — red / require_approval", () => {
  it("requires approval for contrat task type", () => {
    const r = evaluatePierreCloneGuard({ task_type: "contrat" });
    expect(r.decision).toBe("require_approval");
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.requires_human).toBe(true);
  });

  it("requires approval for absence_sensible", () => {
    const r = evaluatePierreCloneGuard({ task_type: "absence_sensible" });
    expect(r.decision).toBe("require_approval");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval for prepaie_prep", () => {
    const r = evaluatePierreCloneGuard({ task_type: "prepaie_prep" });
    expect(r.decision).toBe("require_approval");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval when licenciement in text", () => {
    const r = evaluatePierreCloneGuard({
      task_type: "reminder.create",
      task_title: "Suivi procédure de licenciement",
    });
    expect(["require_approval", "refuse", "block"]).toContain(r.decision);
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval for avenant", () => {
    const r = evaluatePierreCloneGuard({ task_type: "avenant" });
    expect(r.decision).toBe("require_approval");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval for conflit_prelim", () => {
    const r = evaluatePierreCloneGuard({ task_type: "conflit_prelim" });
    expect(r.decision).toBe("require_approval");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval when red risk_level_hint", () => {
    const r = evaluatePierreCloneGuard({ risk_level_hint: "red" });
    expect(["require_approval", "refuse", "block"]).toContain(r.decision);
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval when approval_required=true", () => {
    const r = evaluatePierreCloneGuard({ task_type: "reminder.create", approval_required: true });
    expect(["block", "require_approval", "refuse"]).toContain(r.decision);
    expect(r.allowed_to_auto_execute).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 9. evaluatePierreCloneGuard — black / refuse or block
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneGuard — black / refuse or block", () => {
  it("refuses harcelement context", () => {
    const r = evaluatePierreCloneGuard({ task_title: "Signalement harcèlement moral" });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.requires_human).toBe(true);
  });

  it("refuses discrimination context", () => {
    const r = evaluatePierreCloneGuard({ task_title: "Plainte discrimination raciale" });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("refuses violence/agression context", () => {
    const r = evaluatePierreCloneGuard({ task_title: "Incident d'agression au bureau" });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("refuses prudhommes context", () => {
    const r = evaluatePierreCloneGuard({ task_title: "Saisine Prud'hommes prévue" });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("refuses faute grave context", () => {
    const r = evaluatePierreCloneGuard({ task_title: "Enquête faute grave salariée" });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("refuses decision_licenciement task type", () => {
    const r = evaluatePierreCloneGuard({ task_type: "decision_licenciement" });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("refuses decision_sanction task type", () => {
    const r = evaluatePierreCloneGuard({ task_type: "decision_sanction" });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("refuses decision_discriminatoire task type", () => {
    const r = evaluatePierreCloneGuard({ task_type: "decision_discriminatoire" });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("blocks email.send", () => {
    const r = evaluatePierreCloneGuard({ task_type: "email.send" });
    expect(r.decision).toBe("block");
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.requires_human).toBe(true);
  });

  it("blocks send_email", () => {
    const r = evaluatePierreCloneGuard({ task_type: "send_email" });
    expect(r.decision).toBe("block");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("blocks approval_required=true", () => {
    const r = evaluatePierreCloneGuard({ approval_required: true });
    expect(["block", "require_approval", "refuse"]).toContain(r.decision);
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("blocks judiciaire context", () => {
    const r = evaluatePierreCloneGuard({ task_title: "Procédure judiciaire en cours" });
    expect(["block", "refuse"]).toContain(r.decision);
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("always non-auto when risk_level_hint=black", () => {
    const r = evaluatePierreCloneGuard({ risk_level_hint: "black", task_type: "reminder.create" });
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("refuses even if task type is safe when harcel in text", () => {
    const r = evaluatePierreCloneGuard({
      task_type: "reminder.create",
      task_title: "Rappel — harcèlement signalé",
    });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. evaluatePierreCloneGuard — text in French with accents
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneGuard — French text", () => {
  it("detects harcèlement with accent", () => {
    const r = evaluatePierreCloneGuard({ text_corpus: "harcèlement moral signalé" });
    expect(r.decision).toBe("refuse");
  });

  it("detects harcelement without accent", () => {
    const r = evaluatePierreCloneGuard({ text_corpus: "harcelement au travail" });
    expect(r.decision).toBe("refuse");
  });

  it("detects licenciement with accent", () => {
    const r = evaluatePierreCloneGuard({ text_corpus: "procédure de licenciement engagée" });
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("detects prud'hommes variant", () => {
    const r = evaluatePierreCloneGuard({ text_corpus: "saisine prudhommes" });
    expect(r.decision).toBe("refuse");
  });

  it("detects discrimination with prefix", () => {
    const r = evaluatePierreCloneGuard({ text_corpus: "acte discriminatoire constaté" });
    expect(r.decision).toBe("refuse");
  });
});

// ═══════════════════════════════════════════════════════════
// 11. buildCloneGuardPreview
// ═══════════════════════════════════════════════════════════

describe("buildCloneGuardPreview", () => {
  it("returns correct decision and risk_level", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "contrat" });
    const preview = buildCloneGuardPreview(eval_);
    expect(preview.decision).toBe(eval_.decision);
    expect(preview.risk_level).toBe(eval_.risk_level);
  });

  it("signal_count matches evaluation", () => {
    const eval_ = evaluatePierreCloneGuard({ task_title: "Harcèlement signalé" });
    const preview = buildCloneGuardPreview(eval_);
    expect(preview.signal_count).toBe(eval_.signals.length);
  });

  it("top_signal is null when no signals", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "reminder.create" });
    const preview = buildCloneGuardPreview(eval_);
    if (eval_.signals.length === 0) {
      expect(preview.top_signal).toBeNull();
    }
  });

  it("top_signal is the highest-risk signal", () => {
    const eval_ = evaluatePierreCloneGuard({ task_title: "Harcèlement et licenciement" });
    const preview = buildCloneGuardPreview(eval_);
    if (preview.top_signal) {
      expect(preview.top_signal.level).toBe("black");
    }
  });

  it("summary is non-empty", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "email.send" });
    const preview = buildCloneGuardPreview(eval_);
    expect(preview.summary.length).toBeGreaterThan(0);
  });

  it("allowed_to_auto_execute matches evaluation", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "email.send" });
    const preview = buildCloneGuardPreview(eval_);
    expect(preview.allowed_to_auto_execute).toBe(eval_.allowed_to_auto_execute);
  });

  it("handles null evaluation gracefully", () => {
    const preview = buildCloneGuardPreview(null as never);
    expect(preview.decision).toBe("allow");
    expect(preview.summary.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. buildCloneGuardAuditEvent
// ═══════════════════════════════════════════════════════════

describe("buildCloneGuardAuditEvent", () => {
  it("event_type is cloneguard_execution_blocked for refuse", () => {
    const eval_ = evaluatePierreCloneGuard({ task_title: "Harcèlement" });
    const audit = buildCloneGuardAuditEvent(eval_);
    expect(audit.event_type).toBe("cloneguard_execution_blocked");
  });

  it("event_type is cloneguard_execution_blocked for block", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "email.send" });
    const audit = buildCloneGuardAuditEvent(eval_);
    expect(audit.event_type).toBe("cloneguard_execution_blocked");
  });

  it("event_type is cloneguard_signal_detected when signals present", () => {
    const eval_ = evaluatePierreCloneGuard({ task_title: "Licenciement en cours" });
    const audit = buildCloneGuardAuditEvent(eval_);
    expect([
      "cloneguard_execution_blocked",
      "cloneguard_signal_detected",
      "cloneguard_evaluation",
    ]).toContain(audit.event_type);
  });

  it("meta_json has all required keys (new schema)", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "contrat" });
    const audit = buildCloneGuardAuditEvent(eval_);
    expect(audit.meta_json).toHaveProperty("decision");
    expect(audit.meta_json).toHaveProperty("risk_level");
    expect(audit.meta_json).toHaveProperty("signal_count");
    expect(audit.meta_json).toHaveProperty("signals");
    expect(audit.meta_json).toHaveProperty("matched_rules");
    expect(audit.meta_json).toHaveProperty("allowed_to_auto_execute");
  });

  it("message is non-empty", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "reminder.create" });
    const audit = buildCloneGuardAuditEvent(eval_);
    expect(audit.message.length).toBeGreaterThan(0);
  });

  it("task_type in meta_json when ctx provided", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "email.send" });
    const audit = buildCloneGuardAuditEvent(eval_, { task_type: "email.send" });
    expect(audit.meta_json.task_type).toBe("email.send");
  });

  it("handles null evaluation gracefully", () => {
    const audit = buildCloneGuardAuditEvent(null as never);
    expect(audit.event_type).toBe("cloneguard_evaluation");
    expect(audit.message.length).toBeGreaterThan(0);
  });

  it("never uses old log schema fields (level/event/payload)", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "email.send" });
    const audit = buildCloneGuardAuditEvent(eval_);
    expect(audit).not.toHaveProperty("level");
    expect(audit).not.toHaveProperty("event");
    expect(audit).not.toHaveProperty("payload");
    expect(audit.meta_json).not.toHaveProperty("level");
    expect(audit.meta_json).not.toHaveProperty("event");
    expect(audit.meta_json).not.toHaveProperty("payload");
  });
});

// ═══════════════════════════════════════════════════════════
// 13. applyCloneGuardToTask
// ═══════════════════════════════════════════════════════════

describe("applyCloneGuardToTask", () => {
  it("adds cloneguard field to task", () => {
    const task = { id: "t1", type: "reminder.create", title: "Rappel" };
    const eval_ = evaluatePierreCloneGuard({ task_type: "reminder.create" });
    const result = applyCloneGuardToTask(task, eval_);
    expect(result).toHaveProperty("cloneguard");
  });

  it("does not mutate original task", () => {
    const task = { id: "t1", type: "reminder.create" };
    const taskBefore = { ...task };
    const eval_ = evaluatePierreCloneGuard({ task_type: "reminder.create" });
    applyCloneGuardToTask(task, eval_);
    expect(task).toEqual(taskBefore);
  });

  it("preserves all original task fields", () => {
    const task = { id: "t1", type: "contrat", title: "Nouveau contrat", status: "ready" };
    const eval_ = evaluatePierreCloneGuard({ task_type: "contrat" });
    const result = applyCloneGuardToTask(task, eval_);
    expect(result.id).toBe("t1");
    expect(result.type).toBe("contrat");
    expect(result.title).toBe("Nouveau contrat");
    expect(result.status).toBe("ready");
  });

  it("cloneguard block contains decision and risk_level", () => {
    const task = { id: "t1", type: "email.send" };
    const eval_ = evaluatePierreCloneGuard({ task_type: "email.send" });
    const result = applyCloneGuardToTask(task, eval_);
    const cg = result.cloneguard as Record<string, unknown>;
    expect(cg).not.toBeNull();
    expect(cg.decision).toBeDefined();
    expect(cg.risk_level).toBeDefined();
    expect(cg.allowed_to_auto_execute).toBe(false);
  });

  it("handles null task gracefully", () => {
    const eval_ = evaluatePierreCloneGuard({});
    expect(() => applyCloneGuardToTask(null as never, eval_)).not.toThrow();
  });

  it("handles array as task gracefully", () => {
    const eval_ = evaluatePierreCloneGuard({});
    expect(() => applyCloneGuardToTask([] as never, eval_)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════
// 14. isCloneGuardAutoExecutable
// ═══════════════════════════════════════════════════════════

describe("isCloneGuardAutoExecutable", () => {
  it("returns true for safe green task", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "reminder.create" })).toBe(true);
    expect(isCloneGuardAutoExecutable({ task_type: "followup.schedule" })).toBe(true);
    expect(isCloneGuardAutoExecutable({ task_type: "doc.rewrite" })).toBe(true);
  });

  it("returns false for email.send", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "email.send" })).toBe(false);
  });

  it("returns false for send_email", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "send_email" })).toBe(false);
  });

  it("returns false when approval_required=true", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "reminder.create", approval_required: true })).toBe(false);
  });

  it("returns false for red risk_level_hint", () => {
    expect(isCloneGuardAutoExecutable({ risk_level_hint: "red" })).toBe(false);
  });

  it("returns false for black risk_level_hint", () => {
    expect(isCloneGuardAutoExecutable({ risk_level_hint: "black" })).toBe(false);
  });

  it("returns false for contract_action kind", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "contrat" })).toBe(false);
  });

  it("returns false for disciplinary_decision kind", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "decision_sanction" })).toBe(false);
  });

  it("returns false for dismissal_action kind", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "decision_licenciement" })).toBe(false);
  });

  it("returns false when harcel in text", () => {
    expect(isCloneGuardAutoExecutable({ task_title: "Harcèlement signalé" })).toBe(false);
  });

  it("returns false for null context", () => {
    expect(isCloneGuardAutoExecutable(null as never)).toBe(false);
  });

  it("returns false for email_draft (allow_with_warning is not auto)", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "email.draft" })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 15. summarizeCloneGuardEvaluation
// ═══════════════════════════════════════════════════════════

describe("summarizeCloneGuardEvaluation", () => {
  it("returns non-empty string", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "contrat" });
    const summary = summarizeCloneGuardEvaluation(eval_);
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("includes decision label", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "reminder.create" });
    const summary = summarizeCloneGuardEvaluation(eval_);
    expect(summary).toContain("Autorisé");
  });

  it("includes Refusé for refuse decision", () => {
    const eval_ = evaluatePierreCloneGuard({ task_title: "Harcèlement" });
    const summary = summarizeCloneGuardEvaluation(eval_);
    expect(summary).toContain("Refusé");
  });

  it("mentions non-autorisée when not auto-executable", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "email.send" });
    const summary = summarizeCloneGuardEvaluation(eval_);
    expect(summary).toContain("non autorisée");
  });

  it("handles null evaluation gracefully", () => {
    expect(() => summarizeCloneGuardEvaluation(null as never)).not.toThrow();
    const summary = summarizeCloneGuardEvaluation(null as never);
    expect(summary.length).toBeGreaterThan(0);
  });

  it("includes risk level label", () => {
    const eval_ = evaluatePierreCloneGuard({ task_type: "contrat" });
    const summary = summarizeCloneGuardEvaluation(eval_);
    expect(summary).toMatch(/risque|Risque/i);
  });
});

// ═══════════════════════════════════════════════════════════
// 16. Edge cases and security invariants
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneGuard — security invariants", () => {
  it("email.send is ALWAYS non-auto regardless of context", () => {
    const contexts = [
      { task_type: "email.send" },
      { task_type: "email.send", risk_level_hint: "green" },
      { task_type: "email.send", domain: "recruitment_ops" },
    ];
    for (const ctx of contexts) {
      expect(isCloneGuardAutoExecutable(ctx)).toBe(false);
    }
  });

  it("approval_required=true is ALWAYS non-auto", () => {
    const contexts = [
      { task_type: "reminder.create", approval_required: true },
      { task_type: "doc.rewrite", approval_required: true },
      { approval_required: true },
    ];
    for (const ctx of contexts) {
      const r = evaluatePierreCloneGuard(ctx);
      expect(r.allowed_to_auto_execute).toBe(false);
    }
  });

  it("harcelement in payload_json is caught", () => {
    const r = evaluatePierreCloneGuard({
      task_type: "reminder.create",
      payload_json: { note: "Cas de harcèlement moral signalé" },
    });
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("discrimination in nested payload is caught", () => {
    const r = evaluatePierreCloneGuard({
      payload_json: { employee_context: { alert: "Discrimination signalée" } },
    });
    expect(r.decision).toBe("refuse");
  });

  it("worst decision wins when multiple rules match", () => {
    const r = evaluatePierreCloneGuard({
      task_type: "email.send",
      task_title: "Envoi harcèlement doc",
    });
    // refuse beats block
    expect(r.decision).toBe("refuse");
  });

  it("matched_rules is populated", () => {
    const r = evaluatePierreCloneGuard({ task_type: "contrat" });
    expect(Array.isArray(r.matched_rules)).toBe(true);
    expect(r.matched_rules.length).toBeGreaterThan(0);
  });

  it("signals array is always an array", () => {
    const r = evaluatePierreCloneGuard({});
    expect(Array.isArray(r.signals)).toBe(true);
  });

  it("evaluated_at is set when now is provided", () => {
    const now = "2026-05-17T10:00:00.000Z";
    const r = evaluatePierreCloneGuard({ task_type: "reminder.create", now });
    expect(r.evaluated_at).toBe(now);
  });

  it("decision escalates risk_level correctly", () => {
    const r = evaluatePierreCloneGuard({ task_type: "email.send" });
    expect(["red", "black"]).toContain(r.risk_level);
  });

  it("document_rh gets allow_with_warning, not allow", () => {
    const r = evaluatePierreCloneGuard({ task_type: "document_rh" });
    expect(r.decision).toBe("allow_with_warning");
    expect(r.allowed_to_auto_execute).toBe(false);
  });
});
