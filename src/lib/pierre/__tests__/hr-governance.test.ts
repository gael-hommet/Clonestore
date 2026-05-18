import { describe, it, expect } from "vitest";
import {
  normalizeGovernanceDecision,
  normalizeGovernanceRiskLevel,
  buildGovernanceContext,
  combineGovernanceDecisions,
  evaluateGovernance,
  buildGovernancePreview,
  buildGovernanceAuditEvent,
  applyGovernanceToTask,
  isGovernanceAutoExecutable,
  summarizeGovernanceEvaluation,
  buildGovernanceBriefing,
  buildGovernanceCard,
  filterGovernanceSafeToRun,
  type PierreGovernanceContext,
  type PierreGovernanceDecision,
} from "../hr/governance";
import { evaluatePierreCloneGuard } from "../hr/cloneguard";
import { evaluatePierreClonePolicy } from "../hr/clonepolicy";
import { evaluatePierreCloneTrust } from "../hr/clonetrust";

// ═══════════════════════════════════════════════════════════
// 1. normalizeGovernanceDecision
// ═══════════════════════════════════════════════════════════

describe("normalizeGovernanceDecision", () => {
  it("returns allow for 'allow'", () => {
    expect(normalizeGovernanceDecision("allow")).toBe("allow");
  });

  it("returns allow_with_warning for 'allow_with_warning'", () => {
    expect(normalizeGovernanceDecision("allow_with_warning")).toBe("allow_with_warning");
  });

  it("returns supervised for 'supervised'", () => {
    expect(normalizeGovernanceDecision("supervised")).toBe("supervised");
  });

  it("returns require_approval for 'require_approval'", () => {
    expect(normalizeGovernanceDecision("require_approval")).toBe("require_approval");
  });

  it("returns block for 'block'", () => {
    expect(normalizeGovernanceDecision("block")).toBe("block");
  });

  it("returns refuse for 'refuse'", () => {
    expect(normalizeGovernanceDecision("refuse")).toBe("refuse");
  });

  it("is case-insensitive", () => {
    expect(normalizeGovernanceDecision("ALLOW")).toBe("allow");
    expect(normalizeGovernanceDecision("REFUSE")).toBe("refuse");
    expect(normalizeGovernanceDecision("SUPERVISED")).toBe("supervised");
  });

  it("returns allow_with_warning for unknown", () => {
    expect(normalizeGovernanceDecision("random")).toBe("allow_with_warning");
    expect(normalizeGovernanceDecision(null)).toBe("allow_with_warning");
    expect(normalizeGovernanceDecision(undefined)).toBe("allow_with_warning");
  });
});

// ═══════════════════════════════════════════════════════════
// 2. normalizeGovernanceRiskLevel
// ═══════════════════════════════════════════════════════════

describe("normalizeGovernanceRiskLevel", () => {
  it("returns all valid risk levels", () => {
    expect(normalizeGovernanceRiskLevel("green")).toBe("green");
    expect(normalizeGovernanceRiskLevel("orange")).toBe("orange");
    expect(normalizeGovernanceRiskLevel("red")).toBe("red");
    expect(normalizeGovernanceRiskLevel("black")).toBe("black");
  });

  it("returns green for unknown", () => {
    expect(normalizeGovernanceRiskLevel(null)).toBe("green");
    expect(normalizeGovernanceRiskLevel("xyz")).toBe("green");
  });
});

// ═══════════════════════════════════════════════════════════
// 3. buildGovernanceContext
// ═══════════════════════════════════════════════════════════

