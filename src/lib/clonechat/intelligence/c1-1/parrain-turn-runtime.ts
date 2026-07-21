// src/lib/clonechat/intelligence/c1-1/parrain-turn-runtime.ts
// C1.1 — Runtime de tour Parrain : orchestration PURE à ports injectés (le route handler
// réel fournit responder OpenAI existant, budget, ports compte/délégation). Séquence :
// classifier → contexte compte borné → chunks de session (pièces jointes/lineage) →
// grounding → modèle OU repli déterministe honnête → citations validées → politique de
// claims → liens/CTA → support/délégation/apprentissage. Le repli ne prétend JAMAIS
// avoir analysé une pièce jointe que le modèle n'a pas vue — il ne rapporte que
// l'extraction déterministe réelle.

import type { CloneChatStructuredOutput } from "../../openai/structured-output";
import { routeCloneChatQuestion } from "../c1/clonechat-answer-router";
import { answerCloneStoreQuestion } from "../c1/clonechat-answer-engine";
// C1.8 REOUVERT — taxonomie de navigation : achat/réservation/démo/découverte détectés en amont,
// réponse directe + CTA canonique (jamais Support, jamais liste, jamais bruit « entreprise active »).
import { resolveNavigationIntent } from "../../navigation/intent-taxonomy";
import { isRealDestinationRoute } from "../../navigation/destination-registry";
import { qualifiesForDirectAnswer, directNavigationAnswer } from "../../navigation/navigation-answer";
// C1.8 A2 — couche PUBLIQUE unique : une situation ⇒ un texte honnête ⇒ une destination, avec
// garde de sortie fail-closed (jargon interne, placeholder, pression commerciale sur un incident).
import { resolvePublicAnswer, checkPublicOutput, sanitizePublicText } from "../../public-answer";
import { buildParrainGroundedPrompt } from "./parrain-grounding";
import { validateParrainCitations, qualifyUnsupported } from "./parrain-citations";
import { deriveHonesty, finalizeAnswerText, type ParrainAnswer } from "./parrain-answer-schema";
import { accountSnapshotChunks, buildAccountContextSnapshot, type ParrainAccountPort } from "./parrain-account-context";
import { attachmentGroundingChunks } from "./parrain-attachment-ingestion";
import type { AttachmentIngestionResult } from "./parrain-attachment-types";
import { resolveReferencedIds } from "./parrain-document-retrieval";
import { runSupportTurn } from "./parrain-support-runtime";
import { createParrainBugStore, type ParrainBugStore } from "./parrain-bug-learning";
import { delegateToPierre, classifyPierreRequest, type PierreDelegationPort } from "./parrain-pierre-delegation";
import { analyzeSalesTurn } from "./parrain-sales-runtime";
import { sitePageByRoute, lookupSite } from "./parrain-site-index";
import type { ExistingScreenshotAnalysis } from "./parrain-image-adapter";
import { imageAnalysisChunk } from "./parrain-image-adapter";
import type { ParrainCodeSymbol } from "./parrain-code-index";
import type { ParrainKnowledgeChunk, ParrainLink, ParrainViewerContext } from "./parrain-types";

// ── Ports (formes minimales des services RÉELS existants) ─────────────────────
export interface ParrainResponderPort {
  respond(req: {
    readonly model: string;
    readonly system: string;
    readonly userText: string;
    readonly history?: readonly { role: "user" | "assistant"; text: string }[];
    readonly maxOutputTokens: number;
    /** C1.7 — images RÉELLES envoyées au provider (data URLs assainies côté serveur). */
    readonly imageDataUrls?: readonly string[];
    /** Détail visuel : « low » par défaut ; « high » UNIQUEMENT si la question le justifie. */
    readonly imageDetail?: "low" | "high";
  }): Promise<{ readonly ok: boolean; readonly structured: CloneChatStructuredOutput | null; readonly usage: { inputTokens: number; outputTokens: number } }>;
}

export interface ParrainTurnPorts {
  /** Responder OpenAI RÉEL (createRealOpenAIResponder) — null = repli déterministe. */
  readonly responder: ParrainResponderPort | null;
  readonly accountPort: ParrainAccountPort | null;
  readonly delegationPort: PierreDelegationPort | null;
  readonly bugStore?: ParrainBugStore;
}

