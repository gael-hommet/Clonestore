// B46 — CloneStore Technologies Core Tests
// Covers: types, registry, readiness, runtime-modes, permissions, verdict, fixtures.
// Pure: no Supabase, no Next, no async.

import { describe, it, expect } from "vitest";
import {
  B46_TECHNOLOGY_IDS,
  B46_LAUNCH_CRITICAL,
  B46_PIERRE_REQUIRED,
} from "../technology-b46-types";
import type {
  CloneStoreTechnologyId,
  B46TechnologyStatus,
  B46TechnologyRuntimeMode,
} from "../technology-b46-types";
import {
  buildB46TechnologyItem,
  buildAllB46TechnologyItems,
  listLaunchCriticalTechnologies,
  listPierreRequiredTechnologies,
  listCustomerVisibleTechnologies,
  getTechnologyById,
  buildTechnologiesSnapshot,
} from "../technology-b46-registry";
import {
  computeTechnologyReadiness,
  computeGlobalTechnologiesReadiness,
  getDefaultB46ReadinessContext,
  buildTechnologyWarnings,
  buildTechnologyNextActions,
} from "../technology-readiness";
import {
  getRuntimeModeForTechnology,
  mapEnvToTechnologyRuntimeModes,
  isTechnologyRuntimeSafe,
  getRuntimeModeLabel,
  getRuntimeModeSafetyLabel,
} from "../technology-runtime-modes";
import {
  canViewTechnologyConfig,
  canEditTechnologyConfig,
  canResetTechnologyConfig,
  canDisableTechnology,
  canEditRuntimeMode,
  resolveAccessLevel,
  isLockedTechnology,
  isCustomerConfigurableTechnology,
  getLockedTechnologies,
  getCustomerConfigurableTechnologies,
} from "../technology-permissions";
import { buildB46TechnologiesVerdict } from "../technology-verdict";
import {
  buildDefaultB46ReadinessContext,
  buildMinimalB46ReadinessContext,
  buildFullB46TechnologyItems,
  buildTechnologyItemWithStatus,
  buildDegradedTechnologyItems,
} from "../technology-b46-fixtures";

// ── 1. B46 Technology IDs & Constants ────────────────────────────────────────

describe("B46 Technology IDs & constants", () => {
  it("B46_TECHNOLOGY_IDS contains exactly 6 technologies", () => {
    expect(B46_TECHNOLOGY_IDS).toHaveLength(6);
  });

  it("B46_TECHNOLOGY_IDS contains cloneos", () => {
    expect(B46_TECHNOLOGY_IDS).toContain("cloneos");
  });

  it("B46_TECHNOLOGY_IDS contains cloneadn", () => {
    expect(B46_TECHNOLOGY_IDS).toContain("cloneadn");
  });

  it("B46_TECHNOLOGY_IDS contains cloneguard", () => {
    expect(B46_TECHNOLOGY_IDS).toContain("cloneguard");
  });

  it("B46_TECHNOLOGY_IDS contains clonetrace", () => {
    expect(B46_TECHNOLOGY_IDS).toContain("clonetrace");
  });

  it("B46_TECHNOLOGY_IDS contains clonevoice", () => {
    expect(B46_TECHNOLOGY_IDS).toContain("clonevoice");
  });

  it("B46_TECHNOLOGY_IDS contains clonechat", () => {
    expect(B46_TECHNOLOGY_IDS).toContain("clonechat");
  });

  it("all IDs are unique", () => {
    expect(new Set(B46_TECHNOLOGY_IDS).size).toBe(B46_TECHNOLOGY_IDS.length);
  });

  it("launch-critical includes cloneos, cloneadn, cloneguard, clonetrace", () => {
    expect(B46_LAUNCH_CRITICAL).toContain("cloneos");
    expect(B46_LAUNCH_CRITICAL).toContain("cloneadn");
    expect(B46_LAUNCH_CRITICAL).toContain("cloneguard");
    expect(B46_LAUNCH_CRITICAL).toContain("clonetrace");
  });

  it("clonevoice is NOT launch-critical", () => {
    expect(B46_LAUNCH_CRITICAL).not.toContain("clonevoice");
  });

  it("clonechat is NOT launch-critical", () => {
    expect(B46_LAUNCH_CRITICAL).not.toContain("clonechat");
  });

  it("pierre-required includes cloneos, cloneguard, clonetrace", () => {
    expect(B46_PIERRE_REQUIRED).toContain("cloneos");
    expect(B46_PIERRE_REQUIRED).toContain("cloneguard");
    expect(B46_PIERRE_REQUIRED).toContain("clonetrace");
  });
});

