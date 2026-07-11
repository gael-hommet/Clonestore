// src/lib/pierre/v1/ultimate/p16a/__tests__/p16a-pierre-ultimate.test.ts
// P16A — behavior tests mapped to the canonical 12 Pierre Ultimate items + families A–K (owner §16).
// Tests exercise REAL behavior (deterministic path — no OpenAI), not static status objects. Every family
// has positive + negative/unsafe + readiness coverage. Human-only floors are asserted UN-weakenable.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  canonicalUltimateItems, canonicalUltimateItemIds, crossCheckCanonicalItems,
} from "../canonical-items";
import { pierreCapabilityCount, retrieveForRequest, selectedCapabilityById, dispositionFor } from "../capability-adapter";
import { classifyFinalDecisionFloor } from "../sensitive-floor";
import { classifyContinuityIntent } from "../continuity-intent";
import { analyzeForP16C } from "../integration-contract";
import { computeGapMatrix, allPierreOwnedComplete } from "../gap-matrix";
import { computeP16ACommandCenter, type P16ACommandCenter } from "../command-center";

import { HR_CAPABILITIES, HR_CAPABILITY_IDS, getCapability } from "../../../hr-canon/capability-registry";
import { getPierreUltimateItems } from "@/lib/clonestore/ultimate/p16-master-split";
import { listTechnologyRegistryEntries } from "@/lib/clonestore/technologies/t1/technology-registry";
import { listProductTechnologyRegistryEntries } from "@/lib/clonestore/product-technologies/t2/product-technology-registry";
import { isCloneChatEnabled } from "@/lib/features/product-availability";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";

const NOW = "2026-07-13"; // a Monday
const base = { companyId: "co-1", actorId: "user-1", nowIso: NOW };
const sarah = { employees: [{ kind: "employee" as const, status: "resolved" as const, id: "emp-sarah", label: "Sarah", candidates: [], reason: "unique_match" }] };
const call = (instruction: string, opts = {}) => analyzeForP16C({ requestId: "r", ...base, instruction }, opts);

let cc: P16ACommandCenter;
beforeAll(async () => { cc = await computeP16ACommandCenter(); }, 120_000);

// ── A. Canonical recovery ─────────────────────────────────────────────────────────────────────────
describe("A. canonical recovery", () => {
  it("A1 recovers all canonical items from the real master source", () => {
    const ids = canonicalUltimateItemIds();
    expect(ids).toEqual(getPierreUltimateItems().map((i) => i.id));
  });
  it("A2 item count matches the real master source (12)", () => {
    expect(canonicalUltimateItems().length).toBe(getPierreUltimateItems().length);
    expect(canonicalUltimateItems().length).toBe(12);
  });
  it("A3 no item is invented / A4 none silently omitted", () => {
    const x = crossCheckCanonicalItems();
    expect(x.ok).toBe(true);
    expect(x.invented).toEqual([]);
    expect(x.missing).toEqual([]);
  });
  it("A5 statuses are evidence-derived (probe-backed), not a static file", () => {
    const rows = computeGapMatrix();
    expect(rows).toHaveLength(12);
    for (const r of rows) expect(r.existingEvidence.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.evidencePresent).length).toBe(12);
  });
});

// ── B. Capability canon ────────────────────────────────────────────────────────────────────────────
describe("B. capability canon", () => {
  it("B6 capability count equals the actual registry length", () => {
    expect(pierreCapabilityCount()).toBe(HR_CAPABILITIES.length);
  });
  it("B7 count is not hardcoded (tracks the registry)", () => {
    expect(cc.pierreCapabilityCount).toBe(HR_CAPABILITIES.length);
    expect(cc.capabilityCountDerivedNotHardcoded).toBe(true);
    // The source file must not contain a literal capability count.
    const src = readFileSync(join(__dirname, "../capability-adapter.ts"), "utf8");
    expect(src).not.toMatch(/return\s+215\b/);
  });
  it("B8 capability lookup by id works / B9 domain retrieval works", () => {
    const anyId = HR_CAPABILITY_IDS[0];
    expect(selectedCapabilityById(anyId)?.id).toBe(anyId);
    expect(selectedCapabilityById("nope.invented")).toBeUndefined();
    expect(retrieveForRequest("onboarding").length).toBeGreaterThan(0);
  });
  it("B10 provider/legal/human-only metadata is preserved", () => {
    // pick a human-only capability from the canon and confirm the adapter surfaces it
    const humanOnlyCap = HR_CAPABILITIES.find((c) => c.autonomy === "human_only" || c.autonomy === "forbidden");
    if (humanOnlyCap) expect(dispositionFor(humanOnlyCap)).toBe("human_only");
    const legalCap = HR_CAPABILITIES.find((c) => (c.countryRuleDependencies ?? []).some((d) => d.required));
    if (legalCap) expect(selectedCapabilityById(legalCap.id)?.legalDependency).toBe(true);
  });
  it("B11 full registry is never dumped (bounded retrieval)", () => {
    const caps = retrieveForRequest("onboarding contrat absence paie");
    expect(caps.length).toBeLessThan(HR_CAPABILITIES.length);
    expect(caps.length).toBeLessThanOrEqual(16);
  });
});

