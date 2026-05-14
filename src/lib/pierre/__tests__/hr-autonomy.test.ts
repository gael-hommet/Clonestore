import { describe, expect, it } from "vitest";

import {
  decidePierreHrExecutionPolicy,
  resolvePierreAutonomyLevel,
} from "../hr/autonomy";
import { executePierreTask } from "../tasks/executors";

// ══════════════════════════════════════════════════════════
// resolvePierreAutonomyLevel
// ══════════════════════════════════════════════════════════

describe("resolvePierreAutonomyLevel", () => {
  it("accepts all valid levels verbatim", () => {
    expect(resolvePierreAutonomyLevel("draft_only")).toBe("draft_only");
    expect(resolvePierreAutonomyLevel("low_risk_execution")).toBe("low_risk_execution");
    expect(resolvePierreAutonomyLevel("validation_smart")).toBe("validation_smart");
    expect(resolvePierreAutonomyLevel("advanced_operations")).toBe("advanced_operations");
    expect(resolvePierreAutonomyLevel("enterprise_rules")).toBe("enterprise_rules");
  });

  it("normalises casing and whitespace", () => {
    expect(resolvePierreAutonomyLevel("  DRAFT_ONLY  ")).toBe("draft_only");
    expect(resolvePierreAutonomyLevel("Validation_Smart")).toBe("validation_smart");
  });

  it("falls back to validation_smart for unknown strings", () => {
    expect(resolvePierreAutonomyLevel("super_autonome")).toBe("validation_smart");
    expect(resolvePierreAutonomyLevel("")).toBe("validation_smart");
    expect(resolvePierreAutonomyLevel("full_auto")).toBe("validation_smart");
  });

  it("falls back to validation_smart for non-strings", () => {
    expect(resolvePierreAutonomyLevel(null)).toBe("validation_smart");
    expect(resolvePierreAutonomyLevel(undefined)).toBe("validation_smart");
    expect(resolvePierreAutonomyLevel(42)).toBe("validation_smart");
    expect(resolvePierreAutonomyLevel({})).toBe("validation_smart");
  });
});

// ══════════════════════════════════════════════════════════
// decidePierreHrExecutionPolicy — black actions (invariant)
// ══════════════════════════════════════════════════════════

describe("decidePierreHrExecutionPolicy — black actions are always blocked", () => {
  const blackCases = [
    "draft_only",
    "low_risk_execution",
    "validation_smart",
    "advanced_operations",
    "enterprise_rules",
  ] as const;

  for (const level of blackCases) {
    it(`blocks blocked_without_human at level ${level}`, () => {
      const result = decidePierreHrExecutionPolicy({
        hr_action_class: "blocked_without_human",
        autonomy_level: level,
      });
      expect(result.blocked).toBe(true);
      expect(result.can_execute).toBe(false);
      expect(result.final_status_hint).toBe("blocked");
    });

    it(`blocks human_only policy at level ${level}`, () => {
      const result = decidePierreHrExecutionPolicy({
        hr_approval_policy: "human_only",
        autonomy_level: level,
      });
      expect(result.blocked).toBe(true);
      expect(result.can_execute).toBe(false);
      expect(result.final_status_hint).toBe("blocked");
    });
  }
});

// ══════════════════════════════════════════════════════════
// draft_only — toujours awaiting_approval
// ══════════════════════════════════════════════════════════

describe("decidePierreHrExecutionPolicy — draft_only", () => {
  it("awaits approval even for green actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "auto_executable",
      autonomy_level: "draft_only",
    });
    expect(result.can_execute).toBe(false);
    expect(result.approval_required).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.final_status_hint).toBe("awaiting_approval");
    expect(result.autonomy_level).toBe("draft_only");
  });

  it("awaits approval for orange actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_recommended",
      autonomy_level: "draft_only",
    });
    expect(result.can_execute).toBe(false);
    expect(result.final_status_hint).toBe("awaiting_approval");
  });

  it("awaits approval for red actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_required",
      autonomy_level: "draft_only",
    });
    expect(result.can_execute).toBe(false);
    expect(result.final_status_hint).toBe("awaiting_approval");
  });
});

// ══════════════════════════════════════════════════════════
// low_risk_execution — only green auto-executes
// ══════════════════════════════════════════════════════════

describe("decidePierreHrExecutionPolicy — low_risk_execution", () => {
  it("auto-executes green actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "auto_executable",
      autonomy_level: "low_risk_execution",
    });
    expect(result.can_execute).toBe(true);
    expect(result.approval_required).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.final_status_hint).toBe("queued");
  });

  it("awaits approval for orange actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_recommended",
      autonomy_level: "low_risk_execution",
    });
    expect(result.can_execute).toBe(false);
    expect(result.final_status_hint).toBe("awaiting_approval");
  });

  it("awaits approval for red actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_required",
      autonomy_level: "low_risk_execution",
    });
    expect(result.can_execute).toBe(false);
    expect(result.final_status_hint).toBe("awaiting_approval");
  });
});

// ══════════════════════════════════════════════════════════
// validation_smart — green auto, orange+red await
// ══════════════════════════════════════════════════════════

