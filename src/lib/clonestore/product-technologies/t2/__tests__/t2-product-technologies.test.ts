// src/lib/clonestore/product-technologies/t2/__tests__/t2-product-technologies.test.ts
// T2 — CLONESTORE PRODUCT TECHNOLOGIES : les 45 preuves exigées par le bloc + verrous T1-style.
// Doctrine : T2 = systèmes produit au-dessus de T1 ; aucun live ; gouvernance jamais sautée ;
// aucun hardcode Pierre ; production OFF ; paiement disabled/test.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALL_PRODUCT_TECHNOLOGY_IDS, ALL_PRODUCT_TECHNOLOGY_CONTRACTS, PRODUCT_TECHNOLOGY_FALLBACKS,
  allProductTechnologiesHaveSafeFallback, listProductTechnologyRegistryEntries,
  getProductTechnologyRegistryEntry, buildProductTechnologyValidationReport,
  evaluateProductTechnologyCommandCenter, createProductTechnologyOrchestrator,
  cloneOSProductTech, cloneADNProductTech, cloneGuardProductTech, cloneTraceProductTech,
  cloneVoiceProductTech, clonePolicyProductTech, cloneContinuumProductTech, cloneTrustProductTech,
  cloneReviewProductTech, cloneSignalsProductTech, cloneLearnProductTech, cloneBriefProductTech,
  cloneCallProductTech, cloneRoomProductTech, productError,
  type ProductTechnologyContext, type ProductTechnologyResult, type CloneOSMissionPlan,
  type CloneGuardDecision, type CloneTraceEvent, type CloneVoiceIntentArtifact,
  type ClonePolicyDecision, type CloneContinuumState, type CloneTrustDecision,
  type CloneReviewReport, type CloneSignalsArtifact, type CloneLearnArtifact,
  type CloneBriefArtifact, type CloneCallSessionArtifact, type CloneRoomCoordinationArtifact,
  type CloneADNProfileArtifact,
} from "../index";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import {
  ALL_TECHNOLOGY_IDS as T1_IDS, isLiveExecutionAllowed, summarizeTechnologyCommandCenter,
} from "@/lib/clonestore/technologies/t1";
import { masterSplitComplete, getTechnologyItems } from "@/lib/clonestore/ultimate/p16-master-split";

const CTX: ProductTechnologyContext = { employeeId: "employe-ia-test", companyId: "company-t2-test" };
const EMPLOYEES = [{ employeeId: "employe-rh", domains: ["hr", "general"] }];

// ── 1–7 : registre, contrats, fallbacks, périmètre live ───────────────────────

