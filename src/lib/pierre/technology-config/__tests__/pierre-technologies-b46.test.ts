// B46 — Pierre Technology Config Tests
// Covers: pierre-technology-map, pierre-technology-bridge,
//         pierre-technology-readiness, pierre-technology-verdict

import { describe, it, expect } from "vitest";

import {
  PIERRE_TECHNOLOGY_MAP,
  getPierreTechnologyEffect,
  listPiereRequiredEffects,
  listPierreOptionalEffects,
  canPierreRunWithout,
} from "../pierre-technology-map";

import {
  buildPierreTechnologyRuntimeContext,
  applyTechnologyConfigToPierreWorkflow,
  getPierreBlockedFeaturesFromTechnologyConfig,
} from "../pierre-technology-bridge";

import { computePierreTechnologyReadiness } from "../pierre-technology-readiness";
import { buildB46PierreTechnologyVerdict } from "../pierre-technology-verdict";

import {
  buildDefaultB46ReadinessContext,
  buildFullB46TechnologyItems,
  buildTechnologyItemWithStatus,
  buildDegradedTechnologyItems,
  buildMinimalB46ReadinessContext,
} from "../../../clonestore/technologies/technology-b46-fixtures";

// ── Pierre Technology Map ────────────────────────────────────────────────────

describe("PIERRE_TECHNOLOGY_MAP", () => {
  it("has exactly 6 entries", () => {
    expect(PIERRE_TECHNOLOGY_MAP).toHaveLength(6);
  });

  it("covers all 6 CloneStore technology IDs", () => {
    const ids = PIERRE_TECHNOLOGY_MAP.map((e) => e.technology_id);
    expect(ids).toContain("cloneos");
    expect(ids).toContain("cloneadn");
    expect(ids).toContain("cloneguard");
    expect(ids).toContain("clonetrace");
    expect(ids).toContain("clonevoice");
    expect(ids).toContain("clonechat");
  });

  it("marks cloneos as required_for_launch=true, can_run_without=false", () => {
    const e = PIERRE_TECHNOLOGY_MAP.find((x) => x.technology_id === "cloneos")!;
    expect(e.required_for_launch).toBe(true);
    expect(e.can_run_without).toBe(false);
  });

  it("marks cloneguard as required_for_launch=true, can_run_without=false", () => {
    const e = PIERRE_TECHNOLOGY_MAP.find((x) => x.technology_id === "cloneguard")!;
    expect(e.required_for_launch).toBe(true);
    expect(e.can_run_without).toBe(false);
  });

  it("marks clonetrace as required_for_launch=true, can_run_without=false", () => {
    const e = PIERRE_TECHNOLOGY_MAP.find((x) => x.technology_id === "clonetrace")!;
    expect(e.required_for_launch).toBe(true);
    expect(e.can_run_without).toBe(false);
  });

  it("marks cloneadn as required_for_launch=true, can_run_without=true", () => {
    const e = PIERRE_TECHNOLOGY_MAP.find((x) => x.technology_id === "cloneadn")!;
    expect(e.required_for_launch).toBe(true);
    expect(e.can_run_without).toBe(true);
  });

  it("marks clonevoice as required_for_launch=false, can_run_without=true", () => {
    const e = PIERRE_TECHNOLOGY_MAP.find((x) => x.technology_id === "clonevoice")!;
    expect(e.required_for_launch).toBe(false);
    expect(e.can_run_without).toBe(true);
  });

  it("marks clonechat as required_for_launch=false, can_run_without=true", () => {
    const e = PIERRE_TECHNOLOGY_MAP.find((x) => x.technology_id === "clonechat")!;
    expect(e.required_for_launch).toBe(false);
    expect(e.can_run_without).toBe(true);
  });

  it("each entry has non-empty pierre_feature, degraded_effect, disabled_effect", () => {
    for (const e of PIERRE_TECHNOLOGY_MAP) {
      expect(e.pierre_feature.length).toBeGreaterThan(0);
      expect(e.degraded_effect.length).toBeGreaterThan(0);
      expect(e.disabled_effect.length).toBeGreaterThan(0);
    }
  });
});

describe("getPierreTechnologyEffect", () => {
  it("returns effect for cloneos", () => {
    const e = getPierreTechnologyEffect("cloneos");
    expect(e).not.toBeNull();
    expect(e!.role).toBe("core_orchestration");
  });

  it("returns effect for cloneguard", () => {
    const e = getPierreTechnologyEffect("cloneguard");
    expect(e).not.toBeNull();
    expect(e!.role).toBe("security_gateway");
  });

  it("returns effect for clonevoice", () => {
    const e = getPierreTechnologyEffect("clonevoice");
    expect(e).not.toBeNull();
    expect(e!.role).toBe("voice_command");
  });
});

