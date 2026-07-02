// src/app/api/assistant/chat/route.ts
// P9.4 → P9.4.1 — Route CloneChat AUTHENTIFIÉE. Le serveur reste l'autorité : flag +
// auth + accès Pierre + BUDGET DUR ATOMIQUE (reserve→commit/release) AVANT tout appel
// OpenAI + comptabilité durable. Connaissance GROUNDÉE sur les sources réelles + citations
// validées serveur. Mémoire de bugs/support DURABLE (réutilisation vérifiée uniquement).
// Conversations DURABLES (multi-device) si un conversation_id est fourni. La clé OpenAI
// reste SERVEUR. Le modèle PROPOSE ; l'humain confirme ; le contrat V1 exécute. no-store.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { hasPierreAccess } from "@/lib/pierre/access";
import { isCloneChatEnabled } from "@/lib/features/product-availability";
import {
  loadOpenAIConfig, readOpenAIKey, createRealOpenAIResponder, createDeterministicResponder,
  buildUsageRecord, budgetFallbackMessage, sanitizeImages, analyzeScreenshotReal,
} from "@/lib/clonechat/openai";
import { prepareImagesForModel } from "@/lib/clonechat/openai/image-sanitizer";
import { detectPromptInjection, injectionRefusalMessage } from "@/lib/clonechat";
import { redactSymptom } from "@/lib/clonechat/bug-memory";
import { buildGroundedSystemPrompt, validateCitations } from "@/lib/clonechat/knowledge";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";

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

interface ChatBody {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  images?: string[];
  conversation_id?: string;
}

const BUG_HINT = /(bug|erreur|probl[eè]me|marche pas|ne fonctionne|plante|grisé|bloqué|vide|impossible|n'arrive pas|échoue|ne s'affiche)/i;

