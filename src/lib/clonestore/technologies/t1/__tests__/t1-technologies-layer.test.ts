// src/lib/clonestore/technologies/t1/__tests__/t1-technologies-layer.test.ts
// T1 — CLONESTORE TECHNOLOGIES LAYER : les 25 preuves exigées par le bloc.
// Doctrine : technologies CloneStore réutilisables, consommées par contrat ; aucun live ;
// aucune techno Pierre-only ; validation humaine jamais contournée ; production OFF.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALL_TECHNOLOGY_IDS, ALL_TECHNOLOGY_CONTRACTS, TECHNOLOGY_FALLBACKS, UNKNOWN_TECHNOLOGY_FALLBACK,
  allTechnologiesHaveSafeFallback, buildTechnologyRegistry, listTechnologyRegistryEntries,
  getTechnologyRegistryEntry, crossCheckTechnologyRegistryWithMasterSplit, createTechnologyBus,
  checkTechnologyPermission, createTechnologyAuditEntry, buildTechnologyValidationReport,
  summarizeTechnologyCommandCenter, technologyProductionAllowed, isLiveExecutionAllowed,
  resolveTechnologyMode, errorResult, fallbackResult, needsValidationResult, wantsLiveEffect,
  mailTech, signatureTech, calendarTech, voiceTech, connectorTech, workflowTech, memoryTech,
  evidenceTech, permissionTech, fileTech,
  type TechnologyContext, type TechnologyRegistryEntry, type TechnologyResult,
  type DraftedEmailArtifact, type PreparedSignaturePackageArtifact, type PreparedCalendarEventArtifact,
  type VoiceFallbackArtifact, type WorkflowPlanArtifact, type MemoryOperationArtifact,
} from "../index";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";

const PIERRE_CTX: TechnologyContext = { employeeId: "pierre", companyId: "company-t1-test" };
const FUTURE_CTX: TechnologyContext = { employeeId: "clone-finance-01", companyId: "company-t1-test" };

// ── 1–6 : registre, réutilisabilité, contrats, fallbacks ──────────────────────

describe("T1 — registre des 15 technologies", () => {
  const entries = listTechnologyRegistryEntries();

  it("1. les 15 technologies sont enregistrées (ids exacts)", () => {
    expect(entries).toHaveLength(15);
    expect(new Set(entries.map((e) => e.id))).toEqual(new Set(ALL_TECHNOLOGY_IDS));
    expect(buildTechnologyRegistry()).toHaveLength(15);
  });

  it("2. toutes les technologies sont réutilisables", () => {
    expect(entries.every((e) => e.reusable === true)).toBe(true);
  });

  it("3. aucune technologie n'est pierreOnly (et aucune justification n'existe)", () => {
    expect(entries.filter((e) => (e.pierreOnly as boolean) === true)).toHaveLength(0);
    expect(entries.every((e) => e.pierreOnlyJustification === null)).toBe(true);
  });

  it("4. futureEmployeesCanUse est true pour toutes", () => {
    expect(entries.every((e) => e.futureEmployeesCanUse === true)).toBe(true);
  });

  it("5. chaque technologie a un fallback sûr non vide", () => {
    expect(allTechnologiesHaveSafeFallback()).toBe(true);
    expect(entries.every((e) => e.safeFallback.trim().length > 0)).toBe(true);
    expect(Object.keys(TECHNOLOGY_FALLBACKS).sort()).toEqual([...ALL_TECHNOLOGY_IDS].sort());
  });

  it("6. chaque technologie a un contrat complet (id/name/purpose/status/liveDependency/requiresValidation/prepare/validate/audit)", () => {
    for (const id of ALL_TECHNOLOGY_IDS) {
      const c = ALL_TECHNOLOGY_CONTRACTS[id];
      expect(c.id).toBe(id);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.purpose.length).toBeGreaterThan(0);
      expect(["verified", "partial", "architecture_ready", "missing", "external_blocked", "disabled"]).toContain(c.status);
      expect(["none", "provider", "external", "owner_attestation"]).toContain(c.liveDependency);
      expect(typeof c.requiresValidation).toBe("boolean");
      expect(typeof c.prepare).toBe("function");
      expect(typeof c.validate).toBe("function");
      expect(typeof c.audit).toBe("function");
    }
  });

  it("grounding : cross-check exact avec le master split P16.0 réel", () => {
    const check = crossCheckTechnologyRegistryWithMasterSplit();
    expect(check.issues).toEqual([]);
    expect(check.ok).toBe(true);
    expect(check.registryCount).toBe(15);
    expect(check.masterSplitTechnologyCount).toBe(15);
    expect(getTechnologyRegistryEntry("integration_bus")?.p16MasterSplitId).toBe("tech.bus");
  });
});