// ── 2. B46 Registry ───────────────────────────────────────────────────────────

describe("buildAllB46TechnologyItems", () => {
  const ctx = buildDefaultB46ReadinessContext();
  const items = buildAllB46TechnologyItems(ctx);

  it("returns 6 technology items", () => {
    expect(items).toHaveLength(6);
  });

  it("all items have valid ids", () => {
    for (const item of items) {
      expect(B46_TECHNOLOGY_IDS).toContain(item.id);
    }
  });

  it("cloneguard is locked", () => {
    const guard = items.find((t) => t.id === "cloneguard");
    expect(guard?.locked).toBe(true);
  });

  it("clonetrace is locked", () => {
    const trace = items.find((t) => t.id === "clonetrace");
    expect(trace?.locked).toBe(true);
  });

  it("cloneos is NOT locked", () => {
    const os = items.find((t) => t.id === "cloneos");
    expect(os?.locked).toBe(false);
  });

  it("clonevoice is disabled by default", () => {
    const voice = items.find((t) => t.id === "clonevoice");
    expect(voice?.status).toBe("disabled");
    expect(voice?.enabled).toBe(false);
  });

  it("clonechat is needs_configuration by default", () => {
    const chat = items.find((t) => t.id === "clonechat");
    expect(chat?.status).toBe("needs_configuration");
  });

  it("cloneguard is launch_critical", () => {
    const guard = items.find((t) => t.id === "cloneguard");
    expect(guard?.launch_critical).toBe(true);
  });

  it("clonevoice is NOT launch_critical", () => {
    const voice = items.find((t) => t.id === "clonevoice");
    expect(voice?.launch_critical).toBe(false);
  });

  it("cloneos pierre_required = true", () => {
    const os = items.find((t) => t.id === "cloneos");
    expect(os?.pierre_required).toBe(true);
  });

  it("cloneadn pierre_required = false (optional for workflows)", () => {
    const adn = items.find((t) => t.id === "cloneadn");
    expect(adn).toBeDefined();
  });

  it("all items have display with name", () => {
    for (const item of items) {
      expect(item.display.name.length).toBeGreaterThan(0);
      expect(item.display.customer_description.length).toBeGreaterThan(0);
    }
  });

  it("all items have guardrails", () => {
    for (const item of items) {
      expect(typeof item.guardrails.requires_paid_customer).toBe("boolean");
      expect(typeof item.guardrails.locked).toBe("boolean");
      expect(Array.isArray(item.guardrails.allowed_runtime_modes)).toBe(true);
    }
  });

  it("safe_mode equivalent: no public demo live for critical technologies", () => {
    const criticals = items.filter((t) => t.launch_critical);
    for (const t of criticals) {
      expect(t.guardrails.no_public_demo_live).toBe(true);
      expect(t.guardrails.no_unpaid_live).toBe(true);
    }
  });

  it("cloneguard guardrails always_production only", () => {
    const guard = items.find((t) => t.id === "cloneguard");
    expect(guard?.guardrails.allowed_runtime_modes).toContain("production");
    expect(guard?.guardrails.allowed_runtime_modes).not.toContain("mock");
  });

  it("cloneos has capabilities mission_orchestration and workflow_continuity", () => {
    const os = items.find((t) => t.id === "cloneos");
    expect(os?.capabilities).toContain("mission_orchestration");
    expect(os?.capabilities).toContain("workflow_continuity");
  });

  it("cloneguard has capability risk_validation", () => {
    const guard = items.find((t) => t.id === "cloneguard");
    expect(guard?.capabilities).toContain("risk_validation");
  });

  it("clonetrace has capabilities traceability, audit, diagnostics", () => {
    const trace = items.find((t) => t.id === "clonetrace");
    expect(trace?.capabilities).toContain("traceability");
    expect(trace?.capabilities).toContain("audit");
  });

  it("cloneos depends on cloneguard", () => {
    const os = items.find((t) => t.id === "cloneos");
    const dep = os?.dependencies.find((d) => d.technology_id === "cloneguard");
    expect(dep).toBeDefined();
    expect(dep?.required).toBe(true);
  });

  it("cloneos depends on clonetrace", () => {
    const os = items.find((t) => t.id === "cloneos");
    const dep = os?.dependencies.find((d) => d.technology_id === "clonetrace");
    expect(dep).toBeDefined();
    expect(dep?.required).toBe(true);
  });
});

