// src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-health.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Health Check
//
// Vérification read-only de la disponibilité de la table serveur.
// SELECT uniquement. Jamais de write.
//
// INVARIANTS :
//   - select seulement — aucun insert/update/delete/upsert
//   - pas de service role
//   - pas de migration
//   - jamais de throw brut
//   - résultat structuré toujours retourné

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnterpriseFootprintServerHealth } from "./enterprise-footprint-server-types";
import { ENTERPRISE_FOOTPRINT_SERVER_TABLE } from "./enterprise-footprint-server-schema";

// ── Codes d'erreur Supabase/Postgres ──────────────────────────────────────────

const PG_TABLE_MISSING_CODE = "42P01";    // undefined_table
const PG_RLS_VIOLATION_CODE = "42501";    // insufficient_privilege
const PGRST_TABLE_MISSING_CODE = "PGRST116";  // PostgREST table not found

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isEnterpriseFootprintServerTableMissingError(
  error: unknown
): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = String(e.code ?? "");
  const message = String(e.message ?? "").toLowerCase();
  return (
    code === PG_TABLE_MISSING_CODE ||
    code === PGRST_TABLE_MISSING_CODE ||
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("undefined_table")
  );
}

export function isEnterpriseFootprintServerRlsError(
  error: unknown
): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = String(e.code ?? "");
  const message = String(e.message ?? "").toLowerCase();
  return (
    code === PG_RLS_VIOLATION_CODE ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("rls")
  );
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkEnterpriseFootprintServerTableReadiness(
  supabase: SupabaseClient,
  userId: string
): Promise<EnterpriseFootprintServerHealth> {
  const warnings: string[] = [];
  const checkedAt = new Date().toISOString();

  if (!userId?.trim()) {
    return {
      table_available: false,
      rls_select_ok: false,
      can_attempt_write: false,
      error_code: "USER_ID_MISSING",
      error_message: "user_id requis pour le health check.",
      warnings,
      checked_at: checkedAt,
    };
  }

  try {
    // SELECT read-only limité — vérifie table + RLS select
    const { data, error } = await supabase
      .from(ENTERPRISE_FOOTPRINT_SERVER_TABLE)
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      const tableMissing = isEnterpriseFootprintServerTableMissingError(error);
      const rlsError = isEnterpriseFootprintServerRlsError(error);

      if (tableMissing) {
        warnings.push("Table clonestore_enterprise_footprints absente. Appliquer le SQL PHASE_3_13 manuellement.");
      }
      if (rlsError) {
        warnings.push("Erreur RLS. Vérifier les politiques select/insert/update.");
      }

      return {
        table_available: !tableMissing,
        rls_select_ok: false,
        can_attempt_write: false,
        error_code: error.code ?? "HEALTH_ERROR",
        error_message: error.message ?? "Erreur health check.",
        warnings,
        checked_at: checkedAt,
      };
    }

    // Select a réussi → table available + RLS select ok
    const rowCount = Array.isArray(data) ? data.length : 0;
    if (rowCount === 0) {
      warnings.push("Table disponible mais aucune ligne pour cet utilisateur. Normal si première utilisation.");
    }

    return {
      table_available: true,
      rls_select_ok: true,
      can_attempt_write: true,
      error_code: null,
      error_message: null,
      warnings,
      checked_at: checkedAt,
    };
  } catch {
    return {
      table_available: false,
      rls_select_ok: false,
      can_attempt_write: false,
      error_code: "UNEXPECTED_ERROR",
      error_message: "Erreur inattendue health check.",
      warnings,
      checked_at: checkedAt,
    };
  }
}

// ── Build health report ───────────────────────────────────────────────────────

export function buildEnterpriseFootprintServerHealthReport(
  health: EnterpriseFootprintServerHealth
): string {
  const lines = [
    `[Health PHASE 3.13] checked_at: ${health.checked_at}`,
    `  table_available: ${health.table_available}`,
    `  rls_select_ok: ${health.rls_select_ok}`,
    `  can_attempt_write: ${health.can_attempt_write}`,
  ];

  if (health.error_code) {
    lines.push(`  error: [${health.error_code}] ${health.error_message}`);
  }
  if (health.warnings.length > 0) {
    lines.push(`  warnings:`);
    health.warnings.forEach((w) => lines.push(`    - ${w}`));
  }

  if (!health.table_available) {
    lines.push("  → Appliquer supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql manuellement.");
  }
  if (!health.rls_select_ok) {
    lines.push("  → Vérifier RLS et politiques select/insert/update.");
  }

  return lines.join("\n");
}
