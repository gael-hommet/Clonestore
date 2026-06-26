// src/lib/clonestore/onboarding/global-onboarding-health.ts
// PHASE 3.6 — Global Onboarding Safe Apply — Health Check Table/RLS
//
// Vérifie la disponibilité de la table clonestore_global_onboarding_drafts
// et la politique RLS select avant toute tentative d'écriture.
//
// INVARIANTS ABSOLUS :
//   - Aucune écriture (insert/update/delete/upsert) dans ce fichier
//   - Aucun service role côté client
//   - Aucun throw brut vers l'UI
//   - Fallback localStorage si health KO

import type { SupabaseClient } from "@supabase/supabase-js";
import { GLOBAL_ONBOARDING_TABLE_NAME } from "./global-onboarding-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GlobalOnboardingHealthReport = {
  table_available: boolean;
  rls_select_ok: boolean;
  can_attempt_write: boolean;
  error_code: string | null;
  error_message: string | null;
  warning: string | null;
};

// ── Codes d'erreur Supabase / PostgreSQL ──────────────────────────────────────

const TABLE_MISSING_CODES = ["42P01", "PGRST116", "PGRST200"];

const RLS_ERROR_CODES = ["42501", "PGRST301"];

// ── Détecteurs d'erreur ───────────────────────────────────────────────────────

export function isGlobalOnboardingTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = String(e.code ?? "");
  const message = String(e.message ?? "").toLowerCase();
  return (
    TABLE_MISSING_CODES.includes(code) ||
    message.includes("does not exist") ||
    message.includes("table not found") ||
    message.includes("relation") ||
    message.includes("no such table") ||
    message.includes("undefined")
  );
}

export function isGlobalOnboardingRlsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = String(e.code ?? "");
  const message = String(e.message ?? "").toLowerCase();
  return (
    RLS_ERROR_CODES.includes(code) ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("new row violates") ||
    message.includes("policy") ||
    message.includes("rls")
  );
}

// ── Health check principal ────────────────────────────────────────────────────
// Select read-only très limité — JAMAIS insert/update/delete/upsert.
// Utilise uniquement la clé anon (jamais service role).
// try/catch complet — jamais de throw brut.

export async function checkGlobalOnboardingTableReadiness(
  supabase: SupabaseClient | null,
  userId: string | null
): Promise<GlobalOnboardingHealthReport> {
  // Sans client ou userId : vérification impossible
  if (!supabase || !userId || !userId.trim()) {
    return {
      table_available: false,
      rls_select_ok: false,
      can_attempt_write: false,
      error_code: null,
      error_message: "Client Supabase ou userId absent — vérification impossible.",
      warning: "Fonctionnement en localStorage uniquement.",
    };
  }

  try {
    // Select read-only : id seulement, limité à 1 ligne, filtré par userId (RLS compatible)
    // JAMAIS insert / update / delete / upsert dans ce health check
    const { error } = await supabase
      .from(GLOBAL_ONBOARDING_TABLE_NAME)
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!error) {
      // Select réussi → table disponible + RLS select OK
      return {
        table_available: true,
        rls_select_ok: true,
        can_attempt_write: true,
        error_code: null,
        error_message: null,
        warning: null,
      };
    }

    // Analyse de l'erreur
    if (isGlobalOnboardingTableMissingError(error)) {
      return {
        table_available: false,
        rls_select_ok: false,
        can_attempt_write: false,
        error_code: String(error.code ?? "table_missing"),
        error_message: `Table ${GLOBAL_ONBOARDING_TABLE_NAME} absente ou inaccessible.`,
        warning:
          "Appliquer supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql manuellement dans Supabase Dashboard.",
      };
    }

    if (isGlobalOnboardingRlsError(error)) {
      return {
        table_available: true,
        rls_select_ok: false,
        can_attempt_write: false,
        error_code: String(error.code ?? "rls_error"),
        error_message: `RLS bloquée sur ${GLOBAL_ONBOARDING_TABLE_NAME}.`,
        warning:
          "Vérifier policy select_own_global_onboarding : USING (auth.uid() = user_id).",
      };
    }

    // Erreur inconnue — fallback localStorage
    const unknownErr = error as unknown as Record<string, unknown>;
    return {
      table_available: false,
      rls_select_ok: false,
      can_attempt_write: false,
      error_code: String(unknownErr.code ?? "unknown"),
      error_message: String(unknownErr.message ?? "Erreur inconnue"),
      warning: "Fallback localStorage actif.",
    };
  } catch (err) {
    // Exception inattendue (env manquant, réseau, etc.)
    return {
      table_available: false,
      rls_select_ok: false,
      can_attempt_write: false,
      error_code: "exception",
      error_message: err instanceof Error ? err.message : "Exception inattendue",
      warning: "Fallback localStorage actif.",
    };
  }
}

// ── Rapport human-lisible ─────────────────────────────────────────────────────

export function buildGlobalOnboardingHealthReport(
  health: GlobalOnboardingHealthReport
): string {
  const lines: string[] = [
    `[Onboarding Health] Table: ${health.table_available ? "OK" : "ABSENTE"}`,
    `[Onboarding Health] RLS select: ${health.rls_select_ok ? "OK" : "BLOQUÉE"}`,
    `[Onboarding Health] Write possible: ${health.can_attempt_write ? "OUI" : "NON"}`,
  ];
  if (health.error_message) {
    lines.push(`[Onboarding Health] Erreur: ${health.error_message}`);
  }
  if (health.warning) {
    lines.push(`[Onboarding Health] Avertissement: ${health.warning}`);
  }
  return lines.join("\n");
}