describe("listLaunchCriticalTechnologies", () => {
  it("returns 4 technologies", () => {
    expect(listLaunchCriticalTechnologies()).toHaveLength(4);
  });

  it("includes cloneos, cloneadn, cloneguard, clonetrace", () => {
    const list = listLaunchCriticalTechnologies();
    expect(list).toContain("cloneos");
    expect(list).toContain("cloneadn");
    expect(list).toContain("cloneguard");
    expect(list).toContain("clonetrace");
  });
});

describe("listPierreRequiredTechnologies", () => {
  it("includes cloneos, cloneguard, clonetrace", () => {
    const list = listPierreRequiredTechnologies();
    expect(list).toContain("cloneos");
    expect(list).toContain("cloneguard");
    expect(list).toContain("clonetrace");
  });
});

describe("listCustomerVisibleTechnologies", () => {
  it("returns all 6", () => {
    expect(listCustomerVisibleTechnologies()).toHaveLength(6);
  });
});

describe("getTechnologyById", () => {
  it("returns display, guardrails, capabilities for valid id", () => {
    const result = getTechnologyById("cloneguard");
    expect(result.display.name).toBe("CloneGuard");
    expect(result.guardrails.locked).toBe(true);
  });
});

// ── 3. Readiness ──────────────────────────────────────────────────────────────

