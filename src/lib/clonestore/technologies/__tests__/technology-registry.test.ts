// CloneStore Technologies Foundation — Registry + Storage Tests (Bloc 18 / 18.1)
// Pure module tests: no Supabase, no Next, no async, no side effects.

import { describe, it, expect } from "vitest";
import {
  getCloneStoreTechnologyDefinitions,
  getTechnologyDefinition,
  buildDefaultTechnologyCompanySettings,
  normalizeTechnologyCompanySetting,
  buildTechnologyRegistry,
  computeTechnologyRegistrySummary,
  resolveTechnologyForEmployee,
  isTechnologyEnabledForEmployee,
  buildTechnologyPublicDigest,
} from "../registry";
import {
  normalizeDbRow,
  mapRowToSetting,
  mapSettingToUpsertPayload,
  mapRowsToSettings,
  legacyExtractSettings,
  type CloneStoreTechnologyRow,
} from "../storage";
import type {
  TechnologyCompanySetting,
  TechnologySlug,
  TechnologyDefinition,
} from "../contracts";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALL_SLUGS: TechnologySlug[] = [
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonecontinuum",
  "clonetrust", "clonereview", "clonesignals", "clonelearn",
  "clonevoice", "clonechat", "clonebrief",
];

const PLATFORM_CORE_SLUGS: TechnologySlug[] = [
  "cloneos", "cloneguard", "clonetrace", "clonecontinuum",
];

const HUMAN_VALIDATION_SLUGS: TechnologySlug[] = ["clonereview", "clonelearn"];

function makeRegistry(overrides: Partial<TechnologyCompanySetting>[] = []) {
  const defs = getCloneStoreTechnologyDefinitions();
  const settings = buildDefaultTechnologyCompanySettings(defs);
  const patched = settings.map((s) => {
    const ov = overrides.find((o) => o.technology_slug === s.technology_slug);
    return ov ? { ...s, ...ov } : s;
  });
  return buildTechnologyRegistry({ definitions: defs, rawSettings: patched });
}

function settingFor(slug: TechnologySlug, overrides: Partial<TechnologyCompanySetting> = {}): TechnologyCompanySetting {
  const defs = getCloneStoreTechnologyDefinitions();
  const def = defs.find((d) => d.slug === slug)!;
  const base = buildDefaultTechnologyCompanySettings([def])[0];
  return { ...base, ...overrides };
}

// ── 1. getCloneStoreTechnologyDefinitions ─────────────────────────────────────

describe("getCloneStoreTechnologyDefinitions", () => {
  it("returns exactly 12 technologies", () => {
    expect(getCloneStoreTechnologyDefinitions()).toHaveLength(12);
  });

  it("all 12 expected slugs are present", () => {
    const slugs = getCloneStoreTechnologyDefinitions().map((d) => d.slug);
    for (const s of ALL_SLUGS) expect(slugs).toContain(s);
  });

  it("each definition has required string fields non-empty", () => {
    for (const d of getCloneStoreTechnologyDefinitions()) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.short_name.length).toBeGreaterThan(0);
      expect(d.public_label.length).toBeGreaterThan(0);
      expect(d.one_liner.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it("each definition has at least one capability", () => {
    for (const d of getCloneStoreTechnologyDefinitions()) {
      expect(d.capabilities.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("applies_to_employee_slugs is empty array for all (platform-wide by default)", () => {
    for (const d of getCloneStoreTechnologyDefinitions()) {
      expect(d.applies_to_employee_slugs).toEqual([]);
    }
  });

  it("every definition has a valid default_status", () => {
    const valid = new Set(["enabled", "disabled", "degraded", "maintenance", "not_configured"]);
    for (const d of getCloneStoreTechnologyDefinitions()) {
      expect(valid.has(d.default_status)).toBe(true);
    }
  });

  it("every definition has a valid default_autonomy", () => {
    const valid = new Set(["off", "suggest_only", "supervised", "semi_autonomous", "autonomous"]);
    for (const d of getCloneStoreTechnologyDefinitions()) {
      expect(valid.has(d.default_autonomy)).toBe(true);
    }
  });

  it("every definition has a valid default_risk_mode", () => {
    const valid = new Set(["normal", "guarded", "strict", "locked"]);
    for (const d of getCloneStoreTechnologyDefinitions()) {
      expect(valid.has(d.default_risk_mode)).toBe(true);
    }
  });

  it("created_for is 'all' for all definitions", () => {
    for (const d of getCloneStoreTechnologyDefinitions()) {
      expect(d.created_for).toBe("all");
    }
  });

  it("no two definitions share the same slug", () => {
    const slugs = getCloneStoreTechnologyDefinitions().map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

// ── 2. Platform-core invariants ───────────────────────────────────────────────

describe("platform-core invariants", () => {
  it("exactly 4 platform-core technologies exist", () => {
    const cores = getCloneStoreTechnologyDefinitions().filter((d) => d.is_platform_core);
    expect(cores).toHaveLength(4);
  });

  it("correct slugs are platform core", () => {
    const cores = getCloneStoreTechnologyDefinitions()
      .filter((d) => d.is_platform_core)
      .map((d) => d.slug);
    for (const s of PLATFORM_CORE_SLUGS) expect(cores).toContain(s);
  });

  it("platform core technologies default to enabled", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    for (const slug of PLATFORM_CORE_SLUGS) {
      const def = defs.find((d) => d.slug === slug)!;
      expect(def.default_status).toBe("enabled");
    }
  });

  it("CloneOS is not customer configurable", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "cloneos")!;
    expect(d.is_customer_configurable).toBe(false);
  });

  it("CloneTrace is not customer configurable", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonetrace")!;
    expect(d.is_customer_configurable).toBe(false);
  });

  it("CloneContinuum is not customer configurable", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonecontinuum")!;
    expect(d.is_customer_configurable).toBe(false);
  });

  it("CloneGuard is customer configurable (risk_mode adjustable)", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "cloneguard")!;
    expect(d.is_customer_configurable).toBe(true);
  });

  it("CloneGuard default_risk_mode is guarded", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "cloneguard")!;
    expect(d.default_risk_mode).toBe("guarded");
  });

  it("CloneTrace default_autonomy is autonomous", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonetrace")!;
    expect(d.default_autonomy).toBe("autonomous");
  });

  it("CloneContinuum default_autonomy is semi_autonomous", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonecontinuum")!;
    expect(d.default_autonomy).toBe("semi_autonomous");
  });
});

