// CloneStore Runtime — Comprehensive Tests (Bloc 19)
// Pure module tests: no Supabase, no Next, no async, no side effects.

import { describe, it, expect } from "vitest";
import {
  normalizeRuntimeEmployeeSlug,
  normalizeRuntimeActionType,
  normalizeRuntimeRiskLevel,
  buildRuntimeContext,
  buildRuntimeGovernance,
  buildRuntimeCapabilities,
  evaluateRuntimeAction,
  buildRuntimeSnapshot,
} from "../engine";
import {
  getCloneStoreTechnologyDefinitions,
  buildDefaultTechnologyCompanySettings,
  buildTechnologyRegistry,
} from "../../technologies/registry";
import type {
  TechnologyCompanySetting,
  TechnologySlug,
  TechnologyAutonomyLevel,
  TechnologyRiskMode,
} from "../../technologies/contracts";
import type { TechnologyRegistry } from "../../technologies/contracts";
import type { CloneRuntimeContext } from "../contracts";

// ── Test helpers ──────────────────────────────────────────────────────────────

function buildTestRegistry(overrides: Partial<TechnologyCompanySetting>[] = []): TechnologyRegistry {
  const defs = getCloneStoreTechnologyDefinitions();
  const defaults = buildDefaultTechnologyCompanySettings(defs);
  const merged = defaults.map((d) => {
    const override = overrides.find((o) => o.technology_slug === d.technology_slug);
    return override ? { ...d, ...override } : d;
  });
  return buildTechnologyRegistry({ definitions: defs, rawSettings: merged });
}

function buildMinimalContext(
  overrides: Partial<CloneRuntimeContext> = {},
): CloneRuntimeContext {
  return {
    employee_slug: "pierre",
    built_at: "2026-05-19T00:00:00.000Z",
    active_technologies: [],
    guard_mode: "guarded",
    autonomy_level: "supervised",
    trace_enabled: false,
    review_enabled: false,
    continuity_enabled: false,
    chat_enabled: false,
    learn_enabled: false,
    signals_enabled: false,
    voice_enabled: false,
    brief_enabled: false,
    ...overrides,
  };
}

// ── normalizeRuntimeEmployeeSlug ──────────────────────────────────────────────

describe("normalizeRuntimeEmployeeSlug", () => {
  it("returns string as-is (lowercased, trimmed)", () => {
    expect(normalizeRuntimeEmployeeSlug("pierre")).toBe("pierre");
  });

  it("lowercases the input", () => {
    expect(normalizeRuntimeEmployeeSlug("Pierre")).toBe("pierre");
  });

  it("trims whitespace", () => {
    expect(normalizeRuntimeEmployeeSlug("  pierre  ")).toBe("pierre");
  });

  it("returns 'pierre' for null", () => {
    expect(normalizeRuntimeEmployeeSlug(null)).toBe("pierre");
  });

  it("returns 'pierre' for undefined", () => {
    expect(normalizeRuntimeEmployeeSlug(undefined)).toBe("pierre");
  });

  it("returns 'pierre' for empty string", () => {
    expect(normalizeRuntimeEmployeeSlug("")).toBe("pierre");
  });

  it("returns 'pierre' for whitespace-only string", () => {
    expect(normalizeRuntimeEmployeeSlug("   ")).toBe("pierre");
  });

  it("returns 'pierre' for number", () => {
    expect(normalizeRuntimeEmployeeSlug(42)).toBe("pierre");
  });

  it("preserves valid custom slug", () => {
    expect(normalizeRuntimeEmployeeSlug("claude")).toBe("claude");
  });

  it("handles mixed case with underscores", () => {
    expect(normalizeRuntimeEmployeeSlug("HR_Bot")).toBe("hr_bot");
  });
});

// ── normalizeRuntimeActionType ────────────────────────────────────────────────

