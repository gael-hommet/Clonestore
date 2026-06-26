// src/lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-runtime.ts
// PHASE 3.14 — Enterprise Footprint Safe Apply — Runtime localStorage-first
//
// Flux persist obligatoire :
//   1. saveEnterpriseFootprintToLocalStorage TOUJOURS en premier
//   2. si flag false → local_saved_server_disabled
//   3. si pas auth → local_saved_auth_required
//   4. validate/sanitize → si KO → local_saved_validation_failed
//   5. health check table/RLS → si KO → local_saved_table_unavailable / rls_failed
//   6. persistEnterpriseFootprintServerSafely → si fail → local_saved_server_failed
//   7. si succès → local_saved_server_synced
//
// INVARIANTS :
//   - localStorage FIRST invariant — local_saved toujours true
//   - aucun write si flag false / auth KO / health KO
//   - compatible table absente (error 42P01)
//   - pas de service role
//   - pas d'import Pierre
//   - jamais de throw brut

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnterpriseFootprint } from "./enterprise-footprint-types";
import type {
  EnterpriseFootprintSafeApplyOptions,
  EnterpriseFootprintSafeRestoreOptions,
  EnterpriseFootprintSafeApplyResult,
  EnterpriseFootprintSafeRestoreResult,
  EnterpriseFootprintSafeApplyConfirmation,
} from "./enterprise-footprint-safe-apply-types";
import { saveEnterpriseFootprintToLocalStorage } from "./enterprise-footprint-localstorage";
import { loadEnterpriseFootprintFromLocalStorage } from "./enterprise-footprint-localstorage";
import { isEnterpriseFootprintServerPersistenceEnabled } from "./enterprise-footprint-server-flags";
import { validateEnterpriseFootprintServerPayload } from "./enterprise-footprint-server-validation";
import {
  mapEnterpriseFootprintToServerPayload,
  mapEnterpriseFootprintServerRowToFootprint,
  mergeEnterpriseFootprintLocalAndServer,
} from "./enterprise-footprint-server-mappers";
// health check avant write — ordre intentionnel
import { checkEnterpriseFootprintServerTableReadiness } from "./enterprise-footprint-server-health";
import {
  loadLatestEnterpriseFootprintServerReadOnly,
} from "./enterprise-footprint-server-readonly-client";
import { persistEnterpriseFootprintServerSafely } from "./enterprise-footprint-server-storage";

// ── Helper : vérifier si Supabase est disponible ──────────────────────────────

function isSupabaseAvailable(supabase: unknown): supabase is SupabaseClient {
  return (
    supabase !== null &&
    typeof supabase === "object" &&
    "from" in (supabase as object)
  );
}

// ── Vérifier si sync serveur est possible ─────────────────────────────────────

export function shouldAttemptEnterpriseFootprintServerSync(): boolean {
  return isEnterpriseFootprintServerPersistenceEnabled();
}

// ── Persist avec fallback localStorage-first ─────────────────────────────────
// localStorage est sauvegardé TOUJOURS en premier, puis serveur best-effort.

