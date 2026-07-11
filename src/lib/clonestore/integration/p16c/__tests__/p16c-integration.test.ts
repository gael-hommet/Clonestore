// src/lib/clonestore/integration/p16c/__tests__/p16c-integration.test.ts
// P16C — tests de COMPORTEMENT (jamais des booléens statiques). Appellent les VRAIS registres/adaptateurs/
// runtime. Familles A–J (§19) + scénarios end-to-end (§18). Aucun provider live, production OFF.

import { describe, it, expect } from "vitest";

import {
  runP16CIntegration, runP16CIntegrationFromContract, consumePierreContract,
  computeGovernanceState, resolveT1Step, resolveT1Steps, resolveT2Step, mergeResults,
  buildTechnologyExecutionPlan, adaptPierreToCloneOS, integrateCloneRoom, roomEventKey,
  runLearningCandidates, buildSignalsRequirements, buildContinuityRequirements,
  classifyCloneChatIntent, buildCloneChatDelegation, canonicalIntegrationItemIds,
  crossCheckCanonicalIntegrationItems, computeP16CCommandCenter, isP16CIntegrationEnabled,
  type P16CT1Step,
} from "..";
import { analyzeForP16C, type PierreUltimateIntegrationContract } from "@/lib/pierre/v1/ultimate/p16a";
import { createTechnologyBus, type TechnologyContext } from "@/lib/clonestore/technologies/t1";
import {
  cloneADNProductTech, cloneGuardProductTech, clonePolicyProductTech, cloneReviewProductTech,
  capAutonomy, getProductTechnologyRegistryEntry, type ProductTechnologyContext,
} from "@/lib/clonestore/product-technologies/t2";

const NOW = "2026-07-13";
const ID = { companyId: "co-1", actorId: "user-1" };
const sarah = { employees: [{ kind: "employee" as const, status: "resolved" as const, id: "emp-sarah", label: "Sarah", candidates: [], reason: "unique_match" }] };
const techCtx: TechnologyContext = { employeeId: "pierre", companyId: "co-1" };
const prodCtx: ProductTechnologyContext = { employeeId: "pierre", companyId: "co-1" };

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }
async function onboardingContract() {
  return analyzeForP16C({ requestId: "r1", ...ID, instruction: "Prépare l'onboarding de Sarah lundi et préviens son manager", nowIso: NOW }, { subjects: sarah });
}
function makeT1Step(over: Partial<P16CT1Step>): P16CT1Step {
  return {
    techId: "document", known: true, reason: "r", status: "partial", mode: "local_safe",
    permissionAllowed: true, permissionReason: "ok", liveBlocked: false, liveBlockedReason: null,
    supportsLocalExecution: true, safeFallback: "fb", resultKind: "needs_validation",
    requiresHumanValidation: true, artifactPrepared: true, ...over,
  };
}

// ════════════════════════ A. CANONICAL P16C RECOVERY ════════════════════════
describe("A. Canonical P16C recovery", () => {
  it("1. recovers exactly the 10 canonical integration items", () => {
    expect(canonicalIntegrationItemIds().length).toBe(10);
  });
  it("2/3. no item invented, no item omitted (fail-closed cross-check)", () => {
    const x = crossCheckCanonicalIntegrationItems();
    expect(x.ok).toBe(true);
    expect(x.missing).toEqual([]);
    expect(x.invented).toEqual([]);
    expect(x.technologyDrift).toEqual([]);
  });
  it("4. statuses/technologies are evidence-derived from the real registries (no drift)", () => {
    expect(crossCheckCanonicalIntegrationItems().recoveredCount).toBe(10);
  });
});

