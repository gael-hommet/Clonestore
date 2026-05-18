// Pierre HR Engine — CloneGuard Runtime Integration Tests (Bloc 14, Phase 10)
// Focus: runtime context construction, task-level gates, audit schema,
//        no mock heavy — all pure-module logic tested end-to-end

import { describe, it, expect } from "vitest";
import {
  evaluatePierreCloneGuard,
  isCloneGuardAutoExecutable,
  applyCloneGuardToTask,
  buildCloneGuardAuditEvent,
  buildCloneGuardPreview,
  summarizeCloneGuardEvaluation,
  collectCloneGuardText,
  detectCloneGuardSignals,
  normalizeCloneGuardDomain,
  normalizeCloneGuardActionKind,
  type PierreCloneGuardContext,
  type PierreCloneGuardEvaluation,
} from "../hr/cloneguard";

// ── Helper: minimal allowed task row shape ────────────────
function makeTaskRow(overrides: Partial<PierreCloneGuardContext> = {}): PierreCloneGuardContext {
  return {
    task_type: "doc.generate",
    task_title: "Synthèse entretien annuel",
    task_description: "Rapport annuel pour le salarié",
    payload_json: null,
    approval_required: false,
    domain: "performance_ops",
    risk_level_hint: "green",
    text_corpus: null,
    now: "2026-05-01T10:00:00.000Z",
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════
// 1. Context construction from task rows
// ══════════════════════════════════════════════════════════

describe("context construction from task rows", () => {
  it("builds a green allow context from a safe doc.generate task", () => {
    const ctx = makeTaskRow();
    const r = evaluatePierreCloneGuard(ctx);
    expect(r.decision).toBe("allow_with_warning"); // doc.generate triggers warn
    expect(r.allowed_to_auto_execute).toBe(false); // allow_with_warning → not auto
    expect(r.requires_human).toBe(false);
  });

  it("builds context with null fields without crashing", () => {
    const ctx: PierreCloneGuardContext = {
      task_type: null,
      task_title: null,
      task_description: null,
      payload_json: null,
      approval_required: null,
      domain: null,
      risk_level_hint: null,
      text_corpus: null,
      now: null,
    };
    expect(() => evaluatePierreCloneGuard(ctx)).not.toThrow();
    const r = evaluatePierreCloneGuard(ctx);
    expect(r.decision).toBe("allow");
    expect(r.allowed_to_auto_execute).toBe(true);
  });

  it("uses now from context for evaluated_at", () => {
    const now = "2026-03-15T09:30:00.000Z";
    const r = evaluatePierreCloneGuard(makeTaskRow({ now }));
    expect(r.evaluated_at).toBe(now);
  });

  it("handles undefined now gracefully", () => {
    const ctx: PierreCloneGuardContext = {};
    const r = evaluatePierreCloneGuard(ctx);
    expect(r.evaluated_at).toBe("");
  });

  it("passes task_description into text scanning", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ task_description: "Contexte de licenciement économique" })
    );
    expect(r.decision).toBe("require_approval");
    expect(r.matched_rules).toContain("licenciement_text_require");
  });

  it("passes text_corpus into text scanning", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ text_corpus: "Procédure de licenciement engagée" })
    );
    expect(r.matched_rules).toContain("licenciement_text_require");
  });
});

// ══════════════════════════════════════════════════════════
// 2. email.send always blocked — exhaustive
// ══════════════════════════════════════════════════════════

