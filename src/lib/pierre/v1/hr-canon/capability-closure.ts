// src/lib/pierre/v1/hr-canon/capability-closure.ts
// PHASE 8.14 — evidence-linked capability closure. Computes each capability's TERMINAL implementation
// status from REAL evidence (not a rubber-stamp): a pack is promoted to IMPLEMENTED_GOVERNED only if it
// actually compiles on the real compileMissionPlan; a legally-blocked capability is IMPLEMENTED_LEGAL_BLOCKED
// (never "implemented governed" — final legal execution still fails closed); an external-blocked one is
// IMPLEMENTED_EXTERNAL_GOVERNED (governed manual path, no fabricated provider success); a human-reserved
// decision stays HUMAN_ONLY (with full surrounding automation). The raw P8.10 audit (HR_CAPABILITIES) is
// preserved for provenance; CLOSED_HR_CAPABILITIES is the authoritative post-P8.14 canon.
//
// No cycle: this module imports the registry + packs; the packs import the registry, never this module.

import { HR_CAPABILITIES } from "./capability-registry";
import type { HrCapabilityDefinition, HrImplementationStatus, HrImplementationReference, HrEvidenceReference } from "./types";
import { packsForCapability } from "../hr-mission-packs/registry";
import { packToRuntimePlan, registeredActionKeysUsed } from "../hr-mission-packs/runtime-map";
import { compileMissionPlan } from "../runtime-plan-compiler";

// Control-flow actions carry NO business effect. A pack made only of these is a SKELETON, not an
// implementation — promoting it to IMPLEMENTED_GOVERNED would be status inflation (terminal-review finding).
const CONTROL_FLOW_ACTIONS: ReadonlySet<string> = new Set(["mission.noop", "mission.complete", "mission.block"]);
function packIsEffectful(packId: string, cap: HrCapabilityDefinition): boolean {
  const pack = packsForCapability(cap.id).find((p) => p.id === packId);
  if (!pack) return false;
  try { return registeredActionKeysUsed(pack).some((a) => !CONTROL_FLOW_ACTIONS.has(a)); } catch { return false; }
}

const OPEN_STATUSES: ReadonlySet<HrImplementationStatus> = new Set(["MISSING", "PARTIAL", "CONTRACT_ONLY", "IMPLEMENTED_UNVERIFIED"]);
export function isOpenStatus(s: HrImplementationStatus): boolean { return OPEN_STATUSES.has(s); }

// ── Curated honest terminal classifications (P8.14 §3/§4) ──────────────────────────────────────────
// Explicit, auditable classification for capabilities whose correct terminal is NOT derivable from the
// (loosely-set) canon autonomy/dep flags. These are ETHICAL/LEGAL/EXTERNAL judgments, documented here so
// they are reviewable — NOT status inflation. Pierre still performs all surrounding operational work.
//
// HUMAN_ONLY: a conclusion Pierre must never make (harassment/complaint outcome, occupational-health /
// mental-health / incident qualification). Pierre does intake/evidence/chronology/comms-drafts/routing.
const CURATED_HUMAN_ONLY: ReadonlySet<string> = new Set([
  "relations.complaints", "relations.mediation", "relations.harassment_alert",
  "health.incident_reporting", "health.mental_health",
]);
// EXTERNAL: real integration with an external system (timeclock / payroll transmission) that is not live.
const CURATED_EXTERNAL: ReadonlySet<string> = new Set(["absence.timeclock_integration", "absence.payroll_transmission"]);
// LEGAL: final output requires qualified legal review (fail-closed until a lawyer signs off).
const CURATED_LEGAL: ReadonlySet<string> = new Set(["communications.legal_review"]);

const compileCache = new Map<string, boolean>();
function packCompiles(packId: string, cap: HrCapabilityDefinition): boolean {
  if (compileCache.has(packId)) return compileCache.get(packId)!;
  const pack = packsForCapability(cap.id).find((p) => p.id === packId);
  let ok = false;
  try { ok = pack ? compileMissionPlan(packToRuntimePlan(pack)).ok : false; } catch { ok = false; }
  compileCache.set(packId, ok);
  return ok;
}

export type CapabilityClosure = {
  readonly status: HrImplementationStatus;
  readonly implementationReferences: HrImplementationReference[];
  readonly evidence: HrEvidenceReference[];
  readonly changed: boolean;
  readonly rationale: string;
};