// ── 7–13 : aucun live par défaut ───────────────────────────────────────────────

describe("T1 — aucun appel live par défaut", () => {
  it("7. aucune techno n'appelle un provider live par défaut (mode + exécution live impossible)", () => {
    expect(isLiveExecutionAllowed()).toBe(false);
    for (const e of listTechnologyRegistryEntries()) {
      const mode = resolveTechnologyMode({ status: e.status, liveDependency: e.contract.liveDependency });
      expect(["local_safe", "live_disabled", "blocked"]).toContain(mode);
      expect(mode).not.toBe("live_ready");
    }
  });

  it("8. les technos à dépendance live retournent fallback/blocked (jamais un effet)", async () => {
    const liveDeps = listTechnologyRegistryEntries().filter((e) => e.contract.liveDependency !== "none");
    expect(liveDeps.map((e) => e.id).sort()).toEqual(["calendar", "connector", "mail", "notification", "signature", "voice"]);
    for (const e of liveDeps) {
      const forced = await e.contract.prepare({ live: true }, PIERRE_CTX);
      expect(forced.kind).toBe("blocked");
      expect(forced.live).toBe(false);
      expect(forced.artifact).toBeNull();
    }
  });

  it("9. MailTech rédige mais n'envoie pas", async () => {
    const draft = await mailTech.prepare({ to: "rh@example.test", subject: "Convocation", intent: "préparer un entretien" }, PIERRE_CTX);
    expect(draft.kind).toBe("needs_validation");
    const artifact = draft.artifact as DraftedEmailArtifact;
    expect(artifact.sent).toBe(false);
    expect(artifact.liveSendBlocked).toBe(true);
    const sendAttempt = await mailTech.prepare({ to: "rh@example.test", send: true }, PIERRE_CTX);
    expect(sendAttempt.kind).toBe("blocked");
  });

  it("10. SignatureTech prépare sans revendiquer de signature live", async () => {
    const pkg = await signatureTech.prepare({ documentTitle: "Contrat", signers: ["Alice"] }, PIERRE_CTX);
    expect(pkg.kind).toBe("needs_validation");
    const artifact = pkg.artifact as PreparedSignaturePackageArtifact;
    expect(artifact.liveSignature).toBe(false);
    expect(artifact.provider).toBe("none");
    const liveAttempt = await signatureTech.prepare({ signLive: true }, PIERRE_CTX);
    expect(liveAttempt.kind).toBe("blocked");
  });

  it("11. CalendarTech prépare sans créer d'événement live", async () => {
    const event = await calendarTech.prepare({ title: "Entretien annuel", attendees: ["Alice", "Bob"] }, PIERRE_CTX);
    expect(event.kind).toBe("needs_validation");
    expect((event.artifact as PreparedCalendarEventArtifact).createdLive).toBe(false);
    const liveAttempt = await calendarTech.prepare({ title: "x", createLive: true }, PIERRE_CTX);
    expect(liveAttempt.kind).toBe("blocked");
  });

  it("12. VoiceTech : fallback — l'entrée texte reste autoritaire", async () => {
    const res = await voiceTech.prepare({ audioRef: "capture-1" }, PIERRE_CTX);
    expect(res.kind).toBe("fallback");
    expect((res.artifact as VoiceFallbackArtifact).textAuthoritative).toBe(true);
    expect((res.artifact as VoiceFallbackArtifact).transcript).toBeNull();
  });

  it("13. ConnectorTech bloque les appels live et dégrade en manuel", async () => {
    const connectAttempt = await connectorTech.prepare({ targetSystem: "SIRH", connect: true }, PIERRE_CTX);
    expect(connectAttempt.kind).toBe("blocked");
    const fallback = await connectorTech.prepare({ targetSystem: "SIRH" }, PIERRE_CTX);
    expect(fallback.kind).toBe("fallback");
  });
});