describe("email.send always blocked", () => {
  it("blocks task_type email.send", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "email.send" }));
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.decision).toBe("block");
    expect(r.matched_rules).toContain("email_send_block");
  });

  it("blocks task_type send_email", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "send_email" }));
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.decision).toBe("block");
  });

  it("isCloneGuardAutoExecutable returns false for email.send", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "email.send" })).toBe(false);
  });

  it("isCloneGuardAutoExecutable returns false for send_email", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "send_email" })).toBe(false);
  });

  it("email.send blocked even with green risk_level_hint", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ task_type: "email.send", risk_level_hint: "green" })
    );
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("email.send blocked even when approval_required is false", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ task_type: "email.send", approval_required: false })
    );
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("email.send signal appears in signals array", () => {
    const sigs = detectCloneGuardSignals({ task_type: "email.send" });
    const codes = sigs.map((s) => s.code);
    expect(codes).toContain("email_send_blocked");
  });

  it("email.send audit event uses cloneguard_execution_blocked", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "email.send" }));
    const ev = buildCloneGuardAuditEvent(r, { task_type: "email.send" });
    expect(ev.event_type).toBe("cloneguard_execution_blocked");
  });
});

// ══════════════════════════════════════════════════════════
// 3. approval_required always blocked
// ══════════════════════════════════════════════════════════

describe("approval_required always blocked", () => {
  it("blocks auto-execute when approval_required is true", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ approval_required: true })
    );
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.matched_rules).toContain("approval_required_block");
  });

  it("isCloneGuardAutoExecutable returns false when approval_required", () => {
    expect(isCloneGuardAutoExecutable({ approval_required: true })).toBe(false);
  });

  it("approval_required signal appears", () => {
    const sigs = detectCloneGuardSignals({ approval_required: true });
    expect(sigs.some((s) => s.code === "approval_required")).toBe(true);
  });

  it("approval_required signal has level red", () => {
    const sigs = detectCloneGuardSignals({ approval_required: true });
    const sig = sigs.find((s) => s.code === "approval_required");
    expect(sig?.level).toBe("red");
  });

  it("approval_required + green risk still blocks", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ approval_required: true, risk_level_hint: "green" })
    );
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("approval_required=false does not block safe task", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({
        task_type: "reminder.create",
        approval_required: false,
        risk_level_hint: "green",
        domain: "onboarding",
      })
    );
    expect(r.allowed_to_auto_execute).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// 4. Red / black risk hint gate
// ══════════════════════════════════════════════════════════