export interface ParrainTurnInput {
  readonly question: string;
  readonly viewer: ParrainViewerContext;
  readonly history?: readonly { role: "user" | "assistant"; text: string }[];
  readonly attachments?: readonly AttachmentIngestionResult[];
  /** C1.7 — images (data URLs) déjà assainies par le serveur. */
  readonly imageDataUrls?: readonly string[];
  readonly imageDetail?: "low" | "high";
  readonly screenshotAnalysis?: ExistingScreenshotAnalysis | null;
  readonly conversationId?: string | null;
  readonly routeHint?: string | null;
  /** Résumés de symboles — l'index les ignore hors mode fondateur (défense en profondeur). */
  readonly codeSymbols?: readonly ParrainCodeSymbol[];
  readonly model: string;
  readonly maxOutputTokens: number;
  readonly at: string;
}

// Exporté pour la PREUVE de reproduction C1.8 réouvert : mesurer le CTA hérité (chemin d'origine
// routeCloneChatQuestion → linksFor) SANS le court-circuit de navigation, afin de démontrer le défaut.
export function linksFor(category: string, question: string): { links: ParrainLink[]; cta: ParrainLink | null } {
  const push = (route: string): ParrainLink | null => {
    const p = sitePageByRoute(route);
    return p ? { route: p.route, label: p.title } : null;
  };
  const set = (routes: string[]): ParrainLink[] => routes.map(push).filter((l): l is ParrainLink => l !== null);
  switch (category) {
    case "pricing":
    case "country_availability":
      return { links: set(["/reserver/pierre", "/comprendre-clonestore"]), cta: push("/reserver/pierre") };
    case "demo_or_reservation":
      return { links: set(["/demo", "/demo/pierre", "/reserver/pierre"]), cta: push("/demo") };
    case "pierre_explanation":
      return { links: set(["/agents/pierre", "/demo/pierre"]), cta: push("/agents/pierre") };
    case "support_bug":
      return { links: set(["/questions"]), cta: push("/questions") };
    case "legal_or_compliance":
      return { links: set(["/legal/cgu", "/legal/confidentialite", "/questions"]), cta: push("/questions") };
    case "site_navigation": {
      const hit = lookupSite(question);
      const target = hit.page ?? hit.closest;
      return { links: target ? [{ route: target.route, label: target.title }] : [], cta: target && target.primaryCTA ? { route: target.route, label: target.primaryCTA } : null };
    }
    default:
      return { links: set(["/comprendre-clonestore", "/demo"]), cta: push("/demo") };
  }
}