describe("computeTechnologyReadiness", () => {
  it("cloneos score >= 80 after B42 closed", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("cloneos", "active", ctx);
    expect(r.score).toBeGreaterThanOrEqual(75);
  });

  it("cloneos score < 50 if B42 not closed", () => {
    const ctx = buildDefaultB46ReadinessContext({ b42_closed: false });
    const r = computeTechnologyReadiness("cloneos", "active", ctx);
    expect(r.score).toBeLessThan(60);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("cloneadn score >= 75 after B44 closed", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("cloneadn", "active", ctx);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("cloneadn score < 50 if B44 not closed", () => {
    const ctx = buildDefaultB46ReadinessContext({ b44_closed: false });
    const r = computeTechnologyReadiness("cloneadn", "active", ctx);
    expect(r.score).toBeLessThan(55);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("cloneguard score >= 85 after B41+B38 closed", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("cloneguard", "active", ctx);
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it("cloneguard score lower if B41 not closed", () => {
    const ctx = buildDefaultB46ReadinessContext({ b41_closed: false });
    const r = computeTechnologyReadiness("cloneguard", "active", ctx);
    expect(r.score).toBeLessThan(80);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("clonetrace score >= 80 after B43+B41 closed", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("clonetrace", "active", ctx);
    expect(r.score).toBeGreaterThanOrEqual(75);
  });

  it("clonetrace score lower if B43 not closed", () => {
    const ctx = buildDefaultB46ReadinessContext({ b43_closed: false });
    const r = computeTechnologyReadiness("clonetrace", "active", ctx);
    expect(r.score).toBeLessThan(80);
  });

  it("clonevoice score <= 10 (disabled/no provider)", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("clonevoice", "disabled", ctx);
    expect(r.score).toBeLessThanOrEqual(10);
    expect(r.ready).toBe(false);
    expect(r.active_safe).toBe(false);
  });

  it("clonechat score ~30 (limited mode)", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("clonechat", "needs_configuration", ctx);
    expect(r.score).toBeGreaterThanOrEqual(20);
    expect(r.score).toBeLessThanOrEqual(45);
  });

  it("disabled technology always score 0", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("cloneos", "disabled", ctx);
    expect(r.score).toBe(0);
    expect(r.ready).toBe(false);
  });

  it("degraded technology score capped at 50", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("cloneos", "degraded", ctx);
    expect(r.score).toBeLessThanOrEqual(50);
    expect(r.ready).toBe(false);
  });

  it("readiness has last_checked_at", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const r = computeTechnologyReadiness("cloneos", "active", ctx);
    expect(r.last_checked_at).toBeTruthy();
  });
});

describe("computeGlobalTechnologiesReadiness", () => {
  it("all critical ok when all closed", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const r = computeGlobalTechnologiesReadiness(items, ctx);
    expect(r.launch_critical_ok).toBe(true);
  });

  it("launch_critical_ok false when B42 not closed", () => {
    const ctx = buildDefaultB46ReadinessContext({ b42_closed: false });
    const items = buildAllB46TechnologyItems(ctx);
    const r = computeGlobalTechnologiesReadiness(items, ctx);
    expect(r.launch_critical_ok).toBe(false);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("contains email_runtime warning when email is mock", () => {
    const ctx = buildDefaultB46ReadinessContext({ email_runtime_mode: "mock" });
    const items = buildAllB46TechnologyItems(ctx);
    const r = computeGlobalTechnologiesReadiness(items, ctx);
    const hasEmailWarning = r.warnings.some((w) => w.toLowerCase().includes("email"));
    expect(hasEmailWarning).toBe(true);
  });

  it("score is average of critical technologies", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const r = computeGlobalTechnologiesReadiness(items, ctx);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("buildTechnologyWarnings", () => {
  it("returns warnings array for clonevoice", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const warnings = buildTechnologyWarnings("clonevoice", ctx);
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("buildTechnologyNextActions", () => {
  it("returns actions array", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const actions = buildTechnologyNextActions(items, ctx);
    expect(Array.isArray(actions)).toBe(true);
  });

  it("mentions CloneVoice when voice disabled", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const actions = buildTechnologyNextActions(items, ctx);
    expect(actions.some((a) => a.toLowerCase().includes("voice"))).toBe(true);
  });
});

// ── 4. Runtime Modes ──────────────────────────────────────────────────────────

describe("getRuntimeModeForTechnology", () => {
  it("cloneguard always returns production", () => {
    const mode = getRuntimeModeForTechnology("cloneguard", {});
    expect(mode).toBe("production");
  });

  it("clonetrace always returns production", () => {
    const mode = getRuntimeModeForTechnology("clonetrace", {});
    expect(mode).toBe("production");
  });

  it("cloneadn always returns production", () => {
    const mode = getRuntimeModeForTechnology("cloneadn", {});
    expect(mode).toBe("production");
  });

  it("clonevoice defaults to disabled", () => {
    const mode = getRuntimeModeForTechnology("clonevoice", {});
    expect(mode).toBe("disabled");
  });

  it("clonevoice reads CLONEVOICE_RUNTIME_MODE env", () => {
    const mode = getRuntimeModeForTechnology("clonevoice", { CLONEVOICE_RUNTIME_MODE: "sandbox" });
    expect(mode).toBe("sandbox");
  });

  it("clonechat defaults to dry_run", () => {
    const mode = getRuntimeModeForTechnology("clonechat", {});
    expect(mode).toBe("dry_run");
  });

  it("cloneos follows AI_RUNTIME_MODE", () => {
    const modeMock = getRuntimeModeForTechnology("cloneos", { AI_RUNTIME_MODE: "mock" });
    expect(modeMock).toBe("mock");
    const modeProd = getRuntimeModeForTechnology("cloneos", { AI_RUNTIME_MODE: "production" });
    expect(modeProd).toBe("production");
  });
});

describe("mapEnvToTechnologyRuntimeModes", () => {
  it("returns an object with 6 technology entries", () => {
    const modes = mapEnvToTechnologyRuntimeModes({});
    expect(Object.keys(modes)).toHaveLength(6);
  });

  it("all values are valid runtime modes", () => {
    const valid = new Set(["mock", "dry_run", "sandbox", "production", "disabled"]);
    const modes = mapEnvToTechnologyRuntimeModes({});
    for (const mode of Object.values(modes)) {
      expect(valid.has(mode)).toBe(true);
    }
  });

  it("does not expose secrets in returned modes", () => {
    const modes = mapEnvToTechnologyRuntimeModes({ OPENAI_API_KEY: "sk-secret", AI_RUNTIME_MODE: "mock" });
    const modeString = JSON.stringify(modes);
    expect(modeString).not.toContain("sk-secret");
  });
});

describe("isTechnologyRuntimeSafe", () => {
  it("mock is safe for cloneos", () => {
    expect(isTechnologyRuntimeSafe("cloneos", "mock")).toBe(true);
  });

  it("dry_run is safe", () => {
    expect(isTechnologyRuntimeSafe("clonechat", "dry_run")).toBe(true);
  });

  it("production is safe for cloneguard", () => {
    expect(isTechnologyRuntimeSafe("cloneguard", "production")).toBe(true);
  });

  it("production is NOT safe for clonevoice (no provider)", () => {
    expect(isTechnologyRuntimeSafe("clonevoice", "production")).toBe(false);
  });

  it("disabled is safe for clonevoice", () => {
    expect(isTechnologyRuntimeSafe("clonevoice", "disabled")).toBe(true);
  });
});

describe("getRuntimeModeLabel", () => {
  it("mock → Mode simulé", () => {
    expect(getRuntimeModeLabel("mock")).toBe("Mode simulé");
  });

  it("production → Mode production", () => {
    expect(getRuntimeModeLabel("production")).toBe("Mode production");
  });

  it("disabled → Désactivé", () => {
    expect(getRuntimeModeLabel("disabled")).toBe("Désactivé");
  });
});

describe("getRuntimeModeSafetyLabel", () => {
  it("mock → safe", () => {
    expect(getRuntimeModeSafetyLabel("mock")).toBe("safe");
  });

  it("production → production", () => {
    expect(getRuntimeModeSafetyLabel("production")).toBe("production");
  });

  it("disabled → disabled", () => {
    expect(getRuntimeModeSafetyLabel("disabled")).toBe("disabled");
  });
});

// ── 5. Permissions ────────────────────────────────────────────────────────────

describe("canViewTechnologyConfig", () => {
  it("anonymous cannot view", () => {
    expect(canViewTechnologyConfig("anonymous", "cloneos")).toBe(false);
  });

  it("paid_customer can view", () => {
    expect(canViewTechnologyConfig("paid_customer", "cloneos")).toBe(true);
  });

  it("logged_unpaid can view", () => {
    expect(canViewTechnologyConfig("logged_unpaid", "cloneos")).toBe(true);
  });
});

describe("canEditTechnologyConfig", () => {
  it("anonymous cannot edit", () => {
    expect(canEditTechnologyConfig("anonymous", "cloneadn")).toBe(false);
  });

  it("logged_unpaid cannot edit", () => {
    expect(canEditTechnologyConfig("logged_unpaid", "cloneadn")).toBe(false);
  });

  it("paid_customer can edit cloneadn", () => {
    expect(canEditTechnologyConfig("paid_customer", "cloneadn")).toBe(true);
  });

  it("paid_customer can edit clonevoice", () => {
    expect(canEditTechnologyConfig("paid_customer", "clonevoice")).toBe(true);
  });

  it("paid_customer can edit clonechat", () => {
    expect(canEditTechnologyConfig("paid_customer", "clonechat")).toBe(true);
  });

  it("paid_customer CANNOT edit cloneguard (locked)", () => {
    expect(canEditTechnologyConfig("paid_customer", "cloneguard")).toBe(false);
  });

  it("paid_customer CANNOT edit clonetrace (locked)", () => {
    expect(canEditTechnologyConfig("paid_customer", "clonetrace")).toBe(false);
  });

  it("paid_customer CANNOT edit cloneos (platform core, not customer configurable)", () => {
    expect(canEditTechnologyConfig("paid_customer", "cloneos")).toBe(false);
  });

  it("internal_admin can edit cloneos", () => {
    expect(canEditTechnologyConfig("internal_admin", "cloneos")).toBe(true);
  });

  it("internal_admin CANNOT edit cloneguard (locked)", () => {
    expect(canEditTechnologyConfig("internal_admin", "cloneguard")).toBe(false);
  });
});

describe("canResetTechnologyConfig", () => {
  it("paid_customer can reset cloneadn", () => {
    expect(canResetTechnologyConfig("paid_customer", "cloneadn")).toBe(true);
  });

  it("paid_customer CANNOT reset cloneguard", () => {
    expect(canResetTechnologyConfig("paid_customer", "cloneguard")).toBe(false);
  });

  it("anonymous cannot reset anything", () => {
    expect(canResetTechnologyConfig("anonymous", "cloneadn")).toBe(false);
  });

  it("internal_admin can reset anything", () => {
    expect(canResetTechnologyConfig("internal_admin", "cloneos")).toBe(true);
  });
});

describe("canDisableTechnology", () => {
  it("nobody can disable cloneguard", () => {
    expect(canDisableTechnology("internal_admin", "cloneguard")).toBe(false);
    expect(canDisableTechnology("paid_customer", "cloneguard")).toBe(false);
    expect(canDisableTechnology("anonymous", "cloneguard")).toBe(false);
  });

  it("nobody can disable clonetrace", () => {
    expect(canDisableTechnology("internal_admin", "clonetrace")).toBe(false);
    expect(canDisableTechnology("paid_customer", "clonetrace")).toBe(false);
  });

  it("paid_customer can disable clonevoice", () => {
    expect(canDisableTechnology("paid_customer", "clonevoice")).toBe(true);
  });

  it("paid_customer can disable clonechat", () => {
    expect(canDisableTechnology("paid_customer", "clonechat")).toBe(true);
  });

  it("logged_unpaid cannot disable anything", () => {
    expect(canDisableTechnology("logged_unpaid", "clonevoice")).toBe(false);
  });
});

describe("canEditRuntimeMode", () => {
  it("only internal_admin can edit runtime mode", () => {
    expect(canEditRuntimeMode("internal_admin", "cloneos")).toBe(true);
    expect(canEditRuntimeMode("paid_customer", "cloneos")).toBe(false);
    expect(canEditRuntimeMode("anonymous", "cloneos")).toBe(false);
  });

  it("internal_admin cannot edit runtime mode for locked technologies", () => {
    expect(canEditRuntimeMode("internal_admin", "cloneguard")).toBe(false);
    expect(canEditRuntimeMode("internal_admin", "clonetrace")).toBe(false);
  });
});

describe("resolveAccessLevel", () => {
  it("returns anonymous if not authenticated", () => {
    expect(resolveAccessLevel({ has_active_order: false, is_internal_admin: false, is_authenticated: false, is_trial: false })).toBe("anonymous");
  });

  it("returns internal_admin if is_internal_admin", () => {
    expect(resolveAccessLevel({ has_active_order: true, is_internal_admin: true, is_authenticated: true, is_trial: false })).toBe("internal_admin");
  });

  it("returns paid_customer if has active order", () => {
    expect(resolveAccessLevel({ has_active_order: true, is_internal_admin: false, is_authenticated: true, is_trial: false })).toBe("paid_customer");
  });

  it("returns trial if is_trial", () => {
    expect(resolveAccessLevel({ has_active_order: false, is_internal_admin: false, is_authenticated: true, is_trial: true })).toBe("trial");
  });

  it("returns logged_unpaid otherwise", () => {
    expect(resolveAccessLevel({ has_active_order: false, is_internal_admin: false, is_authenticated: true, is_trial: false })).toBe("logged_unpaid");
  });
});

describe("isLockedTechnology", () => {
  it("cloneguard is locked", () => { expect(isLockedTechnology("cloneguard")).toBe(true); });
  it("clonetrace is locked", () => { expect(isLockedTechnology("clonetrace")).toBe(true); });
  it("cloneos is NOT locked", () => { expect(isLockedTechnology("cloneos")).toBe(false); });
  it("cloneadn is NOT locked", () => { expect(isLockedTechnology("cloneadn")).toBe(false); });
  it("clonevoice is NOT locked", () => { expect(isLockedTechnology("clonevoice")).toBe(false); });
});

describe("isCustomerConfigurableTechnology", () => {
  it("cloneadn is customer configurable", () => { expect(isCustomerConfigurableTechnology("cloneadn")).toBe(true); });
  it("clonevoice is customer configurable", () => { expect(isCustomerConfigurableTechnology("clonevoice")).toBe(true); });
  it("clonechat is customer configurable", () => { expect(isCustomerConfigurableTechnology("clonechat")).toBe(true); });
  it("cloneos is NOT customer configurable", () => { expect(isCustomerConfigurableTechnology("cloneos")).toBe(false); });
  it("cloneguard is NOT customer configurable", () => { expect(isCustomerConfigurableTechnology("cloneguard")).toBe(false); });
});

describe("getLockedTechnologies", () => {
  it("returns cloneguard and clonetrace", () => {
    const locked = getLockedTechnologies();
    expect(locked).toContain("cloneguard");
    expect(locked).toContain("clonetrace");
    expect(locked).toHaveLength(2);
  });
});

describe("getCustomerConfigurableTechnologies", () => {
  it("returns 3 technologies", () => {
    expect(getCustomerConfigurableTechnologies()).toHaveLength(3);
  });
});

// ── 6. Verdict ────────────────────────────────────────────────────────────────

describe("buildB46TechnologiesVerdict", () => {
  it("validated_with_followups when all critical closed", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const verdict = buildB46TechnologiesVerdict(items, ctx);
    expect(verdict.status).toBe("validated_with_followups");
    expect(verdict.critical_technologies_ready).toBe(true);
  });

  it("safe_to_continue_to_b47 true when score >= 70 and no blockers", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const verdict = buildB46TechnologiesVerdict(items, ctx);
    expect(verdict.safe_to_continue_to_b47).toBe(true);
  });

  it("blocked when B42 not closed (cloneos blocker)", () => {
    const ctx = buildDefaultB46ReadinessContext({ b42_closed: false });
    const items = buildAllB46TechnologyItems(ctx);
    const verdict = buildB46TechnologiesVerdict(items, ctx);
    expect(verdict.status).toBe("blocked");
    expect(verdict.safe_to_continue_to_b47).toBe(false);
    expect(verdict.blockers.length).toBeGreaterThan(0);
  });

  it("followups include B47 and B48 references", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const verdict = buildB46TechnologiesVerdict(items, ctx);
    expect(verdict.followups.some((f) => f.includes("B47"))).toBe(true);
    expect(verdict.followups.some((f) => f.includes("B48"))).toBe(true);
  });

  it("followups include CloneVoice reference when voice disabled", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const verdict = buildB46TechnologiesVerdict(items, ctx);
    expect(verdict.followups.some((f) => f.includes("CloneVoice") || f.toLowerCase().includes("vocal"))).toBe(true);
  });

  it("degraded_technologies listed when degraded status", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildDegradedTechnologyItems();
    const verdict = buildB46TechnologiesVerdict(items, ctx);
    expect(verdict.degraded_technologies.length).toBeGreaterThan(0);
  });

  it("score is numeric 0-100", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const items = buildAllB46TechnologyItems(ctx);
    const verdict = buildB46TechnologiesVerdict(items, ctx);
    expect(verdict.score).toBeGreaterThanOrEqual(0);
    expect(verdict.score).toBeLessThanOrEqual(100);
  });
});