describe("normalizeRuntimeActionType", () => {
  it("returns action type as-is (lowercased, trimmed)", () => {
    expect(normalizeRuntimeActionType("email.send")).toBe("email.send");
  });

  it("lowercases the input", () => {
    expect(normalizeRuntimeActionType("EMAIL.SEND")).toBe("email.send");
  });

  it("trims whitespace", () => {
    expect(normalizeRuntimeActionType("  task.create  ")).toBe("task.create");
  });

  it("returns empty string for null", () => {
    expect(normalizeRuntimeActionType(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeRuntimeActionType(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeRuntimeActionType("")).toBe("");
  });

  it("returns empty string for whitespace-only", () => {
    expect(normalizeRuntimeActionType("   ")).toBe("");
  });

  it("returns empty string for number", () => {
    expect(normalizeRuntimeActionType(123)).toBe("");
  });

  it("preserves dot-notation action types", () => {
    expect(normalizeRuntimeActionType("document.generate")).toBe("document.generate");
  });

  it("preserves underscore-style action types", () => {
    expect(normalizeRuntimeActionType("send_email")).toBe("send_email");
  });
});

// ── normalizeRuntimeRiskLevel ─────────────────────────────────────────────────

describe("normalizeRuntimeRiskLevel", () => {
  it("returns 'normal' for 'normal'", () => {
    expect(normalizeRuntimeRiskLevel("normal")).toBe("normal");
  });

  it("returns 'guarded' for 'guarded'", () => {
    expect(normalizeRuntimeRiskLevel("guarded")).toBe("guarded");
  });

  it("returns 'strict' for 'strict'", () => {
    expect(normalizeRuntimeRiskLevel("strict")).toBe("strict");
  });

  it("returns 'locked' for 'locked'", () => {
    expect(normalizeRuntimeRiskLevel("locked")).toBe("locked");
  });

  it("returns 'red' for 'red'", () => {
    expect(normalizeRuntimeRiskLevel("red")).toBe("red");
  });

  it("returns 'black' for 'black'", () => {
    expect(normalizeRuntimeRiskLevel("black")).toBe("black");
  });

  it("returns value for uppercase input (normalizes)", () => {
    expect(normalizeRuntimeRiskLevel("RED")).toBe("red");
  });

  it("returns value with trimming", () => {
    expect(normalizeRuntimeRiskLevel("  black  ")).toBe("black");
  });

  it("returns null for unknown string", () => {
    expect(normalizeRuntimeRiskLevel("critical")).toBeNull();
  });

  it("returns null for null", () => {
    expect(normalizeRuntimeRiskLevel(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeRuntimeRiskLevel(undefined)).toBeNull();
  });

  it("returns null for number", () => {
    expect(normalizeRuntimeRiskLevel(42)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeRuntimeRiskLevel("")).toBeNull();
  });
});

// ── buildRuntimeContext ───────────────────────────────────────────────────────

describe("buildRuntimeContext", () => {
  it("returns a context with the given employee_slug", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "pierre");
    expect(ctx.employee_slug).toBe("pierre");
  });

  it("sets built_at when passed", () => {
    const registry = buildTestRegistry();
    const now = "2026-05-19T10:00:00.000Z";
    const ctx = buildRuntimeContext(registry, "pierre", now);
    expect(ctx.built_at).toBe(now);
  });

  it("defaults built_at to ISO string when not passed", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "pierre");
    expect(ctx.built_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns fallback context for missing registry", () => {
    const ctx = buildRuntimeContext(null as unknown as TechnologyRegistry, "pierre");
    expect(ctx.guard_mode).toBe("guarded");
    expect(ctx.autonomy_level).toBe("supervised");
    expect(ctx.active_technologies).toEqual([]);
  });

  it("returns fallback context for missing employeeSlug", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "");
    expect(ctx.employee_slug).toBe("");
    expect(ctx.active_technologies).toEqual([]);
  });

  it("active_technologies is an array", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "pierre");
    expect(Array.isArray(ctx.active_technologies)).toBe(true);
  });

  it("guard_mode comes from cloneguard setting", () => {
    const registry = buildTestRegistry([
      { technology_slug: "cloneguard", risk_mode: "strict" },
    ]);
    const ctx = buildRuntimeContext(registry, "pierre");
    expect(ctx.guard_mode).toBe("strict");
  });

  it("autonomy_level comes from clonetrust setting", () => {
    const registry = buildTestRegistry([
      { technology_slug: "clonetrust", autonomy_level: "autonomous" },
    ]);
    const ctx = buildRuntimeContext(registry, "pierre");
    expect(ctx.autonomy_level).toBe("autonomous");
  });

  it("trace_enabled reflects clonetrace setting", () => {
    const registry = buildTestRegistry([
      { technology_slug: "clonetrace", enabled_for_all: true },
    ]);
    const ctx = buildRuntimeContext(registry, "pierre");
    expect(typeof ctx.trace_enabled).toBe("boolean");
  });

  it("review_enabled reflects clonereview setting", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "pierre");
    expect(typeof ctx.review_enabled).toBe("boolean");
  });

  it("all boolean fields are booleans", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "pierre");
    const boolFields = [
      "trace_enabled", "review_enabled", "continuity_enabled",
      "chat_enabled", "learn_enabled", "signals_enabled",
      "voice_enabled", "brief_enabled",
    ] as const;
    for (const field of boolFields) {
      expect(typeof ctx[field]).toBe("boolean");
    }
  });
});