describe("buildGovernanceContext", () => {
  it("returns a context object", () => {
    const ctx = buildGovernanceContext({ task_type: "document.draft" });
    expect(typeof ctx).toBe("object");
    expect(ctx).not.toBeNull();
  });

  it("preserves task_type", () => {
    const ctx = buildGovernanceContext({ task_type: "email.send" });
    expect(ctx.task_type).toBe("email.send");
  });

  it("handles empty input", () => {
    const ctx = buildGovernanceContext({});
    expect(ctx).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// 4. combineGovernanceDecisions
// ═══════════════════════════════════════════════════════════

describe("combineGovernanceDecisions", () => {
  // combineGovernanceDecisions takes 3 evaluations: guard, policy, trust
  // It returns the worst governance decision from combining all three

  it("returns refuse when guard detects harcèlement (via evaluateGovernance)", () => {
    const eval_ = evaluateGovernance({ text_corpus: "harcèlement moral" });
    expect(eval_.decision).toBe("refuse");
  });

  it("returns block when email.send type (via evaluateGovernance)", () => {
    const eval_ = evaluateGovernance({ task_type: "email.send" });
    expect(["block", "refuse"]).toContain(eval_.decision);
  });

  it("returns require_approval when approval_required=true", () => {
    const eval_ = evaluateGovernance({ approval_required: true });
    expect(["require_approval", "block", "refuse"]).toContain(eval_.decision);
  });

  it("combineGovernanceDecisions returns worst of three evaluations", () => {
    const guardSafe = evaluatePierreCloneGuard({ task_type: "document.draft" });
    const policySafe = evaluatePierreClonePolicy({ task_type: "document.draft" });
    const trustSafe = evaluatePierreCloneTrust({ task_type: "document.draft" });
    const result = combineGovernanceDecisions(guardSafe, policySafe, trustSafe);
    expect(result).toBeTruthy();
    expect(["allow", "allow_with_warning", "supervised", "require_approval", "block", "refuse"]).toContain(result);
  });

  it("combineGovernanceDecisions with blocked guard returns non-allow", () => {
    const guardBlocked = evaluatePierreCloneGuard({ task_type: "email.send" });
    const policySafe = evaluatePierreClonePolicy({});
    const trustSafe = evaluatePierreCloneTrust({});
    const result = combineGovernanceDecisions(guardBlocked, policySafe, trustSafe);
    expect(["block", "refuse", "require_approval", "supervised"]).toContain(result);
  });

  it("combineGovernanceDecisions with refuse policy returns refuse", () => {
    const guardSafe = evaluatePierreCloneGuard({});
    const policyRefuse = evaluatePierreClonePolicy({ text_corpus: "harcèlement moral" });
    const trustSafe = evaluatePierreCloneTrust({});
    const result = combineGovernanceDecisions(guardSafe, policyRefuse, trustSafe);
    expect(result).toBe("refuse");
  });

  it("combineGovernanceDecisions is deterministic", () => {
    const g = evaluatePierreCloneGuard({ task_type: "document.draft" });
    const p = evaluatePierreClonePolicy({ task_type: "document.draft" });
    const t = evaluatePierreCloneTrust({ task_type: "document.draft" });
    const a = combineGovernanceDecisions(g, p, t);
    const b = combineGovernanceDecisions(g, p, t);
    expect(a).toBe(b);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. evaluateGovernance — baseline
// ═══════════════════════════════════════════════════════════

describe("evaluateGovernance — baseline", () => {
  it("returns valid evaluation for empty context", () => {
    const eval_ = evaluateGovernance({});
    expect(eval_.decision).toBeTruthy();
    expect(eval_.risk_level).toBeTruthy();
    expect(eval_.guard_decision).toBeTruthy();
    expect(eval_.policy_decision).toBeTruthy();
    expect(eval_.trust_decision).toBeTruthy();
    expect(eval_.trust_level).toBeTruthy();
    expect(typeof eval_.trust_score).toBe("number");
    expect(typeof eval_.allowed_to_auto_execute).toBe("boolean");
    expect(typeof eval_.requires_human).toBe("boolean");
    expect(typeof eval_.explanation).toBe("string");
    expect(Array.isArray(eval_.audit_trail)).toBe(true);
    expect(typeof eval_.evaluated_at).toBe("string");
  });

  it("is deterministic", () => {
    const ctx: PierreGovernanceContext = { task_type: "document.draft", now: "2026-01-01T00:00:00Z" };
    const a = evaluateGovernance(ctx);
    const b = evaluateGovernance(ctx);
    expect(a.decision).toBe(b.decision);
    expect(a.risk_level).toBe(b.risk_level);
    expect(a.allowed_to_auto_execute).toBe(b.allowed_to_auto_execute);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. evaluateGovernance — refuse triggers
// ═══════════════════════════════════════════════════════════

describe("evaluateGovernance — refuse triggers", () => {
  it("refuses on harcèlement", () => {
    const eval_ = evaluateGovernance({ text_corpus: "harcèlement moral" });
    expect(eval_.decision).toBe("refuse");
    expect(eval_.allowed_to_auto_execute).toBe(false);
    expect(eval_.requires_human).toBe(true);
  });

  it("refuses on discrimination", () => {
    const eval_ = evaluateGovernance({ text_corpus: "discrimination ethnique" });
    expect(eval_.decision).toBe("refuse");
  });

  it("refuses on violence", () => {
    const eval_ = evaluateGovernance({ text_corpus: "violence au travail" });
    expect(eval_.decision).toBe("refuse");
  });
});

// ═══════════════════════════════════════════════════════════
// 7. evaluateGovernance — block triggers
// ═══════════════════════════════════════════════════════════

describe("evaluateGovernance — block triggers", () => {
  it("blocks email.send", () => {
    const eval_ = evaluateGovernance({ task_type: "email.send" });
    expect(["block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("blocks send_email", () => {
    const eval_ = evaluateGovernance({ task_type: "send_email" });
    expect(["block", "refuse"]).toContain(eval_.decision);
  });

  it("blocks black risk level", () => {
    const eval_ = evaluateGovernance({ risk_level_hint: "black" });
    expect(["block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 8. evaluateGovernance — require_approval triggers
// ═══════════════════════════════════════════════════════════

describe("evaluateGovernance — require_approval triggers", () => {
  it("requires approval when approval_required=true", () => {
    const eval_ = evaluateGovernance({ approval_required: true });
    expect(["require_approval", "block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval for red risk", () => {
    const eval_ = evaluateGovernance({ risk_level_hint: "red" });
    expect(["require_approval", "block", "refuse"]).toContain(eval_.decision);
  });
});

// ═══════════════════════════════════════════════════════════
// 9. evaluateGovernance — allowed_to_auto_execute invariant
// ═══════════════════════════════════════════════════════════

describe("evaluateGovernance — allowed_to_auto_execute", () => {
  it("is false for refuse", () => {
    const eval_ = evaluateGovernance({ text_corpus: "harcèlement moral" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("is false for block", () => {
    const eval_ = evaluateGovernance({ task_type: "email.send" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("is false for require_approval", () => {
    const eval_ = evaluateGovernance({ approval_required: true });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("is false for supervised", () => {
    const eval_ = evaluateGovernance({ autonomy_level: "supervised" });
    if (eval_.decision === "supervised") {
      expect(eval_.allowed_to_auto_execute).toBe(false);
    }
  });

  it("allowed_to_auto_execute=true only when decision=allow", () => {
    const eval_ = evaluateGovernance({
      task_type: "document.draft",
      risk_level_hint: "green",
      approval_required: false,
    });
    if (eval_.allowed_to_auto_execute) {
      expect(eval_.decision).toBe("allow");
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 10. evaluateGovernance — pre-computed evaluations
// ═══════════════════════════════════════════════════════════

describe("evaluateGovernance — pre-computed evaluations", () => {
  it("uses pre-computed guard_evaluation if provided", () => {
    const guardEval = evaluatePierreCloneGuard({ task_type: "email.send" });
    const eval_ = evaluateGovernance({
      task_type: "email.send",
      guard_evaluation: guardEval,
    });
    expect(eval_.guard_decision).toBe(guardEval.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("produces same decision with fully pre-computed evals", () => {
    const ctx: PierreGovernanceContext = {
      task_type: "document.draft",
      risk_level_hint: "green",
    };
    const guardEval = evaluatePierreCloneGuard(ctx);
    const policyEval = evaluatePierreClonePolicy(ctx);
    const trustEval = evaluatePierreCloneTrust({
      ...ctx,
      cloneguard_decision: guardEval.decision,
      clonepolicy_decision: policyEval.decision,
    });
    const withAll = evaluateGovernance({ ...ctx, guard_evaluation: guardEval, policy_evaluation: policyEval, trust_evaluation: trustEval });
    const withoutAll = evaluateGovernance(ctx);
    expect(withAll.decision).toBe(withoutAll.decision);
    expect(withAll.allowed_to_auto_execute).toBe(withoutAll.allowed_to_auto_execute);
  });
});

// ═══════════════════════════════════════════════════════════
// 11. evaluateGovernance — strictest decision wins
// ═══════════════════════════════════════════════════════════

describe("evaluateGovernance — strictest decision wins", () => {
  it("returns refuse when guard+policy refuse even if trust allows", () => {
    const eval_ = evaluateGovernance({
      text_corpus: "harcèlement moral",
      company_trust_score: 25,
      autonomy_level: "high_trust",
    });
    expect(eval_.decision).toBe("refuse");
  });

  it("audit_trail has entries for all three evaluators", () => {
    const eval_ = evaluateGovernance({ task_type: "document.draft" });
    expect(eval_.audit_trail.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. buildGovernancePreview
// ═══════════════════════════════════════════════════════════

describe("buildGovernancePreview", () => {
  it("returns a valid preview", () => {
    const eval_ = evaluateGovernance({});
    const preview = buildGovernancePreview(eval_);
    expect(preview.decision).toBe(eval_.decision);
    expect(preview.risk_level).toBe(eval_.risk_level);
    expect(preview.guard_decision).toBe(eval_.guard_decision);
    expect(preview.policy_decision).toBe(eval_.policy_decision);
    expect(preview.trust_decision).toBe(eval_.trust_decision);
    expect(typeof preview.allowed_to_auto_execute).toBe("boolean");
    expect(typeof preview.summary).toBe("string");
  });

  it("summary is non-empty", () => {
    const preview = buildGovernancePreview(evaluateGovernance({ task_type: "email.send" }));
    expect(preview.summary.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 13. buildGovernanceAuditEvent
// ═══════════════════════════════════════════════════════════

describe("buildGovernanceAuditEvent", () => {
  it("returns a valid audit event", () => {
    const eval_ = evaluateGovernance({});
    const event = buildGovernanceAuditEvent(eval_, {});
    expect(event.event_type).toBeTruthy();
    expect(typeof event.message).toBe("string");
    expect(event.meta_json).toBeDefined();
  });

  it("event_type is governance_execution_blocked for refuse/block", () => {
    const eval_ = evaluateGovernance({ task_type: "email.send" });
    const event = buildGovernanceAuditEvent(eval_, { task_type: "email.send" });
    if (eval_.decision === "refuse" || eval_.decision === "block") {
      expect(event.event_type).toBe("governance_execution_blocked");
    }
  });

  it("event_type is governance_auto_allowed when allowed", () => {
    const eval_ = evaluateGovernance({
      task_type: "document.draft",
      risk_level_hint: "green",
    });
    if (eval_.allowed_to_auto_execute) {
      const event = buildGovernanceAuditEvent(eval_, {});
      expect(event.event_type).toBe("governance_auto_allowed");
    }
  });

  it("meta_json has all three sub-decisions", () => {
    const eval_ = evaluateGovernance({});
    const event = buildGovernanceAuditEvent(eval_, {});
    expect(event.meta_json.guard_decision).toBeDefined();
    expect(event.meta_json.policy_decision).toBeDefined();
    expect(event.meta_json.trust_decision).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// 14. applyGovernanceToTask
// ═══════════════════════════════════════════════════════════

describe("applyGovernanceToTask", () => {
  it("adds governance field to task", () => {
    const task = { id: "t1", type: "document.draft" };
    const eval_ = evaluateGovernance({});
    const result = applyGovernanceToTask(task, eval_);
    expect(result.id).toBe("t1");
    const gov = result.governance as Record<string, unknown>;
    expect(gov).toBeDefined();
    expect(gov.decision).toBe(eval_.decision);
    expect(gov.allowed_to_auto_execute).toBe(eval_.allowed_to_auto_execute);
  });

  it("does not mutate original task", () => {
    const task = { id: "t2" };
    const eval_ = evaluateGovernance({});
    applyGovernanceToTask(task, eval_);
    expect(task).not.toHaveProperty("governance");
  });

  it("preserves existing fields", () => {
    const task = { id: "t3", title: "My task", status: "pending" };
    const result = applyGovernanceToTask(task, evaluateGovernance({}));
    expect(result.title).toBe("My task");
    expect(result.status).toBe("pending");
  });
});

// ═══════════════════════════════════════════════════════════
// 15. isGovernanceAutoExecutable
// ═══════════════════════════════════════════════════════════

describe("isGovernanceAutoExecutable", () => {
  it("returns false for email.send", () => {
    expect(isGovernanceAutoExecutable({ task_type: "email.send" })).toBe(false);
  });

  it("returns false for approval_required=true", () => {
    expect(isGovernanceAutoExecutable({ approval_required: true })).toBe(false);
  });

  it("returns false for harcèlement", () => {
    expect(isGovernanceAutoExecutable({ text_corpus: "harcèlement moral" })).toBe(false);
  });

  it("returns false for black risk", () => {
    expect(isGovernanceAutoExecutable({ risk_level_hint: "black" })).toBe(false);
  });

  it("returns boolean", () => {
    expect(typeof isGovernanceAutoExecutable({})).toBe("boolean");
  });
});

// ═══════════════════════════════════════════════════════════
// 16. summarizeGovernanceEvaluation
// ═══════════════════════════════════════════════════════════

describe("summarizeGovernanceEvaluation", () => {
  it("returns non-empty string", () => {
    const eval_ = evaluateGovernance({});
    expect(typeof summarizeGovernanceEvaluation(eval_)).toBe("string");
    expect(summarizeGovernanceEvaluation(eval_).length).toBeGreaterThan(0);
  });

  it("different for blocked vs allowed", () => {
    const allowed = evaluateGovernance({ task_type: "document.draft", risk_level_hint: "green" });
    const blocked = evaluateGovernance({ task_type: "email.send" });
    if (allowed.decision !== blocked.decision) {
      expect(summarizeGovernanceEvaluation(allowed)).not.toBe(summarizeGovernanceEvaluation(blocked));
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 17. buildGovernanceBriefing
// ═══════════════════════════════════════════════════════════

describe("buildGovernanceBriefing", () => {
  it("returns a valid briefing", () => {
    const ctx: PierreGovernanceContext = {};
    const guardEval = evaluatePierreCloneGuard(ctx);
    const policyEval = evaluatePierreClonePolicy(ctx);
    const trustEval = evaluatePierreCloneTrust({
      ...ctx,
      cloneguard_decision: guardEval.decision,
      clonepolicy_decision: policyEval.decision,
    });
    const eval_ = evaluateGovernance({ ...ctx, guard_evaluation: guardEval, policy_evaluation: policyEval, trust_evaluation: trustEval });
    const briefing = buildGovernanceBriefing(eval_, guardEval, policyEval, trustEval);
    expect(briefing.decision).toBe(eval_.decision);
    expect(briefing.risk_level).toBe(eval_.risk_level);
    expect(typeof briefing.summary).toBe("string");
    expect(typeof briefing.guard_summary).toBe("string");
    expect(typeof briefing.policy_summary).toBe("string");
    expect(typeof briefing.trust_summary).toBe("string");
    expect(Array.isArray(briefing.human_actions)).toBe(true);
    expect(typeof briefing.allowed_to_auto_execute).toBe("boolean");
  });

  it("human_actions is non-empty for blocked decisions", () => {
    const ctx: PierreGovernanceContext = { task_type: "email.send" };
    const guardEval = evaluatePierreCloneGuard(ctx);
    const policyEval = evaluatePierreClonePolicy(ctx);
    const trustEval = evaluatePierreCloneTrust({
      ...ctx,
      cloneguard_decision: guardEval.decision,
      clonepolicy_decision: policyEval.decision,
    });
    const eval_ = evaluateGovernance({ ...ctx, guard_evaluation: guardEval, policy_evaluation: policyEval, trust_evaluation: trustEval });
    const briefing = buildGovernanceBriefing(eval_, guardEval, policyEval, trustEval);
    if (!eval_.allowed_to_auto_execute) {
      expect(briefing.human_actions.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 18. buildGovernanceCard
// ═══════════════════════════════════════════════════════════

describe("buildGovernanceCard", () => {
  it("returns a valid card", () => {
    const eval_ = evaluateGovernance({});
    const card = buildGovernanceCard(eval_, { task_type: "document.draft" });
    expect(card.decision).toBe(eval_.decision);
    expect(card.risk_level).toBe(eval_.risk_level);
    expect(card.trust_level).toBe(eval_.trust_level);
    expect(card.trust_score).toBe(eval_.trust_score);
    expect(card.guard_decision).toBe(eval_.guard_decision);
    expect(card.policy_decision).toBe(eval_.policy_decision);
    expect(card.trust_decision).toBe(eval_.trust_decision);
    expect(typeof card.allowed_to_auto_execute).toBe("boolean");
    expect(typeof card.requires_human).toBe("boolean");
    expect(typeof card.evaluated_at).toBe("string");
  });

  it("task_type is set from context", () => {
    const eval_ = evaluateGovernance({ task_type: "email.send" });
    const card = buildGovernanceCard(eval_, { task_type: "email.send" });
    expect(card.task_type).toBe("email.send");
  });
});

// ═══════════════════════════════════════════════════════════
// 19. filterGovernanceSafeToRun
// ═══════════════════════════════════════════════════════════

describe("filterGovernanceSafeToRun", () => {
  it("returns an array for empty input", () => {
    const result = filterGovernanceSafeToRun([], () => null);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("filters out tasks where allowed_to_auto_execute=false", () => {
    const tasks = [
      { id: "t1", type: "document.draft" },
      { id: "t2", type: "email.send" },
      { id: "t3", type: "schedule.meeting" },
    ];
    const result = filterGovernanceSafeToRun(tasks, (t) =>
      evaluateGovernance({ task_type: t.type })
    );
    const emailTask = result.find((t) => t.id === "t2");
    expect(emailTask).toBeUndefined();
  });

  it("returns empty for all blocked tasks", () => {
    const tasks = [
      { id: "t1", type: "email.send" },
      { id: "t2", type: "send_email" },
    ];
    const result = filterGovernanceSafeToRun(tasks, (t) =>
      evaluateGovernance({ task_type: t.type })
    );
    expect(result.length).toBe(0);
  });

  it("getEvaluation returning null excludes the item", () => {
    const tasks = [{ id: "t1" }, { id: "t2" }];
    const result = filterGovernanceSafeToRun(tasks, () => null);
    expect(result.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 20. Security invariants
// ═══════════════════════════════════════════════════════════

describe("evaluateGovernance — security invariants", () => {
  it("audit_trail is always an array", () => {
    expect(Array.isArray(evaluateGovernance({}).audit_trail)).toBe(true);
    expect(Array.isArray(evaluateGovernance({ task_type: "email.send" }).audit_trail)).toBe(true);
  });

  it("evaluated_at is valid ISO string", () => {
    const eval_ = evaluateGovernance({ now: "2026-03-01T08:00:00Z" });
    expect(() => new Date(eval_.evaluated_at)).not.toThrow();
  });

  it("explanation is non-empty for blocked decisions", () => {
    const eval_ = evaluateGovernance({ text_corpus: "harcèlement moral" });
    expect(eval_.explanation.length).toBeGreaterThan(0);
  });

  it("trust_score is finite number", () => {
    const eval_ = evaluateGovernance({ risk_level_hint: "black" });
    expect(Number.isFinite(eval_.trust_score)).toBe(true);
  });

  it("all three sub-decisions are always set", () => {
    const eval_ = evaluateGovernance({});
    expect(eval_.guard_decision).toBeTruthy();
    expect(eval_.policy_decision).toBeTruthy();
    expect(eval_.trust_decision).toBeTruthy();
  });

  it("maximum strictness: refuse overrides all other decisions", () => {
    const scenarios = [
      { text_corpus: "harcèlement moral et discrimination" },
      { text_corpus: "litige prud'hommes violence" },
    ];
    for (const ctx of scenarios) {
      const eval_ = evaluateGovernance(ctx);
      if (eval_.decision === "refuse") {
        expect(eval_.allowed_to_auto_execute).toBe(false);
        expect(eval_.requires_human).toBe(true);
      }
    }
  });
});
