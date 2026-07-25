// src/app/api/clonestore/runtime/mission-drafts/route.ts
// PHASE 4.5 — Runtime Mission Draft — Server Persistence Route (feature-flaggée)
//
// POST = SAUVEGARDE de brouillon uniquement, JAMAIS exécution, JAMAIS mission réelle.
// Feature flag NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED default false
// → POST retourne 423 (Locked) en état normal.
//
// INVARIANTS :
//   - flag false → 423, db_write_performed false, mission_created false, execution_started false
//   - flag true → auth obligatoire (supabaseServer → RLS anon key, jamais service role)
//   - aucun appel moteur Pierre, aucun fournisseur IA externe, aucune exécution CloneOS
//   - safety_flags d'exécution toujours false

import { NextRequest, NextResponse } from "next/server";
import { isRuntimeMissionDraftServerPersistenceEnabled } from "@/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-flags";
import { RUNTIME_MISSION_DRAFT_TABLE_NAME } from "@/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-types";
import {
  buildRuntimeMissionDraftServerCapabilities,
  buildRuntimeMissionDraftServerSaveResponse,
  buildRuntimeMissionDraftServerError,
  validateRuntimeMissionDraftServerSaveRequest,
  sanitizeRuntimeMissionDraftServerSaveRequest,
} from "@/lib/clonestore/runtime-integration/runtime-mission-draft-server-api-contract";
import {
  buildRuntimeMissionDraftPersistenceRecord,
  validateRuntimeMissionDraftPersistenceRecord,
} from "@/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-design";

// ── Supabase server (anon key + cookies — RLS automatique, jamais service role) ──

async function getSupabaseServer() {
  try {
    const { supabaseServer } = (await import("@/lib/supabase-server")) as { supabaseServer: () => Promise<import("@supabase/supabase-js").SupabaseClient> };
    return await supabaseServer();
  } catch {
    return null;
  }
}

// ── GET — capabilities (et lecture serveur si flag true + auth) ───────────────

export async function GET() {
  const flagEnabled = isRuntimeMissionDraftServerPersistenceEnabled();
  const capabilities = buildRuntimeMissionDraftServerCapabilities(flagEnabled);

  if (!flagEnabled) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerSaveResponse("disabled", { capabilities }),
      { status: 200 }
    );
  }

  // Flag true : tenter une lecture read-only des propres brouillons.
  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerSaveResponse("server_unavailable", { capabilities }),
      { status: 200 }
    );
  }

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerSaveResponse("auth_required", { capabilities }),
      { status: 200 }
    );
  }

  try {
    const { error } = await supabase
      .from(RUNTIME_MISSION_DRAFT_TABLE_NAME)
      .select("draft_id")
      .eq("user_id", userId)
      .limit(1);
    const tableMissing = Boolean(error && (error.code === "42P01" || /does not exist/i.test(error.message ?? "")));
    return NextResponse.json(
      buildRuntimeMissionDraftServerSaveResponse(tableMissing ? "table_missing" : "ok", { capabilities }),
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      buildRuntimeMissionDraftServerSaveResponse("server_unavailable", { capabilities }),
      { status: 200 }
    );
  }
}

// ── POST — sauvegarde de brouillon (feature-flaggée, 423 si flag false) ───────

export async function POST(request: NextRequest) {
  // Guard flag → 423 Locked
  if (!isRuntimeMissionDraftServerPersistenceEnabled()) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerSaveResponse("disabled", {
        error: {
          code: "PERSISTENCE_DISABLED",
          message: "Persistance serveur des brouillons désactivée (default false).",
        },
      }),
      { status: 423 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      buildRuntimeMissionDraftServerError({ code: "INVALID_JSON", message: "Corps JSON invalide." }, "invalid_request"),
      { status: 400 }
    );
  }

  const validation = validateRuntimeMissionDraftServerSaveRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerError(validation.error ?? { code: "INVALID_REQUEST", message: "Requête invalide." }, "invalid_request"),
      { status: 400 }
    );
  }

  const safe = sanitizeRuntimeMissionDraftServerSaveRequest(body);
  if (!safe) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerError({ code: "INVALID_REQUEST", message: "Requête invalide." }, "invalid_request"),
      { status: 400 }
    );
  }

  // Auth obligatoire
  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerError({ code: "SERVER_UNAVAILABLE", message: "Supabase non disponible." }, "server_unavailable"),
      { status: 503 }
    );
  }

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerError({ code: "AUTH_REQUIRED", message: "Authentification requise." }, "auth_required"),
      { status: 401 }
    );
  }

  // Construire et valider le record (safety flags tous false)
  const record = buildRuntimeMissionDraftPersistenceRecord(safe.draft, {
    user_id: userId,
    company_id: safe.company_id,
  });
  const recordValidation = validateRuntimeMissionDraftPersistenceRecord(record);
  if (!recordValidation.valid) {
    return NextResponse.json(
      buildRuntimeMissionDraftServerError({ code: "RECORD_INVALID", message: "Record non conforme (safety flags)." }, "invalid_request"),
      { status: 422 }
    );
  }

  // Upsert dans la table (brouillon uniquement — jamais de mission réelle, jamais d'exécution)
  try {
    const p = record.payload;
    const row = {
      user_id: userId,
      company_id: record.company_id,
      draft_id: p.draft_id,
      command_id: p.command_id,
      intent_id: p.intent_id,
      route_id: p.route_id,
      plan_id: p.plan_id,
      employee_key: p.employee_key,
      kind: p.kind,
      status: p.status,
      source: p.source,
      title: p.title,
      objective: p.objective,
      summary: p.summary,
      domain: p.domain,
      risk_level: p.risk_level,
      validation_mode: p.validation_mode,
      draft_payload: p.draft_payload,
      safety_flags: record.safety_flags,
      guard_snapshot: p.guard_snapshot,
      trace_snapshot: p.trace_snapshot,
      idempotency_snapshot: p.idempotency_snapshot,
      queue_snapshot: p.queue_snapshot,
      cost_snapshot: p.cost_snapshot,
      scale_snapshot: p.scale_snapshot,
    };

    const { error } = await supabase
      .from(RUNTIME_MISSION_DRAFT_TABLE_NAME)
      .upsert(row, { onConflict: "user_id,command_id,plan_id" });

    if (error) {
      const tableMissing = error.code === "42P01" || /does not exist/i.test(error.message ?? "");
      return NextResponse.json(
        buildRuntimeMissionDraftServerError(
          { code: error.code ?? "WRITE_FAILED", message: error.message ?? "Échec sauvegarde." },
          tableMissing ? "table_missing" : "error"
        ),
        { status: tableMissing ? 503 : 500 }
      );
    }

    return NextResponse.json(
      buildRuntimeMissionDraftServerSaveResponse("ok", { draft: safe.draft, record, db_write_performed: true }),
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      buildRuntimeMissionDraftServerError({ code: "WRITE_ERROR", message: "Erreur inattendue sauvegarde." }, "error"),
      { status: 500 }
    );
  }
}
