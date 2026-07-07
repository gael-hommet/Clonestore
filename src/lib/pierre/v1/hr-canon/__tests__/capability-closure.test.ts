// src/lib/pierre/v1/hr-canon/__tests__/capability-closure.test.ts
// PHASE 8.14 — the evidence-linked capability closure. Proves the closed canon reaches the §4 terminal
// (0 open) WITHOUT fabrication: every promotion is backed by a compiling pack or a real external/legal
// governed path, and the raw P8.10 audit is preserved for provenance.

import { describe, it, expect } from "vitest";
import { HR_CAPABILITIES } from "../capability-registry";
import { CLOSED_HR_CAPABILITIES, closedStatusCounts, openCapabilitiesRemaining, isOpenStatus } from "../capability-closure";
import { packsForCapability } from "../../hr-mission-packs/registry";
import { packToRuntimePlan, registeredActionKeysUsed } from "../../hr-mission-packs/runtime-map";
import { compileMissionPlan } from "../../runtime-plan-compiler";

describe("capability closure (evidence-linked, HONEST — no skeleton inflation)", () => {
  it("closes ALL capabilities with REAL effect (0 open) — no skeleton inflation", () => {
    // After adding the real analytics.compute action + wiring the computational packs + curating the
    // genuinely sensitive/external/legal ones, every capability reaches a genuine terminal: 0 open,
    // and every IMPLEMENTED_GOVERNED is effectful (asserted below), not a noop skeleton.
    expect(openCapabilitiesRemaining().length).toBe(0);
    const counts = closedStatusCounts();
    expect(counts.MISSING ?? 0).toBe(0);
    expect(counts.PARTIAL ?? 0).toBe(0);
    expect(counts.CONTRACT_ONLY ?? 0).toBe(0);
    expect(counts.IMPLEMENTED_UNVERIFIED ?? 0).toBe(0);
    expect((counts.IMPLEMENTED_GOVERNED ?? 0)).toBeGreaterThan(0);
  });

  it("preserves the total and the raw P8.10 audit baseline (provenance)", () => {
    expect(CLOSED_HR_CAPABILITIES.length).toBe(HR_CAPABILITIES.length);
    // raw registry still carries the audit statuses (not mutated)
    const rawOpen = HR_CAPABILITIES.filter((c) => isOpenStatus(c.implementation)).length;
    expect(rawOpen).toBeGreaterThan(0); // the raw audit is preserved
  });

  it("every CLOSED/terminal capability carries evidence (open ones honestly need none)", () => {
    const noEvidence = CLOSED_HR_CAPABILITIES.filter((c) => !isOpenStatus(c.implementation) && c.implementation !== "OUT_OF_SCOPE" && (c.evidence?.length ?? 0) === 0);
    expect(noEvidence.map((c) => c.id)).toEqual([]);
  });

  it("every IMPLEMENTED_GOVERNED capability is genuinely EFFECTFUL (no noop-only skeleton inflation)", () => {
    const CONTROL = new Set(["mission.noop", "mission.complete", "mission.block"]);
    const inflated = CLOSED_HR_CAPABILITIES.filter((c) => c.implementation === "IMPLEMENTED_GOVERNED" && !packsForCapability(c.id).some((p) => { try { return registeredActionKeysUsed(p).some((a) => !CONTROL.has(a)); } catch { return false; } }));
    expect(inflated.map((c) => c.id)).toEqual([]);
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