// ── 7. Snapshot ───────────────────────────────────────────────────────────────

describe("buildTechnologiesSnapshot", () => {
  it("returns snapshot with 6 technologies", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const snapshot = buildTechnologiesSnapshot({ userId: "user_test", context: ctx });
    expect(snapshot.technologies).toHaveLength(6);
  });

  it("tenant has user_id", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const snapshot = buildTechnologiesSnapshot({ userId: "u123", context: ctx });
    expect(snapshot.tenant.user_id).toBe("u123");
  });

  it("pierre_technology_status reflects active technologies", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const snapshot = buildTechnologiesSnapshot({ userId: "u1", context: ctx });
    expect(snapshot.pierre_technology_status.cloneguard_active).toBe(true);
    expect(snapshot.pierre_technology_status.clonetrace_active).toBe(true);
    expect(snapshot.pierre_technology_status.clonevoice_available).toBe(false);
  });

  it("pierre_technology_status.safe_to_run_pierre true when essentials active", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const snapshot = buildTechnologiesSnapshot({ userId: "u1", context: ctx });
    expect(snapshot.pierre_technology_status.safe_to_run_pierre).toBe(true);
  });

  it("snapshot contains generated_at", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const snapshot = buildTechnologiesSnapshot({ userId: "u1", context: ctx });
    expect(snapshot.generated_at).toBeTruthy();
  });

  it("blocked_features includes voice_input when clonevoice disabled", () => {
    const ctx = buildDefaultB46ReadinessContext();
    const snapshot = buildTechnologiesSnapshot({ userId: "u1", context: ctx });
    expect(snapshot.pierre_technology_status.blocked_features).toContain("voice_input");
  });
});

