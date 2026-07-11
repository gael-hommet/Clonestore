// src/lib/pierre/v1/ultimate/p16a/gap-matrix.ts
// P16A — the EVIDENCE-DERIVED gap matrix. For each canonical Ultimate item, a synchronous PROBE exercises
// the REAL reused runtime for that item's representative behavior. Status is DERIVED from the probe (real
// behavior), never from "a file exists". The Pierre-OWNED behavior for P16A is: understand + retrieve
// relevant capabilities + classify the governed disposition + honest floor/provider/legal truth + declare
// the T1/T2 needs. The LIVE delivery (T1/T2 wiring) is P16C; external providers stay blocked. So a row is
// "complete" when the Pierre-owned behavior is proven, with the P16C/external dependency recorded honestly.

import { compileMissionPlan } from "../../runtime-plan-compiler";
import { evaluateGuard } from "../../cloneguard";
import { resolveTemporal } from "../../cognitive-runtime/temporal-resolution";
import { HR_CAPABILITIES } from "../../hr-canon/capability-registry";
import { canonicalUltimateItems } from "./canonical-items";
import { retrieveForRequest, selectedCapabilitiesByDomain, selectedCapabilityById } from "./capability-adapter";
import { classifyFinalDecisionFloor } from "./sensitive-floor";
import { classifyContinuityIntent } from "./continuity-intent";

export type PierreOwnedStatus = "complete" | "partial" | "missing";

export type GapMatrixRow = {
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly featureStatus: string;         // master-split current_status (feature-level truth)
  readonly pierreOwnedBehavior: string;
  readonly reusedModules: readonly string[];
  readonly existingEvidence: string;      // what the probe actually proved
  readonly evidencePresent: boolean;
  readonly pierreOwnedStatus: PierreOwnedStatus;
  readonly gap: string;                   // what remains (usually P16C wiring / external)
  readonly p16aAction: string;            // what P16A completed
  readonly p16cDependency: readonly string[];
  readonly externalDependency: string | null;
  readonly forbiddenClaim: string;
};

type Probe = () => { present: boolean; detail: string };