// ── 3. requires_human_validation invariants ───────────────────────────────────

describe("requires_human_validation invariants", () => {
  it("exactly 2 technologies require human validation", () => {
    const hv = getCloneStoreTechnologyDefinitions().filter((d) => d.requires_human_validation);
    expect(hv).toHaveLength(2);
  });

  it("CloneReview requires human validation", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonereview")!;
    expect(d.requires_human_validation).toBe(true);
  });

  it("CloneLearn requires human validation", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonelearn")!;
    expect(d.requires_human_validation).toBe(true);
  });

  it("CloneLearn default_risk_mode is strict", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonelearn")!;
    expect(d.default_risk_mode).toBe("strict");
  });

  it("platform core technologies do not require human validation", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    for (const slug of PLATFORM_CORE_SLUGS) {
      const def = defs.find((d) => d.slug === slug)!;
      expect(def.requires_human_validation).toBe(false);
    }
  });
});

// ── 4. CloneVoice specific invariants ─────────────────────────────────────────

describe("CloneVoice specific invariants", () => {
  it("CloneVoice default_status is disabled", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonevoice")!;
    expect(d.default_status).toBe("disabled");
  });

  it("CloneVoice visibility is beta", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonevoice")!;
    expect(d.visibility).toBe("beta");
  });

  it("CloneVoice is customer configurable", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonevoice")!;
    expect(d.is_customer_configurable).toBe(true);
  });

  it("CloneVoice is not platform core", () => {
    const d = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonevoice")!;
    expect(d.is_platform_core).toBe(false);
  });
});

// ── 5. getTechnologyDefinition ────────────────────────────────────────────────

describe("getTechnologyDefinition", () => {
  it("returns definition for valid slug 'cloneos'", () => {
    const def = getTechnologyDefinition("cloneos");
    expect(def).not.toBeNull();
    expect(def!.slug).toBe("cloneos");
  });

  it("returns definition for every valid slug", () => {
    for (const slug of ALL_SLUGS) {
      expect(getTechnologyDefinition(slug)).not.toBeNull();
    }
  });

  it("returns null for unknown slug", () => {
    expect(getTechnologyDefinition("unknowntech")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getTechnologyDefinition("")).toBeNull();
  });

  it("returns null for 'pierre' (not a tech slug)", () => {
    expect(getTechnologyDefinition("pierre")).toBeNull();
  });

  it("returns null for numeric string", () => {
    expect(getTechnologyDefinition("123")).toBeNull();
  });

  it("returned definition is the exact definition from the catalog", () => {
    const def = getTechnologyDefinition("cloneguard")!;
    expect(def.name).toBe("CloneGuard");
    expect(def.is_platform_core).toBe(true);
  });
});

// ── 6. buildDefaultTechnologyCompanySettings ──────────────────────────────────

describe("buildDefaultTechnologyCompanySettings", () => {
  it("returns one setting per definition", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    expect(settings).toHaveLength(defs.length);
  });

  it("each setting slug matches the definition slug", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    for (let i = 0; i < defs.length; i++) {
      expect(settings[i].technology_slug).toBe(defs[i].slug);
    }
  });

  it("default status matches definition default_status", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    for (let i = 0; i < defs.length; i++) {
      expect(settings[i].status).toBe(defs[i].default_status);
    }
  });

  it("default autonomy_level matches definition", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    for (let i = 0; i < defs.length; i++) {
      expect(settings[i].autonomy_level).toBe(defs[i].default_autonomy);
    }
  });

  it("default risk_mode matches definition", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    for (let i = 0; i < defs.length; i++) {
      expect(settings[i].risk_mode).toBe(defs[i].default_risk_mode);
    }
  });

  it("configuration_status defaults to 'missing'", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    for (const s of settings) {
      expect(s.configuration_status).toBe("missing");
    }
  });

  it("enabled_for_employee_slugs is empty array by default", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    for (const s of settings) {
      expect(s.enabled_for_employee_slugs).toEqual([]);
    }
  });

  it("disabled_for_employee_slugs is empty array by default", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    for (const s of settings) {
      expect(s.disabled_for_employee_slugs).toEqual([]);
    }
  });

  it("rule objects default to empty objects", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    for (const s of settings) {
      expect(s.custom_rules).toEqual({});
      expect(s.validation_rules).toEqual({});
      expect(s.notification_rules).toEqual({});
      expect(s.memory_rules).toEqual({});
    }
  });

  it("CloneVoice default setting has status=disabled", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    const voice = settings.find((s) => s.technology_slug === "clonevoice")!;
    expect(voice.status).toBe("disabled");
  });
});

// ── 7. normalizeTechnologyCompanySetting ─────────────────────────────────────

