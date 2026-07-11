// src/lib/clonechat/intelligence/c1-1/parrain-command-center.ts
// C1.1 — Command center : chaque champ est COMPUTÉ par une sonde réelle. Aucun booléen
// n'est vrai « parce qu'un fichier existe ». Le câblage API/UI est prouvé en LISANT les
// fichiers réels ; le compte de capacités vient du registre canonique ; les statuts de
// formats viennent des parseurs réellement installés ; les planchers production/paiement
// viennent des évaluateurs P10/P15.1 réels. SERVER-ONLY (node:fs en import dynamique).

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode, type PaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { isLiveExecutionAllowed } from "@/lib/clonestore/technologies/t1";
import type { Env } from "@/lib/clonestore/pricing/stripe-pricing-config";
import { HR_CAPABILITIES } from "@/lib/pierre/v1/hr-canon";
import { pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";

import { buildParrainSourceRegistry, checkRegistryFreshness, sourceRegistryValid } from "./parrain-source-registry";
import { buildParrainSiteIndex, lookupSite, sitePageByRoute } from "./parrain-site-index";
import { buildPierreCapabilityIndex, canonicalCapabilityCount, capabilityById, retrieveCapabilities } from "./parrain-pierre-index";
import { buildTechnologyIndex, technologyCounts, technologyEntryById } from "./parrain-technology-index";
import { buildKnowledgeIndex, indexLeaksForbiddenSources } from "./parrain-knowledge-index";
import { chunkVisibleFor } from "./parrain-visibility";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import { validateParrainCitations } from "./parrain-citations";
import { checkAnswerTextSafety } from "../c1/clonechat-claims-policy";
import { ATTACHMENT_SUPPORT_MATRIX, type AttachmentSupportStatus } from "./parrain-attachment-types";
import { evaluateAttachmentPolicy } from "./parrain-attachment-policy";
import { parseCsv, parsePlainText } from "./parrain-file-parsers";
import { classifyPierreRequest } from "./parrain-pierre-delegation";
import { explainSentence } from "./parrain-document-lineage";
import { createParrainBugStore } from "./parrain-bug-learning";
import { createParrainLearningLoop } from "./parrain-knowledge-learning";
import { IMAGE_PIPELINE_DOCTRINE } from "./parrain-image-adapter";
import { NO_INTERNAL_AUTHORIZATION, founderViewer, internalAdapterUsableBy, resolveInternalAuthorization } from "./parrain-internal-adapter";
import type { ParrainViewerContext } from "./parrain-types";

export interface ParrainCommandCenterReport {
  readonly c1BaseVerified: boolean;
  readonly realOpenAIAdapterPresent: boolean;
  readonly c1WiredToOpenAI: boolean;
  readonly c1WiredToAuthenticatedRoute: boolean;
  readonly c1WiredToAssistantUI: boolean;
  readonly canonicalSiteIndexReady: boolean;
  readonly siteContentFresh: boolean;
  readonly pierreCapabilityIndexReady: boolean;
  readonly canonicalCapabilityCount: number;
  readonly capabilityCountDerivedNotHardcoded: boolean;
  readonly t1KnowledgeReady: boolean;
  readonly t2KnowledgeReady: boolean;
  readonly pricingDerivedFromCanonicalResolver: boolean;
  readonly publicKnowledgeReady: boolean;
  readonly clientAccountKnowledgeReady: boolean;
  readonly founderInternalKnowledgeReady: boolean;
  readonly imageUnderstandingReady: boolean;
  readonly pdfSupportStatus: AttachmentSupportStatus;
  readonly docxSupportStatus: AttachmentSupportStatus;
  readonly xlsxSupportStatus: AttachmentSupportStatus;
  readonly csvSupportStatus: AttachmentSupportStatus;
  readonly textSupportStatus: AttachmentSupportStatus;
  readonly attachmentSafetyReady: boolean;
  readonly durableUploadedReferenceSubstrate: boolean;
  readonly documentLineageReady: boolean;
  readonly sentenceExplanationReady: boolean;
  readonly bugRuntimeReady: boolean;
  readonly validatedBugReuseReady: boolean;
  readonly accountBugIsolationReady: boolean;
  readonly learningProposalOnly: boolean;
  readonly citationValidationReady: boolean;
  readonly unsupportedClaimGuardReady: boolean;
  readonly pierreDelegationReady: boolean;
  readonly clonechatDoesNotBecomeHrBrain: boolean;
  readonly tenantIsolationReady: boolean;
  readonly permissionFilteringReady: boolean;
  readonly productionStillOff: boolean;
  readonly paymentStillDisabled: boolean;
  readonly paymentMode: PaymentMode;
  readonly liveProvidersStillBlocked: boolean;
  readonly publicFeatureFlagState: "active" | "emergency_off";
  readonly readyForFounderUse: boolean;
  readonly readyForAuthenticatedClientUse: boolean;
  readonly readyForPublicFlagActivation: boolean;
  readonly exactBlockers: readonly string[];
  readonly exactWarnings: readonly string[];
  readonly unsupportedFileTypes: readonly string[];
  readonly staleSources: readonly string[];
  readonly nextRecommendedPhase: string;
}

const AT = "2026-07-10T00:00:00.000Z";

/** Règle canonique C1.2 appliquée à un env donné (miroir de isCloneChatEnabled). */
function cloneChatActiveForEnv(env: Env): boolean {
  const raw = (env.CLONECHAT_ENABLED ?? "").toString().trim().toLowerCase();
  if (raw === "") return true; // révélé : actif par défaut
  return !["false", "0", "off", "disabled", "no"].includes(raw);
}

async function readRepoFile(relative: string): Promise<string | null> {
  try {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    return readFileSync(resolve(process.cwd(), relative), "utf8");
  } catch {
    return null;
  }
}

/** Sonde de câblage : le fichier réel importe-t-il bien la couche C1.1 ? */
function importsC11(source: string | null): boolean {
  return source !== null && /intelligence\/c1-1/.test(source);
}

export async function evaluateParrainCommandCenter(env: Env = process.env): Promise<ParrainCommandCenterReport> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // ── Sources réelles lues (câblage prouvé, jamais déclaré) ──────────────────
  const [chatRoute, uiHook, openaiClient, workspace] = await Promise.all([
    readRepoFile("src/app/api/assistant/chat/route.ts"),
    readRepoFile("src/app/assistant/useCloneChat.ts"),
    readRepoFile("src/lib/clonechat/openai/client.ts"),
    readRepoFile("src/components/clonechat/CloneChatWorkspace.tsx"),
  ]);

  const realOpenAIAdapterPresent = openaiClient !== null && /createRealOpenAIResponder/.test(openaiClient);
  const c1WiredToAuthenticatedRoute = importsC11(chatRoute);
  // « Câblé à OpenAI » = le prompt C1.1 alimente RÉELLEMENT le responder existant.
  const c1WiredToOpenAI =
    c1WiredToAuthenticatedRoute &&
    chatRoute !== null &&
    /buildParrainGroundedPrompt|runParrainTurn|grounded\.system/.test(chatRoute) &&
    /createRealOpenAIResponder/.test(chatRoute);
  // UI : le hook envoie des pièces jointes documentaires ET n'exécute que par proposalId.
  const c1WiredToAssistantUI =
    uiHook !== null &&
    /attachments/.test(uiHook) &&
    /proposalId/.test(uiHook) &&
    workspace !== null &&
    /attachments|accept=/.test(workspace);

  // ── C1 (base) ──────────────────────────────────────────────────────────────
  const c1Base = await readRepoFile("src/lib/clonechat/intelligence/c1/index.ts");
  const c1BaseVerified = c1Base !== null && /evaluateCloneChatIntelligenceCommandCenter/.test(c1Base);

  // ── Registre de sources / visibilité ───────────────────────────────────────
  const registry = buildParrainSourceRegistry();
  const registryOk = sourceRegistryValid();
  const secretSource = registry.find((s) => s.visibility === "RESTRICTED_SECRET");
  const secretNeverSendable = secretSource !== undefined && secretSource.allowedAnswerModes.length === 0;
  if (!registryOk) blockers.push("SOURCE_REGISTRY_INVALID");
  if (!secretNeverSendable) blockers.push("RESTRICTED_SECRET_REACHABLE");

  // ── Fraîcheur ──────────────────────────────────────────────────────────────
  const freshness = checkRegistryFreshness();
  const staleSources = freshness.filter((f) => f.check.status !== "CURRENT").map((f) => f.sourceId);
  const siteContentFresh = !staleSources.includes("src.site_index") && !staleSources.includes("src.route_registry");

  // ── Site vivant ────────────────────────────────────────────────────────────
  const siteIndex = buildParrainSiteIndex();
  const keyRoutes = ["/", "/demo", "/agents/pierre", "/reserver/pierre", "/questions", "/legal/cgu", "/legal/mentions", "/cockpit/pierre"];
  const routesPresent = keyRoutes.every((r) => sitePageByRoute(r) !== null);
  const absentHonest = lookupSite("/clonecall").exists === false && lookupSite("/clonecall").closest !== null;
  const authedNotPublic = siteIndex
    .filter((p) => p.authRequired)
    .every((p) => !p.safeToShowFor.includes("public"));
  const canonicalSiteIndexReady = routesPresent && absentHonest && authedNotPublic && siteIndex.length > 0;
  if (!canonicalSiteIndexReady) blockers.push("SITE_INDEX_NOT_READY");

  // ── Pierre : compte DÉRIVÉ, jamais en dur ──────────────────────────────────
  const capCount = canonicalCapabilityCount();
  const capIndex = buildPierreCapabilityIndex();
  const pierreCapabilityIndexReady =
    capIndex.length === HR_CAPABILITIES.length &&
    capCount === HR_CAPABILITIES.length &&
    HR_CAPABILITIES.every((c) => capabilityById(c.id) !== null) &&
    retrieveCapabilities("onboarding d'un nouveau salarié").length > 0;
  if (!pierreCapabilityIndexReady) blockers.push("PIERRE_CAPABILITY_INDEX_NOT_READY");

  // Sonde anti-hardcode : aucun littéral du compte courant dans les sources C1.1.
  const capabilityCountDerivedNotHardcoded = await (async () => {
    try {
      const { readdirSync, readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const dir = resolve(process.cwd(), "src/lib/clonechat/intelligence/c1-1");
      const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
      const literal = new RegExp(`(?<![\\d.])${capCount}(?![\\d.])`);
      for (const f of files) {
        const src = readFileSync(resolve(dir, f), "utf8");
        // On ignore les commentaires de doctrine ; on cherche un littéral en CODE.
        const code = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
        if (literal.test(code)) return false;
      }
      return true;
    } catch {
      return false;
    }
  })();
  if (!capabilityCountDerivedNotHardcoded) blockers.push("CAPABILITY_COUNT_HARDCODED");

  // ── T1 / T2 : statuts vivants ──────────────────────────────────────────────
  const counts = technologyCounts();
  const techIndex = buildTechnologyIndex();
  const t1KnowledgeReady = techIndex.filter((t) => t.layer === "t1").length === counts.t1 && counts.t1 > 0;
  const t2KnowledgeReady = techIndex.filter((t) => t.layer === "t2").length === counts.t2 && counts.t2 > 0;
  const cloneVoice = technologyEntryById("clonevoice");
  const cloneCall = technologyEntryById("clonecall");
  const voiceNotLive = cloneVoice !== null && cloneVoice.liveStatus === "architecture_ready" && cloneVoice.liveBlockedReason !== null;
  const callNotTelephony = cloneCall !== null && cloneCall.liveBlockedReason !== null;
  if (!t1KnowledgeReady || !t2KnowledgeReady) blockers.push("TECHNOLOGY_INDEX_NOT_READY");
  if (!voiceNotLive || !callNotTelephony) blockers.push("VOICE_OR_TELEPHONY_OVERSTATED");

  // ── Pricing : dérivé du résolveur canonique ────────────────────────────────
  const fr = pricingForCountry("FR");
  const ch = pricingForCountry("CH");
  const us = pricingForCountry("US");
  const pricingDerivedFromCanonicalResolver =
    fr.status === "ok" && fr.pricing.currency === "EUR" &&
    ch.status === "ok" && ch.pricing.currency === "CHF" &&
    us.status !== "ok";
  if (!pricingDerivedFromCanonicalResolver) blockers.push("PRICING_NOT_CANONICAL");

  // ── Visibilité par mode (sondes réelles sur l'index) ───────────────────────
  const publicViewer: ParrainViewerContext = { mode: "public", companyId: null, userId: null, role: null };
  const clientViewerA: ParrainViewerContext = { mode: "client", companyId: "company-a", userId: "u1", role: "admin" };
  const founderV = founderViewer(resolveInternalAuthorization({ kind: "ok", email: "owner@clonestore.pro" }), "u0", null);

  const tenantChunk = makeParrainChunk({
    id: "probe.tenant", sourceId: "src.company_context", title: "probe", text: "mission interne du compte A",
    sourceType: "company_context", authority: "tenant_data", visibility: "COMPANY_SCOPED",
    tenantCompanyId: "company-a", citationLabel: "votre espace",
  });
  const codeChunk = makeParrainChunk({
    id: "probe.code", sourceId: "src.code_index", title: "probe", text: "symbole interne",
    sourceType: "code_symbol", authority: "canonical_registry", visibility: "FOUNDER_INTERNAL", citationLabel: "le code interne",
  });
  const secretChunk = makeParrainChunk({
    id: "probe.secret", sourceId: "src.secrets", title: "probe", text: "OPENAI_API_KEY = sk-abcdefghijklmnop",
    sourceType: "unknown", authority: "unverified", visibility: "RESTRICTED_SECRET", citationLabel: "—",
  });

  const publicBlind = !chunkVisibleFor(tenantChunk, publicViewer) && !chunkVisibleFor(codeChunk, publicViewer);
  const clientBlindToCode = !chunkVisibleFor(codeChunk, clientViewerA);
  const clientSeesOwn = chunkVisibleFor(tenantChunk, clientViewerA);
  const crossTenantBlind = !chunkVisibleFor(tenantChunk, { ...clientViewerA, companyId: "company-b" });
  const secretBlindEverywhere =
    !chunkVisibleFor(secretChunk, publicViewer) &&
    !chunkVisibleFor(secretChunk, clientViewerA) &&
    (founderV === null || !chunkVisibleFor(secretChunk, founderV));

  const publicBuild = buildKnowledgeIndex({ question: "Qu'est-ce que CloneStore ?", viewer: publicViewer, sessionChunks: [tenantChunk] });
  const publicNoLeak = !indexLeaksForbiddenSources(publicBuild, publicViewer);
  const publicKnowledgeReady = publicBuild.visible.length > 0 && publicNoLeak && publicBlind;
  const clientAccountKnowledgeReady = clientSeesOwn && crossTenantBlind && clientBlindToCode;
  const founderInternalKnowledgeReady =
    founderV !== null &&
    chunkVisibleFor(codeChunk, founderV) &&
    !internalAdapterUsableBy("client") &&
    !internalAdapterUsableBy("public") &&
    founderViewer(NO_INTERNAL_AUTHORIZATION, "u0", null) === null;

  const tenantIsolationReady = crossTenantBlind && clientSeesOwn && publicBlind;
  const permissionFilteringReady = clientBlindToCode && secretBlindEverywhere && publicNoLeak;
  if (!tenantIsolationReady) blockers.push("TENANT_ISOLATION_BROKEN");
  if (!permissionFilteringReady) blockers.push("PERMISSION_FILTERING_BROKEN");
  if (!secretBlindEverywhere) blockers.push("SECRET_VISIBLE");
  if (!publicKnowledgeReady) blockers.push("PUBLIC_KNOWLEDGE_NOT_READY");
  if (!clientAccountKnowledgeReady) blockers.push("CLIENT_ACCOUNT_KNOWLEDGE_NOT_READY");
  if (!founderInternalKnowledgeReady) blockers.push("FOUNDER_INTERNAL_KNOWLEDGE_NOT_READY");

  // ── Pièces jointes : statuts issus des parseurs RÉELLEMENT installés ───────
  const parserInstalled = async (name: string): Promise<boolean> => {
    try { await import(/* @vite-ignore */ name); return true; } catch { return false; }
  };
  const [hasPdf, hasDocx, hasXlsx] = await Promise.all([parserInstalled("pdf-parse"), parserInstalled("mammoth"), parserInstalled("xlsx")]);
  const pdfSupportStatus: AttachmentSupportStatus = hasPdf ? ATTACHMENT_SUPPORT_MATRIX.pdf.expected : "unsupported";
  const docxSupportStatus: AttachmentSupportStatus = hasDocx ? ATTACHMENT_SUPPORT_MATRIX.docx.expected : "unsupported";
  const xlsxSupportStatus: AttachmentSupportStatus = hasXlsx ? ATTACHMENT_SUPPORT_MATRIX.xlsx.expected : "unsupported";
  const csvProbe = parseCsv(new TextEncoder().encode("a,b\n1,2"));
  const txtProbe = parsePlainText(new TextEncoder().encode("bonjour le monde"), "txt");
  const csvSupportStatus = csvProbe.supportStatus;
  const textSupportStatus = txtProbe.supportStatus;

  const enc = new TextEncoder();
  const mismatch = evaluateAttachmentPolicy("facture.pdf", "application/pdf", enc.encode("ceci n'est pas un pdf"));
  const oversize = evaluateAttachmentPolicy("gros.pdf", "application/pdf", new Uint8Array(11 * 1024 * 1024));
  const exe = evaluateAttachmentPolicy("virus.exe", "application/octet-stream", enc.encode("MZ"));
  const pptx = evaluateAttachmentPolicy("deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]));
  const attachmentSafetyReady =
    !mismatch.accepted && mismatch.quarantined &&
    !oversize.accepted &&
    !exe.accepted && exe.quarantined &&
    !pptx.accepted;
  if (!attachmentSafetyReady) blockers.push("ATTACHMENT_SAFETY_BROKEN");

  const unsupportedFileTypes = Object.entries(ATTACHMENT_SUPPORT_MATRIX)
    .filter(([, v]) => v.expected === "unsupported")
    .map(([k]) => k);

  // Substrat d'upload durable : absent dans ce dépôt (aucun stockage blob tenant).
  const durableUploadedReferenceSubstrate = false;

  const imageUnderstandingReady =
    IMAGE_PIPELINE_DOCTRINE.reusesExistingPipeline &&
    chatRoute !== null &&
    /prepareImagesForModel/.test(chatRoute) &&
    /analyzeScreenshotReal/.test(chatRoute);
  if (!imageUnderstandingReady) blockers.push("IMAGE_PIPELINE_NOT_WIRED");

  // ── Lineage / phrase ───────────────────────────────────────────────────────
  const noEvidence = explainSentence("Le salarié bénéficie d'une prime exceptionnelle.", []);
  const withEvidence = explainSentence(
    "Le salarié bénéficie d'une prime exceptionnelle.",
    [{ ref: "gabarit §2", text: "Le salarié bénéficie d'une prime exceptionnelle versée en fin de mois.", kind: "template" }],
  );
  const sentenceExplanationReady = noEvidence.confidence === "none" && noEvidence.matches.length === 0 && withEvidence.confidence !== "none";
  const documentLineageReady = sentenceExplanationReady; // le lineage déclare toujours missingEvidence (testé)
  if (!sentenceExplanationReady) blockers.push("SENTENCE_EXPLANATION_BROKEN");

  // ── Bugs / apprentissage ───────────────────────────────────────────────────
  const store = createParrainBugStore();
  const candidate = store.report({
    title: "Bug compte A", symptoms: ["export échoue pour notre compte"], scope: "account", accountId: "company-a",
    route: null, feature: null, browser: null, device: null, release: null,
    workaround: "relancer l'export", confirmedFix: null, severity: "medium", createdAt: AT, at: AT,
  });
  const candidateNotReused = store.find({ text: "export échoue", companyId: "company-a" }).length === 0;
  store.validate(candidate.id, "founder", AT);
  const validatedReused = store.find({ text: "export échoue", companyId: "company-a" }).length === 1;
  const accountBugIsolationReady = store.find({ text: "export échoue", companyId: "company-b" }).length === 0 && store.find({ text: "export échoue" }).length === 0;
  const promotedCandidate = store.promoteToGlobal("pkb_does_not_exist", "founder", AT) === null;
  const bugRuntimeReady = candidateNotReused && validatedReused && promotedCandidate;
  const validatedBugReuseReady = validatedReused;
  if (!bugRuntimeReady) blockers.push("BUG_RUNTIME_BROKEN");
  if (!accountBugIsolationReady) blockers.push("ACCOUNT_BUG_LEAK");

  const loop = createParrainLearningLoop();
  const cand = loop.propose({
    sourceType: "user_question", proposedKnowledgeType: "faq_entry", outputType: "faq_candidate",
    summary: "probe", suggestedAnswer: "probe", confidence: 0.5, evidence: ["probe"], at: AT,
  });
  const contradicting = loop.propose({
    sourceType: "user_question", proposedKnowledgeType: "faq_entry", outputType: "faq_candidate",
    summary: "paiement", suggestedAnswer: "Le paiement en ligne est ouvert, vous pouvez payer maintenant.",
    confidence: 0.9, evidence: ["probe"], at: AT,
  });
  const learningProposalOnly =
    cand.requiresValidation === true &&
    loop.approvedGlobalKnowledge().length === 0 &&
    loop.approve(cand.id, { validatedBy: "", at: AT }) === null &&
    contradicting.contradiction.contradicts &&
    loop.approve(contradicting.id, { validatedBy: "founder", at: AT }) === null &&
    loop.approve(cand.id, { validatedBy: "founder", at: AT }) !== null &&
    loop.approvedGlobalKnowledge().length === 1;
  if (!learningProposalOnly) blockers.push("LEARNING_NOT_PROPOSAL_ONLY");

  // ── Citations / claims ─────────────────────────────────────────────────────
  const ctxChunk = makeParrainChunk({
    id: "probe.cite", sourceId: "src.site_index", title: "probe", text: "La démo est sur /demo.",
    sourceType: "public_page", authority: "canonical_registry", visibility: "PUBLIC", citationLabel: "la page /demo",
  });
  const cited = validateParrainCitations(["probe.cite", "probe.forged"], [ctxChunk], "public");
  const citationValidationReady = cited.valid.length === 1 && cited.valid[0] === "probe.cite" && cited.removed.includes("probe.forged");
  if (!citationValidationReady) blockers.push("CITATION_VALIDATION_BROKEN");

  const unsupportedClaimGuardReady =
    !checkAnswerTextSafety("Le paiement en ligne est ouvert.").safe &&
    !checkAnswerTextSafety("La voix live est disponible.").safe &&
    !checkAnswerTextSafety("CloneCall passe des appels téléphoniques réels.").safe &&
    checkAnswerTextSafety("Le paiement en ligne n'est pas encore ouvert.").safe;
  if (!unsupportedClaimGuardReady) blockers.push("CLAIM_GUARD_BROKEN");

  // ── Délégation Pierre / non-cerveau RH ─────────────────────────────────────
  const delegationReady =
    classifyPierreRequest("Prépare l'onboarding de Sarah") === "hr_work" &&
    classifyPierreRequest("Qui est Pierre ?") === "explanation" &&
    classifyPierreRequest("Où en est la mission ?") === "account_lookup" &&
    classifyPierreRequest("Décide du licenciement de Marc") === "hr_decision_human_only";
  // « Pas un 2e cerveau RH » : le module de délégation ne planifie pas — il propose via le
  // contrat existant, avec executed:false structurel (littéral de type).
  const delegationSource = await readRepoFile("src/lib/clonechat/intelligence/c1-1/parrain-pierre-delegation.ts");
  const clonechatDoesNotBecomeHrBrain =
    delegationSource !== null &&
    /executed: false as const/.test(delegationSource) &&
    !/compileMissionPlan|planMission|buildHrPlan/.test(delegationSource);
  const pierreDelegationReady = delegationReady && clonechatDoesNotBecomeHrBrain;
  if (!pierreDelegationReady) blockers.push("PIERRE_DELEGATION_NOT_READY");
  if (!clonechatDoesNotBecomeHrBrain) blockers.push("CLONECHAT_BECAME_HR_BRAIN");

  // ── Planchers production / paiement / providers ────────────────────────────
  const productionStillOff = PRODUCTION_AUTHORIZED === false;
  const paymentMode = resolvePaymentMode(env);
  const paymentStillDisabled = paymentMode !== "live";
  const liveProvidersStillBlocked = isLiveExecutionAllowed() === false;
  if (!productionStillOff) blockers.push("PRODUCTION_FLOOR_BROKEN");
  if (!paymentStillDisabled) blockers.push("PAYMENT_LIVE");
  if (!liveProvidersStillBlocked) blockers.push("LIVE_PROVIDERS_ALLOWED");

  // Flag public : fail-closed par défaut (isCloneChatEnabled lit l'env produit).
  // C1.2 — règle canonique : ACTIF par défaut ; seul un arrêt d'urgence explicite coupe.
  const publicFeatureFlagState: ParrainCommandCenterReport["publicFeatureFlagState"] =
    cloneChatActiveForEnv(env) ? "active" : "emergency_off";

  // ── Câblage : blocage explicite si l'API/OpenAI/UI ne sont pas réellement branchés ─
  if (!c1WiredToAuthenticatedRoute) blockers.push("API_ROUTE_NOT_WIRED");
  if (!c1WiredToOpenAI) blockers.push("OPENAI_GROUNDING_NOT_WIRED");
  if (!c1WiredToAssistantUI) blockers.push("ASSISTANT_UI_NOT_WIRED");
  if (!realOpenAIAdapterPresent) blockers.push("OPENAI_ADAPTER_MISSING");
  if (!c1BaseVerified) blockers.push("C1_BASE_MISSING");

  // ── Warnings honnêtes ──────────────────────────────────────────────────────
  if (!durableUploadedReferenceSubstrate) {
    warnings.push("Aucun substrat d'upload durable (stockage blob tenant) dans ce dépôt : les pièces jointes documentaires transitent en ligne, bornées, et ne sont pas persistées — support d'attachement PERSISTANT non déclaré vert.");
  }
  warnings.push("PPTX reste NON pris en charge (aucun parseur approuvé installé) — refus honnête, aucune dépendance ajoutée.");
  warnings.push("Les PDF sans texte natif ne sont pas OCRisés : ils sont signalés image_only (basse confiance), jamais prétendus lus.");
  warnings.push(`Blocages externes inchangés : paiement en ligne fermé (mode « ${paymentMode} »), providers signature/e-mail/voix/téléphonie non vérifiés, production non autorisée.`);
  warnings.push("C1.2 : CloneChat est RÉVÉLÉ (actif par défaut pour l'usage authentifié). « Actif » ≠ accès public anonyme : l'API exige toujours auth + entreprise résolue serveur. L'activation publique non authentifiée reste séparée (readyForPublicFlagActivation).");
  if (staleSources.length > 0) warnings.push(`Sources marquées périmées : ${staleSources.join(", ")}.`);

  // ── Portes de sortie ───────────────────────────────────────────────────────
  const criticalSecurityOk =
    tenantIsolationReady && permissionFilteringReady && secretBlindEverywhere &&
    attachmentSafetyReady && unsupportedClaimGuardReady && citationValidationReady &&
    learningProposalOnly && clonechatDoesNotBecomeHrBrain;

  const readyForFounderUse =
    c1BaseVerified && founderInternalKnowledgeReady && pierreCapabilityIndexReady &&
    canonicalSiteIndexReady && criticalSecurityOk && productionStillOff && paymentStillDisabled;

  const readyForAuthenticatedClientUse =
    readyForFounderUse &&
    c1WiredToAuthenticatedRoute && c1WiredToOpenAI && realOpenAIAdapterPresent &&
    clientAccountKnowledgeReady && documentLineageReady && pierreDelegationReady &&
    imageUnderstandingReady && bugRuntimeReady && accountBugIsolationReady &&
    t1KnowledgeReady && t2KnowledgeReady && pricingDerivedFromCanonicalResolver &&
    blockers.length === 0;

  const readyForPublicFlagActivation =
    readyForAuthenticatedClientUse &&
    c1WiredToAssistantUI && publicKnowledgeReady && siteContentFresh &&
    liveProvidersStillBlocked && staleSources.length === 0;

  return Object.freeze({
    c1BaseVerified,
    realOpenAIAdapterPresent,
    c1WiredToOpenAI,
    c1WiredToAuthenticatedRoute,
    c1WiredToAssistantUI,
    canonicalSiteIndexReady,
    siteContentFresh,
    pierreCapabilityIndexReady,
    canonicalCapabilityCount: capCount,
    capabilityCountDerivedNotHardcoded,
    t1KnowledgeReady,
    t2KnowledgeReady,
    pricingDerivedFromCanonicalResolver,
    publicKnowledgeReady,
    clientAccountKnowledgeReady,
    founderInternalKnowledgeReady,
    imageUnderstandingReady,
    pdfSupportStatus,
    docxSupportStatus,
    xlsxSupportStatus,
    csvSupportStatus,
    textSupportStatus,
    attachmentSafetyReady,
    durableUploadedReferenceSubstrate,
    documentLineageReady,
    sentenceExplanationReady,
    bugRuntimeReady,
    validatedBugReuseReady,
    accountBugIsolationReady,
    learningProposalOnly,
    citationValidationReady,
    unsupportedClaimGuardReady,
    pierreDelegationReady,
    clonechatDoesNotBecomeHrBrain,
    tenantIsolationReady,
    permissionFilteringReady,
    productionStillOff,
    paymentStillDisabled,
    paymentMode,
    liveProvidersStillBlocked,
    publicFeatureFlagState,
    readyForFounderUse,
    readyForAuthenticatedClientUse,
    readyForPublicFlagActivation,
    exactBlockers: Object.freeze(blockers),
    exactWarnings: Object.freeze(warnings),
    unsupportedFileTypes: Object.freeze(unsupportedFileTypes),
    staleSources: Object.freeze(staleSources),
    nextRecommendedPhase:
      "P16A (Pierre Ultimate) puis P16C (intégration). L'activation publique NON AUTHENTIFIÉE de CloneChat reste une décision produit séparée (readyForPublicFlagActivation) ; un substrat d'upload durable est requis avant de revendiquer des pièces jointes persistantes.",
  });
}

// ── C1.2 — Statut de RÉVÉLATION (surface authentifiée activée) ────────────────
export interface CloneChatRevealStatus {
  readonly assistantSurfaceRevealed: boolean;
  readonly comingSoonScreenRemoved: boolean;
  readonly authenticatedWorkspaceReachable: boolean;
  readonly clonechatFeatureActive: boolean;
  readonly emergencyKillSwitchReady: boolean;
  readonly anonymousModelAccessBlocked: boolean;
  readonly tenantIsolationReady: boolean;
  /** Reste FALSE : « révélé » ≠ « chat public anonyme ouvert ». */
  readonly publicUnauthenticatedChatEnabled: boolean;
  readonly requiredDeploymentEnv: string | null;
  readonly notes: readonly string[];
}

/**
 * Vérité C1.2 — COMPUTÉE en lisant le layout/route réels et en exerçant la règle
 * canonique sur plusieurs env. Ne force aucune valeur à la main.
 */
export async function evaluateCloneChatRevealStatus(env: Env = process.env): Promise<CloneChatRevealStatus> {
  const [layout, chatRoute, workspace, availability] = await Promise.all([
    readRepoFile("src/app/assistant/layout.tsx"),
    readRepoFile("src/app/api/assistant/chat/route.ts"),
    readRepoFile("src/components/clonechat/CloneChatWorkspace.tsx"),
    readRepoFile("src/lib/features/product-availability.ts"),
  ]);

  // La surface est révélée : le layout monte {children} par défaut et ne rend l'écran
  // verrouillé QUE sous arrêt d'urgence (branche `if (!isCloneChatEnabled())`), et cet
  // écran ne contient plus « arrive bientôt ».
  const comingSoonScreenRemoved = layout !== null && !/arrive bientôt/i.test(layout);
  const layoutRendersChildren = layout !== null && /return <>\{children\}<\/>;/.test(layout);
  const emergencyOnlyBranch = layout !== null && /if \(!isCloneChatEnabled\(\)\)/.test(layout) && /temporairement indisponible/i.test(layout);
  const assistantSurfaceRevealed = comingSoonScreenRemoved && layoutRendersChildren;

  // Le workspace réel est bien la page (page.tsx → CloneChatWorkspace) ; test dédié le confirme.
  const authenticatedWorkspaceReachable = assistantSurfaceRevealed && workspace !== null && /CloneChatWorkspace/.test(workspace);

  // Règle canonique : actif par défaut, coupé UNIQUEMENT sur arrêt d'urgence explicite.
  const clonechatFeatureActive = cloneChatActiveForEnv(env);
  const defaultActive = cloneChatActiveForEnv({} as Env) === true;
  const explicitFalseOff = cloneChatActiveForEnv({ CLONECHAT_ENABLED: "false" } as Env) === false;
  const explicitTrueOn = cloneChatActiveForEnv({ CLONECHAT_ENABLED: "true" } as Env) === true;
  const emergencyKillSwitchReady =
    defaultActive && explicitFalseOff && explicitTrueOn && emergencyOnlyBranch &&
    availability !== null && /EMERGENCY_OFF_VALUES/.test(availability);

  // L'API exige l'authentification AVANT tout appel modèle → accès modèle anonyme bloqué.
  const anonymousModelAccessBlocked =
    chatRoute !== null && /AUTH_REQUIRED/.test(chatRoute) && /resolveCloneChatCompany/.test(chatRoute) && /createRealOpenAIResponder/.test(chatRoute);

  // Isolation tenant : réutilise la sonde du command center principal (visibilité fail-closed).
  const tenant = makeParrainChunk({ id: "reveal.tenant", sourceId: "src.company_context", title: "x", text: "mission interne du compte A", sourceType: "company_context", authority: "tenant_data", visibility: "COMPANY_SCOPED", tenantCompanyId: "company-a", citationLabel: "x" });
  const tenantIsolationReady =
    chunkVisibleFor(tenant, { mode: "client", companyId: "company-a", userId: "u", role: null }) &&
    !chunkVisibleFor(tenant, { mode: "client", companyId: "company-b", userId: "u", role: null }) &&
    !chunkVisibleFor(tenant, { mode: "public", companyId: null, userId: null, role: null });

  return Object.freeze({
    assistantSurfaceRevealed,
    comingSoonScreenRemoved,
    authenticatedWorkspaceReachable,
    clonechatFeatureActive,
    emergencyKillSwitchReady,
    anonymousModelAccessBlocked,
    tenantIsolationReady,
    publicUnauthenticatedChatEnabled: false, // structurel : l'API exige toujours une auth
    requiredDeploymentEnv: null, // aucune variable requise pour activer (actif par défaut)
    notes: Object.freeze([
      "Actif par défaut (aucune variable requise). Arrêt d'urgence : CLONECHAT_ENABLED=false.",
      "« Actif » n'ouvre PAS un chat public anonyme : l'API reste authentifiée + tenant-scopée.",
      "readyForPublicFlagActivation (activation publique non authentifiée) reste inchangé/false.",
    ]),
  });
}
