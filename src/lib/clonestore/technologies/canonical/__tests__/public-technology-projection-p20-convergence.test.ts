// P20 — CONVERGENCE TESTS: the public technology projection is the SINGLE authority for
// identity/membership/status/ownership. These tests fail if any consumer (TECH-03, TECH-04, the
// demo catalog) ever re-declares its own independent id list, status, or reintroduces a phantom
// or missing technology.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildPublicTechnologyProjection,
  crossCheckPublicTechnologyProjection,
} from "../public-technology-projection";
import { buildCanonicalTechnologyRegistry } from "../runtime-technology-registry";
import { ALL_PRODUCT_TECHNOLOGY_IDS } from "../../../product-technologies/t2/product-technology-types";
import { buildProfileTechPageData } from "../../profile-tech-ui";
import { DEFAULT_GLOBAL_TECH_CONFIGS, DEFAULT_GLOBAL_TECH_CONFIG_LIST } from "../../global-tech-defaults";
import { TECH_CATALOG, orphanTechContentIds } from "@/components/demo/acts/technologies-catalog";

const ROOT = process.cwd();
function readCanonicalSrc(file: string): string {
  return readFileSync(join(ROOT, "src/lib/clonestore/technologies/canonical", file), "utf-8");
}

describe("P20 convergence — 1. exactly 14 P20-internal ids", () => {
  it("buildCanonicalTechnologyRegistry has exactly 14 entries", () => {
    expect(buildCanonicalTechnologyRegistry()).toHaveLength(14);
  });
});

describe("P20 convergence — 2. exactly 15 public ids", () => {
  it("buildPublicTechnologyProjection has exactly 15 entries", () => {
    expect(buildPublicTechnologyProjection()).toHaveLength(15);
  });
});

describe("P20 convergence — 3. CloneChat absent from T2", () => {
  it("ALL_PRODUCT_TECHNOLOGY_IDS (T2, 14) does not contain clonechat", () => {
    expect(ALL_PRODUCT_TECHNOLOGY_IDS).not.toContain("clonechat");
    expect(ALL_PRODUCT_TECHNOLOGY_IDS).toHaveLength(14);
  });
});

describe("P20 convergence — 4/5. CloneChat present in the public projection, external ownership", () => {
  it("clonechat is present with ownership=EXTERNAL_CLONECHAT_WORKSTREAM and no canonical entry", () => {
    const proj = buildPublicTechnologyProjection();
    const clonechat = proj.find((e) => e.id === "clonechat");
    expect(clonechat).toBeDefined();
    expect(clonechat?.ownership).toBe("EXTERNAL_CLONECHAT_WORKSTREAM");
    expect(clonechat?.canonical).toBeNull();
  });
});

describe("P20 convergence — 6/7. CloneCall and CloneRoom present", () => {
  it("clonecall and cloneroom are present in the public projection", () => {
    const ids = buildPublicTechnologyProjection().map((e) => e.id);
    expect(ids).toContain("clonecall");
    expect(ids).toContain("cloneroom");
  });
});

describe("P20 convergence — 8/9. CloneCall and CloneRoom are À venir", () => {
  it("both have launchStatus=À venir, everything else does not", () => {
    const proj = buildPublicTechnologyProjection();
    const upcoming = proj.filter((e) => e.launchStatus === "À venir").map((e) => e.id);
    expect(upcoming.sort()).toEqual(["clonecall", "cloneroom"]);
  });
});