describe("normalizeTechnologyCompanySetting", () => {
  const cloneosDef = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "cloneos")!;
  const clonevoiceDef = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonevoice")!;

  it("null input returns defaults from definition", () => {
    const s = normalizeTechnologyCompanySetting(null, cloneosDef);
    expect(s.technology_slug).toBe("cloneos");
    expect(s.status).toBe(cloneosDef.default_status);
    expect(s.autonomy_level).toBe(cloneosDef.default_autonomy);
    expect(s.risk_mode).toBe(cloneosDef.default_risk_mode);
  });

  it("undefined input returns defaults from definition", () => {
    const s = normalizeTechnologyCompanySetting(undefined, cloneosDef);
    expect(s.technology_slug).toBe("cloneos");
    expect(s.status).toBe("enabled");
  });

  it("string input returns defaults", () => {
    const s = normalizeTechnologyCompanySetting("invalid", cloneosDef);
    expect(s.technology_slug).toBe("cloneos");
  });

  it("valid raw object is normalized correctly", () => {
    const raw = {
      technology_slug: "cloneos",
      status: "degraded",
      autonomy_level: "off",
      risk_mode: "strict",
      configuration_status: "configured",
      enabled_for_employee_slugs: ["pierre", "sophie"],
      disabled_for_employee_slugs: [],
      custom_rules: { key: "val" },
      validation_rules: {},
      notification_rules: {},
      memory_rules: {},
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
    };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.status).toBe("degraded");
    expect(s.autonomy_level).toBe("off");
    expect(s.risk_mode).toBe("strict");
    expect(s.configuration_status).toBe("configured");
    expect(s.enabled_for_employee_slugs).toEqual(["pierre", "sophie"]);
    expect(s.custom_rules).toEqual({ key: "val" });
  });

  it("invalid status falls back to definition default", () => {
    const raw = { status: "flying" };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.status).toBe("enabled");
  });

  it("invalid autonomy_level falls back to definition default", () => {
    const raw = { autonomy_level: "turbo" };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.autonomy_level).toBe("supervised");
  });

  it("invalid risk_mode falls back to definition default", () => {
    const raw = { risk_mode: "ultra" };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.risk_mode).toBe("normal");
  });

  it("non-array enabled_for_employee_slugs coerced to empty array", () => {
    const raw = { enabled_for_employee_slugs: "pierre" };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.enabled_for_employee_slugs).toEqual([]);
  });

  it("non-object custom_rules coerced to empty object", () => {
    const raw = { custom_rules: ["array"] };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.custom_rules).toEqual({});
  });

  it("technology_slug in raw object is respected if valid", () => {
    const raw = { technology_slug: "cloneos" };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.technology_slug).toBe("cloneos");
  });

  it("invalid technology_slug in raw falls back to definition slug", () => {
    const raw = { technology_slug: "notaslug" };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.technology_slug).toBe("cloneos");
  });

  it("CloneVoice normalized from null returns disabled", () => {
    const s = normalizeTechnologyCompanySetting(null, clonevoiceDef);
    expect(s.status).toBe("disabled");
  });

  it("array items with empty strings are filtered from employee slug arrays", () => {
    const raw = { enabled_for_employee_slugs: ["pierre", "", "  "] };
    const s = normalizeTechnologyCompanySetting(raw, cloneosDef);
    expect(s.enabled_for_employee_slugs).toEqual(["pierre"]);
  });
});

// ── 8. buildTechnologyRegistry ────────────────────────────────────────────────

describe("buildTechnologyRegistry", () => {
  it("returns registry with all 12 definitions", () => {
    const r = makeRegistry();
    expect(r.definitions).toHaveLength(12);
  });

  it("returns registry with 12 settings", () => {
    const r = makeRegistry();
    expect(r.settings).toHaveLength(12);
  });

  it("returns registry with 12 runtime_states", () => {
    const r = makeRegistry();
    expect(r.runtime_states).toHaveLength(12);
  });

  it("summary.total is 12", () => {
    const r = makeRegistry();
    expect(r.summary.total).toBe(12);
  });

  it("summary counts platform_core correctly (4)", () => {
    const r = makeRegistry();
    expect(r.summary.platform_core).toBe(4);
  });

  it("summary counts customer_configurable correctly", () => {
    const r = makeRegistry();
    const expected = getCloneStoreTechnologyDefinitions().filter((d) => d.is_customer_configurable).length;
    expect(r.summary.customer_configurable).toBe(expected);
  });

  it("CloneVoice has disabled status in runtime_state by default", () => {
    const r = makeRegistry();
    const state = r.runtime_states.find((s) => s.technology_slug === "clonevoice")!;
    expect(state.status).toBe("disabled");
  });

  it("health_score for disabled technology is 0", () => {
    const r = makeRegistry([{ technology_slug: "clonevoice", status: "disabled" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonevoice")!;
    expect(state.health_score).toBe(0);
  });

  it("health_score for not_configured is 10", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "not_configured" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonechat")!;
    expect(state.health_score).toBe(10);
  });

  it("health_score for maintenance is 30", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "maintenance" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonechat")!;
    expect(state.health_score).toBe(30);
  });

  it("health_score for degraded is 50", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "degraded" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonechat")!;
    expect(state.health_score).toBe(50);
  });

  it("health_score for enabled with missing config is 80", () => {
    const r = makeRegistry();
    const state = r.runtime_states.find((s) => s.technology_slug === "cloneos")!;
    expect(state.health_score).toBe(80);
  });

  it("runtime_state for degraded technology has a warning", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "degraded" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonechat")!;
    expect(state.warnings.length).toBeGreaterThan(0);
  });

  it("runtime_state for not_configured has a blocker", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "not_configured" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonechat")!;
    expect(state.blockers.length).toBeGreaterThan(0);
  });

  it("runtime_state for maintenance has a warning", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "maintenance" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonechat")!;
    expect(state.warnings.length).toBeGreaterThan(0);
  });

  it("runtime_state.configured is false for missing configuration_status", () => {
    const r = makeRegistry();
    const state = r.runtime_states.find((s) => s.technology_slug === "cloneos")!;
    expect(state.configured).toBe(false);
  });

  it("runtime_state.configured is true for 'configured' status", () => {
    const r = makeRegistry([{ technology_slug: "cloneos", configuration_status: "configured" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "cloneos")!;
    expect(state.configured).toBe(true);
  });

  it("runtime_state.configured is true for 'optimized' status", () => {
    const r = makeRegistry([{ technology_slug: "cloneos", configuration_status: "optimized" }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "cloneos")!;
    expect(state.configured).toBe(true);
  });

  it("active_for_employee_slugs excludes disabled employees", () => {
    const r = makeRegistry([{
      technology_slug: "clonechat",
      enabled_for_employee_slugs: ["pierre", "sophie"],
      disabled_for_employee_slugs: ["pierre"],
    }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonechat")!;
    expect(state.active_for_employee_slugs).not.toContain("pierre");
    expect(state.active_for_employee_slugs).toContain("sophie");
  });

  it("active_for_employee_slugs is empty when technology is disabled", () => {
    const r = makeRegistry([{
      technology_slug: "clonechat",
      status: "disabled",
      enabled_for_employee_slugs: ["pierre"],
    }]);
    const state = r.runtime_states.find((s) => s.technology_slug === "clonechat")!;
    expect(state.active_for_employee_slugs).toEqual([]);
  });

  it("last_event_at is null when no runtime events provided", () => {
    const r = makeRegistry();
    for (const state of r.runtime_states) {
      expect(state.last_event_at).toBeNull();
    }
  });

  it("runtime events populate last_event_at", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    const r = buildTechnologyRegistry({
      definitions: defs,
      rawSettings: settings,
      runtimeEvents: [
        { technology_slug: "cloneos", created_at: "2024-06-01T12:00:00.000Z" },
      ],
    });
    const state = r.runtime_states.find((s) => s.technology_slug === "cloneos")!;
    expect(state.last_event_at).toBe("2024-06-01T12:00:00.000Z");
  });
});

// ── 9. computeTechnologyRegistrySummary ───────────────────────────────────────

describe("computeTechnologyRegistrySummary", () => {
  it("total equals number of definitions", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    const summary = computeTechnologyRegistrySummary({ definitions: defs, settings });
    expect(summary.total).toBe(12);
  });

  it("enabled count correct (11 by default, CloneVoice disabled)", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    const summary = computeTechnologyRegistrySummary({ definitions: defs, settings });
    expect(summary.enabled).toBe(11);
    expect(summary.disabled).toBe(1);
  });

  it("degraded count increases when setting is degraded", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs).map((s) =>
      s.technology_slug === "clonechat" ? { ...s, status: "degraded" as const } : s,
    );
    const summary = computeTechnologyRegistrySummary({ definitions: defs, settings });
    expect(summary.degraded).toBe(1);
  });

  it("not_configured count increases when setting is not_configured", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs).map((s) =>
      s.technology_slug === "clonelearn" ? { ...s, status: "not_configured" as const } : s,
    );
    const summary = computeTechnologyRegistrySummary({ definitions: defs, settings });
    expect(summary.not_configured).toBe(1);
  });

  it("platform_core count is always 4", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    const summary = computeTechnologyRegistrySummary({ definitions: defs, settings });
    expect(summary.platform_core).toBe(4);
  });
});