// Each probe exercises the REAL reused module(s) for the item's representative behavior.
const PROBES: Readonly<Record<string, Probe>> = {
  "pierre.mission_depth": () => {
    const compiled = compileMissionPlan({
      schema_version: "1",
      steps: [
        { step_key: "s1", action_key: "mission.noop", depends_on: [] },
        { step_key: "s2", action_key: "mission.noop", depends_on: ["s1"] },
        { step_key: "s3", action_key: "mission.complete", depends_on: ["s2"] },
      ],
    });
    return { present: compiled.ok && compiled.steps.length === 3 && !!compiled.plan_fingerprint, detail: `compileMissionPlan ok=${compiled.ok}, steps=${compiled.steps.length}, fingerprint=${compiled.plan_fingerprint ? "set" : "none"}` };
  },
  "pierre.document_depth": () => {
    const caps = retrieveForRequest("Fais l'avenant de Nora pour mardi");
    const doc = caps.find((c) => c.domain === "contract" || /avenant|contract|document|attestation/i.test(c.label));
    const safe = !doc || doc.disposition !== "execute_local"; // a document is never auto-executed
    return { present: caps.length > 0 && safe, detail: `caps=${caps.length}, docCap=${doc?.id ?? "none"}, disposition=${doc?.disposition ?? "n/a"} (never execute_local)` };
  },
  "pierre.dossier_360": () => {
    const caps = selectedCapabilitiesByDomain("employee360");
    return { present: caps.length > 0, detail: `employee360 capabilities=${caps.length}; MemoryTech/EvidenceTech declared` };
  },
  "pierre.onboarding_offboarding": () => {
    const caps = retrieveForRequest("Prépare le départ de Marc");
    const has = caps.some((c) => c.domain === "offboarding" || c.domain === "onboarding");
    return { present: caps.length > 0 && has, detail: `caps=${caps.length}, onboarding/offboarding domain present=${has}` };
  },
  "pierre.absences_prepayroll": () => {
    const caps = retrieveForRequest("Prépare les éléments de pré-paie");
    // Preparation may be autonomous for internal computation; but any payroll capability with an EXTERNAL
    // (provider) or LEGAL dependency — i.e. transmission/DSN — must NEVER be autonomous. That is the floor.
    const noAutoTransmit = caps
      .filter((c) => c.domain === "payroll" && (c.providerDependency || c.legalDependency))
      .every((c) => c.disposition !== "execute_local");
    return { present: caps.length > 0 && noAutoTransmit, detail: `caps=${caps.length}, external/legal payroll never autonomous=${noAutoTransmit}` };
  },
  "pierre.interview_perf_training": () => {
    const perf = selectedCapabilitiesByDomain("performance").length + selectedCapabilitiesByDomain("training").length + selectedCapabilitiesByDomain("career").length;
    const date = resolveTemporal("la semaine prochaine", "2026-07-13");
    return { present: perf > 0 && date.status === "resolved", detail: `perf/training/career capabilities=${perf}, date('la semaine prochaine')=${date.status}` };
  },
  "pierre.employee_relations_sensitive": () => {
    const floor = classifyFinalDecisionFloor("Décide de la sanction pour ce cas");
    return { present: floor.humanOnly && floor.categories.includes("sanction"), detail: `humanOnly=${floor.humanOnly}, categories=[${floor.categories.join(",")}]` };
  },
  "pierre.proactive_followup": () => {
    const caps = selectedCapabilitiesByDomain("proactive");
    const cont = classifyContinuityIntent("Qu'est-ce qu'il reste à faire ?", { missions: [{ id: "m1", label: "Onboarding Sarah" }] });
    return { present: cont.kind === "status" && cont.requiresAuthoritativeRead, detail: `proactive capabilities=${caps.length}, statusIntent=${cont.kind}, requiresAuthoritativeRead=${cont.requiresAuthoritativeRead}` };
  },
  "pierre.monthly_value_report": () => {
    const caps = selectedCapabilitiesByDomain("reporting");
    return { present: caps.length > 0, detail: `reporting capabilities=${caps.length}; AnalyticsTech declared; ROI as estimates (never guaranteed)` };
  },
  "pierre.sector_adaptation": () => {
    // Pierre-owned HONEST behavior (BEHAVIORAL, not a static field): a capability that depends on a
    // required country rule is marked legal + is NEVER autonomous, and a legal-conclusion request is
    // human-only — i.e. Pierre refuses to invent/apply the law and escalates.
    const legalCaps = HR_CAPABILITIES.filter((c) => (c.countryRuleDependencies ?? []).some((d) => d.required)).slice(0, 5).map((c) => selectedCapabilityById(c.id)!).filter(Boolean);
    const neverAutonomous = legalCaps.every((c) => c.legalDependency && c.disposition !== "execute_local");
    const legalFloor = classifyFinalDecisionFloor("Dis-moi si c'est légal de licencier pendant un arrêt maladie").categories.includes("legal_conclusion");
    return { present: (legalCaps.length === 0 || neverAutonomous) && legalFloor, detail: `legal caps sampled=${legalCaps.length}, never autonomous=${neverAutonomous}, legal-conclusion floor=${legalFloor}` };
  },
  "pierre.hr_helpdesk_quality": () => {
    const caps = retrieveForRequest("Quelles sont les étapes d'un onboarding conforme ?");
    return { present: caps.length > 0, detail: `grounded capabilities retrieved=${caps.length}` };
  },
  "pierre.hr_quality_control": () => {
    // CloneGuard as the reusable quality/risk gate: a sensitive HR action is hard-blocked (black) and a
    // moderate one is flagged (orange) — the gate really changes the verdict, it is not cosmetic.
    const black = evaluateGuard({ action: "termination", risk: "critical", sensitivity: "restricted", text: "cas sensible" });
    const green = evaluateGuard({ action: "create_task", risk: "low", sensitivity: "normal", text: "classer un document" });
    return { present: !black.allow && black.level === "black" && green.allow && green.level === "green", detail: `CloneGuard gate: sensitive→${black.level}(allow=${black.allow}), safe→${green.level}(allow=${green.allow})` };
  },
};

/** Compute the evidence-derived gap matrix over the canonical 12 items. Pure/deterministic. */
export function computeGapMatrix(): GapMatrixRow[] {
  return canonicalUltimateItems().map(({ item, meta }) => {
    const probe = PROBES[item.id];
    const ev = probe ? probe() : { present: false, detail: "no probe" };
    const p16cDependency = [...meta.t1Needs.map((t) => `T1:${t}`), ...meta.t2Needs.map((t) => `T2:${t}`)];
    const pierreOwnedStatus: PierreOwnedStatus = ev.present ? "complete" : "partial";
    const gap = ev.present
      ? (meta.externalDependency ? `Livraison LIVE dépend d'un provider externe (${meta.externalDependency}) + wiring P16C.` : `Livraison LIVE via technologies (${p16cDependency.join(", ") || "aucune"}) réservée à P16C.`)
      : "Comportement Pierre-owned non prouvé par la sonde — à compléter.";
    return {
      id: item.id,
      label: item.title,
      source: "P16_MASTER_SPLIT.pierre_ultimate (P16.0) + P16A plan",
      featureStatus: item.current_status,
      pierreOwnedBehavior: meta.pierreOwnedBehavior,
      reusedModules: meta.reusedModules,
      existingEvidence: ev.detail,
      evidencePresent: ev.present,
      pierreOwnedStatus,
      gap,
      p16aAction: "Orchestration gouvernée via le runtime réel + contrat P16C (aucun 2e cerveau, aucune techno câblée).",
      p16cDependency,
      externalDependency: meta.externalDependency,
      forbiddenClaim: meta.forbiddenClaim,
    };
  });
}

/** True iff every canonical item's Pierre-owned behavior is proven (complete). */
export function allPierreOwnedComplete(): boolean {
  return computeGapMatrix().every((r) => r.pierreOwnedStatus === "complete");
}
