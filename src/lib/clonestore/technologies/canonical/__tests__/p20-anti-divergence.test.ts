// P20 — GLOBAL ANTI-DIVERGENCE SUITE.
// Scans the REAL source of every public technology consumer and fails if any of them
// reintroduces an independent membership authority, a hardcoded public count, a divergent
// status, or a forbidden dependency. This is the guard that makes the single-authority
// architecture stick after P20 closes.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildPublicTechnologyProjection,
  crossCheckPublicTechnologyProjection,
} from "../public-technology-projection";
import {
  buildTenantConfiguredTechnologies,
  canonicalTechnologyIds,
  isCanonicalTechnologyId,
  isConfigurableTechnologyId,
  validateConfigurableTechnologyId,
} from "../tenant-configuration-adapter";
import { buildTenantTechnologyView } from "../tenant-technology-view";
import { ALL_PRODUCT_TECHNOLOGY_IDS } from "../../../product-technologies/t2/product-technology-types";
import { buildProfileTechPageData } from "../../profile-tech-ui";
import { DEFAULT_GLOBAL_TECH_CONFIG_LIST } from "../../global-tech-defaults";
import { legacyConfigurableSlugs, validateLegacyConfigurationSlug } from "../../registry";
import { TECH_CATALOG } from "@/components/demo/acts/technologies-catalog";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf-8");

/** Every file that renders or serves a PUBLIC technology list/count. */
const PUBLIC_CONSUMERS: readonly string[] = [
  "src/lib/clonestore/technologies/profile-tech-ui.ts",
  "src/app/profile/technologies/page.tsx",
  "src/app/profile/agents/page.tsx",
  "src/components/demo/acts/technologies-catalog.ts",
];

const CANONICAL_AUTHORITY_FILES: readonly string[] = [
  "src/lib/clonestore/technologies/canonical/public-technology-projection.ts",
  "src/lib/clonestore/technologies/canonical/runtime-technology-registry.ts",
  "src/lib/clonestore/technologies/canonical/tenant-technology-view.ts",
  "src/lib/clonestore/technologies/canonical/tenant-configuration-adapter.ts",
];

// ── 1-4. The authority itself ────────────────────────────────────────────────

describe("P20 anti-divergence — the canonical authority", () => {
  it("1. the public projection has exactly 15 technologies", () => {
    expect(buildPublicTechnologyProjection()).toHaveLength(15);
  });

  it("2. T2 has exactly 14 product technologies", () => {
    expect(ALL_PRODUCT_TECHNOLOGY_IDS).toHaveLength(14);
  });

  it("3. CloneChat is external and absent from T2", () => {
    expect(ALL_PRODUCT_TECHNOLOGY_IDS).not.toContain("clonechat");
    const clonechat = buildPublicTechnologyProjection().find((e) => e.id === "clonechat");
    expect(clonechat?.ownership).toBe("EXTERNAL_CLONECHAT_WORKSTREAM");
    expect(clonechat?.canonical).toBeNull();
  });

  it("4. exactly two 'À venir': CloneCall and CloneRoom", () => {
    const upcoming = buildPublicTechnologyProjection()
      .filter((e) => e.launchStatus === "À venir")
      .map((e) => e.id)
      .sort();
    expect(upcoming).toEqual(["clonecall", "cloneroom"]);
    expect(crossCheckPublicTechnologyProjection().ok).toBe(true);
  });
});

// ── 5-9. Every surface reports 15 from the same source ───────────────────────

describe("P20 anti-divergence — every public surface reports the canonical set", () => {
  const canonicalIds = canonicalTechnologyIds();

  it("5. /profile/technologies (TECH-04 projection) = 15, same ids", () => {
    const data = buildProfileTechPageData();
    const ids = data.sections.flatMap((s) => s.cards.map((c) => c.key));
    expect(data.total).toBe(15);
    expect(new Set(ids)).toEqual(new Set(canonicalIds));
  });

  it("6. /profile/agents canonical inventory = 15, same ids and same order", () => {
    // The page renders buildTenantConfiguredTechnologies() directly — assert the data source.
    const inventory = buildTenantConfiguredTechnologies();
    expect(inventory).toHaveLength(15);
    expect(inventory.map((t) => t.id)).toEqual(canonicalIds);
    const src = read("src/app/profile/agents/page.tsx");
    expect(src).toContain("buildTenantConfiguredTechnologies");
    expect(src).toContain("canonical-technology-inventory");
  });

  it("7. /demo catalog = 15, same ids and same order", () => {
    expect(TECH_CATALOG).toHaveLength(15);
    expect(TECH_CATALOG.map((e) => e.id)).toEqual(canonicalIds);
  });

  it("8. the tenant-scoped internal view = 14 P20 technologies (never 15 — CloneChat is external)", () => {
    const view = buildTenantTechnologyView([]);
    expect(view).toHaveLength(14);
    expect(view.map((v) => v.id)).not.toContain("clonechat");
  });

  it("9. public metadata count (15) and internal P20 count (14) differ by exactly CloneChat", () => {
    const publicIds = new Set(canonicalIds);
    const internalIds = new Set(buildTenantTechnologyView([]).map((v) => v.id));
    const diff = [...publicIds].filter((id) => !internalIds.has(id));
    expect(diff).toEqual(["clonechat"]);
  });
});