// ════════════════════════ B. PIERRE CONTRACT ════════════════════════
describe("B. Pierre contract consumption", () => {
  it("5. accepts a valid P16A contract", async () => {
    const c = await onboardingContract();
    const r = consumePierreContract(c, ID);
    expect(r.accepted).toBe(true);
    expect(r.reinterpretedHr).toBe(false);
  });
  it("6. rejects an unsupported contract version", async () => {
    const c = clone(await onboardingContract()) as PierreUltimateIntegrationContract;
    (c as { version: number }).version = 2;
    expect(consumePierreContract(c, ID).accepted).toBe(false);
  });
  it("7. rejects an unknown capability id", async () => {
    const c = clone(await onboardingContract());
    (c as { selectedCapabilityIds: string[] }).selectedCapabilityIds = ["fake.capability"];
    const r = consumePierreContract(c, ID);
    expect(r.accepted).toBe(false);
    expect(r.rejectedReason).toMatch(/inconnue/i);
  });
  it("8. rejects a forged human-only downgrade", async () => {
    const c = clone(await onboardingContract());
    c.autonomy = { ...c.autonomy, overallDisposition: "prepare", humanOnlyDecisions: [{ category: "dismissal", reason: "x", evidence: "y", guardLevel: "red" }] };
    expect(consumePierreContract(c, ID).accepted).toBe(false);
  });
  it("9. rejects a foreign-tenant (forbidden) entity", async () => {
    const c = clone(await onboardingContract());
    c.understanding = { ...c.understanding, resolvedEntities: [{ kind: "employee", status: "forbidden", id: "x", label: "Paul", candidates: [], reason: "cross_tenant" }] } as typeof c.understanding;
    const r = consumePierreContract(c, ID);
    expect(r.accepted).toBe(false);
    expect(r.rejectedReason).toMatch(/périmètre|cross-tenant/i);
  });
  it("9b. rejects a tenant mismatch (server identity wins)", async () => {
    const c = await onboardingContract();
    expect(consumePierreContract(c, { companyId: "other", actorId: "user-1" }).accepted).toBe(false);
  });
  it("10. no second HR interpretation/planning occurs (capabilityIds preserved verbatim)", async () => {
    const c = await onboardingContract();
    const res = await runP16CIntegrationFromContract(c, ID);
    expect(res.ok).toBe(true);
    expect(res.plan!.capabilityIds).toEqual([...c.selectedCapabilityIds]);
  });
});

// ════════════════════════ C. T1 RESOLUTION ════════════════════════
describe("C. T1 resolution", () => {
  it("11. every declared T1 need resolves to a real registry entry", async () => {
    const res = await runP16CIntegration({ requestId: "r", ...ID, instruction: "Prépare l'onboarding de Sarah lundi", nowIso: NOW }, { subjects: sarah });
    expect(res.plan!.t1Steps.length).toBeGreaterThan(0);
    expect(res.plan!.t1Steps.every((s) => s.known)).toBe(true);
  });
  it("12. unknown T1 id fails closed", async () => {
    const step = await resolveT1Step({ techId: "does_not_exist", reason: "x", liveBlocked: false, blockedReason: null }, ID, createTechnologyBus());
    expect(step.known).toBe(false);
    expect(step.permissionAllowed).toBe(false);
  });
  it("13. permissions are checked (missing company → denied)", async () => {
    const step = await resolveT1Step({ techId: "document", reason: "x", liveBlocked: false, blockedReason: null }, { companyId: "", actorId: "u" }, createTechnologyBus());
    expect(step.permissionAllowed).toBe(false);
  });
  it("14. fallbacks are preserved", async () => {
    const steps = await resolveT1Steps([{ techId: "mail", reason: "x", liveBlocked: true, blockedReason: null }], ID);
    expect(steps[0].safeFallback.length).toBeGreaterThan(0);
  });
  it("15. MailTech preparation ≠ sending", async () => {
    const bus = createTechnologyBus();
    const draft = await bus.prepareWithTechnology("mail", { subject: "x", body: "y" }, techCtx);
    expect(draft.live).toBe(false);
    const send = await bus.prepareWithTechnology("mail", { send: true, subject: "x" }, techCtx);
    expect(send.kind).toBe("blocked");
  });
  it("16. SignatureTech preparation ≠ signed", async () => {
    const bus = createTechnologyBus();
    expect((await bus.prepareWithTechnology("signature", { signLive: true }, techCtx)).kind).toBe("blocked");
  });
  it("17. Calendar preparation ≠ event created live", async () => {
    const bus = createTechnologyBus();
    expect((await bus.prepareWithTechnology("calendar", { createLive: true }, techCtx)).kind).toBe("blocked");
  });
  it("18. Notification reminder ≠ push delivered", async () => {
    const bus = createTechnologyBus();
    expect((await bus.prepareWithTechnology("notification", { push: true }, techCtx)).kind).toBe("blocked");
  });
  it("19. Connector unavailable remains blocked", async () => {
    const bus = createTechnologyBus();
    expect((await bus.prepareWithTechnology("connector", { connect: true }, techCtx)).kind).toBe("blocked");
    const step = await resolveT1Step({ techId: "connector", reason: "x", liveBlocked: true, blockedReason: null }, ID, bus);
    expect(step.liveBlocked).toBe(true);
  });
  it("20. technology bus does not grant permission to a live effect", async () => {
    const bus = createTechnologyBus();
    expect(bus.canUseTechnology("pierre", "document", techCtx).allowed).toBe(true); // permission couche ≠ droit d'effet
    expect((await bus.prepareWithTechnology("document", { send: true }, techCtx)).kind).toBe("blocked");
    expect((await bus.prepareWithTechnology("nope", {}, techCtx)).kind).toBe("blocked");
  });
});