describe("decidePierreHrExecutionPolicy — validation_smart", () => {
  it("auto-executes green actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "auto_executable",
      autonomy_level: "validation_smart",
    });
    expect(result.can_execute).toBe(true);
    expect(result.approval_required).toBe(false);
    expect(result.final_status_hint).toBe("queued");
  });

  it("awaits approval for orange actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_recommended",
      autonomy_level: "validation_smart",
    });
    expect(result.can_execute).toBe(false);
    expect(result.approval_required).toBe(true);
    expect(result.final_status_hint).toBe("awaiting_approval");
  });

  it("awaits approval for red actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_required",
      autonomy_level: "validation_smart",
    });
    expect(result.can_execute).toBe(false);
    expect(result.final_status_hint).toBe("awaiting_approval");
  });

  it("awaits approval for unknown action class", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "unknown_class",
      autonomy_level: "validation_smart",
    });
    expect(result.can_execute).toBe(false);
    expect(result.final_status_hint).toBe("awaiting_approval");
  });
});

// ══════════════════════════════════════════════════════════
// advanced_operations — green+orange advance, red awaits
// ══════════════════════════════════════════════════════════

describe("decidePierreHrExecutionPolicy — advanced_operations", () => {
  it("auto-executes green actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "auto_executable",
      autonomy_level: "advanced_operations",
    });
    expect(result.can_execute).toBe(true);
    expect(result.approval_required).toBe(false);
    expect(result.final_status_hint).toBe("queued");
  });

  it("tracks orange actions: executes but requires approval (makeTracked)", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_recommended",
      autonomy_level: "advanced_operations",
    });
    expect(result.can_execute).toBe(true);
    expect(result.approval_required).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.final_status_hint).toBe("queued");
  });

  it("awaits approval for red actions", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_required",
      autonomy_level: "advanced_operations",
    });
    expect(result.can_execute).toBe(false);
    expect(result.final_status_hint).toBe("awaiting_approval");
  });
});

// ══════════════════════════════════════════════════════════
// enterprise_rules — delegates to advanced_operations logic
// ══════════════════════════════════════════════════════════

describe("decidePierreHrExecutionPolicy — enterprise_rules", () => {
  it("auto-executes green actions (same as advanced_operations)", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "auto_executable",
      autonomy_level: "enterprise_rules",
    });
    expect(result.can_execute).toBe(true);
    expect(result.final_status_hint).toBe("queued");
    expect(result.autonomy_level).toBe("enterprise_rules");
  });

  it("tracks orange actions (same as advanced_operations)", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "validation_recommended",
      autonomy_level: "enterprise_rules",
    });
    expect(result.can_execute).toBe(true);
    expect(result.approval_required).toBe(true);
    expect(result.final_status_hint).toBe("queued");
  });

  it("never reduces a black action — always blocked", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "blocked_without_human",
      autonomy_level: "enterprise_rules",
    });
    expect(result.blocked).toBe(true);
    expect(result.can_execute).toBe(false);
    expect(result.final_status_hint).toBe("blocked");
  });
});

// ══════════════════════════════════════════════════════════
// Cross-level invariants
// ══════════════════════════════════════════════════════════