describe("T2 — registre et périmètre de base", () => {
  const entries = listProductTechnologyRegistryEntries();

  it("1. les 14 technologies produit sont enregistrées", () => {
    expect(entries).toHaveLength(14);
    expect(new Set(entries.map((e) => e.id))).toEqual(new Set(ALL_PRODUCT_TECHNOLOGY_IDS));
    expect(getProductTechnologyRegistryEntry("clonecall")?.id).toBe("clonecall");
  });

  it("2. chaque technologie produit a un contrat complet", () => {
    for (const id of ALL_PRODUCT_TECHNOLOGY_IDS) {
      const c = ALL_PRODUCT_TECHNOLOGY_CONTRACTS[id];
      expect(c.id).toBe(id);
      for (const field of [c.name, c.definition, c.role, c.answersQuestion, c.commercialClaimAllowed] as const) {
        expect(field.trim().length).toBeGreaterThan(0);
      }
      expect(c.contains.length).toBeGreaterThan(0);
      expect(c.doesNotContain.length).toBeGreaterThan(0);
      expect(c.commercialClaimForbidden.length).toBeGreaterThan(0);
      expect(typeof c.prepare).toBe("function");
      expect(typeof c.validate).toBe("function");
      expect(typeof c.audit).toBe("function");
      expect(["verified", "partial", "architecture_ready", "local_safe_ready", "integration_ready", "external_blocked", "live_blocked", "missing"]).toContain(c.status);
      expect(["local_safe", "architecture_only", "integration_ready", "live_disabled", "blocked"]).toContain(c.mode);
    }
  });

  it("3. chaque technologie produit a un fallback sûr", () => {
    expect(allProductTechnologiesHaveSafeFallback()).toBe(true);
    expect(Object.keys(PRODUCT_TECHNOLOGY_FALLBACKS).sort()).toEqual([...ALL_PRODUCT_TECHNOLOGY_IDS].sort());
    expect(entries.every((e) => e.safeFallback.trim().length > 0)).toBe(true);
  });

  const t2Dir = resolve(process.cwd(), "src", "lib", "clonestore", "product-technologies", "t2");
  const collectSources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory()
        ? (d.name === "__tests__" ? [] : collectSources(resolve(dir, d.name)))
        : (d.name.endsWith(".ts") ? [resolve(dir, d.name)] : []),
    );
  const sourceFiles = collectSources(t2Dir);

  it("4. aucun import du runtime Pierre V1 (liste d'imports fermée, scan récursif)", () => {
    const allowed = [
      "@/lib/clonestore/technologies/t1",
      "@/lib/clonestore/production/p10-production-gate",
      "@/lib/clonestore/production/p15-1-payment-mode",
      "@/lib/clonestore/pricing/stripe-pricing-config",
    ];
    expect(sourceFiles.length).toBeGreaterThanOrEqual(21);
    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec.startsWith("./") || allowed.includes(spec), `${file} importe « ${spec} » — hors liste autorisée T2`).toBe(true);
      }
    }
  });

  it("5. la production reste false", () => {
    expect(PRODUCTION_AUTHORIZED).toBe(false);
  });

  it("6. le paiement reste disabled/test — jamais live", () => {
    expect(resolvePaymentMode({})).toBe("disabled");
    expect(resolvePaymentMode({ STRIPE_SECRET_KEY: `sk_live_${"x".repeat(24)}` })).not.toBe("live");
  });

  it("7. aucun provider live n'est appelé (scan source + invariant + intention live bloquée)", async () => {
    expect(isLiveExecutionAllowed()).toBe(false);
    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} contient fetch(`).not.toMatch(/\bfetch\s*\(/);
      expect(source, `${file} contient une URL réseau`).not.toMatch(/https?:\/\//);
      expect(source, `${file} contient un import dynamique`).not.toMatch(/\bimport\s*\(/);
      expect(source, `${file} contient require(`).not.toMatch(/\brequire\s*\(/);
      if (!file.endsWith("product-technology-command-center.ts")) {
        expect(source, `${file} lit process.env`).not.toContain("process.env");
      }
    }
    for (const id of ["cloneos", "clonebrief", "clonecall", "cloneroom"] as const) {
      const forced = await ALL_PRODUCT_TECHNOLOGY_CONTRACTS[id].prepare({ live: true }, CTX);
      expect(forced.kind, `${id} n'a pas bloqué {live:true}`).toBe("blocked");
    }
  });

  it("aucun littéral d'employé hardcodé dans les sources T2", () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} contient un littéral "pierre"`).not.toMatch(/["']pierre["']/);
    }
  });
});

// ── 8–10 : CloneOS ─────────────────────────────────────────────────────────────

describe("T2 — CloneOS", () => {
  it("8. crée un plan de mission depuis une demande brute", async () => {
    const res = await cloneOSProductTech.prepare({ request: "Prépare une attestation de travail pour Alice", availableEmployees: EMPLOYEES }, CTX);
    expect(res.kind).toBe("needs_validation");
    const plan = res.artifact as CloneOSMissionPlan;
    expect(plan.artifactKind).toBe("cloneos_mission_plan");
    expect(plan.intention.intentKind).toBe("prepare_document");
    expect(plan.missionCandidate.title.length).toBeGreaterThan(0);
    expect(plan.executed).toBe(false);
    expect(plan.governanceRequired).toBe(true);
  });

  it("9. décompose en tâches avec dépendances", async () => {
    const res = await cloneOSProductTech.prepare(
      { request: "Prépare le dossier d'accueil puis planifie l'entretien d'intégration puis relance le manager" },
      CTX,
    );
    const plan = res.artifact as CloneOSMissionPlan;
    expect(plan.tasks.length).toBe(3);
    expect(plan.tasks[0].dependsOn).toEqual([]);
    expect(plan.tasks[1].dependsOn).toEqual(["task-1"]);
    expect(plan.tasks[2].dependsOn).toEqual(["task-2"]);
    expect(plan.contextHandoffPlan.length).toBe(2);
    expect(plan.resultMergePlan.order).toEqual(["task-1", "task-2", "task-3"]);
  });

  it("10. propose le routage employés SANS exécuter ni décider RH", async () => {
    const withEmployees = await cloneOSProductTech.prepare({ request: "Prépare le contrat du nouveau salarié", availableEmployees: EMPLOYEES }, CTX);
    const plan = withEmployees.artifact as CloneOSMissionPlan;
    expect(plan.routing[0].proposedEmployeeId).toBe("employe-rh");
    expect(plan.executed).toBe(false);
    expect(plan.decidesHrOutcomes).toBe(false);
    const without = await cloneOSProductTech.prepare({ request: "Prépare le contrat du nouveau salarié" }, CTX);
    const plan2 = without.artifact as CloneOSMissionPlan;
    expect(plan2.routing[0].proposedEmployeeId).toBeNull();
    expect(plan2.routing[0].note).toContain("humaine");
    const empty = await cloneOSProductTech.prepare({ request: "" }, CTX);
    expect(empty.kind).toBe("blocked");
  });
});

// ── 11–22 : les couches de gouvernance et de support ───────────────────────────

describe("T2 — gouvernance et couches de support", () => {
  it("11. CloneADN produit un artefact de style/contexte d'entreprise", async () => {
    const res = await cloneADNProductTech.prepare({ companyName: "Boulangerie Martin", formality: "vouvoiement" }, CTX);
    expect(res.kind).toBe("needs_validation");
    const profile = res.artifact as CloneADNProfileArtifact;
    expect(profile.artifactKind).toBe("cloneadn_profile");
    expect(profile.identity.companyName).toBe("Boulangerie Martin");
    expect(profile.formality).toBe("vouvoiement");
    expect(profile.mutationPolicy).toBe("proposals_only");
    expect(profile.adnMutated).toBe(false);
  });

  it("12. CloneGuard classe normal/sensitive/critical", async () => {
    const normal = await cloneGuardProductTech.prepare({ action: { kind: "prepare_document", description: "préparer une note interne d'information" } }, CTX);
    expect((normal.artifact as CloneGuardDecision).riskLevel).toBe("normal");
    expect((normal.artifact as CloneGuardDecision).decision).toBe("allow_prepare");
    const sensitive = await cloneGuardProductTech.prepare({ action: { kind: "draft_email", description: "email au salarié", channel: "external_email" } }, CTX);
    expect((sensitive.artifact as CloneGuardDecision).riskLevel).toBe("sensitive");
    expect((sensitive.artifact as CloneGuardDecision).decision).toBe("require_validation");
    const critical = await cloneGuardProductTech.prepare({ action: { kind: "prepare_case", description: "préparer un dossier de licenciement" } }, CTX);
    expect((critical.artifact as CloneGuardDecision).riskLevel).toBe("critical");
  });

  it("13. CloneGuard bloque/refuse l'action critique non sûre", async () => {
    const live = await cloneGuardProductTech.prepare({ action: { kind: "execute_live", description: "envoyer maintenant" } }, CTX);
    expect((live.artifact as CloneGuardDecision).decision).toBe("refuse");
    const finalDecision = await cloneGuardProductTech.prepare({ action: { kind: "decide_final", description: "décider le licenciement de Bob" } }, CTX);
    const d = finalDecision.artifact as CloneGuardDecision;
    expect(d.riskLevel).toBe("critical");
    expect(d.decision).toBe("refuse");
    expect(d.finalLegalDecision).toBe(false);
  });

  it("14. CloneTrace crée un événement/timeline avec pointeur de reprise + évidence T1 réelle", async () => {
    const res = await cloneTraceProductTech.prepare({ subject: "mission-7", action: "plan proposé", missionId: "mission-7", reason: "test" }, CTX);
    expect(res.kind).toBe("ok");
    const ev = res.artifact as CloneTraceEvent;
    expect(ev.artifactKind).toBe("clonetrace_event");
    expect(ev.links.missionId).toBe("mission-7");
    expect(ev.resumePointer.lastEventId.length).toBeGreaterThan(0);
    expect(ev.t1Evidence?.artifactKind).toBe("evidence_entry"); // consommation T1 EvidenceTech prouvée
    expect(ev.orchestrates).toBe(false);
  });

  it("15. CloneVoice : fallback transcript/texte, aucune revendication de voix live", async () => {
    const noTranscript = await cloneVoiceProductTech.prepare({ audioRef: "audio-1" }, CTX);
    expect(noTranscript.kind).toBe("fallback"); // audio sans texte → aucun provider, l'humain fournit le texte
    const withText = await cloneVoiceProductTech.prepare({ transcriptText: "euh prépare une attestation puis planifie un entretien" }, CTX);
    expect(withText.kind).toBe("needs_validation");
    const v = withText.artifact as CloneVoiceIntentArtifact;
    expect(v.liveVoice).toBe(false);
    expect(v.audioProcessed).toBe(false);
    expect(v.textAuthoritative).toBe(true);
    expect(v.cleanedTranscript).not.toContain("euh");
    expect(v.segments.length).toBe(2);
    expect(v.t1VoiceFallback?.textAuthoritative).toBe(true); // consommation T1 VoiceTech prouvée
    expect(cloneVoiceProductTech.commercialClaimForbidden).toContain("voix live opérationnelle");
    expect(cloneVoiceProductTech.status).toBe("architecture_ready");
  });

  it("16. ClonePolicy applique validation/autonomie/canal/temps", async () => {
    const external = await clonePolicyProductTech.prepare({ action: { channel: "external_email" } }, CTX);
    const d1 = external.artifact as ClonePolicyDecision;
    expect(d1.requiresValidation).toBe(true);
    expect(d1.decision).toBe("require_validation");
    const capped = await clonePolicyProductTech.prepare({
      rules: [{ ruleId: "r1", appliesTo: { taskType: "draft_email" }, autonomyCap: "prepare_only" }],
      action: { taskType: "draft_email", channel: "internal" },
    }, CTX);
    expect((capped.artifact as ClonePolicyDecision).autonomyCap).toBe("prepare_only");
    const badChannel = await clonePolicyProductTech.prepare({ action: { channel: "slack" } }, CTX);
    expect((badChannel.artifact as ClonePolicyDecision).decision).toBe("block");
    const badHour = await clonePolicyProductTech.prepare({
      rules: [{ ruleId: "r2", appliesTo: {}, timeWindow: { notAfterHour: 18 } }],
      action: { channel: "internal", hourOfDay: 22 },
    }, CTX);
    expect((badHour.artifact as ClonePolicyDecision).decision).toBe("block");
    expect((badHour.artifact as ClonePolicyDecision).replacesCloneGuard).toBe(false);
  });

  it("17. CloneContinuum produit l'état de continuité (sans cron live)", async () => {
    const waiting = await cloneContinuumProductTech.prepare({ missionId: "m1", currentState: "active", event: "validation_requested" }, CTX);
    const s1 = waiting.artifact as CloneContinuumState;
    expect(s1.state).toBe("waiting_for_validation");
    expect(s1.nextWakeupRecommendation).not.toBeNull();
    expect(s1.liveSchedulerUsed).toBe(false);
    expect(s1.cronCreated).toBe(false);
    const closed = await cloneContinuumProductTech.prepare({ missionId: "m1", currentState: "waiting_for_validation", event: "close" }, CTX);
    expect((closed.artifact as CloneContinuumState).state).toBe("closed");
    const reopened = await cloneContinuumProductTech.prepare({ missionId: "m1", currentState: "closed", event: "reopen" }, CTX);
    expect((reopened.artifact as CloneContinuumState).state).toBe("reopened");
    expect((await cloneContinuumProductTech.prepare({}, CTX)).kind).toBe("blocked");
  });

  it("18. CloneTrust : prepare_only/human_only pour le sensible/critique", async () => {
    const sensitive = await cloneTrustProductTech.prepare({ taskType: "draft_email", riskLevel: "sensitive", history: { approvals: 50, rejections: 0 } }, CTX);
    expect((sensitive.artifact as CloneTrustDecision).autonomyLevel).toBe("prepare_only");
    const critical = await cloneTrustProductTech.prepare({ taskType: "case", riskLevel: "critical", history: { approvals: 100, rejections: 0 } }, CTX);
    const d = critical.artifact as CloneTrustDecision;
    expect(d.autonomyLevel).toBe("human_only");
    expect(d.autonomyScore).toBe(0);
    expect(d.criticalAlwaysHumanOnly).toBe(true);
    // Le plafond politique gagne toujours.
    const cappedByPolicy = await cloneTrustProductTech.prepare({ riskLevel: "normal", history: { approvals: 20, rejections: 0 }, policyCap: "suggest" }, CTX);
    expect((cappedByPolicy.artifact as CloneTrustDecision).autonomyLevel).toBe("suggest");
    // Risque inconnu → sensible (fail-closed).
    const unknown = await cloneTrustProductTech.prepare({}, CTX);
    expect((unknown.artifact as CloneTrustDecision).autonomyLevel).toBe("prepare_only");
  });

  it("19. CloneReview : rapport qualité + drapeau revue humaine", async () => {
    const res = await cloneReviewProductTech.prepare({ draft: "Bonjour, tu trouveras le contrat TODO à compléter.", expectedFormality: "vouvoiement" }, CTX);
    expect(res.kind).toBe("needs_validation");
    const report = res.artifact as CloneReviewReport;
    expect(report.toneOk).toBe(false);
    expect(report.issues.some((i) => i.kind === "missing_info")).toBe(true);
    expect(report.humanReviewNeeded).toBe(true);
    expect(report.legalGuarantee).toBe(false);
    expect(report.correctnessGuaranteed).toBe(false);
    expect((await cloneReviewProductTech.prepare({ draft: "" }, CTX)).kind).toBe("blocked");
  });

  it("20. CloneSignals : candidats de déclencheurs, aucun scheduler live", async () => {
    const res = await cloneSignalsProductTech.prepare({
      missionId: "m1", waitingValidationSinceHours: 72, lastReplyAgeHours: 100, deadlineInHours: 24,
      missingDocuments: ["RIB"], missionIdleHours: 200,
    }, CTX);
    const art = res.artifact as CloneSignalsArtifact;
    const kinds = art.candidates.map((c) => c.signalKind);
    expect(kinds).toContain("validation_late");
    expect(kinds).toContain("no_reply");
    expect(kinds).toContain("deadline_approaching");
    expect(kinds).toContain("document_missing");
    expect(kinds).toContain("mission_sleeping");
    expect(art.liveSchedulerUsed).toBe(false);
    expect(art.cronCreated).toBe(false);
    expect(art.notificationSentLive).toBe(false);
  });

  it("21. CloneLearn propose des apprentissages, ne mute JAMAIS CloneADN", async () => {
    const res = await cloneLearnProductTech.prepare({
      events: [
        { type: "correction", detail: "toujours vouvoyer les clients" },
        { type: "correction", detail: "toujours vouvoyer les clients" },
        { type: "correction", detail: "toujours vouvoyer les clients" },
        { type: "refusal", detail: "ne pas envoyer le vendredi soir" },
      ],
    }, CTX);
    const art = res.artifact as CloneLearnArtifact;
    expect(art.adnMutated).toBe(false);
    expect(art.modelTrained).toBe(false);
    expect(art.mutationPolicy).toBe("proposal_only");
    const habit = art.candidates.find((c) => c.classification === "habit");
    const exception = art.candidates.find((c) => c.classification === "exception");
    expect(habit?.occurrences).toBe(3);
    expect(exception?.occurrences).toBe(1);
    expect(art.candidates.every((c) => c.approvalRequired === true)).toBe(true);
  });

  it("22. CloneBrief : synthèse sans invention — préparé n'est jamais « fait »", async () => {
    const res = await cloneBriefProductTech.prepare({
      when: "morning",
      missions: [{ title: "Contrat Alice", state: "prepared" }, { title: "Attestation Bob", state: "done" }],
      blockers: [{ title: "RIB manquant", state: "blocked" }],
      decisionsNeeded: [{ title: "Valider la relance", state: "waiting" }],
    }, CTX);
    const brief = res.artifact as CloneBriefArtifact;
    const missionLines = brief.sections.find((s) => s.heading === "Missions")!.lines;
    expect(missionLines[0]).toContain("PRÉPARÉ (non exécuté)");
    expect(missionLines[1]).toContain("FAIT");
    expect(brief.sections.find((s) => s.heading === "Blocages")!.lines[0]).toContain("RIB manquant");
    expect(brief.onlyProvidedFacts).toBe(true);
    expect(brief.preparedNeverClaimedAsDone).toBe(true);
    expect(brief.blockersHidden).toBe(false);
    expect(brief.inventedFacts).toBe(false);
  });
});

// ── 23–30 : CloneCall Safe Local ───────────────────────────────────────────────

describe("T2 — CloneCall Safe Local", () => {
  const callInput = {
    employeeCalledId: "employe-rh",
    objective: "préparer l'arrivée du nouveau salarié",
    transcriptText: "euh il faut préparer le dossier d'accueil puis planifier la visite médicale et enfin relancer le manager",
    availableEmployees: EMPLOYEES,
  };

  it("23–29. la session d'appel locale produit TOUTE la chaîne (voice→OS→guard→trace→continuum→signals→brief)", async () => {
    const res = await cloneCallProductTech.prepare(callInput, CTX);
    expect(res.kind).toBe("needs_validation"); // 23. session créée
    const s = res.artifact as CloneCallSessionArtifact;
    expect(s.artifactKind).toBe("clonecall_session");
    expect(s.employeeCalledId).toBe("employe-rh");
    expect(s.script.opening).toContain("employé IA");
    expect(s.transcript.source).toBe("text_fallback");
    expect(s.extractedIntents.length).toBeGreaterThanOrEqual(2);   // 24. transcript → intentions
    expect(s.extractedActions.length).toBe(s.extractedIntents.length); // 24. → actions
    expect(s.missionCandidate?.artifactKind).toBe("cloneos_mission_plan"); // 25. candidat mission CloneOS
    expect(s.missionCandidate?.executed).toBe(false);
    expect(s.guardDecision?.artifactKind).toBe("cloneguard_decision");
    expect(s.policyDecision?.artifactKind).toBe("clonepolicy_decision"); // gouvernance complète (round 2)
    expect(s.trustDecision?.artifactKind).toBe("clonetrust_decision");
    expect(s.traceEvent?.artifactKind).toBe("clonetrace_event");   // 26. événement CloneTrace
    expect(s.continuumState?.state).toBe("waiting_for_validation"); // 27. état CloneContinuum
    expect((s.signalCandidates?.candidates.length ?? 0)).toBeGreaterThanOrEqual(1); // 28. candidats CloneSignals
    expect(s.callBrief?.artifactKind).toBe("clonebrief_artifact"); // 29. brief d'appel
    expect(s.voice?.liveVoice).toBe(false);
  });

  it("30. le chemin sortant/live est BLOQUÉ (outbound, numéro, intention live — coercition incluse)", async () => {
    expect((await cloneCallProductTech.prepare({ ...callInput, outbound: true }, CTX)).kind).toBe("blocked");
    expect((await cloneCallProductTech.prepare({ ...callInput, dialNumber: "0612345678" }, CTX)).kind).toBe("blocked");
    expect((await cloneCallProductTech.prepare({ ...callInput, live: true } as never, CTX)).kind).toBe("blocked");
    // Encodages forgés : chaînes/nombres/synonymes ne contournent pas le blocage.
    expect((await cloneCallProductTech.prepare({ ...callInput, outbound: "true" } as never, CTX)).kind).toBe("blocked");
    expect((await cloneCallProductTech.prepare({ ...callInput, outbound: 1 } as never, CTX)).kind).toBe("blocked");
    expect((await cloneCallProductTech.prepare({ ...callInput, dialNumber: 612345678 } as never, CTX)).kind).toBe("blocked");
    expect((await cloneCallProductTech.prepare({ ...callInput, phoneNumber: "0612345678" } as never, CTX)).kind).toBe("blocked");
    expect((await cloneCallProductTech.prepare({ ...callInput, callNow: "yes" } as never, CTX)).kind).toBe("blocked");
    const ok = await cloneCallProductTech.prepare(callInput, CTX);
    const s = ok.artifact as CloneCallSessionArtifact;
    expect(s.outboundLivePathBlocked).toBe(true);
    expect(s.liveCallMade).toBe(false);
    expect(s.audioRecorded).toBe(false);
    expect(s.telephonyProvider).toBe("none");
    expect(cloneCallProductTech.liveBlockedReason).toContain("BLOQUÉS");
    expect((await cloneCallProductTech.prepare({ objective: "x" }, CTX)).kind).toBe("blocked"); // employé requis
  });
});

// ── 31–33 : CloneRoom ──────────────────────────────────────────────────────────

describe("T2 — CloneRoom", () => {
  const roomInput = {
    roomId: "salle-1",
    participants: [
      { id: "humain-1", kind: "human" as const },
      { id: "os", kind: "cloneos" as const },
      { id: "employe-a", kind: "ai_employee" as const },
      { id: "employe-b", kind: "ai_employee" as const },
    ],
    thread: [
      { from: "humain-1", content: "Préparez l'onboarding du nouvel arrivant puis planifiez son entretien d'intégration" },
      { from: "employe-a", to: "employe-b", content: "Contexte du dossier à transmettre" },
    ],
    availableEmployees: EMPLOYEES,
  };

  it("31. crée l'artefact de coordination de salle", async () => {
    const res = await cloneRoomProductTech.prepare(roomInput, CTX);
    expect(res.kind).toBe("needs_validation");
    const r = res.artifact as CloneRoomCoordinationArtifact;
    expect(r.artifactKind).toBe("cloneroom_coordination");
    expect(r.roomId).toBe("salle-1");
    expect(r.participants).toHaveLength(4);
    expect(r.traceEvent?.artifactKind).toBe("clonetrace_event");
    expect(r.guardDecision?.artifactKind).toBe("cloneguard_decision");
    expect(r.policyDecision?.artifactKind).toBe("clonepolicy_decision"); // gouvernance complète (round 2)
    expect(r.trustDecision?.artifactKind).toBe("clonetrust_decision");
  });

  it("32. extrait un candidat de mission du fil", async () => {
    const res = await cloneRoomProductTech.prepare(roomInput, CTX);
    const r = res.artifact as CloneRoomCoordinationArtifact;
    expect(r.missionCandidates.length).toBeGreaterThanOrEqual(1);
    expect(r.missionCandidates[0].tasks.length).toBeGreaterThanOrEqual(2);
    expect(r.missionCandidates[0].executed).toBe(false);
  });

  it("33. route via CloneOS — jamais de pair-à-pair anarchique", async () => {
    const res = await cloneRoomProductTech.prepare(roomInput, CTX);
    const r = res.artifact as CloneRoomCoordinationArtifact;
    expect(r.contextRoutingPlan.allViaCloneOS).toBe(true);
    const aiToAi = r.contextRoutingPlan.routes.find((route) => route.fromParticipantId === "employe-a");
    expect(aiToAi?.via).toBe("cloneos");
    expect(aiToAi?.note).toContain("CloneOS");
    expect(r.peerToPeerBlocked).toBe(true);
    const p2p = await cloneRoomProductTech.prepare({ ...roomInput, allowPeerToPeer: true }, CTX);
    expect(p2p.kind).toBe("blocked");
    expect((await cloneRoomProductTech.prepare({ ...roomInput, allowPeerToPeer: "true" } as never, CTX)).kind).toBe("blocked");
    expect((await cloneRoomProductTech.prepare({ ...roomInput, allowPeerToPeer: 1 } as never, CTX)).kind).toBe("blocked");
    expect((await cloneRoomProductTech.prepare({ participants: [] }, CTX)).kind).toBe("blocked");
  });
});

// ── 34–36 : orchestrateur ──────────────────────────────────────────────────────

describe("T2 — orchestrateur produit", () => {
  it("34. pipeline demande brute : ADN→OS→Policy→Trust→Guard→Review→Trace→Continuum→Signals, tout audité", async () => {
    const orch = createProductTechnologyOrchestrator();
    const run = await orch.runCloneOSRequest(
      { request: "Prépare une attestation de travail puis relance le manager", availableEmployees: EMPLOYEES },
      CTX,
    );
    expect(run.kind).toBe("governed_mission_proposal");
    expect(run.adnProfile?.artifactKind).toBe("cloneadn_profile");
    expect(run.missionPlan?.artifactKind).toBe("cloneos_mission_plan");
    expect(run.policyDecision?.artifactKind).toBe("clonepolicy_decision");
    expect(run.trustDecision?.artifactKind).toBe("clonetrust_decision");
    expect(run.guardDecision?.artifactKind).toBe("cloneguard_decision");
    expect(run.review?.artifactKind).toBe("clonereview_report");
    expect(run.traceEvent?.artifactKind).toBe("clonetrace_event");
    expect(run.continuumState?.state).toBe("waiting_for_validation");
    expect(run.signalCandidates?.candidates.length).toBeGreaterThanOrEqual(1);
    expect(run.executedLive).toBe(false);
    expect(run.humanValidationRequired).toBe(true);
    expect(run.auditEntries.length).toBeGreaterThanOrEqual(9);
    // Cohérence Guard/Policy/Trust sur le critique : jamais contradictoires.
    const critical = await orch.runCloneOSRequest({ request: "Prépare le licenciement de Bob" }, CTX);
    expect(critical.guardDecision?.riskLevel).toBe("critical");
    expect(["require_validation", "refuse"]).toContain(critical.guardDecision?.decision ?? "");
    expect(critical.trustDecision?.autonomyLevel).toBe("human_only");
    expect(critical.missionPlan?.sensitiveHrLanguageDetected).toBe(true);
  });

  it("35. pipeline CloneCall via l'orchestrateur", async () => {
    const orch = createProductTechnologyOrchestrator();
    const run = await orch.runCloneCallSession(
      { employeeCalledId: "employe-rh", objective: "préparer un onboarding", transcriptText: "prépare le dossier puis planifie l'entretien" },
      CTX,
    );
    expect(run.session?.artifactKind).toBe("clonecall_session");
    expect(run.executedLive).toBe(false);
    expect(run.auditEntries.length).toBeGreaterThanOrEqual(1);
  });

  it("36. pipeline CloneRoom via l'orchestrateur (+ brief de salle)", async () => {
    const orch = createProductTechnologyOrchestrator();
    const run = await orch.runCloneRoomThread(
      {
        participants: [{ id: "humain-1", kind: "human" }, { id: "employe-a", kind: "ai_employee" }],
        thread: [{ from: "humain-1", content: "Préparez le document d'accueil" }],
      },
      CTX,
    );
    expect(run.coordination?.artifactKind).toBe("cloneroom_coordination");
    expect(run.roomBrief?.artifactKind).toBe("clonebrief_artifact");
    expect(run.executedLive).toBe(false);
    expect(orch.listProductTechnologies()).toHaveLength(14);
    expect(orch.getProductTechnology("cloneos")?.id).toBe("cloneos");
    expect(orch.getProductTechnology("inconnu")).toBeUndefined();
  });
});

// ── 37–45 : command center + périmètre final ───────────────────────────────────

describe("T2 — command center et périmètre final", () => {
  it("37–41. rapport computé : P16A/P16C prêts, voix non opérationnelle, call safe-local prêt, live providers non prêts", async () => {
    const report = await evaluateProductTechnologyCommandCenter({});
    expect(report.exactBlockers).toEqual([]);
    expect(report.totalProductTechnologies).toBe(14);
    expect(report.readyForP16A).toBe(true);          // 37
    expect(report.readyForP16C).toBe(true);          // 38
    expect(report.clonevoiceOperational).toBe(false); // 39
    expect(report.clonecallSafeLocalReady).toBe(true); // 40
    expect(report.liveProvidersReady).toBe(false);   // 41
    expect(report.cloneosReady).toBe(true);
    expect(report.cloneroomReady).toBe(true);
    expect(report.cloneadnReady).toBe(true);
    expect(report.productionAuthorized).toBe(false);
    expect(["disabled", "test"]).toContain(report.paymentMode);
    expect(report.exactWarnings.length).toBeGreaterThan(0);
    expect(report.entriesInjected).toBe(false);
    // La porte se ferme si une techno manque (entrées injectées — déclaré).
    const withoutCall = listProductTechnologyRegistryEntries().filter((e) => e.id !== "clonecall");
    const closed = await evaluateProductTechnologyCommandCenter({}, withoutCall);
    expect(closed.readyForP16A).toBe(false);
    expect(closed.entriesInjected).toBe(true);
  });

  it("42. aucune fausse revendication commerciale", () => {
    const forbiddenInClaims = [
      "voix live", "téléphonie live", "appel sortant réel", "signature live", "paiement live",
      "stripe live", "production live", "sans validation humaine", "garanti", "autonome sans",
    ];
    for (const e of listProductTechnologyRegistryEntries()) {
      const claim = e.claimableNow.toLowerCase();
      for (const term of forbiddenInClaims) {
        expect(claim, `« ${e.id} » : la revendication permise contient « ${term} »`).not.toContain(term);
      }
      expect(e.mustNotClaim.length).toBeGreaterThan(0);
    }
  });

  it("43. T1 reste intact (15 technos, porte P16C toujours verte)", () => {
    expect(T1_IDS).toHaveLength(15);
    const t1Report = summarizeTechnologyCommandCenter({});
    expect(t1Report.readyForPierreIntegration).toBe(true);
    expect(t1Report.pierreOnlyCount).toBe(0);
  });

  it("44. P16.0 reste intact (master split complet)", () => {
    expect(masterSplitComplete()).toBe(true);
    expect(getTechnologyItems()).toHaveLength(15);
  });

  it("45. le runtime Pierre V1 est intouché par T2 (aucun import — cf. test 4 ; périmètre prouvé dans .t2-proofs)", () => {
    // La preuve d'imports est le test 4 (liste fermée). Ici : la couche est employé-agnostique.
    const orch = createProductTechnologyOrchestrator();
    expect(orch.listProductTechnologies().every((t) => t.safeFallback.length > 0)).toBe(true);
  });

  it("anti-blanchiment T2 : un résultat re-étiqueté vers une techno sans validation est démasqué", async () => {
    const genuine = await cloneOSProductTech.prepare({ request: "Prépare un document" }, CTX);
    for (const target of ["cloneguard", "clonetrace", "clonepolicy"] as const) {
      const laundered = { ...genuine, productTechnologyId: target, kind: "ok", requiresHumanValidation: false } as unknown as ProductTechnologyResult;
      const report = ALL_PRODUCT_TECHNOLOGY_CONTRACTS[target].validate(laundered, CTX);
      expect(report.structurallyValid, `blanchiment vers ${target} non détecté`).toBe(false);
      expect(report.humanValidationRequired).toBe(true);
      expect(report.machineCanAutoApprove).toBe(false);
    }
    const forged = {
      ...genuine,
      artifact: { ...(genuine.artifact as Record<string, unknown>), executed: true },
    } as unknown as ProductTechnologyResult;
    const forgedReport = cloneOSProductTech.validate(forged as never, CTX);
    expect(forgedReport.structurallyValid).toBe(false);
  });

  it("assainissement : aucun secret dans un résultat/audit T2", () => {
    const leaky = productError("clonecall", CTX, "échec sk-proj-Ab12Cd34Ef56Gh78Ij90 postgres://u:S3cret@db/x");
    expect(leaky.errorMessage).toContain("[REDACTED]");
    expect(leaky.errorMessage).not.toContain("S3cret");
    expect(leaky.errorMessage).not.toContain("sk-proj-Ab12");
  });

  it("surfaces gelées : contrats et registre T2 non mutables", () => {
    expect(Object.isFrozen(ALL_PRODUCT_TECHNOLOGY_CONTRACTS)).toBe(true);
    expect(Object.isFrozen(ALL_PRODUCT_TECHNOLOGY_CONTRACTS.cloneos)).toBe(true);
    expect(Object.isFrozen(listProductTechnologyRegistryEntries())).toBe(true);
    expect(() => { (listProductTechnologyRegistryEntries() as unknown as unknown[]).push({}); }).toThrow();
  });
});

// ── Round 2 adversarial — verrous issus de la revue contradictoire (8 lentilles) ──

describe("T2 — round 2 adversarial (verrous)", () => {
  const callInput = { employeeCalledId: "employe-rh", objective: "préparer un onboarding", transcriptText: "prépare le dossier" };

  it("R1. téléphonie : encodages forgés et imbriqués → blocked (backstop couche entière)", async () => {
    for (const forged of [
      { ...callInput, outbound: "oui" }, { ...callInput, outbound: "vrai" },
      { ...callInput, dialNumber: ["0612345678"] }, { ...callInput, phone: "+33612345678" },
      { ...callInput, tel: "0612345678" }, { ...callInput, numero: "0612345678" },
      { ...callInput, callTarget: "+33612345678" },
      { ...callInput, call: { outbound: true } }, { ...callInput, options: { dialNumber: "0612" } },
    ]) {
      const res = await cloneCallProductTech.prepare(forged as never, CTX);
      expect(res.kind, `forme non bloquée : ${JSON.stringify(forged)}`).toBe("blocked");
    }
    // Backstop sur TOUTES les technos produit : une clé téléphonie bloque partout.
    expect((await cloneOSProductTech.prepare({ request: "x", phoneNumber: "06" } as never, CTX)).kind).toBe("blocked");
  });

  it("R2. gouvernance complète sur les pipelines appel/salle : Policy + Trust présents et cohérents", async () => {
    const call = await cloneCallProductTech.prepare(
      { employeeCalledId: "employe-rh", objective: "préparer un licenciement", transcriptText: "prépare le dossier de rupture" },
      CTX,
    );
    const s = call.artifact as CloneCallSessionArtifact;
    expect(s.guardDecision?.riskLevel).toBe("critical");
    expect(s.trustDecision?.autonomyLevel).toBe("human_only"); // le risque Guard plafonne Trust
    expect(s.policyDecision).not.toBeNull();
    const room = await cloneRoomProductTech.prepare(
      {
        participants: [{ id: "h", kind: "human" }],
        thread: [{ from: "h", content: "Préparez la rupture conventionnelle de Jean" }],
        policyRules: [{ ruleId: "cap", appliesTo: {}, autonomyCap: "prepare_only" }],
      },
      CTX,
    );
    const r = room.artifact as CloneRoomCoordinationArtifact;
    expect(r.trustDecision?.autonomyLevel).toBe("human_only");
    expect(r.policyDecision?.autonomyCap).toBe("prepare_only");
  });

  it("R3. CloneGuard : critique multilingue + refus joignable depuis le contenu", async () => {
    const english = await cloneGuardProductTech.prepare(
      { action: { kind: "prepare_case", description: "Fire John immediately and terminate his employment" } }, CTX,
    );
    expect((english.artifact as CloneGuardDecision).riskLevel).toBe("critical");
    const finality = await cloneGuardProductTech.prepare(
      { action: { kind: "prepare_case", description: "Décision finale : licenciement de Jean pour faute grave" } }, CTX,
    );
    expect((finality.artifact as CloneGuardDecision).decision).toBe("refuse");
    // « deliver » n'est plus sur-bloqué comme « live ».
    const deliver = await cloneGuardProductTech.prepare(
      { action: { kind: "deliver_document", description: "préparer une note interne" } }, CTX,
    );
    expect((deliver.artifact as CloneGuardDecision).decision).toBe("allow_prepare");
  });

  it("R4. ClonePolicy : allowlist autoritaire, horaire fail-closed, cap malformé → human_only", async () => {
    const banned = await clonePolicyProductTech.prepare(
      { rules: [{ ruleId: "chan", appliesTo: {}, allowedChannels: ["internal"] }], action: { channel: "signature" } }, CTX,
    );
    expect((banned.artifact as ClonePolicyDecision).decision).toBe("block"); // externe HORS allowlist explicite = bloqué
    const noHour = await clonePolicyProductTech.prepare(
      { rules: [{ ruleId: "time", appliesTo: {}, timeWindow: { notAfterHour: 18 } }], action: { channel: "internal" } }, CTX,
    );
    expect((noHour.artifact as ClonePolicyDecision).requiresValidation).toBe(true); // heure inconnue + règle horaire → validé
    const bogusCap = await clonePolicyProductTech.prepare(
      { rules: [{ ruleId: "cap", appliesTo: {}, autonomyCap: "unlimited" as never }], action: { channel: "internal" } }, CTX,
    );
    expect((bogusCap.artifact as ClonePolicyDecision).autonomyCap).toBe("human_only"); // donnée forgée → fail-closed
  });

  it("R5. CloneTrust : risque/cap hors vocabulaire → fail-closed", async () => {
    const bogusRisk = await cloneTrustProductTech.prepare({ riskLevel: "chill" as never, history: { approvals: 100 } }, CTX);
    expect((bogusRisk.artifact as CloneTrustDecision).autonomyLevel).toBe("prepare_only"); // inconnu → sensible
    const bogusCap = await cloneTrustProductTech.prepare({ riskLevel: "normal", history: { approvals: 100 }, policyCap: "unlimited" as never }, CTX);
    expect((bogusCap.artifact as CloneTrustDecision).autonomyLevel).toBe("human_only");
  });

  it("R6. anti-forge : audioProcessed / peerToPeerBlocked / routes non-CloneOS démasqués", async () => {
    const voice = await cloneVoiceProductTech.prepare({ transcriptText: "prépare un document" }, CTX);
    const forgedVoice = { ...voice, artifact: { ...(voice.artifact as object), audioProcessed: true } } as unknown as ProductTechnologyResult;
    expect(cloneVoiceProductTech.validate(forgedVoice as never, CTX).structurallyValid).toBe(false);

    const room = await cloneRoomProductTech.prepare(
      { participants: [{ id: "h", kind: "human" }], thread: [{ from: "h", content: "Préparez un document" }] }, CTX,
    );
    const roomArtifact = room.artifact as CloneRoomCoordinationArtifact;
    const noBlockFlag = { ...room, artifact: { ...roomArtifact, peerToPeerBlocked: false } } as unknown as ProductTechnologyResult;
    expect(cloneRoomProductTech.validate(noBlockFlag as never, CTX).structurallyValid).toBe(false);
    const directRoute = {
      ...room,
      artifact: { ...roomArtifact, contextRoutingPlan: { allViaCloneOS: true, routes: [{ fromParticipantId: "a", toParticipantId: "b", via: "direct", note: "x" }] } },
    } as unknown as ProductTechnologyResult;
    expect(cloneRoomProductTech.validate(directRoute as never, CTX).structurallyValid).toBe(false);
  });

  it("R7. isolation d'audit par tenant + gouvernance fail-closed dans l'orchestrateur", async () => {
    const orch = createProductTechnologyOrchestrator();
    const ctxA: ProductTechnologyContext = { employeeId: "emp-a", companyId: "company-a" };
    const ctxB: ProductTechnologyContext = { employeeId: "emp-b", companyId: "company-b" };
    const runA = await orch.runCloneOSRequest({ request: "Prépare un document" }, ctxA);
    const runB = await orch.runCloneOSRequest({ request: "Prépare un document" }, ctxB);
    expect(runA.auditEntries.every((e) => e.companyId === "company-a")).toBe(true); // AUCUNE entrée étrangère
    expect(runB.auditEntries.every((e) => e.companyId === "company-b")).toBe(true);
    expect(orch.listAuditEntries("company-a").every((e) => e.companyId === "company-a")).toBe(true);

    // Gouvernance bloquante → le plan n'est PAS livré (la trace en garde la mémoire).
    const blocked = await orch.runCloneOSRequest(
      { request: "Prépare un document", policyRules: [{ ruleId: "only-cockpit", appliesTo: {}, allowedChannels: ["cockpit"] }] },
      ctxA,
    );
    expect(blocked.blockedByGovernance).toBe(true);
    expect(blocked.missionPlan).toBeNull();
    expect(blocked.traceEvent).not.toBeNull();

    // gated reflète Policy aussi (pas seulement Guard).
    const policyGated = await orch.runCloneOSRequest(
      { request: "Prépare un document", policyRules: [{ ruleId: "always-validate", appliesTo: {}, requiresValidation: true }] },
      ctxA,
    );
    expect(policyGated.guardDecision?.decision).toBe("allow_prepare");
    expect(policyGated.gated).toBe(true);
  });

  it("R8. email : le canal aval (external_email) force la validation dès la proposition", async () => {
    const orch = createProductTechnologyOrchestrator();
    const run = await orch.runCloneOSRequest({ request: "Rédige un email de bienvenue au nouveau client" }, CTX);
    expect(run.policyDecision?.requiresValidation).toBe(true); // draft_email → canal aval externe
    expect(run.gated).toBe(true);
  });
});