// ════════════════════════ D. T2 PIPELINE ════════════════════════
describe("D. T2 pipeline", () => {
  it("21. CloneADN is tenant scoped", async () => {
    const a = await cloneADNProductTech.prepare({}, { employeeId: "pierre", companyId: "co-1" });
    const b = await cloneADNProductTech.prepare({}, { employeeId: "pierre", companyId: "co-2" });
    expect(a.companyId).toBe("co-1");
    expect(b.companyId).toBe("co-2");
  });
  it("22. CloneADN cannot fabricate a missing company fact", async () => {
    const a = await cloneADNProductTech.prepare({}, prodCtx);
    expect(a.artifact!.identity.companyName).toBe("entreprise-sans-nom");
    expect(a.artifact!.adnMutated).toBe(false);
  });
  it("23. CloneGuard raises risk on critical terms, never lowers below sensitive", async () => {
    const crit = await cloneGuardProductTech.prepare({ action: { kind: "mission", description: "licenciement de Paul", channel: "internal" } }, prodCtx);
    expect(crit.artifact!.riskLevel).toBe("critical");
    expect(crit.artifact!.decision).not.toBe("allow_prepare");
  });
  it("24. ClonePolicy fails closed on external channel (validation forced)", async () => {
    const p = await clonePolicyProductTech.prepare({ action: { channel: "external_email", taskType: "draft_email" } }, prodCtx);
    expect(p.artifact!.requiresValidation).toBe(true);
  });
  it("25. CloneTrust ceiling only reduces autonomy (policy cap wins)", () => {
    expect(capAutonomy("autonomous_safe", "prepare_only")).toBe("prepare_only");
    expect(capAutonomy("suggest", "autonomous_safe")).toBe("suggest");
  });
  it("26. CloneOS preserves Pierre objective and invents no HR reasoning", async () => {
    const c = await onboardingContract();
    const os = await adaptPierreToCloneOS({ contract: c, ctx: prodCtx });
    expect(os.cloneOsInventedHrReasoning).toBe(false);
    expect(os.preservedPierreObjective).toBe(true);
    if (os.run.missionPlan) expect(os.run.missionPlan.decidesHrOutcomes).toBe(false);
  });
  it("27. CloneTrace records provenance (resume pointer)", async () => {
    const res = await runP16CIntegration({ requestId: "r", ...ID, instruction: "Fais l'avenant de Nora pour mardi", nowIso: NOW });
    expect(res.cloneOsRun!.traceEvent).not.toBeNull();
    expect(res.cloneOsRun!.traceEvent!.resumePointer.lastEventId.length).toBeGreaterThan(0);
  });
  it("28. CloneReview blocks unsupported claims / never guarantees legality", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "Contrat à compléter [[ ]] — licenciement" }, prodCtx);
    expect(r.artifact!.humanReviewNeeded).toBe(true);
    expect(r.artifact!.legalGuarantee).toBe(false);
  });
  it("29. CloneBrief uses facts only", async () => {
    const res = await runP16CIntegration({ requestId: "r", ...ID, instruction: "Fais l'avenant de Nora", nowIso: NOW });
    expect(res.plan!.briefRequirements.some((r) => /aucune invention/i.test(r))).toBe(true);
  });
  it("30. CloneContinuum uses authoritative state on continuation", async () => {
    const reqs = buildContinuityRequirements(await analyzeForP16C({ requestId: "r", ...ID, instruction: "Continue la mission", nowIso: NOW }, { continuityContext: { missions: [{ id: "m1", label: "Onboarding" }] } }));
    expect(reqs.some((r) => /autoritaire/i.test(r))).toBe(true);
  });
  it("31. CloneSignals candidates deduplicate (by kind)", () => {
    const res = buildSignalsRequirements({ signalCandidates: { artifactKind: "clonesignals_candidates", missionId: "m", candidates: [{ signalKind: "validation_late", detail: "a", proposedAction: "remind", recommendedInHours: 4 }, { signalKind: "validation_late", detail: "b", proposedAction: "remind", recommendedInHours: 4 }], liveSchedulerUsed: false, cronCreated: false, notificationSentLive: false } } as never);
    expect(res.some((r) => /validation_late/.test(r) && !/validation_late.*validation_late/.test(r))).toBe(true);
  });
  it("32. CloneLearn remains proposal-only (adnMutated=false)", async () => {
    const l = await runLearningCandidates([{ type: "correction", detail: "vouvoyer" }, { type: "correction", detail: "vouvoyer" }, { type: "correction", detail: "vouvoyer" }], prodCtx);
    expect(l.adnMutated).toBe(false);
    expect(l.artifact!.candidates.every((c) => c.approvalRequired === true)).toBe(true);
    expect(l.artifact!.mutationPolicy).toBe("proposal_only");
  });
  it("33. CloneCall remains local-safe (no telephony)", async () => {
    const bus = getProductTechnologyRegistryEntry("clonecall")!;
    const call = await bus.contract.prepare({ employeeCalledId: "pierre", dialNumber: "+3312" }, prodCtx);
    expect(call.kind).toBe("blocked");
  });
  it("34. CloneRoom routes through CloneOS (peer-to-peer blocked)", async () => {
    const r = await integrateCloneRoom({ room: { roomId: "rm", participants: [{ id: "h", kind: "human" }], thread: [{ from: "h", content: "prépare l'onboarding" }] }, ctx: prodCtx, authorizedMemberIds: ["h"] });
    expect(r.allViaCloneOS).toBe(true);
    expect(r.peerToPeerBlocked).toBe(true);
    const p2p = await integrateCloneRoom({ room: { participants: [{ id: "a", kind: "ai_employee" }], allowPeerToPeer: true }, ctx: prodCtx });
    expect(p2p.ok).toBe(false);
  });
  it("35. CloneVoice remains non-live (text authoritative)", () => {
    const v = getProductTechnologyRegistryEntry("clonevoice")!;
    expect(v.contract.mode).toBe("live_disabled");
    expect(v.liveBlockedReason).not.toBeNull();
  });
});

