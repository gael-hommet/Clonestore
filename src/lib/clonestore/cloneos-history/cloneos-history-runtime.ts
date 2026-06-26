// src/lib/clonestore/cloneos-history/cloneos-history-runtime.ts
// PHASE 3.3 — Apply CloneOS History Persistence Safely — Runtime Bridge
//
// Fonction unique d'intégration pour persister CloneOSHistory avec fallback safe.
//
// Flux d'exécution :
//   1. mapper résultat CloneOS → CloneOSHistoryItem
//   2. écrire en localStorage TOUJOURS (step 1 immuable)
//   3. si flag désactivé → retour local_persisted
//   4. si pas userId → retour local_persisted_auth_required
//   5. si validation item échoue → retour local_persisted_validation_failed
//   6. check health table (read-only)
//   7. si table unavailable → retour local_persisted_server_unavailable
//   8. tenter DB write
//   9. si DB fail → localStorage reste OK, retour local_persisted_server_error
//  10. succès → retour server_persisted
//
// INVARIANTS :
//   - localStorage écrit AVANT toute tentative DB
//   - aucune erreur DB ne bloque UI
//   - jamais d'exécution métier
//   - jamais de service role

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloneOSCommandCenterResult } from "@/lib/clonestore/cloneos";
import type { CloneOSHistoryWriteResult } from "./cloneos-history-types";
import { mapCloneOSResultToHistoryItem } from "./cloneos-history-mappers";
import { appendCloneOSHistoryToLocalStorage } from "./cloneos-history-localstorage";
import { isCloneOSHistoryServerPersistenceEnabled } from "./cloneos-history-flags";
import { validateCloneOSHistoryItem } from "./cloneos-history-validation";
import { checkCloneOSHistoryTableReadiness } from "./cloneos-history-health";
import { persistCloneOSHistoryItemSafely } from "./cloneos-history-storage";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CloneOSHistoryRuntimePersistOutcome =
  | "local_persisted"
  | "local_persisted_auth_required"
  | "local_persisted_validation_failed"
  | "local_persisted_server_unavailable"
  | "local_persisted_server_error"
  | "server_persisted"
  | "both_persisted";

export type CloneOSHistoryRuntimeResult = {
  ok: boolean;
  outcome: CloneOSHistoryRuntimePersistOutcome;
  command_id: string;
  local_saved: boolean;
  server_saved: boolean;
  error: string | null;
  note: string;
};

export type PersistCloneOSHistoryOptions = {
  supabase: SupabaseClient | null;
  userId: string | null;
  result: CloneOSCommandCenterResult;
  companyId?: string;
  rawRequest?: string;
};

// ── Runtime bridge principal ──────────────────────────────────────────────────

export async function persistCloneOSHistoryWithFallback(
  options: PersistCloneOSHistoryOptions
): Promise<CloneOSHistoryRuntimeResult> {
  const { supabase, userId, result, companyId, rawRequest } = options;
  const commandId = result.command_id;

  // ── Étape 1 : Mapper résultat → HistoryItem ───────────────────────────────
  const item = mapCloneOSResultToHistoryItem(result, {
    userId: userId ?? undefined,
    companyId: companyId ?? userId ?? "demo_company",
    rawRequest,
    source: "localstorage",
  });

  // ── Étape 2 : localStorage TOUJOURS (immuable, jamais ignoré) ──────────────
  let localSaved = false;
  try {
    appendCloneOSHistoryToLocalStorage(result);
    localSaved = true;
  } catch {
    // silent — ne bloque pas
  }

  // ── Étape 3 : Feature flag ─────────────────────────────────────────────────
  if (!isCloneOSHistoryServerPersistenceEnabled()) {
    return {
      ok: true,
      outcome: "local_persisted",
      command_id: commandId,
      local_saved: localSaved,
      server_saved: false,
      error: null,
      note: "Server persistence désactivée — fallback localStorage.",
    };
  }

  // ── Étape 4 : userId obligatoire ───────────────────────────────────────────
  if (!userId) {
    return {
      ok: true,
      outcome: "local_persisted_auth_required",
      command_id: commandId,
      local_saved: localSaved,
      server_saved: false,
      error: null,
      note: "Utilisateur non connecté — server persistence ignorée.",
    };
  }

  // ── Étape 5 : Validation item ──────────────────────────────────────────────
  const validation = validateCloneOSHistoryItem(item);
  if (!validation.valid) {
    return {
      ok: true,
      outcome: "local_persisted_validation_failed",
      command_id: commandId,
      local_saved: localSaved,
      server_saved: false,
      error: validation.issues.map((i) => i.message).join("; "),
      note: "Validation échouée — server persistence ignorée, localStorage OK.",
    };
  }

  // ── Étape 6 : Health check table (read-only) ───────────────────────────────
  if (!supabase) {
    return {
      ok: true,
      outcome: "local_persisted_server_unavailable",
      command_id: commandId,
      local_saved: localSaved,
      server_saved: false,
      error: null,
      note: "Client Supabase absent — server persistence ignorée.",
    };
  }

  const health = await checkCloneOSHistoryTableReadiness(supabase, userId);
  if (!health.can_attempt_write) {
    return {
      ok: true,
      outcome: "local_persisted_server_unavailable",
      command_id: commandId,
      local_saved: localSaved,
      server_saved: false,
      error: health.error_message,
      note: health.warning ?? "Table non disponible — localStorage OK.",
    };
  }

  // ── Étapes 8–9 : Tentative DB write ───────────────────────────────────────
  const itemWithSource = { ...item, source: "server" as const };
  const writeResult = await persistCloneOSHistoryItemSafely(
    supabase,
    userId,
    itemWithSource
  );

  if (!writeResult.ok) {
    return {
      ok: true, // localStorage reste OK
      outcome: "local_persisted_server_error",
      command_id: commandId,
      local_saved: localSaved,
      server_saved: false,
      error: writeResult.error,
      note: "Erreur DB — localStorage conservé, UI non impactée.",
    };
  }

  // ── Étape 10 : Succès ──────────────────────────────────────────────────────
  return {
    ok: true,
    outcome: writeResult.persisted ? "both_persisted" : "server_persisted",
    command_id: commandId,
    local_saved: localSaved,
    server_saved: writeResult.persisted,
    error: null,
    note: "Historique persisté en localStorage + serveur.",
  };
}
