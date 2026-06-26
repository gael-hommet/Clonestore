// TECH-03 — Global Technology Config Model Tests
// Static and logic tests only. No Stripe live. No Supabase writes. No real API calls.
// No OpenAI. No Anthropic. No email sends.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return readFileSync(
    join(ROOT, "src/lib/clonestore/technologies", relPath),
    "utf-8",
  );
}

function readDoc(relPath: string): string {
  return readFileSync(join(ROOT, "docs", relPath), "utf-8");
}

// ── 1. File existence ─────────────────────────────────────────────────────────

describe("tech-03 — file existence", () => {
  it("global-tech-config.ts exists", () => {
    const content = readSrc("global-tech-config.ts");
    expect(content.length).toBeGreaterThan(500);
  });

  it("global-tech-defaults.ts exists", () => {
    const content = readSrc("global-tech-defaults.ts");
    expect(content.length).toBeGreaterThan(500);
  });

  it("global-tech-snapshot.ts exists", () => {
    const content = readSrc("global-tech-snapshot.ts");
    expect(content.length).toBeGreaterThan(300);
  });

  it("global-tech-validation.ts exists", () => {
    const content = readSrc("global-tech-validation.ts");
    expect(content.length).toBeGreaterThan(300);
  });

  it("global-tech-b46-bridge.ts exists", () => {
    const content = readSrc("global-tech-b46-bridge.ts");
    expect(content.length).toBeGreaterThan(300);
  });

  it("global-tech-storage.ts exists", () => {
    const content = readSrc("global-tech-storage.ts");
    expect(content.length).toBeGreaterThan(300);
  });

  it("index.ts exists and exports global-tech types", () => {
    const content = readSrc("index.ts");
    expect(content).toContain("GlobalTechnologyKey");
    expect(content).toContain("GlobalTechnologyConfig");
    expect(content).toContain("global-tech-config");
    expect(content).toContain("global-tech-defaults");
    expect(content).toContain("global-tech-snapshot");
    expect(content).toContain("global-tech-validation");
    expect(content).toContain("global-tech-b46-bridge");
    expect(content).toContain("global-tech-storage");
  });
});

// ── 2. GlobalTechnologyKey — 13 keys ─────────────────────────────────────────

import {
  ALL_GLOBAL_TECHNOLOGY_KEYS,
  GLOBAL_TECHNOLOGY_KEY_SET,
  TECHNOLOGY_SLUG_SUBSET,
  isGlobalTechnologyKey,
  isInTechnologySlugSubset,
} from "../global-tech-config";

describe("tech-03 — GlobalTechnologyKey", () => {
  it("ALL_GLOBAL_TECHNOLOGY_KEYS has exactly 13 entries", () => {
    expect(ALL_GLOBAL_TECHNOLOGY_KEYS).toHaveLength(13);
  });

  it("includes all 12 TechnologySlug values", () => {
    const slugs = [
      "cloneos", "cloneadn", "cloneguard", "clonetrace",
      "clonevoice", "clonechat", "clonecontinuum", "clonetrust",
      "clonereview", "clonesignals", "clonelearn", "clonebrief",
    ];
    for (const slug of slugs) {
      expect(ALL_GLOBAL_TECHNOLOGY_KEYS).toContain(slug);
    }
  });

  it("includes clonepolicy as 13th key", () => {
    expect(ALL_GLOBAL_TECHNOLOGY_KEYS).toContain("clonepolicy");
  });

  it("GLOBAL_TECHNOLOGY_KEY_SET contains all 13 keys", () => {
    expect(GLOBAL_TECHNOLOGY_KEY_SET.size).toBe(13);
  });

  it("isGlobalTechnologyKey accepts valid keys", () => {
    expect(isGlobalTechnologyKey("cloneos")).toBe(true);
    expect(isGlobalTechnologyKey("clonepolicy")).toBe(true);
    expect(isGlobalTechnologyKey("clonebrief")).toBe(true);
  });

  it("isGlobalTechnologyKey rejects invalid strings", () => {
    expect(isGlobalTechnologyKey("cloneunknown_xyz")).toBe(false);
    expect(isGlobalTechnologyKey("")).toBe(false);
    expect(isGlobalTechnologyKey(123)).toBe(false);
  });

  it("TECHNOLOGY_SLUG_SUBSET has 12 entries (excludes clonepolicy)", () => {
    expect(TECHNOLOGY_SLUG_SUBSET.size).toBe(12);
    expect(TECHNOLOGY_SLUG_SUBSET.has("clonepolicy")).toBe(false);
  });

  it("isInTechnologySlugSubset returns true for shared keys", () => {
    expect(isInTechnologySlugSubset("cloneos")).toBe(true);
    expect(isInTechnologySlugSubset("cloneadn")).toBe(true);
    expect(isInTechnologySlugSubset("clonebrief")).toBe(true);
  });

  it("isInTechnologySlugSubset returns false for clonepolicy", () => {
    expect(isInTechnologySlugSubset("clonepolicy")).toBe(false);
  });
});

