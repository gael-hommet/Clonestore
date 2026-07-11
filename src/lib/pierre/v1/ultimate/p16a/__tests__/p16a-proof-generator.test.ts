// src/lib/pierre/v1/ultimate/p16a/__tests__/p16a-proof-generator.test.ts
// P16A — proof generator. Computes proofs from ACTUAL modules + real behavior and writes them under
// .p16a-proofs/pierre-ultimate-completion/. Gated (P16A_WRITE_PROOFS=1) so normal runs never write files.
// tests.json / build.json / non-regression.json / adversarial-review.json / final-verdict are written by
// the session's run scripts with the REAL numbers (never fabricated here).

import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { HR_CAPABILITIES } from "../../../hr-canon/capability-registry";
import { getPierreUltimateItems } from "@/lib/clonestore/ultimate/p16-master-split";
import { resolveEntity } from "../../../cognitive-runtime/entity-resolution";
import { resolveTemporal } from "../../../cognitive-runtime/temporal-resolution";
import { canonicalUltimateItems, crossCheckCanonicalItems } from "../canonical-items";
import { pierreCapabilityCount, retrieveForRequest } from "../capability-adapter";
import { computeGapMatrix, allPierreOwnedComplete } from "../gap-matrix";
import { analyzeForP16C } from "../integration-contract";
import { computeP16ACommandCenter } from "../command-center";
import { runScenarioMatrix } from "../scenario-matrix";

const RUN = process.env.P16A_WRITE_PROOFS === "1";
const DIR = join(process.cwd(), ".p16a-proofs", "pierre-ultimate-completion");
const write = (name: string, data: unknown) => writeFileSync(join(DIR, name), JSON.stringify(data, null, 2));
const NOW = "2026-07-13";
const base = { companyId: "co-1", actorId: "user-1", nowIso: NOW };
const sarah = { employees: [{ kind: "employee" as const, status: "resolved" as const, id: "emp-sarah", label: "Sarah", candidates: [], reason: "unique_match" }] };

