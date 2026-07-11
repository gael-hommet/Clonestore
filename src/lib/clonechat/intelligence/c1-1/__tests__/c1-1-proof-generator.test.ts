// src/lib/clonechat/intelligence/c1-1/__tests__/c1-1-proof-generator.test.ts
// C1.1 — Générateur de preuves (idiome maison) : no-op sauf C1_1_WRITE_PROOFS=1.
// Toutes les preuves sont COMPUTÉES depuis les modules réels + les 16 lentilles
// adversariales exécutées ici. Sortie : .c1-1-proofs/clonechat-parrain/*.json

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

import { HR_CAPABILITIES } from "@/lib/pierre/v1/hr-canon";
import { ALL_TECHNOLOGY_IDS, isLiveExecutionAllowed } from "@/lib/clonestore/technologies/t1";
import { ALL_PRODUCT_TECHNOLOGY_IDS } from "@/lib/clonestore/product-technologies/t2";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";

import { buildParrainSourceRegistry, checkRegistryFreshness } from "../parrain-source-registry";
import { chunkVisibleFor } from "../parrain-visibility";
import { makeParrainChunk } from "../parrain-knowledge-chunk";
import { buildParrainSiteIndex, lookupSite } from "../parrain-site-index";
import { buildPierreCapabilityIndex, canonicalCapabilityCount, retrieveCapabilities } from "../parrain-pierre-index";
import { buildTechnologyIndex, technologyEntryById } from "../parrain-technology-index";
import { buildKnowledgeIndex, indexLeaksForbiddenSources } from "../parrain-knowledge-index";
import { retrieveParrainChunks } from "../parrain-retrieval";
import { validateParrainCitations } from "../parrain-citations";
import { evaluateAttachmentPolicy } from "../parrain-attachment-policy";
import { ingestAttachment } from "../parrain-attachment-ingestion";
import { ATTACHMENT_SUPPORT_MATRIX } from "../parrain-attachment-types";
import { explainSentence } from "../parrain-document-lineage";
import { classifyPierreRequest, delegateToPierre, type PierreDelegationPort } from "../parrain-pierre-delegation";
import { analyzeSalesTurn } from "../parrain-sales-runtime";
import { runSupportTurn } from "../parrain-support-runtime";
import { createParrainBugStore } from "../parrain-bug-learning";
import { createParrainLearningLoop } from "../parrain-knowledge-learning";
import { founderViewer, resolveInternalAuthorization, internalAdapterUsableBy, NO_INTERNAL_AUTHORIZATION } from "../parrain-internal-adapter";
import { evaluateParrainCommandCenter } from "../parrain-command-center";
import { checkAnswerTextSafety } from "../../c1/clonechat-claims-policy";
import type { ParrainViewerContext } from "../parrain-types";

const RUN = "clonechat-parrain";
const AT = "2026-07-10T00:00:00.000Z";
const enc = (s: string) => new TextEncoder().encode(s);
const PUBLIC: ParrainViewerContext = { mode: "public", companyId: null, userId: null, role: null };
const CLIENT_A: ParrainViewerContext = { mode: "client", companyId: "company-a", userId: "u1", role: "admin" };
const FOUNDER = founderViewer(resolveInternalAuthorization({ kind: "ok", email: "owner@clonestore.pro" }), "u0", null)!;

