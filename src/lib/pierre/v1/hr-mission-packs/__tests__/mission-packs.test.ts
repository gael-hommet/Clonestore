// src/lib/pierre/v1/hr-mission-packs/__tests__/mission-packs.test.ts
// PHASE 8.11 — the mission packs are real & governed: every pack is valid, compiles CLEAN on the
// REAL P8.5 runtime compiler, only references registered actions / real capabilities, and together
// they cover 100% of the canon's DYNAMIC P8.11 gap set (never hardcoded). HUMAN_ONLY capabilities
// are not directly automated; no pack invents an action.

import { describe, it, expect } from "vitest";
import { HR_MISSION_PACKS, computePackCoverage, danglingPackCapabilities } from "../registry";
import { validatePackRegistry } from "../validator";
import { compileAll, compileMissionPack } from "../compiler";
import { P811_GAPS } from "../../hr-canon/gap-registry";
import { isKnownRuntimeAction } from "../../runtime-action-registry";

describe("HR mission packs", () => {
  it("registry is valid (no errors, no duplicate ids, no dangling capabilities)", () => {
    const v = validatePackRegistry([...HR_MISSION_PACKS]);
    if (!v.ok) console.error(JSON.stringify(v.errors.slice(0, 10), null, 1));
    expect(v.ok).toBe(true);
    expect(v.duplicateIds).toEqual([]);
    expect(danglingPackCapabilities()).toEqual([]);
  });

  it("COVERS 100% of the dynamic P8.11 gap set (no hardcoded count)", () => {
    const cov = computePackCoverage();
    expect(cov.targetedGapCount).toBe(P811_GAPS.length);        // dynamic, from canon
    expect(cov.coveredGapCount).toBe(cov.targetedGapCount);
    expect(cov.uncoveredGapIds).toEqual([]);
  });

  it("every pack COMPILES CLEAN on the real runtime plan compiler", () => {
    const r = compileAll([...HR_MISSION_PACKS]);
    if (!r.ok) console.error("failed:", r.failed, r.results.filter((x) => !x.ok).map((x) => x.blockers));
    expect(r.ok).toBe(true);
    expect(r.failed).toEqual([]);
    // and each compiled runtime plan is genuinely ok (ran the real compiler)
    for (const res of r.results) expect(res.compiled.ok, res.id).toBe(true);
  });

  it("NEVER invents an action: every runtime_action binding is in the closed registry", () => {
    for (const p of HR_MISSION_PACKS) for (const s of p.steps) if (s.binding.type === "runtime_action") expect(isKnownRuntimeAction(s.binding.actionKey), `${p.id}/${s.key}`).toBe(true);
  });

  it("does NOT directly automate HUMAN_ONLY capabilities", () => {
    expect(computePackCoverage().humanOnlyNotAutomated).toEqual([]);
  });

  it("external-blocked packs declare their integration + an external step (no simulated success)", () => {
    for (const p of HR_MISSION_PACKS.filter((x) => x.runtimeStatus === "RUNTIME_READY_EXTERNAL_BLOCKED")) {
      expect(p.integrationRequirements.length, p.id).toBeGreaterThanOrEqual(1);
      expect(p.steps.some((s) => s.binding.type === "external_handoff"), p.id).toBe(true);
    }
  });

  it("human-decision packs route to a human, never auto-decide", () => {
    for (const p of HR_MISSION_PACKS.filter((x) => x.runtimeStatus === "HUMAN_DECISION_REQUIRED")) {
      expect(p.steps.some((s) => s.binding.type === "human_decision"), p.id).toBe(true);
    }
  });

  it("a broken pack (unregistered action) is rejected by the compiler", () => {
    const broken = { ...HR_MISSION_PACKS[0], steps: [{ key: "x", kind: "mutate_record" as const, label: "x", binding: { type: "runtime_action" as const, actionKey: "database.query" }, autonomy: "execute_autonomous" as const }] };
    const c = compileMissionPack(broken);
    expect(c.ok).toBe(false);
  });
});
