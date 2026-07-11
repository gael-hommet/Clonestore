// src/lib/clonestore/technologies/t1/__tests__/t1-proof-generator.test.ts
// T1 — génère les preuves JSON DEPUIS les modules réels (jamais écrites à la main).
// Écrit si T1_WRITE_PROOFS=1 (idiome maison : cf. p14/p15/p16-proof-generator).

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALL_TECHNOLOGY_CONTRACTS, ALL_TECHNOLOGY_IDS, TECHNOLOGY_FALLBACKS, UNKNOWN_TECHNOLOGY_FALLBACK,
  createTechnologyBus, crossCheckTechnologyRegistryWithMasterSplit, listTechnologyRegistryEntries,
  resolveTechnologyMode, summarizeTechnologyCommandCenter,
  type TechnologyContext, type TechnologyId,
} from "../index";

const RUN_ID = "t1-technologies-layer";
const PIERRE_CTX: TechnologyContext = { employeeId: "pierre", companyId: "company-proof" };
const FUTURE_CTX: TechnologyContext = { employeeId: "clone-futur-01", companyId: "company-proof" };

const SAMPLE_INPUTS: Readonly<Record<TechnologyId, unknown>> = {
  document: { title: "Attestation de travail" },
  mail: { to: "rh@example.test", subject: "Entretien", intent: "convocation" },
  calendar: { title: "Entretien annuel", attendees: ["Alice"] },
  signature: { documentTitle: "Contrat", signers: ["Alice"] },
  voice: { audioRef: "capture-1" },
  notification: { message: "Relancer le dossier onboarding" },
  connector: { targetSystem: "SIRH" },
  memory: { op: "write", key: "note", value: "x" },
  evidence: { subject: "mission-1", action: "préparation documentée" },
  workflow: { goal: "préparer un onboarding", steps: ["collecte", "documents"] },
  analytics: { metrics: ["headcount", "absenteeism"] },
  file: { fileName: "scan.png", mimeType: "image/png" },
  export: { subject: "dossier salarié", format: "json" },
  permission: {},
  integration_bus: {},
};

describe("T1 — proof generation", () => {
  it("écrit les preuves si T1_WRITE_PROOFS=1", async () => {
    if (process.env.T1_WRITE_PROOFS !== "1") { expect(true).toBe(true); return; }
    const dir = resolve(process.cwd(), ".t1-proofs", "t1-technologies-layer");
    mkdirSync(dir, { recursive: true });
    const w = (name: string, obj: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(obj, null, 2));

    // ── technology-registry.json — le registre réel (sans les fonctions) ──────
    const entries = listTechnologyRegistryEntries();
    w("technology-registry.json", {
      runId: RUN_ID,
      crossCheckWithP16MasterSplit: crossCheckTechnologyRegistryWithMasterSplit(),
      entries: entries.map((e) => ({
        id: e.id, status: e.status, preT1Status: e.preT1Status,
        reusable: e.reusable, pierreOnly: e.pierreOnly, pierreOnlyJustification: e.pierreOnlyJustification,
        futureEmployeesCanUse: e.futureEmployeesCanUse, sourceModules: e.sourceModules,
        liveBlockedReason: e.liveBlockedReason, safeLocalImplementation: e.safeLocalImplementation,
        safeFallback: e.safeFallback, testsRequired: e.testsRequired,
        recommendedIntegrationPhase: e.recommendedIntegrationPhase, p16MasterSplitId: e.p16MasterSplitId,
      })),
    });

    // ── contracts.json — méta des 15 contrats + résultat RÉEL d'un prepare ────
    const contractProofs = [];
    for (const id of ALL_TECHNOLOGY_IDS) {
      const c = ALL_TECHNOLOGY_CONTRACTS[id];
      const sample = await c.prepare(SAMPLE_INPUTS[id], PIERRE_CTX);
      const liveAttempt = await c.prepare({ live: true }, PIERRE_CTX);
      contractProofs.push({
        id: c.id, name: c.name, purpose: c.purpose, status: c.status,
        liveDependency: c.liveDependency, requiresValidation: c.requiresValidation,
        safeFallback: c.safeFallback, allowedInDemo: c.allowedInDemo, allowedInProduction: c.allowedInProduction,
        mode: resolveTechnologyMode({ status: c.status, liveDependency: c.liveDependency }),
        samplePrepare: { kind: sample.kind, live: sample.live, requiresHumanValidation: sample.requiresHumanValidation, artifact: sample.artifact },
        liveAttempt: { kind: liveAttempt.kind, blockedReason: liveAttempt.blockedReason ?? null },
        validationReport: c.validate(sample, PIERRE_CTX),
      });
    }
    w("contracts.json", { runId: RUN_ID, contracts: contractProofs });

    // ── technology-bus.json — le bus réel : pierre + futur employé, audit inclus ─
    const bus = createTechnologyBus();
    const pierreResult = await bus.prepareWithTechnology("mail", SAMPLE_INPUTS.mail, PIERRE_CTX);
    const futureResult = await bus.prepareWithTechnology("mail", SAMPLE_INPUTS.mail, FUTURE_CTX);
    const unknownResult = await bus.prepareWithTechnology("teleport", {}, PIERRE_CTX);
    const deniedResult = await bus.prepareWithTechnology("mail", {}, { employeeId: "", companyId: "" });
    w("technology-bus.json", {
      runId: RUN_ID,
      listing: bus.listTechnologies(),
      summary: bus.summarizeTechnologyBus(),
      proofs: {
        pierre: pierreResult,
        futureEmployee: futureResult,
        identicalArtifacts: JSON.stringify(pierreResult.artifact) === JSON.stringify(futureResult.artifact),
        unknownTechnologyRejected: unknownResult.kind === "blocked",
        emptyScopeDenied: deniedResult.kind === "blocked",
        auditEntries: bus.listAuditEntries(),
      },
    });

    // ── fallbacks.json ─────────────────────────────────────────────────────────
    w("fallbacks.json", { runId: RUN_ID, fallbacks: TECHNOLOGY_FALLBACKS, unknownTechnology: UNKNOWN_TECHNOLOGY_FALLBACK });

    // ── technology-command-center.json — rapport computé réel ─────────────────
    w("technology-command-center.json", { runId: RUN_ID, report: summarizeTechnologyCommandCenter({}) });

    expect(true).toBe(true);
  });
});