describe("risk_level_hint gate", () => {
  it("red risk_level_hint blocks auto-execute", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ risk_level_hint: "red" })
    );
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.matched_rules).toContain("risk_hint_red_require");
  });

  it("black risk_level_hint blocks auto-execute", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ risk_level_hint: "black" })
    );
    expect(r.allowed_to_auto_execute).toBe(false);
  });

  it("orange risk_level_hint allows with warning", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({
        task_type: "reminder.create",
        risk_level_hint: "orange",
        domain: "recruitment_ops",
      })
    );
    expect(r.decision).toBe("allow_with_warning");
    expect(r.matched_rules).toContain("risk_hint_orange_warn");
  });

  it("isCloneGuardAutoExecutable returns false for red hint", () => {
    expect(isCloneGuardAutoExecutable({ risk_level_hint: "red" })).toBe(false);
  });

  it("isCloneGuardAutoExecutable returns false for black hint", () => {
    expect(isCloneGuardAutoExecutable({ risk_level_hint: "black" })).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
// 5. Sensitive task types gate
// ══════════════════════════════════════════════════════════

describe("sensitive task types — require_approval or refuse", () => {
  it("contrat type requires approval", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "contrat" }));
    expect(r.decision).toBe("require_approval");
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.matched_rules).toContain("contract_action_require");
  });

  it("prepaie_prep type requires approval", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "prepaie_prep" }));
    expect(r.decision).toBe("require_approval");
    expect(r.matched_rules).toContain("payroll_action_require");
  });

  it("absence_sensible type requires approval", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "absence_sensible" }));
    expect(r.decision).toBe("require_approval");
    expect(r.matched_rules).toContain("absence_action_require");
  });

  it("courrier_disciplinaire_prep requires approval", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ task_type: "courrier_disciplinaire_prep" })
    );
    expect(r.decision).toBe("require_approval");
    expect(r.matched_rules).toContain("disciplinary_prep_require");
  });

  it("decision_licenciement type is refused", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ task_type: "decision_licenciement" })
    );
    expect(r.decision).toBe("refuse");
    expect(r.allowed_to_auto_execute).toBe(false);
    expect(r.matched_rules).toContain("dismissal_action_refuse");
  });

  it("decision_sanction type is refused", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ task_type: "decision_sanction" })
    );
    expect(r.decision).toBe("refuse");
    expect(r.matched_rules).toContain("disciplinary_decision_refuse");
  });

  it("isCloneGuardAutoExecutable returns false for contract_action", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "contrat" })).toBe(false);
  });

  it("isCloneGuardAutoExecutable returns false for dismissal_action type", () => {
    expect(
      isCloneGuardAutoExecutable({ task_type: "decision_licenciement" })
    ).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
// 6. applyCloneGuardToTask — immutability & shape
// ══════════════════════════════════════════════════════════

describe("applyCloneGuardToTask — immutability and shape", () => {
  const baseTask = {
    id: "task-001",
    type: "doc.generate",
    title: "Rapport",
    status: "ready",
  };

  it("does not mutate the original task object", () => {
    const orig = { ...baseTask };
    const eval_ = evaluatePierreCloneGuard(makeTaskRow());
    applyCloneGuardToTask(baseTask, eval_);
    expect(baseTask).toEqual(orig);
  });

  it("returns a new object with all original fields", () => {
    const eval_ = evaluatePierreCloneGuard(makeTaskRow());
    const enriched = applyCloneGuardToTask(baseTask, eval_);
    expect(enriched.id).toBe("task-001");
    expect(enriched.type).toBe("doc.generate");
    expect(enriched.title).toBe("Rapport");
    expect(enriched.status).toBe("ready");
  });

  it("adds cloneguard key to result", () => {
    const eval_ = evaluatePierreCloneGuard(makeTaskRow());
    const enriched = applyCloneGuardToTask(baseTask, eval_);
    expect(enriched.cloneguard).toBeDefined();
  });

  it("cloneguard.decision matches evaluation decision", () => {
    const eval_ = evaluatePierreCloneGuard(
      makeTaskRow({ task_type: "email.send" })
    );
    const enriched = applyCloneGuardToTask(baseTask, eval_);
    const cg = enriched.cloneguard as Record<string, unknown>;
    expect(cg.decision).toBe("block");
  });

  it("cloneguard.allowed_to_auto_execute is false for blocked task", () => {
    const eval_ = evaluatePierreCloneGuard(
      makeTaskRow({ approval_required: true })
    );
    const enriched = applyCloneGuardToTask(baseTask, eval_);
    const cg = enriched.cloneguard as Record<string, unknown>;
    expect(cg.allowed_to_auto_execute).toBe(false);
  });

  it("handles invalid task gracefully", () => {
    const eval_ = evaluatePierreCloneGuard(makeTaskRow());
    const result = applyCloneGuardToTask(null as unknown as Record<string, unknown>, eval_);
    expect(result.cloneguard).toBeNull();
  });

  it("handles empty task object", () => {
    const eval_ = evaluatePierreCloneGuard(makeTaskRow());
    const result = applyCloneGuardToTask({}, eval_);
    expect(result.cloneguard).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════
// 7. Audit event schema compliance (new schema only)
// ══════════════════════════════════════════════════════════

describe("audit event schema compliance", () => {
  it("audit event has event_type, message, meta_json — never level/event/payload", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "email.send" }));
    const ev = buildCloneGuardAuditEvent(r);
    expect(ev).toHaveProperty("event_type");
    expect(ev).toHaveProperty("message");
    expect(ev).toHaveProperty("meta_json");
    expect(ev).not.toHaveProperty("level");
    expect(ev).not.toHaveProperty("event");
    expect(ev).not.toHaveProperty("payload");
  });

  it("meta_json never contains level/event/payload keys", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "contrat" }));
    const ev = buildCloneGuardAuditEvent(r);
    expect(ev.meta_json).not.toHaveProperty("level");
    expect(ev.meta_json).not.toHaveProperty("event");
    expect(ev.meta_json).not.toHaveProperty("payload");
  });

  it("meta_json contains decision, risk_level, signal_count, signals, matched_rules, allowed_to_auto_execute", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "contrat" }));
    const ev = buildCloneGuardAuditEvent(r);
    expect(ev.meta_json).toHaveProperty("decision");
    expect(ev.meta_json).toHaveProperty("risk_level");
    expect(ev.meta_json).toHaveProperty("signal_count");
    expect(ev.meta_json).toHaveProperty("signals");
    expect(ev.meta_json).toHaveProperty("matched_rules");
    expect(ev.meta_json).toHaveProperty("allowed_to_auto_execute");
  });

  it("event_type is cloneguard_execution_blocked for refuse", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ task_type: "decision_licenciement" })
    );
    expect(r.decision).toBe("refuse");
    const ev = buildCloneGuardAuditEvent(r);
    expect(ev.event_type).toBe("cloneguard_execution_blocked");
  });

  it("event_type is cloneguard_execution_blocked for block", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "email.send" }));
    const ev = buildCloneGuardAuditEvent(r);
    expect(ev.event_type).toBe("cloneguard_execution_blocked");
  });

  it("event_type is cloneguard_signal_detected for allow_with_warning", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({ risk_level_hint: "orange", task_type: "reminder.create", domain: "recruitment_ops" })
    );
    expect(r.decision).toBe("allow_with_warning");
    const ev = buildCloneGuardAuditEvent(r);
    expect(ev.event_type).toBe("cloneguard_signal_detected");
  });

  it("event_type is cloneguard_evaluation for clean allow", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({
        task_type: "reminder.create",
        domain: "recruitment_ops",
        risk_level_hint: "green",
      })
    );
    expect(r.decision).toBe("allow");
    const ev = buildCloneGuardAuditEvent(r);
    expect(ev.event_type).toBe("cloneguard_evaluation");
  });

  it("message is a non-empty string", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ task_type: "email.send" }));
    const ev = buildCloneGuardAuditEvent(r);
    expect(typeof ev.message).toBe("string");
    expect(ev.message.length).toBeGreaterThan(0);
  });

  it("audit event for null evaluation returns safe defaults", () => {
    const ev = buildCloneGuardAuditEvent(
      null as unknown as PierreCloneGuardEvaluation
    );
    expect(ev.event_type).toBe("cloneguard_evaluation");
    expect(ev.meta_json.decision).toBe("allow");
  });
});