// ── 3. DEFAULT_GLOBAL_TECH_CONFIGS — completeness ─────────────────────────────

import {
  DEFAULT_GLOBAL_TECH_CONFIGS,
  DEFAULT_GLOBAL_TECH_CONFIG_LIST,
  getDefaultGlobalTechConfig,
  getActiveDefaultConfigs,
  getPartialDefaultConfigs,
  getRoadmapDefaultConfigs,
  getEmployeeRuntimeRequiredDefaultConfigs,
  getDefaultReadinessScore,
  getAverageDefaultReadinessScore,
} from "../global-tech-defaults";

describe("tech-03 — DEFAULT_GLOBAL_TECH_CONFIGS", () => {
  it("has exactly 13 entries", () => {
    expect(Object.keys(DEFAULT_GLOBAL_TECH_CONFIGS)).toHaveLength(13);
  });

  it("DEFAULT_GLOBAL_TECH_CONFIG_LIST has 13 items", () => {
    expect(DEFAULT_GLOBAL_TECH_CONFIG_LIST).toHaveLength(13);
  });

  it("each key matches its config.key", () => {
    for (const [key, config] of Object.entries(DEFAULT_GLOBAL_TECH_CONFIGS)) {
      expect(config.key).toBe(key);
    }
  });

  it("all configs have a non-empty display_name", () => {
    for (const config of DEFAULT_GLOBAL_TECH_CONFIG_LIST) {
      expect(config.display_name.trim().length).toBeGreaterThan(0);
    }
  });

  it("all configs have a readiness_score between 0 and 100", () => {
    for (const config of DEFAULT_GLOBAL_TECH_CONFIG_LIST) {
      expect(config.readiness_score).toBeGreaterThanOrEqual(0);
      expect(config.readiness_score).toBeLessThanOrEqual(100);
    }
  });

  it("clonepolicy is internal and not visible_to_customer", () => {
    const policy = DEFAULT_GLOBAL_TECH_CONFIGS.clonepolicy;
    expect(policy.control_level).toBe("internal_only");
    expect(policy.visible_to_customer).toBe(false);
  });

  it("clonepolicy required_for_employee_runtime is false (embedded in CloneGuard)", () => {
    expect(DEFAULT_GLOBAL_TECH_CONFIGS.clonepolicy.required_for_employee_runtime).toBe(false);
  });

  it("CloneTrust uses gradual autonomy model (not zero-trust)", () => {
    const trust = DEFAULT_GLOBAL_TECH_CONFIGS.clonetrust;
    const settings = trust.settings as Record<string, unknown>;
    expect(settings.trust_model).toBe("gradual_autonomy");
  });

  it("core 4 techs are required_for_employee_runtime", () => {
    const core4: string[] = ["cloneos", "cloneadn", "cloneguard", "clonetrace"];
    for (const key of core4) {
      expect(DEFAULT_GLOBAL_TECH_CONFIGS[key as keyof typeof DEFAULT_GLOBAL_TECH_CONFIGS].required_for_employee_runtime).toBe(true);
    }
  });

  it("clonevoice readiness_score reflects TECH-01 audit (≤ 20)", () => {
    expect(getDefaultReadinessScore("clonevoice")).toBeLessThanOrEqual(20);
  });

  it("cloneos readiness_score reflects TECH-01 audit (≥ 80)", () => {
    expect(getDefaultReadinessScore("cloneos")).toBeGreaterThanOrEqual(80);
  });

  it("getActiveDefaultConfigs returns at least 4 active configs", () => {
    expect(getActiveDefaultConfigs().length).toBeGreaterThanOrEqual(4);
  });

  it("getRoadmapDefaultConfigs returns at least 4 roadmap configs", () => {
    expect(getRoadmapDefaultConfigs().length).toBeGreaterThanOrEqual(4);
  });

  it("getEmployeeRuntimeRequiredDefaultConfigs returns at least 4", () => {
    expect(getEmployeeRuntimeRequiredDefaultConfigs().length).toBeGreaterThanOrEqual(4);
  });

  it("getAverageDefaultReadinessScore returns a number between 0 and 100", () => {
    const avg = getAverageDefaultReadinessScore();
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(avg).toBeLessThanOrEqual(100);
  });
});