// ── 14–16 : gouvernance ────────────────────────────────────────────────────────

describe("T1 — gouvernance (pas de 2e cerveau, fail-closed, audit)", () => {
  it("14. WorkflowTech ne devient pas un cerveau RH", async () => {
    const plan = await workflowTech.prepare({ goal: "préparer un onboarding", steps: ["a", "b"] }, PIERRE_CTX);
    expect(plan.kind).toBe("needs_validation");
    const artifact = plan.artifact as WorkflowPlanArtifact;
    expect(artifact.decidesHrOutcomes).toBe(false);
    expect(artifact.executed).toBe(false);
    expect(artifact.hrReasoningSource).toContain("V1");
    const decisionAttempt = await workflowTech.prepare({ goal: "licencier", decideHrOutcome: true }, PIERRE_CTX);
    expect(decisionAttempt.kind).toBe("blocked");
    expect(decisionAttempt.blockedReason).toContain("JAMAIS");
  });

  it("15. PermissionTech refuse fail-closed", async () => {
    expect(checkTechnologyPermission("", "document", { companyId: "c1" }).allowed).toBe(false);
    expect(checkTechnologyPermission("pierre", "document", { companyId: "" }).allowed).toBe(false);
    expect(checkTechnologyPermission("pierre", "techno-inexistante", { companyId: "c1" }).allowed).toBe(false);
    expect(checkTechnologyPermission("pierre", "document", null).allowed).toBe(false);
    const denied = await permissionTech.prepare({ employeeId: "" }, PIERRE_CTX);
    expect(denied.kind).toBe("blocked");
    const contextless = await permissionTech.prepare({}, { employeeId: "", companyId: "" });
    expect(contextless.kind).toBe("blocked");
  });

  it("16. EvidenceTech audite l'usage — l'audit marche pour TOUS les kinds", async () => {
    const evidence = await evidenceTech.prepare({ subject: "mission-42", action: "document préparé" }, PIERRE_CTX);
    expect(evidence.kind).toBe("ok");
    for (const result of [
      evidence,
      needsValidationResult("document", PIERRE_CTX, { x: 1 }),
      fallbackResult("voice", PIERRE_CTX, null, "fallback"),
      errorResult("mail", PIERRE_CTX, "boom"),
    ] as TechnologyResult[]) {
      const entry = createTechnologyAuditEntry(result);
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.live).toBe(false);
      expect(entry.resultKind).toBe(result.kind);
    }
  });

  it("MemoryTech respecte le périmètre société (fail-closed) et prépare sans commit", async () => {
    const crossScope = await memoryTech.prepare({ op: "read", scope: "autre-company" }, PIERRE_CTX);
    expect(crossScope.kind).toBe("blocked");
    const read = await memoryTech.prepare({ op: "read", scope: PIERRE_CTX.companyId }, PIERRE_CTX);
    expect(read.kind).toBe("ok");
    const write = await memoryTech.prepare({ op: "write", key: "note", value: "x" }, PIERRE_CTX);
    expect(write.kind).toBe("needs_validation");
    expect((write.artifact as MemoryOperationArtifact).committed).toBe(false);
  });

  it("FileTech : aucune hypothèse de parsing — mime inconnu → fallback", async () => {
    const unknown = await fileTech.prepare({ fileName: "x.bin", mimeType: "application/octet-stream" }, PIERRE_CTX);
    expect(unknown.kind).toBe("fallback");
    const image = await fileTech.prepare({ fileName: "scan.png", mimeType: "image/png" }, PIERRE_CTX);
    expect(image.kind).toBe("needs_validation");
  });

  it("la validation machine ne contourne JAMAIS la validation humaine (même résultat forgé)", () => {
    const genuine = needsValidationResult("document", PIERRE_CTX, { d: 1 });
    const report = buildTechnologyValidationReport({ id: "document", requiresValidation: true }, genuine, PIERRE_CTX);
    expect(report.humanValidationRequired).toBe(true);
    expect(report.machineCanAutoApprove).toBe(false);

    const forged = { ...genuine, requiresHumanValidation: false, live: true } as unknown as TechnologyResult;
    const forgedReport = buildTechnologyValidationReport({ id: "document", requiresValidation: true }, forged, PIERRE_CTX);
    expect(forgedReport.structurallyValid).toBe(false);
    expect(forgedReport.humanValidationRequired).toBe(true);
    expect(forgedReport.machineCanAutoApprove).toBe(false);
  });

  it("jamais de secret dans un résultat/audit (assainissement)", () => {
    const leaky = errorResult("mail", PIERRE_CTX, "échec api_key=sk_live_abc1234567890 token: eyJhbGciOiJIUzI1NiJ9.payload");
    expect(leaky.errorMessage).not.toContain("sk_live_");
    expect(leaky.errorMessage).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(leaky.errorMessage).toContain("[REDACTED]");
    const entry = createTechnologyAuditEntry(leaky);
    expect(entry.note).not.toContain("sk_live_");
  });
});