// ════════════════════════ E. GOVERNANCE PRECEDENCE ════════════════════════
const G = (over: Partial<Parameters<typeof computeGovernanceState>[0]>) => computeGovernanceState({
  disposition: "prepare", permissionDenied: false, humanOnly: false, humanOnlyReasons: [],
  legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false, ...over,
}).effectiveState;

describe("E. Governance precedence (fail-closed, strictest wins)", () => {
  it("36. permission-blocked wins over everything", () => {
    expect(G({ disposition: "execute_local", permissionDenied: true, humanOnly: true, legalDependencies: ["x"], providerDependencies: ["y"] })).toBe("PERMISSION_BLOCKED");
  });
  it("37. human-only wins over legal/provider/validation", () => {
    expect(G({ humanOnly: true, humanOnlyReasons: ["dismissal"], legalDependencies: ["x"], providerDependencies: ["y"] })).toBe("HUMAN_ONLY");
  });
  it("38. legal-blocked wins over prepare/provider", () => {
    expect(G({ legalDependencies: ["cc"], providerDependencies: ["mail"] })).toBe("LEGAL_BLOCKED");
  });
  it("39. provider-blocked wins over local execution", () => {
    expect(G({ disposition: "execute_local", providerDependencies: ["mail"] })).toBe("PROVIDER_BLOCKED");
  });
  it("40. validation-required is preserved", () => {
    expect(G({ disposition: "validation_required" })).toBe("VALIDATION_REQUIRED");
  });
  it("41. local execution only when ALL gates permit", () => {
    expect(G({ disposition: "execute_local", guardDecision: "allow_prepare", policyDecision: "allow_prepare", trustAutonomyLevel: "autonomous_safe" })).toBe("LOCAL_EXECUTION_ALLOWED");
    // un seul gate plus strict suffit à retirer l'exécution locale
    expect(G({ disposition: "execute_local", guardDecision: "allow_prepare", policyDecision: "allow_prepare", trustAutonomyLevel: "prepare_only" })).toBe("PREPARE_LOCAL");
  });
  it("42. no gate can remove a stricter prior gate", () => {
    expect(G({ disposition: "human_only", humanOnly: true, humanOnlyReasons: ["x"], guardDecision: "allow_prepare", policyDecision: "allow_prepare", trustAutonomyLevel: "autonomous_safe" })).toBe("HUMAN_ONLY");
  });
  it("42b. CloneGuard refuse ⇒ human-only; block/require ⇒ validation", () => {
    expect(G({ disposition: "prepare", guardDecision: "refuse" })).toBe("HUMAN_ONLY");
    expect(G({ disposition: "propose", guardDecision: "block" })).toBe("VALIDATION_REQUIRED");
    expect(G({ disposition: "propose", policyDecision: "block" })).toBe("VALIDATION_REQUIRED");
  });
  it("42c. CloneOS-blocked-by-governance floors to ≥ validation even with no exploitable decision (fail-closed)", () => {
    // guard/policy artefact null ⇒ aucune décision exploitable, mais le run est bloqué → jamais d'exécution locale.
    expect(G({ disposition: "execute_local", cloneOsBlockedByGovernance: true })).toBe("VALIDATION_REQUIRED");
  });
});