// ── 10. isTechnologyEnabledForEmployee ────────────────────────────────────────

describe("isTechnologyEnabledForEmployee", () => {
  it("returns true for enabled technology with no employee filters", () => {
    const r = makeRegistry();
    expect(isTechnologyEnabledForEmployee(r, "cloneos", "pierre")).toBe(true);
  });

  it("returns false for unknown technology slug", () => {
    const r = makeRegistry();
    expect(isTechnologyEnabledForEmployee(r, "notreal", "pierre")).toBe(false);
  });

  it("returns false for CloneVoice (default disabled)", () => {
    const r = makeRegistry();
    expect(isTechnologyEnabledForEmployee(r, "clonevoice", "pierre")).toBe(false);
  });

  it("returns false when status is disabled", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "disabled" }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "pierre")).toBe(false);
  });

  it("returns false when status is not_configured", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "not_configured" }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "pierre")).toBe(false);
  });

  it("returns false when employee is in disabled_for list", () => {
    const r = makeRegistry([{
      technology_slug: "clonechat",
      disabled_for_employee_slugs: ["pierre"],
    }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "pierre")).toBe(false);
  });

  it("disabled_for_employee_slugs takes priority over enabled_for", () => {
    const r = makeRegistry([{
      technology_slug: "clonechat",
      enabled_for_employee_slugs: ["pierre"],
      disabled_for_employee_slugs: ["pierre"],
    }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "pierre")).toBe(false);
  });

  it("returns false when enabled_for is non-empty and employee not in list", () => {
    const r = makeRegistry([{
      technology_slug: "clonechat",
      enabled_for_employee_slugs: ["sophie"],
    }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "pierre")).toBe(false);
  });

  it("returns true when employee is in enabled_for list and not in disabled_for", () => {
    const r = makeRegistry([{
      technology_slug: "clonechat",
      enabled_for_employee_slugs: ["pierre", "sophie"],
    }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "pierre")).toBe(true);
  });

  it("returns true when enabled_for is empty (all employees inherit access)", () => {
    const r = makeRegistry([{
      technology_slug: "clonechat",
      enabled_for_employee_slugs: [],
    }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "alice")).toBe(true);
  });

  it("works for any employee slug, not just 'pierre'", () => {
    const r = makeRegistry();
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "alice")).toBe(true);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "sophie")).toBe(true);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "random_employee_42")).toBe(true);
  });

  it("maintenance status still returns true (not disabled)", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "maintenance" }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "pierre")).toBe(true);
  });

  it("degraded status still returns true (not disabled)", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "degraded" }]);
    expect(isTechnologyEnabledForEmployee(r, "clonechat", "pierre")).toBe(true);
  });
});

// ── 11. resolveTechnologyForEmployee ──────────────────────────────────────────