// ── 4. Snapshot builder ───────────────────────────────────────────────────────

import {
  buildGlobalTechnologyConfigSnapshot,
  buildGlobalTechnologyConfigSummary,
  resolveGlobalTechConfig,
} from "../global-tech-snapshot";

describe("tech-03 — snapshot", () => {
  it("buildGlobalTechnologyConfigSnapshot returns 13 technologies", () => {
    const snapshot = buildGlobalTechnologyConfigSnapshot();
    expect(snapshot.technologies).toHaveLength(13);
  });

  it("snapshot summary total is 13", () => {
    const snapshot = buildGlobalTechnologyConfigSnapshot();
    expect(snapshot.summary.total).toBe(13);
  });

  it("snapshot summary active + partial + roadmap + disabled + locked = 13", () => {
    const s = buildGlobalTechnologyConfigSnapshot().summary;
    const total = s.active + s.partial + s.roadmap + s.disabled + s.locked;
    expect(total).toBe(13);
  });

  it("snapshot has generated_at", () => {
    const snapshot = buildGlobalTechnologyConfigSnapshot();
    expect(snapshot.generated_at).toBeTruthy();
  });

  it("resolveGlobalTechConfig returns default when no override provided", () => {
    const config = resolveGlobalTechConfig("cloneos");
    expect(config.key).toBe("cloneos");
    expect(config.readiness_score).toBeGreaterThanOrEqual(80);
  });
});

// ── 5. Validation ─────────────────────────────────────────────────────────────

import {
  validateGlobalTechnologyConfig,
  getGlobalTechnologyConfigValidationReport,
  areAllDefaultConfigsValid,
} from "../global-tech-validation";

describe("tech-03 — validation", () => {
  it("all default configs pass validation", () => {
    expect(areAllDefaultConfigsValid()).toBe(true);
  });

  it("validation report on defaults has no errors", () => {
    const report = getGlobalTechnologyConfigValidationReport();
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("validation report config_count is 13", () => {
    const report = getGlobalTechnologyConfigValidationReport();
    expect(report.config_count).toBe(13);
  });

  it("rejects config with empty display_name", () => {
    const bad = { ...DEFAULT_GLOBAL_TECH_CONFIGS.cloneos, display_name: "" };
    const result = validateGlobalTechnologyConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("display_name"))).toBe(true);
  });

  it("rejects config with readiness_score > 100", () => {
    const bad = { ...DEFAULT_GLOBAL_TECH_CONFIGS.cloneos, readiness_score: 150 };
    const result = validateGlobalTechnologyConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("readiness_score"))).toBe(true);
  });

  it("rejects locked_by_platform + configurable_by_customer contradiction", () => {
    const bad = {
      ...DEFAULT_GLOBAL_TECH_CONFIGS.cloneos,
      locked_by_platform: true,
      configurable_by_customer: true,
    };
    const result = validateGlobalTechnologyConfig(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects internal_only + visible_to_customer contradiction", () => {
    const bad = {
      ...DEFAULT_GLOBAL_TECH_CONFIGS.clonepolicy,
      control_level: "internal_only" as const,
      visible_to_customer: true,
    };
    const result = validateGlobalTechnologyConfig(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects roadmap status + required_for_employee_runtime=true", () => {
    const bad = {
      ...DEFAULT_GLOBAL_TECH_CONFIGS.clonereview,
      status: "roadmap" as const,
      required_for_employee_runtime: true,
    };
    const result = validateGlobalTechnologyConfig(bad);
    expect(result.ok).toBe(false);
  });
});