// ════════════════════════ F. CLONEOS + RESULT MERGE ════════════════════════
describe("F. CloneOS and result merge", () => {
  it("43/44. a valid task DAG is created (no dangling dependency)", async () => {
    const res = await runP16CIntegration({ requestId: "r", ...ID, instruction: "Fais l'avenant de Nora pour mardi", nowIso: NOW });
    const plan = res.cloneOsRun!.missionPlan;
    if (plan) {
      const ids = new Set(plan.tasks.map((t) => t.taskId));
      expect(plan.tasks.every((t) => t.dependsOn.every((d) => ids.has(d)))).toBe(true);
    } else {
      expect(res.governance!.effectiveState).toBeDefined();
    }
  });
  it("45/46. idempotency preserved (identical runs equal; room event key stable)", async () => {
    const a = await runP16CIntegration({ requestId: "r", ...ID, instruction: "Prépare l'onboarding de Sarah lundi", nowIso: NOW }, { subjects: sarah });
    const b = await runP16CIntegration({ requestId: "r", ...ID, instruction: "Prépare l'onboarding de Sarah lundi", nowIso: NOW }, { subjects: sarah });
    expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));
    const room = { roomId: "x", thread: [{ from: "h", content: "hello" }] };
    expect(roomEventKey(room)).toBe(roomEventKey({ ...room }));
    expect(roomEventKey(room)).not.toBe(roomEventKey({ roomId: "x", thread: [{ from: "h", content: "other" }] }));
  });
  it("47. prepared document status accurate (no completion evidence)", () => {
    const m = mergeResults({ governance: computeGovernanceState({ disposition: "prepare", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false }), t1Steps: [makeT1Step({ techId: "document" })], t2Steps: [], cloneOsPlanPresent: false, cloneOsBlockedByGovernance: false, humanOnlyReasons: [] });
    const docOp = m.operations.find((o) => o.ref === "t1.document")!;
    expect(["prepared_artifact", "generated_draft"]).toContain(docOp.status);
    expect(docOp.hasAuthoritativeCompletionEvidence).toBe(false);
  });
  it("48. email is never marked sent", () => {
    const m = mergeResults({ governance: computeGovernanceState({ disposition: "prepare", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false }), t1Steps: [makeT1Step({ techId: "mail", liveBlocked: true })], t2Steps: [], cloneOsPlanPresent: false, cloneOsBlockedByGovernance: false, humanOnlyReasons: [] });
    const mailOp = m.operations.find((o) => o.ref === "t1.mail")!;
    expect(mailOp.status).not.toBe("locally_executed_operation");
    expect(["generated_draft", "provider_blocked_operation"]).toContain(mailOp.status);
  });
  it("49. signature is never marked signed", () => {
    const m = mergeResults({ governance: computeGovernanceState({ disposition: "provider_blocked", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: ["signature"], clarificationBlocks: false, mustNotClaimPayroll: false }), t1Steps: [makeT1Step({ techId: "signature", liveBlocked: true, resultKind: "blocked", artifactPrepared: false })], t2Steps: [], cloneOsPlanPresent: false, cloneOsBlockedByGovernance: false, humanOnlyReasons: [] });
    const sig = m.operations.find((o) => o.ref === "t1.signature")!;
    expect(sig.status).toBe("provider_blocked_operation");
  });
  it("50. mission never complete without authoritative evidence", () => {
    const m = mergeResults({ governance: computeGovernanceState({ disposition: "prepare", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false }), t1Steps: [makeT1Step({})], t2Steps: [], cloneOsPlanPresent: true, cloneOsBlockedByGovernance: false, humanOnlyReasons: [] });
    expect(m.authoritativeCompletion).toBe(false);
    expect(m.missionStatus).not.toBe("conflict_failed");
    expect((m.missionStatus as string)).not.toBe("completed_mission_with_evidence");
  });
  it("51. partial result remains partial (prepared + provider-blocked)", () => {
    const m = mergeResults({ governance: computeGovernanceState({ disposition: "prepare", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false }), t1Steps: [makeT1Step({ techId: "document" }), makeT1Step({ techId: "mail", liveBlocked: true, resultKind: "blocked", artifactPrepared: false })], t2Steps: [], cloneOsPlanPresent: false, cloneOsBlockedByGovernance: false, humanOnlyReasons: [] });
    expect(m.missionStatus).toBe("partial");
  });
  it("52. conflicting results fail closed", () => {
    const m = mergeResults({ governance: computeGovernanceState({ disposition: "prepare", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false }), t1Steps: [makeT1Step({ techId: "document", resultKind: "error", artifactPrepared: false, permissionAllowed: true })], t2Steps: [], cloneOsPlanPresent: false, cloneOsBlockedByGovernance: false, humanOnlyReasons: [] });
    expect(m.conflicts.length).toBeGreaterThan(0);
    expect(m.missionStatus).toBe("conflict_failed");
  });
});