describe("P20 convergence — 10/11. no duplicates, no phantom ids", () => {
  it("crossCheckPublicTechnologyProjection reports ok=true, no issues", () => {
    const result = crossCheckPublicTechnologyProjection();
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("TECH_CATALOG (demo) has no orphan content and no phantom entries", () => {
    expect(orphanTechContentIds()).toEqual([]);
    expect(TECH_CATALOG).toHaveLength(15);
    const catalogIds = TECH_CATALOG.map((e) => e.id);
    const projectionIds = buildPublicTechnologyProjection().map((e) => e.id);
    expect(new Set(catalogIds)).toEqual(new Set(projectionIds));
  });
});

describe("P20 convergence — 12. same status across profile and demo catalog", () => {
  it("À venir in the demo catalog iff roadmap+not_configurable_yet in profile-tech-ui, for CloneCall/CloneRoom only", () => {
    const pageData = buildProfileTechPageData();
    const allCards = pageData.sections.flatMap((s) => s.cards);
    for (const entry of TECH_CATALOG) {
      const card = allCards.find((c) => c.key === entry.id);
      expect(card, `no profile card for ${entry.id}`).toBeDefined();
      if (entry.status === "À venir") {
        expect(["clonecall", "cloneroom"]).toContain(entry.id);
        expect(card?.configState).toBe("not_configurable_yet");
      } else {
        expect(card?.configState === "configured" || entry.id === "clonechat" || entry.id === "clonevoice").toBe(true);
      }
    }
  });
});

describe("P20 convergence — 13. same destinations/membership across profile and demo catalog", () => {
  it("TECH_CATALOG ids and profile-tech-ui ids are the exact same 15-id set, same source projection", () => {
    const pageData = buildProfileTechPageData();
    const profileIds = pageData.sections.flatMap((s) => s.cards.map((c) => c.key));
    const catalogIds = TECH_CATALOG.map((e) => e.id);
    expect(new Set(profileIds)).toEqual(new Set(catalogIds));
    expect(profileIds).toHaveLength(15);
  });
});

describe("P20 convergence — 14. TECH-03 no longer controls public membership", () => {
  it("TECH-03 has 13 configured technologies, strictly fewer than the 15 public ids", () => {
    expect(DEFAULT_GLOBAL_TECH_CONFIG_LIST).toHaveLength(13);
    expect(DEFAULT_GLOBAL_TECH_CONFIG_LIST.length).toBeLessThan(buildPublicTechnologyProjection().length);
  });

  it("clonecall and cloneroom have no TECH-03 entry (proves TECH-03 doesn't gate what's public)", () => {
    expect((DEFAULT_GLOBAL_TECH_CONFIGS as Record<string, unknown>).clonecall).toBeUndefined();
    expect((DEFAULT_GLOBAL_TECH_CONFIGS as Record<string, unknown>).cloneroom).toBeUndefined();
  });
});

describe("P20 convergence — 15. TECH-04 no longer controls public membership", () => {
  it("buildProfileTechPageData().total equals the canonical projection length, not a local constant", () => {
    const pageData = buildProfileTechPageData();
    expect(pageData.total).toBe(buildPublicTechnologyProjection().length);
  });
});

describe("P20 convergence — 16. tenant configuration preserved for the 13 already-configurable technologies", () => {
  it("each of the 13 TECH-03-configured ids keeps its real readiness_score in the profile projection", () => {
    const pageData = buildProfileTechPageData();
    const allCards = pageData.sections.flatMap((s) => s.cards);
    for (const config of DEFAULT_GLOBAL_TECH_CONFIG_LIST) {
      const card = allCards.find((c) => c.key === config.key);
      if (config.key === "clonechat") {
        // CloneChat has a TECH-03 row but belongs to the external workstream: P20 surfaces it
        // as metadata only and never claims its readiness/guardrails/autonomy.
        expect(card?.configState).toBe("external_workstream_metadata_only");
        continue;
      }
      expect(card?.configState).toBe("configured");
      expect(card?.readiness_score).toBe(config.readiness_score);
    }
  });
});

describe("P20 convergence — 17. no fabricated readiness for CloneCall/CloneRoom", () => {
  it("both have readiness_score=0 (non-measurement sentinel) and configState=not_configurable_yet", () => {
    const pageData = buildProfileTechPageData();
    const allCards = pageData.sections.flatMap((s) => s.cards);
    for (const key of ["clonecall", "cloneroom"]) {
      const card = allCards.find((c) => c.key === key);
      expect(card?.readiness_score).toBe(0);
      expect(card?.configState).toBe("not_configurable_yet");
    }
  });
});

describe("P20 convergence — 18. stable display order", () => {
  it("buildPublicTechnologyProjection() returns the same order on repeated calls", () => {
    const a = buildPublicTechnologyProjection().map((e) => e.id);
    const b = buildPublicTechnologyProjection().map((e) => e.id);
    expect(a).toEqual(b);
  });

  it("TECH_CATALOG order matches the canonical projection order", () => {
    const catalogIds = TECH_CATALOG.map((e) => e.id);
    const projectionIds = buildPublicTechnologyProjection().map((e) => e.id);
    expect(catalogIds).toEqual(projectionIds);
  });
});

describe("P20 convergence — 19. no CloneChat runtime import in the canonical authority", () => {
  it("runtime-technology-registry.ts and public-technology-projection.ts import nothing from src/lib/clonechat", () => {
    const files = ["runtime-technology-registry.ts", "public-technology-projection.ts", "tenant-technology-view.ts"];
    for (const f of files) {
      const src = readCanonicalSrc(f);
      expect(src).not.toMatch(/from\s+["'].*clonechat/i);
      expect(src).not.toMatch(/require\(["'].*clonechat/i);
    }
  });
});

describe("P20 convergence — 20. no React dependency in the canonical authority", () => {
  it("runtime-technology-registry.ts and public-technology-projection.ts import nothing from react or .tsx", () => {
    const files = ["runtime-technology-registry.ts", "public-technology-projection.ts", "tenant-technology-view.ts"];
    for (const f of files) {
      const src = readCanonicalSrc(f);
      expect(src).not.toMatch(/from\s+["']react["']/i);
      expect(src).not.toMatch(/\.tsx["']/);
    }
  });
});