// ── 6. B46 bridge ─────────────────────────────────────────────────────────────

import {
  isB46TechnologyId,
  getB46VisibleTechnologyKeys,
  buildB46CompatibleTechnologyItemsFromGlobal,
  allB46KeysPresentInGlobal,
  getB46ConfigsFromGlobal,
  getNonB46ConfigsFromGlobal,
} from "../global-tech-b46-bridge";

describe("tech-03 — B46 bridge", () => {
  it("allB46KeysPresentInGlobal returns true with defaults", () => {
    expect(allB46KeysPresentInGlobal()).toBe(true);
  });

  it("getB46VisibleTechnologyKeys returns 6 keys", () => {
    expect(getB46VisibleTechnologyKeys()).toHaveLength(6);
  });

  it("isB46TechnologyId accepts cloneos, cloneadn, cloneguard, clonetrace, clonevoice, clonechat", () => {
    const b46Keys = ["cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice", "clonechat"] as const;
    for (const key of b46Keys) {
      expect(isB46TechnologyId(key)).toBe(true);
    }
  });

  it("isB46TechnologyId rejects non-B46 keys", () => {
    expect(isB46TechnologyId("clonepolicy")).toBe(false);
    expect(isB46TechnologyId("clonecontinuum")).toBe(false);
    expect(isB46TechnologyId("clonebrief")).toBe(false);
  });

  it("buildB46CompatibleTechnologyItemsFromGlobal returns 6 items", () => {
    const items = buildB46CompatibleTechnologyItemsFromGlobal();
    expect(items).toHaveLength(6);
  });

  it("B46 items all have valid ids", () => {
    const items = buildB46CompatibleTechnologyItemsFromGlobal();
    const b46Ids = getB46VisibleTechnologyKeys();
    for (const item of items) {
      expect(b46Ids).toContain(item.id);
    }
  });

  it("getB46ConfigsFromGlobal returns 6 configs", () => {
    expect(getB46ConfigsFromGlobal()).toHaveLength(6);
  });

  it("getNonB46ConfigsFromGlobal returns 7 configs (roadmap/internal)", () => {
    expect(getNonB46ConfigsFromGlobal()).toHaveLength(7);
  });
});

// ── 7. Storage helpers ────────────────────────────────────────────────────────

import {
  buildDefaultGlobalTechStoragePayload,
  normalizeGlobalTechStorageRow,
  mergeGlobalTechConfigWithStoredRow,
  buildLegacyB46FallbackFromGlobalConfigs,
} from "../global-tech-storage";

