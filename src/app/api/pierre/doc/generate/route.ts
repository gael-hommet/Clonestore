import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type MissionRiskLevel = "normal" | "sensitive" | "critical";

type GenerateDocumentBody = {
  instructions: string;
  context?: string | null;
  type?: string | null;
  tone?: string | null;
  language?: string | null;
  title?: string | null;
  missionId?: string | null;
};

type SenderMemory = {
  preferred_language?: string | null;
  tone_guide?: string | null;
  communication_style?: string | null;
  company_rules?: unknown;
  approval_rules?: unknown;
};

type JsonErrorExtra = {
  code?: string | null;
  details?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function getNestedObject(
  source: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!source) return null;
  const value = source[key];
  return isObject(value) ? value : null;
}

function getNestedString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!source) return null;
  return asString(source[key]);
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra ?? {}),
    },
    { status },
  );
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;

  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();

  const directCandidates = [
    "sb-access-token",
    "supabase-access-token",
    "access-token",
  ];

  for (const key of directCandidates) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }

  for (const cookie of cookies) {
    if (!cookie.name.includes("auth-token")) continue;

    const raw = cookie.value;
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        const candidate = parsed.find(
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );
        if (typeof candidate === "string") return candidate;
      }

      if (isObject(parsed)) {
        const currentSession = getNestedObject(parsed, "currentSession");

        const candidate =
          getNestedString(parsed, "access_token") ||
          getNestedString(currentSession, "access_token");

        if (candidate) return candidate;
      }
    } catch {
      if (raw.split(".").length === 3) return raw;
    }
  }

  return null;
}

async function authenticateRequest(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<AuthenticatedContext> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw {
      status: 401,
      message: "Auth session missing.",
      code: "AUTH_SESSION_MISSING",
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw {
      status: 401,
      message: "Unable to authenticate request.",
      code: "AUTH_INVALID",
      details: error?.message || null,
    };
  }

  return {
    userId: data.user.id,
    accessToken,
  };
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message:
        asString(error.message) ||
        asString(error.error_description) ||
        "Unexpected database error.",
      code: asString(error.code),
      details: error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: null,
      details: null,
    };
  }

  return {
    message: "Unexpected database error.",
    code: null,
    details: null,
  };
}

function normalizeBody(raw: unknown): GenerateDocumentBody {
  if (!isObject(raw)) {
    return {
      instructions: "",
      context: null,
      type: null,
      tone: null,
      language: null,
      title: null,
      missionId: null,
    };
  }

  return {
    instructions: asString(raw.instructions) || "",
    context: asString(raw.context),
    type: asString(raw.type),
    tone: asString(raw.tone),
    language: asString(raw.language),
    title: asString(raw.title),
    missionId: asString(raw.missionId),
  };
}

function detectLanguage(input: string): string {
  const lower = input.toLowerCase();
  const englishSignals = [
    "candidate",
    "interview",
    "job",
    "follow up",
    "meeting",
    "please",
    "draft",
    "recruitment",
    "hiring",
  ];

  const hits = englishSignals.filter((signal) => lower.includes(signal)).length;
  return hits >= 2 ? "en" : "fr";
}

function normalizeDocType(value: string | null | undefined): string {
  const type = (value || "").trim().toLowerCase();

  if (!type) return "document_rh";
  if (type.includes("offre")) return "offre_emploi";
  if (type.includes("convocation")) return "convocation_entretien";
  if (type.includes("refus")) return "refus_candidat";
  if (type.includes("relance")) return "relance_rh";
  if (type.includes("onboarding")) return "onboarding";
  if (type.includes("note")) return "note_rh";
  if (type.includes("procedure")) return "rappel_procedure";
  if (type.includes("procÃ©dure")) return "rappel_procedure";
  if (type.includes("compte")) return "compte_rendu";
  if (type.includes("courrier")) return "courrier_rh";

  return type;
}

function inferTitle(body: GenerateDocumentBody, docType: string): string {
  if (body.title) return body.title;

  switch (docType) {
    case "offre_emploi":
      return "Offre dâ€™emploi";
    case "convocation_entretien":
      return "Convocation dâ€™entretien";
    case "refus_candidat":
      return "Refus de candidature";
    case "relance_rh":
      return "Relance RH";
    case "onboarding":
      return "Document dâ€™onboarding";
    case "note_rh":
      return "Note RH";
    case "rappel_procedure":
      return "Rappel de procÃ©dure";
    case "compte_rendu":
      return "Compte rendu RH";
    case "courrier_rh":
      return "Courrier RH";
    default:
      return "Document RH";
  }
}

