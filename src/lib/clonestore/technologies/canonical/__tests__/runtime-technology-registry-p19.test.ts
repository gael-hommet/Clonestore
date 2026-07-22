// src/lib/clonestore/technologies/canonical/__tests__/runtime-technology-registry-p19.test.ts
// P19 — the single canonical technology registry composes T1 (15 capabilities) + T2 (14 product
// technologies) with honest provider state; the 14 product technologies each map to real capabilities.

import { describe, it, expect } from "vitest";
import { buildCanonicalTechnologyRegistry, getCanonicalTechnology, crossCheckCanonicalRegistry } from "../runtime-technology-registry";

describe("P19 — canonical technology registry (single source)", () => {
  it("has exactly the 14 product technologies", () => {
    const reg = buildCanonicalTechnologyRegistry();
    expect(reg.length).toBe(14);
    const ids = reg.map((e) => e.id).sort();
    expect(ids).toContain("cloneos");
    expect(ids).toContain("clonelearn");
    expect(ids).toContain("cloneroom");
  });

  it("cross-check passes (14 product + 15 T1, all capabilities real)", () => {
    const c = crossCheckCanonicalRegistry();
    expect(c.issues).toEqual([]);
    expect(c.ok).toBe(true);
  });

  it("provider-dependent technologies are honestly PROVIDER_READY_DISABLED", () => {
    expect(getCanonicalTechnology("clonevoice")!.providerState).toBe("PROVIDER_READY_DISABLED");
    expect(getCanonicalTechnology("clonecall")!.providerState).toBe("PROVIDER_READY_DISABLED");
    expect(getCanonicalTechnology("clonevoice")!.readiness).toBe("provider_disabled");
  });

  it("P19 canonical modules are wired for the converged foundations", () => {
    expect(getCanonicalTechnology("cloneguard")!.canonicalModule).toContain("governance/canonical-decision");
    expect(getCanonicalTechnology("clonelearn")!.canonicalModule).toContain("clonelearn/canonical/learning-loop");
    expect(getCanonicalTechnology("cloneadn")!.canonicalModule).toContain("cloneadn/canonical/canonical-adn");
    expect(getCanonicalTechnology("clonetrace")!.canonicalModule).toContain("trace/canonical-event");
    expect(getCanonicalTechnology("clonereview")!.canonicalModule).toContain("clonereview/canonical/review");
  });

  it("each technology carries honest claimable/mustNotClaim", () => {
    for (const e of buildCanonicalTechnologyRegistry()) {
      expect(typeof e.claimableNow).toBe("string");
      expect(Array.isArray(e.mustNotClaim)).toBe(true);
    }
  });
});