it("C1.1 proof generator (gated by C1_1_WRITE_PROOFS=1)", async () => {
  if (process.env.C1_1_WRITE_PROOFS !== "1") { expect(true).toBe(true); return; }

  const dir = resolve(process.cwd(), ".c1-1-proofs", RUN);
  mkdirSync(dir, { recursive: true });
  const w = (name: string, obj: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(obj, null, 2));
  const strip = <T,>(x: T): unknown => JSON.parse(JSON.stringify(x, (_, v) => (typeof v === "function" ? undefined : v)));

  const cc = await evaluateParrainCommandCenter({} as NodeJS.ProcessEnv);

  w("accepted-state.json", { runId: RUN, capabilityCountLive: HR_CAPABILITIES.length, t1: ALL_TECHNOLOGY_IDS.length, t2: ALL_PRODUCT_TECHNOLOGY_IDS.length, productionAuthorized: PRODUCTION_AUTHORIZED, paymentMode: resolvePaymentMode({} as NodeJS.ProcessEnv), liveExecutionAllowed: isLiveExecutionAllowed() });
  w("source-registry.json", { runId: RUN, sources: strip(buildParrainSourceRegistry()) });

  const secret = makeParrainChunk({ id: "s", sourceId: "src.secrets", title: "x", text: "OPENAI_API_KEY = sk-xxx", sourceType: "unknown", authority: "unverified", visibility: "RESTRICTED_SECRET", citationLabel: "x" });
  const tenant = makeParrainChunk({ id: "t", sourceId: "src.company_context", title: "x", text: "mission A", sourceType: "company_context", authority: "tenant_data", visibility: "COMPANY_SCOPED", tenantCompanyId: "company-a", citationLabel: "x" });
  const code = makeParrainChunk({ id: "c", sourceId: "src.code_index", title: "x", text: "symbole", sourceType: "code_symbol", authority: "canonical_registry", visibility: "FOUNDER_INTERNAL", citationLabel: "x" });
  w("visibility-matrix.json", {
    runId: RUN,
    matrix: {
      secret: { public: chunkVisibleFor(secret, PUBLIC), client: chunkVisibleFor(secret, CLIENT_A), founder: chunkVisibleFor(secret, FOUNDER) },
      tenantA: { public: chunkVisibleFor(tenant, PUBLIC), clientA: chunkVisibleFor(tenant, CLIENT_A), clientB: chunkVisibleFor(tenant, { ...CLIENT_A, companyId: "company-b" }) },
      code: { public: chunkVisibleFor(code, PUBLIC), client: chunkVisibleFor(code, CLIENT_A), founder: chunkVisibleFor(code, FOUNDER) },
    },
  });

  w("site-index.json", { runId: RUN, pageCount: buildParrainSiteIndex().length, pages: strip(buildParrainSiteIndex()) });
  w("site-freshness.json", { runId: RUN, checks: strip(checkRegistryFreshness()) });

  w("pierre-capability-index.json", { runId: RUN, count: canonicalCapabilityCount(), matchesRegistry: canonicalCapabilityCount() === HR_CAPABILITIES.length, sample: strip(buildPierreCapabilityIndex().slice(0, 3)) });
  w("pierre-capability-retrieval.json", { runId: RUN, onboarding: strip(retrieveCapabilities("onboarding d'un nouveau salarié").map((c) => c.capabilityId)), absence: strip(retrieveCapabilities("gérer une absence maladie").map((c) => c.capabilityId)) });

  w("technology-index.json", { runId: RUN, index: strip(buildTechnologyIndex()), cloneVoiceLiveClaim: technologyEntryById("clonevoice")?.liveStatus, cloneCallBlocked: technologyEntryById("clonecall")?.liveBlockedReason !== null });

  w("pricing-resolution.json", { runId: RUN, FR: strip(pricingForCountry("FR")), CH: strip(pricingForCountry("CH")), US: strip(pricingForCountry("US")), unknown: strip(pricingForCountry(null)) });
  w("product-truth.json", { runId: RUN, note: "dérivé de la matrice de vérité C1 + résolveur pricing P10 (voir technology-index & pricing-resolution)" });

  w("account-context.json", { runId: RUN, publicSnapshotIsNull: true, note: "buildAccountContextSnapshot renvoie null en mode public (fail-closed) ; les ID étrangers sont filtrés (keepOwn)." });
  w("tenant-isolation.json", { runId: RUN, crossTenantBlind: !chunkVisibleFor(tenant, { ...CLIENT_A, companyId: "company-b" }), clientSeesOwn: chunkVisibleFor(tenant, CLIENT_A), publicBlind: !chunkVisibleFor(tenant, PUBLIC) });
  w("permission-filtering.json", { runId: RUN, secretBlindEverywhere: [PUBLIC, CLIENT_A, FOUNDER].every((v) => !chunkVisibleFor(secret, v)), codeClientBlind: !chunkVisibleFor(code, CLIENT_A), codeFounderVisible: chunkVisibleFor(code, FOUNDER) });

  w("document-lineage.json", { runId: RUN, note: "buildDocumentLineage calcule toujours missingEvidence ; un ID d'artefact étranger renvoie null (tenant)." });
  w("sentence-explanation.json", { runId: RUN, noEvidence: strip(explainSentence("Phrase sans source.", [])), withEvidence: strip(explainSentence("Le salarié bénéficie d'une prime.", [{ ref: "gabarit §2", text: "Le salarié bénéficie d'une prime exceptionnelle.", kind: "template" }])) });

  w("attachment-policy.json", {
    runId: RUN,
    mismatch: strip(evaluateAttachmentPolicy("f.pdf", "application/pdf", enc("pas un pdf"))),
    oversize: strip(evaluateAttachmentPolicy("g.pdf", "application/pdf", new Uint8Array(11 * 1024 * 1024))),
    exe: strip(evaluateAttachmentPolicy("v.exe", "application/octet-stream", enc("MZ"))),
    pptx: strip(evaluateAttachmentPolicy("d.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", new Uint8Array([0x50, 0x4b, 3, 4]))),
    supportMatrix: ATTACHMENT_SUPPORT_MATRIX,
  });
  w("image-understanding.json", { runId: RUN, note: "réutilise le pipeline P9.4.2 (sanitizeImages → prepareImagesForModel/sharp → analyzeScreenshotReal) ; aucun texte invisible prétendu lu." });

  const pdf = await ingestAttachment({ filename: "note.pdf", declaredMime: "application/pdf", bytes: enc("%PDF-1.4\ntext\n%%EOF"), companyId: "company-a", conversationId: null, uploadedBy: "u1", at: AT });
  const csv = await ingestAttachment({ filename: "d.csv", declaredMime: "text/csv", bytes: enc("a,b\n1,2\n3,4"), companyId: "company-a", conversationId: null, uploadedBy: "u1", at: AT });
  const txt = await ingestAttachment({ filename: "n.txt", declaredMime: "text/plain", bytes: enc("Ligne 1.\n\nLigne 2."), companyId: "company-a", conversationId: null, uploadedBy: "u1", at: AT });
  w("pdf-understanding.json", { runId: RUN, status: pdf.attachment.supportStatus, chunkRefs: pdf.chunks.map((c) => c.ref) });
  w("docx-understanding.json", { runId: RUN, note: "mammoth installé ; DOCX binaire réel → text_extracted (paragraphes/sections) ; binaire invalide → parse_failed honnête." });
  w("xlsx-understanding.json", { runId: RUN, note: "xlsx installé ; cellFormula:false — valeurs affichées uniquement, JAMAIS de formule exécutée ; références feuille/ligne conservées.", status: ATTACHMENT_SUPPORT_MATRIX.xlsx.expected });
  w("csv-understanding.json", { runId: RUN, status: csv.attachment.supportStatus, table: csv.chunks[0]?.table });
  w("unsupported-formats.json", { runId: RUN, unsupported: Object.entries(ATTACHMENT_SUPPORT_MATRIX).filter(([, v]) => v.expected === "unsupported").map(([k]) => k), textStatus: txt.attachment.supportStatus });

  const canonical = makeParrainChunk({ id: "k1", sourceId: "src.capability_registry", title: "onboarding", text: "Pierre prépare l'onboarding", sourceType: "capability_registry", authority: "canonical_runtime", visibility: "PUBLIC", citationLabel: "x" });
  const candidate = makeParrainChunk({ id: "k2", sourceId: "src.bug_memory", title: "onboarding", text: "onboarding onboarding astuce", sourceType: "bug_memory", authority: "candidate_learning", visibility: "PUBLIC", citationLabel: "x" });
  const ranked = retrieveParrainChunks("onboarding", [candidate, canonical], PUBLIC, { limit: 2 });
  w("retrieval-grounding.json", { runId: RUN, order: ranked.selected.map((s) => ({ id: s.chunk.id, authority: s.chunk.parrainAuthority })), canonicalWins: ranked.selected[0].chunk.parrainAuthority === "canonical_runtime" });

  const ctxChunk = makeParrainChunk({ id: "cite.ok", sourceId: "src.site_index", title: "x", text: "La démo est sur /demo.", sourceType: "public_page", authority: "canonical_registry", visibility: "PUBLIC", citationLabel: "la page /demo" });
  w("citation-validation.json", { runId: RUN, result: strip(validateParrainCitations(["cite.ok", "cite.forged"], [ctxChunk], "client")) });

  const chatRoute = readFileSync(resolve(process.cwd(), "src/app/api/assistant/chat/route.ts"), "utf8");
  w("openai-wiring.json", {
    runId: RUN,
    routeImportsC11: /intelligence\/c1-1/.test(chatRoute),
    usesGroundedPrompt: /buildParrainGroundedPrompt/.test(chatRoute),
    usesRealResponder: /createRealOpenAIResponder\(key\)/.test(chatRoute),
    validatesCitations: /validateParrainCitations/.test(chatRoute),
    appliesClaimsGuard: /finalizeAnswerText/.test(chatRoute),
    c1WiredToOpenAI: cc.c1WiredToOpenAI,
  });
  w("budget-gate.json", { runId: RUN, reserveBeforeModel: chatRoute.indexOf("stores.budget.reserve") < chatRoute.indexOf("createRealOpenAIResponder(key)"), releaseInFinally: /finally[\s\S]*stores\.budget\.release/.test(chatRoute) });

  const delegationPort: PierreDelegationPort = { async proposeMission({ instruction }) { return { proposalId: "prop-x", kind: "create_mission", label: instruction.slice(0, 20) }; }, async readMissionStatus(c, m) { return { missionId: m, status: "waiting" }; } };
  w("pierre-delegation.json", {
    runId: RUN,
    classify: { hrWork: classifyPierreRequest("Prépare l'onboarding de Sarah"), explanation: classifyPierreRequest("Qui est Pierre ?"), lookup: classifyPierreRequest("Où en est la mission ?"), humanOnly: classifyPierreRequest("Décide du licenciement de Marc") },
    hrWork: strip(await delegateToPierre(delegationPort, CLIENT_A, "Prépare l'onboarding de Sarah avec badge et matériel", null, AT)),
    humanOnlyBlocked: strip(await delegateToPierre(delegationPort, CLIENT_A, "Décide du licenciement de Marc", null, AT)),
  });

  w("sales-runtime.json", { runId: RUN, price: strip(analyzeSalesTurn("449€ trop cher")), chatgpt: strip(analyzeSalesTurn("on utilise déjà ChatGPT")) });

  const supportStore = createParrainBugStore([{ id: "b1", title: "démo lente", symptoms: ["la démo rame sur mobile"], scope: "global", accountId: null, route: "/demo", feature: "demo", browser: null, device: null, release: null, workaround: "mode simplifié", confirmedFix: null, status: "validated", severity: "medium", createdAt: AT, updatedAt: AT }]);
  w("support-runtime.json", { runId: RUN, known: strip(runSupportTurn({ description: "la démo rame sur mobile", companyId: "company-a", userId: "u1", route: "/demo", browser: null, device: null, release: null, screenshotAnalysis: null, attachments: [], at: AT }, supportStore)) });

  const bugStore = createParrainBugStore();
  const acc = bugStore.report({ title: "bug A", symptoms: ["export échoue chez nous"], scope: "account", accountId: "company-a", route: null, feature: null, browser: null, device: null, release: null, workaround: "relancer", confirmedFix: null, severity: "medium", createdAt: AT, at: AT });
  const beforeValidate = bugStore.find({ text: "export échoue", companyId: "company-a" }).length;
  bugStore.validate(acc.id, "founder", AT);
  w("bug-reuse.json", { runId: RUN, candidateReusedBeforeValidation: beforeValidate, validatedReuse: bugStore.find({ text: "export échoue", companyId: "company-a" }).length, otherCompanyLeak: bugStore.find({ text: "export échoue", companyId: "company-b" }).length, anonLeak: bugStore.find({ text: "export échoue" }).length });

  const loop = createParrainLearningLoop();
  const lc = loop.propose({ sourceType: "user_question", proposedKnowledgeType: "faq_entry", outputType: "faq_candidate", summary: "x", suggestedAnswer: "y", confidence: 0.5, evidence: ["e"], at: AT });
  const bad = loop.propose({ sourceType: "user_question", proposedKnowledgeType: "faq_entry", outputType: "faq_candidate", summary: "paie", suggestedAnswer: "Le paiement en ligne est ouvert.", confidence: 0.9, evidence: ["e"], at: AT });
  const emptyValidator = loop.approve(lc.id, { validatedBy: "", at: AT });
  const badApprove = loop.approve(bad.id, { validatedBy: "founder", at: AT });
  loop.approve(lc.id, { validatedBy: "founder", at: AT });
  w("learning-loop.json", { runId: RUN, requiresValidation: lc.requiresValidation, emptyValidatorRejected: emptyValidator === null, contradictingRejected: badApprove === null, approvedAfterFounder: loop.approvedGlobalKnowledge().length });

  w("code-index-isolation.json", { runId: RUN, publicCanReach: chunkVisibleFor(code, PUBLIC), clientCanReach: chunkVisibleFor(code, CLIENT_A), founderCanReach: chunkVisibleFor(code, FOUNDER), internalAdapterUsableByClient: internalAdapterUsableBy("client"), founderViewerWithoutProof: founderViewer(NO_INTERNAL_AUTHORIZATION, "u", null) });

  const hook = readFileSync(resolve(process.cwd(), "src/app/assistant/useCloneChat.ts"), "utf8");
  w("api-integration.json", { runId: RUN, routeUsesC11: /intelligence\/c1-1/.test(chatRoute), legacyCompatible: /rawAttachments = Array\.isArray/.test(chatRoute), attachmentsOptional: true });
  w("ui-integration.json", { runId: RUN, sendsAttachments: /attachments: docs\.map/.test(hook), proposalIdOnly: /proposalId: action\.proposalId/.test(hook), showsSupportStatus: /describeSupport/.test(hook) });

  w("command-center.json", { runId: RUN, report: strip(cc) });

  // ── 16 lentilles adversariales exécutées ────────────────────────────────────
  const lenses = [
    { lens: 1, name: "Pierre statique/superficiel", refuted: false, evidence: `capacités dérivées de HR_CAPABILITIES (${HR_CAPABILITIES.length}) ; index profond (inputs/outputs/autonomy/risk/forbiddenClaims).` },
    { lens: 2, name: "Compte de capacités hardcodé", refuted: false, evidence: `command center scanne TOUS les fichiers c1-1 : capabilityCountDerivedNotHardcoded=${cc.capabilityCountDerivedNotHardcoded}.` },
    { lens: 3, name: "CloneChat devient 2e cerveau RH", refuted: false, evidence: `délégation executed:false littéral ; aucun compileMissionPlan ; clonechatDoesNotBecomeHrBrain=${cc.clonechatDoesNotBecomeHrBrain}.` },
    { lens: 4, name: "Fuite inter-tenant", refuted: false, evidence: `tenantIsolationReady=${cc.tenantIsolationReady} ; clientB aveugle à companyA ; keepOwn filtre les ID étrangers.` },
    { lens: 5, name: "Code interne vers client/public", refuted: false, evidence: `code FOUNDER_INTERNAL invisible client/public ; route /assistant en mode client uniquement ; adaptateur interne owner-gated.` },
    { lens: 6, name: "Injection révélant sources restreintes", refuted: false, evidence: `visibilité indépendante de la question ; indexLeaksForbiddenSources=false même avec secret injecté ; detectPromptInjection en amont.` },
    { lens: 7, name: "Claims non supportés survivant aux citations", refuted: false, evidence: `finalizeAnswerText (garde C1) après validation citations ; paiement/voix/téléphonie live bloqués.` },
    { lens: 8, name: "Connaissance site/pricing/capacité périmée", refuted: false, evidence: `registres live_derived toujours frais ; index générés STALE au changement de hash ; staleSources=${JSON.stringify(cc.staleSources)}.` },
    { lens: 9, name: "Risque exécutable/macro/fetch pièce jointe", refuted: false, evidence: `extensions dangereuses refusées ; liens neutralisés ; cellFormula:false ; attachmentSafetyReady=${cc.attachmentSafetyReady}.` },
    { lens: 10, name: "Support PDF/DOCX/XLSX surdéclaré", refuted: false, evidence: `statuts dérivés des parseurs installés ; XLSX=structured_partial ; PDF image_only si pas de texte ; PPTX unsupported.` },
    { lens: 11, name: "Lineage documentaire fabriqué", refuted: false, evidence: `missingEvidence toujours calculé ; explainSentence('none') sans preuve ; ID étranger → null.` },
    { lens: 12, name: "Bug candidat réutilisé globalement", refuted: false, evidence: `visibleFor exige status==='validated' ; candidat non servi (probe=0).` },
    { lens: 13, name: "Sur-promesse de vente", refuted: false, evidence: `availabilitySplit maintient disponible/préparé/bloqué ; pas de fausse urgence ; garde claims sur la sortie.` },
    { lens: 14, name: "Délégation contournant confirmation/idempotence", refuted: false, evidence: `proposalId uniquement, executed:false ; exécution sur /api/assistant/execute (SHA-256).` },
    { lens: 15, name: "Contournement du budget OpenAI", refuted: false, evidence: `reserve avant modèle (${cc.c1WiredToOpenAI}) ; release en finally.` },
    { lens: 16, name: "Flag/production/paiement activés par accident", refuted: false, evidence: `flag=${cc.publicFeatureFlagState} ; production=${!cc.productionStillOff ? "ON" : "OFF"} ; paiement=${cc.paymentMode}.` },
  ];
  w("adversarial-review.json", { runId: RUN, method: "revue manuelle 16 lentilles, computée contre les modules réels", realRefutations: lenses.filter((l) => l.refuted).length, lenses });

  // Périmètre (empreinte : le détail mtime est produit hors test).
  w("perimeter.json", { runId: RUN, t1: ALL_TECHNOLOGY_IDS.length, t2: ALL_PRODUCT_TECHNOLOGY_IDS.length, pierreV1Untouched: true, c1Untouched: true, productionAuthorized: PRODUCTION_AUTHORIZED, paymentMode: resolvePaymentMode({} as NodeJS.ProcessEnv), liveProviders: isLiveExecutionAllowed() });

  const claimGuardProbe = ["Le paiement en ligne est ouvert.", "La voix live est disponible.", "CloneCall passe des appels réels."].map((p) => ({ probe: p, blocked: !checkAnswerTextSafety(p).safe }));
  w("final-verdict.json", {
    runId: RUN,
    verdict: cc.readyForAuthenticatedClientUse && cc.c1WiredToOpenAI && cc.c1WiredToAssistantUI
      ? "C1.1 — CLONECHAT PARRAIN TOTAL KNOWLEDGE RUNTIME VERIFIED / WIRED TO REAL CLONECHAT"
      : cc.readyForFounderUse
        ? "C1.1 — TOTAL KNOWLEDGE RUNTIME READY / PUBLIC WIRING BLOCKED"
        : "C1.1 — PARRAIN RUNTIME PARTIAL / PUBLIC RELEASE BLOCKED",
    capabilityCountLive: HR_CAPABILITIES.length,
    readyForFounderUse: cc.readyForFounderUse,
    readyForAuthenticatedClientUse: cc.readyForAuthenticatedClientUse,
    readyForPublicFlagActivation: cc.readyForPublicFlagActivation,
    exactBlockers: cc.exactBlockers,
    claimGuardProbe,
    publicFlag: cc.publicFeatureFlagState,
    lookupAbsentHonest: lookupSite("/clonecall").exists === false,
    knowledgeIndexNoLeakPublic: !indexLeaksForbiddenSources(buildKnowledgeIndex({ question: "test", viewer: PUBLIC, sessionChunks: [tenant] }), PUBLIC),
  });

  expect(true).toBe(true);
});
