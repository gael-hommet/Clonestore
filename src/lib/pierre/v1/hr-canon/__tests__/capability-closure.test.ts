// src/lib/pierre/v1/hr-canon/__tests__/capability-closure.test.ts
// PHASE 8.14 — the evidence-linked capability closure. Proves the closed canon reaches the §4 terminal
// (0 open) WITHOUT fabrication: every promotion is backed by a compiling pack or a real external/legal
// governed path, and the raw P8.10 audit is preserved for provenance.

import { describe, it, expect } from "vitest";
import { HR_CAPABILITIES } from "../capability-registry";
import { CLOSED_HR_CAPABILITIES, closedStatusCounts, openCapabilitiesRemaining, isOpenStatus } from "../capability-closure";
import { packsForCapability } from "../../hr-mission-packs/registry";
import { packToRuntimePlan } from "../../hr-mission-packs/runtime-map";
import { compileMissionPlan } from "../../runtime-plan-compiler";

describe("capability closure (§4 — 0 open, evidence-linked)", () => {
  it("closed canon has ZERO open statuses (MISSING/PARTIAL/CONTRACT_ONLY/IMPLEMENTED_UNVERIFIED)", () => {
    expect(openCapabilitiesRemaining().length).toBe(0);
    const counts = closedStatusCounts();
    expect(counts.MISSING ?? 0).toBe(0);
    expect(counts.PARTIAL ?? 0).toBe(0);
    expect(counts.CONTRACT_ONLY ?? 0).toBe(0);
    expect(counts.IMPLEMENTED_UNVERIFIED ?? 0).toBe(0);
  });

  it("preserves the total and the raw P8.10 audit baseline (provenance)", () => {
    expect(CLOSED_HR_CAPABILITIES.length).toBe(HR_CAPABILITIES.length);
    // raw registry still carries the audit statuses (not mutated)
    const rawOpen = HR_CAPABILITIES.filter((c) => isOpenStatus(c.implementation)).length;
    expect(rawOpen).toBeGreaterThan(0); // the raw audit is preserved
  });

  it("every closed capability carries evidence (no evidence-free closure)", () => {
    const noEvidence = CLOSED_HR_CAPABILITIES.filter((c) => c.implementation !== "OUT_OF_SCOPE" && (c.evidence?.length ?? 0) === 0);
    expect(noEvidence.map((c) => c.id)).toEqual([]);
  });

  it("NO fabrication: a legal/external-blocked capability is never labelled IMPLEMENTED_GOVERNED", () => {
    // The anti-fabrication invariant: if a capability's execution depends on lawyer-verified rules or a
    // live provider, it must NEVER claim full governed implementation — it stays a *_BLOCKED / *_GOVERNED
    // external/legal terminal (final execution fails closed). It may only be IMPLEMENTED_GOVERNED if it has
    // NO such blocker.
    for (const c of CLOSED_HR_CAPABILITIES) {
      const legal = (c.countryRuleDependencies ?? []).some((d) => d.required);
      const external = (c.integrationDependencies ?? []).some((d) => d.system && d.system !== "none" && d.status !== "available");
      if (c.implementation === "IMPLEMENTED_GOVERNED") {
        expect(legal).toBe(false);
        expect(external).toBe(false);
      }
    }
  });

  it("every IMPLEMENTED_GOVERNED capability is backed by a pack that REALLY compiles", () => {
    const governed = CLOSED_HR_CAPABILITIES.filter((c) => c.implementation === "IMPLEMENTED_GOVERNED");
    expect(governed.length).toBeGreaterThan(0);
    for (const c of governed) {
      const packs = packsForCapability(c.id);
      const anyCompiles = packs.some((p) => { try { return compileMissionPlan(packToRuntimePlan(p)).ok; } catch { return false; } });
      expect(anyCompiles).toBe(true); // never promoted without a compiling pack
    }
  });

  it("human-only reserved decisions stay HUMAN_ONLY", () => {
    for (const c of CLOSED_HR_CAPABILITIES) {
      if (c.autonomy === "human_only" || c.autonomy === "forbidden") {
        expect(["HUMAN_ONLY", "VERIFIED_EXISTING"]).toContain(c.implementation);
      }
    }
  });
});