// ── 17–20 : TechnologyBus ──────────────────────────────────────────────────────

describe("T1 — TechnologyBus (générique, multi-employés)", () => {
  it("17. le bus liste, expose et fait consommer les technologies", async () => {
    const bus = createTechnologyBus();
    expect(bus.listTechnologies()).toHaveLength(15);
    expect(bus.getTechnology("document")?.id).toBe("document");
    expect(bus.getTechnologyFallback("mail")).toBe(TECHNOLOGY_FALLBACKS.mail);
    const result = await bus.prepareWithTechnology("document", { title: "Attestation" }, PIERRE_CTX);
    expect(result.kind).toBe("needs_validation");
    const summary = bus.summarizeTechnologyBus();
    expect(summary.totalTechnologies).toBe(15);
    expect(summary.pierreOnlyCount).toBe(0);
    expect(summary.liveExecutionAllowed).toBe(false);
  });

  it("18. le bus rejette une technologie inconnue (fail-closed, audité)", async () => {
    const bus = createTechnologyBus();
    expect(bus.getTechnology("teleport")).toBeUndefined();
    expect(bus.canUseTechnology("pierre", "teleport", PIERRE_CTX).allowed).toBe(false);
    expect(bus.getTechnologyFallback("teleport")).toBe(UNKNOWN_TECHNOLOGY_FALLBACK);
    const result = await bus.prepareWithTechnology("teleport", {}, PIERRE_CTX);
    expect(result.kind).toBe("blocked");
    expect(bus.listAuditEntries()).toHaveLength(1);
  });

  it("19. le bus fonctionne pour employeeId=\"pierre\"", async () => {
    const bus = createTechnologyBus();
    expect(bus.canUseTechnology("pierre", "mail", PIERRE_CTX).allowed).toBe(true);
    const result = await bus.prepareWithTechnology("mail", { to: "a@b.test", subject: "s", intent: "i" }, PIERRE_CTX);
    expect(result.kind).toBe("needs_validation");
    expect(result.employeeId).toBe("pierre");
  });

  it("20. le bus fonctionne À L'IDENTIQUE pour un futur employé IA", async () => {
    const bus = createTechnologyBus();
    expect(bus.canUseTechnology("clone-finance-01", "mail", FUTURE_CTX).allowed).toBe(true);
    const input = { to: "a@b.test", subject: "s", intent: "i" };
    const pierre = await bus.prepareWithTechnology("mail", input, PIERRE_CTX);
    const future = await bus.prepareWithTechnology("mail", input, FUTURE_CTX);
    expect(future.kind).toBe(pierre.kind);
    expect(future.artifact).toEqual(pierre.artifact); // MÊME contrat, MÊME artefact — aucun privilège Pierre
    expect(future.employeeId).toBe("clone-finance-01");
  });

  it("la permission est vérifiée AVANT prepare ; l'audit APRÈS (même refusé)", async () => {
    const bus = createTechnologyBus({
      permissionOptions: { deniedTechnologyIdsByEmployee: { "employe-restreint": ["connector"] } },
    });
    const denied = await bus.prepareWithTechnology("connector", { targetSystem: "SIRH" }, { employeeId: "employe-restreint", companyId: "c1" });
    expect(denied.kind).toBe("blocked");
    expect(denied.artifact).toBeNull(); // prepare n'a jamais tourné
    const noCompany = await bus.prepareWithTechnology("mail", {}, { employeeId: "pierre", companyId: "" });
    expect(noCompany.kind).toBe("blocked");
    expect(bus.listAuditEntries().length).toBe(2); // chaque tentative est auditée
  });
});

