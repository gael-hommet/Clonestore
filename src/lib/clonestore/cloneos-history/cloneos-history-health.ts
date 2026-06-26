// src/lib/clonestore/cloneos-history/cloneos-history-health.ts
// PHASE 3.3 — Apply CloneOS History Persistence Safely — Table Health Check
//
// Vérifie la disponibilité de la table et la RLS avant toute écriture.
// Lecture seule — jamais d'insert, update, delete, upsert.
// No service role. Safe fallback si table absente.
//
// Usage typique :
//   const health = await checkCloneOSHistoryTableReadiness(supabase, userId);
//   if (health.table_available && health.rls_select_ok) { /* proceed */ }

import type { SupabaseClient } from "@supabase/supabase-js";
import { CLONEOS_HISTORY_TABLE_NAME } from "./cloneos-history-types";

// ── Types résultat ────────────────────────────────────────────────────────────

export type CloneOSHistoryHealthReport = {
  table_available: boolean;
  rls_select_ok: boolean;
  can_attempt_write: boolean;
  error_code: string | null;
  error_message: string | null;
  warning: string | null;
};

// ── Helpers erreur ────────────────────────────────────────────────────────────

export function isCloneOSHistoryTableMissingError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string; message?: string };
  // PostgreSQL error code 42P01 = undefined_table
  if (e.code === "42P01") return true;
  // Supabase/PostgREST: relation does not exist
  if (typeof e.message === "string") {
    const msg = e.message.toLowerCase();
    if (msg.includes("relation") && msg.includes("does not exist")) return true;
    if (msg.includes("table") && msg.includes("not found")) return true;
    if (msg.includes("42p01")) return true;
  }
  return false;
}

export function isCloneOSHistoryRlsError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "42501") return true; // insufficient_privilege
  if (e.code === "PGRST301") return true; // RLS violation in PostgREST
  if (typeof e.message === "string") {
    const msg = e.message.toLowerCase();
    if (msg.includes("rls") || msg.includes("policy") || msg.includes("permission denied")) return true;
  }
  return false;
}

// ── Check principal ───────────────────────────────────────────────────────────
// Fait un select read-only très limité pour valider table + RLS.
// JAMAIS d'insert. Clé anon uniquement.

export async function checkCloneOSHistoryTableReadiness(
  supabase: SupabaseClient | null,
  userId: string | null
): Promise<CloneOSHistoryHealthReport> {
  if (!supabase || !userId) {
    return {
      table_available: false,
      rls_select_ok: false,
      can_attempt_write: false,
      error_code: "NO_CLIENT_OR_USER",
      error_message: "Supabase client ou userId manquant",
      warning: "Server persistence non disponible — fallback localStorage",
    };
  }

  try {
    // Read-only select minimal pour vérifier existence + RLS
    const { data, error } = await supabase
      .from(CLONEOS_HISTORY_TABLE_NAME)
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      if (isCloneOSHistoryTableMissingError(error)) {
        return {
          table_available: false,
          rls_select_ok: false,
          can_attempt_write: false,
          error_code: "TABLE_MISSING",
          error_message: `Table ${CLONEOS_HISTORY_TABLE_NAME} non trouvée — appliquer le SQL draft d'abord`,
          warning: "Voir docs/PHASE_3_3_CLONEOS_HISTORY_SAFE_APPLY.md",
        };
      }

      if (isCloneOSHistoryRlsError(error)) {
        return {
          table_available: true,
          rls_select_ok: false,
          can_attempt_write: false,
          error_code: "RLS_BLOCKED",
          error_message: "RLS bloque le select — vérifier les policies",
          warning: "Vérifier cloneos_history_select_own policy",
        };
      }

      return {
        table_available: false,
        rls_select_ok: false,
        can_attempt_write: false,
        error_code: error.code ?? "UNKNOWN",
        error_message: error.message,
        warning: "Fallback localStorage actif",
      };
    }

    // Select OK → table existe et RLS select fonctionne
    const hasRows = Array.isArray(data);
    return {
      table_available: true,
      rls_select_ok: true,
      can_attempt_write: true,
      error_code: null,
      error_message: null,
      warning: hasRows ? null : "Table disponible — aucun historique encore persisté",
    };
  } catch (err) {
    return {
      table_available: false,
      rls_select_ok: false,
      can_attempt_write: false,
      error_code: "EXCEPTION",
      error_message: err instanceof Error ? err.message : "Erreur inconnue",
      warning: "Fallback localStorage actif — server persistence indisponible",
    };
  }
}

// ── Rapport health lisible ────────────────────────────────────────────────────

export function buildCloneOSHistoryHealthReport(
  health: CloneOSHistoryHealthReport
): string {
  if (health.table_available && health.rls_select_ok) {
    return `Table ${CLONEOS_HISTORY_TABLE_NAME} : OK — RLS select OK — write possible`;
  }
  if (health.table_available && !health.rls_select_ok) {
    return `Table ${CLONEOS_HISTORY_TABLE_NAME} : présente — RLS select bloquée`;
  }
  return `Table ${CLONEOS_HISTORY_TABLE_NAME} : non disponible — ${health.error_message ?? "raison inconnue"}`;
}