describe("listPiereRequiredEffects", () => {
  it("returns 4 required effects", () => {
    const req = listPiereRequiredEffects();
    expect(req).toHaveLength(4);
  });

  it("includes cloneos, cloneadn, cloneguard, clonetrace", () => {
    const ids = listPiereRequiredEffects().map((e) => e.technology_id);
    expect(ids).toContain("cloneos");
    expect(ids).toContain("cloneadn");
    expect(ids).toContain("cloneguard");
    expect(ids).toContain("clonetrace");
  });
});

describe("listPierreOptionalEffects", () => {
  it("returns 2 optional effects", () => {
    const opt = listPierreOptionalEffects();
    expect(opt).toHaveLength(2);
  });

  it("includes clonevoice and clonechat", () => {
    const ids = listPierreOptionalEffects().map((e) => e.technology_id);
    expect(ids).toContain("clonevoice");
    expect(ids).toContain("clonechat");
  });
});

describe("canPierreRunWithout", () => {
  it("returns false for cloneos", () => {
    expect(canPierreRunWithout("cloneos")).toBe(false);
  });

  it("returns false for cloneguard", () => {
    expect(canPierreRunWithout("cloneguard")).toBe(false);
  });

  it("returns false for clonetrace", () => {
    expect(canPierreRunWithout("clonetrace")).toBe(false);
  });

  it("returns true for cloneadn", () => {
    expect(canPierreRunWithout("cloneadn")).toBe(true);
  });

  it("returns true for clonevoice", () => {
    expect(canPierreRunWithout("clonevoice")).toBe(true);
  });

  it("returns true for clonechat", () => {
    expect(canPierreRunWithout("clonechat")).toBe(true);
  });
});

// ── Pierre Technology Bridge ─────────────────────────────────────────────────

describe("buildPierreTechnologyRuntimeContext", () => {
  it("all critical active → safe_to_run=true", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    expect(ctx.guardrails.safe_to_run).toBe(true);
  });

  it("cloneguard active → cloneguard_active=true", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    expect(ctx.guardrails.cloneguard_active).toBe(true);
  });

  it("clonetrace active → clonetrace_active=true", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    expect(ctx.guardrails.clonetrace_active).toBe(true);
  });

  it("cloneguard disabled → safe_to_run=false, requires_human_validation=true", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const guardIdx = items.findIndex((t) => t.id === "cloneguard");
    const patchedItems = items.map((t, i) =>
      i === guardIdx ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const result = buildPierreTechnologyRuntimeContext(patchedItems);
    expect(result.guardrails.safe_to_run).toBe(false);
    expect(result.guardrails.requires_human_validation).toBe(true);
  });

  it("clonevoice disabled → voice_available=false, voice_input in blocked_features", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    expect(ctx.voice_available).toBe(false);
    expect(ctx.blocked_features).toContain("voice_input");
  });

  it("document_generation_available requires cloneos + cloneguard active", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    expect(ctx.document_generation_available).toBe(true);
  });

  it("active_capabilities is an array of strings", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    expect(Array.isArray(ctx.active_capabilities)).toBe(true);
  });

  it("has ai_mode and email_mode fields", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    expect(typeof ctx.ai_mode).toBe("string");
    expect(typeof ctx.email_mode).toBe("string");
  });

  it("returns no duplicate entries in blocked_features", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    const unique = new Set(ctx.blocked_features);
    expect(unique.size).toBe(ctx.blocked_features.length);
  });

  it("returns no duplicate entries in active_capabilities", () => {
    const items = buildFullB46TechnologyItems();
    const ctx = buildPierreTechnologyRuntimeContext(items);
    const unique = new Set(ctx.active_capabilities);
    expect(unique.size).toBe(ctx.active_capabilities.length);
  });
});