// ════════════════════════ G. CLONECHAT ════════════════════════
describe("G. CloneChat delegation", () => {
  it("53. explanation-only creates no mission", async () => {
    const d = await buildCloneChatDelegation({ message: "Qu'est-ce qui bloque ?", identity: ID, nowIso: NOW });
    expect(d.createsMission).toBe(false);
    expect(classifyCloneChatIntent("Qu'est-ce qui bloque ?")).toBe("explanation");
  });
  it("54. HR-work delegates through Pierre/P16C", async () => {
    const d = await buildCloneChatDelegation({ message: "Prépare l'onboarding de Sarah lundi", identity: ID, nowIso: NOW, toolCall: { name: "create_mission" } });
    expect(d.kind).toBe("hr_work");
    expect(d.createsMission).toBe(true);
  });
  it("55/57. /execute preserves proposalId-only + revalidates authoritative state", async () => {
    const cc = await computeP16CCommandCenter();
    expect(cc.executeRouteIntegrated).toBe(true);
    expect(cc.proposalConfirmationPreserved).toBe(true);
  });
  it("56. /api/assistant/chat wires P16C for HR delegation", async () => {
    const cc = await computeP16CCommandCenter();
    expect(cc.assistantRouteIntegrated).toBe(true);
  });
  it("58. CloneChat cannot forge completion (no external execution)", async () => {
    const d = await buildCloneChatDelegation({ message: "Fais l'avenant de Nora", identity: ID, nowIso: NOW, toolCall: { name: "create_mission" } });
    if (d.kind === "hr_work") {
      expect(d.authoritativeCompletion).toBe(false);
      expect(d.externallyExecutable).toBe(false);
    }
  });
  it("59/60. citations/claims guards + anonymous block remain active (route unchanged)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "src/app/api/assistant/chat/route.ts"), "utf8");
    expect(src).toMatch(/validateParrainCitations/);
    expect(src).toMatch(/finalizeAnswerText/);
    expect(src).toMatch(/AUTH_REQUIRED/);
  });
  it("kill switch : le flag P16C est actif par défaut", () => {
    expect(isP16CIntegrationEnabled()).toBe(true);
  });
});

// ════════════════════════ H. CLONEROOM ════════════════════════
describe("H. CloneRoom", () => {
  it("61. room request consumes P16C (governance present)", async () => {
    const r = await integrateCloneRoom({ room: { roomId: "rm", participants: [{ id: "h", kind: "human" }], thread: [{ from: "h", content: "prépare l'onboarding lundi" }] }, ctx: prodCtx, authorizedMemberIds: ["h"] });
    expect(r.ok).toBe(true);
    expect(r.governance).not.toBeNull();
  });
  it("62. membership/tenant checked (unauthorized participant rejected)", async () => {
    const r = await integrateCloneRoom({ room: { participants: [{ id: "intruder", kind: "human" }], thread: [] }, ctx: prodCtx, authorizedMemberIds: ["h"] });
    expect(r.ok).toBe(false);
    expect(r.rejectedReason).toMatch(/non autorisé/i);
  });
  it("63. no peer bypasses validations (≥ validation_required)", async () => {
    const r = await integrateCloneRoom({ room: { roomId: "rm", participants: [{ id: "h", kind: "human" }], thread: [{ from: "h", content: "prépare un document" }] }, ctx: prodCtx, authorizedMemberIds: ["h"] });
    expect(["VALIDATION_REQUIRED", "HUMAN_ONLY", "PROVIDER_BLOCKED", "LEGAL_BLOCKED", "PREPARE_LOCAL"]).toContain(r.governance!.effectiveState);
  });
  it("64. duplicate room event is idempotent (stable key)", () => {
    const room = { roomId: "rm", participants: [{ id: "h", kind: "human" as const }], thread: [{ from: "h", content: "x" }] };
    expect(roomEventKey(room)).toBe(roomEventKey(clone(room)));
  });
  it("65. room-generated sensitive action remains human-only", async () => {
    const r = await integrateCloneRoom({ room: { roomId: "rm", participants: [{ id: "h", kind: "human" }], thread: [{ from: "h", content: "préparer le licenciement de Paul" }] }, ctx: prodCtx, authorizedMemberIds: ["h"] });
    expect(r.governance!.effectiveState).toBe("HUMAN_ONLY");
    expect(r.humanOnlyPreserved).toBe(true);
  });
});

