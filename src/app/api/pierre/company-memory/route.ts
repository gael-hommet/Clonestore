import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

type PierreCompanyMemoryRow = {
  id?: string;
  user_id?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  tone?: string | null;
  language?: string | null;
  rules?: string[] | null;
  preferences?: Record<string, unknown> | null;
  email_identity?: {
    sender_name?: string | null;
    sender_email?: string | null;
    reply_to?: string | null;
    provider?: string | null;
    domain_verified?: boolean | null;
    [key: string]: unknown;
  } | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type SenderIdentityResolved = {
  sender_name: string | null;
  sender_email: string | null;
  reply_to?: string | null;
  provider?: string | null;
  domain_verified?: boolean | null;
  source: "memory.email_identity" | "memory.root" | "fallback.env" | "none";
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

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceRole) {
    throw new Error("Supabase admin env is missing.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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

  if (clean.startsWith("eyJ") && clean.split(".").length >= 3) {
    return clean;
  }

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

  const cookieCandidates = request.cookies.getAll();

  for (const cookie of cookieCandidates) {
    const name = cookie.name.toLowerCase();

    if (
      name.includes("auth-token") ||
      name.includes("access-token") ||
      name.startsWith("sb-")
    ) {
      const token = extractTokenFromCookieValue(cookie.value);
      if (token) return token;
    }
  }

  return null;
}

async function resolveUser(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<User | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

function normalizeMemoryRow(raw: unknown): PierreCompanyMemoryRow | null {
  if (!isPlainObject(raw)) return null;

  return {
    ...raw,
    sender_name: trimOrNull(raw.sender_name),
    sender_email: trimOrNull(raw.sender_email),
    tone: trimOrNull(raw.tone),
    language: trimOrNull(raw.language),
    rules: Array.isArray(raw.rules) ? raw.rules.map(String) : null,
    preferences: isPlainObject(raw.preferences)
      ? (raw.preferences as Record<string, unknown>)
      : null,
    metadata: isPlainObject(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : null,
    email_identity: isPlainObject(raw.email_identity)
      ? {
          ...raw.email_identity,
          sender_name: trimOrNull(raw.email_identity.sender_name),
          sender_email: trimOrNull(raw.email_identity.sender_email),
          reply_to: trimOrNull(raw.email_identity.reply_to),
          provider: trimOrNull(raw.email_identity.provider),
          domain_verified:
            typeof raw.email_identity.domain_verified === "boolean"
              ? raw.email_identity.domain_verified
              : null,
        }
      : null,
  };
}

function resolveSenderIdentity(memory: PierreCompanyMemoryRow | null): SenderIdentityResolved {
  const envSenderName = trimOrNull(process.env.PIERRE_DEFAULT_SENDER_NAME);
  const envSenderEmail = trimOrNull(process.env.PIERRE_DEFAULT_SENDER_EMAIL);
  const envReplyTo = trimOrNull(process.env.PIERRE_DEFAULT_REPLY_TO);

  const nestedSenderName = trimOrNull(memory?.email_identity?.sender_name);
  const nestedSenderEmail = trimOrNull(memory?.email_identity?.sender_email);
  const nestedReplyTo = trimOrNull(memory?.email_identity?.reply_to);
  const nestedProvider = trimOrNull(memory?.email_identity?.provider);

  if (nestedSenderName || nestedSenderEmail || nestedReplyTo) {
    return {
      sender_name: nestedSenderName,
      sender_email: nestedSenderEmail,
      reply_to: nestedReplyTo ?? undefined,
      provider: nestedProvider ?? undefined,
      domain_verified:
        typeof memory?.email_identity?.domain_verified === "boolean"
          ? memory.email_identity.domain_verified
          : undefined,
      source: "memory.email_identity",
    };
  }

  const rootSenderName = trimOrNull(memory?.sender_name);
  const rootSenderEmail = trimOrNull(memory?.sender_email);

  if (rootSenderName || rootSenderEmail) {
    return {
      sender_name: rootSenderName,
      sender_email: rootSenderEmail,
      source: "memory.root",
    };
  }

  if (envSenderName || envSenderEmail || envReplyTo) {
    return {
      sender_name: envSenderName,
      sender_email: envSenderEmail,
      reply_to: envReplyTo ?? undefined,
      source: "fallback.env",
    };
  }

  return {
    sender_name: null,
    sender_email: null,
    source: "none",
  };
}

function sanitizePatchBody(raw: unknown): Partial<PierreCompanyMemoryRow> {
  if (!isPlainObject(raw)) return {};

  const output: Partial<PierreCompanyMemoryRow> = {};

  if ("company_id" in raw) output.company_id = trimOrNull(raw.company_id);
  if ("company_name" in raw) output.company_name = trimOrNull(raw.company_name);
  if ("sender_name" in raw) output.sender_name = trimOrNull(raw.sender_name);
  if ("sender_email" in raw) output.sender_email = trimOrNull(raw.sender_email);
  if ("tone" in raw) output.tone = trimOrNull(raw.tone);
  if ("language" in raw) output.language = trimOrNull(raw.language);

  if ("rules" in raw) {
    output.rules = Array.isArray(raw.rules)
      ? raw.rules.map(String)
      : raw.rules == null
      ? null
      : [String(raw.rules)];
  }

  if ("preferences" in raw) {
    output.preferences = isPlainObject(raw.preferences)
      ? (raw.preferences as Record<string, unknown>)
      : null;
  }

  if ("metadata" in raw) {
    output.metadata = isPlainObject(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : null;
  }

  if ("email_identity" in raw) {
    output.email_identity = isPlainObject(raw.email_identity)
      ? {
          sender_name: trimOrNull(raw.email_identity.sender_name),
          sender_email: trimOrNull(raw.email_identity.sender_email),
          reply_to: trimOrNull(raw.email_identity.reply_to),
          provider: trimOrNull(raw.email_identity.provider),
          domain_verified:
            typeof raw.email_identity.domain_verified === "boolean"
              ? raw.email_identity.domain_verified
              : null,
        }
      : null;
  }

  return output;
}

async function getMemoryForUser(
  supabase: SupabaseClient,
  user: User | null
): Promise<PierreCompanyMemoryRow | null> {
  if (!user) return null;

  const { data, error } = await supabase
    .from("pierre_company_memory")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeMemoryRow(data);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await resolveUser(supabase, request);
    const memory = await getMemoryForUser(supabase, user);
    const senderIdentity = resolveSenderIdentity(memory);

    return json({
      ok: true,
      memory,
      sender_identity: senderIdentity,
      auth: user ? "resolved" : "missing",
    });
  } catch (error) {
    console.error("[pierre/company-memory][GET]", error);

    return json(
      {
        ok: false,
        error: "Impossible de charger la mémoire entreprise Pierre.",
      },
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await resolveUser(supabase, request);

    if (!user) {
      return json(
        {
          ok: false,
          error: "Non autorisé pour modifier la mémoire entreprise.",
        },
        401
      );
    }

    const body = sanitizePatchBody(await request.json());
    const existing = await getMemoryForUser(supabase, user);

    let savedRow: PierreCompanyMemoryRow | null = null;

    if (existing?.id) {
      const nextPayload = {
        ...body,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from("pierre_company_memory")
        .update(nextPayload)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      savedRow = normalizeMemoryRow(data);
    } else {
      const insertPayload: Partial<PierreCompanyMemoryRow> = {
        user_id: user.id,
        ...body,
      };

      const { data, error } = await supabase
        .from("pierre_company_memory")
        .insert(insertPayload)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      savedRow = normalizeMemoryRow(data);
    }

    return json({
      ok: true,
      memory: savedRow,
      sender_identity: resolveSenderIdentity(savedRow),
    });
  } catch (error) {
    console.error("[pierre/company-memory][PATCH]", error);

    return json(
      {
        ok: false,
        error: "Impossible d’enregistrer la mémoire entreprise Pierre.",
      },
      500
    );
  }
}