export async function persistEnterpriseFootprintWithFallback(
  options: EnterpriseFootprintSafeApplyOptions
): Promise<EnterpriseFootprintSafeApplyResult> {
  const footprint = options.footprint as EnterpriseFootprint | null;

  // Étape 1 — localStorage TOUJOURS en premier (invariant absolu)
  let localSaved = false;
  try {
    if (footprint) {
      saveEnterpriseFootprintToLocalStorage(footprint);
      localSaved = true;
    }
  } catch {
    /* Silent fail localStorage */
  }

  // Étape 2 — Guard feature flag
  if (!isEnterpriseFootprintServerPersistenceEnabled()) {
    return buildSafeApplyResult("local_saved_server_disabled", localSaved, false, false);
  }

  // Étape 3 — Guard auth
  if (!options.userId?.trim() || !isSupabaseAvailable(options.supabase)) {
    return buildSafeApplyResult("local_saved_auth_required", localSaved, false, false);
  }

  if (!footprint) {
    return buildSafeApplyResult("local_saved_validation_failed", localSaved, false, false,
      "FOOTPRINT_MISSING", "Aucune empreinte à persister.");
  }

  // Étape 4 — Validate payload
  const payload = mapEnterpriseFootprintToServerPayload(footprint, options.userId);
  const validation = validateEnterpriseFootprintServerPayload(payload);
  if (!validation.valid) {
    return buildSafeApplyResult("local_saved_validation_failed", localSaved, false, false,
      "VALIDATION_FAILED", validation.issues.join("; "));
  }

  // Étape 5 — Health check table/RLS (read-only)
  let health;
  try {
    health = await checkEnterpriseFootprintServerTableReadiness(
      options.supabase as SupabaseClient,
      options.userId
    );
  } catch {
    return buildSafeApplyResult("local_saved_server_failed", localSaved, true, false,
      "HEALTH_CHECK_ERROR", "Erreur health check inattendue.");
  }

  if (!health.table_available) {
    return buildSafeApplyResult("local_saved_table_unavailable", localSaved, true, false,
      "TABLE_UNAVAILABLE", "Table clonestore_enterprise_footprints absente. Appliquer SQL PHASE_3_13.");
  }

  if (!health.rls_select_ok) {
    return buildSafeApplyResult("local_saved_rls_failed", localSaved, true, false,
      "RLS_FAILED", "RLS non accessible. Vérifier policies select/insert/update.");
  }

  // Étape 6 — Persist serveur (best-effort)
  let writeResult;
  try {
    writeResult = await persistEnterpriseFootprintServerSafely(
      options.supabase as SupabaseClient,
      options.userId,
      footprint
    );
  } catch {
    return buildSafeApplyResult("local_saved_server_failed", localSaved, true, false,
      "WRITE_ERROR", "Erreur inattendue write serveur.");
  }

  if (!writeResult.ok) {
    return buildSafeApplyResult("local_saved_server_failed", localSaved, true, false,
      writeResult.error_code ?? "WRITE_FAILED",
      writeResult.error_message ?? "Échec persistence serveur."
    );
  }

  // Étape 7 — Succès
  return buildSafeApplyResult("local_saved_server_synced", localSaved, true, true);
}

// ── Restore avec fallback ─────────────────────────────────────────────────────
// localStorage immédiat → serveur (si flag) → choisit le plus récent.

