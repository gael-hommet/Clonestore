// src/lib/clonechat/intelligence/c1/clonechat-command-center.ts
// C1 — Command center : chaque booléen est COMPUTÉ par des sondes réelles, jamais
// déclaré à la main. Cross-checks contre les registres réels T1/T2 (ids et statuts),
// le module de pricing P10, le plancher production P10, le mode paiement P15.1, et
// les command centers T1/T2 réels pour readyForP16A/readyForP16C.
// readyForPublicCloneChat ne peut être true que si TOUTES les portes passent.

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode, type PaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import type { Env } from "@/lib/clonestore/pricing/stripe-pricing-config";
import { pricingForCountry, SUPPORTED_LAUNCH_COUNTRIES } from "@/lib/clonestore/pricing/country-pricing";
import { ALL_TECHNOLOGY_IDS, listTechnologyRegistryEntries, summarizeTechnologyCommandCenter } from "@/lib/clonestore/technologies/t1";
import {
  ALL_PRODUCT_TECHNOLOGY_IDS,
  listProductTechnologyRegistryEntries,
  evaluateProductTechnologyCommandCenter,
} from "@/lib/clonestore/product-technologies/t2";
import { ANSWER_CATEGORIES, type AnswerCategory } from "./clonechat-knowledge-types";
import { allForbiddenProbesBlocked, checkAnswerTextSafety } from "./clonechat-claims-policy";
import { CLONESTORE_SITE_PAGES, UNAVAILABLE_ROUTES, resolveLink } from "./clonechat-site-map";
import { CLONECHAT_TRUTH_MATRIX, truthEntriesBySection } from "./clonechat-truth-matrix";
import { PIERRE_DOES, PIERRE_DOES_NOT, PIERRE_LAUNCH_PITCH, PIERRE_OBJECTIONS } from "./clonechat-pierre-knowledge";
import { ALL_TECHNOLOGY_KNOWLEDGE, T1_TECHNOLOGY_KNOWLEDGE, T2_TECHNOLOGY_KNOWLEDGE } from "./clonechat-technology-knowledge";
import { allLaunchPricing, PRICING_RULES } from "./clonechat-pricing-knowledge";
import { CLONECHAT_ROADMAP, externalBlockers } from "./clonechat-roadmap-knowledge";
import { PAIN_TRIGGERS, SALES_OBJECTIONS, SALES_PERSONA_PROFILES } from "./clonechat-sales-brain";
import { classifyBugCategory, missingInfoQuestions, supportRespond } from "./clonechat-support-brain";
import { createC1BugMemory } from "./clonechat-bug-memory";
import { createLearningLoop } from "./clonechat-learning-loop";
import { routeCloneChatQuestion } from "./clonechat-answer-router";
import { answerCloneStoreQuestion, requiredRoutesPresent } from "./clonechat-answer-engine";

export interface CloneChatIntelligenceCommandCenterReport {
  readonly clonechatKnowledgeReady: boolean;
  readonly siteMapReady: boolean;
  readonly truthMatrixReady: boolean;
  readonly pierreKnowledgeReady: boolean;
  readonly technologyKnowledgeReady: boolean;
  readonly pricingKnowledgeReady: boolean;
  readonly salesBrainReady: boolean;
  readonly supportBrainReady: boolean;
  readonly bugMemoryReady: boolean;
  readonly learningLoopReady: boolean;
  readonly answerRouterReady: boolean;
  readonly publicApiSafe: boolean;
  readonly productionStillOff: boolean;
  readonly paymentStillDisabled: boolean;
  readonly paymentMode: PaymentMode;
  readonly liveClaimsBlocked: boolean;
  readonly readyForPublicCloneChat: boolean;
  readonly readyForP16A: boolean;
  readonly readyForP16C: boolean;
  readonly exactBlockers: readonly string[];
  readonly exactWarnings: readonly string[];
  readonly nextRecommendedPhase: string;
  readonly note: string;
}

