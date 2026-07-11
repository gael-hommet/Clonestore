// src/lib/clonestore/product-technologies/t2/__tests__/t2-proof-generator.test.ts
// T2 — génère les preuves JSON DEPUIS les modules réels (jamais écrites à la main).
// Écrit si T2_WRITE_PROOFS=1 (idiome maison : p14/p15/p16/t1-proof-generator).

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALL_PRODUCT_TECHNOLOGY_IDS, ALL_PRODUCT_TECHNOLOGY_CONTRACTS, PRODUCT_TECHNOLOGY_FALLBACKS,
  listProductTechnologyRegistryEntries, evaluateProductTechnologyCommandCenter,
  createProductTechnologyOrchestrator, cloneVoiceProductTech,
  type ProductTechnologyContext, type ProductTechnologyId,
} from "../index";

const RUN_ID = "t2-product-technologies";
const CTX: ProductTechnologyContext = { employeeId: "employe-preuve", companyId: "company-proof" };
const EMPLOYEES = [{ employeeId: "employe-rh", domains: ["hr", "general"] }];

const SAMPLE_INPUTS: Readonly<Record<ProductTechnologyId, unknown>> = {
  cloneos: { request: "Prépare une attestation puis planifie un entretien", availableEmployees: EMPLOYEES },
  cloneadn: { companyName: "Preuve SARL" },
  cloneguard: { action: { kind: "prepare_document", description: "note interne" } },
  clonetrace: { subject: "mission-preuve", action: "événement de preuve", missionId: "mission-preuve" },
  clonevoice: { transcriptText: "euh prépare un document puis relance le dossier" },
  clonepolicy: { action: { channel: "external_email" } },
  clonecontinuum: { missionId: "mission-preuve", currentState: "active", event: "validation_requested" },
  clonetrust: { riskLevel: "sensitive", history: { approvals: 5, rejections: 1 } },
  clonereview: { draft: "Bonjour, voici le document TODO." },
  clonesignals: { missionId: "mission-preuve", waitingValidationSinceHours: 72 },
  clonelearn: { events: [{ type: "correction", detail: "toujours vouvoyer" }, { type: "correction", detail: "toujours vouvoyer" }, { type: "correction", detail: "toujours vouvoyer" }] },
  clonebrief: { when: "morning", missions: [{ title: "Contrat Alice", state: "prepared" }], blockers: [{ title: "RIB manquant", state: "blocked" }] },
  clonecall: { employeeCalledId: "employe-rh", objective: "préparer un onboarding", transcriptText: "prépare le dossier puis planifie la visite médicale", availableEmployees: EMPLOYEES },
  cloneroom: {
    participants: [{ id: "humain-1", kind: "human" }, { id: "employe-a", kind: "ai_employee" }, { id: "employe-b", kind: "ai_employee" }],
    thread: [{ from: "humain-1", content: "Préparez l'onboarding du nouvel arrivant" }, { from: "employe-a", to: "employe-b", content: "contexte" }],
    availableEmployees: EMPLOYEES,
  },
};

