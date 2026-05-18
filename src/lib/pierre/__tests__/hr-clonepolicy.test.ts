import { describe, it, expect } from "vitest";
import {
  normalizeClonePolicyDecision,
  normalizeClonePolicyRiskLevel,
  normalizeClonePolicySeverity,
  normalizeClonePolicyScope,
  collectClonePolicyText,
  buildDefaultClonePolicyRules,
  evaluatePierreClonePolicy,
  buildClonePolicyPreview,
  buildClonePolicyAuditEvent,
  applyClonePolicyToTask,
  isClonePolicyAutoExecutable,
  summarizeClonePolicyEvaluation,
  type PierreClonePolicyDecision,
  type PierreClonePolicyContext,
} from "../hr/clonepolicy";

// ═══════════════════════════════════════════════════════════
// 1. normalizeClonePolicyDecision
// ═══════════════════════════════════════════════════════════

describe("normalizeClonePolicyDecision", () => {
  it("returns allow for 'allow'", () => {
    expect(normalizeClonePolicyDecision("allow")).toBe("allow");
  });

  it("returns allow_with_warning for 'allow_with_warning'", () => {
    expect(normalizeClonePolicyDecision("allow_with_warning")).toBe("allow_with_warning");
  });

  it("returns require_approval for 'require_approval'", () => {
    expect(normalizeClonePolicyDecision("require_approval")).toBe("require_approval");
  });

  it("returns block for 'block'", () => {
    expect(normalizeClonePolicyDecision("block")).toBe("block");
  });

  it("returns refuse for 'refuse'", () => {
    expect(normalizeClonePolicyDecision("refuse")).toBe("refuse");
  });

  it("is case-insensitive", () => {
    expect(normalizeClonePolicyDecision("ALLOW")).toBe("allow");
    expect(normalizeClonePolicyDecision("BLOCK")).toBe("block");
    expect(normalizeClonePolicyDecision("REFUSE")).toBe("refuse");
  });

  it("returns allow_with_warning for unknown string", () => {
    expect(normalizeClonePolicyDecision("random")).toBe("allow_with_warning");
    expect(normalizeClonePolicyDecision("")).toBe("allow_with_warning");
  });

  it("returns allow_with_warning for null", () => {
    expect(normalizeClonePolicyDecision(null)).toBe("allow_with_warning");
  });

  it("returns allow_with_warning for undefined", () => {
    expect(normalizeClonePolicyDecision(undefined)).toBe("allow_with_warning");
  });

  it("returns allow_with_warning for number", () => {
    expect(normalizeClonePolicyDecision(42)).toBe("allow_with_warning");
  });
});

// ═══════════════════════════════════════════════════════════
// 2. normalizeClonePolicyRiskLevel
// ═══════════════════════════════════════════════════════════

describe("normalizeClonePolicyRiskLevel", () => {
  it("returns green for 'green'", () => {
    expect(normalizeClonePolicyRiskLevel("green")).toBe("green");
  });

  it("returns orange for 'orange'", () => {
    expect(normalizeClonePolicyRiskLevel("orange")).toBe("orange");
  });

  it("returns red for 'red'", () => {
    expect(normalizeClonePolicyRiskLevel("red")).toBe("red");
  });

  it("returns black for 'black'", () => {
    expect(normalizeClonePolicyRiskLevel("black")).toBe("black");
  });

  it("is case-insensitive", () => {
    expect(normalizeClonePolicyRiskLevel("GREEN")).toBe("green");
    expect(normalizeClonePolicyRiskLevel("RED")).toBe("red");
  });

  it("returns green for unknown", () => {
    expect(normalizeClonePolicyRiskLevel("unknown")).toBe("green");
    expect(normalizeClonePolicyRiskLevel(null)).toBe("green");
  });
});

// ═══════════════════════════════════════════════════════════
// 3. normalizeClonePolicySeverity
// ═══════════════════════════════════════════════════════════

describe("normalizeClonePolicySeverity", () => {
  it("returns info for 'info'", () => {
    expect(normalizeClonePolicySeverity("info")).toBe("info");
  });

  it("returns warning for 'warning'", () => {
    expect(normalizeClonePolicySeverity("warning")).toBe("warning");
  });

  it("returns approval_required for 'approval_required'", () => {
    expect(normalizeClonePolicySeverity("approval_required")).toBe("approval_required");
  });

  it("returns blocked for 'blocked'", () => {
    expect(normalizeClonePolicySeverity("blocked")).toBe("blocked");
  });

  it("returns refused for 'refused'", () => {
    expect(normalizeClonePolicySeverity("refused")).toBe("refused");
  });

  it("returns warning for unknown", () => {
    expect(normalizeClonePolicySeverity("xyz")).toBe("warning");
    expect(normalizeClonePolicySeverity(null)).toBe("warning");
  });
});