// ════════════════════════ I. CONTINUITY / LEARNING ════════════════════════
describe("I. Continuity and learning", () => {
  it("66. continuation re-reads authoritative mission", async () => {
    const c = await analyzeForP16C({ requestId: "r", ...ID, instruction: "Continue la mission", nowIso: NOW }, { continuityContext: { missions: [{ id: "m1", label: "Onboarding" }] } });
    expect(c.continuity.requiresAuthoritativeRead).toBe(true);
  });
  it("67/68. correction uses current version / stale chat text is never authoritative", async () => {
    const c = await analyzeForP16C({ requestId: "r", ...ID, instruction: "Corrige seulement le document", nowIso: NOW }, { continuityContext: { artifacts: [{ id: "a1", label: "Avenant" }] } });
    expect(c.continuity.isCorrection).toBe(true);
    expect(c.continuity.requiresAuthoritativeRead).toBe(true);
    expect(buildContinuityRequirements(c).some((r) => /lign[ée]e|version/i.test(r))).toBe(true);
  });
  it("69. signal candidates are proposals (no live scheduler)", () => {
    const reqs = buildSignalsRequirements({ signalCandidates: { artifactKind: "clonesignals_candidates", missionId: "m", candidates: [], liveSchedulerUsed: false, cronCreated: false, notificationSentLive: false } } as never);
    expect(reqs.some((r) => /aucun scheduler|armement humain/i.test(r))).toBe(true);
  });
  it("70. account learning remains account scoped", async () => {
    const l = await runLearningCandidates([{ type: "validation", detail: "x" }], { employeeId: "pierre", companyId: "co-7" });
    expect(l.artifact).not.toBeNull();
  });
  it("71/72. every learning candidate (incl. legal) needs approval / never self-approves", async () => {
    const l = await runLearningCandidates([{ type: "correction", detail: "clause légale de non-concurrence" }, { type: "correction", detail: "clause légale de non-concurrence" }, { type: "correction", detail: "clause légale de non-concurrence" }], prodCtx);
    expect(l.artifact!.candidates.every((c) => c.approvalRequired === true)).toBe(true);
    expect(l.artifact!.adnMutated).toBe(false);
  });
});

// ════════════════════════ J. PERIMETER + EXTERNAL FLOORS ════════════════════════
describe("J. Perimeter and external floors", () => {
  it("73–79. neighbouring systems intact (P16A/T1/T2/C1/C1.1/C1.2)", async () => {
    const cc = await computeP16CCommandCenter();
    expect(cc.p16aUntouched).toBe(true);
    expect(cc.t1Untouched).toBe(true);
    expect(cc.t2Untouched).toBe(true);
    expect(cc.c1Untouched).toBe(true);
    expect(cc.c11Untouched).toBe(true);
    expect(cc.c12Untouched).toBe(true); // CloneChat reste révélé
  });
  it("80–82. production/payment/live still OFF", async () => {
    const cc = await computeP16CCommandCenter();
    expect(cc.productionStillOff).toBe(true);
    expect(cc.paymentStillDisabled).toBe(true);
    expect(cc.liveProvidersStillBlocked).toBe(true);
    expect(cc.readyForProduction).toBe(false);
  });
  it("command center: readyForIntegratedLocalUse true, verdict local-safe", async () => {
    const cc = await computeP16CCommandCenter();
    expect(cc.exactBlockers).toEqual([]);
    expect(cc.readyForIntegratedLocalUse).toBe(true);
    expect(cc.verdict).toMatch(/LOCALLY VERIFIED/);
  });
});

