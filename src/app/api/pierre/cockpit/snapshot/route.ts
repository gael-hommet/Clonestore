// src/app/api/pierre/cockpit/snapshot/route.ts
// Pierre Cockpit B40 — Unified cockpit snapshot.
// Resolves user from auth (never trusts client-supplied company_id).
// Returns PierreCockpitSnapshot with tenant context + current state.
// No OpenAI/Anthropic calls. No Resend calls. No email sent.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasPierreAccess } from "../../../../../lib/pierre/access";
import {
  normalizeMissionResponse,
  normalizeTaskList,
  normalizeDocumentList,
  normalizeCloneADNProfile,
  extractValidationAlerts,
  validateSnapshotOwnership,
} from "../../../../../lib/pierre/cockpit/normalizers";
import { buildTenantContext } from "../../../../../lib/pierre/cockpit/tenant";
import {
  resolveCockpitState,
  buildDefaultBudgetStatus,
  buildDefaultRuntimeModes,
  buildSnapshotWarnings,
} from "../../../../../lib/pierre/cockpit/state";
import { resolveNextActions } from "../../../../../lib/pierre/cockpit/actions";
import type { PierreCockpitSnapshot } from "../../../../../lib/pierre/cockpit/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type DbRow = Record<string, unknown>;

// ── Supabase admin client ─────────────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase non configuré.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return parts[1].trim() || null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getNestedObject(src: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  if (!src) return null;
  const val = src[key];
  return isObject(val) ? val : null;
}