function inferRisk(instructions: string, docType: string): MissionRiskLevel {
  const lower = instructions.toLowerCase();

  const criticalSignals = [
    "licenciement",
    "sanction disciplinaire",
    "harcÃ¨lement",
    "harcelement",
    "contentieux",
    "prud'hommes",
    "discrimination",
  ];

  const sensitiveSignals = [
    "avertissement",
    "mise Ã  pied",
    "mise a pied",
    "conflit",
    "absence injustifiÃ©e",
    "absence injustifiee",
    "salaire",
    "confidentiel",
  ];

  if (criticalSignals.some((signal) => lower.includes(signal))) return "critical";
  if (sensitiveSignals.some((signal) => lower.includes(signal))) return "sensitive";

  if (
    docType === "refus_candidat" ||
    docType === "convocation_entretien" ||
    docType === "offre_emploi" ||
    docType === "onboarding"
  ) {
    return "normal";
  }

  return "normal";
}

async function loadCompanyMemory(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<SenderMemory | null> {
  const { data, error } = await supabaseAdmin
    .from("pierre_company_memory")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load company memory.",
      code: "COMPANY_MEMORY_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) return null;

  return {
    preferred_language: asString(data.preferred_language),
    tone_guide: asString(data.tone_guide),
    communication_style: asString(data.communication_style),
    company_rules: data.company_rules ?? null,
    approval_rules: data.approval_rules ?? null,
  };
}

async function verifyMissionOwnershipIfNeeded(
  supabaseAdmin: SupabaseClient,
  missionId: string | null | undefined,
  userId: string,
): Promise<DbRow | null> {
  if (!missionId) return null;

  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select("*")
    .eq("id", missionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission.",
      code: "MISSION_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) {
    throw {
      status: 404,
      message: "Mission not found.",
      code: "MISSION_NOT_FOUND",
    };
  }

  return data as DbRow;
}

function buildDocumentText(params: {
  title: string;
  docType: string;
  instructions: string;
  context: string | null;
  tone: string;
  language: string;
  memory: SenderMemory | null;
}): string {
  const {
    title,
    docType,
    instructions,
    context,
    tone,
    language,
    memory,
  } = params;

  const intro =
    language === "en"
      ? `This HR document was prepared by Pierre as a premium operational draft.`
      : `Ce document RH a Ã©tÃ© prÃ©parÃ© par Pierre comme brouillon opÃ©rationnel premium.`;

  const toneLine =
    language === "en"
      ? `Requested tone: ${tone}.`
      : `Ton demandÃ© : ${tone}.`;

  const memoryTone = memory?.tone_guide
    ? language === "en"
      ? `Company tone guide: ${memory.tone_guide}.`
      : `Guide de ton entreprise : ${memory.tone_guide}.`
    : null;

  const contextLine = context
    ? language === "en"
      ? `Context: ${context}`
      : `Contexte : ${context}`
    : language === "en"
      ? `No additional context was provided.`
      : `Aucun contexte complÃ©mentaire nâ€™a Ã©tÃ© fourni.`;

  const mainBody =
    language === "en"
      ? [
          `Title: ${title}`,
          `Document type: ${docType}`,
          intro,
          toneLine,
          memoryTone,
          contextLine,
          `Mission instructions: ${instructions}`,
          `Operational note: this draft must remain editable, traceable and subject to human validation when required.`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : [
          `Titre : ${title}`,
          `Type de document : ${docType}`,
          intro,
          toneLine,
          memoryTone,
          contextLine,
          `Instructions de mission : ${instructions}`,
          `Note opÃ©rationnelle : ce brouillon doit rester modifiable, traÃ§able et soumis Ã  validation humaine quand nÃ©cessaire.`,
        ]
          .filter(Boolean)
          .join("\n\n");

  return mainBody;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildDocumentHtml(params: {
  title: string;
  docType: string;
  textContent: string;
  tone: string;
  language: string;
  risk: MissionRiskLevel;
}): string {
  const { title, docType, textContent, tone, language, risk } = params;

  const paragraphs = textContent
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");

  const subtitle =
    language === "en"
      ? `HR premium draft Â· ${docType} Â· tone ${tone} Â· risk ${risk}`
      : `Brouillon RH premium Â· ${docType} Â· ton ${tone} Â· risque ${risk}`;

  return `
    <article>
      <header>
        <h1>${escapeHtml(title)}</h1>
        <p><strong>${escapeHtml(subtitle)}</strong></p>
      </header>
      ${paragraphs}
    </article>
  `.trim();
}

async function insertDocument(params: {
  supabaseAdmin: SupabaseClient;
  missionId: string | null;
  title: string;
  docType: string;
  textContent: string;
  htmlContent: string;
  metadata: Record<string, unknown>;
}): Promise<DbRow> {
  const { supabaseAdmin, missionId, title, docType, textContent, htmlContent, metadata } = params;

  const insertPayload = {
    mission_id: missionId,
    title,
    doc_type: docType,
    status: "generated",
    text_content: textContent,
    html_content: htmlContent,
    metadata,
  };

  const { data, error } = await supabaseAdmin
    .from("pierre_documents")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    throw {
      status: 500,
      message: "Unable to save document.",
      code: "DOCUMENT_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return data as DbRow;
}

async function insertMissionLogIfNeeded(params: {
  supabaseAdmin: SupabaseClient;
  missionId: string | null;
  message: string;
  payload: Record<string, unknown>;
}) {
  const { supabaseAdmin, missionId, message, payload } = params;
  if (!missionId) return;

  const { error } = await supabaseAdmin.from("pierre_task_logs").insert({
    mission_id: missionId,
    level: "info",
    event: "document_generated_direct",
    message,
    payload,
  });

  if (error) {
    throw {
      status: 500,
      message: "Unable to create mission log.",
      code: "MISSION_LOG_CREATE_FAILED",
      details: mapDbError(error),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = normalizeBody(await request.json());

    if (!body.instructions || !body.instructions.trim()) {
      return jsonError("Document instructions are required.", 400, {
        code: "DOCUMENT_INSTRUCTIONS_REQUIRED",
      });
    }

    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);

    const [mission, memory] = await Promise.all([
      verifyMissionOwnershipIfNeeded(supabaseAdmin, body.missionId, auth.userId),
      loadCompanyMemory(supabaseAdmin, auth.userId),
    ]);

    const docType = normalizeDocType(body.type);
    const language =
      body.language ||
      memory?.preferred_language ||
      detectLanguage(`${body.instructions}\n${body.context || ""}`);
    const tone =
      body.tone || memory?.tone_guide || memory?.communication_style || "professionnel";
    const title = inferTitle(body, docType);
    const risk = inferRisk(body.instructions, docType);

    const textContent = buildDocumentText({
      title,
      docType,
      instructions: body.instructions,
      context: body.context || null,
      tone,
      language,
      memory,
    });

    const htmlContent = buildDocumentHtml({
      title,
      docType,
      textContent,
      tone,
      language,
      risk,
    });

    const document = await insertDocument({
      supabaseAdmin,
      missionId: mission ? (mission.id as string) : null,
      title,
      docType,
      textContent,
      htmlContent,
      metadata: {
        source: "api:pierre:doc:generate",
        tone,
        language,
        risk_level: risk,
        context: body.context || null,
        mission_id: mission ? (mission.id as string) : null,
      },
    });

    await insertMissionLogIfNeeded({
      supabaseAdmin,
      missionId: mission ? (mission.id as string) : null,
      message: `Document gÃ©nÃ©rÃ© : ${title}`,
      payload: {
        document_id: document.id,
        doc_type: docType,
        tone,
        language,
        risk_level: risk,
      },
    });

    return NextResponse.json({
      ok: true,
      document,
      meta: {
        fetchedAt: new Date().toISOString(),
        missionId: mission ? (mission.id as string) : null,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status,
        {
          code: asString(error.code),
          details: error.details ?? null,
        },
      );
    }

    const mapped = mapDbError(error);

    return jsonError(mapped.message, 500, {
      code: mapped.code,
      details: mapped.details,
    });
  }
}