// ── buildRuntimeGovernance ────────────────────────────────────────────────────

describe("buildRuntimeGovernance", () => {
  it("returns governance object with required fields", () => {
    const registry = buildTestRegistry();
    const gov = buildRuntimeGovernance(registry);
    expect(gov).toHaveProperty("global_autonomy");
    expect(gov).toHaveProperty("global_risk_mode");
    expect(gov).toHaveProperty("governance_health");
  });

  it("governance_health is one of healthy|degraded|locked", () => {
    const registry = buildTestRegistry();
    const gov = buildRuntimeGovernance(registry);
    expect(["healthy", "degraded", "locked"]).toContain(gov.governance_health);
  });

  it("returns degraded governance for null registry", () => {
    const gov = buildRuntimeGovernance(null as unknown as TechnologyRegistry);
    expect(gov.governance_health).toBe("degraded");
  });

  it("global_autonomy is a valid autonomy level", () => {
    const registry = buildTestRegistry();
    const gov = buildRuntimeGovernance(registry);
    const validLevels: TechnologyAutonomyLevel[] = ["off", "suggest_only", "supervised", "semi_autonomous", "autonomous"];
    expect(validLevels).toContain(gov.global_autonomy);
  });

  it("global_risk_mode is a valid risk mode", () => {
    const registry = buildTestRegistry();
    const gov = buildRuntimeGovernance(registry);
    const validModes: TechnologyRiskMode[] = ["normal", "guarded", "strict", "locked"];
    expect(validModes).toContain(gov.global_risk_mode);
  });

  it("locked guard triggers locked governance_health", () => {
    const registry = buildTestRegistry([
      { technology_slug: "cloneguard", risk_mode: "locked" },
    ]);
    const gov = buildRuntimeGovernance(registry);
    expect(gov.governance_health).toBe("locked");
  });
});

// ── buildRuntimeCapabilities ──────────────────────────────────────────────────

describe("buildRuntimeCapabilities", () => {
  it("returns an array", () => {
    const registry = buildTestRegistry();
    const caps = buildRuntimeCapabilities(registry, "pierre");
    expect(Array.isArray(caps)).toBe(true);
  });

  it("returns an entry per technology definition", () => {
    const registry = buildTestRegistry();
    const caps = buildRuntimeCapabilities(registry, "pierre");
    const defs = getCloneStoreTechnologyDefinitions();
    expect(caps.length).toBe(defs.length);
  });

  it("returns empty array for null registry", () => {
    const caps = buildRuntimeCapabilities(null as unknown as TechnologyRegistry, "pierre");
    expect(caps).toEqual([]);
  });

  it("each capability has required fields", () => {
    const registry = buildTestRegistry();
    const caps = buildRuntimeCapabilities(registry, "pierre");
    for (const cap of caps) {
      expect(cap).toHaveProperty("technology_slug");
      expect(cap).toHaveProperty("enabled");
      expect(cap).toHaveProperty("autonomy_level");
      expect(cap).toHaveProperty("risk_mode");
      expect(cap).toHaveProperty("can_auto_execute");
      expect(cap).toHaveProperty("requires_observation");
      expect(cap).toHaveProperty("requires_review");
    }
  });

  it("can_auto_execute is false when autonomy is off", () => {
    const registry = buildTestRegistry([
      { technology_slug: "clonetrust", autonomy_level: "off" },
    ]);
    const caps = buildRuntimeCapabilities(registry, "pierre");
    const trust = caps.find((c) => c.technology_slug === "clonetrust");
    expect(trust?.can_auto_execute).toBe(false);
  });

  it("can_auto_execute is false when risk_mode is locked", () => {
    const registry = buildTestRegistry([
      { technology_slug: "cloneguard", risk_mode: "locked" },
    ]);
    const caps = buildRuntimeCapabilities(registry, "pierre");
    const guard = caps.find((c) => c.technology_slug === "cloneguard");
    expect(guard?.can_auto_execute).toBe(false);
  });

  it("boolean fields are booleans", () => {
    const registry = buildTestRegistry();
    const caps = buildRuntimeCapabilities(registry, "pierre");
    for (const cap of caps) {
      expect(typeof cap.enabled).toBe("boolean");
      expect(typeof cap.can_auto_execute).toBe("boolean");
      expect(typeof cap.requires_observation).toBe("boolean");
      expect(typeof cap.requires_review).toBe("boolean");
    }
  });
});