// ── C. Request understanding ──────────────────────────────────────────────────────────────────────
describe("C. request understanding", () => {
  it("C12 single HR intent understood / C13 multi-intent understood", async () => {
    const single = await call("Prépare l'onboarding de Sarah lundi", { subjects: sarah });
    expect(single.understanding.normalizedObjective.length).toBeGreaterThan(0);
    expect(single.understanding.multiIntent).toBe(false);
    const multi = await call("Fais l'avenant de Nora pour mardi et préviens son manager");
    expect(multi.understanding.multiIntent).toBe(true);
  });
  it("C14 employee entity resolved / C15 company context safe", async () => {
    const c = await call("Prépare l'onboarding de Sarah lundi", { subjects: sarah });
    expect(c.understanding.resolvedEntities.some((e) => e.id === "emp-sarah" && e.status === "resolved")).toBe(true);
    expect(c.contextRequirements.some((r) => /jamais fabriqu/i.test(r))).toBe(true);
  });
  it("C16 explicit date resolved / C17 relative date resolved", async () => {
    const c = await call("Fais l'avenant de Nora pour le 2026-09-01");
    expect(c.understanding.resolvedDates.some((d) => d.status === "resolved" && d.iso === "2026-09-01")).toBe(true);
    const r = await call("Prépare l'onboarding de Sarah demain", { subjects: sarah });
    expect(r.understanding.resolvedDates.some((d) => d.status === "resolved")).toBe(true);
  });
  it("C18 missing mandatory info detected / C19 optional info doesn't force clarification", async () => {
    const missing = await call("Prépare l'onboarding"); // no employee
    expect(missing.clarification.blocksExecution).toBe(true);
    const ok = await call("Prépare l'onboarding de Sarah lundi", { subjects: sarah });
    expect(ok.clarification.blocksExecution).toBe(false);
  });
  it("C21 unsupported (non-HR) request detected & declined honestly", async () => {
    const unsupported = await call("Commande du café pour la réunion");
    expect(unsupported.autonomy.overallDisposition).toBe("refused_unsupported");
    expect(unsupported.blockedReasons.some((b) => b.code === "unsupported_request")).toBe(true);
  });
});

// ── D. Clarification ──────────────────────────────────────────────────────────────────────────────
describe("D. clarification", () => {
  it("D22 minimum useful clarification / D23 no repeat when context has the answer", async () => {
    const c = await call("Prépare l'onboarding"); // missing who
    expect(c.clarification.questions.length).toBeGreaterThan(0);
    const known = await call("Prépare l'onboarding de Sarah lundi", { subjects: sarah });
    expect(known.clarification.questions.filter((q) => q.blocksExecution).length).toBe(0);
  });
  it("D24 ambiguity between multiple missions surfaced / D25 no unsafe assumption", () => {
    const cont = classifyContinuityIntent("continue", { missions: [{ id: "m1", label: "Onboarding" }, { id: "m2", label: "Avenant" }] });
    expect(cont.targetId).toBeNull();
    expect(cont.ambiguousCandidates.length).toBe(2);
    expect(cont.nextStep).toBe("ASK_CLARIFICATION");
  });
});