export async function POST(req: Request) {
  // 1) Flag produit.
  if (!isCloneChatEnabled()) return noStore({ ok: false, code: "CLONECHAT_DISABLED", error: "CloneChat n'est pas encore disponible." }, 503);

  // 2) Auth serveur. Tenant = utilisateur (modèle V0).
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
  if (!message && !(body?.images?.length)) return noStore({ ok: false, code: "EMPTY", error: "Message vide." }, 400);

  // 3) Sécurité : prompt-injection → refus déterministe, aucun appel modèle, 0 token.
  if (detectPromptInjection(message)) {
    return noStore({ ok: true, source: "refused", structured: { answer: injectionRefusalMessage(), honesty: "answered", tool_call: null, citations: [] } });
  }

  const cfg = loadOpenAIConfig();
  const key = readOpenAIKey();
  const stores = await getCloneChatStores();
  const ctx = { companyId: userId, userId };
  const at = now();

  // Persistance durable du message utilisateur (best-effort ; n'échoue jamais le tour).
  const persistUser = async () => {
    if (!conversationId) return;
    try { await stores.conversations.appendMessage(conversationId, ctx, { role: "user", content: [{ type: "text", text: message }], at }); } catch { /* not found / no persistence */ }
  };
  const persistAssistant = async (content: unknown[], extra?: { sourceIds?: string[]; usage?: unknown; imageMeta?: unknown }) => {
    if (!conversationId) return;
    try { await stores.conversations.appendMessage(conversationId, ctx, { role: "assistant", content, sourceIds: extra?.sourceIds, usage: extra?.usage, imageMeta: extra?.imageMeta, at: now() }); } catch { /* ignore */ }
  };

  const deterministicFallback = async (source = "fallback") => {
    const det = createDeterministicResponder();
    const r = await det.respond({ model: "deterministic", system: "", userText: message, maxOutputTokens: 0 });
    const structured = r.structured ?? { answer: "Je reste disponible pour vous orienter et consulter votre espace.", honesty: "answered" as const, tool_call: null, citations: [] };
    await persistAssistant([{ type: "text", text: structured.answer }]);
    return noStore({ ok: true, source, structured, durable: stores.durable });
  };

  await persistUser();

  if (!key || !cfg.enabled) return deterministicFallback("disabled_fallback");

  // 4) BUDGET DUR ATOMIQUE : réservation AVANT tout appel.
  const est = Math.ceil((message.length || 40) / 4) + 400 + (body?.images?.length ? 600 : 0);
  const reservation = await stores.budget.reserve(cfg, ctx, est, at);
  if (!reservation.granted) {
    const fb = await deterministicFallback("budget_fallback");
    return fb;
  }

  // 4bis) Mémoire de support (durable) : cas connu RÉUTILISABLE VÉRIFIÉ uniquement.
  let reusable: Awaited<ReturnType<typeof stores.support.findReusable>> | null = null;
  if (BUG_HINT.test(message)) reusable = await stores.support.findReusable(message);

  // 5) Chemin MULTIMODAL : capture → sanitisation réelle → analyse honnête.
  const rawImgs = sanitizeImages(body?.images);
  if (rawImgs.accepted.length > 0) {
    try {
      const prepared = await prepareImagesForModel(rawImgs.accepted);
      const shot = await analyzeScreenshotReal(key, { model: cfg.model, userText: message, imageDataUrls: prepared.dataUrls, maxOutputTokens: reservation.maxOutputTokens });
      const tokens = shot.usage.inputTokens + shot.usage.outputTokens;
      await stores.budget.commit(reservation, tokens);
      if (tokens > 0) await stores.budget.recordUsage(buildUsageRecord({ usage: shot.usage, userId, companyId: userId, at: now(), imageCount: prepared.dataUrls.length }));
      if (!shot.ok || !shot.analysis) return deterministicFallback();
      const a = shot.analysis;
      const symptomText = [a.summary, ...a.visibly_proven].join(". ");
      const match = await stores.support.findReusable(symptomText);
      if (!match.matched) await stores.support.report(ctx, { symptoms: symptomText, route: "screenshot", evidence: a.visibly_proven.map((t) => ({ kind: "screenshot_finding", text: redactSymptom(t), at: now() })), at: now() });
      await persistAssistant([{ type: "text", text: a.summary }], { imageMeta: prepared.meta });
      return noStore({ ok: true, source: "openai_vision", analysis: a, knownIssue: match.matched ? { title: match.case!.title, workaround: match.case!.workaround, solution: match.case!.solution, reusable: match.case!.reusable } : null, imageSanitization: prepared.report, rejectedImages: rawImgs.rejected, usageTokens: tokens, durable: stores.durable });
    } catch {
      await stores.budget.release(reservation);
      return deterministicFallback();
    }
  }

  // 6) Appel OpenAI RÉEL (structuré, grounded + citations validées serveur).
  try {
    const responder = createRealOpenAIResponder(key);
    const grounded = buildGroundedSystemPrompt("authenticated", message);
    const result = await responder.respond({ model: cfg.model, system: grounded.system, userText: message, history: (body?.history ?? []).slice(-6), maxOutputTokens: reservation.maxOutputTokens });
    const tokens = result.usage.inputTokens + result.usage.outputTokens;
    await stores.budget.commit(reservation, tokens);
    if (tokens > 0) await stores.budget.recordUsage(buildUsageRecord({ usage: result.usage, userId, companyId: userId, at: now() }));
    if (!result.ok || !result.structured) return deterministicFallback();

    let structured = result.structured;
    // Citations : ne garder que les IDs réellement dans le contexte (sinon supprimées).
    const cited = validateCitations(structured.citations ?? [], grounded.contextChunks);
    structured = { ...structured, citations: cited.valid };

    // Support (durable) : cas connu vérifié → contournement adossé ; sinon consigné.
    if (reusable?.matched && reusable.case) {
      const fix = reusable.case.workaround ?? reusable.case.solution;
      if (fix) structured = { ...structured, answer: `${structured.answer}\n\nContournement connu (vérifié) : ${fix}` };
      await stores.support.report(ctx, { symptoms: message, at: now() });
    } else if (BUG_HINT.test(message)) {
      await stores.support.report(ctx, { symptoms: message, evidence: [{ kind: "symptom", text: redactSymptom(message), at: now() }], at: now() });
    }

    await persistAssistant([{ type: "text", text: structured.answer }], { sourceIds: cited.valid, usage: { totalTokens: tokens } });
    return noStore({ ok: true, source: "openai", structured, usageTokens: tokens, citationLabels: cited.labels, knownIssue: reusable?.matched ? { title: reusable.case!.title, reusable: reusable.case!.reusable } : null, durable: stores.durable });
  } catch {
    await stores.budget.release(reservation);
    return deterministicFallback();
  }
}