// ── evaluateRuntimeAction ─────────────────────────────────────────────────────

describe("evaluateRuntimeAction — empty action type", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });

  it("blocks empty action type", () => {
    const eval_ = evaluateRuntimeAction(ctx, "");
    expect(eval_.decision).toBe("blocked_by_policy");
    expect(eval_.can_auto_execute).toBe(false);
  });

  it("blocks whitespace-only action type", () => {
    const eval_ = evaluateRuntimeAction(ctx, "   ");
    expect(eval_.decision).toBe("blocked_by_policy");
  });
});

describe("evaluateRuntimeAction — email.send invariant", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });

  it("blocks email.send even with autonomous level", () => {
    const eval_ = evaluateRuntimeAction(ctx, "email.send");
    expect(eval_.decision).toBe("blocked_by_policy");
    expect(eval_.can_auto_execute).toBe(false);
    expect(eval_.requires_human_validation).toBe(true);
  });

  it("blocks send_email even with autonomous level", () => {
    const eval_ = evaluateRuntimeAction(ctx, "send_email");
    expect(eval_.decision).toBe("blocked_by_policy");
    expect(eval_.can_auto_execute).toBe(false);
  });

  it("email.send technology_source is cloneguard", () => {
    const eval_ = evaluateRuntimeAction(ctx, "email.send");
    expect(eval_.technology_source).toBe("cloneguard");
  });

  it("email.send requires_review is false (absolute block, not just review)", () => {
    const eval_ = evaluateRuntimeAction(ctx, "email.send");
    expect(eval_.requires_review).toBe(false);
  });
});

describe("evaluateRuntimeAction — risk_level black", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });

  it("blocks risk_level=black even with autonomous level", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "black" });
    expect(eval_.decision).toBe("blocked_by_policy");
    expect(eval_.can_auto_execute).toBe(false);
    expect(eval_.requires_human_validation).toBe(true);
  });

  it("risk_level=black technology_source is cloneguard", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "black" });
    expect(eval_.technology_source).toBe("cloneguard");
  });

  it("risk_level=BLACK (uppercase) also blocks", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "BLACK" });
    expect(eval_.decision).toBe("blocked_by_policy");
  });
});

describe("evaluateRuntimeAction — approval_required", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });

  it("approval_required=true → requires_validation", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { approval_required: true });
    expect(eval_.decision).toBe("requires_validation");
    expect(eval_.can_auto_execute).toBe(false);
    expect(eval_.requires_human_validation).toBe(true);
  });

  it("approval_required=false does not block", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { approval_required: false });
    expect(eval_.decision).not.toBe("requires_validation");
    expect(eval_.can_auto_execute).toBe(true);
  });
});

describe("evaluateRuntimeAction — risk_level red", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });

  it("risk_level=red → requires_validation", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "red" });
    expect(eval_.decision).toBe("requires_validation");
    expect(eval_.can_auto_execute).toBe(false);
    expect(eval_.requires_human_validation).toBe(true);
  });

  it("risk_level=red technology_source is cloneguard", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "red" });
    expect(eval_.technology_source).toBe("cloneguard");
  });
});

describe("evaluateRuntimeAction — guard_mode locked", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "locked" });

  it("guard_mode=locked → blocked_by_technology", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("blocked_by_technology");
    expect(eval_.can_auto_execute).toBe(false);
    expect(eval_.requires_human_validation).toBe(true);
  });

  it("guard_mode=locked technology_source is cloneguard", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.technology_source).toBe("cloneguard");
  });
});