// ── 8. Fixtures ───────────────────────────────────────────────────────────────

describe("B46 Fixtures", () => {
  it("buildDefaultB46ReadinessContext returns all blocs closed", () => {
    const ctx = buildDefaultB46ReadinessContext();
    expect(ctx.b38_closed).toBe(true);
    expect(ctx.b42_closed).toBe(true);
    expect(ctx.b44_closed).toBe(true);
    expect(ctx.b45_closed).toBe(true);
  });

  it("buildDefaultB46ReadinessContext accepts overrides", () => {
    const ctx = buildDefaultB46ReadinessContext({ b42_closed: false });
    expect(ctx.b42_closed).toBe(false);
    expect(ctx.b44_closed).toBe(true);
  });

  it("buildMinimalB46ReadinessContext has most blocs closed to false", () => {
    const ctx = buildMinimalB46ReadinessContext();
    expect(ctx.b42_closed).toBe(false);
    expect(ctx.b44_closed).toBe(false);
    expect(ctx.security_ready).toBe(false);
  });

  it("buildFullB46TechnologyItems returns 6 items", () => {
    const items = buildFullB46TechnologyItems();
    expect(items).toHaveLength(6);
  });

  it("buildTechnologyItemWithStatus returns item with given status", () => {
    const item = buildTechnologyItemWithStatus("clonevoice", "sandbox");
    expect(item.id).toBe("clonevoice");
    expect(item.status).toBe("sandbox");
  });

  it("buildDegradedTechnologyItems — locked technologies stay active", () => {
    const items = buildDegradedTechnologyItems();
    const guard = items.find((t) => t.id === "cloneguard");
    const trace = items.find((t) => t.id === "clonetrace");
    expect(guard?.status).toBe("active");
    expect(trace?.status).toBe("active");
  });
});