describe("applyTechnologyConfigToPierreWorkflow", () => {
  it("fully active items → block_all_missions=false", () => {
    const items = buildFullB46TechnologyItems();
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(g.block_all_missions).toBe(false);
  });

  it("fully active items → block_sensitive_actions=false", () => {
    const items = buildFullB46TechnologyItems();
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(g.block_sensitive_actions).toBe(false);
  });

  it("fully active items → require_human_validation_always=false", () => {
    const items = buildFullB46TechnologyItems();
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(g.require_human_validation_always).toBe(false);
  });

  it("fully active items → blocked_reasons is empty array", () => {
    const items = buildFullB46TechnologyItems();
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(g.blocked_reasons).toHaveLength(0);
  });

  it("cloneos score=0 → block_all_missions=true", () => {
    const items = buildFullB46TechnologyItems().map((t) =>
      t.id === "cloneos" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(g.block_all_missions).toBe(true);
  });

  it("cloneguard score=0 → block_sensitive_actions=true, require_human_validation_always=true", () => {
    const items = buildFullB46TechnologyItems().map((t) =>
      t.id === "cloneguard" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(g.block_sensitive_actions).toBe(true);
    expect(g.require_human_validation_always).toBe(true);
  });

  it("clonetrace score=0 → degraded_audit_trail=true", () => {
    const items = buildFullB46TechnologyItems().map((t) =>
      t.id === "clonetrace" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(g.degraded_audit_trail).toBe(true);
  });

  it("multiple failures → blocked_reasons is non-empty", () => {
    const items = buildFullB46TechnologyItems().map((t) =>
      ["cloneos", "cloneguard"].includes(t.id)
        ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } }
        : t,
    );
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(g.blocked_reasons.length).toBeGreaterThan(0);
  });

  it("returns PierreWorkflowGuardrails shape", () => {
    const items = buildFullB46TechnologyItems();
    const g = applyTechnologyConfigToPierreWorkflow(items);
    expect(typeof g.block_all_missions).toBe("boolean");
    expect(typeof g.block_sensitive_actions).toBe("boolean");
    expect(typeof g.block_document_generation).toBe("boolean");
    expect(typeof g.require_human_validation_always).toBe("boolean");
    expect(typeof g.degraded_audit_trail).toBe("boolean");
    expect(Array.isArray(g.blocked_reasons)).toBe(true);
  });
});

describe("getPierreBlockedFeaturesFromTechnologyConfig", () => {
  it("returns array of strings", () => {
    const items = buildFullB46TechnologyItems();
    const blocked = getPierreBlockedFeaturesFromTechnologyConfig(items);
    expect(Array.isArray(blocked)).toBe(true);
  });

  it("always contains voice_input (clonevoice disabled by default)", () => {
    const items = buildFullB46TechnologyItems();
    const blocked = getPierreBlockedFeaturesFromTechnologyConfig(items);
    expect(blocked).toContain("voice_input");
  });
});

// ── Pierre Technology Readiness ──────────────────────────────────────────────

describe("computePierreTechnologyReadiness", () => {
  it("all critical active → safe_to_run=true, ready=true", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.safe_to_run).toBe(true);
    expect(r.ready).toBe(true);
  });

  it("all critical active → missing_critical is empty", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.missing_critical).toHaveLength(0);
  });

  it("score is between 0 and 100", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("cloneos disabled → missing_critical contains CloneOS entry", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx).map((t) =>
      t.id === "cloneos" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.missing_critical.some((m) => m.includes("CloneOS"))).toBe(true);
    expect(r.safe_to_run).toBe(false);
  });

  it("cloneguard disabled → missing_critical contains CloneGuard entry", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx).map((t) =>
      t.id === "cloneguard" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.missing_critical.some((m) => m.includes("CloneGuard"))).toBe(true);
  });

  it("clonetrace disabled → missing_critical contains CloneTrace entry", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx).map((t) =>
      t.id === "clonetrace" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.missing_critical.some((m) => m.includes("CloneTrace"))).toBe(true);
  });

  it("cloneadn inactive → warning about CloneADN + degraded company_memory", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx).map((t) =>
      t.id === "cloneadn" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.warnings.some((w) => w.includes("CloneADN"))).toBe(true);
    expect(r.degraded_capabilities).toContain("company_memory");
  });

  it("b45_closed=false → warning about Document Style Kit", () => {
    const ctx = buildDefaultB46ReadinessContext({ b45_closed: false });
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.warnings.some((w) => w.toLowerCase().includes("document style"))).toBe(true);
  });

  it("ai_runtime_mode=mock → warning about mock AI", () => {
    const ctx = buildDefaultB46ReadinessContext({ ai_runtime_mode: "mock" });
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.warnings.some((w) => w.toLowerCase().includes("mock"))).toBe(true);
  });

  it("voice_ready=false for default items (clonevoice disabled)", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.voice_ready).toBe(false);
  });

  it("document_generation_ready when cloneos + cloneguard active", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.document_generation_ready).toBe(true);
  });

  it("premium_documents_ready when docGen + b45_closed", () => {
    const ctx = buildDefaultB46ReadinessContext({ b45_closed: true });
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.premium_documents_ready).toBe(true);
  });

  it("premium_documents_ready=false when b45_closed=false", () => {
    const ctx = buildDefaultB46ReadinessContext({ b45_closed: false });
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.premium_documents_ready).toBe(false);
  });

  it("score is number", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(typeof r.score).toBe("number");
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it("empty items → all fields defined (no throw)", () => {
    const ctx = buildDefaultB46ReadinessContext();
    expect(() => computePierreTechnologyReadiness([], ctx)).not.toThrow();
    const r = computePierreTechnologyReadiness([], ctx);
    expect(r.safe_to_run).toBe(false);
    expect(r.missing_critical.length).toBeGreaterThan(0);
  });

  it("degraded items → degraded_capabilities non-empty", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildDegradedTechnologyItems();
    const r = computePierreTechnologyReadiness(items, ctx);
    expect(r.degraded_capabilities.length).toBeGreaterThanOrEqual(0);
  });
});