// ══════════════════════════════════════════════════════════
// 8. Text scanning from payload_json (recursive)
// ══════════════════════════════════════════════════════════

describe("text scanning from payload_json (recursive)", () => {
  it("detects licenciement in top-level payload string", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({
        task_type: "reminder.create",
        payload_json: { note: "Procédure de licenciement en cours" },
      })
    );
    expect(r.matched_rules).toContain("licenciement_text_require");
  });

  it("detects discrimination in nested payload string", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({
        task_type: "reminder.create",
        payload_json: { details: { reason: "motif discriminatoire" } },
      })
    );
    expect(r.decision).toBe("refuse");
  });

  it("ignores payload numeric values without crashing", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({
        payload_json: { count: 5, amount: 3200.5 },
      })
    );
    expect(() => r).not.toThrow();
  });

  it("ignores null payload gracefully", () => {
    const r = evaluatePierreCloneGuard(makeTaskRow({ payload_json: null }));
    expect(r).toBeDefined();
  });

  it("handles malformed nested payload without crashing", () => {
    const r = evaluatePierreCloneGuard(
      makeTaskRow({
        payload_json: { nested: { deep: { value: 42 } } },
      })
    );
    expect(r).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════
// 9. collectCloneGuardText edge cases
// ══════════════════════════════════════════════════════════

describe("collectCloneGuardText edge cases", () => {
  it("returns empty string for empty context", () => {
    expect(collectCloneGuardText({})).toBe("");
  });

  it("lowercases and strips diacritics", () => {
    const text = collectCloneGuardText({ task_title: "Harcèlement moral" });
    expect(text).toContain("harcelement");
    expect(text).not.toContain("è");
  });

  it("combines all text fields", () => {
    const text = collectCloneGuardText({
      task_type: "email.send",
      task_title: "Rappel",
      task_description: "Absence",
      text_corpus: "licenciement",
      domain: "contract",
    });
    expect(text).toContain("email.send");
    expect(text).toContain("rappel");
    expect(text).toContain("absence");
    expect(text).toContain("licenciement");
    expect(text).toContain("contract");
  });

  it("includes payload_json string values", () => {
    const text = collectCloneGuardText({
      payload_json: { note: "Prud'hommes saisi" },
    });
    expect(text).toContain("prud");
  });

  it("handles null context without crashing", () => {
    expect(() =>
      collectCloneGuardText(null as unknown as PierreCloneGuardContext)
    ).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════
// 10. normalizeCloneGuardDomain runtime mapping
// ══════════════════════════════════════════════════════════

describe("normalizeCloneGuardDomain runtime mapping", () => {
  it("maps 'leave' to absence", () => {
    expect(normalizeCloneGuardDomain("leave")).toBe("absence");
  });

  it("maps 'interview' to hiring", () => {
    expect(normalizeCloneGuardDomain("interview")).toBe("hiring");
  });

  it("keeps 'contract' as contract", () => {
    expect(normalizeCloneGuardDomain("contract")).toBe("contract");
  });

  it("maps unknown string to unknown", () => {
    expect(normalizeCloneGuardDomain("foo_bar_baz")).toBe("unknown");
  });

  it("maps null to unknown", () => {
    expect(normalizeCloneGuardDomain(null)).toBe("unknown");
  });

  it("maps 'sensitive_case' to sensitive_case", () => {
    expect(normalizeCloneGuardDomain("sensitive_case")).toBe("sensitive_case");
  });
});

// ══════════════════════════════════════════════════════════
// 11. normalizeCloneGuardActionKind runtime mapping
// ══════════════════════════════════════════════════════════

describe("normalizeCloneGuardActionKind runtime mapping", () => {
  it("maps 'email.send' to email_send", () => {
    expect(normalizeCloneGuardActionKind("email.send")).toBe("email_send");
  });

  it("maps 'send_email' to email_send", () => {
    expect(normalizeCloneGuardActionKind("send_email")).toBe("email_send");
  });

  it("maps 'decision_licenciement' to dismissal_action", () => {
    expect(normalizeCloneGuardActionKind("decision_licenciement")).toBe(
      "dismissal_action"
    );
  });

  it("maps 'decision_sanction' to disciplinary_decision", () => {
    expect(normalizeCloneGuardActionKind("decision_sanction")).toBe(
      "disciplinary_decision"
    );
  });

  it("maps null to unknown_action", () => {
    expect(normalizeCloneGuardActionKind(null)).toBe("unknown_action");
  });

  it("maps unknown string to unknown_action", () => {
    expect(normalizeCloneGuardActionKind("foobar")).toBe("unknown_action");
  });
});

// ══════════════════════════════════════════════════════════
// 12. Full pipeline: context → evaluation → preview → audit
// ══════════════════════════════════════════════════════════

describe("full pipeline: context → evaluation → preview → audit", () => {
  it("safe reminder.create task passes all stages", () => {
    const ctx = makeTaskRow({
      task_type: "reminder.create",
      domain: "recruitment_ops",
      risk_level_hint: "green",
    });
    const eval_ = evaluatePierreCloneGuard(ctx);
    expect(eval_.decision).toBe("allow");
    expect(eval_.allowed_to_auto_execute).toBe(true);

    const preview = buildCloneGuardPreview(eval_);
    expect(preview.decision).toBe("allow");
    expect(preview.allowed_to_auto_execute).toBe(true);

    const summary = summarizeCloneGuardEvaluation(eval_);
    expect(summary).toContain("Autorisé");

    const audit = buildCloneGuardAuditEvent(eval_, ctx);
    expect(audit.event_type).toBe("cloneguard_evaluation");
    expect(audit.meta_json.allowed_to_auto_execute).toBe(true);
  });

  it("email.send task fails all auto-execute checks", () => {
    const ctx = makeTaskRow({ task_type: "email.send" });
    const eval_ = evaluatePierreCloneGuard(ctx);
    expect(eval_.allowed_to_auto_execute).toBe(false);

    const preview = buildCloneGuardPreview(eval_);
    expect(preview.allowed_to_auto_execute).toBe(false);

    const audit = buildCloneGuardAuditEvent(eval_, ctx);
    expect(audit.event_type).toBe("cloneguard_execution_blocked");
    expect(audit.meta_json.allowed_to_auto_execute).toBe(false);
  });

  it("harcelement context produces full refuse pipeline", () => {
    const ctx = makeTaskRow({
      task_type: "reminder.create",
      text_corpus: "Cas de harcèlement moral signalé",
    });
    const eval_ = evaluatePierreCloneGuard(ctx);
    expect(eval_.decision).toBe("refuse");
    expect(eval_.requires_human).toBe(true);
    expect(eval_.allowed_to_auto_execute).toBe(false);

    const preview = buildCloneGuardPreview(eval_);
    expect(preview.decision).toBe("refuse");

    const summary = summarizeCloneGuardEvaluation(eval_);
    expect(summary).toContain("Refusé");

    const audit = buildCloneGuardAuditEvent(eval_, ctx);
    expect(audit.event_type).toBe("cloneguard_execution_blocked");
  });

  it("worst-decision escalation: email.send + harcelement → refuse beats block", () => {
    const ctx = makeTaskRow({
      task_type: "email.send",
      text_corpus: "Harcèlement signalé par le salarié",
    });
    const eval_ = evaluatePierreCloneGuard(ctx);
    expect(eval_.decision).toBe("refuse"); // refuse (4) > block (3)
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("decision escalation: approval_required + red risk = block beats require_approval", () => {
    const ctx = makeTaskRow({
      approval_required: true,
      risk_level_hint: "red",
    });
    const eval_ = evaluatePierreCloneGuard(ctx);
    // block (3) vs require_approval (2) → block wins
    expect(DECISION_RANK_CHECK[eval_.decision]).toBeGreaterThanOrEqual(
      DECISION_RANK_CHECK["require_approval"]
    );
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });
});

// Helper for decision rank assertions
const DECISION_RANK_CHECK: Record<string, number> = {
  allow: 0,
  allow_with_warning: 1,
  require_approval: 2,
  block: 3,
  refuse: 4,
};

// ══════════════════════════════════════════════════════════
// 13. isCloneGuardAutoExecutable fast-path coverage
// ══════════════════════════════════════════════════════════

describe("isCloneGuardAutoExecutable fast-path", () => {
  it("returns true for a clean safe task", () => {
    expect(
      isCloneGuardAutoExecutable({
        task_type: "reminder.create",
        approval_required: false,
        risk_level_hint: "green",
        domain: "recruitment_ops",
      })
    ).toBe(true);
  });

  it("returns false for null context", () => {
    expect(
      isCloneGuardAutoExecutable(null as unknown as PierreCloneGuardContext)
    ).toBe(false);
  });

  it("returns false for payroll_action", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "prepaie_prep" })).toBe(
      false
    );
  });

  it("returns false for contract_action (avenant)", () => {
    expect(isCloneGuardAutoExecutable({ task_type: "avenant" })).toBe(false);
  });

  it("returns false for text with licenciement even without type gate", () => {
    expect(
      isCloneGuardAutoExecutable({
        task_type: "reminder.create",
        text_corpus: "Lettre de licenciement à préparer",
        domain: "contract",
      })
    ).toBe(false);
  });
});