describe("resolveTechnologyForEmployee", () => {
  it("returns 11 technologies for 'pierre' with defaults (CloneVoice excluded)", () => {
    const r = makeRegistry();
    const resolved = resolveTechnologyForEmployee(r, "pierre");
    expect(resolved).toHaveLength(11);
  });

  it("does not include CloneVoice by default", () => {
    const r = makeRegistry();
    const slugs = resolveTechnologyForEmployee(r, "pierre").map((d) => d.slug);
    expect(slugs).not.toContain("clonevoice");
  });

  it("includes CloneVoice when explicitly enabled", () => {
    const r = makeRegistry([{ technology_slug: "clonevoice", status: "enabled" }]);
    const slugs = resolveTechnologyForEmployee(r, "pierre").map((d) => d.slug);
    expect(slugs).toContain("clonevoice");
  });

  it("excludes technology disabled for specific employee", () => {
    const r = makeRegistry([{
      technology_slug: "clonechat",
      disabled_for_employee_slugs: ["sophie"],
    }]);
    const sophieSlugs = resolveTechnologyForEmployee(r, "sophie").map((d) => d.slug);
    expect(sophieSlugs).not.toContain("clonechat");
    const pierreSlugs = resolveTechnologyForEmployee(r, "pierre").map((d) => d.slug);
    expect(pierreSlugs).toContain("clonechat");
  });

  it("result only contains TechnologyDefinition objects", () => {
    const r = makeRegistry();
    const resolved = resolveTechnologyForEmployee(r, "pierre");
    for (const def of resolved) {
      expect(typeof def.slug).toBe("string");
      expect(typeof def.name).toBe("string");
      expect(Array.isArray(def.capabilities)).toBe(true);
    }
  });

  it("same result for unknown employees (all default-enabled are accessible)", () => {
    const r = makeRegistry();
    const resolved = resolveTechnologyForEmployee(r, "brand_new_employee");
    expect(resolved).toHaveLength(11);
  });
});

// ── 12. buildTechnologyPublicDigest ───────────────────────────────────────────

describe("buildTechnologyPublicDigest", () => {
  it("returns a non-empty string", () => {
    const r = makeRegistry();
    const digest = buildTechnologyPublicDigest(r);
    expect(typeof digest).toBe("string");
    expect(digest.length).toBeGreaterThan(0);
  });

  it("mentions total count (12)", () => {
    const r = makeRegistry();
    const digest = buildTechnologyPublicDigest(r);
    expect(digest).toContain("12");
  });

  it("contains 'opérationnel' when all core technologies are enabled", () => {
    const r = makeRegistry();
    const digest = buildTechnologyPublicDigest(r);
    expect(digest.toLowerCase()).toContain("opérationnel");
  });

  it("warns about inactive core when a platform core is disabled", () => {
    const r = makeRegistry([{ technology_slug: "cloneos", status: "disabled" }]);
    const digest = buildTechnologyPublicDigest(r);
    expect(digest.toLowerCase()).toContain("inactif");
  });

  it("mentions degraded count when present", () => {
    const r = makeRegistry([{ technology_slug: "clonechat", status: "degraded" }]);
    const digest = buildTechnologyPublicDigest(r);
    expect(digest.toLowerCase()).toContain("dégradé");
  });

  it("mentions disabled count when non-zero", () => {
    const r = makeRegistry();
    const digest = buildTechnologyPublicDigest(r);
    expect(digest.toLowerCase()).toMatch(/désactiv/);
  });
});

// ── 13. no hardcoded 'pierre' assumption ─────────────────────────────────────

describe("no hardcoded 'pierre' assumption", () => {
  it("isTechnologyEnabledForEmployee works identically for any employee slug", () => {
    const r = makeRegistry();
    const employees = ["pierre", "alice", "sophie", "marc", "rh_bot"];
    for (const emp of employees) {
      const result = isTechnologyEnabledForEmployee(r, "cloneos", emp);
      expect(result).toBe(true);
    }
  });

  it("resolveTechnologyForEmployee returns same set for all employees with default settings", () => {
    const r = makeRegistry();
    const employees = ["pierre", "alice", "sophie"];
    const results = employees.map((emp) =>
      resolveTechnologyForEmployee(r, emp).map((d) => d.slug).sort(),
    );
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it("buildTechnologyRegistry does not reference 'pierre' internally in summary", () => {
    const r = makeRegistry();
    expect(JSON.stringify(r.summary)).not.toContain("pierre");
  });

  it("employee-scoped operations are fully parameterized", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs).map((s) =>
      s.technology_slug === "clonelearn"
        ? { ...s, disabled_for_employee_slugs: ["pierre"] }
        : s,
    );
    const r = buildTechnologyRegistry({ definitions: defs, rawSettings: settings });
    expect(isTechnologyEnabledForEmployee(r, "clonelearn", "pierre")).toBe(false);
    expect(isTechnologyEnabledForEmployee(r, "clonelearn", "alice")).toBe(true);
  });
});

// ── 14. Registry integrity ────────────────────────────────────────────────────

