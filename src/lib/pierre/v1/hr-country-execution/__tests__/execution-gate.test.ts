// src/lib/pierre/v1/hr-country-execution/__tests__/execution-gate.test.ts
// PHASE 8.12 — the country execution gate is FAIL-CLOSED: because no country rule is VERIFIED, every
// country-dependent mission is blocked from the automated legally-sensitive path and routed to the
// governed manual / human path — with an auditable rule snapshot + evidence. It never runs on an
// unsourced rule.

import { describe, it, expect } from "vitest";
import { evaluateExecutionGate } from "../execution-gate";
import { bindMissionToJurisdiction } from "../mission-rule-binding";
import { buildCountryEvidence } from "../evidence";
import { HR_MISSION_PACKS } from "../../hr-mission-packs/registry";
import { P812_GAPS } from "../../hr-canon/gap-registry";
import { packsForCapability } from "../../hr-mission-packs/registry";

const NOW = "2026-07-02T10:00:00.000Z";
// pick a country-dependent pack (one realizing a P8.12 gap)
const countryPack = HR_MISSION_PACKS.find((p) => p.countryRuleRequirements.some((r) => r.required))!;

describe("country execution gate (fail-closed)", () => {
  it("blocks a country-dependent mission because no rule is VERIFIED", () => {
    const gate = evaluateExecutionGate(countryPack, { packId: countryPack.id, jurisdiction: "FR", nowIso: NOW });
    expect(gate.allowed).toBe(false);
    expect(gate.blockedRules.length).toBeGreaterThan(0);
    expect(gate.route).not.toBe("AUTOMATED_VERIFIED");
    expect(gate.snapshotId).toBeTruthy();
  });

  it("EVERY P8.12 gap capability's pack is blocked from automated execution (fail-closed) for all 4 countries", () => {
    for (const gap of P812_GAPS) {
      for (const pack of packsForCapability(gap.id)) {
        for (const j of ["FR", "BE", "LU", "CH"] as const) {
          const gate = evaluateExecutionGate(pack, { packId: pack.id, jurisdiction: j, nowIso: NOW });
          expect(gate.allowed, `${pack.id}/${j}`).toBe(false);
        }
      }
    }
  });

  it("binds a mission to a jurisdiction with an auditable snapshot + evidence", () => {
    const binding = bindMissionToJurisdiction(countryPack, "BE", NOW);
    expect(binding.snapshot.allVerified).toBe(false);
    expect(binding.gate.allowed).toBe(false);
    const ev = buildCountryEvidence(binding, NOW);
    expect(ev.gateAllowed).toBe(false);
    expect(ev.allRulesVerified).toBe(false);
    expect(ev.snapshotFingerprint).toBeTruthy();
  });

  it("routes to the pack's governed fallback (human/manual/external), never automated", () => {
    const gate = evaluateExecutionGate(countryPack, { packId: countryPack.id, jurisdiction: "LU", nowIso: NOW });
    expect(["GOVERNED_MANUAL", "HUMAN_DECISION", "EXTERNAL_BLOCKED"]).toContain(gate.route);
  });
});
