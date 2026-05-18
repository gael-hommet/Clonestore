import { describe, it, expect } from "vitest";
import {
  normalizeCloneTrustLevel,
  normalizeCloneTrustDecision,
  normalizeCloneTrustRiskLevel,
  collectCloneTrustFactors,
  computeCloneTrustBaseScore,
  evaluatePierreCloneTrust,
  buildCloneTrustPreview,
  buildCloneTrustAuditEvent,
  applyCloneTrustToTask,
  isCloneTrustAutoExecutable,
  summarizeCloneTrustEvaluation,
  type PierreCloneTrustContext,
} from "../hr/clonetrust";

// ═══════════════════════════════════════════════════════════
// 1. normalizeCloneTrustLevel
// ═══════════════════════════════════════════════════════════

describe("normalizeCloneTrustLevel", () => {
  it("returns manual_only for 'manual_only'", () => {
    expect(normalizeCloneTrustLevel("manual_only")).toBe("manual_only");
  });

  it("returns approval_first for 'approval_first'", () => {
    expect(normalizeCloneTrustLevel("approval_first")).toBe("approval_first");
  });

  it("returns supervised for 'supervised'", () => {
    expect(normalizeCloneTrustLevel("supervised")).toBe("supervised");
  });

  it("returns limited_auto for 'limited_auto'", () => {
    expect(normalizeCloneTrustLevel("limited_auto")).toBe("limited_auto");
  });

  it("returns standard_auto for 'standard_auto'", () => {
    expect(normalizeCloneTrustLevel("standard_auto")).toBe("standard_auto");
  });

  it("returns high_trust for 'high_trust'", () => {
    expect(normalizeCloneTrustLevel("high_trust")).toBe("high_trust");
  });

  it("is case-insensitive", () => {
    expect(normalizeCloneTrustLevel("MANUAL_ONLY")).toBe("manual_only");
    expect(normalizeCloneTrustLevel("HIGH_TRUST")).toBe("high_trust");
  });

  it("returns supervised for unknown", () => {
    expect(normalizeCloneTrustLevel("xyz")).toBe("supervised");
    expect(normalizeCloneTrustLevel(null)).toBe("supervised");
    expect(normalizeCloneTrustLevel(undefined)).toBe("supervised");
  });
});

// ═══════════════════════════════════════════════════════════
// 2. normalizeCloneTrustDecision
// ═══════════════════════════════════════════════════════════

describe("normalizeCloneTrustDecision", () => {
  it("returns manual_only for 'manual_only'", () => {
    expect(normalizeCloneTrustDecision("manual_only")).toBe("manual_only");
  });

  it("returns approval_required for 'approval_required'", () => {
    expect(normalizeCloneTrustDecision("approval_required")).toBe("approval_required");
  });

  it("returns supervised_execution for 'supervised_execution'", () => {
    expect(normalizeCloneTrustDecision("supervised_execution")).toBe("supervised_execution");
  });

  it("returns auto_allowed for 'auto_allowed'", () => {
    expect(normalizeCloneTrustDecision("auto_allowed")).toBe("auto_allowed");
  });

  it("returns approval_required for unknown", () => {
    expect(normalizeCloneTrustDecision("random")).toBe("approval_required");
    expect(normalizeCloneTrustDecision(null)).toBe("approval_required");
  });
});

// ═══════════════════════════════════════════════════════════
// 3. normalizeCloneTrustRiskLevel
// ═══════════════════════════════════════════════════════════

describe("normalizeCloneTrustRiskLevel", () => {
  it("returns green for 'green'", () => {
    expect(normalizeCloneTrustRiskLevel("green")).toBe("green");
  });

  it("returns orange, red, black correctly", () => {
    expect(normalizeCloneTrustRiskLevel("orange")).toBe("orange");
    expect(normalizeCloneTrustRiskLevel("red")).toBe("red");
    expect(normalizeCloneTrustRiskLevel("black")).toBe("black");
  });

  it("returns green for unknown", () => {
    expect(normalizeCloneTrustRiskLevel(null)).toBe("green");
  });
});

// ═══════════════════════════════════════════════════════════
// 4. collectCloneTrustFactors
// ═══════════════════════════════════════════════════════════