// ── 21 : command center ────────────────────────────────────────────────────────

describe("T1 — command center", () => {
  it("21a. readyForPierreIntegration est true quand TOUTES les conditions passent", () => {
    const report = summarizeTechnologyCommandCenter({});
    expect(report.exactBlockers).toEqual([]);
    expect(report.readyForPierreIntegration).toBe(true);
    expect(report.totalTechnologies).toBe(15);
    expect(report.reusableCount).toBe(15);
    expect(report.pierreOnlyCount).toBe(0);
    expect(report.liveProviderBlockedCount).toBe(6);
    expect(report.safeFallbackAvailableCount).toBe(15);
    expect(report.masterSplitCrossCheckOk).toBe(true);
    expect(report.exactWarnings.length).toBeGreaterThan(0); // les warnings live/externes restent visibles
    expect(report.recommendedNextStep).toContain("P16C");
  });

  it("21b. readyForPierreIntegration devient false si une techno manque", () => {
    const entries = listTechnologyRegistryEntries().filter((e) => e.id !== "mail");
    const report = summarizeTechnologyCommandCenter({}, entries);
    expect(report.readyForPierreIntegration).toBe(false);
    expect(report.exactBlockers.some((b) => b.includes("mail"))).toBe(true);
  });

  it("21c. readyForPierreIntegration devient false si une techno est pierreOnly ou sans fallback", () => {
    const base = listTechnologyRegistryEntries();
    const forgedPierreOnly = [
      ...base.slice(0, 14),
      { ...base[14], pierreOnly: true } as unknown as TechnologyRegistryEntry,
    ];
    expect(summarizeTechnologyCommandCenter({}, forgedPierreOnly).readyForPierreIntegration).toBe(false);

    const forgedNoFallback = [
      ...base.slice(0, 14),
      { ...base[14], safeFallback: "  " } as unknown as TechnologyRegistryEntry,
    ];
    expect(summarizeTechnologyCommandCenter({}, forgedNoFallback).readyForPierreIntegration).toBe(false);
  });
});

// ── 22–25 : périmètre ──────────────────────────────────────────────────────────

