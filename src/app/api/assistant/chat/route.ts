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
import { resolveCloneChatCompany } from "@/lib/clonechat/server/company";
import { tenantRefusalResponse } from "@/lib/clonechat/server/auth";
import { buildAndPersistProposal } from "@/lib/clonechat/server/proposal-builder";
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
}

interface ChatBody {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  images?: string[];
  attachments?: AttachmentBody[];
  conversation_id?: string;
}

const BUG_HINT = /(bug|erreur|probl[eè]me|marche pas|ne fonctionne|plante|grisé|bloqué|vide|impossible|n'arrive pas|échoue|ne s'affiche)/i;

// Bornes de transport (aucun substrat d'upload durable dans ce dépôt : transport en ligne borné).
const MAX_ATTACHMENTS = 4;
const MAX_TOTAL_BASE64_CHARS = 8 * 1024 * 1024; // ~6 Mo décodés, tous fichiers confondus

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

  // 2) Auth serveur (Supabase). Le tenant réel est résolu plus bas via le membership V1.
  let userId: string | null = null;
  try {
    const supabase = await supabaseServer();
    const token = bearer(req);
    const { data } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
    userId = data.user?.id ?? null;
    if (!userId) return noStore({ ok: false, code: "AUTH_REQUIRED", error: "Connexion requise." }, 401);
    const access = await hasPierreAccess(supabase, userId);
    if (!access) return noStore({ ok: true, source: "no_pierre", structured: { answer: "Pierre n'est pas encore actif sur votre compte. Une fois activé, je peux consulter vos missions, validations, salariés et documents, et préparer des actions avec votre validation.", honesty: "answered", tool_call: null, citations: [] } });
  } catch {
    return noStore({ ok: false, code: "AUTH_ERROR", error: "Session invalide." }, 401);
  }

  const body = (await req.json().catch(() => null)) as ChatBody | null;
  const message = (body?.message ?? "").trim();
  const conversationId = body?.conversation_id ?? null;
  const rawAttachments = Array.isArray(body?.attachments) ? body!.attachments!.slice(0, MAX_ATTACHMENTS) : [];
  if (!message && !(body?.images?.length) && rawAttachments.length === 0) return noStore({ ok: false, code: "EMPTY", error: "Message vide." }, 400);

  // 3) Sécurité : prompt-injection → refus déterministe, aucun appel modèle, 0 token.
  if (detectPromptInjection(message)) {
    return noStore({ ok: true, source: "refused", structured: { answer: injectionRefusalMessage(), honesty: "answered", tool_call: null, citations: [] } });
  }

  const cfg = loadOpenAIConfig();
  const key = readOpenAIKey();
  const stores = await getCloneChatStores();
  // Tenant = VRAIE entreprise (membership V1, lecture seule). FAIL-CLOSED.
  const tenant = await resolveCloneChatCompany(userId);
  if (!tenant.ok) return tenantRefusalResponse(tenant);
  const ctx = { companyId: tenant.companyId, userId };
  const at = now();

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
    return noStore({ ok: true, source, structured, attachments: attachmentSummaries, documentFindings, durable: stores.durable });
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
          return noStore({ ok: true, source: "image_unavailable", structured: { answer: "Je ne peux pas traiter cette image pour le moment (transformation d'image indisponible). Réessayez, ou décrivez ce que vous voyez.", honesty: "unknown", tool_call: null, citations: [] }, imageSanitization: prepared.report, rejectedImages: [...rawImgs.rejected, ...prepared.rejected], attachments: attachmentSummaries, durable: stores.durable });
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
        return noStore({ ok: true, source: "openai_vision", analysis: a, knownIssue: match.matched ? { title: match.case!.title, workaround: match.case!.workaround, solution: match.case!.solution, reusable: match.case!.reusable } : null, imageSanitization: prepared.report, rejectedImages: rawImgs.rejected, attachments: attachmentSummaries, documentFindings, usageTokens: tokens, durable: stores.durable });
      } catch {
        return deterministicFallback();
      }
    }

    // ── 6) Appel OpenAI RÉEL, GROUNDÉ SUR C1.1 (citations validées serveur) ────
    try {
      const responder = createRealOpenAIResponder(key);

      // Viewer résolu SERVEUR (mode client ; le mode fondateur passe par l'adaptateur interne).
      const viewer = clientViewer(tenant.companyId, userId);

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
            identity: { companyId: tenant.companyId, actorId: userId },
            nowIso: now(),
            toolCall: tc,
            instruction: typeof tc?.arguments?.instruction === "string" ? (tc.arguments.instruction as string) : message,
          });
        }
      } catch { governance = null; }

      return noStore({
        ok: true,
        source: "openai",
        structured,
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