describe("decidePierreHrExecutionPolicy — invariants", () => {
  it("unknown autonomy level falls back to validation_smart behavior", () => {
    const smart = decidePierreHrExecutionPolicy({
      hr_action_class: "auto_executable",
      autonomy_level: "validation_smart",
    });
    const unknown = decidePierreHrExecutionPolicy({
      hr_action_class: "auto_executable",
      autonomy_level: "full_autonomous_unknown",
    });
    expect(unknown.can_execute).toBe(smart.can_execute);
    expect(unknown.final_status_hint).toBe(smart.final_status_hint);
  });

  it("result always contains all required fields", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "auto_executable",
      autonomy_level: "validation_smart",
    });
    expect(typeof result.autonomy_level).toBe("string");
    expect(typeof result.can_execute).toBe("boolean");
    expect(typeof result.approval_required).toBe("boolean");
    expect(typeof result.blocked).toBe("boolean");
    expect(["queued", "awaiting_approval", "blocked"]).toContain(result.final_status_hint);
    expect(typeof result.reason).toBe("string");
    expect(typeof result.human_note).toBe("string");
  });

  it("approval_required is false when blocked is true", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_action_class: "blocked_without_human",
      autonomy_level: "advanced_operations",
    });
    expect(result.blocked).toBe(true);
    expect(result.approval_required).toBe(false);
  });

  it("can_execute is false when blocked is true", () => {
    const result = decidePierreHrExecutionPolicy({
      hr_approval_policy: "human_only",
      autonomy_level: "enterprise_rules",
    });
    expect(result.blocked).toBe(true);
    expect(result.can_execute).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
// executePierreTask — autonomy gates
// ══════════════════════════════════════════════════════════

describe("executePierreTask — autonomy gate (Gate 2: autonomy_decision.blocked)", () => {
  it("blocks when autonomy_decision.blocked === true", async () => {
    const result = await executePierreTask({
      id: "task-1",
      type: "doc.generate",
      status: "queued",
      payload: {
        autonomy_decision: { blocked: true, can_execute: false },
        can_execute: false,
        autonomy_level: "draft_only",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("AUTONOMY_BLOCKED");
      expect(result.status).toBe("blocked");
      expect(result.log.event).toBe("executor_autonomy_blocked");
    }
  });

  it("blocks email.send when autonomy_decision.blocked === true", async () => {
    const result = await executePierreTask({
      id: "task-2",
      type: "email.send",
      status: "queued",
      payload: {
        autonomy_decision: { blocked: true },
        can_execute: false,
        autonomy_level: "draft_only",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_code).toBe("AUTONOMY_BLOCKED");
  });

  it("includes autonomy_level in blocked log payload", async () => {
    const result = await executePierreTask({
      id: "task-3",
      type: "doc.generate",
      status: "queued",
      payload: {
        autonomy_decision: { blocked: true },
        autonomy_level: "low_risk_execution",
        hr_risk_level: "red",
        hr_task_kind: "contrat",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.log.payload?.autonomy_level).toBe("low_risk_execution");
      expect(result.log.payload?.hr_risk_level).toBe("red");
      expect(result.log.payload?.hr_task_kind).toBe("contrat");
    }
  });
});

describe("executePierreTask — autonomy gate (Gate 3: can_execute + send type)", () => {
  it("blocks email.send when can_execute === false", async () => {
    const result = await executePierreTask({
      id: "task-4",
      type: "email.send",
      status: "queued",
      payload: {
        autonomy_decision: { blocked: false, can_execute: false },
        can_execute: false,
        autonomy_level: "validation_smart",
        subject: "Test",
        body_text: "Hello",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("AUTONOMY_BLOCKED");
      expect(result.log.event).toBe("executor_autonomy_send_blocked");
    }
  });

  it("blocks send_email when can_execute === false", async () => {
    const result = await executePierreTask({
      id: "task-5",
      type: "send_email",
      status: "queued",
      payload: {
        can_execute: false,
        autonomy_level: "low_risk_execution",
        subject: "Test",
        body_text: "Hello",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_code).toBe("AUTONOMY_BLOCKED");
  });

  it("allows doc.generate even when can_execute === false (safe draft production)", async () => {
    const result = await executePierreTask({
      id: "task-6",
      type: "doc.generate",
      status: "queued",
      payload: {
        can_execute: false,
        autonomy_level: "validation_smart",
        text_content: "Draft content",
      },
    });
    // Draft production is always safe — executor should run
    expect(result.ok).toBe(true);
  });

  it("allows email.draft when can_execute === false (not a send-type)", async () => {
    const result = await executePierreTask({
      id: "task-7",
      type: "email.draft",
      status: "queued",
      payload: {
        can_execute: false,
        autonomy_level: "draft_only",
        subject: "Draft",
        body_text: "Body content",
        approval_required: false,
      },
    });
    expect(result.ok).toBe(true);
  });

  it("allows pdf.generate when can_execute === false", async () => {
    const result = await executePierreTask({
      id: "task-8",
      type: "pdf.generate",
      status: "queued",
      payload: {
        can_execute: false,
        autonomy_level: "draft_only",
        text_content: "PDF content",
      },
    });
    expect(result.ok).toBe(true);
  });

  it("includes task_type in send-blocked log payload", async () => {
    const result = await executePierreTask({
      id: "task-9",
      type: "email.send",
      status: "queued",
      payload: {
        can_execute: false,
        autonomy_level: "validation_smart",
        hr_task_kind: "email_salarie",
        subject: "Test",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.log.payload?.task_type).toBe("email.send");
      expect(result.log.payload?.hr_task_kind).toBe("email_salarie");
    }
  });
});

describe("executePierreTask — autonomy gate does not interfere with HR Gate 1", () => {
  it("HR_BLOCKED_ACTION takes priority over AUTONOMY_BLOCKED", async () => {
    const result = await executePierreTask({
      id: "task-10",
      type: "doc.generate",
      status: "queued",
      payload: {
        hr_action_class: "blocked_without_human",
        autonomy_decision: { blocked: true },
        can_execute: false,
        autonomy_level: "enterprise_rules",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Gate 1 fires first
      expect(result.error_code).toBe("HR_BLOCKED_ACTION");
    }
  });

  it("green task with can_execute passes all gates", async () => {
    const result = await executePierreTask({
      id: "task-11",
      type: "doc.generate",
      status: "queued",
      payload: {
        hr_action_class: "auto_executable",
        hr_approval_policy: "none",
        can_execute: true,
        autonomy_decision: { blocked: false, can_execute: true },
        autonomy_level: "validation_smart",
        text_content: "Generated document content",
      },
    });
    expect(result.ok).toBe(true);
  });

  it("task with no HR payload passes all gates (backward compat)", async () => {
    const result = await executePierreTask({
      id: "task-12",
      type: "doc.generate",
      status: "queued",
      payload: {
        text_content: "Legacy task without HR fields",
      },
    });
    expect(result.ok).toBe(true);
  });
});