describe("tech-03 — storage", () => {
  it("buildDefaultGlobalTechStoragePayload returns 13 rows", () => {
    const payload = buildDefaultGlobalTechStoragePayload("company_test");
    expect(payload.rows).toHaveLength(13);
  });

  it("storage payload has company_id", () => {
    const payload = buildDefaultGlobalTechStoragePayload("company_test");
    expect(payload.company_id).toBe("company_test");
  });

  it("normalizeGlobalTechStorageRow returns null for unknown key", () => {
    const result = normalizeGlobalTechStorageRow({ key: "cloneunknown_xyz" });
    expect(result).toBeNull();
  });

  it("normalizeGlobalTechStorageRow returns valid row for known key", () => {
    const result = normalizeGlobalTechStorageRow({
      key: "cloneos",
      company_id: "co_test",
      status: "active",
      mode: "production",
      risk_mode: "balanced",
      autonomy_level: "supervised",
      settings: {},
      employee_overrides: [],
      updated_at: "2026-06-01T00:00:00.000Z",
    });
    expect(result).not.toBeNull();
    expect(result?.key).toBe("cloneos");
  });

  it("mergeGlobalTechConfigWithStoredRow returns base for locked configs", () => {
    const row = {
      key: "cloneos" as const,
      company_id: "co_test",
      status: "disabled",
      mode: "disabled",
      risk_mode: "disabled",
      autonomy_level: "none",
      settings: {},
      employee_overrides: [],
      updated_at: "2026-06-01T00:00:00.000Z",
    };
    // cloneos is platform_locked — stored status should be ignored
    const result = mergeGlobalTechConfigWithStoredRow(row);
    expect(result.status).toBe("active"); // default, not "disabled"
  });

  it("buildLegacyB46FallbackFromGlobalConfigs returns 6 rows", () => {
    const rows = buildLegacyB46FallbackFromGlobalConfigs();
    expect(rows).toHaveLength(6);
  });
});

// ── 8. Doc checks ─────────────────────────────────────────────────────────────

describe("tech-03 — doc TECH_03 content", () => {
  let content: string;
  try {
    content = readDoc("TECH_03_GLOBAL_TECHNOLOGY_CONFIG_MODEL.md");
  } catch {
    content = "";
  }

  it("doc TECH_03 exists and is non-empty", () => {
    expect(content.length).toBeGreaterThan(300);
  });

  it("doc mentions GlobalTechnologyKey", () => {
    expect(content).toContain("GlobalTechnologyKey");
  });

  it("doc mentions 13 technologies", () => {
    const has13 =
      content.includes("13 technolog") ||
      content.includes("13 technologies") ||
      content.includes("treize technologies");
    expect(has13).toBe(true);
  });

  it("doc mentions clonepolicy distinction", () => {
    expect(content.toLowerCase()).toContain("clonepolicy");
  });

  it("doc mentions B46 compatibility or bridge", () => {
    const hasBridge =
      content.toLowerCase().includes("b46") ||
      content.toLowerCase().includes("bridge") ||
      content.toLowerCase().includes("compatib");
    expect(hasBridge).toBe(true);
  });

  it("doc mentions TECH-04", () => {
    expect(content).toContain("TECH-04");
  });
});

// ── 9. Safety — no forbidden modifications ────────────────────────────────────

describe("tech-03 — no forbidden code modifications", () => {
  it("no OpenAI direct call in global-tech-defaults", () => {
    const content = readSrc("global-tech-defaults.ts");
    expect(content).not.toMatch(/openai\.com\/v1/i);
    expect(content).not.toMatch(/new OpenAI\(/i);
  });

  it("no Anthropic direct call in global-tech-defaults", () => {
    const content = readSrc("global-tech-defaults.ts");
    expect(content).not.toMatch(/anthropic\.com\/v1/i);
    expect(content).not.toMatch(/new Anthropic\(/i);
  });

  it("no Stripe live key in global-tech-defaults", () => {
    const content = readSrc("global-tech-defaults.ts");
    expect(content).not.toMatch(/sk_live_/i);
    expect(content).not.toMatch(/pk_live_/i);
  });

  it("no public_launch_ready set to true in global-tech-defaults", () => {
    const content = readSrc("global-tech-defaults.ts");
    expect(content).not.toMatch(/public_launch_ready\s*:\s*true/);
  });

  it("CloneTrust content does NOT use zero-trust language", () => {
    const content = readSrc("global-tech-defaults.ts");
    const hasZeroTrust = content.toLowerCase().includes("zero-trust") ||
      content.toLowerCase().includes("zero_trust") ||
      content.toLowerCase().includes("confiance zéro");
    expect(hasZeroTrust).toBe(false);
  });

  it("index.ts does not re-export contracts.ts TechnologySlug directly", () => {
    const content = readSrc("index.ts");
    // The index should not declare TechnologySlug itself — it stays in contracts.ts
    expect(content).not.toMatch(/export type TechnologySlug/);
  });
});
