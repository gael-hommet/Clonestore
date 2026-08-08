// src/app/api/assistant/chat/route.ts
// P9.4 → P9.4.1 → P9.4.2 → C1.1 — Route CloneChat AUTHENTIFIÉE. Le serveur reste l'autorité :
// flag + auth + accès Pierre + BUDGET DUR ATOMIQUE (reserve→commit/release) AVANT tout appel
// OpenAI + comptabilité durable. Depuis C1.1, la connaissance est GROUNDÉE sur l'index Parrain
// (site vivant · capacités RH canoniques · registres T1/T2 · pricing canonique · vérité produit ·
// contexte ENTREPRISE borné · pièces jointes tenant), avec citations validées serveur contre les
// chunks RÉELLEMENT fournis, puis garde de claims C1 (aucune revendication live). Mémoire de
// bugs/support DURABLE (réutilisation vérifiée uniquement). Conversations DURABLES (multi-device).
// La clé OpenAI reste SERVEUR. Le modèle PROPOSE ; l'humain confirme ; le contrat V1 exécute.
// Le companyId, le rôle, la visibilité et le statut de parsing ne sont JAMAIS lus du corps client.
// no-store.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { hasPierreAccess } from "@/lib/pierre/access";
import { isCloneChatEnabled } from "@/lib/features/product-availability";
import {
  loadOpenAIConfig, readOpenAIKey, createRealOpenAIResponder, createDeterministicResponder,
  buildUsageRecord, sanitizeImages, analyzeScreenshotReal,
} from "@/lib/clonechat/openai";
import { prepareImagesForModel } from "@/lib/clonechat/openai/image-sanitizer";
import { detectPromptInjection, injectionRefusalMessage } from "@/lib/clonechat";
import { redactSymptom } from "@/lib/clonechat/bug-memory";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { budgetHealth, budgetDegradationReason } from "@/lib/clonechat/server/resilient-budget";
import { isE2EModeEnabled, readE2EIdentityFromRequest } from "@/lib/pierre/v1/e2e-test-identity";
import { resolveCloneChatCompany, type TenantResolution } from "@/lib/clonechat/server/company";
import { tenantRefusalResponse } from "@/lib/clonechat/server/auth";
import { buildAndPersistProposal } from "@/lib/clonechat/server/proposal-builder";
// P19 — CloneOS sur le vrai chemin + statut structurel du tour (jamais déduit d'une phrase).
import { buildCloneOsTurn, deriveStructuralStatus } from "@/lib/clonechat/server/cloneos-turn";
// ── C1.6 — CONTRAT UNIVERSEL : la conversation est un DROIT, le contexte privé et l'action
// sont des PRIVILÈGES. Ce module SUPPLANTE la matrice d'entrée de C1.3/C1.4/C1.5.
import {
  classifyCloneChatRequest,
  resolveCloneChatPlan,
  prerequisiteMessage,
  prerequisiteCta,
  type CloneChatViewer,
} from "@/lib/clonechat/server/universal-access";
import {
  checkAnonymousRateLimit,
  anonymousFingerprint,
  anonymousRateLimitMessage,
} from "@/lib/clonechat/server/anonymous-rate-limit";
// ── C1.8 — CLONECARE : le support autonome derrière l'UNIQUE CloneChat.
// Aucune seconde route, aucun second assistant : une ENVELOPPE additive sur les réponses
// existantes. Le client décrit son ÉCRAN ; le serveur résout son IDENTITÉ.
import { resolveAccountContext } from "@/lib/clonechat/care/context-resolver";
import { buildCareEnvelope, type CareEnvelope } from "@/lib/clonechat/care/envelope";
// C1.8 BLOC A — UNE SEULE FORME VISIBLE. Toute branche passe par le normalisateur : c'est ce qui
// rend structurellement impossible qu'un champ (comme `analysis`) soit renvoyé sans être affiché.
import { buildRenderedResponse } from "@/lib/clonechat/response/canonical";
import { getRouteEntry } from "@/lib/nav/route-registry";
// C1.7 §4C — UN SEUL routeur de modèle, pur et déterministe. Aucun appel IA pour choisir une IA,
// et AUCUN signal d'identité : la qualité dépend de la TÂCHE, jamais du compte.
import { routeModel, isAllowedModel, loadModelRouterConfig } from "@/lib/clonechat/openai/model-router";
// C1.7 §5 — Manifeste CANONIQUE, réutilisé CÔTÉ SERVEUR : le client n'est pas une frontière.
import { buildManifest, imageDetailFor } from "@/lib/clonechat/attachments/manifest";
import { createSentenceGate, encodeStreamEvent, classifyProviderFailure } from "@/lib/clonechat/openai/streaming";
import { createStreamingOpenAIResponder, type StreamingResponderResult } from "@/lib/clonechat/openai/streaming-responder";
import { answerPublicQuestion, PUBLIC_VIEWER } from "@/lib/clonechat/intelligence/c1-1/parrain-public-adapter";
// ── C1.9 — SHADOW (observation seule) ────────────────────────────────────────
// La pipeline True AI s'exécute À CÔTÉ de la voie stable et n'altère JAMAIS la réponse
// renvoyée. Drapeau `off` par défaut : sans lui, rien de tout ceci ne s'exécute ni ne coûte.
// Outils désactivés par le contexte lecture seule, budget de tokens plafonné par processus,
// délai maximum, et aucune exception ne peut remonter jusqu'au tour de l'utilisateur.
import { readC19Mode } from "@/lib/clonechat/intelligence/c1-9/flags";
import { runShadowComparison } from "@/lib/clonechat/intelligence/c1-9/shadow-runner";
import { recordShadowComparison } from "@/lib/clonechat/intelligence/c1-9/shadow-log";
import { collectCandidateChunks } from "@/lib/clonechat/intelligence/c1-1/parrain-source-adapters";
import { runCloneChatIntelligence } from "@/lib/clonechat/intelligence/c1-9/intelligence-runtime";
import { createOpenAIC19Port, createTokenBudget, loadC19ModelConfig } from "@/lib/clonechat/intelligence/c1-9/openai-port";
import { EMPTY_MEMORY } from "@/lib/clonechat/intelligence/c1-9/conversation-memory";
import { buildKnowledgeIndex, indexLeaksForbiddenSources } from "@/lib/clonechat/intelligence/c1-1/parrain-knowledge-index";
import type { ParrainResponderPort } from "@/lib/clonechat/intelligence/c1-1/parrain-turn-runtime";
import type { ParrainHonesty } from "@/lib/clonechat/intelligence/c1-1/parrain-types";
// ── P16C — délégation RH gouvernée (ADDITIF, lecture seule : n'active aucun effet, n'exécute rien) ──
// Imports ciblés (jamais le barrel) : la route ne tire pas le command-center ni ses deps lourdes.
import { isP16CIntegrationEnabled } from "@/lib/clonestore/integration/p16c/p16c-flags";
import { buildCloneChatDelegation } from "@/lib/clonestore/integration/p16c/p16c-clonechat-adapter";
// ── C1.1 — Parrain (feuilles serveur, jamais le barrel client) ────────────────
import { buildParrainGroundedPrompt } from "@/lib/clonechat/intelligence/c1-1/parrain-grounding";
import { validateParrainCitations } from "@/lib/clonechat/intelligence/c1-1/parrain-citations";
import { finalizeAnswerText } from "@/lib/clonechat/intelligence/c1-1/parrain-answer-schema";
import { ingestAttachment, attachmentGroundingChunks } from "@/lib/clonechat/intelligence/c1-1/parrain-attachment-ingestion";
import { clientViewer, createLoopbackAccountPort } from "@/lib/clonechat/intelligence/c1-1/parrain-authenticated-adapter";
import { buildAccountContextSnapshot, accountSnapshotChunks } from "@/lib/clonechat/intelligence/c1-1/parrain-account-context";
import { resolveReferencedIds } from "@/lib/clonechat/intelligence/c1-1/parrain-document-retrieval";
import type { AttachmentIngestionResult } from "@/lib/clonechat/intelligence/c1-1/parrain-attachment-types";
import type { ParrainKnowledgeChunk } from "@/lib/clonechat/intelligence/c1-1/parrain-types";
// ── CloneChat Unified Intelligence — cœur conversationnel UNIQUE (voie publique) ────────────
// Remplace le routage rigide par mots-clés (analyzeSalesTurn/pricingChunk inconditionnel) par
// UN SEUL appel OpenAI Responses API qui décide lui-même s'il répond, utilise le contexte
// CloneStore, lance web_search ou ouvre une page. Essayé EN PREMIER sur la voie publique ; en
// cas d'échec/absence de clé, repli sur la chaîne C1.9 puis legacy EXISTANTE, inchangée.
import { respondUnified, loadResponderConfig, readOpenAIKeyLazy } from "@/lib/clonechat/core/responder";
// ── BLOC 13 — Production Hardening (ADDITIF, feature-gated, `off` par défaut). En `off`/`shadow`
// (défaut, y compris Production) rien ne change ; en `active` (jamais Production ici) : body borné,
// limites, concurrence/timeout/circuit, flux SSE durci.
import {
  hardeningChatPrecheck, activeHardening, buildActiveHardenedStream, readBoundedRequestText,
  activeStreamProduceForTests, type ReadinessFacts,
} from "@/lib/clonechat/hardening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(json: unknown, status = 200) {
  return NextResponse.json(json, { status, headers: { "Cache-Control": "no-store" } });
}
function bearer(req: Request): string | null {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
const now = () => new Date().toISOString();

/** Transport de pièce jointe. Le serveur ne fait CONFIANCE à aucun champ déclaré :
 *  le MIME est re-détecté par signature, la taille recalculée, le hash recalculé. */
interface AttachmentBody {
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
  transport?: string;
  data?: string; // base64 (pas de data: URL)
  /** C1.7 — chemin RELATIF dans un dossier choisi (jamais un chemin absolu du disque). */
  relative_path?: string;
}

interface ChatBody {
  message?: string;
  /** C1.7 §8 — diffusion progressive de la réponse (SSE). */
  stream?: boolean;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  images?: string[];
  attachments?: AttachmentBody[];
  conversation_id?: string;
  /**
   * C1.8 §4 — CONTEXTE D'ÉCRAN déclaré par le client. Volontairement typé `unknown` :
   * il est VALIDÉ et NETTOYÉ côté serveur (`validatePageContext`), jamais cru sur parole.
   * Tout champ d'identité qui s'y trouverait est ignoré et signalé comme usurpation.
   */
  page_context?: unknown;
}

const BUG_HINT = /(bug|erreur|probl[eè]me|marche pas|ne fonctionne|plante|grisé|bloqué|vide|impossible|n'arrive pas|échoue|ne s'affiche)/i;

// Bornes de transport (aucun substrat d'upload durable dans ce dépôt : transport en ligne borné).
const MAX_ATTACHMENTS = 4;
const MAX_TOTAL_BASE64_CHARS = 8 * 1024 * 1024; // ~6 Mo décodés, tous fichiers confondus

/**
 * C1.4 — CTA d'activation Pierre dérivé du REGISTRE DE ROUTES CANONIQUE (jamais une URL
 * inventée). Ne revendique aucun paiement en ligne : la réservation reste sans paiement.
 */
function pierreActivationCta(): { route: string; label: string } | null {
  const entry = getRouteEntry("/reserver/pierre") ?? getRouteEntry("/agents/pierre");
  if (!entry) return null;
  return { route: entry.path, label: entry.path === "/reserver/pierre" ? "Réserver Pierre" : entry.label };
}

/** C1.3 — honnêteté Parrain (7 valeurs) → schéma de sortie CloneChat (3 valeurs). */
function publicHonesty(h: ParrainHonesty): "answered" | "unknown" | "needs_clarification" {
  if (h === "clarification_required") return "needs_clarification";
  if (h === "source_missing" || h === "unsupported" || h === "permission_denied") return "unknown";
  return "answered";
}

/** Décodage base64 défensif — jamais de throw, jamais d'exécution de contenu. */
function decodeBase64(data: string): Uint8Array | null {
  try {
    const clean = data.includes(",") && data.startsWith("data:") ? data.slice(data.indexOf(",") + 1) : data;
    const buf = Buffer.from(clean, "base64");
    return buf.length > 0 ? new Uint8Array(buf) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // 1) Flag produit (fail-closed).
  if (!isCloneChatEnabled()) return noStore({ ok: false, code: "CLONECHAT_DISABLED", error: "CloneChat n'est pas encore disponible." }, 503);

  // 2) C1.6 — IDENTITÉ, PAS PORTE D'ENTRÉE.
  //
  // L'ancien code renvoyait 401 à tout visiteur anonyme : c'était une porte au niveau du CHAT.
  // Elle est SUPPRIMÉE. On résout qui parle — et si personne n'est connecté, on ne fabrique
  // AUCUN identifiant : le lecteur est `anonymous`, et il converse comme tout le monde.
  // L'authentification ne conditionne plus la parole, seulement le contexte privé et l'action.
  let userId: string | null = null;
  let supabase: Awaited<ReturnType<typeof supabaseServer>> | null = null;
  // ── PONT E2E (test uniquement, fail-closed) ──────────────────────────────────
  // La route CHAT résout l'identité INLINE (pas via requireCompanyUser). Sans ce pont, elle
  // ne reconnaissait pas le cookie d'identité signé : un utilisateur authentifié par e2e était
  // vu ANONYME ici, donc ses messages n'étaient jamais persistés (les routes conversations, elles,
  // ont le pont — d'où une conversation créée mais VIDE). Miroir exact de requireCompanyUser :
  // inerte en production (readE2EIdentityFromRequest exige mode test + NODE_ENV≠production + secret).
  const e2eId = isE2EModeEnabled() ? readE2EIdentityFromRequest(req) : null;
  if (e2eId) userId = e2eId.user_id;
  else try {
    supabase = await supabaseServer();
    const token = bearer(req);
    const { data } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // Session illisible/expirée : ce n'est PAS une raison de refuser la conversation.
    // On dégrade en visiteur anonyme — aucune donnée privée ne sera servie de toute façon.
    userId = null;
  }
  const viewer: CloneChatViewer = userId ? { kind: "user", userId } : { kind: "anonymous" };

  // ── BLOC 13 — runtime durci. Résolution du mode (off par défaut). En OFF/SHADOW rien ne change.
  // Capacités RÉELLES de la route (falsifiables : présence des guards BLOC 0→12), utilisées comme
  // evidence de readiness pour le chemin actif servi.
  const routeCaps: Partial<ReadinessFacts> = {
    auth_fail_closed: typeof supabaseServer === "function",
    tenant_isolation: typeof resolveCloneChatCompany === "function",
    rate_limiting: typeof checkAnonymousRateLimit === "function",
    secrets_server_only: typeof readOpenAIKey === "function",
    safe_fallback: typeof createDeterministicResponder === "function",
    analytics_fail_open: true, // aucune analytics dans le chemin de réponse servi → ne peut pas le casser
    no_unintended_external_effect: true, // le chemin actif n'ajoute aucune mutation métier
  };
  const hardening = activeHardening(process.env, routeCaps);
  const hActive = hardening.effect.enforce && hardening.activeAllowed; // active ET readiness verte

  // BODY : en active, lecture BORNÉE au transport AVANT parsing (Content-Length + cumul réel, corps
  // mensonger/chunké plafonné). En off/shadow : chemin historique inchangé (req.json()).
  let body: ChatBody | null;
  if (hActive) {
    const read = await readBoundedRequestText(req, hardening.config.limits.maxBodyBytes);
    if (read.tooLarge) return noStore({ ok: false, code: "payload_too_large", error: "Requête trop volumineuse." }, 413);
    try { body = JSON.parse(read.text) as ChatBody; } catch { body = null; }
  } else {
    body = (await req.json().catch(() => null)) as ChatBody | null;
  }
  const message = (body?.message ?? "").trim();
  const conversationId = body?.conversation_id ?? null;
  const rawAttachmentCount = Array.isArray(body?.attachments) ? body!.attachments!.length : 0;
  const rawAttachments = Array.isArray(body?.attachments) ? body!.attachments!.slice(0, MAX_ATTACHMENTS) : [];
  if (!message && !(body?.images?.length) && rawAttachments.length === 0) return noStore({ ok: false, code: "EMPTY", error: "Message vide." }, 400);

  // Garde durcie ADDITIVE. En off/shadow → jamais bloquant (comportement historique). En active →
  // limites canoniques + nombre BRUT de pièces jointes (AVANT slice) + erreur structurée sûre.
  const hardened = hardeningChatPrecheck({
    message,
    rawAttachmentCount,
    history: Array.isArray(body?.history) ? body!.history!.map((h) => ({ text: h?.text })) : [],
    attachments: rawAttachments.map((a) => ({ bytes: typeof a?.size_bytes === "number" ? a.size_bytes : (typeof a?.data === "string" ? a.data.length : 0) })),
  }, hardening.config);
  if (hardened.blocked) return noStore(hardened.payload, hardened.status);

  // 3) Sécurité : prompt-injection → refus déterministe, aucun appel modèle, 0 token.
  if (detectPromptInjection(message)) {
    return noStore({ ok: true, source: "refused", structured: { answer: injectionRefusalMessage(), honesty: "answered", tool_call: null, citations: [] } });
  }

  const cfg = loadOpenAIConfig();
  const key = readOpenAIKey();
  const stores = await getCloneChatStores();
  const at = now();

  // ── C1.6 — PLAN UNIVERSEL ─────────────────────────────────────────────────────
  //
  // La conversation est un DROIT ; le contexte privé et l'action sont des PRIVILÈGES.
  // On ne demande plus « avez-vous le droit de parler ? » mais « que demandez-vous, et que
  // faut-il pour le satisfaire ? ». Un prérequis manquant s'attache à la DEMANDE — jamais au
  // droit de converser. Aucune branche ci-dessous ne peut fermer le chat.
  const requestClass = classifyCloneChatRequest(message);

  // ANONYME : on n'interroge AUCUNE table tenant (pas d'identité → pas de requête privée).
  const entitlement = viewer.kind === "user" && supabase ? await hasPierreAccess(supabase, viewer.userId) : null;
  const tenant = viewer.kind === "user" ? await resolveCloneChatCompany(viewer.userId) : null;
  const plan = resolveCloneChatPlan({ requestClass, viewer, entitlement, tenant });

  // ── C1.8 §4 — CLONECONTEXT ───────────────────────────────────────────────────
  //
  // L'identité est RÉSOLUE ici, à partir des autorités que la route vient de calculer
  // (viewer, droit Pierre, entreprise, plan). Le `page_context` éventuellement envoyé par le
  // navigateur décrit un ÉCRAN — il est validé, nettoyé, et toute tentative d'y glisser une
  // identité (companyId, permissions, abonnement…) est ignorée ET signalée.
  //
  // `liveEnabled: false` est un PLANCHER : aucune action à effet externe réel (e-mail, portail
  // de facturation) ne peut être autorisée localement, quoi que demande le client.
  const accountContext = resolveAccountContext({ viewer, entitlement, tenant, plan, at });
  const care: CareEnvelope = buildCareEnvelope({
    message,
    account: accountContext,
    rawPageContext: (body as { page_context?: unknown } | null)?.page_context ?? null,
    // C1.6 : la PERTINENCE d'un blocage de compte dépend de la DEMANDE. Sur une question
    // publique (« quels sont les prix ? »), CloneChat ne rappelle pas à l'utilisateur ce qui
    // manque à son compte : ce n'est pas ce qu'on lui a demandé.
    requestClass,
    currentPageVersion: null,
    liveEnabled: false, // ← jamais d'effet externe réel depuis cette route en l'état
  });

  // Toute réponse émise À PARTIR D'ICI porte l'enveloppe de support. Purement ADDITIF :
  // aucun champ existant n'est modifié, aucune réponse C1.6/C1.7 n'est altérée.
  const reply = (json: Record<string, unknown>, status = 200) =>
    noStore({ ...json, care, rendered: buildRenderedResponse({ ...json, care }, care as unknown as Record<string, unknown>) }, status);

  // ── C1.8 — PERSISTANCE D'HISTORIQUE INDÉPENDANTE DE LA VOIE ──────────────────
  // Défaut trouvé en QA navigateur authentifiée : la persistance (persistUser/persistAssistant)
  // vivait UNIQUEMENT dans la voie ENTREPRISE. Or un message conversationnel (« bonjour ») prend
  // la voie PUBLIQUE — même pour un membre d'entreprise. Résultat : la conversation existait mais
  // restait VIDE, et la réouverture n'affichait aucun message. La persistance ne dépend pas de la
  // façon dont la réponse est produite : dès qu'il y a une identité AUTHENTIFIÉE, un tenant résolu
  // SERVEUR et un `conversation_id`, le tour est enregistré. L'anonyme (tenant null) ne persiste
  // jamais côté serveur — son historique vit dans le navigateur.
  const convCtx = (viewer.kind === "user" && tenant?.ok && conversationId)
    ? { userId: viewer.userId, companyId: tenant.companyId } : null;
  const persistPublicTurn = async (answerText: string) => {
    if (!convCtx || !conversationId || !message) return;
    try {
      await stores.conversations.appendMessage(conversationId, convCtx, { role: "user", content: [{ type: "text", text: message }], at });
      await stores.conversations.appendMessage(conversationId, convCtx, { role: "assistant", content: [{ type: "text", text: answerText }], at: now() });
    } catch { /* persistance best-effort : ne casse JAMAIS le tour */ }
  };

  // ── C1.9 — OBSERVATION SHADOW ────────────────────────────────────────────────
  // Appelée UNIQUEMENT après que la réponse stable a été produite (et persistée), donc
  // jamais sur le chemin critique de ce que voit l'utilisateur. Elle ne renvoie rien :
  // son unique effet autorisé est d'écrire une comparaison dans le journal.
  //
  // Invariants garantis ici, en plus de ceux du runtime :
  //   — `mode !== "shadow"` ⇒ aucun appel, aucun coût ;
  //   — toute exception est absorbée : un shadow en panne est un shadow absent ;
  //   — aucune persistance, aucun outil, aucune proposition, aucun CTA.
  const c19Mode = readC19Mode();
  const runShadow = async (legacy: {
    answer: string; source: string; honesty: string; hasCta: boolean;
  }): Promise<void> => {
    if (c19Mode !== "shadow") return;
    try {
      const outcome = await runShadowComparison({
        requestId: conversationId ?? `${at}:${message.length}`,
        message,
        history: (body?.history ?? []).slice(-6),
        viewer: PUBLIC_VIEWER, // voie publique : aucune source tenant, aucun contexte privé
        candidates: collectCandidateChunks({ question: message }),
        serverCountry: null,
        at,
        apiKey: key,
        legacyAnswer: legacy.answer,
        legacySource: legacy.source,
        legacyHonesty: legacy.honesty,
        legacyHasCta: legacy.hasCta,
      });
      recordShadowComparison(outcome.comparison);
    } catch {
      /* le shadow ne peut jamais dégrader un tour : on l'oublie silencieusement */
    }
  };

  // ── C1.9 — MODE `on` : la pipeline OpenAI devient la voie AFFICHÉE ───────────
  // La pipeline n'est pas incrémentale : elle comprend, récupère, raisonne, compose puis
  // VÉRIFIE avant de rendre un texte. On ne prétend donc pas diffuser jeton par jeton —
  // on calcule entièrement, puis on envoie une réponse finale déjà vérifiée (§13, option B).
  // En `on`, le shadow ne tourne pas : il n'y a plus deux voies à comparer, et un second
  // appel serait un coût sans objet.
  const runC19Primary = async (): Promise<{
    answer: string; citations: readonly string[]; status: string; clarifying: boolean;
  } | null> => {
    if (c19Mode !== "on" || !key) return null;
    try {
      const port = createOpenAIC19Port(key, loadC19ModelConfig(), createTokenBudget(60_000));
      const r = await runCloneChatIntelligence(port, {
        turnId: conversationId ?? `${at}:${message.length}`,
        message,
        history: (body?.history ?? []).slice(-6),
        memory: EMPTY_MEMORY,
        viewer: PUBLIC_VIEWER,
        candidates: collectCandidateChunks({ question: message }),
        serverCountry: null,
        at,
        mode: "on",
      });
      // Une pipeline dégradée ne doit PAS s'afficher : mieux vaut la voie stable que du vide.
      if (r.status === "degraded" || r.answer.trim().length === 0) return null;
      return {
        answer: r.answer,
        citations: r.citations.map((c) => String(c)),
        status: r.status,
        clarifying: r.status === "clarification_required",
      };
    } catch {
      return null; // repli sur la voie stable, jamais d'échec de tour
    }
  };

  // ── CloneChat Unified Intelligence — PRIMAIRE et SEULE voie sur le public ───
  // Un seul appel OpenAI ; aucun routage par mots-clés ; le modèle décide lui-même.
  //
  // Défaut réel trouvé en production (2026-07-24) : un échec du moteur unifié (clé absente,
  // erreur OpenAI, timeout, réponse vide) était avalé SILENCIEUSEMENT (aucun log, `return null`
  // nu), et la route retombait alors sur l'ancienne voie commerciale (analyzeSalesTurn +
  // pricingChunk) — exactement le défaut que ce moteur devait corriger, invisible car non
  // journalisé. Corrigé : chaque échec est désormais journalisé (structuré, sans secret), et
  // la voie publique NE RETOMBE PLUS JAMAIS sur l'ancien pipeline commercial (voir call sites) —
  // un échec produit un message d'indisponibilité honnête, jamais une fiche prix.
  const runUnifiedPrimary = async (): Promise<{
    answer: string; citations: readonly string[]; suggestCard: boolean; usedWebSearch: boolean;
  } | null> => {
    const unifiedKey = readOpenAIKeyLazy(); // journalise déjà elle-même l'absence en production
    if (!unifiedKey) return null;
    try {
      const r = await respondUnified({
        apiKey: unifiedKey,
        config: loadResponderConfig(),
        message,
        history: (body?.history ?? []).slice(-6).map((h) => ({ role: h.role, text: h.text })),
        signal: req.signal,
      });
      if (!r.ok || r.answer.trim().length === 0) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({
          event: "clonechat_unified_primary_failure",
          at: now(),
          errorCode: r.error ?? "empty_answer",
        }));
        return null;
      }
      const citations = r.webSources.map((s) => s.url);
      return { answer: r.answer, citations, suggestCard: r.suggestCard, usedWebSearch: r.usedWebSearch };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ event: "clonechat_unified_primary_failure", at: now(), errorCode: "exception", message: e instanceof Error ? e.message : "unknown" }));
      return null;
    }
  };

  // Message d'indisponibilité HONNÊTE quand le moteur unifié échoue sur la voie publique —
  // jamais de prix, jamais de CTA. Remplace le repli vers l'ancien pipeline commercial.
  const UNIFIED_UNAVAILABLE_MESSAGE = "CloneChat rencontre momentanément un problème de connexion à son modèle. Réessayez dans quelques instants.";

  // Limitation d'abus de la voie anonyme (jamais une porte : un message honnête + réessai).
  if (viewer.kind === "anonymous") {
    const rl = checkAnonymousRateLimit(anonymousFingerprint(req.headers));
    if (!rl.allowed) {
      const msg = anonymousRateLimitMessage(rl.retryAfterSeconds);
      return reply({
        ok: true, source: "rate_limited", public: true, retryAfterSeconds: rl.retryAfterSeconds,
        structured: { answer: msg, honesty: "answered", tool_call: null, citations: [] },
      });
    }
  }

  // Prérequis manquants POUR LA DEMANDE (peut être vide). Ils accompagnent la réponse ; ils
  // ne la remplacent pas : CloneChat répond d'abord, puis dit ce qui manque pour aller plus loin.
  const missing = plan.missingPrerequisites;
  const prereq = missing.length > 0
    ? { prerequisites: missing, prerequisiteMessage: prerequisiteMessage(missing, requestClass), cta: prerequisiteCta(missing) }
    : null;

  // Pièces jointes : un document RH appartient au TENANT — il n'est analysable QUE sur la voie
  // ENTREPRISE. Mais un refus de document n'éteint PAS la conversation : on l'explique et on
  // continue de parler (§2/§6).
  const hasAttachments = rawAttachments.length > 0 || (body?.images?.length ?? 0) > 0;

  // ── C1.7 §5 — REVALIDATION SERVEUR (la validation client N'EST PAS une frontière) ──
  // Le corps de la requête peut être FORGÉ : on reclasse chaque fichier ici, avec le module
  // canonique. Exécutables, archives, extensions déguisées, MIME incohérent, fichiers vides,
  // trop gros, trop nombreux : refusés côté SERVEUR, quoi qu'ait affirmé le navigateur.
  const serverManifest = buildManifest(rawAttachments.map((a) => ({
    name: typeof a?.filename === "string" ? a.filename : "fichier",
    mime: typeof a?.mime_type === "string" ? a.mime_type : "application/octet-stream",
    // La taille FAIT FOI côté serveur : on la recalcule depuis le base64 réellement reçu.
    size: typeof a?.data === "string" ? Math.floor((a.data.length * 3) / 4) : 0,
    relativePath: typeof a?.relative_path === "string" ? a.relative_path : undefined,
  })));
  const acceptedIdx = new Set(serverManifest.map((e, i) => (e.state === "rejected" ? -1 : i)).filter((i) => i >= 0));
  const serverRejected = serverManifest
    .filter((e) => e.state === "rejected")
    .map((e) => ({ name: e.displayName, path: e.relativePath, reason: e.rejection?.message ?? "refusé" }));

  // Échec tenant SENSIBLE (membership suspendu / entreprise indisponible) : aucune donnée
  // privée n'est servie. Mais un accès suspendu n'a jamais interdit de demander les prix :
  // la conversation PUBLIQUE reste ouverte (C1.6 §1). Seul le contexte privé est coupé.
  if (plan.tenantSecurityFailure && (requestClass === "PRIVATE_CONTEXT_REQUIRED" || requestClass === "GOVERNED_ACTION_REQUIRED")) {
    const refusal = tenant as Extract<TenantResolution, { ok: false }>;
    return reply({
      ok: true, source: "company_access_suspended", public: true, code: refusal.code,
      structured: {
        answer: "Votre accès à cette entreprise est suspendu : je ne peux pas consulter ses données ni agir dessus. Je reste disponible pour toutes vos autres questions.",
        honesty: "answered", tool_call: null, citations: [],
      },
    });
  }

  // ── VOIE PUBLIQUE — LA MÊME CONVERSATION POUR TOUS ────────────────────────────
  // Anonyme, sans entreprise, sans Pierre, ou tenant en défaut : MÊME moteur, MÊMES sources
  // publiques, MÊME personnalité. Aucune source tenant, aucune délégation, aucune mission.
  if (plan.lane === "PUBLIC") {

    // ── C1.7 §7 — PIÈCES JOINTES ÉPHÉMÈRES (anonyme ou sans entreprise) ──────────
    // L'utilisateur peut analyser SES propres fichiers. `companyId: null` : aucune entreprise
    // n'est fabriquée, aucun stockage durable, aucune autre session, aucun accès tenant.
    const ephemeral: AttachmentIngestionResult[] = [];
    let ephBudget = MAX_TOTAL_BASE64_CHARS;
    for (let i = 0; i < rawAttachments.length; i++) {
      if (!acceptedIdx.has(i)) continue; // refusé par la revalidation SERVEUR
      const a = rawAttachments[i];
      const data = typeof a?.data === "string" ? a.data : "";
      if (data.length === 0 || data.length > ephBudget) continue;
      ephBudget -= data.length;
      const bytes = decodeBase64(data);
      if (!bytes) continue;
      try {
        ephemeral.push(await ingestAttachment({
          filename: typeof a?.filename === "string" ? a.filename : "fichier",
          declaredMime: typeof a?.mime_type === "string" ? a.mime_type : "application/octet-stream",
          bytes,
          companyId: null, // ← ÉPHÉMÈRE : jamais un tenant
          conversationId: null, uploadedBy: null, at,
        }));
      } catch { /* une pièce jointe défaillante n'échoue jamais le tour */ }
    }

    // Images du visiteur : assainies par le pipeline EXISTANT (EXIF retiré, formats bornés).
    const pubImgs = sanitizeImages(body?.images ?? []);
    const pubPrepared = pubImgs.accepted.length > 0 ? await prepareImagesForModel(pubImgs.accepted) : null;
    const pubImageUrls = pubPrepared?.dataUrls ?? [];
    // Détail visuel : ÉCONOMIQUE par défaut ; « high » seulement si la question le justifie.
    const pubImageDetail = imageDetailFor(message);

    // ASSERTION DE VISIBILITÉ SERVEUR, AVANT tout appel modèle : le corpus public ne doit
    // contenir AUCUNE source tenant / interne / secrète (fail-closed si jamais c'était le cas).
    const publicIndex = buildKnowledgeIndex({ question: message, viewer: PUBLIC_VIEWER });
    if (indexLeaksForbiddenSources(publicIndex, PUBLIC_VIEWER)) {
      return reply({ ok: true, source: "public_blocked", discovery: true, structured: { answer: "Je ne peux pas répondre en mode découverte pour le moment.", honesty: "unknown", tool_call: null, citations: [] } });
    }

    // BUDGET : scope UTILISATEUR + global, companyId = null — JAMAIS de fausse entreprise.
    // Le magasin de budget peut être indisponible (DB non provisionnée) : dans ce cas on
    // DÉGRADE en repli public DÉTERMINISTE (aucun appel modèle sans réservation) plutôt que
    // d'échouer — une question publique doit toujours obtenir une vraie réponse.
    const pubEst = Math.ceil((message.length || 40) / 4) + 400;
    const NO_RESERVATION = { granted: false as const, reason: null, scopes: [] as string[], reservedTokens: 0, maxOutputTokens: 0 };
    let pubReservation: Awaited<ReturnType<typeof stores.budget.reserve>> = NO_RESERVATION;
    try {
      pubReservation = await stores.budget.reserve(cfg, { userId, companyId: null }, pubEst, at);
    } catch {
      pubReservation = NO_RESERVATION; // budget indisponible → jamais de modèle, repli déterministe
    }
    // ── C1.7 §8 — STREAMING RÉEL (voie publique) ──────────────────────────────
    // Extension de la route CANONIQUE (aucune seconde route). Les morceaux viennent VRAIMENT du
    // provider ; on ne révèle jamais une réponse déjà complète lettre par lettre.
    //
    // GARDE : une phrase n'est diffusée QUE lorsqu'elle est complète ET passée par la garde de
    // claims C1 — sinon on montrerait du texte non gardé avant de le corriger.
    //
    // ── BLOC 13 — CHEMIN ACTIF DURCI (jamais Production ici) ───────────────────────
    // Streaming RÉEL passé par le circuit breaker + timeout provider + budget de sortie borné +
    // fermeture unique + abort → cancelled (machinerie stream-guard commune, testée). Le provider est
    // le VRAI runUnifiedPrimary (ou un provider synthétique injecté en test, fail-closed). Off/shadow
    // n'entrent jamais ici (hActive faux) : le chemin historique ci-dessous reste strictement inchangé.
    if (hActive && body?.stream === true && pubReservation.granted && !!key && cfg.enabled) {
      const gateA = createSentenceGate((t) => finalizeAnswerText(t).safeText);
      let committedA = false;
      const donePrereq = prereq ? { prerequisites: prereq.prerequisites, prerequisiteMessage: prereq.prerequisiteMessage, cta: prereq.cta } : {};
      const realProduce = async (emit: (d: string) => void): Promise<{ donePayload: unknown }> => {
        const unified = await runUnifiedPrimary();
        if (unified) {
          for (const s of gateA.push(unified.answer)) emit(s);
          for (const r of gateA.flush()) emit(r);
          await persistPublicTurn(unified.answer);
          try { await stores.budget.commit(pubReservation, 0); } catch { /* comptabilité best-effort */ }
          committedA = true;
          return { donePayload: {
            ok: true, source: "clonechat_unified", public: true, anonymous: viewer.kind === "anonymous", requestClass, ...donePrereq,
            structured: { answer: unified.answer, honesty: "answered", tool_call: null, citations: unified.citations },
            ...(unified.suggestCard ? { suggestedCTA: true } : {}),
            runtime: { provider: "openai", engine: "unified", usedWebSearch: unified.usedWebSearch, streamed: true, hardened: true },
          } };
        }
        for (const s of gateA.push(UNIFIED_UNAVAILABLE_MESSAGE)) emit(s);
        for (const r of gateA.flush()) emit(r);
        return { donePayload: {
          ok: true, source: "clonechat_unified_unavailable", public: true, anonymous: viewer.kind === "anonymous", requestClass, ...donePrereq,
          structured: { answer: UNIFIED_UNAVAILABLE_MESSAGE, honesty: "unknown", tool_call: null, citations: [] },
          runtime: { provider: "openai", engine: "unified", streamed: true, unavailable: true, hardened: true },
        } };
      };
      const produce = activeStreamProduceForTests() ?? realProduce;
      const activeStream = buildActiveHardenedStream({
        produce, breaker: hardening.breakerFor("openai:public-stream"), config: hardening.config, parentSignal: req.signal,
        onProviderError: (e) => { const f = classifyProviderFailure(e); return { code: f.code, message: f.message }; },
        onFinished: async () => { if (!committedA) { try { await stores.budget.release(pubReservation); } catch { /* ignore */ } } },
      });
      return new Response(activeStream, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" },
      });
    }
    if (body?.stream === true && pubReservation.granted && !!key && cfg.enabled) {
      const routerCfg0 = loadModelRouterConfig();
      const routing0 = routeModel({ message, requestClass, documentCount: rawAttachments.length, imageCount: body?.images?.length ?? 0 }, routerCfg0);
      const model0 = isAllowedModel(routing0.model, routerCfg0) ? routing0.model : routerCfg0.defaultModel;
      const ceiling0 = Math.min(pubReservation.maxOutputTokens, routing0.maxOutputTokens);

      const encoder = new TextEncoder();
      const sink: StreamingResponderResult = { usage: null, providerCalled: false };
      let settled = false;
      // Réponse stable à comparer, retenue le temps que le flux se ferme (voir `finally`).
      const shadowPayload: { answer: string; source: string; honesty: string; hasCta: boolean } | null = null;

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (e: Parameters<typeof encodeStreamEvent>[0]) => {
            try { controller.enqueue(encoder.encode(encodeStreamEvent(e))); } catch { /* client parti */ }
          };
          // La garde de claims s'applique AVANT diffusion, phrase par phrase.
          const gate = createSentenceGate((t) => finalizeAnswerText(t).safeText);

          try {
            // CloneChat Unified Intelligence — PRIMAIRE : un seul appel, le modèle décide.
            // Essayé avant C1.9 et avant la voie legacy ; repli silencieux si absent/en échec.
            const unified = await runUnifiedPrimary();
            if (unified) {
              for (const sentence of gate.push(unified.answer)) send({ type: "delta", text: sentence });
              for (const rest of gate.flush()) send({ type: "delta", text: rest });
              settled = true;
              await persistPublicTurn(unified.answer);
              try { await stores.budget.commit(pubReservation, 0); } catch { /* comptabilité best-effort */ }
              send({ type: "done", payload: {
                ok: true, source: "clonechat_unified", public: true,
                anonymous: viewer.kind === "anonymous", requestClass,
                ...(prereq ? { prerequisites: prereq.prerequisites, prerequisiteMessage: prereq.prerequisiteMessage, cta: prereq.cta } : {}),
                structured: { answer: unified.answer, honesty: "answered", tool_call: null, citations: unified.citations },
                ...(unified.suggestCard ? { suggestedCTA: true } : {}),
                runtime: { provider: "openai", engine: "unified", usedWebSearch: unified.usedWebSearch, streamed: true },
              } });
              return;
            }

            // Le moteur unifié a échoué (journalisé plus haut dans runUnifiedPrimary). Sur la
            // voie publique, on NE RETOMBE PLUS sur l'ancien pipeline commercial (C1.9 +
            // analyzeSalesTurn/answerPublicQuestion) : c'est exactement ce fallback qui affichait
            // une fiche prix hors sujet. Un échec de modèle produit un message d'indisponibilité
            // honnête, jamais un CTA. La réservation de budget n'a servi à aucun appel : elle est
            // relâchée par le `finally` (settled reste false). `requestClass`/prérequis restent
            // présents : ce sont des champs de GOUVERNANCE, pas du commercial — inchangés.
            for (const sentence of gate.push(UNIFIED_UNAVAILABLE_MESSAGE)) send({ type: "delta", text: sentence });
            for (const rest of gate.flush()) send({ type: "delta", text: rest });
            send({ type: "done", payload: {
              ok: true, source: "clonechat_unified_unavailable", public: true,
              anonymous: viewer.kind === "anonymous", requestClass,
              ...(prereq ? { prerequisites: prereq.prerequisites, prerequisiteMessage: prereq.prerequisiteMessage, cta: prereq.cta } : {}),
              structured: { answer: UNIFIED_UNAVAILABLE_MESSAGE, honesty: "unknown", tool_call: null, citations: [] },
              runtime: { provider: "openai", engine: "unified", streamed: true, unavailable: true },
            } });
            return;
          } catch (e) {
            // Une annulation reste une ANNULATION : jamais un faux « terminé ».
            if (req.signal?.aborted) {
              send({ type: "cancelled", reason: "Réponse interrompue." });
            } else {
              const f = classifyProviderFailure(e); // timeout ≠ rate limit ≠ erreur provider
              send({ type: "error", code: f.code, message: f.message });
            }
          } finally {
            if (!settled) { try { await stores.budget.release(pubReservation); } catch { /* ignore */ } }
            try { controller.close(); } catch { /* déjà fermé */ }
            // Flux FERMÉ : le tour de l'utilisateur est terminé et affiché. L'observation
            // ne peut donc plus lui coûter la moindre milliseconde.
            if (shadowPayload) await runShadow(shadowPayload);
          }
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" },
      });
    }

    // INVARIANT : aucun appel modèle sans réservation de budget accordée.
    const useModel = pubReservation.granted && !!key && cfg.enabled;
    let pubSettled = false;
    // Instrumentation du responder EXISTANT (simple décorateur — AUCUN second client) :
    // capture l'usage RÉEL du provider pour la preuve runtime (jamais la clé).
    type ProviderUsage = Parameters<typeof buildUsageRecord>[0]["usage"];
    let providerUsage: ProviderUsage | null = null;
    let providerResponder: ParrainResponderPort | null = null;
    // ORDONNANCEMENT MESURÉ (jamais une constante d'auto-certification) : une horloge
    // logique monotone date la réservation et le franchissement du provider. Si le provider
    // était appelé sans réservation, `reservedSeq` resterait 0 et l'invariant serait FAUX
    // dans la preuve — c'est ce qui rend la preuve réfutable.
    let seq = 0;
    const reservedSeq = pubReservation.granted ? ++seq : 0;
    let providerSeq = 0;
    if (useModel) {
      const realResponder = createRealOpenAIResponder(key!);
      providerResponder = {
        async respond(r) {
          providerSeq = ++seq; // daté AVANT le franchissement réseau
          const res = await realResponder.respond(r);
          providerUsage = (res.usage as ProviderUsage) ?? null;
          return res;
        },
      };
    }
    try {
      // ── CloneChat Unified Intelligence — PRIMAIRE (voie NON streamée) ──────────
      // Essayé AVANT tout appel du responder legacy ci-dessous : en cas de succès, la voie
      // legacy n'est jamais invoquée (un seul appel OpenAI pour ce tour, pas deux).
      // INVARIANT (voie streamée : déjà garanti par le `if (... && pubReservation.granted ...)`
      // qui entoure son propre appel) : AUCUN appel modèle sans réservation de budget accordée.
      // `runUnifiedPrimary` ne connaît pas `pubReservation` (défini hors de sa fermeture) — le
      // garde-fou est donc explicite ici, au point d'appel.
      const unifiedNonStream = pubReservation.granted ? await runUnifiedPrimary() : null;
      if (unifiedNonStream) {
        await persistPublicTurn(unifiedNonStream.answer);
        return reply({
          ok: true, source: "clonechat_unified", public: true,
          anonymous: viewer.kind === "anonymous", requestClass,
          ...(prereq ? { prerequisites: prereq.prerequisites, prerequisiteMessage: prereq.prerequisiteMessage, cta: prereq.cta } : {}),
          structured: { answer: unifiedNonStream.answer, honesty: "answered", tool_call: null, citations: unifiedNonStream.citations },
          ...(unifiedNonStream.suggestCard ? { suggestedCTA: true } : {}),
          runtime: { provider: "openai", engine: "unified", usedWebSearch: unifiedNonStream.usedWebSearch, streamed: false },
        });
      }

      // Le moteur unifié a échoué (journalisé plus haut dans runUnifiedPrimary). Sur la voie
      // publique, on NE RETOMBE PLUS sur l'ancien pipeline commercial (routage legacy +
      // analyzeSalesTurn/answerPublicQuestion, ni C1.9) : c'est exactement ce fallback qui
      // affichait une fiche prix hors sujet. La réservation de budget n'a servi à aucun appel :
      // `pubSettled` reste false, le `finally` plus bas la relâche normalement. `requestClass`/
      // prérequis restent présents : ce sont des champs de GOUVERNANCE, pas du commercial.
      return reply({
        ok: true, source: "clonechat_unified_unavailable", public: true,
        anonymous: viewer.kind === "anonymous", requestClass,
        ...(prereq ? { prerequisites: prereq.prerequisites, prerequisiteMessage: prereq.prerequisiteMessage, cta: prereq.cta } : {}),
        structured: { answer: UNIFIED_UNAVAILABLE_MESSAGE, honesty: "unknown", tool_call: null, citations: [] },
        runtime: { provider: "openai", engine: "unified", streamed: false, unavailable: true },
      });
    } catch {
      // Échec modèle → repli PUBLIC déterministe honnête, réservation libérée (0 token).
      if (pubReservation.granted && !pubSettled) { pubSettled = true; try { await stores.budget.release(pubReservation); } catch { /* ignore */ } }
      const fb = await answerPublicQuestion({ question: message, at });
      return reply({
        ok: true, source: "public_fallback", public: true, discovery: true,
        anonymous: viewer.kind === "anonymous", requestClass,
        ...(prereq ? { prerequisites: prereq.prerequisites, prerequisiteMessage: prereq.prerequisiteMessage, cta: prereq.cta } : {}),
        structured: { answer: fb.answer, honesty: publicHonesty(fb.honesty), tool_call: null, citations: [] },
        usageTokens: 0, durable: false,
      });
    } finally {
      if (pubReservation.granted && !pubSettled) { try { await stores.budget.release(pubReservation); } catch { /* ignore */ } }
    }
  }

  // ── VOIE ENTREPRISE (plan.lane === "COMPANY") ────────────────────────────────
  // À ce stade UNIQUEMENT : identité vérifiée + entreprise ACTIVE résolue serveur + droit
  // Pierre VALIDE. Toutes les autres situations ont déjà répondu par la voie PUBLIQUE.
  // Gardes défensives (inatteignables) qui bornent aussi les types.
  if (viewer.kind !== "user" || tenant === null || !tenant.ok) return tenantRefusalResponse((tenant ?? { ok: false, code: "MEMBERSHIP_REQUIRED" }) as Extract<TenantResolution, { ok: false }>);

  const ctx = { companyId: tenant.companyId, userId: viewer.userId };

  // ── C1.1 §5 : INGESTION des pièces jointes documentaires (serveur autoritaire) ──
  // Le companyId vient du tenant résolu serveur ; le MIME est re-détecté ; le statut de
  // parsing n'est jamais lu du client ; un format non pris en charge est refusé honnêtement.
  const ingested: AttachmentIngestionResult[] = [];
  let base64Budget = MAX_TOTAL_BASE64_CHARS;
  for (const a of rawAttachments) {
    const filename = typeof a?.filename === "string" ? a.filename : "fichier";
    const declaredMime = typeof a?.mime_type === "string" ? a.mime_type : "application/octet-stream";
    const data = typeof a?.data === "string" ? a.data : "";
    if (data.length === 0 || data.length > base64Budget) continue;
    base64Budget -= data.length;
    const bytes = decodeBase64(data);
    if (!bytes) continue;
    try {
      ingested.push(await ingestAttachment({
        filename, declaredMime, bytes,
        companyId: tenant.companyId, // ← serveur, jamais le corps client
        conversationId, uploadedBy: userId, at,
      }));
    } catch { /* une pièce jointe défaillante n'échoue jamais le tour */ }
  }
  const attachmentSummaries = ingested.map((r) => r.attachment);
  const documentFindings = ingested.map((r) => r.honestSummary);

  // Persistance durable du message utilisateur (best-effort ; n'échoue jamais le tour).
  const persistUser = async () => {
    if (!conversationId) return;
    try { await stores.conversations.appendMessage(conversationId, ctx, { role: "user", content: [{ type: "text", text: message }], at }); } catch { /* not found / no persistence */ }
  };
  const persistAssistant = async (content: unknown[], extra?: { sourceIds?: string[]; usage?: unknown; imageMeta?: unknown }) => {
    if (!conversationId) return;
    try { await stores.conversations.appendMessage(conversationId, ctx, { role: "assistant", content, sourceIds: extra?.sourceIds, usage: extra?.usage, imageMeta: extra?.imageMeta, at: now() }); } catch { /* ignore */ }
  };

  /** Repli déterministe HONNÊTE : il ne prétend JAMAIS avoir analysé une pièce jointe. */
  const deterministicFallback = async (source = "fallback") => {
    const det = createDeterministicResponder();
    const r = await det.respond({ model: "deterministic", system: "", userText: message, maxOutputTokens: 0 });
    const base = r.structured ?? { answer: "Je reste disponible pour vous orienter et consulter votre espace.", honesty: "answered" as const, tool_call: null, citations: [] };
    let answer = base.answer;
    if (ingested.length > 0) {
      const parsed = ingested.filter((a) => a.chunks.length > 0);
      answer += parsed.length > 0
        ? `\n\nVos fichiers ont été reçus et leur texte extrait (${parsed.map((a) => a.attachment.filename).join(", ")}), mais l'analyse approfondie n'est pas disponible pour le moment — je ne vais pas prétendre l'avoir faite.`
        : `\n\nVos fichiers ont été reçus mais n'ont pas pu être analysés — je ne devine jamais le contenu d'un fichier.`;
    }
    const guarded = finalizeAnswerText(answer);
    const structured = { ...base, answer: guarded.safeText, citations: [] as string[] };
    await persistAssistant([{ type: "text", text: structured.answer }]);
    return reply({ ok: true, source, structured, attachments: attachmentSummaries, documentFindings, durable: stores.durable });
  };

  await persistUser();

  if (!key || !cfg.enabled) return deterministicFallback("disabled_fallback");

  // ── 4) BUDGET DUR ATOMIQUE : réservation AVANT tout appel modèle ────────────
  const extractedChars = ingested.reduce((acc, a) => acc + a.attachment.extractedTextLength, 0);
  const est = Math.ceil((message.length || 40) / 4) + 400 + (body?.images?.length ? 600 : 0) + Math.ceil(extractedChars / 4);
  const reservation = await stores.budget.reserve(cfg, ctx, est, at);
  if (!reservation.granted) return deterministicFallback("budget_fallback");

  // 4bis) Mémoire de support (durable) : cas connu RÉUTILISABLE VÉRIFIÉ uniquement.
  let reusable: Awaited<ReturnType<typeof stores.support.findReusable>> | null = null;
  if (BUG_HINT.test(message)) reusable = await stores.support.findReusable(message);

  // Comptabilité budget garantie : commit règle la réservation ; le `finally` libère TOUTE
  // réservation non réglée (panne, retour anticipé, exception).
  let settled = false;
  const commit = async (tokens: number) => { if (settled) return; settled = true; await stores.budget.commit(reservation, Math.max(0, tokens)); };
  try {
    // ── 5) Chemin MULTIMODAL (pipeline image EXISTANT — aucune seconde pile) ───
    const rawImgs = sanitizeImages(body?.images);
    if (rawImgs.accepted.length > 0) {
      try {
        const prepared = await prepareImagesForModel(rawImgs.accepted);
        // Transformation pixel OBLIGATOIRE : aucune image survivante → refus honnête, 0 token.
        if (prepared.dataUrls.length === 0) {
          await commit(0);
          return reply({ ok: true, source: "image_unavailable", structured: { answer: "Je ne peux pas traiter cette image pour le moment (transformation d'image indisponible). Réessayez, ou décrivez ce que vous voyez.", honesty: "unknown", tool_call: null, citations: [] }, imageSanitization: prepared.report, rejectedImages: [...rawImgs.rejected, ...prepared.rejected], attachments: attachmentSummaries, durable: stores.durable });
        }
        const shot = await analyzeScreenshotReal(key, { model: cfg.model, userText: message, imageDataUrls: prepared.dataUrls, maxOutputTokens: reservation.maxOutputTokens });
        const tokens = shot.usage.inputTokens + shot.usage.outputTokens;
        await commit(tokens);
        if (tokens > 0) await stores.budget.recordUsage(buildUsageRecord({ usage: shot.usage, userId, companyId: tenant.companyId, at: now(), imageCount: prepared.dataUrls.length }));
        if (!shot.ok || !shot.analysis) return deterministicFallback();
        const a = shot.analysis;
        const symptomText = [a.summary, ...a.visibly_proven].join(". ");
        const match = await stores.support.findReusable(symptomText);
        if (!match.matched) await stores.support.report(ctx, { symptoms: symptomText, route: "screenshot", evidence: a.visibly_proven.map((t) => ({ kind: "screenshot_finding", text: redactSymptom(t), at: now() })), at: now() });
        await persistAssistant([{ type: "text", text: a.summary }], { imageMeta: prepared.meta });
        return reply({ ok: true, source: "openai_vision", analysis: a, knownIssue: match.matched ? { title: match.case!.title, workaround: match.case!.workaround, solution: match.case!.solution, reusable: match.case!.reusable } : null, imageSanitization: prepared.report, rejectedImages: rawImgs.rejected, attachments: attachmentSummaries, documentFindings, usageTokens: tokens, durable: stores.durable });
      } catch {
        return deterministicFallback();
      }
    }

    // ── 6) Appel OpenAI RÉEL, GROUNDÉ SUR C1.1 (citations validées serveur) ────
    try {
      const responder = createRealOpenAIResponder(key);

      // Viewer résolu SERVEUR (mode client ; le mode fondateur passe par l'adaptateur interne).
      const viewer = clientViewer(tenant.companyId, ctx.userId);

      // Contexte de session BORNÉ : entreprise (lecture seule V1) + pièces jointes tenant.
      const sessionChunks: ParrainKnowledgeChunk[] = [];
      try {
        const snapshot = await buildAccountContextSnapshot(createLoopbackAccountPort(req, tenant.companyId), viewer, message, at);
        if (snapshot) sessionChunks.push(...accountSnapshotChunks(snapshot));
      } catch { /* contexte compte indisponible : on continue sans, jamais de fuite */ }
      for (const a of ingested) {
        if (a.attachment.companyId === tenant.companyId) sessionChunks.push(...attachmentGroundingChunks(a));
      }

      const grounded = buildParrainGroundedPrompt({
        question: message,
        viewer,
        sessionChunks,
        retrieval: { referencedIds: resolveReferencedIds(message, ingested) },
      });

      const result = await responder.respond({ model: cfg.model, system: grounded.system, userText: message, history: (body?.history ?? []).slice(-6), maxOutputTokens: reservation.maxOutputTokens });
      const tokens = result.usage.inputTokens + result.usage.outputTokens;
      await commit(tokens);
      if (tokens > 0) await stores.budget.recordUsage(buildUsageRecord({ usage: result.usage, userId, companyId: tenant.companyId, at: now() }));
      if (!result.ok || !result.structured) return deterministicFallback();

      let structured = result.structured;

      // Citations : ne garder que les IDs réellement présents dans le contexte C1.1 fourni.
      const cited = validateParrainCitations(structured.citations ?? [], grounded.contextChunks, "client");
      structured = { ...structured, citations: [...cited.valid] };

      // Support (durable) : cas connu vérifié → contournement adossé ; sinon consigné.
      if (reusable?.matched && reusable.case) {
        const fix = reusable.case.workaround ?? reusable.case.solution;
        if (fix) structured = { ...structured, answer: `${structured.answer}\n\nContournement connu (vérifié) : ${fix}` };
        await stores.support.report(ctx, { symptoms: message, at: now() });
      } else if (BUG_HINT.test(message)) {
        await stores.support.report(ctx, { symptoms: message, evidence: [{ kind: "symptom", text: redactSymptom(message), at: now() }], at: now() });
      }

      // ── Garde de claims C1 (fail-closed) : aucune revendication live ne sort d'ici ──
      const guarded = finalizeAnswerText(structured.answer);
      structured = { ...structured, answer: guarded.safeText, ...(guarded.violated ? { honesty: "unknown" as const } : {}) };

      const staleSources = grounded.retrieval.staleSourceIds;
      const confidence = guarded.violated ? "low" : staleSources.length > 0 ? "medium" : cited.valid.length > 0 ? "high" : "medium";

      await persistAssistant([{ type: "text", text: structured.answer }], { sourceIds: [...cited.valid], usage: { totalTokens: tokens } });

      // Action EFFECTIVE proposée par le modèle : le SERVEUR dérive le payload canonique,
      // PERSISTE la proposition et ne renvoie qu'une RÉFÉRENCE. Rien n'est exécuté ici :
      // la confirmation passe par /api/assistant/execute (SHA-256, claim atomique, V1).
      let proposal: Awaited<ReturnType<typeof buildAndPersistProposal>> = null;
      try {
        proposal = await buildAndPersistProposal({ toolCall: structured.tool_call ?? null, userMessage: message, identity: ctx, conversationId, proposals: stores.proposals, req, at: now() });
      } catch { proposal = null; }

      // ── P16C : pour un travail RH (proposition de mission), calcule le résumé de gouvernance
      // CLIENT-SAFE (Pierre Ultimate → T1/T2 → CloneOS, le plus strict gagne). ADDITIF, LECTURE SEULE :
      // aucune exécution, aucun effet, aucun chemin interne exposé. L'exécution reste derrière /execute.
      // Best-effort : ne fait jamais échouer le tour ; companyId/actorId viennent du serveur.
      let governance: Awaited<ReturnType<typeof buildCloneChatDelegation>> | null = null;
      try {
        const tc = (structured.tool_call ?? null) as { name?: string; arguments?: Record<string, unknown> } | null;
        if (isP16CIntegrationEnabled() && proposal?.kind === "create_mission") {
          governance = await buildCloneChatDelegation({
            message,
            identity: { companyId: tenant.companyId, actorId: ctx.userId },
            nowIso: now(),
            toolCall: tc,
            instruction: typeof tc?.arguments?.instruction === "string" ? (tc.arguments.instruction as string) : message,
          });
        }
      } catch { governance = null; }

      // ── P19 — CLONEOS sur le vrai chemin : pour une demande de travail, le VRAI orchestrateur canonique
      // (segmentation → Guard/Policy/Trust strictest-wins → routage → trace) s'exécute avec le PAYS SERVEUR.
      // Client-safe, best-effort, rien d'exécuté ici (exécution = /execute → runtime mission V1).
      let cloneos: Awaited<ReturnType<typeof buildCloneOsTurn>> = null;
      try {
        if (proposal?.kind === "create_mission") {
          const tc = (structured.tool_call ?? null) as { arguments?: Record<string, unknown> } | null;
          cloneos = await buildCloneOsTurn({
            message,
            instruction: typeof tc?.arguments?.instruction === "string" ? (tc.arguments.instruction as string) : message,
            companyId: tenant.companyId, userId: ctx.userId, nowIso: now(), correlationId: conversationId ?? ctx.userId,
          });
        }
      } catch { cloneos = null; }
      // Statut STRUCTUREL du tour — dérivé des faits (honesty canonique + proposition + plan CloneOS),
      // jamais d'une phrase libre. mission_created/executed restent réservés à /execute (runtime V1).
      const structural_status = deriveStructuralStatus({
        honesty: structured.honesty, proposalKind: proposal?.kind ?? null, cloneos,
      });

      return reply({
        ok: true,
        source: "openai",
        structured,
        structural_status,
        cloneos,
        proposal,
        governance,
        usageTokens: tokens,
        citationLabels: [...cited.labels],
        knownIssue: reusable?.matched ? { title: reusable.case!.title, reusable: reusable.case!.reusable } : null,
        // ── Enveloppe C1.1 (additive : les anciens clients ignorent ces champs) ──
        confidence,
        attachments: attachmentSummaries,
        documentFindings,
        knownLimitations: [
          ...documentFindings.filter((_, i) => {
            const s = ingested[i].attachment.supportStatus;
            return s === "unsupported" || s === "parse_failed" || s === "manual_review_required";
          }),
          ...(staleSources.length > 0 ? ["Certaines sources sont en cours de rafraîchissement."] : []),
        ],
        needsHumanEscalation: guarded.violated,
        durable: stores.durable,
      });
    } catch {
      return deterministicFallback();
    }
  } finally {
    // Filet de sécurité : toute réservation non réglée est libérée (aucune fuite de budget).
    if (!settled) { try { await stores.budget.release(reservation); } catch { /* ignore */ } }
  }
}