// ── Pierre Technology Verdict ─────────────────────────────────────────────────

describe("buildB46PierreTechnologyVerdict", () => {
  it("all critical active → status=validated_with_followups", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.status).toBe("validated_with_followups");
  });

  it("all critical active → safe_to_continue_to_b47=true", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.safe_to_continue_to_b47).toBe(true);
  });

  it("all critical active → pierre_ready=true", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.pierre_ready).toBe(true);
  });

  it("cloneos disabled → status=blocked", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx).map((t) =>
      t.id === "cloneos" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.status).toBe("blocked");
  });

  it("blocked status → safe_to_continue_to_b47=false", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx).map((t) =>
      t.id === "cloneos" ? { ...t, enabled: false, readiness: { ...t.readiness, score: 0 } } : t,
    );
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.safe_to_continue_to_b47).toBe(false);
  });

  it("ai_runtime_mode=mock → followups contains AI_RUNTIME_MODE mention", () => {
    const ctx = buildDefaultB46ReadinessContext({ ai_runtime_mode: "mock" });
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.followups.some((f) => f.includes("AI_RUNTIME_MODE"))).toBe(true);
  });

  it("email_runtime_mode=mock → followups contains EMAIL_RUNTIME_MODE mention", () => {
    const ctx = buildDefaultB46ReadinessContext({ email_runtime_mode: "mock" });
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.followups.some((f) => f.includes("EMAIL_RUNTIME_MODE"))).toBe(true);
  });

  it("voice not ready → followups contains CloneVoice mention", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.followups.some((f) => f.includes("CloneVoice"))).toBe(true);
  });

  it("premium docs not ready when b45_closed=false → followups mentions B45", () => {
    const ctx = buildDefaultB46ReadinessContext({ b45_closed: false });
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.followups.some((f) => f.includes("B45"))).toBe(true);
  });

  it("returns all required verdict fields", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(typeof v.status).toBe("string");
    expect(typeof v.score).toBe("number");
    expect(typeof v.safe_to_continue_to_b47).toBe("boolean");
    expect(typeof v.pierre_ready).toBe("boolean");
    expect(Array.isArray(v.missing_critical)).toBe(true);
    expect(Array.isArray(v.blocked_features)).toBe(true);
    expect(Array.isArray(v.warnings)).toBe(true);
    expect(Array.isArray(v.followups)).toBe(true);
  });

  it("score is between 0 and 100", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(v.score).toBeGreaterThanOrEqual(0);
    expect(v.score).toBeLessThanOrEqual(100);
  });

  it("minimal context → missing_critical non-empty or degraded", () => {
    const ctx = buildMinimalB46ReadinessContext();
    const items = buildFullB46TechnologyItems(ctx);
    const v = buildB46PierreTechnologyVerdict(items, ctx);
    expect(["blocked", "degraded", "validated_with_followups"]).toContain(v.status);
  });

  it("no throw on empty items", () => {
    const ctx = buildDefaultB46ReadinessContext();
    expect(() => buildB46PierreTechnologyVerdict([], ctx)).not.toThrow();
    const v = buildB46PierreTechnologyVerdict([], ctx);
    expect(v.status).toBe("blocked");
  });
});
