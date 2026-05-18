import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildAuditTrailEvents,
  buildAuditTrailExport,
  filterAuditTrailEvents,
  type PierreAuditTrailFilter,
} from "../../../../../../lib/pierre/hr/audit-trail";

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}
function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}
function mapDbError(error: unknown) {
  if (isObject(error)) return { message: asString(error.message) || "Unexpected database error.", code: asString(error.code) };
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function tryReadBearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.includes("auth-token")) continue;
    const raw = cookie.value;
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const c = parsed.find((i): i is string => typeof i === "string" && i.split(".").length === 3);
        if (c) return c;
      }
      if (isObject(parsed)) {
        const cs = isObject(parsed.currentSession) ? parsed.currentSession : null;
        const c = asString(parsed.access_token) || (cs ? asString(cs.access_token) : null);
        if (c) return c;
      }
    } catch { if (raw.split(".").length === 3) return raw; }
  }
  return null;
}

async function authenticateRequest(request: NextRequest, supabaseAdmin: SupabaseClient): Promise<string> {
  const token = tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!token) throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  return data.user.id;
}

async function hasPierreAccess(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.from("orders").select("id").eq("user_id", userId).eq("agent_slug", "pierre").eq("status", "active").limit(1).maybeSingle();
    return Boolean(data);
  } catch { return false; }
}

const MAX_EXPORT_LIMIT = 500;

async function fetchAll(supabase: SupabaseClient, userId: string, missionId: string | null, employeeId: string | null, limit: number): Promise<{
  missions: DbRow[]; tasks: DbRow[]; documents: DbRow[]; logs: DbRow[];
}> {
  const [missions, tasks, documents, logs] = await Promise.all([
    (async () => {
      try {
        let q = supabase.from("pierre_missions")
          .select("id, status, risk_level, approval_required, mission_summary, intent, created_at")
          .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(limit);
        if (missionId) q = q.eq("id", missionId);
        const { data } = await q;
        return Array.isArray(data) ? (data as DbRow[]) : [];
      } catch { return []; }
    })(),
    (async () => {
      try {
        let q = supabase.from("pierre_tasks")
          .select("id, mission_id, type, title, status, approval_required, created_at")
          .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(limit);
        if (missionId) q = q.eq("mission_id", missionId);
        const { data } = await q;
        return Array.isArray(data) ? (data as DbRow[]) : [];
      } catch { return []; }
    })(),
    (async () => {
      try {
        let q = supabase.from("pierre_documents")
          .select("id, mission_id, task_id, doc_type, title, created_at")
          .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(limit);
        if (missionId) q = q.eq("mission_id", missionId);
        const { data } = await q;
        return Array.isArray(data) ? (data as DbRow[]) : [];
      } catch { return []; }
    })(),
    (async () => {
      try {
        let q = supabase.from("pierre_task_logs")
          .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
          .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(limit);
        if (missionId) q = q.eq("mission_id", missionId);
        const { data } = await q;
        let rows = Array.isArray(data) ? (data as DbRow[]) : [];
        if (employeeId) {
          rows = rows.filter((r) => {
            try {
              const m = isObject(r.meta_json) ? r.meta_json : {};
              return asString(m.employee_id) === employeeId;
            } catch { return false; }
          });
        }
        return rows;
      } catch { return []; }
    })(),
  ]);

  return { missions, tasks, documents, logs };
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const url = new URL(request.url);
    const mission_id = asString(url.searchParams.get("mission_id"));
    const employee_id = asString(url.searchParams.get("employee_id"));
    const rawLimit = parseInt(url.searchParams.get("limit") ?? "200", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_EXPORT_LIMIT) : 200;

    const now = new Date();

    const { missions, tasks, documents, logs } = await fetchAll(supabaseAdmin, userId, mission_id, employee_id, limit);

    const allEvents = buildAuditTrailEvents({ missions, tasks, documents, logs });

    const filter: PierreAuditTrailFilter = { mission_id, employee_id, limit };
    const filteredEvents = filterAuditTrailEvents(allEvents, filter);

    const exportData = buildAuditTrailExport(filteredEvents);

    const scope = mission_id
      ? `mission:${mission_id}`
      : employee_id
        ? `employee:${employee_id}`
        : `user:${userId}`;

    return NextResponse.json({
      ok: true,
      export: {
        generated_at: now.toISOString(),
        scope,
        ...exportData,
      },
      meta: {
        canonical_route: "/api/pierre/use/audit-trail/export",
        userId,
        fetchedAt: now.toISOString(),
        events_exported: filteredEvents.length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status, {
        code: asString(error.code), details: (error as { details?: unknown }).details ?? null,
      });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