function getNestedString(src: Record<string, unknown> | null, key: string): string | null {
  if (!src) return null;
  const val = src[key];
  return typeof val === "string" && val.trim() ? val.trim() : null;
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
          (item): item is string => typeof item === "string" && item.split(".").length === 3,
        );
        if (typeof candidate === "string") return candidate;
      }
      if (isObject(parsed)) {
        const sess = getNestedObject(parsed, "currentSession");
        const token = getNestedString(parsed, "access_token") ?? getNestedString(sess, "access_token");
        if (token) return token;
      }
    } catch {
      if (raw.split(".").length === 3) return raw;
    }
  }
  return null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Extract access token
  const token = tryReadBearerToken(request) ?? tryReadSupabaseCookieToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  // 2. Resolve user from token (server-side — never trust client-supplied IDs)
  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Configuration serveur manquante (Supabase)" },
      { status: 503 },
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return NextResponse.json({ ok: false, error: "AUTH_INVALID" }, { status: 401 });
  }

  const userId = authData.user.id;

  // 3. Check Pierre access
  const accessResult = await hasPierreAccess(supabase, userId);
  const ownsPierre = accessResult.ok === true;

  // 4. Build tenant context (server-resolved — never from client query params)
  const tenant = buildTenantContext({
    user_id: userId,
    company_id: userId,         // For now: company_id = user_id (single-user tenancy)
    organization_id: null,
    access_level: ownsPierre ? "paid_customer" : "logged_unpaid",
    owns_pierre: ownsPierre,
    pierre_enabled: ownsPierre,
  });

  // 5. Early return if not authorized
  if (!ownsPierre) {
    const state = resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false });
    const snapshot: PierreCockpitSnapshot = {
      tenant,
      state,
      current_mission: null,
      missions: [],
      tasks: [],
      validations: [],
      deliverables: [],
      timeline: [],
      memory_summary: {
        status: "not_configured",
        score: null,
        tone: null,
        autonomy: null,
        validationMode: null,
        signature: null,
        configured: false,
      },
      channel_status: { email_mode: "mock", email_live: false },
      budget_status: buildDefaultBudgetStatus(),
      runtime_modes: buildDefaultRuntimeModes(),
      warnings: ["Pierre n'est pas activé sur ce compte."],
      next_actions: ["Activez votre abonnement Pierre pour accéder au cockpit."],
      generated_at: new Date().toISOString(),
    };
    return NextResponse.json({ ok: true, snapshot }, { status: 200 });
  }

  // 6. Load data — non-blocking: partial failures produce degraded state
  let hasError = false;
  let currentMission = null;
  let missions: ReturnType<typeof normalizeMissionResponse>[] = [];
  let tasks: ReturnType<typeof normalizeTaskList> = [];
  let deliverables: ReturnType<typeof normalizeDocumentList> = [];
  let memorySummary = normalizeCloneADNProfile(null);

  try {
    // Load last mission
    const { data: missionRows, error: missionError } = await supabase
      .from("pierre_missions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (missionError) {
      hasError = true;
    } else if (missionRows && missionRows.length > 0) {
      const missionRow = missionRows[0] as DbRow;
      const missionId = typeof missionRow.id === "string" ? missionRow.id : null;

      // Validate ownership (anti-leak)
      if (missionId && validateSnapshotOwnership(missionRow, userId)) {
        currentMission = normalizeMissionResponse({ mission: missionRow });

        // Load tasks for current mission
        const { data: taskRows, error: taskError } = await supabase
          .from("pierre_tasks")
          .select("*")
          .eq("user_id", userId)
          .eq("mission_id", missionId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (taskError) {
          hasError = true;
        } else {
          tasks = normalizeTaskList(taskRows ?? []);
        }

        // Rebuild current_mission with task counts
        if (currentMission && taskRows) {
          currentMission = normalizeMissionResponse({ mission: missionRow, tasks: taskRows });
        }

        // Load task artifacts as deliverables
        const { data: artifactRows, error: artifactError } = await supabase
          .from("pierre_task_artifacts")
          .select("*")
          .eq("user_id", userId)
          .eq("mission_id", missionId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (artifactError) {
          hasError = true;
        } else {
          deliverables = normalizeDocumentList(artifactRows ?? []);
        }
      }
    }
  } catch {
    hasError = true;
  }

  // 7. Load CloneADN memory
  try {
    const { data: memoryRows, error: memoryError } = await supabase
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();

    if (!memoryError && memoryRows) {
      const ctx = (memoryRows as DbRow).reusable_rh_context_json;
      const adnProfile = isObject(ctx) ? (ctx.clone_adn ?? null) : null;
      if (adnProfile) {
        memorySummary = normalizeCloneADNProfile({ profile: adnProfile, status: "configured" });
      }
    }
  } catch {
    hasError = true;
  }

  // 8. Build snapshot
  const validations = extractValidationAlerts(tasks);
  const emailMode = process.env.EMAIL_RUNTIME_MODE ?? "mock";
  const emailLive = process.env.EMAIL_SEND_LIVE === "true";
  const aiMode = process.env.AI_RUNTIME_MODE ?? "mock";
  const fileMode = process.env.FILE_RUNTIME_MODE ?? "mock";
  const channelMode = process.env.CHANNEL_RUNTIME_MODE ?? "mock";

  const runtimeModes = {
    ai_mode: aiMode,
    email_mode: emailMode,
    email_send_live: emailLive,
    file_mode: fileMode,
    channel_mode: channelMode,
  };

  const budgetStatus = buildDefaultBudgetStatus();
  budgetStatus.ai_mode = aiMode === "production" ? "production" : aiMode === "disabled" ? "disabled" : "mock";

  const state = resolveCockpitState(tenant, {
    hasData: currentMission !== null || tasks.length > 0,
    hasError,
    isLoading: false,
  });

  const warnings = buildSnapshotWarnings(state, budgetStatus, runtimeModes);

  const nextActions = resolveNextActions({
    hasMission: currentMission !== null,
    hasValidations: validations.length > 0,
    hasSensitiveTasks: tasks.some((t) => t.isSensitive),
    hasEmailTasks: tasks.some((t) => t.isEmailTask),
    hasDeliverables: deliverables.length > 0,
    memoryConfigured: memorySummary.configured,
    emailMode,
  });

  const snapshot: PierreCockpitSnapshot = {
    tenant,
    state,
    current_mission: currentMission,
    missions: currentMission ? [currentMission] : [],
    tasks,
    validations,
    deliverables,
    timeline: [],
    memory_summary: memorySummary,
    channel_status: { email_mode: emailMode, email_live: emailLive },
    budget_status: budgetStatus,
    runtime_modes: runtimeModes,
    warnings,
    next_actions: nextActions,
    generated_at: new Date().toISOString(),
  };

  return NextResponse.json({ ok: true, snapshot }, { status: 200 });
}
