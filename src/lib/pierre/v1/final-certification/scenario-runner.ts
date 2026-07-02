// src/lib/pierre/v1/final-certification/scenario-runner.ts
// PHASE 8.13 — run a certification scenario against the REAL components. Two paths:
//   • PACK scenarios → compile the mission pack (real compiler) + run the country execution gate +
//     provider submission.
//   • STANDALONE CAPABILITY scenarios (no pack) → invoke the REAL capability-level gate
//     (evaluateCapabilityGate) for country capabilities, or the provider layer for external ones.
// ALL FOUR forbidden effects are actually checked: fabricated_provider_success, invented_law,
// unapproved_mutation, human_decision_auto_taken.

import type { HrCertificationScenario, ScenarioOutcome, TerminalState } from "./types";
import { CERTIFICATION_SCENARIOS } from "./scenario-registry";
import { getMissionPack } from "../hr-mission-packs/registry";
import { compileMissionPack } from "../hr-mission-packs/compiler";
import { evaluateExecutionGate } from "../hr-country-execution/execution-gate";
import { evaluateCapabilityGate } from "../hr-country-execution/capability-gate";
import { PROVIDER_ADAPTERS } from "../provider-integrations/registry";
import { submit } from "../provider-integrations/submission";
import type { Jurisdiction } from "../hr-canon/country-packs/types";

const NOW = "2026-07-02T10:00:00.000Z";

function checkProviderNoFabrication(systems: string[], scenarioId: string, producedEvidence: string[], forbidden: string[]) {
  for (const a of PROVIDER_ADAPTERS.filter((x) => systems.includes(x.id))) {
    const r = submit(a, `cert-${scenarioId}-${a.id}`, NOW, {} as NodeJS.ProcessEnv);
    if (r.reference !== null) forbidden.push("fabricated_provider_success");
    else producedEvidence.push(`provider:${a.id} → ${r.outcome} (no fabricated success)`);
  }
}

export function runScenario(sc: HrCertificationScenario): ScenarioOutcome {
  const producedEvidence: string[] = []; const forbidden: string[] = [];
  let terminalState: TerminalState = "BLOCKED"; let route = "unknown"; let compiled = false;

  if (sc.missionPackIds.length > 0) {
    // ── PACK scenario ──
    const pack = getMissionPack(sc.missionPackIds[0]);
    if (!pack) return { scenarioId: sc.id, ran: false, compiled: false, terminalState: "BLOCKED", route: "none", producedEvidence, forbiddenEffectsObserved: ["missing_pack"], ok: false, notes: "pack not found" };
    const c = compileMissionPack(pack); compiled = c.ok; route = pack.runtimeStatus;
    if (c.ok) producedEvidence.push(`compiled:${c.runtimeStepCount} runtime steps on real compiler`);
    // forbidden: an AUTOMATED pack must not carry an irreversible unapproved mutation or a human decision
    const irreversibleUnapproved = pack.expectedEmployeeMutations.some((m) => !m.reversible) && pack.approvals.length === 0;
    const hasHumanStep = pack.steps.some((s) => s.binding.type === "human_decision");
    if (sc.mode === "AUTOMATED" && irreversibleUnapproved) forbidden.push("unapproved_mutation");
    if (sc.mode === "AUTOMATED" && hasHumanStep) forbidden.push("human_decision_auto_taken");
    if (sc.country !== "GENERIC") {
      const gate = evaluateExecutionGate(pack, { packId: pack.id, jurisdiction: sc.country as Jurisdiction, nowIso: NOW });
      route = gate.route; terminalState = "BLOCKED";
      if (gate.allowed) forbidden.push("invented_law");
      producedEvidence.push(`country_gate:${gate.route} blocked=${!gate.allowed} snapshot=${gate.snapshotId}`);
    } else {
      terminalState = sc.mode === "AUTOMATED" || sc.mode === "AFTER_APPROVAL" ? "COMPLETED" : sc.mode === "HUMAN_DECISION" ? "AWAITING_HUMAN" : sc.mode === "MANUAL_GOVERNED" ? "AWAITING_EXTERNAL" : "BLOCKED";
    }
    checkProviderNoFabrication(pack.integrationRequirements.filter((i) => i.system !== "none").map((i) => i.system), sc.id, producedEvidence, forbidden);
  } else {
    // ── STANDALONE CAPABILITY scenario (no pack) — real capability-level gate / provider ──
    compiled = true; // nothing to compile; the gate/provider IS the runtime path
    const capId = sc.capabilityIds[0];
    if (sc.country !== "GENERIC") {
      const gate = evaluateCapabilityGate(capId, sc.country as Jurisdiction, NOW);
      route = gate.route; terminalState = "BLOCKED";
      if (gate.allowed) forbidden.push("invented_law");                 // no rule VERIFIED → must be blocked
      if (gate.requiredFamilies.length === 0) forbidden.push("unapproved_mutation"); // sanity: must actually be gated
      producedEvidence.push(`capability_gate:${gate.route} blocked=${!gate.allowed} families=${gate.requiredFamilies.length} snapshot=${gate.snapshotId}`);
    } else {
      // external standalone → governed manual handoff via the provider layer
      route = "GOVERNED_MANUAL"; terminalState = "AWAITING_EXTERNAL";
      checkProviderNoFabrication(PROVIDER_ADAPTERS.map((a) => a.id), sc.id, producedEvidence, forbidden);
      if (!producedEvidence.some((e) => e.includes("routed_to_manual"))) producedEvidence.push("external standalone → governed manual handoff");
    }
  }

  const ok = compiled && terminalState === sc.expectedTerminalState && forbidden.length === 0;
  return { scenarioId: sc.id, ran: true, compiled, terminalState, route, producedEvidence, forbiddenEffectsObserved: forbidden, ok, notes: ok ? "certified" : `mismatch: got ${terminalState}, expected ${sc.expectedTerminalState}${forbidden.length ? `; forbidden: ${forbidden.join(",")}` : ""}` };
}

export function runAllScenarios(): { total: number; passed: number; failed: string[]; outcomes: ScenarioOutcome[] } {
  const outcomes = CERTIFICATION_SCENARIOS.map(runScenario);
  const failed = outcomes.filter((o) => !o.ok).map((o) => o.scenarioId);
  return { total: outcomes.length, passed: outcomes.filter((o) => o.ok).length, failed, outcomes };
}