/** Tour Parrain complet. PURE vis-à-vis du réseau : tout I/O passe par les ports. */
export async function runParrainTurn(input: ParrainTurnInput, ports: ParrainTurnPorts): Promise<ParrainAnswer> {
  const { viewer, question, at } = input;
  const attachments = input.attachments ?? [];
  const bugStore = ports.bugStore ?? createParrainBugStore();
  const routing = routeCloneChatQuestion(question, viewer.mode === "founder" ? "founder" : viewer.mode === "client" ? "client" : "visitor");
  const requestKind = classifyPierreRequest(question);

  // ── Contexte de session : compte (borné, tenant) + pièces jointes + image ───
  const sessionChunks: ParrainKnowledgeChunk[] = [];
  if (viewer.mode !== "public" && ports.accountPort) {
    const snapshot = await buildAccountContextSnapshot(ports.accountPort, viewer, question, at);
    if (snapshot) sessionChunks.push(...accountSnapshotChunks(snapshot));
  }
  for (const a of attachments) {
    // Pièce jointe TENANT : exige l'entreprise EXACTE (inchangé, fail-closed).
    const sameTenant = viewer.companyId !== null && a.attachment.companyId === viewer.companyId;
    // C1.7 — Pièce jointe ÉPHÉMÈRE (companyId === null) : c'est le fichier que l'utilisateur
    // vient de joindre lui-même. Il est grondé pour TOUS les viewers, y compris anonyme — mais
    // il ne porte AUCUN tenant, donc il ne peut jamais servir de pont vers des données privées.
    const ephemeral = a.attachment.companyId === null;
    if (sameTenant || ephemeral) sessionChunks.push(...attachmentGroundingChunks(a));
  }
  if (input.screenshotAnalysis && viewer.companyId) {
    sessionChunks.push(imageAnalysisChunk(input.screenshotAnalysis, viewer.companyId, null));
  }
  if (routing.category === "sales_objection" || routing.category === "pricing") {
    sessionChunks.push(...analyzeSalesTurn(question).groundingChunks);
  }

  // ── Support : runtime dédié (déterministe, honnête) ─────────────────────────
  let supportResult: ReturnType<typeof runSupportTurn> | null = null;
  if (routing.category === "support_bug") {
    supportResult = runSupportTurn(
      {
        description: question,
        companyId: viewer.companyId,
        userId: viewer.userId,
        route: input.routeHint ?? null,
        browser: null,
        device: null,
        release: null,
        screenshotAnalysis: input.screenshotAnalysis ?? null,
        attachments,
        at,
      },
      bugStore,
    );
  }

  // ── Délégation Pierre (travail RH) — jamais de plan RH construit ici ─────────
  const delegation =
    requestKind === "hr_work" || requestKind === "hr_decision_human_only"
      ? await delegateToPierre(
          ports.delegationPort ?? { proposeMission: async () => null, readMissionStatus: async () => null },
          viewer,
          question,
          input.conversationId ?? null,
          at,
        )
      : null;

  // ── Grounding borné ──────────────────────────────────────────────────────────
  const grounded = buildParrainGroundedPrompt({
    question,
    viewer,
    sessionChunks,
    codeSymbols: input.codeSymbols,
    retrieval: {
      // C1.7 — Un fichier que l'utilisateur VIENT DE JOINDRE est, par définition, la pièce à
      // conviction de sa question. Il ne doit pas « concourir » avec la connaissance générale
      // dans le classement : ses extraits sont ÉPINGLÉS dans le contexte. Sans cela, le modèle
      // répondait « je ne vois aucun fichier joint » alors que le fichier était bien ingéré.
      referencedIds: [
        ...resolveReferencedIds(question, attachments),
        ...sessionChunks.filter((c) => c.sourceId === "src.uploaded_documents").map((c) => c.id),
      ],
    },
  });

  let { links, cta } = linksFor(routing.category, question);

  // ── C1.8 REOUVERT — NAVIGATION CLAIRE : réponse directe déterministe ──────────
  // Une intention de navigation nette (« où acheter Pierre ? », « la démo », « me connecter »…)
  // mérite UNE phrase utile + UN CTA vers la bonne page — jamais une liste, une clarification, un
  // renvoi Support, ou un avertissement d'entreprise. On court-circuite AVANT le modèle (qui, non
  // déterministe, pourrait réintroduire ce bruit) — mais uniquement en l'absence de pièce jointe,
  // d'image et de délégation (ces flux ont leur propre traitement). Une question SUBSTANTIELLE
  // (prix chiffré, capacités, support) n'est pas concernée : elle garde le chemin groundé.
  const nav = resolveNavigationIntent(
    question,
    { mode: viewer.mode === "public" ? "visitor" : "client", hasActiveCompany: viewer.companyId !== null, country: null },
    input.history,
  );
  const noAttachmentsOrImage = attachments.length === 0 && !input.imageDataUrls?.length && !input.screenshotAnalysis;

  // ── C1.8 A2 — VOIE PUBLIQUE DÉTERMINISTE : autorité unique de composition ─────
  // Le visiteur non connecté ne reçoit plus le texte du routeur hérité (grille tarifaire sur un
  // double débit, plan du site sur une panne, feuille de route interne sur « depuis quand ») : une
  // SITUATION est résolue, une réponse honnête est composée, une seule destination l'accompagne.
  // Le chemin modèle (responder réel) est conservé — il est simplement contrôlé par la même garde.
  if (viewer.mode === "public" && noAttachmentsOrImage && !ports.responder) {
    const pub = resolvePublicAnswer(question);
    const finalizedPub = finalizeAnswerText(pub.answer);
    return Object.freeze({
      answer: finalizedPub.safeText,
      honesty: finalizedPub.violated ? "escalated" : pub.escalate ? "escalated" : "answered",
      confidence: finalizedPub.violated ? "low" : pub.confidence,
      category: routing.category,
      citations: [],
      citationLabels: [],
      relevantLinks: pub.links.map((l) => ({ route: l.route, label: l.label })),
      suggestedCTA: pub.cta ? { route: pub.cta.route, label: pub.cta.label } : null,
      knownLimitations: [],
      needsHumanEscalation: finalizedPub.violated || pub.escalate,
      supportArtifact: supportResult?.artifact ?? null,
      learningCandidate: null,
      pierreDelegation: null,
      attachments: [],
      documentFindings: [],
      usageTokens: 0,
      source: "deterministic_parrain",
    }) as ParrainAnswer;
  }

  if (noAttachmentsOrImage && !delegation && qualifiesForDirectAnswer(nav) && nav.cta) {
    // La route du CTA est validée par le registre de destinations (taxonomie) : jamais inventée.
    const navCta = { route: nav.cta.route, label: nav.cta.label };
    const navLinks = [navCta];
    const finalizedNav = finalizeAnswerText(directNavigationAnswer(nav));
    return Object.freeze({
      answer: finalizedNav.safeText,
      honesty: "answered",
      confidence: nav.confidence === "certain" ? "high" : nav.confidence === "high" ? "high" : "medium",
      category: routing.category,
      citations: [],
      citationLabels: [],
      relevantLinks: navLinks,
      suggestedCTA: navCta,
      knownLimitations: [],
      needsHumanEscalation: false,
      supportArtifact: null,
      learningCandidate: null,
      pierreDelegation: null,
      attachments: [],
      documentFindings: [],
      usageTokens: 0,
      source: "deterministic_parrain",
    }) as ParrainAnswer;
  }
  // Pour une intention commerciale confiante NON court-circuitée (prix chiffré, démo, découverte),
  // on garde le contenu groundé/modèle MAIS on impose le CTA canonique de la destination : ainsi
  // « combien coûte Pierre ? » garde son explication et pointe /reserver/pierre, « la démo » pointe
  // /demo/pierre, « c'est quoi Pierre » pointe /agents/pierre. Jamais un CTA Support par défaut.
  // On impose la destination CANONIQUE de la taxonomie pour TOUTE intention confiante (commerciale
  // OU client : annulation→/profile, support→/questions, connexion→/login…), pas seulement le
  // commercial. Sans cela, deux routeurs coexistaient (routeCloneChatQuestion hérité vs taxonomie) et
  // le CTA délivré suivait l'ancien, misroutant l'annulation/le support/la connexion. Le CONTENU de
  // la réponse (diagnostic CloneCare, savoir, etc.) reste inchangé ; seule la destination est unifiée.
  if (nav.cta && (nav.confidence === "certain" || nav.confidence === "high") && !nav.clarification_required && isRealDestinationRoute(nav.cta.route)) {
    const navCta = { route: nav.cta.route, label: nav.cta.label };
    cta = navCta;
    // Le CLIENT rend `relevantLinks` (pas `suggestedCTA`) : la destination canonique doit donc en
    // être le PREMIER lien, sinon la belle réponse pointerait un bouton hérité imprécis (ex. /demo
    // au lieu de /demo/pierre). On mène avec navCta puis on conserve les alternatives distinctes.
    links = [navCta, ...links.filter((l) => l.route !== navCta.route)].slice(0, 3);
  }

  const knownLimitations: string[] = [];
  for (const a of attachments) {
    if (a.attachment.supportStatus === "unsupported" || a.attachment.supportStatus === "parse_failed" || a.attachment.supportStatus === "manual_review_required") {
      knownLimitations.push(a.honestSummary);
    }
  }
  if (grounded.retrieval.staleSourceIds.length > 0) {
    knownLimitations.push("Certaines sources sont en cours de rafraîchissement (index marqué périmé).");
  }

  const documentFindings = attachments
    .filter((a) => a.chunks.length > 0)
    .map((a) => a.honestSummary);

  // ── Chemin MODÈLE (responder OpenAI existant) ───────────────────────────────
  if (ports.responder) {
    try {
      const result = await ports.responder.respond({
        model: input.model,
        system: grounded.system,
        userText: question,
        history: (input.history ?? []).slice(-6),
        maxOutputTokens: input.maxOutputTokens,
        imageDataUrls: input.imageDataUrls,   // C1.7 — l'image atteint VRAIMENT le provider
        imageDetail: input.imageDetail,
      });
      if (result.ok && result.structured) {
        const cited = validateParrainCitations(result.structured.citations ?? [], grounded.contextChunks, viewer.mode);
        let answerText = result.structured.answer;
        if (supportResult) answerText = `${answerText}\n\n${supportResult.message}`;
        if (delegation?.status === "blocked" && delegation.blockedReason) answerText = `${answerText}\n\n${delegation.blockedReason}`;
        answerText = qualifyUnsupported(answerText, cited.valid.length > 0, grounded.retrieval.staleSourceIds);
        // C1.8 A2 — la garde publique s'applique AUSSI au modèle : ni jargon interne, ni placeholder,
        // ni suffixe parasite, ni argumentaire commercial sur un incident. En cas de violation
        // persistante après nettoyage, la réponse déterministe honnête reprend la main (fail-closed).
        if (viewer.mode === "public") {
          answerText = sanitizePublicText(answerText);
          const pubGuard = resolvePublicAnswer(question);
          const verdict = checkPublicOutput({
            text: answerText,
            ctaRoute: cta?.route ?? null,
            linkRoutes: links.map((l) => l.route),
            commercialForbidden: pubGuard.commercialForbidden,
          });
          if (!verdict.ok) {
            answerText = pubGuard.answer;
            cta = pubGuard.cta ? { route: pubGuard.cta.route, label: pubGuard.cta.label } : null;
            links = pubGuard.links.map((l) => ({ route: l.route, label: l.label }));
          }
        }
        const finalized = finalizeAnswerText(answerText);
        const honesty = deriveHonesty(result.structured.honesty, {
          citationsKept: cited.valid.length,
          escalated: supportResult?.escalated ?? false,
        });
        return Object.freeze({
          answer: finalized.safeText,
          honesty: finalized.violated ? "escalated" : honesty,
          confidence: finalized.violated ? "low" : grounded.retrieval.staleSourceIds.length > 0 ? "medium" : cited.valid.length > 0 ? "high" : "medium",
          category: routing.category,
          citations: cited.valid,
          citationLabels: cited.labels,
          relevantLinks: links,
          suggestedCTA: cta,
          knownLimitations,
          needsHumanEscalation: finalized.violated || (supportResult?.escalated ?? false) || routing.category === "legal_or_compliance",
          supportArtifact: supportResult?.artifact ?? null,
          learningCandidate: null,
          pierreDelegation: delegation,
          attachments: attachments.map((a) => a.attachment),
          documentFindings,
          usageTokens: result.usage.inputTokens + result.usage.outputTokens,
          source: "openai_parrain",
        });
      }
    } catch {
      // chute vers le repli déterministe honnête
    }
  }

  // ── Repli DÉTERMINISTE honnête (C1) — jamais de fausse analyse de pièce jointe ─
  const c1 = answerCloneStoreQuestion(question, {
    mode: viewer.mode === "founder" ? "founder" : viewer.mode === "client" ? "client" : "visitor",
    at,
  });
  let fallbackText = supportResult ? supportResult.message : c1.answer;
  if (attachments.length > 0) {
    // L'extraction (déterministe) est réelle et peut être rapportée ; la COMPRÉHENSION
    // modèle n'a pas eu lieu — on le dit explicitement.
    const parsed = attachments.filter((a) => a.chunks.length > 0);
    fallbackText +=
      parsed.length > 0
        ? `\n\nVos fichiers ont été reçus et leur texte extrait (${parsed.map((a) => a.attachment.filename).join(", ")}), mais l'analyse approfondie par le modèle n'est pas disponible pour le moment — je ne vais pas prétendre l'avoir faite.`
        : `\n\nVos fichiers ont été reçus mais n'ont pas pu être analysés — je ne devine jamais le contenu d'un fichier.`;
  }
  if (delegation?.status === "blocked" && delegation.blockedReason) fallbackText += `\n\n${delegation.blockedReason}`;
  if (delegation?.status === "clarification" && delegation.clarification) fallbackText += `\n\n${delegation.clarification}`;
  const finalized = finalizeAnswerText(fallbackText);
  return Object.freeze({
    answer: finalized.safeText,
    honesty: attachments.length > 0 ? "partially_answered" : c1.needsHumanEscalation ? "escalated" : "answered",
    confidence: finalized.violated ? "low" : c1.confidence,
    category: routing.category,
    citations: [],
    citationLabels: [],
    relevantLinks: links.length ? links : c1.relevantLinks.map((l) => ({ route: l.route, label: l.label })),
    suggestedCTA: cta ?? (c1.suggestedCTA ? { route: c1.suggestedCTA.route, label: c1.suggestedCTA.label } : null),
    knownLimitations,
    needsHumanEscalation: finalized.violated || c1.needsHumanEscalation || (supportResult?.escalated ?? false),
    supportArtifact: supportResult?.artifact ?? null,
    learningCandidate: c1.learningCandidate,
    pierreDelegation: delegation,
    attachments: attachments.map((a) => a.attachment),
    documentFindings,
    usageTokens: 0,
    source: "deterministic_parrain",
  });
}