export async function restoreEnterpriseFootprintWithFallback(
  options: EnterpriseFootprintSafeRestoreOptions
): Promise<EnterpriseFootprintSafeRestoreResult> {
  // Charger localStorage immédiatement
  let localFootprint: EnterpriseFootprint | null = null;
  try {
    const raw = loadEnterpriseFootprintFromLocalStorage();
    if (raw && typeof raw === "object" && "company_id" in raw) {
      localFootprint = raw as EnterpriseFootprint;
    }
  } catch {
    /* Silent fail */
  }

  // Guard feature flag
  if (!isEnterpriseFootprintServerPersistenceEnabled()) {
    return buildRestoreResult(
      localFootprint ? "local_restored" : "server_disabled",
      localFootprint,
      localFootprint !== null, false, false
    );
  }

  // Guard auth
  if (!options.userId?.trim() || !isSupabaseAvailable(options.supabase)) {
    return buildRestoreResult(
      localFootprint ? "local_restored" : "auth_required",
      localFootprint,
      localFootprint !== null, false, false
    );
  }

  // Health check
  let health;
  try {
    health = await checkEnterpriseFootprintServerTableReadiness(
      options.supabase as SupabaseClient,
      options.userId
    );
  } catch {
    return buildRestoreResult(
      localFootprint ? "local_restored" : "server_disabled",
      localFootprint,
      localFootprint !== null, true, false
    );
  }

  if (!health.table_available) {
    return buildRestoreResult(
      localFootprint ? "local_restored" : "table_unavailable",
      localFootprint,
      localFootprint !== null, true, false
    );
  }

  if (!health.rls_select_ok) {
    return buildRestoreResult(
      localFootprint ? "local_restored" : "rls_failed",
      localFootprint,
      localFootprint !== null, true, false
    );
  }

  // Charger depuis le serveur
  let serverReadResult;
  try {
    serverReadResult = await loadLatestEnterpriseFootprintServerReadOnly(
      options.supabase as SupabaseClient,
      options.userId
    );
  } catch {
    return buildRestoreResult(
      localFootprint ? "local_restored" : "server_disabled",
      localFootprint,
      localFootprint !== null, true, false
    );
  }

  if (!serverReadResult.ok || !serverReadResult.latest) {
    return buildRestoreResult(
      localFootprint ? "local_restored" : "empty_state",
      localFootprint,
      localFootprint !== null, true, false
    );
  }

  // Comparer local et server → choisir le plus récent
  const serverRow = serverReadResult.latest;
  const serverFootprint = mapEnterpriseFootprintServerRowToFootprint(serverRow);
  const winner = mergeEnterpriseFootprintLocalAndServer(localFootprint, serverRow);

  const localDate = localFootprint?.updated_at ? new Date(localFootprint.updated_at).getTime() : 0;
  const serverDate = serverRow.updated_at ? new Date(serverRow.updated_at).getTime() : 0;

  if (serverDate > localDate) {
    // Serveur plus récent → sauvegarder en localStorage
    try {
      if (winner) saveEnterpriseFootprintToLocalStorage(winner);
    } catch { /* Silent fail */ }

    return buildRestoreResult(
      "server_restored",
      winner ?? serverFootprint,
      localFootprint !== null, true, true
    );
  }

  return buildRestoreResult(
    "local_newer_than_server",
    localFootprint,
    localFootprint !== null, true, true
  );
}

// ── Builders ──────────────────────────────────────────────────────────────────

function buildSafeApplyResult(
  status: EnterpriseFootprintSafeApplyResult["outcome"]["status"],
  localSaved: boolean,
  serverAttempted: boolean,
  serverSynced: boolean,
  errorCode: string | null = null,
  errorMessage: string | null = null
): EnterpriseFootprintSafeApplyResult {
  const uiLabels: Record<string, { status: EnterpriseFootprintSafeApplyResult["ui_status"]; label: string; detail: string | null }> = {
    local_saved:                  { status: "local_saved",       label: "Empreinte sauvegardée localement", detail: null },
    local_saved_server_disabled:  { status: "server_disabled",   label: "Persistence serveur désactivée", detail: "Snapshot local uniquement." },
    local_saved_auth_required:    { status: "auth_required",     label: "Empreinte sauvegardée localement", detail: "Auth non disponible — fallback local." },
    local_saved_validation_failed:{ status: "validation_failed", label: "Empreinte sauvegardée localement", detail: errorMessage },
    local_saved_table_unavailable:{ status: "server_unavailable",label: "Serveur indisponible — fallback local", detail: "Table SQL absente. Appliquer SQL PHASE_3_13." },
    local_saved_rls_failed:       { status: "server_unavailable",label: "Serveur indisponible — fallback local", detail: "RLS à vérifier." },
    local_saved_server_failed:    { status: "server_failed",     label: "Serveur indisponible — fallback local", detail: errorMessage },
    local_saved_server_synced:    { status: "server_synced",     label: "Empreinte synchronisée serveur", detail: null },
  };

  const ui = uiLabels[status] ?? { status: "local_saved" as const, label: "Empreinte sauvegardée localement", detail: null };

  return {
    outcome: {
      status,
      local_saved: localSaved,
      server_attempted: serverAttempted,
      server_synced: serverSynced,
      error_code: errorCode,
      error_message: errorMessage,
    },
    ui_status: ui.status,
    ui_label: ui.label,
    ui_detail: ui.detail,
  };
}

