// src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-readonly-client.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Client Read-Only
//
// Lecture seule depuis la table clonestore_enterprise_footprints.
// SELECT uniquement. Jamais de write.
//
// INVARIANTS :
//   - select only — aucun insert/update/delete/upsert
//   - pas de service role
//   - jamais de throw brut
//   - fallback empty result si table absente ou RLS non prête
//   - compatible table absente (error code 42P01)

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EnterpriseFootprintServerRow,
  EnterpriseFootprintServerReadResult,
} from "./enterprise-footprint-server-types";
import { ENTERPRISE_FOOTPRINT_SERVER_TABLE } from "./enterprise-footprint-server-schema";

// ── Empty result ──────────────────────────────────────────────────────────────

function buildEmptyReadResult(
  error_code: string | null = null,
  error_message: string | null = null
): EnterpriseFootprintServerReadResult {
  return {
    rows: [],
    latest: null,
    count: 0,
    ok: false,
    error_code,
    error_message,
  };
}

// ── Sort rows ─────────────────────────────────────────────────────────────────

export function sortEnterpriseFootprintServerRows(
  rows: EnterpriseFootprintServerRow[]
): EnterpriseFootprintServerRow[] {
  return [...rows].sort((a, b) => {
    const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return dateB - dateA; // plus récent en premier
  });
}

// ── Map result ────────────────────────────────────────────────────────────────

export function mapEnterpriseFootprintServerReadResult(
  rows: EnterpriseFootprintServerRow[]
): EnterpriseFootprintServerReadResult {
  const sorted = sortEnterpriseFootprintServerRows(rows);
  return {
    rows: sorted,
    latest: sorted[0] ?? null,
    count: sorted.length,
    ok: true,
    error_code: null,
    error_message: null,
  };
}

// ── Load all footprints (read-only) ───────────────────────────────────────────

export async function loadEnterpriseFootprintServerReadOnly(
  supabase: SupabaseClient,
  userId: string,
  companyId?: string
): Promise<EnterpriseFootprintServerReadResult> {
  if (!userId?.trim()) {
    return buildEmptyReadResult("USER_ID_MISSING", "user_id requis.");
  }

  try {
    let query = supabase
      .from(ENTERPRISE_FOOTPRINT_SERVER_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (companyId?.trim()) {
      query = query.eq("company_id", companyId.trim());
    }

    const { data, error } = await query;

    if (error) {
      return buildEmptyReadResult(
        error.code ?? "UNKNOWN",
        error.message ?? "Erreur lecture serveur."
      );
    }

    return mapEnterpriseFootprintServerReadResult(
      (data as EnterpriseFootprintServerRow[]) ?? []
    );
  } catch {
    return buildEmptyReadResult("FETCH_ERROR", "Erreur inattendue lecture serveur.");
  }
}

// ── Load latest (read-only) ───────────────────────────────────────────────────

export async function loadLatestEnterpriseFootprintServerReadOnly(
  supabase: SupabaseClient,
  userId: string
): Promise<EnterpriseFootprintServerReadResult> {
  if (!userId?.trim()) {
    return buildEmptyReadResult("USER_ID_MISSING", "user_id requis.");
  }

  try {
    const { data, error } = await supabase
      .from(ENTERPRISE_FOOTPRINT_SERVER_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      return buildEmptyReadResult(
        error.code ?? "UNKNOWN",
        error.message ?? "Erreur lecture serveur."
      );
    }

    return mapEnterpriseFootprintServerReadResult(
      (data as EnterpriseFootprintServerRow[]) ?? []
    );
  } catch {
    return buildEmptyReadResult("FETCH_ERROR", "Erreur inattendue lecture serveur.");
  }
}