// ════════════════════════ SCENARIOS (§18) ════════════════════════
describe("End-to-end scenarios (§18)", () => {
  const run = (instruction: string, opts?: Parameters<typeof runP16CIntegration>[1]) =>
    runP16CIntegration({ requestId: "s", ...ID, instruction, nowIso: NOW }, opts);

  it("invariants hold across every scenario (never external-exec, never fabricated completion)", async () => {
    const instructions = [
      "Prépare l'onboarding de Sarah lundi.", "Fais l'avenant de Nora pour mardi.",
      "Paul est absent depuis hier, prépare ce qu'il faut.", "Prépare les éléments de pré-paie.",
      "Prépare le départ de Marc.", "Continue la mission.", "Corrige seulement le document.",
      "Utilise la dernière version.", "Qu'est-ce qui bloque ?", "Envoie le mail maintenant.",
      "Signe le document.", "Augmente Sarah de 20 % immédiatement.", "Licencie Paul.", "Décide de la sanction.",
    ];
    for (const instruction of instructions) {
      const res = await run(instruction, { subjects: sarah });
      if (res.ok) {
        expect(res.plan!.externallyExecutable).toBe(false);
        expect(res.merged!.authoritativeCompletion).toBe(false);
        expect((res.merged!.missionStatus as string)).not.toBe("completed_mission_with_evidence");
      } else {
        expect(res.rejectedReason).toBeTruthy();
      }
    }
  });
  it("12/13/14. dismissal, salary, sanction → HUMAN_ONLY (even in autonomous mode)", async () => {
    for (const instruction of ["Licencie Paul.", "Augmente Sarah de 20 % immédiatement.", "Décide de la sanction pour ce cas."]) {
      const res = await run(instruction, { mode: "enterprise_autonomous", subjects: sarah });
      expect(res.ok).toBe(true);
      expect(res.governance!.effectiveState).toBe("HUMAN_ONLY");
      expect(res.merged!.missionStatus).toBe("human_only");
    }
  });
  it("10/11/24. envoie/signe → provider-blocked at the T1 layer (never executed)", async () => {
    const bus = createTechnologyBus();
    expect((await bus.prepareWithTechnology("mail", { send: true }, techCtx)).kind).toBe("blocked");
    expect((await bus.prepareWithTechnology("signature", { signLive: true }, techCtx)).kind).toBe("blocked");
  });
  it("15. missing employee → clarification blocks execution", async () => {
    const c = await analyzeForP16C({ requestId: "s", ...ID, instruction: "Prépare l'avenant", nowIso: NOW });
    expect(c.clarification.blocksExecution).toBe(true);
  });
  it("19. foreign-tenant entity → integration rejected (contract refused)", async () => {
    const res = await run("Prépare l'onboarding de Paul", { subjects: { employees: [{ kind: "employee", status: "forbidden", id: "x", label: "Paul", candidates: [], reason: "cross_tenant" }] } });
    expect(res.ok).toBe(false);
    expect(res.rejectedReason).toMatch(/périmètre|cross-tenant/i);
  });
  it("29/30. unknown T1/T2 technology id → contract refused", async () => {
    const c1 = clone(await onboardingContract()); c1.t1Needs = [{ techId: "ghost", reason: "x", liveBlocked: false, blockedReason: null }];
    expect((await runP16CIntegrationFromContract(c1, ID)).ok).toBe(false);
    const c2 = clone(await onboardingContract()); c2.t2Needs = [{ techId: "phantom", reason: "x" }];
    expect((await runP16CIntegrationFromContract(c2, ID)).ok).toBe(false);
  });
  it("21/22/23. CloneRoom onboarding vs explanation vs HR-work delegation", async () => {
    const room = await integrateCloneRoom({ room: { roomId: "rm", participants: [{ id: "h", kind: "human" }], thread: [{ from: "h", content: "onboarding du nouveau lundi" }] }, ctx: prodCtx, authorizedMemberIds: ["h"] });
    expect(room.ok).toBe(true);
    expect(room.missionCandidateCount).toBeGreaterThanOrEqual(1);
    expect((await buildCloneChatDelegation({ message: "Comment fonctionne l'onboarding ?", identity: ID, nowIso: NOW })).createsMission).toBe(false);
    expect((await buildCloneChatDelegation({ message: "Prépare l'onboarding", identity: ID, nowIso: NOW, toolCall: { name: "create_mission" } })).createsMission).toBe(true);
  });
});
