import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

type DocumentGenerateBody = {
  title?: string;
  instructions?: string;
  context?: string;
  tone?: string;
  language?: string;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean : null;
}

function trimOrEmpty(value: unknown): string {
  return trimOrNull(value) ?? "";
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceRole) {
    throw new Error("Supabase admin env is missing.");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing.");
  }
  return new OpenAI({ apiKey });
}

function tryParseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractTokenFromCookieValue(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;

  if (clean.startsWith("eyJ") && clean.split(".").length >= 3) return clean;

  const parsed = tryParseJsonString(clean);

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === "string" && item.startsWith("eyJ") && item.split(".").length >= 3) {
        return item;
      }
    }
  }

  if (isPlainObject(parsed)) {
    const candidates = [
      parsed.access_token,
      parsed.accessToken,
      parsed.token,
      parsed.currentSession && isPlainObject(parsed.currentSession)
        ? parsed.currentSession.access_token
        : null,
      parsed.session && isPlainObject(parsed.session)
        ? parsed.session.access_token
        : null,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === "string" &&
        candidate.startsWith("eyJ") &&
        candidate.split(".").length >= 3
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  for (const cookie of request.cookies.getAll()) {
    const name = cookie.name.toLowerCase();
    if (name.includes("auth-token") || name.includes("access-token") || name.startsWith("sb-")) {
      const token = extractTokenFromCookieValue(cookie.value);
      if (token) return token;
    }
  }

  return null;
}

function checkWorkerAuth(request: NextRequest): boolean {
  const workerSecret = process.env.PIERRE_QUEUE_WORKER_SECRET;
  if (!workerSecret) return true; // no secret configured — open by convention (same as other worker routes)
  const provided = request.headers.get("x-pierre-worker-secret");
  return provided === workerSecret;
}

async function resolveUser(supabase: SupabaseClient, request: NextRequest): Promise<User | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

async function getCompanyMemory(supabase: SupabaseClient, user: User | null) {
  if (!user) return null;

  const { data, error } = await supabase
    .from("pierre_company_memory")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function inferDocumentType(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes("convocation")) return "convocation";
  if (lower.includes("refus")) return "refus_candidat";
  if (lower.includes("onboarding") || lower.includes("accueil")) return "onboarding";
  if (lower.includes("offre d'emploi") || lower.includes("offre emploi")) return "offre_emploi";
  if (lower.includes("compte rendu")) return "compte_rendu";
  if (lower.includes("relance")) return "relance";
  if (lower.includes("note interne")) return "note_interne";
  if (lower.includes("procédure")) return "rappel_procedure";

  return "document_rh";
}

function buildDocumentPrompt(input: {
  instructions: string;
  context: string;
  tone: string;
  language: string;
  companyMemory: Record<string, unknown> | null;
}) {
  const companyName =
    trimOrNull(input.companyMemory?.company_name) ?? "l’entreprise cliente";

  return `
Tu es Pierre, employé IA RH premium de CloneStore.

Ta mission :
produire un document RH propre, exploitable, professionnel, crédible et directement utilisable.

Contraintes absolues :
- ne jamais inventer des faits précis qui ne sont pas donnés ;
- si une information manque, rester générique et propre sans inventer de détails sensibles ;
- ton demandé : ${input.tone};
- langue demandée : ${input.language};
- entreprise concernée : ${companyName};
- produire un résultat premium, lisible, clair, humain et professionnel ;
- éviter tout ton juridique excessif ;
- rester dans un périmètre RH / administratif raisonnable.

Contexte entreprise :
${input.context || "Aucun contexte complémentaire fourni."}

Mémoire entreprise utile :
${JSON.stringify(input.companyMemory ?? {}, null, 2)}

Instructions utilisateur :
${input.instructions}

Réponds en JSON strict au format :
{
  "title": "titre du document",
  "type": "type_document",
  "text": "version texte finale",
  "html": "version HTML propre avec paragraphes et listes si utile",
  "summary": "résumé très court",
  "missing_variables": ["..."]
}
`.trim();
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "<p></p>";

  return paragraphs
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const bulletLines = lines.filter((line) => /^[-•]/.test(line));

      if (bulletLines.length === lines.length && lines.length > 0) {
        const items = lines
          .map((line) => line.replace(/^[-•]\s*/, "").trim())
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      return `<p>${escapeHtml(lines.join(" "))}</p>`;
    })
    .join("");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as DocumentGenerateBody | null;
    const instructions = trimOrEmpty(body?.instructions);
    const context = trimOrEmpty(body?.context);
    const tone = trimOrNull(body?.tone) ?? "professionnel";
    const language = trimOrNull(body?.language) ?? "fr";
    const requestedTitle = trimOrNull(body?.title);

    if (!instructions) {
      return json(
        {
          ok: false,
          error: "Instructions manquantes pour générer le document.",
        },
        400
      );
    }

    const supabase = getSupabaseAdmin();
    const workerAuth = checkWorkerAuth(request);
    const user = await resolveUser(supabase, request);

    if (!workerAuth && !user) {
      return json({ ok: false, error: "Authentification requise." }, 401);
    }

    const memory = await getCompanyMemory(supabase, user);

    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: "gpt-5",
      input: buildDocumentPrompt({
        instructions,
        context,
        tone,
        language,
        companyMemory: isPlainObject(memory) ? memory : null,
      }),
    });

    const rawText = response.output_text?.trim() ?? "";
    const parsed = safeJsonParse<{
      title?: string;
      type?: string;
      text?: string;
      html?: string;
      summary?: string;
      missing_variables?: string[];
    }>(rawText);

    const finalText =
      trimOrNull(parsed?.text) ??
      rawText ??
      "Document généré sans contenu texte exploitable.";
    const finalHtml = trimOrNull(parsed?.html) ?? textToHtml(finalText);
    const finalTitle =
      requestedTitle ??
      trimOrNull(parsed?.title) ??
      "Document Pierre";
    const finalType =
      trimOrNull(parsed?.type) ?? inferDocumentType(`${instructions}\n${context}`);

    const insertPayload = {
      user_id: user?.id ?? null,
      mission_id: null,
      task_id: null,
      title: finalTitle,
      type: finalType,
      status: "ready",
      text: finalText,
      html: finalHtml,
      metadata: {
        source: "direct_studio",
        summary: trimOrNull(parsed?.summary),
        missing_variables: Array.isArray(parsed?.missing_variables)
          ? parsed?.missing_variables.map(String)
          : [],
        tone,
        language,
      },
    };

    const { data: inserted, error: insertError } = await supabase
      .from("pierre_documents")
      .insert(insertPayload)
      .select("*")
      .maybeSingle();

    if (insertError) throw insertError;

    return json({
      ok: true,
      document: inserted,
    });
  } catch (error) {
    console.error("[pierre/doc/generate][POST]", error);
    return json(
      {
        ok: false,
        error: "Impossible de générer le document Pierre.",
      },
      500
    );
  }
}