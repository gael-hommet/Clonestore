// src/app/api/profile/enterprise-footprint/route.ts
// PHASE 3.14 — Enterprise Footprint Safe Apply — API Route
//
// GET  : lecture seule du dernier footprint serveur (auth obligatoire).
// POST : persistence safe feature-flaggée (auth + flag obligatoires).
//
// INVARIANTS :
//   - auth obligatoire (supabaseServer → RLS anon key)
//   - GET : select only — jamais de write
//   - POST : feature flag obligatoire — retourne 423 si flag false
//   - jamais de service role
//   - jamais cross-user
//   - compatible table absente / RLS KO
//   - jamais de throw non catchée
//   - aucune page sauf /profile/onboarding ne doit appeler cette route en P3.14

import { NextRequest, NextResponse } from "next/server";
import { isEnterpriseFootprintServerPersistenceEnabled } from "@/lib/clonestore/enterprise-footprint/enterprise-footprint-server-flags";
import {
  loadLatestEnterpriseFootprintServerReadOnly,
} from "@/lib/clonestore/enterprise-footprint/enterprise-footprint-server-readonly-client";
import {
  validateEnterpriseFootprintServerPayload,
  sanitizeEnterpriseFootprintServerPayload,
  assertEnterpriseFootprintServerNoSensitiveLeak,
} from "@/lib/clonestore/enterprise-footprint/enterprise-footprint-server-validation";
import {
  mapEnterpriseFootprintToServerPayload,
  mapEnterpriseFootprintServerRowToFootprint,
} from "@/lib/clonestore/enterprise-footprint/enterprise-footprint-server-mappers";
import {
  checkEnterpriseFootprintServerTableReadiness,
  isEnterpriseFootprintServerTableMissingError,
} from "@/lib/clonestore/enterprise-footprint/enterprise-footprint-server-health";
import {
  upsertEnterpriseFootprintServerDraftSafely,
} from "@/lib/clonestore/enterprise-footprint/enterprise-footprint-server-storage";

// ── Supabase server (anon key + cookies — RLS automatique, jamais service role) ──

function getSupabaseServer() {
  try {
    const { supabaseServer } = require("@/lib/supabase-server") as { supabaseServer: () => import("@supabase/supabase-js").SupabaseClient };
    return supabaseServer();
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonOk(body: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...body }, { status: 200 });
}

function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

// ── GET — Lecture seule du dernier footprint serveur ─────────────────────────

export async function GET(_req: NextRequest) {
  let supabase;
  try {
    supabase = getSupabaseServer();
  } catch {
    return jsonError("Supabase non configuré.", 503, { server_available: false, fallback_reason: "supabase_not_configured" });
  }

  if (!supabase) {
    return jsonError("Supabase non disponible.", 503, { server_available: false, fallback_reason: "supabase_unavailable" });
  }

  // Auth via RLS
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    return jsonError("Auth check failed.", 500, { server_available: false, fallback_reason: "auth_check_error" });
  }

  if (!userId) {
    return jsonError("Auth required.", 401, { server_available: false, fallback_reason: "auth_required" });
  }

  // Charger latest (SELECT only)
  try {
    const readResult = await loadLatestEnterpriseFootprintServerReadOnly(supabase, userId);

    if (!readResult.ok) {
      const isMissing = isEnterpriseFootprintServerTableMissingError({
        code: readResult.error_code,
        message: readResult.error_message,
      });
      return jsonOk({
        footprint: null,
        source: "none",
        server_available: !isMissing,
        fallback_reason: isMissing ? "table_missing" : readResult.error_code,
        updated_at: null,
      });
    }

    if (!readResult.latest) {
      return jsonOk({
        footprint: null,
        source: "none",
        server_available: true,
        fallback_reason: "no_footprint_found",
        updated_at: null,
      });
    }

    const footprint = mapEnterpriseFootprintServerRowToFootprint(readResult.latest);
    return jsonOk({
      footprint,
      source: "server",
      server_available: true,
      fallback_reason: null,
      updated_at: readResult.latest.updated_at,
    });
  } catch {
    return jsonError("Erreur lecture serveur.", 500, { server_available: false, fallback_reason: "read_error" });
  }
}

// ── POST — Persistence feature-flaggée ───────────────────────────────────────

export async function POST(req: NextRequest) {
  // Guard feature flag — retourne 423 si désactivé
  if (!isEnterpriseFootprintServerPersistenceEnabled()) {
    return NextResponse.json({
      ok: false,
      error: "Persistence serveur désactivée.",
      persistence_disabled: true,
      hint: "Activer NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true après SQL + RLS validés.",
    }, { status: 423 });
  }

  let supabase;
  try {
    supabase = getSupabaseServer();
  } catch {
    return jsonError("Supabase non configuré.", 503);
  }

  if (!supabase) {
    return jsonError("Supabase non disponible.", 503);
  }

  // Auth
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    return jsonError("Auth check failed.", 500);
  }

  if (!userId) {
    return jsonError("Auth required.", 401);
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return jsonError("Body JSON invalide.", 400);
  }

  const footprint = body.footprint;
  if (!footprint || typeof footprint !== "object") {
    return jsonError("Footprint requis dans le body.", 400);
  }

  // Build payload
  const rawPayload = mapEnterpriseFootprintToServerPayload(
    footprint as Parameters<typeof mapEnterpriseFootprintToServerPayload>[0],
    userId
  );
  const sanitized = sanitizeEnterpriseFootprintServerPayload(rawPayload);

  // Validate
  const validation = validateEnterpriseFootprintServerPayload(sanitized);
  if (!validation.valid) {
    return jsonError("Validation échouée.", 422, { issues: validation.issues });
  }

  // Leak check
  const leakCheck = assertEnterpriseFootprintServerNoSensitiveLeak(sanitized);
  if (!leakCheck.safe) {
    return jsonError("Données sensibles détectées.", 422, { issues: leakCheck.issues });
  }

  // Health check avant write
  let health;
  try {
    health = await checkEnterpriseFootprintServerTableReadiness(supabase, userId);
  } catch {
    return jsonError("Health check failed.", 500);
  }

  if (!health.table_available) {
    return jsonError("Table SQL absente. Appliquer SQL PHASE_3_13 manuellement.", 503, {
      server_available: false,
      hint: "supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql",
    });
  }

  if (!health.rls_select_ok) {
    return jsonError("RLS non prête. Vérifier policies select/insert/update.", 503, {
      server_available: false,
    });
  }

  // Write
  try {
    const writeResult = await upsertEnterpriseFootprintServerDraftSafely(supabase, sanitized);

    if (!writeResult.ok) {
      return jsonError(writeResult.error_message ?? "Échec persistence serveur.", 500, {
        error_code: writeResult.error_code,
        skipped: writeResult.skipped,
        skip_reason: writeResult.skip_reason,
      });
    }

    return jsonOk({
      row_id: writeResult.row_id,
      server_version: writeResult.server_version,
      persisted: true,
    });
  } catch {
    return jsonError("Erreur inattendue persistence.", 500);
  }
}
