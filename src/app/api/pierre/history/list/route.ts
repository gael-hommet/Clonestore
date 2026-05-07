import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

type HistoryItem = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  kind?: string | null;
  status?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  document_id?: string | null;
  email_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
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

  for (const cookie of request.cookies.getAll()) {
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

function asIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

function sortDesc<T extends { updated_at?: string | null; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const db = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return db - da;
  });
}

function buildMissionItem(row: Record<string, unknown>): HistoryItem | null {
  const id = trimOrNull(row.id);
  if (!id) return null;

  return {
    id: `mission:${id}`,
    title: trimOrNull(row.title) ?? "Mission Pierre",
    subtitle: trimOrNull(row.request_text) ?? trimOrNull(row.summary),
    kind: "mission",
    status: trimOrNull(row.status),
    mission_id: id,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

function buildTaskItem(row: Record<string, unknown>): HistoryItem | null {
  const id = trimOrNull(row.id);
  if (!id) return null;

  return {
    id: `task:${id}`,
    title: trimOrNull(row.title) ?? "Tâche Pierre",
    subtitle: trimOrNull(row.type),
    kind: "task",
    status: trimOrNull(row.status),
    mission_id: trimOrNull(row.mission_id),
    task_id: id,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

function buildDocumentItem(row: Record<string, unknown>): HistoryItem | null {
  const id = trimOrNull(row.id);
  if (!id) return null;

  return {
    id: `document:${id}`,
    title: trimOrNull(row.title) ?? "Document Pierre",
    subtitle: trimOrNull(row.type),
    kind: "document",
    status: trimOrNull(row.status),
    mission_id: trimOrNull(row.mission_id),
    task_id: trimOrNull(row.task_id),
    document_id: id,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

function buildEmailItem(row: Record<string, unknown>): HistoryItem | null {
  const id = trimOrNull(row.id);
  if (!id) return null;

  return {
    id: `email:${id}`,
    title: trimOrNull(row.subject) ?? "Email Pierre",
    subtitle: trimOrNull(row.sender_email),
    kind: "email",
    status: trimOrNull(row.status),
    mission_id: trimOrNull(row.mission_id),
    task_id: trimOrNull(row.task_id),
    email_id: id,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await resolveUser(supabase, request);

    if (!user) {
      return json({
        ok: true,
        items: [],
        next_cursor: null,
        auth: "missing",
      });
    }

    const url = new URL(request.url);
    const includeTasks = url.searchParams.get("includeTasks") === "true";
    const limitRaw = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
    const cursor = trimOrNull(url.searchParams.get("cursor"));

    let missionQuery = supabase
      .from("pierre_missions")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      missionQuery = missionQuery.lt("updated_at", cursor);
    }

    const { data: missionRows, error: missionError } = await missionQuery;
    if (missionError) throw missionError;

    const missions = Array.isArray(missionRows) ? missionRows : [];
    const hasMore = missions.length > limit;
    const visibleMissions = missions.slice(0, limit);
    const missionIds = visibleMissions
      .map((row) => trimOrNull((row as Record<string, unknown>).id))
      .filter((value): value is string => Boolean(value));

    const items: HistoryItem[] = [];

    for (const row of visibleMissions) {
      const item = buildMissionItem(row as Record<string, unknown>);
      if (item) items.push(item);
    }

    if (includeTasks && missionIds.length > 0) {
      const [{ data: taskRows, error: taskError }, { data: docRows, error: docError }, { data: emailRows, error: emailError }] =
        await Promise.all([
          supabase
            .from("pierre_tasks")
            .select("*")
            .in("mission_id", missionIds)
            .order("updated_at", { ascending: false })
            .limit(limit * 2),
          supabase
            .from("pierre_documents")
            .select("*")
            .in("mission_id", missionIds)
            .order("updated_at", { ascending: false })
            .limit(limit * 2),
          supabase
            .from("pierre_outbound_emails")
            .select("*")
            .in("mission_id", missionIds)
            .order("updated_at", { ascending: false })
            .limit(limit * 2),
        ]);

      if (taskError) throw taskError;
      if (docError) throw docError;
      if (emailError) throw emailError;

      for (const row of Array.isArray(taskRows) ? taskRows : []) {
        const item = buildTaskItem(row as Record<string, unknown>);
        if (item) items.push(item);
      }

      for (const row of Array.isArray(docRows) ? docRows : []) {
        const item = buildDocumentItem(row as Record<string, unknown>);
        if (item) items.push(item);
      }

      for (const row of Array.isArray(emailRows) ? emailRows : []) {
        const item = buildEmailItem(row as Record<string, unknown>);
        if (item) items.push(item);
      }
    }

    const sortedItems = sortDesc(items).slice(0, limit * (includeTasks ? 4 : 1));
    const nextCursor =
      hasMore && visibleMissions.length > 0
        ? trimOrNull(
            (visibleMissions[visibleMissions.length - 1] as Record<string, unknown>).updated_at
          )
        : null;

    return json({
      ok: true,
      items: sortedItems,
      next_cursor: nextCursor,
      auth: "resolved",
    });
  } catch (error) {
    console.error("[pierre/history/list][GET]", error);

    return json(
      {
        ok: false,
        error: "Impossible de charger l’historique Pierre.",
      },
      500
    );
  }
}