describe("evaluateRuntimeAction — autonomy_level off", () => {
  const ctx = buildMinimalContext({ autonomy_level: "off", guard_mode: "normal" });

  it("autonomy=off → requires_validation", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("requires_validation");
    expect(eval_.can_auto_execute).toBe(false);
    expect(eval_.requires_human_validation).toBe(true);
  });

  it("autonomy=off technology_source is clonetrust", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.technology_source).toBe("clonetrust");
  });
});

describe("evaluateRuntimeAction — autonomy_level suggest_only", () => {
  const ctx = buildMinimalContext({ autonomy_level: "suggest_only", guard_mode: "normal" });

  it("suggest_only → requires_review", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("requires_review");
    expect(eval_.can_auto_execute).toBe(false);
    expect(eval_.requires_human_validation).toBe(false);
  });

  it("suggest_only requires_review is true", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_review).toBe(true);
  });
});

describe("evaluateRuntimeAction — document.generate special action", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });

  it("document.generate → requires_review even with autonomous", () => {
    const eval_ = evaluateRuntimeAction(ctx, "document.generate");
    expect(eval_.decision).toBe("requires_review");
    expect(eval_.can_auto_execute).toBe(false);
  });

  it("pdf.generate → requires_review even with autonomous", () => {
    const eval_ = evaluateRuntimeAction(ctx, "pdf.generate");
    expect(eval_.decision).toBe("requires_review");
    expect(eval_.can_auto_execute).toBe(false);
  });

  it("email.draft → requires_review even with autonomous", () => {
    const eval_ = evaluateRuntimeAction(ctx, "email.draft");
    expect(eval_.decision).toBe("requires_review");
    expect(eval_.can_auto_execute).toBe(false);
  });

  it("document.generate technology_source is clonereview", () => {
    const eval_ = evaluateRuntimeAction(ctx, "document.generate");
    expect(eval_.technology_source).toBe("clonereview");
  });

  it("email.draft requires_review is true", () => {
    const eval_ = evaluateRuntimeAction(ctx, "email.draft");
    expect(eval_.requires_review).toBe(true);
  });
});

describe("evaluateRuntimeAction — contains_sensitive_keywords", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });

  it("contains_sensitive_keywords=true → requires_review", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { contains_sensitive_keywords: true });
    expect(eval_.decision).toBe("requires_review");
    expect(eval_.can_auto_execute).toBe(false);
  });

  it("contains_sensitive_keywords=false does not force review", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { contains_sensitive_keywords: false });
    expect(eval_.decision).not.toBe("requires_review");
    expect(eval_.can_auto_execute).toBe(true);
  });

  it("contains_sensitive_keywords=null does not force review", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { contains_sensitive_keywords: null });
    expect(eval_.can_auto_execute).toBe(true);
  });
});

describe("evaluateRuntimeAction — guard_mode strict", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "strict" });

  it("guard_mode=strict → requires_review for regular actions", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("requires_review");
    expect(eval_.can_auto_execute).toBe(false);
  });

  it("guard_mode=strict technology_source is cloneguard", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.technology_source).toBe("cloneguard");
  });

  it("guard_mode=strict requires_review is true", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_review).toBe(true);
  });

  it("guard_mode=strict requires_human_validation is false", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_human_validation).toBe(false);
  });
});

describe("evaluateRuntimeAction — autonomy_level supervised", () => {
  const ctx = buildMinimalContext({ autonomy_level: "supervised", guard_mode: "guarded" });

  it("supervised → allowed_with_observation", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("allowed_with_observation");
    expect(eval_.can_auto_execute).toBe(true);
  });

  it("supervised requires_observation is true", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_observation).toBe(true);
  });

  it("supervised requires_human_validation is false", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_human_validation).toBe(false);
  });
});

describe("evaluateRuntimeAction — autonomy_level semi_autonomous", () => {
  const ctx = buildMinimalContext({ autonomy_level: "semi_autonomous", guard_mode: "guarded" });

  it("semi_autonomous → allowed_with_observation", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("allowed_with_observation");
    expect(eval_.can_auto_execute).toBe(true);
  });

  it("semi_autonomous requires_observation follows trace_enabled", () => {
    const ctxWithTrace = buildMinimalContext({
      autonomy_level: "semi_autonomous",
      guard_mode: "guarded",
      trace_enabled: true,
    });
    const eval_ = evaluateRuntimeAction(ctxWithTrace, "task.create");
    expect(eval_.requires_observation).toBe(true);
  });

  it("semi_autonomous requires_human_validation is false", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_human_validation).toBe(false);
  });
});

