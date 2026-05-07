import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type SendEmailBody = {
  to?: string | null;
  cc?: string | null;
  bcc?: string | null;
  subject?: string | null;
  body?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  missionId?: string | null;
  attachments?: unknown;
};

type SenderIdentityResolved = {
  senderName: string | null;
  senderEmail: string | null;
  senderDomain: string | null;
  source: "payload" | "memory" | "fallback" | "none";
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

function normalizeBody(raw: unknown): SendEmailBody {
  if (!isObject(raw)) {
    return {
      to: null,
      cc: null,
      bcc: null,
      subject: null,
      body: null,
      senderName: null,
      senderEmail: null,
      missionId: null,
      attachments: null,
    };
  }

  return {
    to: asString(raw.to),
    cc: asString(raw.cc),
    bcc: asString(raw.bcc),
    subject: asString(raw.subject),
    body: asString(raw.body),
    senderName: asString(raw.senderName),
    senderEmail: asString(raw.senderEmail),
    missionId: asString(raw.missionId),
    attachments: raw.attachments ?? null,
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

async function loadCompanyMemory(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow | null> {
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

  return (data ?? null) as DbRow | null;
}

function resolveSenderIdentity(
  body: SendEmailBody,
  memory: DbRow | null,
): SenderIdentityResolved {
  const senderIdentity = isObject(memory?.sender_identity)
    ? memory?.sender_identity
    : null;

  const payloadName = body.senderName;
  const payloadEmail = body.senderEmail;

  if (payloadName || payloadEmail) {
    const email = payloadEmail || null;
    return {
      senderName: payloadName || null,
      senderEmail: email,
      senderDomain: email && email.includes("@") ? email.split("@")[1] : null,
      source: "payload",
    };
  }

  const memoryName =
    asString(memory?.sender_name) ||
    asString(senderIdentity?.sender_name) ||
    asString(senderIdentity?.name);
  const memoryEmail =
    asString(memory?.sender_email) ||
    asString(senderIdentity?.sender_email) ||
    asString(senderIdentity?.email);

  if (memoryName || memoryEmail) {
    return {
      senderName: memoryName || null,
      senderEmail: memoryEmail || null,
      senderDomain:
        asString(memory?.sender_domain) ||
        (memoryEmail && memoryEmail.includes("@") ? memoryEmail.split("@")[1] : null),
      source: "memory",
    };
  }

  const fallbackName = asString(process.env.PIERRE_FALLBACK_SENDER_NAME);
  const fallbackEmail = asString(process.env.PIERRE_FALLBACK_SENDER_EMAIL);

  if (fallbackName || fallbackEmail) {
    return {
      senderName: fallbackName || null,
      senderEmail: fallbackEmail || null,
      senderDomain:
        fallbackEmail && fallbackEmail.includes("@")
          ? fallbackEmail.split("@")[1]
          : null,
      source: "fallback",
    };
  }

  return {
    senderName: null,
    senderEmail: null,
    senderDomain: null,
    source: "none",
  };
}

function validateSendBody(body: SendEmailBody) {
  if (!body.to) {
    throw {
      status: 400,
      message: "Recipient email is required.",
      code: "EMAIL_TO_REQUIRED",
    };
  }

  if (!body.subject) {
    throw {
      status: 400,
      message: "Email subject is required.",
      code: "EMAIL_SUBJECT_REQUIRED",
    };
  }

  if (!body.body) {
    throw {
      status: 400,
      message: "Email body is required.",
      code: "EMAIL_BODY_REQUIRED",
    };
  }
}

function buildProviderMessageId() {
  return `pierre_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function insertSentEmail(params: {
  supabaseAdmin: SupabaseClient;
  missionId: string | null;
  sender: SenderIdentityResolved;
  body: SendEmailBody;
  providerMessageId: string;
}): Promise<DbRow> {
  const { supabaseAdmin, missionId, sender, body, providerMessageId } = params;

  const insertPayload = {
    mission_id: missionId,
    to: body.to || null,
    cc: body.cc || null,
    bcc: body.bcc || null,
    subject: body.subject || null,
    body_text: body.body || null,
    body_html: null,
    sender_name: sender.senderName,
    sender_email: sender.senderEmail,
    status: "sent",
    provider_message_id: providerMessageId,
    attachments: body.attachments ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("pierre_outbound_emails")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    throw {
      status: 500,
      message: "Unable to save sent email.",
      code: "EMAIL_SEND_SAVE_FAILED",
      details: mapDbError(error),
    };
  }

  return data as DbRow;
}

async function insertMissionLogIfNeeded(params: {
  supabaseAdmin: SupabaseClient;
  missionId: string | null;
  subject: string;
  emailId: string;
  to: string;
}) {
  const { supabaseAdmin, missionId, subject, emailId, to } = params;
  if (!missionId) return;

  const { error } = await supabaseAdmin.from("pierre_task_logs").insert({
    mission_id: missionId,
    level: "info",
    event: "email_sent_direct",
    message: `Email envoyé : ${subject}`,
    payload: {
      email_id: emailId,
      to,
      subject,
    },
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
    validateSendBody(body);

    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);

    const [mission, memory] = await Promise.all([
      verifyMissionOwnershipIfNeeded(supabaseAdmin, body.missionId, auth.userId),
      loadCompanyMemory(supabaseAdmin, auth.userId),
    ]);

    const sender = resolveSenderIdentity(body, memory);
    const providerMessageId = buildProviderMessageId();

    const email = await insertSentEmail({
      supabaseAdmin,
      missionId: mission ? (mission.id as string) : null,
      sender,
      body,
      providerMessageId,
    });

    await insertMissionLogIfNeeded({
      supabaseAdmin,
      missionId: mission ? (mission.id as string) : null,
      subject: body.subject as string,
      emailId: String(email.id),
      to: body.to as string,
    });

    return NextResponse.json({
      ok: true,
      email,
      sent: email,
      provider: {
        provider: "internal_stub",
        messageId: providerMessageId,
        deliveryAccepted: true,
        senderIdentityResolved: sender,
      },
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