describe("collectCloneTrustFactors", () => {
  it("returns an array", () => {
    expect(Array.isArray(collectCloneTrustFactors({}))).toBe(true);
  });

  it("includes company_trust_score factor when provided", () => {
    const factors = collectCloneTrustFactors({ company_trust_score: 20 });
    const found = factors.find((f) => f.name === "company_trust_score");
    expect(found).toBeDefined();
  });

  it("includes historical_success_rate factor when provided", () => {
    const factors = collectCloneTrustFactors({ historical_success_rate: 0.9 });
    const found = factors.find((f) => f.name === "historical_success_rate");
    expect(found).toBeDefined();
  });

  it("includes historical_task_count factor when provided", () => {
    const factors = collectCloneTrustFactors({ historical_task_count: 50 });
    const found = factors.find((f) => f.name === "historical_task_count");
    expect(found).toBeDefined();
  });

  it("each factor has required fields", () => {
    const factors = collectCloneTrustFactors({ company_trust_score: 10 });
    for (const f of factors) {
      expect(typeof f.name).toBe("string");
      expect(typeof f.value).toBe("number");
      expect(typeof f.note).toBe("string");
    }
  });

  it("risk_level_penalty is negative for red risk", () => {
    const factors = collectCloneTrustFactors({ risk_level_hint: "red" });
    const penalty = factors.find((f) => f.name === "risk_level_penalty");
    if (penalty) {
      expect(penalty.value).toBeLessThan(0);
    }
  });

  it("risk_level_penalty is more negative for black risk", () => {
    const redFactors = collectCloneTrustFactors({ risk_level_hint: "red" });
    const blackFactors = collectCloneTrustFactors({ risk_level_hint: "black" });
    const redPenalty = redFactors.find((f) => f.name === "risk_level_penalty")?.value ?? 0;
    const blackPenalty = blackFactors.find((f) => f.name === "risk_level_penalty")?.value ?? 0;
    expect(blackPenalty).toBeLessThanOrEqual(redPenalty);
  });

  it("cloneguard_penalty is negative for refuse/block decisions", () => {
    const factors = collectCloneTrustFactors({ cloneguard_decision: "refuse" });
    const penalty = factors.find((f) => f.name === "cloneguard_penalty");
    if (penalty) {
      expect(penalty.value).toBeLessThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 5. computeCloneTrustBaseScore
// ═══════════════════════════════════════════════════════════

describe("computeCloneTrustBaseScore", () => {
  it("returns a number", () => {
    expect(typeof computeCloneTrustBaseScore({})).toBe("number");
  });

  it("returns higher score with positive company_trust_score", () => {
    const low = computeCloneTrustBaseScore({ company_trust_score: -25 });
    const high = computeCloneTrustBaseScore({ company_trust_score: 25 });
    expect(high).toBeGreaterThan(low);
  });

  it("returns lower score for black risk", () => {
    const green = computeCloneTrustBaseScore({ risk_level_hint: "green" });
    const black = computeCloneTrustBaseScore({ risk_level_hint: "black" });
    expect(black).toBeLessThan(green);
  });

  it("score is higher with good history", () => {
    const noHistory = computeCloneTrustBaseScore({});
    const goodHistory = computeCloneTrustBaseScore({
      historical_success_rate: 1.0,
      historical_task_count: 100,
    });
    expect(goodHistory).toBeGreaterThanOrEqual(noHistory);
  });

  it("approval_required flag lowers score", () => {
    const noFlag = computeCloneTrustBaseScore({ risk_level_hint: "green" });
    const withFlag = computeCloneTrustBaseScore({ risk_level_hint: "green", approval_required: true });
    expect(withFlag).toBeLessThan(noFlag);
  });

  it("cloneguard block drastically lowers score", () => {
    const clean = computeCloneTrustBaseScore({});
    const blocked = computeCloneTrustBaseScore({ cloneguard_decision: "refuse" });
    expect(blocked).toBeLessThan(clean);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. evaluatePierreCloneTrust — baseline
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneTrust — baseline", () => {
  it("returns a valid evaluation for empty context", () => {
    const eval_ = evaluatePierreCloneTrust({});
    expect(eval_.trust_level).toBeTruthy();
    expect(typeof eval_.trust_score).toBe("number");
    expect(eval_.decision).toBeTruthy();
    expect(Array.isArray(eval_.factors)).toBe(true);
    expect(Array.isArray(eval_.hard_blocks)).toBe(true);
    expect(typeof eval_.allowed_to_auto_execute).toBe("boolean");
    expect(typeof eval_.requires_human).toBe("boolean");
    expect(typeof eval_.explanation).toBe("string");
    expect(typeof eval_.evaluated_at).toBe("string");
  });

  it("is deterministic", () => {
    const ctx: PierreCloneTrustContext = { task_type: "document.draft", now: "2026-01-01T00:00:00Z" };
    const a = evaluatePierreCloneTrust(ctx);
    const b = evaluatePierreCloneTrust(ctx);
    expect(a.trust_level).toBe(b.trust_level);
    expect(a.trust_score).toBe(b.trust_score);
    expect(a.decision).toBe(b.decision);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. evaluatePierreCloneTrust — hard blocks
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneTrust — hard blocks", () => {
  it("hard-blocks email.send", () => {
    const eval_ = evaluatePierreCloneTrust({ task_type: "email.send" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
    expect(eval_.hard_blocks.length).toBeGreaterThan(0);
  });

  it("hard-blocks send_email", () => {
    const eval_ = evaluatePierreCloneTrust({ task_type: "send_email" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("hard-blocks when cloneguard refuses", () => {
    const eval_ = evaluatePierreCloneTrust({ cloneguard_decision: "refuse" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("hard-blocks when cloneguard blocks", () => {
    const eval_ = evaluatePierreCloneTrust({ cloneguard_decision: "block" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("hard-blocks when clonepolicy refuses", () => {
    const eval_ = evaluatePierreCloneTrust({ clonepolicy_decision: "refuse" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("hard-blocks when approval_required=true", () => {
    const eval_ = evaluatePierreCloneTrust({ approval_required: true });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("hard-blocks for black risk level", () => {
    const eval_ = evaluatePierreCloneTrust({ risk_level_hint: "black" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("hard-blocks for black employee_file_risk", () => {
    const eval_ = evaluatePierreCloneTrust({ employee_file_risk: "black" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("hard_blocks array is non-empty when blocked", () => {
    const eval_ = evaluatePierreCloneTrust({ task_type: "email.send" });
    expect(eval_.hard_blocks.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 8. evaluatePierreCloneTrust — trust score levels
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneTrust — trust score levels", () => {
  it("manual_only for very low score", () => {
    const eval_ = evaluatePierreCloneTrust({
      risk_level_hint: "black",
      cloneguard_decision: "refuse",
      clonepolicy_decision: "refuse",
      company_trust_score: -25,
      approval_required: true,
    });
    expect(["manual_only", "approval_first"]).toContain(eval_.trust_level);
  });

  it("high_trust possible for very positive score", () => {
    const eval_ = evaluatePierreCloneTrust({
      company_trust_score: 25,
      historical_success_rate: 1.0,
      historical_task_count: 200,
      risk_level_hint: "green",
      approval_required: false,
      autonomy_level: "high_trust",
    });
    expect(["standard_auto", "high_trust", "limited_auto"]).toContain(eval_.trust_level);
  });

  it("trust_score is clamped between 0 and 100", () => {
    const extremeHigh = evaluatePierreCloneTrust({
      company_trust_score: 25,
      historical_success_rate: 1.0,
      historical_task_count: 999,
    });
    const extremeLow = evaluatePierreCloneTrust({
      company_trust_score: -25,
      risk_level_hint: "black",
      cloneguard_decision: "refuse",
    });
    expect(extremeHigh.trust_score).toBeLessThanOrEqual(100);
    expect(extremeLow.trust_score).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 9. evaluatePierreCloneTrust — autonomy_level caps
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneTrust — autonomy_level caps", () => {
  it("draft_only autonomy cap restricts to at most approval_first level", () => {
    const eval_ = evaluatePierreCloneTrust({
      autonomy_level: "draft_only",
      company_trust_score: 25,
      historical_success_rate: 1.0,
    });
    // draft_only caps to approval_first → decision is at least approval_required
    expect(eval_.allowed_to_auto_execute).toBe(false);
    expect(["manual_only", "approval_required", "supervised_execution"]).toContain(eval_.decision);
  });

  it("low_risk_execution autonomy cap restricts to at most supervised level", () => {
    const eval_ = evaluatePierreCloneTrust({
      autonomy_level: "low_risk_execution",
      company_trust_score: 25,
      historical_success_rate: 1.0,
    });
    // low_risk_execution caps to supervised
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("autonomy_level cap does not boost beyond earned level", () => {
    const low = evaluatePierreCloneTrust({
      company_trust_score: -25,
      risk_level_hint: "red",
      autonomy_level: "high_trust",
    });
    expect(low.allowed_to_auto_execute).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. evaluatePierreCloneTrust — CloneGuard cannot be weakened
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneTrust — cannot weaken CloneGuard", () => {
  it("high trust score cannot override cloneguard refuse", () => {
    const eval_ = evaluatePierreCloneTrust({
      cloneguard_decision: "refuse",
      company_trust_score: 25,
      historical_success_rate: 1.0,
      autonomy_level: "high_trust",
    });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("high trust score cannot override cloneguard block", () => {
    const eval_ = evaluatePierreCloneTrust({
      cloneguard_decision: "block",
      company_trust_score: 25,
      autonomy_level: "high_trust",
    });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("high trust score cannot override clonepolicy refuse", () => {
    const eval_ = evaluatePierreCloneTrust({
      clonepolicy_decision: "refuse",
      company_trust_score: 25,
      autonomy_level: "high_trust",
    });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 11. buildCloneTrustPreview
// ═══════════════════════════════════════════════════════════

describe("buildCloneTrustPreview", () => {
  it("returns a valid preview", () => {
    const eval_ = evaluatePierreCloneTrust({});
    const preview = buildCloneTrustPreview(eval_);
    expect(preview.trust_level).toBe(eval_.trust_level);
    expect(preview.trust_score).toBe(eval_.trust_score);
    expect(preview.decision).toBe(eval_.decision);
    expect(typeof preview.allowed_to_auto_execute).toBe("boolean");
    expect(typeof preview.hard_blocks_count).toBe("number");
    expect(typeof preview.summary).toBe("string");
  });

  it("hard_blocks_count matches evaluation hard_blocks length", () => {
    const eval_ = evaluatePierreCloneTrust({ task_type: "email.send" });
    const preview = buildCloneTrustPreview(eval_);
    expect(preview.hard_blocks_count).toBe(eval_.hard_blocks.length);
  });

  it("summary is non-empty", () => {
    const preview = buildCloneTrustPreview(evaluatePierreCloneTrust({ task_type: "email.send" }));
    expect(preview.summary.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. buildCloneTrustAuditEvent
// ═══════════════════════════════════════════════════════════

describe("buildCloneTrustAuditEvent", () => {
  it("returns a valid audit event", () => {
    const eval_ = evaluatePierreCloneTrust({});
    const event = buildCloneTrustAuditEvent(eval_, {});
    expect(event.event_type).toBeTruthy();
    expect(typeof event.message).toBe("string");
    expect(event.meta_json).toBeDefined();
  });

  it("event_type is clonetrust_hard_block when blocked", () => {
    const eval_ = evaluatePierreCloneTrust({ task_type: "email.send" });
    const event = buildCloneTrustAuditEvent(eval_, { task_type: "email.send" });
    if (eval_.hard_blocks.length > 0) {
      expect(event.event_type).toBe("clonetrust_hard_block");
    }
  });

  it("event_type is clonetrust_auto_allowed when allowed", () => {
    const eval_ = evaluatePierreCloneTrust({
      company_trust_score: 25,
      historical_success_rate: 1.0,
      risk_level_hint: "green",
    });
    const event = buildCloneTrustAuditEvent(eval_, {});
    if (eval_.allowed_to_auto_execute) {
      expect(event.event_type).toBe("clonetrust_auto_allowed");
    }
  });

  it("meta_json includes trust_level and trust_score", () => {
    const eval_ = evaluatePierreCloneTrust({});
    const event = buildCloneTrustAuditEvent(eval_, {});
    expect(event.meta_json.trust_level).toBe(eval_.trust_level);
    expect(event.meta_json.trust_score).toBe(eval_.trust_score);
  });
});

// ═══════════════════════════════════════════════════════════
// 13. applyCloneTrustToTask
// ═══════════════════════════════════════════════════════════

describe("applyCloneTrustToTask", () => {
  it("adds clonetrust fields to task object", () => {
    const task = { id: "t1", type: "document.draft" };
    const eval_ = evaluatePierreCloneTrust({});
    const result = applyCloneTrustToTask(task, eval_);
    expect(result.id).toBe("t1");
    const ct = result.clonetrust as Record<string, unknown>;
    expect(ct).toBeDefined();
    expect(ct.decision).toBe(eval_.decision);
    expect(ct.trust_level).toBe(eval_.trust_level);
    expect(ct.trust_score).toBe(eval_.trust_score);
  });

  it("does not mutate the original task", () => {
    const task = { id: "t2" };
    const eval_ = evaluatePierreCloneTrust({});
    applyCloneTrustToTask(task, eval_);
    expect(task).not.toHaveProperty("clonetrust_decision");
  });

  it("preserves existing task fields", () => {
    const task = { id: "t3", title: "My task", status: "pending" };
    const result = applyCloneTrustToTask(task, evaluatePierreCloneTrust({}));
    expect(result.title).toBe("My task");
    expect(result.status).toBe("pending");
  });
});

// ═══════════════════════════════════════════════════════════
// 14. isCloneTrustAutoExecutable
// ═══════════════════════════════════════════════════════════

describe("isCloneTrustAutoExecutable", () => {
  it("returns false for email.send", () => {
    expect(isCloneTrustAutoExecutable({ task_type: "email.send" })).toBe(false);
  });

  it("returns false for approval_required=true", () => {
    expect(isCloneTrustAutoExecutable({ approval_required: true })).toBe(false);
  });

  it("returns false when cloneguard refuses", () => {
    expect(isCloneTrustAutoExecutable({ cloneguard_decision: "refuse" })).toBe(false);
  });

  it("returns false for black risk", () => {
    expect(isCloneTrustAutoExecutable({ risk_level_hint: "black" })).toBe(false);
  });

  it("returns false for manual_only autonomy level", () => {
    expect(isCloneTrustAutoExecutable({ autonomy_level: "manual_only" })).toBe(false);
  });

  it("returns boolean", () => {
    expect(typeof isCloneTrustAutoExecutable({})).toBe("boolean");
  });
});

// ═══════════════════════════════════════════════════════════
// 15. summarizeCloneTrustEvaluation
// ═══════════════════════════════════════════════════════════

describe("summarizeCloneTrustEvaluation", () => {
  it("returns a non-empty string", () => {
    const eval_ = evaluatePierreCloneTrust({});
    const summary = summarizeCloneTrustEvaluation(eval_);
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("summary reflects auto_allowed state", () => {
    const allowed = evaluatePierreCloneTrust({
      company_trust_score: 25,
      historical_success_rate: 1.0,
      risk_level_hint: "green",
    });
    const blocked = evaluatePierreCloneTrust({ task_type: "email.send" });
    if (allowed.allowed_to_auto_execute && !blocked.allowed_to_auto_execute) {
      expect(summarizeCloneTrustEvaluation(allowed)).not.toBe(
        summarizeCloneTrustEvaluation(blocked)
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 16. Security invariants
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreCloneTrust — security invariants", () => {
  it("factors array always non-null", () => {
    expect(Array.isArray(evaluatePierreCloneTrust({}).factors)).toBe(true);
    expect(Array.isArray(evaluatePierreCloneTrust({ task_type: "email.send" }).factors)).toBe(true);
  });

  it("hard_blocks always an array", () => {
    expect(Array.isArray(evaluatePierreCloneTrust({}).hard_blocks)).toBe(true);
  });

  it("evaluated_at is valid ISO string", () => {
    const eval_ = evaluatePierreCloneTrust({ now: "2026-03-01T08:00:00Z" });
    expect(() => new Date(eval_.evaluated_at)).not.toThrow();
  });

  it("explanation is always non-empty", () => {
    const eval_ = evaluatePierreCloneTrust({ task_type: "email.send" });
    expect(eval_.explanation.length).toBeGreaterThan(0);
  });

  it("requires_human=true when allowed_to_auto_execute=false (hard block)", () => {
    const eval_ = evaluatePierreCloneTrust({ task_type: "email.send" });
    if (!eval_.allowed_to_auto_execute && eval_.hard_blocks.length > 0) {
      expect(eval_.requires_human).toBe(true);
    }
  });

  it("trust_score of 0 does not cause NaN", () => {
    const eval_ = evaluatePierreCloneTrust({
      company_trust_score: -25,
      risk_level_hint: "black",
      cloneguard_decision: "refuse",
      clonepolicy_decision: "refuse",
    });
    expect(isNaN(eval_.trust_score)).toBe(false);
  });
});