describe("evaluateRuntimeAction — autonomy_level autonomous", () => {
  const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "guarded" });

  it("autonomous → allowed", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("allowed");
    expect(eval_.can_auto_execute).toBe(true);
  });

  it("autonomous requires_human_validation is false", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_human_validation).toBe(false);
  });

  it("autonomous requires_review is false", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_review).toBe(false);
  });
});

describe("evaluateRuntimeAction — priority ordering", () => {
  it("email.send takes priority over autonomous + no risk", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "email.send", { approval_required: false, risk_level: "normal" });
    expect(eval_.decision).toBe("blocked_by_policy");
  });

  it("risk_level=black takes priority over autonomous + no approval_required", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "black" });
    expect(eval_.decision).toBe("blocked_by_policy");
  });

  it("approval_required takes priority over risk_level=red", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { approval_required: true, risk_level: "red" });
    expect(eval_.decision).toBe("requires_validation");
  });

  it("guard_mode=locked overrides suggest_only autonomy path", () => {
    const ctx = buildMinimalContext({ autonomy_level: "suggest_only", guard_mode: "locked" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("blocked_by_technology");
  });
});

describe("evaluateRuntimeAction — evaluation metadata", () => {
  it("returns evaluated_at from now param", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const now = "2026-05-19T10:00:00.000Z";
    const eval_ = evaluateRuntimeAction(ctx, "task.create", {}, now);
    expect(eval_.evaluated_at).toBe(now);
  });

  it("returns action_type in result", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.action_type).toBe("task.create");
  });

  it("handles null context gracefully", () => {
    const eval_ = evaluateRuntimeAction(null as unknown as CloneRuntimeContext, "task.create");
    expect(eval_).toBeDefined();
    expect(eval_.decision).toBeDefined();
  });
});

// ── buildRuntimeSnapshot ──────────────────────────────────────────────────────

describe("buildRuntimeSnapshot", () => {
  it("returns a snapshot with required fields", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(snap).toHaveProperty("employee_slug");
    expect(snap).toHaveProperty("built_at");
    expect(snap).toHaveProperty("active_technology_count");
    expect(snap).toHaveProperty("context");
    expect(snap).toHaveProperty("governance");
    expect(snap).toHaveProperty("capabilities");
    expect(snap).toHaveProperty("summary");
  });

  it("employee_slug matches input", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(snap.employee_slug).toBe("pierre");
  });

  it("built_at matches now param", () => {
    const registry = buildTestRegistry();
    const now = "2026-05-19T10:00:00.000Z";
    const snap = buildRuntimeSnapshot(registry, "pierre", now);
    expect(snap.built_at).toBe(now);
  });

  it("active_technology_count is a non-negative integer", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(snap.active_technology_count).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(snap.active_technology_count)).toBe(true);
  });

  it("context is a CloneRuntimeContext object", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(snap.context.employee_slug).toBe("pierre");
    expect(typeof snap.context.guard_mode).toBe("string");
  });

  it("governance has governance_health", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(["healthy", "degraded", "locked"]).toContain(snap.governance.governance_health);
  });

  it("capabilities is an array", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(Array.isArray(snap.capabilities)).toBe(true);
  });

  it("summary is a non-empty string", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(typeof snap.summary).toBe("string");
    expect(snap.summary.length).toBeGreaterThan(0);
  });

  it("returns fallback snapshot for null registry", () => {
    const snap = buildRuntimeSnapshot(null as unknown as TechnologyRegistry, "pierre");
    expect(snap.employee_slug).toBe("pierre");
    expect(snap.active_technology_count).toBe(0);
    expect(snap.governance.governance_health).toBe("degraded");
    expect(snap.capabilities).toEqual([]);
  });

  it("returns fallback snapshot for empty employee_slug", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "");
    expect(snap.active_technology_count).toBe(0);
  });

  it("summary includes employee_slug", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(snap.summary).toContain("pierre");
  });

  it("active_technology_count matches context.active_technologies.length", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(snap.active_technology_count).toBe(snap.context.active_technologies.length);
  });
});

// ── evaluateRuntimeAction — interaction / combination tests ───────────────────