describe("T2 — proof generation", () => {
  it("écrit les preuves si T2_WRITE_PROOFS=1", async () => {
    if (process.env.T2_WRITE_PROOFS !== "1") { expect(true).toBe(true); return; }
    const dir = resolve(process.cwd(), ".t2-proofs", "t2-product-technologies");
    mkdirSync(dir, { recursive: true });
    const w = (name: string, obj: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(obj, null, 2));

    // Registre (sans fonctions).
    w("product-technology-registry.json", {
      runId: RUN_ID,
      entries: listProductTechnologyRegistryEntries().map((e) => ({
        id: e.id, status: e.status, definition: e.definition, role: e.role,
        dependencies: e.dependencies, sourceModules: e.sourceModules,
        t1TechnologiesConsumed: e.t1TechnologiesConsumed,
        safeLocalImplementation: e.safeLocalImplementation, safeFallback: e.safeFallback,
        liveBlockedReason: e.liveBlockedReason, testsRequired: e.testsRequired,
        readyForP16A: e.readyForP16A, readyForP16C: e.readyForP16C,
        claimableNow: e.claimableNow, mustNotClaim: e.mustNotClaim,
      })),
      fallbacks: PRODUCT_TECHNOLOGY_FALLBACKS,
    });

    // Contrats : méta + prepare réel + tentative live bloquée + rapport de validation.
    const contracts = [];
    for (const id of ALL_PRODUCT_TECHNOLOGY_IDS) {
      const c = ALL_PRODUCT_TECHNOLOGY_CONTRACTS[id];
      const sample = await c.prepare(SAMPLE_INPUTS[id], CTX);
      const liveAttempt = await c.prepare({ live: true }, CTX);
      contracts.push({
        id: c.id, name: c.name, definition: c.definition, role: c.role, answersQuestion: c.answersQuestion,
        contains: c.contains, doesNotContain: c.doesNotContain, dependencies: c.dependencies,
        status: c.status, mode: c.mode, requiresValidation: c.requiresValidation,
        safeFallback: c.safeFallback, liveBlockedReason: c.liveBlockedReason,
        commercialClaimAllowed: c.commercialClaimAllowed, commercialClaimForbidden: c.commercialClaimForbidden,
        samplePrepare: { kind: sample.kind, live: sample.live, requiresHumanValidation: sample.requiresHumanValidation },
        liveAttemptBlocked: liveAttempt.kind === "blocked",
        validationReport: c.validate(sample, CTX),
      });
    }
    w("product-technology-contracts.json", { runId: RUN_ID, contracts });

    // Orchestrateur : les 3 pipelines réels.
    const orch = createProductTechnologyOrchestrator();
    const rawRun = await orch.runCloneOSRequest({ request: "Prépare une attestation puis relance le manager", availableEmployees: EMPLOYEES }, CTX);
    const callRun = await orch.runCloneCallSession(SAMPLE_INPUTS.clonecall as never, CTX);
    const roomRun = await orch.runCloneRoomThread(SAMPLE_INPUTS.cloneroom as never, CTX);
    w("product-technology-orchestrator.json", {
      runId: RUN_ID,
      rawRequest: { ...rawRun, auditEntries: rawRun.auditEntries.length },
      call: { sessionKind: callRun.result.kind, executedLive: callRun.executedLive },
      room: { coordinationKind: roomRun.result.kind, briefPresent: roomRun.roomBrief !== null, executedLive: roomRun.executedLive },
      totalAuditEntries: orch.listAuditEntries().length,
    });

    // Command center computé.
    w("product-technology-command-center.json", { runId: RUN_ID, report: await evaluateProductTechnologyCommandCenter({}) });

    // CloneCall safe local — session complète réelle + chemins bloqués.
    const call = await ALL_PRODUCT_TECHNOLOGY_CONTRACTS.clonecall.prepare(SAMPLE_INPUTS.clonecall, CTX);
    const outbound = await ALL_PRODUCT_TECHNOLOGY_CONTRACTS.clonecall.prepare({ employeeCalledId: "employe-rh", outbound: true }, CTX);
    w("clonecall-safe-local.json", { runId: RUN_ID, session: call.artifact, outboundAttempt: { kind: outbound.kind, blockedReason: outbound.blockedReason ?? null } });

    // CloneRoom — coordination réelle + p2p bloqué.
    const room = await ALL_PRODUCT_TECHNOLOGY_CONTRACTS.cloneroom.prepare(SAMPLE_INPUTS.cloneroom, CTX);
    const p2p = await ALL_PRODUCT_TECHNOLOGY_CONTRACTS.cloneroom.prepare({ participants: [{ id: "a", kind: "ai_employee" }], allowPeerToPeer: true }, CTX);
    w("cloneroom-coordination.json", { runId: RUN_ID, coordination: room.artifact, peerToPeerAttempt: { kind: p2p.kind, blockedReason: p2p.blockedReason ?? null } });

    // CloneVoice — statut honnête.
    const voiceText = await cloneVoiceProductTech.prepare({ transcriptText: "euh prépare un document puis relance" }, CTX);
    const voiceAudioOnly = await cloneVoiceProductTech.prepare({ audioRef: "audio-1" }, CTX);
    w("clonevoice-status.json", {
      runId: RUN_ID,
      status: cloneVoiceProductTech.status,
      mode: cloneVoiceProductTech.mode,
      liveBlockedReason: cloneVoiceProductTech.liveBlockedReason,
      commercialClaimForbidden: cloneVoiceProductTech.commercialClaimForbidden,
      textPath: { kind: voiceText.kind, artifact: voiceText.artifact },
      audioOnlyPath: { kind: voiceAudioOnly.kind, note: "aucun provider — fallback texte" },
      operationalLiveVoice: false,
    });

    expect(true).toBe(true);
  });
});