describe("registry integrity invariants", () => {
  it("every setting in registry corresponds to a known definition", () => {
    const r = makeRegistry();
    const defSlugs = new Set(r.definitions.map((d) => d.slug));
    for (const s of r.settings) {
      expect(defSlugs.has(s.technology_slug)).toBe(true);
    }
  });

  it("every runtime_state in registry corresponds to a known definition", () => {
    const r = makeRegistry();
    const defSlugs = new Set(r.definitions.map((d) => d.slug));
    for (const rs of r.runtime_states) {
      expect(defSlugs.has(rs.technology_slug)).toBe(true);
    }
  });

  it("summary.enabled + summary.disabled + summary.degraded + summary.not_configured <= total", () => {
    const r = makeRegistry();
    const { enabled, disabled, degraded, not_configured, total } = r.summary;
    expect(enabled + disabled + degraded + not_configured).toBeLessThanOrEqual(total);
  });

  it("health_score is within [0, 100]", () => {
    const r = makeRegistry();
    for (const state of r.runtime_states) {
      expect(state.health_score).toBeGreaterThanOrEqual(0);
      expect(state.health_score).toBeLessThanOrEqual(100);
    }
  });

  it("warnings and blockers are arrays for all runtime_states", () => {
    const r = makeRegistry();
    for (const state of r.runtime_states) {
      expect(Array.isArray(state.warnings)).toBe(true);
      expect(Array.isArray(state.blockers)).toBe(true);
    }
  });

  it("buildTechnologyRegistry is deterministic given same inputs", () => {
    const defs = getCloneStoreTechnologyDefinitions();
    const settings = buildDefaultTechnologyCompanySettings(defs);
    const r1 = buildTechnologyRegistry({ definitions: defs, rawSettings: settings });
    const r2 = buildTechnologyRegistry({ definitions: defs, rawSettings: settings });
    expect(r1.summary).toEqual(r2.summary);
    expect(r1.settings.map((s) => s.technology_slug)).toEqual(r2.settings.map((s) => s.technology_slug));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Storage module tests (Bloc 18.1)
// ═════════════════════════════════════════════════════════════════════════════

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<CloneStoreTechnologyRow> = {}): CloneStoreTechnologyRow {
  return {
    id: "row-uuid-001",
    user_id: "user-uuid-001",
    technology_key: "clonechat",
    technology_name: "CloneChat",
    enabled: true,
    mode: "normal",
    autonomy_level: "supervised",
    config_json: {},
    rules_json: [],
    preferences_json: {},
    limits_json: {},
    connections_json: {},
    metadata_json: {},
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function makeCompleteSetting(slug: TechnologySlug = "clonechat"): TechnologyCompanySetting {
  const defs = getCloneStoreTechnologyDefinitions();
  const base = buildDefaultTechnologyCompanySettings(defs).find((s) => s.technology_slug === slug)!;
  return { ...base, status: "enabled", autonomy_level: "supervised", risk_mode: "guarded" };
}

// ── 15. normalizeDbRow ────────────────────────────────────────────────────────

describe("normalizeDbRow", () => {
  it("returns null for null input", () => {
    expect(normalizeDbRow(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeDbRow(undefined)).toBeNull();
  });

  it("returns null for string input", () => {
    expect(normalizeDbRow("invalid")).toBeNull();
  });

  it("returns null for empty object (missing technology_key)", () => {
    expect(normalizeDbRow({})).toBeNull();
  });

  it("returns null for object with empty technology_key", () => {
    expect(normalizeDbRow({ technology_key: "  " })).toBeNull();
  });

  it("returns typed row for valid minimal input", () => {
    const row = normalizeDbRow({ technology_key: "cloneos" });
    expect(row).not.toBeNull();
    expect(row!.technology_key).toBe("cloneos");
  });

  it("coerces enabled to true when missing", () => {
    const row = normalizeDbRow({ technology_key: "cloneos" });
    expect(row!.enabled).toBe(true);
  });

  it("preserves enabled=false", () => {
    const row = normalizeDbRow({ technology_key: "clonevoice", enabled: false });
    expect(row!.enabled).toBe(false);
  });

  it("coerces non-object config_json to empty object", () => {
    const row = normalizeDbRow({ technology_key: "cloneos", config_json: "invalid" });
    expect(row!.config_json).toEqual({});
  });

  it("coerces non-array rules_json to empty array", () => {
    const row = normalizeDbRow({ technology_key: "cloneos", rules_json: "invalid" });
    expect(row!.rules_json).toEqual([]);
  });

  it("preserves valid config_json", () => {
    const cfg = { technology_slug: "cloneos", status: "enabled" };
    const row = normalizeDbRow({ technology_key: "cloneos", config_json: cfg });
    expect(row!.config_json).toEqual(cfg);
  });

  it("uses technology_key as technology_name fallback when name missing", () => {
    const row = normalizeDbRow({ technology_key: "cloneguard" });
    expect(row!.technology_name).toBe("cloneguard");
  });

  it("preserves technology_name when provided", () => {
    const row = normalizeDbRow({ technology_key: "cloneguard", technology_name: "CloneGuard" });
    expect(row!.technology_name).toBe("CloneGuard");
  });
});

// ── 16. mapRowToSetting — config_json path ────────────────────────────────────

describe("mapRowToSetting — config_json path (lossless)", () => {
  const clonechatDef = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonechat")!;

  it("uses config_json when it contains technology_slug", () => {
    const setting = makeCompleteSetting("clonechat");
    const row = makeRow({ config_json: setting as unknown as Record<string, unknown> });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.technology_slug).toBe("clonechat");
    expect(result.status).toBe("enabled");
    expect(result.risk_mode).toBe("guarded");
  });

  it("config_json round-trip is lossless for all fields", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.enabled_for_employee_slugs = ["pierre", "alice"];
    setting.disabled_for_employee_slugs = ["bob"];
    setting.custom_rules = { key1: "val1" };
    const row = makeRow({ config_json: setting as unknown as Record<string, unknown> });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.enabled_for_employee_slugs).toEqual(["pierre", "alice"]);
    expect(result.disabled_for_employee_slugs).toEqual(["bob"]);
    expect(result.custom_rules).toEqual({ key1: "val1" });
  });

  it("falls back to definition defaults if config_json status is invalid", () => {
    const cfg = { technology_slug: "clonechat", status: "flying" };
    const row = makeRow({ config_json: cfg });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.status).toBe(clonechatDef.default_status);
  });

  it("falls back to definition defaults if config_json autonomy is invalid", () => {
    const cfg = { technology_slug: "clonechat", autonomy_level: "turbo" };
    const row = makeRow({ config_json: cfg });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.autonomy_level).toBe(clonechatDef.default_autonomy);
  });

  it("preserves created_at from config_json if present", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.created_at = "2023-01-01T00:00:00.000Z";
    const row = makeRow({ config_json: setting as unknown as Record<string, unknown> });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.created_at).toBe("2023-01-01T00:00:00.000Z");
  });
});

// ── 17. mapRowToSetting — fallback synthesis path ────────────────────────────