// ── 10-12. No layer decides membership any more ──────────────────────────────

describe("P20 anti-divergence — no layer other than the authority decides membership", () => {
  it("10. Bloc-18 does not decide membership: its legacy slugs are a strict subset of the canonical ids", () => {
    const legacy = legacyConfigurableSlugs();
    for (const slug of legacy) {
      expect(isCanonicalTechnologyId(slug), `legacy slug ${slug} is not canonical`).toBe(true);
    }
    expect(legacy.length).toBeLessThan(canonicalTechnologyIds().length);
  });

  it("10b. Bloc-18 slug validation is canonical-first and distinguishes the real refusals", () => {
    expect(validateLegacyConfigurationSlug("cloneos").ok).toBe(true);
    const unknown = validateLegacyConfigurationSlug("clonenonexistent");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe("UNKNOWN_TECHNOLOGY");
    const upcoming = validateLegacyConfigurationSlug("clonecall");
    expect(upcoming.ok).toBe(false);
    if (!upcoming.ok) expect(upcoming.code).toBe("NOT_CONFIGURABLE_YET");
    const external = validateLegacyConfigurationSlug("clonechat");
    expect(external.ok).toBe(false);
    if (!external.ok) expect(external.code).toBe("EXTERNAL_WORKSTREAM");
  });

  it("10c. the Bloc-18 registry source delegates slug validation to the canonical authority", () => {
    const src = read("src/lib/clonestore/technologies/registry.ts");
    expect(src).toContain("isCanonicalTechnologyId");
    expect(src).not.toContain("const VALID_SLUGS");
  });

  it("11. TECH-03 does not decide membership: it holds 13 configs, strictly fewer than the 15 public ids", () => {
    expect(DEFAULT_GLOBAL_TECH_CONFIG_LIST).toHaveLength(13);
    expect(DEFAULT_GLOBAL_TECH_CONFIG_LIST.length).toBeLessThan(canonicalTechnologyIds().length);
  });

  it("12. TECH-04 does not decide membership: its total is derived, and it iterates the adapter", () => {
    expect(buildProfileTechPageData().total).toBe(buildPublicTechnologyProjection().length);
    const src = read("src/lib/clonestore/technologies/profile-tech-ui.ts");
    expect(src).toContain("buildTenantConfiguredTechnologies");
  });

  it("12b. NO public consumer iterates DEFAULT_GLOBAL_TECH_CONFIG_LIST to build a public list/count", () => {
    // Strip comments first: a comment may legitimately NAME the forbidden symbol to explain the
    // rule. What must never reappear is a real import or a real call against it.
    const stripComments = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const file of PUBLIC_CONSUMERS) {
      const code = stripComments(read(file));
      expect(code, `${file} still imports the TECH-03 configuration list`).not.toMatch(
        /import[\s\S]{0,200}DEFAULT_GLOBAL_TECH_CONFIG_LIST/,
      );
      expect(code, `${file} still iterates the TECH-03 configuration list`).not.toMatch(
        /DEFAULT_GLOBAL_TECH_CONFIG_LIST\s*\.\s*(?:filter|map|forEach|length|reduce|flatMap)/,
      );
    }
  });
});

// ── 13-17. Integrity of the joined data ──────────────────────────────────────