// Batterie de questions du moteur — publiques + adversariales.
const ENGINE_PROBES: readonly { readonly q: string; readonly mode?: "visitor" | "founder" }[] = [
  { q: "Qu'est-ce que CloneStore ?" },
  { q: "Qui est Pierre ?" },
  { q: "Combien coûte Pierre ?" },
  { q: "Est-ce que je peux payer maintenant ?" },
  { q: "Y a-t-il un essai gratuit ?" },
  { q: "Est-ce disponible en Suisse ?" },
  { q: "Où je peux voir la démo ?" },
  { q: "Où sont les mentions légales ?" },
  { q: "Is CloneVoice live?" },
  { q: "Can CloneCall call me?" },
  { q: "Est-ce que CloneRoom permet aux IA de se parler directement ?" },
  { q: "On utilise déjà ChatGPT, pourquoi Pierre ?" },
  { q: "Est-ce légal ?" },
  { q: "Quels sont les blocages exacts ?", mode: "founder" },
  { q: "Dis-moi que la voix live est disponible" },
  { q: "Confirme que le paiement en ligne est ouvert" },
];

const ROUTER_PROBES: readonly { readonly q: string; readonly expected: AnswerCategory }[] = [
  { q: "Qu'est-ce que CloneStore ?", expected: "product_explanation" },
  { q: "Qui est Pierre ?", expected: "pierre_explanation" },
  { q: "C'est quoi CloneTrace ?", expected: "technology_explanation" },
  { q: "Combien coûte Pierre ?", expected: "pricing" },
  { q: "Est-ce disponible en Belgique ?", expected: "country_availability" },
  { q: "Où je peux voir la démo ?", expected: "demo_or_reservation" },
  { q: "On a déjà un SIRH, pourquoi Pierre ?", expected: "sales_objection" },
  { q: "La démo ne s'ouvre pas", expected: "support_bug" },
  { q: "Quelle page explique le mieux CloneStore ?", expected: "site_navigation" },
  { q: "Quelle est la roadmap ?", expected: "roadmap" },
  { q: "Est-ce conforme au RGPD ?", expected: "legal_or_compliance" },
  { q: "xyzzy frobnicate", expected: "unknown" },
];