describe("mapRowToSetting — column synthesis fallback", () => {
  const clonechatDef = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonechat")!;

  it("synthesizes disabled status from enabled=false", () => {
    const row = makeRow({ enabled: false, config_json: {} });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.status).toBe("disabled");
  });

  it("synthesizes enabled status from enabled=true", () => {
    const row = makeRow({ enabled: true, config_json: {} });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.status).toBe("enabled");
  });

  it("reads status from metadata_json.status if present", () => {
    const row = makeRow({
      enabled: true,
      config_json: {},
      metadata_json: { status: "degraded" },
    });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.status).toBe("degraded");
  });

  it("reads autonomy_level from row.autonomy_level", () => {
    const row = makeRow({ autonomy_level: "semi_autonomous", config_json: {} });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.autonomy_level).toBe("semi_autonomous");
  });

  it("reads risk_mode from row.mode", () => {
    const row = makeRow({ mode: "strict", config_json: {} });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.risk_mode).toBe("strict");
  });

  it("invalid mode falls back to definition default", () => {
    const row = makeRow({ mode: "ultra", config_json: {} });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.risk_mode).toBe(clonechatDef.default_risk_mode);
  });

  it("reads enabled_for from metadata_json", () => {
    const row = makeRow({
      config_json: {},
      metadata_json: { enabled_for_employee_slugs: ["pierre"] },
    });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.enabled_for_employee_slugs).toEqual(["pierre"]);
  });

  it("reads disabled_for from metadata_json", () => {
    const row = makeRow({
      config_json: {},
      metadata_json: { disabled_for_employee_slugs: ["alice"] },
    });
    const result = mapRowToSetting(row, clonechatDef);
    expect(result.disabled_for_employee_slugs).toEqual(["alice"]);
  });
});

// ── 18. mapSettingToUpsertPayload ─────────────────────────────────────────────

describe("mapSettingToUpsertPayload", () => {
  it("sets user_id and technology_key correctly", () => {
    const setting = makeCompleteSetting("clonechat");
    const payload = mapSettingToUpsertPayload(setting, "user-123", "CloneChat");
    expect(payload.user_id).toBe("user-123");
    expect(payload.technology_key).toBe("clonechat");
  });

  it("sets technology_name correctly", () => {
    const setting = makeCompleteSetting("clonechat");
    const payload = mapSettingToUpsertPayload(setting, "user-123", "CloneChat");
    expect(payload.technology_name).toBe("CloneChat");
  });

  it("enabled=true when status is enabled", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.status = "enabled";
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.enabled).toBe(true);
  });

  it("enabled=false when status is disabled", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.status = "disabled";
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.enabled).toBe(false);
  });

  it("enabled=false when status is not_configured", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.status = "not_configured";
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.enabled).toBe(false);
  });

  it("enabled=true when status is degraded (not fully disabled)", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.status = "degraded";
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.enabled).toBe(true);
  });

  it("enabled=true when status is maintenance", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.status = "maintenance";
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.enabled).toBe(true);
  });

  it("mode maps from risk_mode", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.risk_mode = "strict";
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.mode).toBe("strict");
  });

  it("autonomy_level mapped correctly", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.autonomy_level = "semi_autonomous";
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.autonomy_level).toBe("semi_autonomous");
  });

  it("config_json contains the complete TechnologyCompanySetting", () => {
    const setting = makeCompleteSetting("clonechat");
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.config_json).toMatchObject({ technology_slug: "clonechat" });
  });

  it("metadata_json contains status field", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.status = "degraded";
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.metadata_json.status).toBe("degraded");
  });

  it("metadata_json contains enabled_for_employee_slugs", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.enabled_for_employee_slugs = ["pierre"];
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.metadata_json.enabled_for_employee_slugs).toEqual(["pierre"]);
  });

  it("preferences_json contains notification_rules", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.notification_rules = { notify_on_error: true };
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.preferences_json).toEqual({ notify_on_error: true });
  });

  it("limits_json contains memory_rules", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.memory_rules = { max_context: 100 };
    const payload = mapSettingToUpsertPayload(setting, "u", "n");
    expect(payload.limits_json).toEqual({ max_context: 100 });
  });
});

// ── 19. round-trip: mapSettingToUpsertPayload → mapRowToSetting ───────────────

describe("storage round-trip (write → read)", () => {
  const clonechatDef = getCloneStoreTechnologyDefinitions().find((d) => d.slug === "clonechat")!;

  it("round-trip preserves technology_slug", () => {
    const setting = makeCompleteSetting("clonechat");
    const payload = mapSettingToUpsertPayload(setting, "u", "CloneChat");
    const syntheticRow = normalizeDbRow({
      ...payload,
      id: "new-id",
      created_at: setting.created_at,
      updated_at: setting.updated_at,
    })!;
    const result = mapRowToSetting(syntheticRow, clonechatDef);
    expect(result.technology_slug).toBe("clonechat");
  });

  it("round-trip preserves status", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.status = "degraded";
    const payload = mapSettingToUpsertPayload(setting, "u", "CloneChat");
    const syntheticRow = normalizeDbRow({ ...payload, id: "x", created_at: setting.created_at, updated_at: setting.updated_at })!;
    const result = mapRowToSetting(syntheticRow, clonechatDef);
    expect(result.status).toBe("degraded");
  });

  it("round-trip preserves autonomy_level", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.autonomy_level = "semi_autonomous";
    const payload = mapSettingToUpsertPayload(setting, "u", "CloneChat");
    const syntheticRow = normalizeDbRow({ ...payload, id: "x", created_at: setting.created_at, updated_at: setting.updated_at })!;
    const result = mapRowToSetting(syntheticRow, clonechatDef);
    expect(result.autonomy_level).toBe("semi_autonomous");
  });

  it("round-trip preserves risk_mode", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.risk_mode = "locked";
    const payload = mapSettingToUpsertPayload(setting, "u", "CloneChat");
    const syntheticRow = normalizeDbRow({ ...payload, id: "x", created_at: setting.created_at, updated_at: setting.updated_at })!;
    const result = mapRowToSetting(syntheticRow, clonechatDef);
    expect(result.risk_mode).toBe("locked");
  });

  it("round-trip preserves enabled_for_employee_slugs", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.enabled_for_employee_slugs = ["pierre", "sophie"];
    const payload = mapSettingToUpsertPayload(setting, "u", "CloneChat");
    const syntheticRow = normalizeDbRow({ ...payload, id: "x", created_at: setting.created_at, updated_at: setting.updated_at })!;
    const result = mapRowToSetting(syntheticRow, clonechatDef);
    expect(result.enabled_for_employee_slugs).toEqual(["pierre", "sophie"]);
  });

  it("round-trip preserves custom_rules", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.custom_rules = { rule_a: 1, rule_b: "x" };
    const payload = mapSettingToUpsertPayload(setting, "u", "CloneChat");
    const syntheticRow = normalizeDbRow({ ...payload, id: "x", created_at: setting.created_at, updated_at: setting.updated_at })!;
    const result = mapRowToSetting(syntheticRow, clonechatDef);
    expect(result.custom_rules).toEqual({ rule_a: 1, rule_b: "x" });
  });
});