describe("P20 anti-divergence — data integrity", () => {
  it("13. no duplicate ids anywhere", () => {
    const check = (ids: readonly string[], label: string) => {
      expect(new Set(ids).size, `${label} has duplicates`).toBe(ids.length);
    };
    check(canonicalTechnologyIds(), "canonical");
    check(TECH_CATALOG.map((e) => e.id), "demo catalog");
    check(buildProfileTechPageData().sections.flatMap((s) => s.cards.map((c) => c.key)), "profile");
    check(buildTenantConfiguredTechnologies().map((t) => t.id), "adapter");
  });

  it("14. no phantom id: every surface id exists in the canonical authority", () => {
    const canonical = new Set(canonicalTechnologyIds());
    for (const id of TECH_CATALOG.map((e) => e.id)) expect(canonical.has(id)).toBe(true);
    for (const c of buildProfileTechPageData().sections.flatMap((s) => s.cards)) {
      expect(canonical.has(c.key)).toBe(true);
    }
  });

  it("15. no divergent display order between surfaces", () => {
    const canonical = canonicalTechnologyIds();
    expect(TECH_CATALOG.map((e) => e.id)).toEqual(canonical);
    expect(buildTenantConfiguredTechnologies().map((t) => t.id)).toEqual(canonical);
  });

  it("16. no divergent availability: the demo status always matches the canonical launchStatus", () => {
    const byId = new Map(buildPublicTechnologyProjection().map((e) => [e.id, e.launchStatus]));
    for (const entry of TECH_CATALOG) {
      expect(entry.status, `${entry.id} status diverges`).toBe(byId.get(entry.id));
    }
  });

  it("17. the 13 TECH-03 configurations are preserved intact; 12 are P20-owned, CloneChat's stays external", () => {
    // TECH-03 still holds all 13 rows — nothing was deleted or mutated by the convergence.
    expect(DEFAULT_GLOBAL_TECH_CONFIG_LIST).toHaveLength(13);

    const adapter = buildTenantConfiguredTechnologies();
    const configured = adapter.filter((t) => t.configurationState === "CONFIGURED");
    // 12, not 13: CloneChat has a TECH-03 row but is owned by the external workstream, so P20
    // deliberately does not present it as a P20-configured technology.
    expect(configured).toHaveLength(12);

    for (const cfg of DEFAULT_GLOBAL_TECH_CONFIG_LIST) {
      const entry = adapter.find((t) => t.id === cfg.key);
      expect(entry, `${cfg.key} missing from the canonical adapter`).toBeDefined();
      if (cfg.key === "clonechat") {
        expect(entry?.configurationState).toBe("EXTERNAL_WORKSTREAM_METADATA_ONLY");
        expect(entry?.config).toBeNull();
        continue;
      }
      expect(entry?.configurationState).toBe("CONFIGURED");
      expect(entry?.readinessScore).toBe(cfg.readiness_score);
      expect(entry?.config).toEqual(cfg);
    }
  });
});

// ── 18. No fabricated readiness ──────────────────────────────────────────────

describe("P20 anti-divergence — no fabricated readiness", () => {
  it("18. CloneCall/CloneRoom carry readinessScore=null (absence), never a synthesised number", () => {
    const adapter = buildTenantConfiguredTechnologies();
    for (const id of ["clonecall", "cloneroom"]) {
      const entry = adapter.find((t) => t.id === id);
      expect(entry?.configurationState).toBe("NOT_CONFIGURABLE_YET");
      expect(entry?.readinessScore).toBeNull();
      expect(entry?.config).toBeNull();
      expect(entry?.customerConfigurable).toBe(false);
      expect(isConfigurableTechnologyId(id)).toBe(false);
    }
  });

  it("18b. CloneChat is EXTERNAL_WORKSTREAM_METADATA_ONLY with no configuration claimed by P20", () => {
    const entry = buildTenantConfiguredTechnologies().find((t) => t.id === "clonechat");
    expect(entry?.configurationState).toBe("EXTERNAL_WORKSTREAM_METADATA_ONLY");
    expect(entry?.config).toBeNull();
    expect(entry?.readinessScore).toBeNull();
    const v = validateConfigurableTechnologyId("clonechat");
    expect(v.ok).toBe(false);
  });

  it("18c. no public consumer hardcodes a 13 or 14 public technology count", () => {
    for (const file of PUBLIC_CONSUMERS) {
      const src = read(file);
      // Catches `total: 13`, `total = 14`, `toBe(13)`-style public counters in product code.
      expect(src, `${file} hardcodes a public count`).not.toMatch(/\btotal\s*[:=]\s*1[34]\b/);
      expect(src, `${file} hardcodes a technology count`).not.toMatch(/\b1[34]\s+(?:couches|technologies)\b/);
    }
  });
});

// ── 19-20. Forbidden dependencies in the authority ───────────────────────────

describe("P20 anti-divergence — the authority stays pure", () => {
  it("19. no React dependency in any canonical authority file", () => {
    for (const file of CANONICAL_AUTHORITY_FILES) {
      const src = read(file);
      expect(src, `${file} imports React`).not.toMatch(/from\s+["']react["']/);
      expect(src, `${file} imports a .tsx module`).not.toMatch(/\.tsx["']/);
    }
  });

  it("20. no CloneChat runtime import anywhere in the canonical authority", () => {
    for (const file of CANONICAL_AUTHORITY_FILES) {
      const src = read(file);
      expect(src, `${file} imports CloneChat runtime`).not.toMatch(/from\s+["'][^"']*clonechat/i);
      expect(src, `${file} requires CloneChat runtime`).not.toMatch(/require\(["'][^"']*clonechat/i);
    }
  });
});