function buildRestoreResult(
  status: EnterpriseFootprintSafeRestoreResult["outcome"]["status"],
  footprint: EnterpriseFootprint | null,
  localAvailable: boolean,
  serverChecked: boolean,
  serverRowFound: boolean
): EnterpriseFootprintSafeRestoreResult {
  const uiLabels: Record<string, { status: EnterpriseFootprintSafeRestoreResult["ui_status"]; label: string }> = {
    local_restored:         { status: "restored_from_local", label: "Empreinte chargée depuis le local" },
    server_disabled:        { status: "server_disabled",     label: "Lecture serveur désactivée" },
    auth_required:          { status: "auth_required",       label: "Auth non disponible — local utilisé" },
    table_unavailable:      { status: "server_unavailable",  label: "Table SQL absente — local utilisé" },
    rls_failed:             { status: "server_unavailable",  label: "RLS KO — local utilisé" },
    server_restored:        { status: "restored_from_server",label: "Lecture serveur restaurée" },
    local_newer_than_server:{ status: "restored_from_local", label: "Local plus récent — conservé" },
    empty_state:            { status: "empty_state",         label: "Aucune empreinte disponible" },
  };

  const ui = uiLabels[status] ?? { status: "restored_from_local" as const, label: "Empreinte locale chargée" };

  return {
    outcome: {
      status,
      source: footprint ? (status === "server_restored" ? "server" : "local") : "none",
      local_available: localAvailable,
      server_checked: serverChecked,
      server_row_found: serverRowFound,
    },
    footprint,
    ui_status: ui.status,
    ui_label: ui.label,
  };
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintSafeApplyUiStatus(
  result: EnterpriseFootprintSafeApplyResult
): EnterpriseFootprintSafeApplyResult["ui_status"] {
  return result.ui_status;
}

export function buildEnterpriseFootprintSafeApplyConfirmation(
  result: EnterpriseFootprintSafeApplyResult
): EnterpriseFootprintSafeApplyConfirmation {
  const isSynced = result.outcome.server_synced;
  const isDisabled = result.outcome.status === "local_saved_server_disabled";
  const isUnavailable = result.outcome.status === "local_saved_table_unavailable" ||
    result.outcome.status === "local_saved_rls_failed" ||
    result.outcome.status === "local_saved_server_failed";

  if (isSynced) {
    return {
      visible: true,
      message: "Empreinte synchronisée serveur",
      sub_message: "Sauvegardée localement et sur le serveur.",
      tone: "success",
      auto_dismiss_ms: 4000,
    };
  }

  if (isDisabled) {
    return {
      visible: true,
      message: "Persistence serveur désactivée",
      sub_message: "Snapshot local uniquement.",
      tone: "info",
      auto_dismiss_ms: 3000,
    };
  }

  if (isUnavailable) {
    return {
      visible: true,
      message: "Serveur indisponible — fallback local",
      sub_message: result.ui_detail ?? "Empreinte sauvegardée localement.",
      tone: "warning",
      auto_dismiss_ms: 5000,
    };
  }

  return {
    visible: true,
    message: "Empreinte sauvegardée localement",
    sub_message: "Persistence serveur non activée.",
    tone: "neutral",
    auto_dismiss_ms: 3000,
  };
}

export function explainEnterpriseFootprintSafeApplyResult(
  result: EnterpriseFootprintSafeApplyResult
): string {
  const lines = [
    `[PHASE 3.14 Safe Apply] Status: ${result.outcome.status}`,
    `  local_saved: ${result.outcome.local_saved}`,
    `  server_attempted: ${result.outcome.server_attempted}`,
    `  server_synced: ${result.outcome.server_synced}`,
  ];
  if (result.outcome.error_message) {
    lines.push(`  error: ${result.outcome.error_message}`);
  }
  return lines.join("\n");
}