describe("T1 — périmètre (production, paiement, Pierre V1, aucun hardcode)", () => {
  it("22. la production reste false (plancher P10 + dérivés)", () => {
    expect(PRODUCTION_AUTHORIZED).toBe(false);
    expect(technologyProductionAllowed()).toBe(false);
    for (const id of ALL_TECHNOLOGY_IDS) {
      expect(ALL_TECHNOLOGY_CONTRACTS[id].allowedInProduction).toBe(false);
    }
    expect(summarizeTechnologyCommandCenter({}).productionAuthorized).toBe(false);
  });

  it("23. le paiement reste disabled/test — jamais live", () => {
    expect(resolvePaymentMode({})).toBe("disabled");
    // Même des clés live forgées ne donnent JAMAIS « live » tant que P10=false.
    expect(resolvePaymentMode({ STRIPE_SECRET_KEY: `sk_live_${"x".repeat(24)}` })).not.toBe("live");
    expect(["disabled", "test"]).toContain(summarizeTechnologyCommandCenter({}).paymentMode);
  });

  const t1Dir = resolve(process.cwd(), "src", "lib", "clonestore", "technologies", "t1");
  // Balayage RÉCURSIF (un futur sous-dossier ne peut pas échapper au scan) ; __tests__ exclu.
  const collectSources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory()
        ? (d.name === "__tests__" ? [] : collectSources(resolve(dir, d.name)))
        : (d.name.endsWith(".ts") ? [resolve(dir, d.name)] : []),
    );
  const sourceFiles = collectSources(t1Dir);
  const readSource = (f: string) => readFileSync(f, "utf8");

  it("24. Pierre V1 reste intouché : la couche T1 n'importe RIEN de pierre/clonechat/next/providers", () => {
    const allowedExternalImports = [
      "@/lib/clonestore/production/p10-production-gate",
      "@/lib/clonestore/production/p15-1-payment-mode",
      "@/lib/clonestore/pricing/stripe-pricing-config",
      "@/lib/clonestore/ultimate/p16-master-split",
    ];
    for (const file of sourceFiles) {
      const source = readSource(file);
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const spec of imports) {
        const ok = spec.startsWith("./") || allowedExternalImports.includes(spec);
        expect(ok, `${file} importe « ${spec} » — hors liste autorisée T1`).toBe(true);
      }
      expect(source, `${file} contient fetch(`).not.toMatch(/\bfetch\s*\(/);
      expect(source, `${file} contient une URL réseau`).not.toMatch(/https?:\/\//);
      expect(source, `${file} contient un import dynamique`).not.toMatch(/\bimport\s*\(/);
      expect(source, `${file} contient require(`).not.toMatch(/\brequire\s*\(/);
      if (!file.endsWith("technology-command-center.ts")) {
        expect(source, `${file} lit process.env`).not.toContain("process.env");
      }
    }
  });

  it("25. aucune technologie hardcodée Pierre-only (ni dans le registre, ni dans le code)", () => {
    expect(listTechnologyRegistryEntries().filter((e) => (e.pierreOnly as boolean) === true)).toHaveLength(0);
    for (const file of sourceFiles) {
      const source = readSource(file);
      // Aucun branchement sur un employé précis : pas de littéral "pierre" en code (guillemets ASCII).
      expect(source, `${file} contient un littéral "pierre" (hardcode employé)`).not.toMatch(/["']pierre["']/);
    }
  });

  it("wantsLiveEffect : garde anti-effet-live générique", () => {
    expect(wantsLiveEffect({ send: true })).toBe(true);
    expect(wantsLiveEffect({ execute: true })).toBe(true);
    expect(wantsLiveEffect({ title: "ok" })).toBe(false);
    expect(wantsLiveEffect(null)).toBe(false);
  });
});

// ── Round 2 adversarial — verrous issus de la vérification contradictoire ─────

describe("T1 — round 2 adversarial (verrous)", () => {
  it("R1. anti-blanchiment : un résultat mail re-étiqueté « evidence/ok » est démasqué", async () => {
    const bus = createTechnologyBus();
    const genuine = await bus.prepareWithTechnology("mail", { to: "a@b.test", subject: "s", intent: "i" }, PIERRE_CTX);
    expect(genuine.kind).toBe("needs_validation");
    for (const targetTech of ["evidence", "permission", "integration_bus"]) {
      const laundered = {
        ...genuine, technologyId: targetTech, kind: "ok", requiresHumanValidation: false,
      } as unknown as TechnologyResult;
      const report = bus.validateTechnologyResult(laundered, PIERRE_CTX);
      expect(report.structurallyValid, `blanchiment vers ${targetTech} non détecté`).toBe(false);
      expect(report.humanValidationRequired, `humain contourné via ${targetTech}`).toBe(true);
      expect(report.machineCanAutoApprove).toBe(false);
    }
  });

  it("R2. un artefact forgé prétendant à un effet (sent/executed/committed…) est invalide", async () => {
    const bus = createTechnologyBus();
    const genuine = await bus.prepareWithTechnology("mail", { to: "a@b.test" }, PIERRE_CTX);
    const forged = {
      ...genuine,
      artifact: { ...(genuine.artifact as Record<string, unknown>), sent: true },
    } as unknown as TechnologyResult;
    const report = bus.validateTechnologyResult(forged, PIERRE_CTX);
    expect(report.structurallyValid).toBe(false);
    expect(report.humanValidationRequired).toBe(true);
  });

  it("R3. l'assainisseur expurge les formats de secrets réels (OpenAI/Bearer/AWS/GitHub/Google/DSN)", () => {
    const leaks = [
      "clé sk-proj-Ab12Cd34Ef56Gh78Ij90KlMn",
      "Authorization: Bearer ghu_AbCdEf1234567890XyZ",
      "aws AKIAIOSFODNN7EXAMPLE",
      "dsn postgres://pierre_user:S3cr3tPass@db.internal:5432/hr",
      "github ghp_AbCdEf1234567890AbCdEf1234567890",
      "google AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY",
    ];
    for (const leak of leaks) {
      const res = errorResult("mail", PIERRE_CTX, `échec: ${leak}`);
      expect(res.errorMessage, `fuite non expurgée : ${leak}`).toContain("[REDACTED]");
      expect(res.errorMessage).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(res.errorMessage).not.toContain("S3cr3tPass");
      expect(res.errorMessage).not.toContain("sk-proj-Ab12");
      expect(res.errorMessage).not.toContain("ghp_AbCdEf");
      expect(res.errorMessage).not.toContain("AIzaSyD-9tSrke");
      expect(res.errorMessage).not.toContain("ghu_AbCdEf");
    }
  });

  it("R4. intention live élargie : synonymes, booléens-chaînes et imbrication → blocked", async () => {
    expect((await mailTech.prepare({ to: "x", dispatch: true } as never, PIERRE_CTX)).kind).toBe("blocked");
    expect((await mailTech.prepare({ to: "x", send: "true" } as never, PIERRE_CTX)).kind).toBe("blocked");
    expect((await mailTech.prepare({ to: "x", send: 1 } as never, PIERRE_CTX)).kind).toBe("blocked");
    expect((await mailTech.prepare({ options: { send: true } } as never, PIERRE_CTX)).kind).toBe("blocked");
    expect((await signatureTech.prepare({ submit: true } as never, PIERRE_CTX)).kind).toBe("blocked");
    expect((await memoryTech.prepare({ op: "write", commit: true } as never, PIERRE_CTX)).kind).toBe("blocked");
    expect(wantsLiveEffect({ publish: "yes" })).toBe(true);
    expect(wantsLiveEffect({ steps: ["envoyer", "publier"] })).toBe(false); // les données texte ne déclenchent pas
  });

  it("R5. WorkflowTech : decideHrOutcome truthy (pas seulement true) → blocked ; langage RH sensible signalé", async () => {
    expect((await workflowTech.prepare({ goal: "x", decideHrOutcome: "yes" } as never, PIERRE_CTX)).kind).toBe("blocked");
    expect((await workflowTech.prepare({ goal: "x", decideHrOutcome: 1 } as never, PIERRE_CTX)).kind).toBe("blocked");
    const sensitive = await workflowTech.prepare({ goal: "préparer un dossier de licenciement" }, PIERRE_CTX);
    expect(sensitive.kind).toBe("needs_validation"); // préparation possible…
    expect((sensitive.artifact as WorkflowPlanArtifact).sensitiveHrLanguageDetected).toBe(true); // …mais signalée à l'humain
    const neutral = await workflowTech.prepare({ goal: "préparer un onboarding" }, PIERRE_CTX);
    expect((neutral.artifact as WorkflowPlanArtifact).sensitiveHrLanguageDetected).toBe(false);
  });

  it("R6. surfaces gelées : contrats et registre non mutables au runtime", () => {
    expect(Object.isFrozen(ALL_TECHNOLOGY_CONTRACTS)).toBe(true);
    expect(Object.isFrozen(ALL_TECHNOLOGY_CONTRACTS.mail)).toBe(true);
    expect(Object.isFrozen(listTechnologyRegistryEntries())).toBe(true);
    expect(Object.isFrozen(listTechnologyRegistryEntries()[0])).toBe(true);
    expect(() => {
      (ALL_TECHNOLOGY_CONTRACTS as Record<string, unknown>).mail = { prepare: () => null };
    }).toThrow();
    expect(() => {
      (listTechnologyRegistryEntries() as unknown as unknown[]).push({});
    }).toThrow();
  });

  it("R7. command center : sondes renforcées + entriesInjected déclaré + missing/disabled bloquant", () => {
    const real = summarizeTechnologyCommandCenter({});
    expect(real.entriesInjected).toBe(false);
    expect(real.readyForPierreIntegration).toBe(true);

    const injected = summarizeTechnologyCommandCenter({}, listTechnologyRegistryEntries());
    expect(injected.entriesInjected).toBe(true);

    const base = listTechnologyRegistryEntries();
    const withMissing = [
      ...base.slice(0, 14),
      { ...base[14], status: "missing" } as unknown as TechnologyRegistryEntry,
    ];
    const report = summarizeTechnologyCommandCenter({}, withMissing);
    expect(report.readyForPierreIntegration).toBe(false);
    expect(report.exactBlockers.some((b) => b.includes("missing"))).toBe(true);
  });
});
