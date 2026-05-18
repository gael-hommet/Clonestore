import { describe, it, expect } from "vitest";
import { evaluatePierreCloneGuard } from "../hr/cloneguard";
import { evaluatePierreClonePolicy } from "../hr/clonepolicy";
import { evaluatePierreCloneTrust } from "../hr/clonetrust";
import {
  evaluateGovernance,
  isGovernanceAutoExecutable,
  applyGovernanceToTask,
  filterGovernanceSafeToRun,
  buildGovernanceCard,
  type PierreGovernanceContext,
} from "../hr/governance";

// ═══════════════════════════════════════════════════════════
// 1. Cross-module consistency — Guard+Policy+Trust+Governance
// ═══════════════════════════════════════════════════════════

describe("Runtime — sub-evaluators agree with governance", () => {
  it("governance allowed_to_auto_execute=false when guard blocks", () => {
    const ctx = { task_type: "email.send", now: "2026-01-01T00:00:00Z" };
    const guard = evaluatePierreCloneGuard(ctx);
    const eval_ = evaluateGovernance({ ...ctx, guard_evaluation: guard });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("governance allowed_to_auto_execute=false when policy blocks", () => {
    const ctx = { task_type: "email.send" };
    const policy = evaluatePierreClonePolicy(ctx);
    const eval_ = evaluateGovernance({ ...ctx, policy_evaluation: policy });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("governance allowed_to_auto_execute=false when trust blocks", () => {
    const ctx = { task_type: "email.send" };
    const trust = evaluatePierreCloneTrust(ctx);
    const eval_ = evaluateGovernance({ ...ctx, trust_evaluation: trust });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("guard decision matches governance guard_decision", () => {
    const ctx = { task_type: "document.draft", risk_level_hint: "green" };
    const guard = evaluatePierreCloneGuard(ctx);
    const eval_ = evaluateGovernance({ ...ctx, guard_evaluation: guard });
    expect(eval_.guard_decision).toBe(guard.decision);
  });

  it("policy decision matches governance policy_decision", () => {
    const ctx = { task_type: "document.draft" };
    const policy = evaluatePierreClonePolicy(ctx);
    const eval_ = evaluateGovernance({ ...ctx, policy_evaluation: policy });
    expect(eval_.policy_decision).toBe(policy.decision);
  });

  it("trust level and score match governance fields", () => {
    const ctx = { task_type: "document.draft", company_trust_score: 10 };
    const trust = evaluatePierreCloneTrust(ctx);
    const eval_ = evaluateGovernance({ ...ctx, trust_evaluation: trust });
    expect(eval_.trust_level).toBe(trust.trust_level);
    expect(eval_.trust_score).toBe(trust.trust_score);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. End-to-end safe execution scenarios
// ═══════════════════════════════════════════════════════════

describe("Runtime — safe execution scenarios", () => {
  it("draft task with green risk is potentially auto-executable", () => {
    const eval_ = evaluateGovernance({
      task_type: "document.draft",
      risk_level_hint: "green",
      approval_required: false,
    });
    if (eval_.decision === "allow") {
      expect(eval_.allowed_to_auto_execute).toBe(true);
    } else {
      expect(eval_.allowed_to_auto_execute).toBe(false);
    }
  });

  it("email task is never auto-executable", () => {
    const cases = [
      { task_type: "email.send" },
      { task_type: "send_email" },
      { task_type: "EMAIL.SEND" },
    ];
    for (const ctx of cases) {
      expect(isGovernanceAutoExecutable(ctx)).toBe(false);
    }
  });

  it("approval_required=true is never auto-executable", () => {
    expect(isGovernanceAutoExecutable({
      task_type: "document.draft",
      approval_required: true,
    })).toBe(false);
  });

  it("red risk level is never auto-executable", () => {
    expect(isGovernanceAutoExecutable({
      task_type: "document.draft",
      risk_level_hint: "red",
    })).toBe(false);
  });

  it("black risk level is never auto-executable", () => {
    expect(isGovernanceAutoExecutable({
      task_type: "document.draft",
      risk_level_hint: "black",
    })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. End-to-end blocked scenarios
// ═══════════════════════════════════════════════════════════

describe("Runtime — blocked execution scenarios", () => {
  const blockedCases: Array<{ label: string; ctx: PierreGovernanceContext }> = [
    { label: "harcèlement moral", ctx: { text_corpus: "harcèlement moral" } },
    { label: "discrimination", ctx: { text_corpus: "discrimination ethnique" } },
    { label: "violence", ctx: { text_corpus: "violence au travail" } },
    { label: "email.send", ctx: { task_type: "email.send" } },
    { label: "black risk", ctx: { risk_level_hint: "black" } },
    { label: "approval_required", ctx: { approval_required: true } },
    { label: "litige", ctx: { text_corpus: "litige prud'hommes" } },
  ];

  for (const { label, ctx } of blockedCases) {
    it(`blocks: ${label}`, () => {
      const eval_ = evaluateGovernance(ctx);
      expect(eval_.allowed_to_auto_execute).toBe(false);
      expect(eval_.requires_human).toBe(true);
    });
  }
});

// ═══════════════════════════════════════════════════════════
// 4. applyGovernanceToTask + filterGovernanceSafeToRun pipeline
// ═══════════════════════════════════════════════════════════

describe("Runtime — task annotation pipeline", () => {
  it("annotates a list of tasks and filters correctly", () => {
    const tasks = [
      { id: "t1", type: "document.draft", approval_required: false },
      { id: "t2", type: "email.send", approval_required: false },
      { id: "t3", type: "schedule.meeting", approval_required: false },
    ];

    // Use filterGovernanceSafeToRun with a getEvaluation function
    const evaluations = new Map(
      tasks.map((t) => [t.id, evaluateGovernance({ task_type: t.type, approval_required: t.approval_required })])
    );

    // email.send must be blocked
    const emailEval = evaluations.get("t2");
    expect(emailEval?.allowed_to_auto_execute).toBe(false);

    const safe = filterGovernanceSafeToRun(tasks, (t) => evaluations.get(t.id) ?? null);
    // email.send must not be in safe list
    expect(safe.every((t) => t.id !== "t2")).toBe(true);
  });

  it("safe list is a subset of original list", () => {
    const tasks = [
      { id: "a", type: "document.draft" },
      { id: "b", type: "email.send" },
      { id: "c", type: "document.review" },
    ];
    const safe = filterGovernanceSafeToRun(tasks, (t) => evaluateGovernance({ task_type: t.type }));
    for (const s of safe) {
      expect(tasks.find((t) => t.id === s.id)).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 5. buildGovernanceCard with full context
// ═══════════════════════════════════════════════════════════

describe("Runtime — buildGovernanceCard", () => {
  it("card reflects all three sub-decisions", () => {
    const ctx: PierreGovernanceContext = {
      task_type: "document.draft",
      risk_level_hint: "orange",
      approval_required: false,
      company_trust_score: 5,
    };
    const eval_ = evaluateGovernance(ctx);
    const card = buildGovernanceCard(eval_, ctx);
    expect(card.guard_decision).toBe(eval_.guard_decision);
    expect(card.policy_decision).toBe(eval_.policy_decision);
    expect(card.trust_decision).toBe(eval_.trust_decision);
    expect(card.trust_level).toBe(eval_.trust_level);
    expect(card.trust_score).toBe(eval_.trust_score);
  });

  it("card task_type and task_id are set from context", () => {
    const ctx: PierreGovernanceContext & { task_id?: string } = {
      task_type: "email.send",
      mission_id: "m-123",
    };
    const eval_ = evaluateGovernance(ctx);
    const card = buildGovernanceCard(eval_, ctx);
    expect(card.task_type).toBe("email.send");
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Worst-decision propagation through full stack
// ═══════════════════════════════════════════════════════════

describe("Runtime — worst-decision propagation", () => {
  it("policy refuse overrides trust auto_allowed", () => {
    const ctx: PierreGovernanceContext = {
      task_type: "document.draft",
      text_corpus: "harcèlement moral",
      company_trust_score: 25,
      historical_success_rate: 1.0,
      autonomy_level: "high_trust",
    };
    const eval_ = evaluateGovernance(ctx);
    expect(eval_.decision).toBe("refuse");
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("guard block overrides trust auto_allowed", () => {
    const guardEval = evaluatePierreCloneGuard({ task_type: "email.send" });
    const eval_ = evaluateGovernance({
      task_type: "email.send",
      guard_evaluation: guardEval,
      company_trust_score: 25,
      autonomy_level: "high_trust",
    });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("require_approval from policy beats allow from guard", () => {
    const ctx: PierreGovernanceContext = {
      approval_required: true,
      risk_level_hint: "green",
    };
    const eval_ = evaluateGovernance(ctx);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Pre-computed vs computed equivalence
// ═══════════════════════════════════════════════════════════

describe("Runtime — pre-computed evaluation equivalence", () => {
  const testCases: Array<PierreGovernanceContext> = [
    { task_type: "document.draft", risk_level_hint: "green" },
    { task_type: "email.send" },
    { text_corpus: "harcèlement moral" },
    { approval_required: true, risk_level_hint: "red" },
    { company_trust_score: 20, historical_success_rate: 0.95 },
  ];

  for (const ctx of testCases) {
    it(`same result with/without pre-computed for: ${JSON.stringify(ctx)}`, () => {
      // Build pre-computed evals with proper sub-decisions passed to trust
      const guardEval = evaluatePierreCloneGuard(ctx as Parameters<typeof evaluatePierreCloneGuard>[0]);
      const policyEval = evaluatePierreClonePolicy(ctx as Parameters<typeof evaluatePierreClonePolicy>[0]);
      const trustEval = evaluatePierreCloneTrust({
        ...(ctx as Parameters<typeof evaluatePierreCloneTrust>[0]),
        cloneguard_decision: guardEval.decision,
        clonepolicy_decision: policyEval.decision,
      });

      const withPrecomputed = evaluateGovernance({
        ...ctx,
        guard_evaluation: guardEval,
        policy_evaluation: policyEval,
        trust_evaluation: trustEval,
      });
      const withoutPrecomputed = evaluateGovernance(ctx);

      expect(withPrecomputed.decision).toBe(withoutPrecomputed.decision);
      expect(withPrecomputed.allowed_to_auto_execute).toBe(withoutPrecomputed.allowed_to_auto_execute);
      expect(withPrecomputed.risk_level).toBe(withoutPrecomputed.risk_level);
    });
  }
});
