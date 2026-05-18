import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreOperationalFeed,
  buildFeedSummary,
  buildFeedSections,
  buildPremiumFeedSummary,
  buildOperationalCommandCenter,
  normalizeFeedCategoryAlias,
  type PierreOperationalFeedCategory,
  type PierreOperationalFeedItem,
} from "../../../../../../lib/pierre/hr/operational-feed";
import {
  buildMissionControlActionFromTask,
  sortMissionControlActions,
} from "../../../../../../lib/pierre/hr/mission-control";
import {
  buildAuditTrailEvents,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailAlerts,
} from "../../../../../../lib/pierre/hr/audit-trail";

// ── Types ──────────────────────────────────────────────────

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

const CATEGORY_LABELS: Record<PierreOperationalFeedCategory, string> = {
  alert: "Alertes",
  follow_up: "Suivis",
  delivery: "Livraisons",
  briefing: "Briefings",
};

// ── Helpers ────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message: asString(error.message) || "Unexpected database error.",
      code: asString(error.code),
    };
  }
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

// ── Supabase ───────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Auth ───────────────────────────────────────────────────

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
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
        const candidate = parsed.find(
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );
        if (candidate) return candidate;
      }
      if (isObject(parsed)) {
        const currentSession = isObject(parsed.currentSession) ? parsed.currentSession : null;
        const candidate =
          asString(parsed.access_token) ||
          (currentSession ? asString(currentSession.access_token) : null);
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
): Promise<string> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!accessToken) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  }
  return data.user.id;
}

async function hasPierreAccess(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

// ── Data fetching ──────────────────────────────────────────

async function fetchMissions(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select(
      "id, status, understanding_status, risk_level, approval_required, mission_summary, intent, missing_info_json, brain_output_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw { status: 500, message: "Unable to load missions.", code: "MISSIONS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchTasks(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, brain_output_json, context_snapshot_json, result_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw { status: 500, message: "Unable to load tasks.", code: "TASKS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchDocuments(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_documents")
    .select(
      "id, mission_id, doc_type, title, status, text_content, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw { status: 500, message: "Unable to load documents.", code: "DOCUMENTS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchLogs(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_task_logs")
    .select(
      "id, mission_id, task_id, event_type, message, meta_json, created_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw { status: 500, message: "Unable to load logs.", code: "LOGS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

// ─────────────────────────────────────────────────────────
// GET /api/pierre/use/messages/[category]
// ─────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  const { category: rawCategory } = await params;

  // Accept French/English aliases via normalizeFeedCategoryAlias
  const feedCategory = normalizeFeedCategoryAlias(rawCategory);

  if (!feedCategory) {
    return jsonError(
      `Catégorie invalide : "${rawCategory}". Valeurs acceptées : alert, alertes, follow_up, suivis, delivery, livraisons, briefing, briefings.`,
      400,
      { code: "INVALID_MESSAGE_CATEGORY" },
    );
  }

  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const now = new Date();

    const [missions, tasks, documents, logs] = await Promise.all([
      fetchMissions(supabaseAdmin, userId),
      fetchTasks(supabaseAdmin, userId),
      fetchDocuments(supabaseAdmin, userId),
      fetchLogs(supabaseAdmin, userId),
    ]);

    const feed = buildPierreOperationalFeed({ missions, tasks, documents, logs, now });

    const items: PierreOperationalFeedItem[] = feed.items.filter(
      (it) => it.category === feedCategory,
    );

    const summary = buildFeedSummary(items);
    const sections = buildFeedSections(items);
    const premium_summary = buildPremiumFeedSummary(items);
    const command_center = buildOperationalCommandCenter(items);
    const category_label = CATEGORY_LABELS[feedCategory];

    const TERMINAL_CAT = new Set(["done", "cancelled"]);
    const mcCatActions = tasks
      .filter((t) => !TERMINAL_CAT.has((asString(t.status) ?? "").toLowerCase()))
      .map((t) => {
        try { return buildMissionControlActionFromTask(t, now); }
        catch (_e) { /* skip malformed row */ return null; }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    const mcCatSorted = sortMissionControlActions(mcCatActions);
    const mcCatSensitive = mcCatSorted.filter((a) => a.is_sensitive).length;
    const mcCatBlockers = mcCatSorted.filter((a) => a.is_blocking).length;
    const mcCatStatus =
      mcCatSensitive > 0 ? "sensitive" as const
      : mcCatBlockers > 0 ? "blocked" as const
      : mcCatSorted.some((a) => a.priority === "urgent") ? "attention_required" as const
      : mcCatSorted.length > 0 ? "active" as const
      : "clear" as const;
    const relatedActionsCount =
      feedCategory === "alert" ? mcCatSorted.filter((a) => a.priority === "urgent" || a.is_blocking).length
      : feedCategory === "follow_up" ? mcCatSorted.filter((a) => a.requires_human).length
      : feedCategory === "delivery" ? mcCatSorted.filter((a) => a.is_delivery).length
      : mcCatSorted.filter((a) => a.is_safe_to_run).length;

    const catAuditEvents = buildAuditTrailEvents({ missions, tasks, documents, logs });
    const catAuditDiag = buildAuditTrailDiagnostics(catAuditEvents);
    const catAuditHealth = scoreAuditTrailHealth(catAuditEvents);
    const catAuditDigest = buildAuditTrailDigest(catAuditEvents);
    const catAuditAlerts = buildAuditTrailAlerts(catAuditEvents);

    return NextResponse.json({
      ok: true,
      category: feedCategory,
      category_label,
      items,
      summary,
      sections,
      premium_summary,
      command_center,
      audit_trail_summary: {
        diagnostics: catAuditDiag,
        health: catAuditHealth,
        digest: catAuditDigest,
        alerts_count: catAuditAlerts.length,
        critical_count: catAuditDiag.critical_count,
        human_required_count: catAuditDiag.human_required_count,
      },
      mission_control: {
        status: mcCatStatus,
        top_actions: mcCatSorted.slice(0, 5),
        counts: {
          safe_to_run: mcCatSorted.filter((a) => a.is_safe_to_run && !a.requires_human).length,
          needs_human: mcCatSorted.filter((a) => a.requires_human).length,
          blockers: mcCatBlockers,
          sensitive: mcCatSensitive,
          deliveries: mcCatSorted.filter((a) => a.is_delivery).length,
        },
        category_relevance: {
          category: feedCategory,
          related_actions_count: relatedActionsCount,
        },
      },
      meta: {
        userId,
        fetchedAt: now.toISOString(),
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
        documents_loaded: documents.length,
        logs_loaded: logs.length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status as number,
        { code: asString(error.code), details: isObject(error.details) ? error.details : null },
      );
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