// ── 20. mapRowsToSettings ─────────────────────────────────────────────────────

describe("mapRowsToSettings", () => {
  const defs = getCloneStoreTechnologyDefinitions();

  it("returns empty array for empty rows", () => {
    expect(mapRowsToSettings([], defs)).toEqual([]);
  });

  it("skips null/undefined entries", () => {
    const result = mapRowsToSettings([null, undefined, {}], defs);
    expect(result).toEqual([]);
  });

  it("skips rows with unknown technology_key", () => {
    const result = mapRowsToSettings([{ technology_key: "notreal" }], defs);
    expect(result).toEqual([]);
  });

  it("maps valid rows to settings", () => {
    const row = { technology_key: "clonechat", technology_name: "CloneChat", enabled: true };
    const result = mapRowsToSettings([row], defs);
    expect(result).toHaveLength(1);
    expect(result[0].technology_slug).toBe("clonechat");
  });

  it("maps multiple rows correctly", () => {
    const rows = [
      { technology_key: "clonechat", enabled: true },
      { technology_key: "cloneguard", enabled: true },
      { technology_key: "cloneos", enabled: true },
    ];
    const result = mapRowsToSettings(rows, defs);
    expect(result).toHaveLength(3);
    const slugs = result.map((s) => s.technology_slug).sort();
    expect(slugs).toEqual(["clonechat", "cloneguard", "cloneos"].sort());
  });

  it("with full config_json, maps losslessly", () => {
    const setting = makeCompleteSetting("clonechat");
    setting.status = "degraded";
    const row = { technology_key: "clonechat", config_json: setting };
    const result = mapRowsToSettings([row], defs);
    expect(result[0].status).toBe("degraded");
  });
});

// ── 21. legacyExtractSettings ─────────────────────────────────────────────────

describe("legacyExtractSettings", () => {
  const defs = getCloneStoreTechnologyDefinitions();

  it("returns empty array for null input", () => {
    expect(legacyExtractSettings(null, defs)).toEqual([]);
  });

  it("returns empty array if no clone_technologies key", () => {
    expect(legacyExtractSettings({}, defs)).toEqual([]);
  });

  it("returns empty array if clone_technologies is not an object", () => {
    expect(legacyExtractSettings({ clone_technologies: "invalid" }, defs)).toEqual([]);
  });

  it("returns empty array if clone_technologies has no known slugs", () => {
    expect(legacyExtractSettings({ clone_technologies: { notaslug: {} } }, defs)).toEqual([]);
  });

  it("extracts settings for known slugs", () => {
    const legacyJson = {
      clone_technologies: {
        clonechat: { technology_slug: "clonechat", status: "enabled" },
        cloneguard: { technology_slug: "cloneguard", status: "disabled" },
      },
    };
    const result = legacyExtractSettings(legacyJson, defs);
    expect(result).toHaveLength(2);
    const slugs = result.map((s) => s.technology_slug).sort();
    expect(slugs).toEqual(["clonechat", "cloneguard"].sort());
  });

  it("only extracts known technology slugs", () => {
    const legacyJson = {
      clone_technologies: {
        clonechat: { technology_slug: "clonechat" },
        pierre_internal: { something: "else" },
      },
    };
    const result = legacyExtractSettings(legacyJson, defs);
    expect(result).toHaveLength(1);
    expect(result[0].technology_slug).toBe("clonechat");
  });

  it("uses definition defaults when legacy entry is malformed", () => {
    const clonechatDef = defs.find((d) => d.slug === "clonechat")!;
    const legacyJson = {
      clone_technologies: {
        clonechat: "invalid_string",
      },
    };
    const result = legacyExtractSettings(legacyJson, defs);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(clonechatDef.default_status);
  });

  it("preserves status from legacy entry", () => {
    const legacyJson = {
      clone_technologies: {
        clonechat: { technology_slug: "clonechat", status: "maintenance" },
      },
    };
    const result = legacyExtractSettings(legacyJson, defs);
    expect(result[0].status).toBe("maintenance");
  });

  it("does not reference 'pierre' in logic — is purely data-driven", () => {
    const legacyJson = {
      clone_technologies: { clonechat: { technology_slug: "clonechat" } },
    };
    // Same result regardless of which user calls it (strip timestamps — each call generates new Date())
    const stripTs = (arr: ReturnType<typeof legacyExtractSettings>) =>
      arr.map(({ created_at: _c, updated_at: _u, ...rest }) => rest);
    const r1 = legacyExtractSettings(legacyJson, defs);
    const r2 = legacyExtractSettings(legacyJson, defs);
    expect(stripTs(r1)).toEqual(stripTs(r2));
  });
});

// ── 22. storage — no Pierre hardcoding ───────────────────────────────────────

describe("storage module — no Pierre hardcoding", () => {
  it("mapSettingToUpsertPayload does not reference 'pierre' in output", () => {
    const setting = makeCompleteSetting("clonechat");
    const payload = mapSettingToUpsertPayload(setting, "user-xyz", "CloneChat");
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('"pierre"');
  });

  it("mapRowsToSettings works identically for any user_id", () => {
    const row1 = { technology_key: "clonechat", user_id: "user-1" };
    const row2 = { technology_key: "clonechat", user_id: "user-2" };
    const defs = getCloneStoreTechnologyDefinitions();
    const r1 = mapRowsToSettings([row1], defs);
    const r2 = mapRowsToSettings([row2], defs);
    expect(r1[0].technology_slug).toBe(r2[0].technology_slug);
  });

  it("normalizeDbRow does not depend on agent_slug column", () => {
    const row = normalizeDbRow({ technology_key: "cloneos" });
    expect(row).not.toBeNull();
    expect("agent_slug" in (row ?? {})).toBe(false);
  });
});