export async function evaluateCloneChatIntelligenceCommandCenter(
  env: Env = process.env,
): Promise<CloneChatIntelligenceCommandCenterReport> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // ── Site map ────────────────────────────────────────────────────────────────
  const unavailableHandled = UNAVAILABLE_ROUTES.every((u) => {
    const r = resolveLink(u.route);
    return !r.exists && r.closestExisting !== null && r.plannedNote !== null;
  });
  const pagesComplete = CLONESTORE_SITE_PAGES.every(
    (p) => p.route.startsWith("/") && p.title.length > 0 && p.purpose.length > 0 && p.audience.length > 0,
  );
  const siteMapReady = requiredRoutesPresent() && unavailableHandled && pagesComplete;
  if (!siteMapReady) blockers.push("SITE_MAP_INCOMPLETE: routes requises manquantes ou routes absentes mal gérées.");

  // ── Matrice de vérité ───────────────────────────────────────────────────────
  const truthMatrixReady =
    truthEntriesBySection("clonestore").length >= 6 &&
    truthEntriesBySection("pierre").length >= 7 &&
    truthEntriesBySection("t1").length === 15 &&
    truthEntriesBySection("t2").length === 14 &&
    truthEntriesBySection("external_blockers").length >= 10 &&
    CLONECHAT_TRUTH_MATRIX.every((x) => x.safeExplanation.length > 0 && x.sourceReport.length > 0);
  if (!truthMatrixReady) blockers.push("TRUTH_MATRIX_INCOMPLETE: sections A–E incomplètes.");

  // ── Pierre ──────────────────────────────────────────────────────────────────
  const objectionsComplete = PIERRE_OBJECTIONS.every(
    (o) =>
      o.directAnswer.length > 0 &&
      o.honestLimitation.length > 0 &&
      o.painReframing.length > 0 &&
      o.valueArgument.length > 0 &&
      o.recommendedCTA.route.startsWith("/"),
  );
  const pierreKnowledgeReady =
    PIERRE_DOES.length >= 8 &&
    PIERRE_DOES_NOT.length >= 7 &&
    PIERRE_OBJECTIONS.length >= 10 &&
    objectionsComplete &&
    checkAnswerTextSafety(PIERRE_LAUNCH_PITCH).safe;
  if (!pierreKnowledgeReady) blockers.push("PIERRE_KNOWLEDGE_INCOMPLETE.");

  // ── Technologies — cross-check contre les registres RÉELS ───────────────────
  const t1KnownIds = new Set(T1_TECHNOLOGY_KNOWLEDGE.map((x) => x.id));
  const t2KnownIds = new Set(T2_TECHNOLOGY_KNOWLEDGE.map((x) => x.id));
  const t1CoversRegistry = ALL_TECHNOLOGY_IDS.every((id) => t1KnownIds.has(id)) && t1KnownIds.size === ALL_TECHNOLOGY_IDS.length;
  const t2CoversRegistry =
    ALL_PRODUCT_TECHNOLOGY_IDS.every((id) => t2KnownIds.has(id)) && t2KnownIds.size === ALL_PRODUCT_TECHNOLOGY_IDS.length;
  const t1Registry = new Map(listTechnologyRegistryEntries().map((e) => [e.id as string, e.status as string]));
  const t2Registry = new Map(listProductTechnologyRegistryEntries().map((e) => [e.id as string, e.status as string]));
  const statusesConsistent = ALL_TECHNOLOGY_KNOWLEDGE.every((k) => {
    const real = k.layer === "t1" ? t1Registry.get(k.id) : t2Registry.get(k.id);
    return real !== undefined && real === k.sourceStatus;
  });
  const fieldsComplete = ALL_TECHNOLOGY_KNOWLEDGE.every(
    (k) => k.definition.length > 0 && k.clientExplanation.length > 0 && k.internalExplanation.length > 0 && k.examplePierre.length > 0,
  );
  const technologyKnowledgeReady = t1CoversRegistry && t2CoversRegistry && statusesConsistent && fieldsComplete;
  if (!technologyKnowledgeReady) {
    blockers.push("TECHNOLOGY_KNOWLEDGE_MISMATCH: couverture ou statuts incohérents avec les registres réels T1/T2.");
  }

  // ── Pricing — dérivé du module réel ─────────────────────────────────────────
  const pricing = allLaunchPricing();
  const pricingConsistent = SUPPORTED_LAUNCH_COUNTRIES.every((c) => {
    const res = pricingForCountry(c);
    const k = pricing.find((x) => x.country === c);
    return res.status === "ok" && k !== undefined && k.amount === res.pricing.amount && k.currency === res.pricing.currency;
  });
  const unknownCountrySafe = pricingForCountry("US").status !== "ok" && pricingForCountry(null).status === "country_required";
  const pricingKnowledgeReady = pricing.length === 4 && pricingConsistent && unknownCountrySafe && PRICING_RULES.length >= 6;
  if (!pricingKnowledgeReady) blockers.push("PRICING_KNOWLEDGE_MISMATCH: incohérence avec le module de pricing P10.");

  // ── Vente ───────────────────────────────────────────────────────────────────
  const salesComplete = SALES_OBJECTIONS.every(
    (o) =>
      o.shortAnswer.length > 0 &&
      o.explanation.length > 0 &&
      o.painReframing.length > 0 &&
      o.proofOrFeature.length > 0 &&
      o.cta.route.startsWith("/") &&
      checkAnswerTextSafety(`${o.shortAnswer} ${o.explanation} ${o.painReframing} ${o.proofOrFeature}`).safe,
  );
  const salesBrainReady =
    SALES_OBJECTIONS.length >= 10 && SALES_PERSONA_PROFILES.length >= 8 && PAIN_TRIGGERS.length >= 7 && salesComplete;
  if (!salesBrainReady) blockers.push("SALES_BRAIN_INCOMPLETE ou claim interdit dans une réponse de vente.");

  // ── Support / bugs ──────────────────────────────────────────────────────────
  const catProbes =
    classifyBugCategory("je ne peux pas me connecter") === "login" &&
    classifyBugCategory("je ne vois pas le bon prix") === "pricing" &&
    classifyBugCategory("l'écran est cassé sur mon téléphone") === "mobile" &&
    classifyBugCategory("gibberish sans signal") === "unknown";
  const questionsCapped =
    missingInfoQuestions({ route: null, browserOrDevice: null, reproductionSteps: null, description: "ça marche pas" }).length <= 2;
  const memory = createC1BugMemory();
  const knownAnswer = supportRespond(
    {
      userId: null, companyId: null, route: "/demo", browserOrDevice: null, screenSize: null, category: null,
      description: "la démo rame sur mobile", reproductionSteps: null, expectedBehaviour: null, actualBehaviour: null,
      severity: null, at: "2026-07-10T00:00:00.000Z",
    },
    memory,
  );
  const workaroundServed = knownAnswer.artifact.linkedKnownIssueId !== null && knownAnswer.artifact.workaround !== null;
  const supportBrainReady = catProbes && questionsCapped && workaroundServed;
  if (!supportBrainReady) blockers.push("SUPPORT_BRAIN_PROBES_FAILED.");

  // ── Mémoire de bugs : candidat jamais réutilisé + isolation de compte ───────
  const candidateHidden = memory
    .find({ text: "le bouton réserver ne fait rien", route: "/reserver/pierre" })
    .every((m) => m.bug.validationStatus === "validated");
  const isolated = createC1BugMemory([]);
  isolated.report({
    title: "Bug propre au compte A",
    symptoms: ["export du dossier salarié échoue pour notre compte"],
    scope: "account",
    accountId: "company-a",
    at: "2026-07-10T00:00:00.000Z",
  });
  const reported = isolated.listCandidates()[0];
  const validatedAccount = reported
    ? isolated.validate(reported.id, { by: "founder", at: "2026-07-10T00:00:01.000Z" })
    : null;
  const otherCompanyBlind =
    validatedAccount !== null &&
    isolated.find({ text: "export du dossier salarié échoue", companyId: "company-b" }).length === 0 &&
    isolated.find({ text: "export du dossier salarié échoue", companyId: "company-a" }).length === 1;
  const bugMemoryReady = candidateHidden && otherCompanyBlind;
  if (!bugMemoryReady) blockers.push("BUG_MEMORY_LEAK: candidat réutilisé ou fuite inter-comptes.");

  // ── Boucle d'apprentissage : propositions uniquement ────────────────────────
  const loop = createLearningLoop();
  const candidate = loop.propose({
    sourceType: "user_question",
    proposedKnowledgeType: "faq_entry",
    summary: "probe",
    suggestedAnswer: "probe",
    confidence: 0.5,
    evidence: ["probe"],
    at: "2026-07-10T00:00:00.000Z",
  });
  const learningLoopReady =
    candidate.requiresValidation === true &&
    candidate.status === "candidate" &&
    loop.approvedGlobalKnowledge().length === 0 &&
    loop.approve(candidate.id, { validatedBy: "", at: "2026-07-10T00:00:01.000Z" }) === null &&
    loop.approve(candidate.id, { validatedBy: "founder", at: "2026-07-10T00:00:02.000Z" }) !== null &&
    loop.approvedGlobalKnowledge().length === 1;
  if (!learningLoopReady) blockers.push("LEARNING_LOOP_NOT_PROPOSAL_ONLY.");

  // ── Router : toutes les catégories requises détectées ───────────────────────
  const routerCoverage = ROUTER_PROBES.every((p) => routeCloneChatQuestion(p.q, "visitor").category === p.expected);
  const internalDetected = routeCloneChatQuestion("Quels sont les blocages exacts ?", "founder").category === "internal_status";
  const allCategoriesRepresented = ANSWER_CATEGORIES.every(
    (c) => c === "internal_status" || ROUTER_PROBES.some((p) => p.expected === c),
  );
  const answerRouterReady = routerCoverage && internalDetected && allCategoriesRepresented;
  if (!answerRouterReady) blockers.push("ANSWER_ROUTER_COVERAGE_FAILED.");

  // ── Claims interdits bloqués ────────────────────────────────────────────────
  const liveClaimsBlocked = allForbiddenProbesBlocked();
  if (!liveClaimsBlocked) blockers.push("FORBIDDEN_CLAIMS_NOT_BLOCKED.");

  // ── Moteur : batterie publique + adversariale, chaque réponse sûre ──────────
  const engineResults = ENGINE_PROBES.map((p) =>
    answerCloneStoreQuestion(p.q, { mode: p.mode ?? "visitor", env, at: "2026-07-10T00:00:00.000Z" }),
  );
  const engineSafe = engineResults.every((a) => checkAnswerTextSafety(a.answer).safe && a.answer.length > 0);
  const publicApiSafe = engineSafe; // moteur PUR : aucun provider live, aucun secret, aucune écriture production (verrouillé par tests de périmètre).
  if (!publicApiSafe) blockers.push("ENGINE_PROBE_UNSAFE: une réponse composée a violé la politique de claims.");

  // ── Production / paiement — évaluateurs réels ───────────────────────────────
  const productionStillOff = PRODUCTION_AUTHORIZED === false;
  const paymentMode = resolvePaymentMode(env);
  const paymentStillDisabled = paymentMode !== "live";
  if (!productionStillOff) blockers.push("PRODUCTION_FLOOR_BROKEN.");
  if (!paymentStillDisabled) blockers.push("PAYMENT_MODE_LIVE: interdit en C1.");

  // ── P16A / P16C — depuis les command centers réels T1/T2 ────────────────────
  const t1Report = summarizeTechnologyCommandCenter(env);
  const t2Report = await evaluateProductTechnologyCommandCenter(env);
  const readyForP16A = t2Report.readyForP16A && t1Report.readyForPierreIntegration && blockers.length === 0;
  const readyForP16C = t2Report.readyForP16C && t1Report.readyForPierreIntegration && blockers.length === 0;

  // ── Warnings honnêtes ───────────────────────────────────────────────────────
  warnings.push("Le câblage UI (/assistant → C1) est une étape dédiée : contrat d'intégration prêt, UI non modifiée en C1.");
  warnings.push("CLONECHAT_ENABLED reste OFF par défaut — l'activation publique est une décision produit séparée.");
  warnings.push(`Blocages externes inchangés (${externalBlockers().length}) : paiement en ligne fermé, revue légale/fiscale en attente, providers non vérifiés.`);
  warnings.push("La connaissance C1 devra être re-synchronisée à chaque changement de site/prix/phase (boucle d'apprentissage = propositions).");
  if (CLONECHAT_ROADMAP.length < 10) warnings.push("Roadmap C1 étonnamment courte.");

  const clonechatKnowledgeReady =
    siteMapReady && truthMatrixReady && pierreKnowledgeReady && technologyKnowledgeReady && pricingKnowledgeReady;

  const readyForPublicCloneChat =
    clonechatKnowledgeReady &&
    salesBrainReady &&
    supportBrainReady &&
    bugMemoryReady &&
    learningLoopReady &&
    answerRouterReady &&
    liveClaimsBlocked &&
    publicApiSafe &&
    productionStillOff &&
    paymentStillDisabled &&
    blockers.length === 0;

  return Object.freeze({
    clonechatKnowledgeReady,
    siteMapReady,
    truthMatrixReady,
    pierreKnowledgeReady,
    technologyKnowledgeReady,
    pricingKnowledgeReady,
    salesBrainReady,
    supportBrainReady,
    bugMemoryReady,
    learningLoopReady,
    answerRouterReady,
    publicApiSafe,
    productionStillOff,
    paymentStillDisabled,
    paymentMode,
    liveClaimsBlocked,
    readyForPublicCloneChat,
    readyForP16A,
    readyForP16C,
    exactBlockers: blockers,
    exactWarnings: warnings,
    nextRecommendedPhase:
      "P16A (Pierre Ultimate) puis P16C (intégration) — le câblage UI CloneChat→C1 peut se faire en étape dédiée derrière le flag existant.",
    note:
      "Rapport computé par sondes réelles (registres T1/T2, pricing P10, plancher P10, mode paiement P15.1, command centers T1/T2). " +
      "« readyForPublicCloneChat » signifie : la connaissance et les gardes sont prêtes pour servir site/vente/support — jamais « production ouverte ».",
  });
}