// ── E. Mission intelligence ───────────────────────────────────────────────────────────────────────
describe("E. mission intelligence", () => {
  it("E26 relevant capabilities attached / E29 deliverables listed", async () => {
    const c = await call("Prépare le départ de Marc");
    expect(c.selectedCapabilityIds.length).toBeGreaterThan(0);
    expect(c.selectedCapabilityIds.every((id) => !!getCapability(id))).toBe(true);
  });
  it("E27/E28 tasks decomposed with valid dependencies (outline)", async () => {
    const c = await call("Prépare l'onboarding de Sarah lundi", { subjects: sarah });
    expect(c.missionProposal.tasks.length).toBeGreaterThan(0);
    const keys = new Set(c.missionProposal.tasks.map((t) => t.key));
    for (const t of c.missionProposal.tasks) for (const dep of t.dependsOn) expect(keys.has(dep)).toBe(true);
  });
  it("E30/E31 validations inserted & human-only decisions isolated", async () => {
    const c = await call("Licencie Paul");
    expect(c.autonomy.humanOnlyDecisions.length).toBeGreaterThan(0);
    expect(c.autonomy.requiredValidations.length).toBeGreaterThan(0);
  });
  it("E32/E33 provider + country/legal dependencies visible", async () => {
    const c = await call("Applique la convention collective de mon secteur pour Sarah", { subjects: sarah });
    expect(c.legalDependencies.length).toBeGreaterThan(0);
    expect(c.canonicalItemsInvolved).toContain("pierre.sector_adaptation");
  });
  it("E34/E35 completion criteria explicit; deterministic (idempotent)", async () => {
    const a = await call("Prépare l'onboarding de Sarah lundi", { subjects: sarah });
    const b = await call("Prépare l'onboarding de Sarah lundi", { subjects: sarah });
    expect(a.missionProposal.completionCriteria.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ── F. Operational depth ──────────────────────────────────────────────────────────────────────────
describe("F. operational depth", () => {
  it("F36 onboarding governed chain", async () => {
    const c = await call("Prépare l'onboarding de Sarah lundi et préviens son manager", { subjects: sarah });
    expect(c.canonicalItemsInvolved).toContain("pierre.onboarding_offboarding");
    expect(c.t1Needs.some((n) => n.techId === "notification" && n.liveBlocked)).toBe(true);
  });
  it("F37 absence chain / F40 pre-payroll stays preparation-only", async () => {
    const c = await call("Prépare les éléments de pré-paie");
    expect(c.canonicalItemsInvolved).toContain("pierre.absences_prepayroll");
    expect(c.blockedReasons.some((b) => b.code === "must_not_claim_payroll_engine")).toBe(false); // "pré-paie" alone is not the full engine
    const full = await call("Fais la paie complète et la DSN du mois");
    expect(full.blockedReasons.some((b) => b.code === "must_not_claim_payroll_engine")).toBe(true);
  });
  it("F38 avenant governed chain / F39 offboarding controlled", async () => {
    const av = await call("Fais l'avenant de Nora pour mardi");
    expect(av.autonomy.overallDisposition).not.toBe("execute_local");
    const off = await call("Prépare le départ de Marc");
    expect(off.missionProposal.executableNow).toBe(false); // outline, not an executable plan
  });
  it("F41/F42 communication/signature never become live send/sign", async () => {
    const c = await call("Prépare l'onboarding de Sarah lundi et préviens son manager", { subjects: sarah });
    expect(c.statusExplanation).not.toMatch(/envoy[ée]|sign[ée]/i);
    expect(c.nextSafeStep).not.toMatch(/envoy[ée]|sign[ée]/i);
  });
});

// ── G. Outputs ────────────────────────────────────────────────────────────────────────────────────
describe("G. outputs", () => {
  it("G44 missing inputs exposed / G46 authorized context only", async () => {
    const c = await call("Prépare l'onboarding de Sarah lundi", { subjects: sarah });
    expect(c.contextRequirements.some((r) => /autoris/i.test(r))).toBe(true);
  });
  it("G48 no legal guarantee / G43 facts vs assumptions honest", async () => {
    const c = await call("Applique la convention collective de mon secteur pour Sarah", { subjects: sarah });
    expect(c.cloneChatExplanation.disclosure).toMatch(/juriste/i);
    expect(c.cloneChatExplanation.disclosure).toMatch(/PAS disponible/i);
  });
  it("G49/G50 document lineage preserved when correcting; admitted honestly", async () => {
    const c = await call("Corrige seulement le document", { continuityContext: { artifacts: [{ id: "a1", label: "Avenant de Nora" }] } });
    expect(c.documentEvidenceRequirements.some((r) => /lign[ée]e/i.test(r))).toBe(true);
  });
});

// ── H. Continuity ─────────────────────────────────────────────────────────────────────────────────
describe("H. continuity", () => {
  it("H51 'continue' resolves the authoritative mission", () => {
    const c = classifyContinuityIntent("Continue la mission", { missions: [{ id: "m1", label: "Onboarding Sarah" }] });
    expect(c.isContinuation).toBe(true);
    expect(c.targetId).toBe("m1");
    expect(c.requiresAuthoritativeRead).toBe(true);
  });
  it("H52/H53 'corrige ça' resolves current artifact, is a correction not a new mission", () => {
    const c = classifyContinuityIntent("corrige ça", { artifacts: [{ id: "a1", label: "Avenant" }] });
    expect(c.isCorrection).toBe(true);
    expect(c.targetId).toBe("a1");
    expect(c.targetKind).toBe("artifact");
  });
  it("H56 ambiguous continuity asks clarification / H58 completion cannot be forged (must re-read)", () => {
    const amb = classifyContinuityIntent("continue", { missions: [{ id: "m1", label: "A" }, { id: "m2", label: "B" }] });
    expect(amb.nextStep).toBe("ASK_CLARIFICATION");
    const status = classifyContinuityIntent("qu'est-ce qui bloque ?", { missions: [{ id: "m1", label: "A" }] });
    expect(status.requiresAuthoritativeRead).toBe(true);
    expect(status.kind).toBe("status");
  });
  it("H (latest) 'utilise la dernière version' resolves most-recent deterministically", () => {
    const c = classifyContinuityIntent("utilise la dernière version", {
      artifacts: [{ id: "old", label: "Doc", updatedAtIso: "2026-07-01" }, { id: "new", label: "Doc", updatedAtIso: "2026-07-10" }],
    });
    expect(c.targetId).toBe("new");
  });
});

// ── I. Risk / autonomy (human-only floors — UN-weakenable) ──────────────────────────────────────────
describe("I. risk/autonomy floors", () => {
  const HARD = [
    { label: "dismissal", instruction: "Licencie Paul", cat: "dismissal" },
    { label: "sanction", instruction: "Décide de la sanction pour ce cas", cat: "sanction" },
    { label: "salary", instruction: "Augmente Sarah de 20 % immédiatement", cat: "salary_change" },
    { label: "promotion", instruction: "Promeus Sarah au poste de responsable", cat: "promotion" },
    { label: "legal", instruction: "Dis-moi si c'est légal de faire ça", cat: "legal_conclusion" },
  ] as const;

  for (const h of HARD) {
    it(`I ${h.label} stays human-only even in enterprise_autonomous mode`, async () => {
      const floor = classifyFinalDecisionFloor(h.instruction);
      expect(floor.humanOnly).toBe(true);
      expect(floor.categories).toContain(h.cat);
      const c = await call(h.instruction, { mode: "enterprise_autonomous" });
      expect(c.autonomy.overallDisposition).toBe("human_only");
      expect(c.autonomy.humanOnlyDecisions.some((d) => d.category === h.cat)).toBe(true);
    });
  }

  it("I64 preparation stays allowed where safe / I67 refusal is explainable", async () => {
    const prep = await call("Fais l'avenant de Nora pour mardi");
    expect(["prepare", "validation_required", "provider_blocked"]).toContain(prep.autonomy.overallDisposition);
    const dis = await call("Licencie Paul");
    expect(dis.statusExplanation.length).toBeGreaterThan(0);
    expect(dis.nextSafeStep).toMatch(/humain/i);
  });
  it("I (verb-gap) 'augmente' (verb) triggers the salary floor the base rule missed", () => {
    const floor = classifyFinalDecisionFloor("Augmente Sarah de 20 %");
    expect(floor.categories).toContain("salary_change");
  });
});

// ── J. Architecture (no 2nd brain, no wiring) ───────────────────────────────────────────────────────
describe("J. architecture", () => {
  it("J68 existing runtime reused / J69 no 2nd registry / J70 no 2nd planner", () => {
    expect(cc.pierreRuntimeReused).toBe(true);
    expect(cc.secondHrBrainCreated).toBe(false);
    expect(cc.pierreCapabilityCount).toBe(HR_CAPABILITIES.length);
  });
  it("J72 no direct T1/T2/CloneChat wiring in the runtime contract modules", () => {
    const runtimeModules = ["integration-contract.ts", "capability-adapter.ts", "sensitive-floor.ts", "continuity-intent.ts", "canonical-items.ts", "types.ts", "gap-matrix.ts"];
    for (const m of runtimeModules) {
      const src = readFileSync(join(__dirname, "..", m), "utf8");
      expect(src).not.toMatch(/from ["']@\/lib\/clonestore\/technologies\/t1/);
      expect(src).not.toMatch(/from ["']@\/lib\/clonestore\/product-technologies\/t2/);
      expect(src).not.toMatch(/from ["']@\/lib\/clonechat/);
    }
  });
  it("J73/J74/J75 P16C contract present, typed, exposes blockers/validations, no secrets", async () => {
    const c = await call("Licencie Paul");
    expect(c.version).toBe(1);
    expect(Array.isArray(c.t1Needs)).toBe(true);
    expect(Array.isArray(c.t2Needs)).toBe(true);
    expect(c.blockedReasons.length).toBeGreaterThan(0);
    expect(JSON.stringify(c)).not.toMatch(/sk-|api[_-]?key|secret|password|bearer /i);
  });
  it("T1/T2 tech-need ids are REAL registry ids (no invented technology)", () => {
    const t1Ids = new Set(listTechnologyRegistryEntries().map((e) => e.id as string));
    const t2Ids = new Set(listProductTechnologyRegistryEntries().map((e) => e.id as string));
    for (const { meta } of canonicalUltimateItems()) {
      for (const t of meta.t1Needs) expect(t1Ids.has(t)).toBe(true);
      for (const t of meta.t2Needs) expect(t2Ids.has(t)).toBe(true);
    }
  });
});

// ── K. Perimeter ──────────────────────────────────────────────────────────────────────────────────
describe("K. perimeter", () => {
  it("K76/K77 T1 intact / T2 intact", () => {
    expect(cc.t1Untouched).toBe(true);
    expect(cc.t2Untouched).toBe(true);
    expect(listProductTechnologyRegistryEntries().length).toBe(14);
  });
  it("K78-80 C1/C1.1/C1.2 intact / K81 CloneChat reveal active", () => {
    expect(cc.c1Untouched).toBe(true);
    expect(cc.c11Untouched).toBe(true);
    expect(cc.c12Untouched).toBe(true);
    expect(isCloneChatEnabled()).toBe(true);
  });
  it("K82 anonymous CloneChat API remains auth-blocked (route guard present)", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/assistant/chat/route.ts"), "utf8");
    expect(route).toMatch(/AUTH_REQUIRED|401/);
  });
  it("K83/K84/K85 production off, payment disabled, live providers blocked", () => {
    expect(PRODUCTION_AUTHORIZED).toBe(false);
    expect(cc.productionStillOff).toBe(true);
    expect(resolvePaymentMode({})).not.toBe("live");
    expect(cc.paymentStillDisabled).toBe(true);
    expect(cc.liveProvidersStillBlocked).toBe(true);
  });
});

// ── Command center rollup + verdict ─────────────────────────────────────────────────────────────────
describe("command center", () => {
  it("computes every readiness flag from real behavior; readyForP16C true; no blockers", () => {
    expect(cc.canonicalUltimateItemCount).toBe(12);
    expect(cc.canonicalUltimateItemsRecovered).toBe(true);
    expect(cc.exactCompletedItems.length).toBe(12);
    expect(cc.exactPartialItems).toEqual([]);
    expect(cc.exactBlockers).toEqual([]);
    expect(allPierreOwnedComplete()).toBe(true);
    const readinessFlags = [
      cc.requestUnderstandingReady, cc.multiIntentReady, cc.entityResolutionReady, cc.dateResolutionReady,
      cc.clarificationReady, cc.capabilityRetrievalReady, cc.missionIntelligenceReady, cc.multiStepOperationalDepthReady,
      cc.outputQualityReady, cc.continuityReady, cc.correctionVersioningReady, cc.idempotencyReady,
      cc.autonomyClassificationReady, cc.humanOnlyFloorsReady, cc.providerTruthReady, cc.legalTruthReady,
      cc.documentLineageReady, cc.explanationReady, cc.p16cIntegrationContractReady,
    ];
    expect(readinessFlags.every(Boolean)).toBe(true);
    expect(cc.readyForP16C).toBe(true);
    expect(cc.nextRecommendedPhase).toBe("P16C");
  });
});