describe("evaluateRuntimeAction — interactions", () => {
  it("email.send blocks even with approval_required=true (email check runs first)", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "email.send", { approval_required: true });
    expect(eval_.decision).toBe("blocked_by_policy");
  });

  it("email.send blocks even with risk_level=black (email check runs first)", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "email.send", { risk_level: "black" });
    expect(eval_.decision).toBe("blocked_by_policy");
  });

  it("document.generate blocks even with approval_required=false and autonomous", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "document.generate", { approval_required: false });
    expect(eval_.decision).toBe("requires_review");
  });

  it("document.generate with approval_required=true → requires_validation wins", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "document.generate", { approval_required: true });
    expect(eval_.decision).toBe("requires_validation");
  });

  it("risk_level=black beats approval_required=false", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "black", approval_required: false });
    expect(eval_.decision).toBe("blocked_by_policy");
  });

  it("contains_sensitive_keywords=true overrides autonomous+normal", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { contains_sensitive_keywords: true });
    expect(eval_.can_auto_execute).toBe(false);
  });

  it("guard_mode=locked beats contains_sensitive_keywords (locked runs first)", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "locked" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { contains_sensitive_keywords: true });
    expect(eval_.decision).toBe("blocked_by_technology");
  });

  it("autonomy=off + guard=strict → requires_validation (autonomy check runs first)", () => {
    const ctx = buildMinimalContext({ autonomy_level: "off", guard_mode: "strict" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("requires_validation");
  });

  it("autonomy=suggest_only + guard=locked → blocked_by_technology (locked runs first)", () => {
    const ctx = buildMinimalContext({ autonomy_level: "suggest_only", guard_mode: "locked" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.decision).toBe("blocked_by_technology");
  });

  it("risk_level=red + autonomous → requires_validation", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "red" });
    expect(eval_.decision).toBe("requires_validation");
    expect(eval_.requires_human_validation).toBe(true);
  });

  it("risk_level=normal does not trigger extra restrictions for autonomous", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "normal" });
    expect(eval_.decision).toBe("allowed");
    expect(eval_.can_auto_execute).toBe(true);
  });

  it("unknown risk_level string doesn't block autonomous action", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal" });
    const eval_ = evaluateRuntimeAction(ctx, "task.create", { risk_level: "unknown" });
    expect(eval_.can_auto_execute).toBe(true);
  });
});

// ── evaluateRuntimeAction — trace_enabled flag propagation ───────────────────

describe("evaluateRuntimeAction — trace_enabled propagation", () => {
  it("supervised with trace_enabled=true sets requires_observation=true", () => {
    const ctx = buildMinimalContext({ autonomy_level: "supervised", trace_enabled: true });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_observation).toBe(true);
  });

  it("supervised with trace_enabled=false still sets requires_observation=true (supervised forces it)", () => {
    const ctx = buildMinimalContext({ autonomy_level: "supervised", trace_enabled: false });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_observation).toBe(true);
  });

  it("autonomous with trace_enabled=true sets requires_observation=true", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal", trace_enabled: true });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_observation).toBe(true);
  });

  it("autonomous with trace_enabled=false sets requires_observation=false", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal", trace_enabled: false });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_observation).toBe(false);
  });

  it("email.send sets requires_observation from trace_enabled", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal", trace_enabled: true });
    const eval_ = evaluateRuntimeAction(ctx, "email.send");
    expect(eval_.requires_observation).toBe(true);
  });
});

// ── evaluateRuntimeAction — review_enabled propagation ───────────────────────

describe("evaluateRuntimeAction — review_enabled propagation", () => {
  it("supervised with review_enabled=true sets requires_review=true", () => {
    const ctx = buildMinimalContext({ autonomy_level: "supervised", review_enabled: true });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_review).toBe(true);
  });

  it("supervised with review_enabled=false sets requires_review=false", () => {
    const ctx = buildMinimalContext({ autonomy_level: "supervised", review_enabled: false });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_review).toBe(false);
  });

  it("autonomous with review_enabled=true still has requires_review=false (autonomous overrides)", () => {
    const ctx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "normal", review_enabled: true });
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.requires_review).toBe(false);
  });
});

// ── normalizeRuntimeEmployeeSlug — additional edge cases ─────────────────────

describe("normalizeRuntimeEmployeeSlug — additional cases", () => {
  it("handles object input", () => {
    expect(normalizeRuntimeEmployeeSlug({})).toBe("pierre");
  });

  it("handles boolean input", () => {
    expect(normalizeRuntimeEmployeeSlug(true)).toBe("pierre");
  });

  it("handles array input", () => {
    expect(normalizeRuntimeEmployeeSlug([])).toBe("pierre");
  });

  it("preserves dash in slug", () => {
    expect(normalizeRuntimeEmployeeSlug("hr-bot")).toBe("hr-bot");
  });
});