// ═══════════════════════════════════════════════════════════
// 4. normalizeClonePolicyScope
// ═══════════════════════════════════════════════════════════

describe("normalizeClonePolicyScope", () => {
  it("returns global for 'global'", () => {
    expect(normalizeClonePolicyScope("global")).toBe("global");
  });

  it("returns domain for 'domain'", () => {
    expect(normalizeClonePolicyScope("domain")).toBe("domain");
  });

  it("returns task_type for 'task_type'", () => {
    expect(normalizeClonePolicyScope("task_type")).toBe("task_type");
  });

  it("returns employee for 'employee'", () => {
    expect(normalizeClonePolicyScope("employee")).toBe("employee");
  });

  it("returns site for 'site'", () => {
    expect(normalizeClonePolicyScope("site")).toBe("site");
  });

  it("returns department for 'department'", () => {
    expect(normalizeClonePolicyScope("department")).toBe("department");
  });

  it("returns global for unknown", () => {
    expect(normalizeClonePolicyScope("xyz")).toBe("global");
    expect(normalizeClonePolicyScope(null)).toBe("global");
  });
});

// ═══════════════════════════════════════════════════════════
// 5. collectClonePolicyText
// ═══════════════════════════════════════════════════════════

describe("collectClonePolicyText", () => {
  it("returns empty string for empty context", () => {
    const result = collectClonePolicyText({});
    expect(typeof result).toBe("string");
  });

  it("includes task_type", () => {
    expect(collectClonePolicyText({ task_type: "email.send" })).toContain("email.send");
  });

  it("includes task_title", () => {
    expect(collectClonePolicyText({ task_title: "Draft contract" })).toContain("draft contract");
  });

  it("strips diacritics", () => {
    const result = collectClonePolicyText({ task_title: "Harcèlement" });
    expect(result).not.toContain("è");
    expect(result).toContain("harcelement");
  });

  it("lowercases all text", () => {
    expect(collectClonePolicyText({ task_type: "EMAIL.SEND" })).toBe("email.send");
  });

  it("includes text_corpus", () => {
    expect(collectClonePolicyText({ text_corpus: "sensitive data" })).toContain("sensitive data");
  });

  it("includes domain", () => {
    expect(collectClonePolicyText({ domain: "contract" })).toContain("contract");
  });

  it("includes mission_summary", () => {
    expect(collectClonePolicyText({ mission_summary: "Raise salary" })).toContain("raise salary");
  });

  it("handles null fields gracefully", () => {
    expect(() => collectClonePolicyText({ task_type: null, task_title: null })).not.toThrow();
  });

  it("includes payload_json string values", () => {
    const result = collectClonePolicyText({
      payload_json: { subject: "licenciement motif" },
    });
    expect(result).toContain("licenciement motif");
  });

  it("returns empty string for null context", () => {
    expect(collectClonePolicyText(null as unknown as PierreClonePolicyContext)).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════
// 6. buildDefaultClonePolicyRules
// ═══════════════════════════════════════════════════════════

describe("buildDefaultClonePolicyRules", () => {
  it("returns an array", () => {
    expect(Array.isArray(buildDefaultClonePolicyRules())).toBe(true);
  });

  it("returns at least 15 rules", () => {
    expect(buildDefaultClonePolicyRules().length).toBeGreaterThanOrEqual(15);
  });

  it("each rule has required fields", () => {
    for (const rule of buildDefaultClonePolicyRules()) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.decision).toBeTruthy();
      expect(rule.risk_level).toBeTruthy();
      expect(rule.severity).toBeTruthy();
      expect(rule.source).toBeTruthy();
      expect(rule.scope).toBeTruthy();
      expect(typeof rule.priority).toBe("number");
      expect(rule.condition).toBeDefined();
    }
  });

  it("includes a harcèlement rule", () => {
    const rules = buildDefaultClonePolicyRules();
    const harcel = rules.find((r) => r.id === "policy_harcelement_refuse");
    expect(harcel).toBeDefined();
    expect(harcel?.decision).toBe("refuse");
  });

  it("includes a discrimination rule", () => {
    const rules = buildDefaultClonePolicyRules();
    const disc = rules.find((r) => r.id === "policy_discrimination_refuse");
    expect(disc).toBeDefined();
    expect(disc?.decision).toBe("refuse");
  });

  it("has unique rule ids", () => {
    const rules = buildDefaultClonePolicyRules();
    const ids = rules.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("system rules cannot be overridden", () => {
    const systemRules = buildDefaultClonePolicyRules().filter((r) => r.source === "system");
    for (const r of systemRules) {
      expect(r.can_override).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 7. evaluatePierreClonePolicy — baseline
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreClonePolicy — baseline", () => {
  it("returns a valid evaluation for empty context", () => {
    const eval_ = evaluatePierreClonePolicy({});
    expect(eval_.decision).toBeTruthy();
    expect(eval_.risk_level).toBeTruthy();
    expect(Array.isArray(eval_.matched_rules)).toBe(true);
    expect(typeof eval_.allowed_to_auto_execute).toBe("boolean");
    expect(typeof eval_.requires_human).toBe("boolean");
    expect(typeof eval_.explanation).toBe("string");
    expect(typeof eval_.evaluated_at).toBe("string");
  });

  it("returns allow for a safe context", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "document.draft",
      task_title: "Draft employment contract",
      domain: "contract",
    });
    expect(["allow", "allow_with_warning"]).toContain(eval_.decision);
  });

  it("is deterministic", () => {
    const ctx: PierreClonePolicyContext = { task_type: "document.draft", now: "2026-01-01T00:00:00Z" };
    const a = evaluatePierreClonePolicy(ctx);
    const b = evaluatePierreClonePolicy(ctx);
    expect(a.decision).toBe(b.decision);
    expect(a.risk_level).toBe(b.risk_level);
  });
});

// ═══════════════════════════════════════════════════════════
// 8. evaluatePierreClonePolicy — REFUSE triggers
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreClonePolicy — REFUSE triggers", () => {
  it("refuses on harcèlement keyword", () => {
    const eval_ = evaluatePierreClonePolicy({ text_corpus: "cas de harcèlement sexuel" });
    expect(eval_.decision).toBe("refuse");
    expect(eval_.allowed_to_auto_execute).toBe(false);
    expect(eval_.requires_human).toBe(true);
  });

  it("refuses on discrimination keyword", () => {
    const eval_ = evaluatePierreClonePolicy({ text_corpus: "discrimination ethnique" });
    expect(eval_.decision).toBe("refuse");
  });

  it("refuses on violence keyword", () => {
    const eval_ = evaluatePierreClonePolicy({ text_corpus: "violence au travail" });
    expect(eval_.decision).toBe("refuse");
  });

  it("requires approval on licenciement abusif keyword", () => {
    const eval_ = evaluatePierreClonePolicy({ text_corpus: "licenciement abusif contesté" });
    expect(["require_approval", "block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("blocks on judiciaire keyword", () => {
    const eval_ = evaluatePierreClonePolicy({ text_corpus: "procédure judiciaire en cours" });
    expect(["block", "refuse"]).toContain(eval_.decision);
  });

  it("refuses on prud'hommes keyword", () => {
    const eval_ = evaluatePierreClonePolicy({ text_corpus: "conseil des prud'hommes" });
    expect(eval_.decision).toBe("refuse");
  });

  it("all refuse decisions have allowed_to_auto_execute=false", () => {
    const cases = [
      { text_corpus: "harcèlement moral" },
      { text_corpus: "discrimination directe" },
      { text_corpus: "violences physiques" },
    ];
    for (const ctx of cases) {
      const eval_ = evaluatePierreClonePolicy(ctx);
      expect(eval_.decision).toBe("refuse");
      expect(eval_.allowed_to_auto_execute).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 9. evaluatePierreClonePolicy — BLOCK triggers
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreClonePolicy — BLOCK triggers", () => {
  it("blocks email.send task type", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "email.send" });
    expect(["block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("blocks send_email task type", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "send_email" });
    expect(["block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("blocks black risk level", () => {
    const eval_ = evaluatePierreClonePolicy({ risk_level_hint: "black" });
    expect(["block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("all block decisions have allowed_to_auto_execute=false", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "email.send" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
    expect(eval_.requires_human).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. evaluatePierreClonePolicy — REQUIRE_APPROVAL triggers
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreClonePolicy — REQUIRE_APPROVAL triggers", () => {
  it("requires approval when approval_required=true", () => {
    const eval_ = evaluatePierreClonePolicy({ approval_required: true });
    expect(["require_approval", "block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval for red risk level", () => {
    const eval_ = evaluatePierreClonePolicy({ risk_level_hint: "red" });
    expect(["require_approval", "block", "refuse"]).toContain(eval_.decision);
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("requires approval for licenciement task type", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "licenciement" });
    expect(["require_approval", "block", "refuse"]).toContain(eval_.decision);
  });

  it("requires_human is true for require_approval", () => {
    const eval_ = evaluatePierreClonePolicy({ approval_required: true });
    expect(eval_.requires_human).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 11. evaluatePierreClonePolicy — worst decision wins
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreClonePolicy — worst decision wins", () => {
  it("returns refuse when context has both refuse and block signals", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "email.send",
      text_corpus: "harcèlement moral signalé",
    });
    expect(eval_.decision).toBe("refuse");
  });

  it("returns block over allow_with_warning", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "email.send",
      risk_level_hint: "orange",
    });
    expect(["block", "refuse"]).toContain(eval_.decision);
  });

  it("returns require_approval over allow_with_warning", () => {
    const eval_ = evaluatePierreClonePolicy({
      approval_required: true,
      risk_level_hint: "orange",
    });
    expect(["require_approval", "block", "refuse"]).toContain(eval_.decision);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. evaluatePierreClonePolicy — allowed_to_auto_execute
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreClonePolicy — allowed_to_auto_execute", () => {
  it("is false for refuse decision", () => {
    const eval_ = evaluatePierreClonePolicy({ text_corpus: "harcèlement moral" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("is false for block decision", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "email.send" });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("is false for require_approval decision", () => {
    const eval_ = evaluatePierreClonePolicy({ approval_required: true });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("is true for safe allow decisions", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "document.draft",
      risk_level_hint: "green",
      approval_required: false,
    });
    if (eval_.decision === "allow") {
      expect(eval_.allowed_to_auto_execute).toBe(true);
    }
  });

  it("is false for allow_with_warning", () => {
    const eval_ = evaluatePierreClonePolicy({});
    if (eval_.decision === "allow_with_warning") {
      expect(eval_.allowed_to_auto_execute).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 13. evaluatePierreClonePolicy — runtime rules
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreClonePolicy — runtime rules", () => {
  it("applies runtime rule passed in context", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "custom.action",
      runtime_rules: [
        {
          id: "runtime_test_block",
          name: "Test Block",
          description: "Blocks custom.action",
          status: "enabled",
          source: "runtime_payload",
          scope: "task_type",
          severity: "blocked",
          decision: "block",
          risk_level: "red",
          can_override: true,
          priority: 50,
          condition: { task_types: ["custom.action"] },
          reason: "Test runtime block",
        },
      ],
    });
    expect(["block", "refuse"]).toContain(eval_.decision);
  });

  it("runtime refuse overrides default allow", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "normal.task",
      runtime_rules: [
        {
          id: "runtime_refuse",
          name: "Runtime Refuse",
          description: "Refuses normal.task",
          status: "enabled",
          source: "runtime_payload",
          scope: "task_type",
          severity: "refused",
          decision: "refuse",
          risk_level: "black",
          can_override: false,
          priority: 100,
          condition: { task_types: ["normal.task"] },
          reason: "Refused by runtime rule",
        },
      ],
    });
    expect(eval_.decision).toBe("refuse");
  });

  it("disabled runtime rules are ignored", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "safe.task",
      runtime_rules: [
        {
          id: "runtime_disabled",
          name: "Disabled Rule",
          description: "This is disabled",
          status: "disabled",
          source: "runtime_payload",
          scope: "task_type",
          severity: "refused",
          decision: "refuse",
          risk_level: "black",
          can_override: false,
          priority: 100,
          condition: { task_types: ["safe.task"] },
          reason: "Should be ignored",
        },
      ],
    });
    expect(eval_.decision).not.toBe("refuse");
  });
});

// ═══════════════════════════════════════════════════════════
// 14. buildClonePolicyPreview
// ═══════════════════════════════════════════════════════════

describe("buildClonePolicyPreview", () => {
  it("returns a valid preview", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "document.draft" });
    const preview = buildClonePolicyPreview(eval_);
    expect(preview.decision).toBe(eval_.decision);
    expect(preview.risk_level).toBe(eval_.risk_level);
    expect(typeof preview.matched_rules_count).toBe("number");
    expect(typeof preview.allowed_to_auto_execute).toBe("boolean");
    expect(typeof preview.summary).toBe("string");
  });

  it("summary is non-empty", () => {
    const preview = buildClonePolicyPreview(evaluatePierreClonePolicy({ task_type: "email.send" }));
    expect(preview.summary.length).toBeGreaterThan(0);
  });

  it("top_rule is null when no rules matched", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "document.draft", risk_level_hint: "green", approval_required: false });
    const preview = buildClonePolicyPreview(eval_);
    if (eval_.matched_rules.length === 0) {
      expect(preview.top_rule).toBeNull();
    }
  });

  it("top_rule is set when rules matched", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "email.send" });
    const preview = buildClonePolicyPreview(eval_);
    if (eval_.matched_rules.length > 0) {
      expect(preview.top_rule).not.toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 15. buildClonePolicyAuditEvent
// ═══════════════════════════════════════════════════════════

describe("buildClonePolicyAuditEvent", () => {
  it("returns a valid audit event", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "document.draft" });
    const event = buildClonePolicyAuditEvent(eval_, { task_type: "document.draft" });
    expect(event.event_type).toBeTruthy();
    expect(typeof event.message).toBe("string");
    expect(event.meta_json).toBeDefined();
    expect(event.meta_json.decision).toBe(eval_.decision);
    expect(event.meta_json.risk_level).toBe(eval_.risk_level);
  });

  it("event_type is clonepolicy_execution_blocked for refuse/block", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "email.send" });
    const event = buildClonePolicyAuditEvent(eval_, { task_type: "email.send" });
    if (eval_.decision === "refuse" || eval_.decision === "block") {
      expect(event.event_type).toBe("clonepolicy_execution_blocked");
    }
  });

  it("meta_json includes allowed_to_auto_execute", () => {
    const eval_ = evaluatePierreClonePolicy({});
    const event = buildClonePolicyAuditEvent(eval_, {});
    expect(typeof event.meta_json.allowed_to_auto_execute).toBe("boolean");
  });

  it("message is non-empty", () => {
    const eval_ = evaluatePierreClonePolicy({});
    const event = buildClonePolicyAuditEvent(eval_, {});
    expect(event.message.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 16. applyClonePolicyToTask
// ═══════════════════════════════════════════════════════════

describe("applyClonePolicyToTask", () => {
  it("adds clonepolicy fields to task object", () => {
    const task = { id: "t1", type: "document.draft" };
    const eval_ = evaluatePierreClonePolicy({ task_type: "document.draft" });
    const result = applyClonePolicyToTask(task, eval_);
    expect(result.id).toBe("t1");
    const cp = result.clonepolicy as Record<string, unknown>;
    expect(cp).toBeDefined();
    expect(cp.decision).toBe(eval_.decision);
    expect(typeof cp.allowed_to_auto_execute).toBe("boolean");
  });

  it("does not mutate the original task", () => {
    const task = { id: "t2" };
    const eval_ = evaluatePierreClonePolicy({});
    const result = applyClonePolicyToTask(task, eval_);
    expect(task).not.toHaveProperty("clonepolicy");
    expect(result).toHaveProperty("clonepolicy");
  });

  it("preserves existing task fields", () => {
    const task = { id: "t3", title: "My task", status: "pending" };
    const eval_ = evaluatePierreClonePolicy({});
    const result = applyClonePolicyToTask(task, eval_);
    expect(result.title).toBe("My task");
    expect(result.status).toBe("pending");
  });
});

// ═══════════════════════════════════════════════════════════
// 17. isClonePolicyAutoExecutable
// ═══════════════════════════════════════════════════════════

describe("isClonePolicyAutoExecutable", () => {
  it("returns false for email.send", () => {
    expect(isClonePolicyAutoExecutable({ task_type: "email.send" })).toBe(false);
  });

  it("returns false for approval_required=true", () => {
    expect(isClonePolicyAutoExecutable({ approval_required: true })).toBe(false);
  });

  it("returns false for harcèlement context", () => {
    expect(isClonePolicyAutoExecutable({ text_corpus: "harcèlement moral" })).toBe(false);
  });

  it("returns false for black risk level", () => {
    expect(isClonePolicyAutoExecutable({ risk_level_hint: "black" })).toBe(false);
  });

  it("returns false for red risk level", () => {
    expect(isClonePolicyAutoExecutable({ risk_level_hint: "red" })).toBe(false);
  });

  it("returns boolean", () => {
    expect(typeof isClonePolicyAutoExecutable({})).toBe("boolean");
  });
});

// ═══════════════════════════════════════════════════════════
// 18. summarizeClonePolicyEvaluation
// ═══════════════════════════════════════════════════════════

describe("summarizeClonePolicyEvaluation", () => {
  it("returns a non-empty string", () => {
    const eval_ = evaluatePierreClonePolicy({});
    expect(typeof summarizeClonePolicyEvaluation(eval_)).toBe("string");
    expect(summarizeClonePolicyEvaluation(eval_).length).toBeGreaterThan(0);
  });

  it("summary reflects blocked/refused/approved state", () => {
    const blocked = evaluatePierreClonePolicy({ task_type: "email.send" });
    const summary = summarizeClonePolicyEvaluation(blocked);
    expect(summary.length).toBeGreaterThan(5);
    // Summary uses French labels — just verify it's non-empty and differs by decision
    const allowed = evaluatePierreClonePolicy({ task_type: "document.draft", risk_level_hint: "green" });
    const summaryAllowed = summarizeClonePolicyEvaluation(allowed);
    if (blocked.decision !== allowed.decision) {
      expect(summary).not.toBe(summaryAllowed);
    }
  });

  it("returns different summaries for different decisions", () => {
    const allow_ = evaluatePierreClonePolicy({ task_type: "document.draft", risk_level_hint: "green" });
    const block_ = evaluatePierreClonePolicy({ task_type: "email.send" });
    if (allow_.decision !== block_.decision) {
      expect(summarizeClonePolicyEvaluation(allow_)).not.toBe(summarizeClonePolicyEvaluation(block_));
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 19. Edge cases and security invariants
// ═══════════════════════════════════════════════════════════

describe("evaluatePierreClonePolicy — security invariants", () => {
  it("ClonePolicy never lowers guard for email.send regardless of other signals", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "email.send",
      risk_level_hint: "green",
      approval_required: false,
      company_trust_score: 100,
    } as PierreClonePolicyContext & { company_trust_score: number });
    expect(eval_.allowed_to_auto_execute).toBe(false);
  });

  it("violence + email.send results in refuse (worst wins)", () => {
    const eval_ = evaluatePierreClonePolicy({
      task_type: "email.send",
      text_corpus: "violence et harcèlement",
    });
    expect(eval_.decision).toBe("refuse");
  });

  it("all refuse decisions set requires_human=true", () => {
    const scenarios: PierreClonePolicyContext[] = [
      { text_corpus: "harcèlement moral" },
      { text_corpus: "discrimination ethnique" },
      { text_corpus: "litige prud'hommes" },
    ];
    for (const ctx of scenarios) {
      const eval_ = evaluatePierreClonePolicy(ctx);
      if (eval_.decision === "refuse") {
        expect(eval_.requires_human).toBe(true);
      }
    }
  });

  it("all block decisions set requires_human=true", () => {
    const eval_ = evaluatePierreClonePolicy({ task_type: "email.send" });
    if (eval_.decision === "block" || eval_.decision === "refuse") {
      expect(eval_.requires_human).toBe(true);
    }
  });

  it("matched_rules list is always an array", () => {
    expect(Array.isArray(evaluatePierreClonePolicy({}).matched_rules)).toBe(true);
    expect(Array.isArray(evaluatePierreClonePolicy({ text_corpus: "harcèlement" }).matched_rules)).toBe(true);
  });

  it("evaluated_at is a valid ISO string", () => {
    const eval_ = evaluatePierreClonePolicy({ now: "2026-01-15T10:00:00Z" });
    expect(() => new Date(eval_.evaluated_at)).not.toThrow();
    expect(new Date(eval_.evaluated_at).getFullYear()).toBeGreaterThanOrEqual(2000);
  });

  it("explanation is non-empty for blocked decisions", () => {
    const eval_ = evaluatePierreClonePolicy({ text_corpus: "harcèlement moral" });
    expect(eval_.explanation.length).toBeGreaterThan(0);
  });
});
