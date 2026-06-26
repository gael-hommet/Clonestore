// src/lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-types.ts
// PHASE 3.14 — Enterprise Footprint Safe Apply — Types
//
// INVARIANTS :
//   - localStorage toujours prioritaire
//   - DB write best-effort uniquement
//   - jamais de write si flag false / auth KO / health KO
//   - pas d'import Pierre
//   - pas de service role

// ── Modes ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintSafeApplyMode =
  | "localstorage_only"      // flag false → local seulement
  | "server_best_effort"     // flag true, tentative serveur
  | "restore_from_server"    // tentative restore serveur
  | "health_check_only";     // lecture seule health

// ── Statuts UI ────────────────────────────────────────────────────────────────

export type EnterpriseFootprintSafeApplyUiStatus =
  | "idle"
  | "saving"
  | "restoring"
  | "local_saved"
  | "server_synced"
  | "server_disabled"
  | "server_unavailable"
  | "server_failed"
  | "auth_required"
  | "validation_failed"
  | "restored_from_local"
  | "restored_from_server"
  | "empty_state";

// ── Outcomes persist ──────────────────────────────────────────────────────────

export type EnterpriseFootprintSafeApplyStatus =
  | "local_saved"                  // localStorage sauvegardé (succès minimal garanti)
  | "local_saved_server_disabled"  // localStorage OK, serveur désactivé par flag
  | "local_saved_auth_required"    // localStorage OK, pas d'userId/supabase
  | "local_saved_validation_failed"// localStorage OK, validation payload KO
  | "local_saved_table_unavailable"// localStorage OK, table SQL manquante
  | "local_saved_rls_failed"       // localStorage OK, RLS KO
  | "local_saved_server_failed"    // localStorage OK, write serveur KO
  | "local_saved_server_synced";   // localStorage OK + write serveur réussi

export type EnterpriseFootprintSafeApplyOutcome = {
  status: EnterpriseFootprintSafeApplyStatus;
  local_saved: boolean;
  server_attempted: boolean;
  server_synced: boolean;
  error_code: string | null;
  error_message: string | null;
};

// ── Outcomes restore ──────────────────────────────────────────────────────────

export type EnterpriseFootprintSafeRestoreStatus =
  | "local_restored"           // localStorage disponible, utilisé
  | "server_disabled"          // flag false → local seulement
  | "auth_required"            // pas d'auth → local seulement
  | "table_unavailable"        // table SQL absente → local seulement
  | "rls_failed"               // RLS KO → local seulement
  | "server_restored"          // version serveur plus récente → utilisée
  | "local_newer_than_server"  // local plus récent → gardé
  | "empty_state";             // rien disponible

export type EnterpriseFootprintSafeRestoreOutcome = {
  status: EnterpriseFootprintSafeRestoreStatus;
  source: "local" | "server" | "none";
  local_available: boolean;
  server_checked: boolean;
  server_row_found: boolean;
};

// ── Options ───────────────────────────────────────────────────────────────────

export type EnterpriseFootprintSafeApplyOptions = {
  supabase: unknown | null;    // SupabaseClient | null
  userId: string | null;
  footprint: unknown;          // EnterpriseFootprint
};

export type EnterpriseFootprintSafeRestoreOptions = {
  supabase: unknown | null;
  userId: string | null;
};

// ── Résultats ─────────────────────────────────────────────────────────────────

export type EnterpriseFootprintSafeApplyResult = {
  outcome: EnterpriseFootprintSafeApplyOutcome;
  ui_status: EnterpriseFootprintSafeApplyUiStatus;
  ui_label: string;
  ui_detail: string | null;
};

export type EnterpriseFootprintSafeRestoreResult = {
  outcome: EnterpriseFootprintSafeRestoreOutcome;
  footprint: unknown | null;   // EnterpriseFootprint | null
  ui_status: EnterpriseFootprintSafeApplyUiStatus;
  ui_label: string;
};

// ── Confirmation UI ───────────────────────────────────────────────────────────

export type EnterpriseFootprintSafeApplyConfirmation = {
  visible: boolean;
  message: string;
  sub_message: string;
  tone: "success" | "warning" | "info" | "neutral";
  auto_dismiss_ms: number;
};