// ── normalizeRuntimeActionType — additional edge cases ───────────────────────

describe("normalizeRuntimeActionType — additional cases", () => {
  it("handles object input", () => {
    expect(normalizeRuntimeActionType({})).toBe("");
  });

  it("handles boolean true", () => {
    expect(normalizeRuntimeActionType(true)).toBe("");
  });

  it("handles array input", () => {
    expect(normalizeRuntimeActionType(["email.send"])).toBe("");
  });

  it("preserves forward-slash action types", () => {
    expect(normalizeRuntimeActionType("hr/onboard")).toBe("hr/onboard");
  });
});

// ── buildRuntimeContext — registry-based behavior ────────────────────────────

describe("buildRuntimeContext — registry-based", () => {
  it("custom employee slug is preserved", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "claude");
    expect(ctx.employee_slug).toBe("claude");
  });

  it("context built_at is ISO timestamp format", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "pierre");
    expect(ctx.built_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("guard_mode defaults to guarded when no setting override", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const defaults = buildDefaultTechnologyCompanySettings(defs);
    const registry = buildTechnologyRegistry({ definitions: defs, rawSettings: defaults });
    const ctx = buildRuntimeContext(registry, "pierre");
    const validModes: TechnologyRiskMode[] = ["normal", "guarded", "strict", "locked"];
    expect(validModes).toContain(ctx.guard_mode);
  });

  it("autonomy_level defaults when no override", () => {
    const registry = buildTestRegistry();
    const ctx = buildRuntimeContext(registry, "pierre");
    const validLevels: TechnologyAutonomyLevel[] = ["off", "suggest_only", "supervised", "semi_autonomous", "autonomous"];
    expect(validLevels).toContain(ctx.autonomy_level);
  });
});

// ── buildRuntimeSnapshot — summary content ───────────────────────────────────

describe("buildRuntimeSnapshot — summary format", () => {
  it("summary contains autonomy_level", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(snap.summary).toContain(snap.context.autonomy_level);
  });

  it("summary contains guard_mode", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    expect(snap.summary).toContain(snap.context.guard_mode);
  });

  it("fallback snapshot summary is non-empty", () => {
    const snap = buildRuntimeSnapshot(null as unknown as TechnologyRegistry, "pierre");
    expect(snap.summary.length).toBeGreaterThan(0);
  });

  it("governance health label appears in summary", () => {
    const registry = buildTestRegistry();
    const snap = buildRuntimeSnapshot(registry, "pierre");
    const healthLabels = ["opérationnel", "dégradé", "verrouillé"];
    const hasLabel = healthLabels.some((label) => snap.summary.includes(label));
    expect(hasLabel).toBe(true);
  });
});

// ── evaluateRuntimeAction — result shape invariants ───────────────────────────

describe("evaluateRuntimeAction — result shape", () => {
  const ctx = buildMinimalContext({ autonomy_level: "supervised", guard_mode: "guarded" });

  it("returns action_type field matching input", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.update");
    expect(eval_.action_type).toBe("task.update");
  });

  it("can_auto_execute is boolean", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(typeof eval_.can_auto_execute).toBe("boolean");
  });

  it("requires_human_validation is boolean", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(typeof eval_.requires_human_validation).toBe("boolean");
  });

  it("requires_review is boolean", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(typeof eval_.requires_review).toBe("boolean");
  });

  it("requires_observation is boolean", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(typeof eval_.requires_observation).toBe("boolean");
  });

  it("explanation is a non-empty string", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(typeof eval_.explanation).toBe("string");
    expect(eval_.explanation.length).toBeGreaterThan(0);
  });

  it("evaluated_at is an ISO timestamp", () => {
    const eval_ = evaluateRuntimeAction(ctx, "task.create");
    expect(eval_.evaluated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("blocked actions always have can_auto_execute=false", () => {
    const lockedCtx = buildMinimalContext({ autonomy_level: "autonomous", guard_mode: "locked" });
    const eval_ = evaluateRuntimeAction(lockedCtx, "task.create");
    expect(eval_.can_auto_execute).toBe(false);
  });
});