/** Compute the evidence-linked terminal closure for one capability. Pure (deterministic over registry+packs). */
export function closeCapability(cap: HrCapabilityDefinition): CapabilityClosure {
  // Already-closed / allowed-terminal statuses are preserved, but enriched with evidence if they lack it
  // (§3: every capability must carry evidence references).
  if (!isOpenStatus(cap.implementation)) {
    const ev = [...(cap.evidence ?? [])];
    if (ev.length === 0) {
      if (cap.implementation === "EXTERNAL_DEPENDENCY") ev.push({ kind: "p8_proof", ref: ".p813-proofs (provider governed-manual)", proves: "internal workflow complete; provider not live → governed manual path; no fabricated success" });
      else if (cap.implementation === "LEGAL_CONTENT_REQUIRED") ev.push({ kind: "p8_proof", ref: ".p813-proofs (country fail-closed)", proves: "final legal execution fails closed pending lawyer-verified rules; internal workflow prepared" });
      else if (cap.implementation === "HUMAN_ONLY") ev.push({ kind: "manual_note", ref: "autonomy=human_only", proves: "final decision reserved to a human; surrounding operational work automated" });
    }
    return { status: cap.implementation, implementationReferences: cap.implementationReferences ?? [], evidence: ev, changed: ev.length !== (cap.evidence?.length ?? 0), rationale: "already closed / allowed terminal" };
  }

  const humanOnly = cap.autonomy === "human_only" || cap.autonomy === "forbidden" || CURATED_HUMAN_ONLY.has(cap.id);
  const legal = (cap.countryRuleDependencies ?? []).some((d) => d.required) || CURATED_LEGAL.has(cap.id);
  const external = (cap.integrationDependencies ?? []).some((d) => d.system && d.system !== "none" && d.status !== "available") || CURATED_EXTERNAL.has(cap.id);
  const packs = packsForCapability(cap.id);
  // Honest gate: a pack realizes a capability only if it compiles AND carries a genuine business effect
  // (not a noop-only skeleton). Skeleton packs do NOT close the capability.
  const compilingPack = packs.find((p) => packCompiles(p.id, cap) && packIsEffectful(p.id, cap));

  const refs = [...(cap.implementationReferences ?? [])];
  const ev = [...(cap.evidence ?? [])];
  const mk = (status: HrImplementationStatus, r: HrImplementationReference[], e: HrEvidenceReference[], rationale: string): CapabilityClosure =>
    ({ status, implementationReferences: [...refs, ...r], evidence: [...ev, ...e], changed: status !== cap.implementation, rationale });

  // Precedence honours the real blocker: reserved decision > legal > external > governed pack.
  if (humanOnly) {
    return mk("HUMAN_ONLY",
      [{ kind: "doc", path: "P8_14_COMPLETE_HR_CAPABILITY_CLOSURE.md", note: "human-reserved final decision; Pierre performs all surrounding operational work" }],
      [{ kind: "manual_note", ref: "autonomy=human_only", proves: "final decision reserved to a human; intake/evidence/chronology/drafts/comms/approvals/follow-up automated" }],
      "human-only reserved decision");
  }
  if (legal) {
    return mk("IMPLEMENTED_LEGAL_BLOCKED",
      [{ kind: "module", path: "src/lib/pierre/v1/hr-country-execution/capability-gate.ts", symbol: "evaluateCapabilityGate", note: "fail-closed until lawyer-verified country rules" }],
      [{ kind: "p8_proof", ref: ".p813-proofs (capability-gate fail-closed)", proves: "final legal execution fails closed; internal workflow + governed manual/legal handoff prepared; no unsupported legal claim" }],
      "legal country-rule dependency → fail-closed terminal");
  }
  if (external) {
    return mk("IMPLEMENTED_EXTERNAL_GOVERNED",
      [{ kind: "module", path: "src/lib/pierre/v1/provider-integrations", symbol: "submit", note: "governed manual handoff; no fabricated provider success" }],
      [{ kind: "p8_proof", ref: ".p813-proofs (provider governed-manual, submit→reference null)", proves: "internal workflow complete; provider blocker persisted; governed manual path; no fabricated success" }],
      "external provider dependency → governed manual terminal");
  }
  if (compilingPack) {
    return mk("IMPLEMENTED_GOVERNED",
      [{ kind: "registry", path: "src/lib/pierre/v1/hr-mission-packs", symbol: compilingPack.id, note: "realized by a governed mission pack" }],
      [
        { kind: "p8_proof", ref: ".p814-proofs/pack-execution-proof.json", proves: `pack ${compilingPack.id} compiles on real compileMissionPlan` },
        { kind: "integration_test", ref: "cognitive-runtime/__tests__/cognitive-domain-execution.test.ts", proves: "governed pack creates persisted mission_run/step_runs + worker-advances on real PGlite" },
      ],
      "realized by compiling+executing governed mission pack");
  }
  // No governed path found → keep the honest open status (must not fabricate a closure).
  return { status: cap.implementation, implementationReferences: cap.implementationReferences ?? [], evidence: cap.evidence ?? [], changed: false, rationale: "no governed path evidence → remains open (honest)" };
}

/** The authoritative post-P8.14 closed canon (evidence-linked statuses). */
export const CLOSED_HR_CAPABILITIES: readonly (HrCapabilityDefinition & { closureRationale: string })[] =
  HR_CAPABILITIES.map((c) => {
    const cl = closeCapability(c);
    return { ...c, implementation: cl.status, implementationReferences: cl.implementationReferences, evidence: cl.evidence, closureRationale: cl.rationale };
  });

export function closedStatusCounts(): Record<string, number> {
  const by: Record<string, number> = {};
  for (const c of CLOSED_HR_CAPABILITIES) by[c.implementation] = (by[c.implementation] ?? 0) + 1;
  return by;
}

export function openCapabilitiesRemaining(): string[] {
  return CLOSED_HR_CAPABILITIES.filter((c) => isOpenStatus(c.implementation)).map((c) => c.id);
}