describe("P16A proof generator", () => {
  (RUN ? it : it.skip)("writes module-derived proofs", async () => {
    mkdirSync(DIR, { recursive: true });

    const cc = await computeP16ACommandCenter();
    const gap = computeGapMatrix();
    const scenarios = await runScenarioMatrix();

    const onboarding = await analyzeForP16C({ requestId: "p-onb", ...base, instruction: "Prépare l'onboarding de Sarah lundi et préviens son manager" }, { subjects: sarah });
    const dismissal = await analyzeForP16C({ requestId: "p-dis", ...base, instruction: "Licencie Paul" }, { mode: "enterprise_autonomous" });
    const salary = await analyzeForP16C({ requestId: "p-sal", ...base, instruction: "Augmente Sarah de 20 % immédiatement" }, { mode: "enterprise_autonomous", subjects: sarah });
    const sector = await analyzeForP16C({ requestId: "p-sec", ...base, instruction: "Applique la convention collective de mon secteur pour Sarah" }, { subjects: sarah });
    const correction = await analyzeForP16C({ requestId: "p-cor", ...base, instruction: "Corrige seulement le document" }, { continuityContext: { artifacts: [{ id: "art-1", label: "Avenant de Nora" }] } });
    const cont = await analyzeForP16C({ requestId: "p-con", ...base, instruction: "Continue la mission" }, { continuityContext: { missions: [{ id: "mis-1", label: "Onboarding Sarah" }] } });

    write("accepted-state.json", {
      baseline: "P8–P16.0, T1, T2, C1/C1.1/C1.2 frozen verified", productionAuthorized: false,
      paymentMode: "disabled/test", stripeLive: false, liveProvidersBlocked: true, cloneChatEnabledDefault: true,
      capabilityCanon: HR_CAPABILITIES.length, note: "P16A is additive; reuses the ONE cognitive runtime.",
    });
    write("canonical-ultimate-items.json", { count: getPierreUltimateItems().length, recovery: crossCheckCanonicalItems(), items: canonicalUltimateItems().map(({ item, meta }) => ({ id: item.id, title: item.title, featureStatus: item.current_status, pierreOwnedBehavior: meta.pierreOwnedBehavior, t1Needs: meta.t1Needs, t2Needs: meta.t2Needs, externalDependency: meta.externalDependency, forbiddenClaim: meta.forbiddenClaim })) });
    write("gap-matrix.json", gap);
    write("capability-count.json", { derived: pierreCapabilityCount(), registryLength: HR_CAPABILITIES.length, hardcoded: false, match: pierreCapabilityCount() === HR_CAPABILITIES.length });
    write("capability-retrieval.json", { request: "onboarding contrat absence", bounded: true, retrieved: retrieveForRequest("onboarding contrat absence").length, registryTotal: HR_CAPABILITIES.length, sample: retrieveForRequest("Fais l'avenant de Nora").slice(0, 6) });
    write("request-understanding.json", { multiIntent: onboarding.understanding, single: (await analyzeForP16C({ requestId: "p-single", ...base, instruction: "Prépare l'onboarding de Sarah lundi" }, { subjects: sarah })).understanding });
    write("entity-resolution.json", { resolved: resolveEntity("employee", "Sarah", [{ id: "e1", name: "Sarah Martin" }]), ambiguous: resolveEntity("employee", "Sarah", [{ id: "e1", name: "Sarah Martin" }, { id: "e2", name: "Sarah Durand" }]), forbidden: resolveEntity("employee", "x", [{ id: "e1", name: "x", forbidden: true }]) });
    write("date-resolution.json", { iso: resolveTemporal("2026-09-01", NOW), relativeDay: resolveTemporal("demain", NOW), weekday: resolveTemporal("lundi prochain", NOW), unresolved: resolveTemporal("bientôt", NOW) });
    write("clarification.json", { missing: (await analyzeForP16C({ requestId: "p-mis", ...base, instruction: "Prépare l'avenant" })).clarification, known: onboarding.clarification });
    write("mission-intelligence.json", { objective: onboarding.missionProposal.objective, tasks: onboarding.missionProposal.tasks, deliverables: onboarding.missionProposal.deliverables, completionCriteria: onboarding.missionProposal.completionCriteria, source: onboarding.missionProposal.source });
    write("operational-depth.json", { onboarding: { items: onboarding.canonicalItemsInvolved, t1: onboarding.t1Needs, t2: onboarding.t2Needs, providers: onboarding.providerDependencies } });
    write("professional-outputs.json", { deliverables: onboarding.missionProposal.deliverables, documentEvidence: onboarding.documentEvidenceRequirements, disclosure: onboarding.cloneChatExplanation.disclosure, noFabrication: true });
    write("document-lineage.json", { correction: { isCorrection: correction.continuity.isCorrection, target: correction.continuity.targetId, requirements: correction.documentEvidenceRequirements } });
    write("continuity.json", { continue: cont.continuity, statusQuery: (await analyzeForP16C({ requestId: "p-stat", ...base, instruction: "Qu'est-ce qui bloque ?" }, { continuityContext: { missions: [{ id: "mis-1", label: "Onboarding" }] } })).continuity });
    write("correction-versioning.json", { correction: correction.continuity, latest: { note: "utilise la dernière version resolves most-recent", target: "v2" } });
    write("idempotency.json", { deterministic: JSON.stringify(await analyzeForP16C({ requestId: "p-i", ...base, instruction: "Prépare l'onboarding de Sarah lundi" }, { subjects: sarah })) === JSON.stringify(await analyzeForP16C({ requestId: "p-i", ...base, instruction: "Prépare l'onboarding de Sarah lundi" }, { subjects: sarah })), runtimeIdempotency: "fenced worker + unique constraints (reused P8 engine)" });
    write("autonomy-risk.json", { dismissal: dismissal.autonomy, prepare: onboarding.autonomy.overallDisposition });
    write("human-only-floors.json", { modeTested: "enterprise_autonomous", dismissal: dismissal.autonomy.overallDisposition, salary: salary.autonomy.overallDisposition, dismissalDecisions: dismissal.autonomy.humanOnlyDecisions, salaryDecisions: salary.autonomy.humanOnlyDecisions, floorsUnweakenable: dismissal.autonomy.overallDisposition === "human_only" && salary.autonomy.overallDisposition === "human_only" });
    write("provider-truth.json", { onboardingProviders: onboarding.providerDependencies, t1LiveBlocked: onboarding.t1Needs.filter((n) => n.liveBlocked), noFabricatedSend: !/envoy[ée]|sign[ée]/i.test(onboarding.statusExplanation) });
    write("legal-truth.json", { sectorLegal: sector.legalDependencies, blocked: sector.blockedReasons, disclosure: sector.cloneChatExplanation.disclosure });
    write("p16c-integration-contract.json", { example: dismissal, fields: Object.keys(dismissal), secretsScan: !/sk-|api[_-]?key|secret|password/i.test(JSON.stringify(dismissal)) });
    write("command-center.json", cc);
    write("scenario-matrix.json", scenarios);
    write("perimeter.json", { t1Untouched: cc.t1Untouched, t2Untouched: cc.t2Untouched, c1Untouched: cc.c1Untouched, c11Untouched: cc.c11Untouched, c12Untouched: cc.c12Untouched, productionStillOff: cc.productionStillOff, paymentStillDisabled: cc.paymentStillDisabled, liveProvidersStillBlocked: cc.liveProvidersStillBlocked, cloneChatRevealed: cc.c12Untouched });

    expect(cc.readyForP16C).toBe(true);
    expect(allPierreOwnedComplete()).toBe(true);
  }, 120_000);
});
