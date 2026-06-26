// src/lib/clonestore/runtime-integration/runtime-mission-draft-safe-apply.ts
// PHASE 4.5 — Runtime Mission Draft — Safe Apply Runtime (localStorage-first)
//
// localStorage TOUJOURS en premier. Serveur best-effort feature-flaggé.
// Aucune exécution. Aucune mission réelle. Aucun moteur Pierre. Aucun appel IA.
// Appel serveur UNIQUEMENT via runtime-mission-draft-api-client. Pas de fetch direct.
// Pas de Supabase direct. Pas d'auto-persist à l'import.

import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";
import { validateRuntimeMissionDraft } from "./runtime-mission-draft-validation";
import {
  saveRuntimeMissionDraftToLocalStorage,
  loadLatestRuntimeMissionDraftFromLocalStorage,
} from "./runtime-mission-draft-localstorage";
import { isRuntimeMissionDraftServerPersistenceEnabled } from "./runtime-mission-draft-persistence-flags";
import { postRuntimeMissionDraftServerSave } from "./runtime-mission-draft-api-client";
import type {
  RuntimeMissionDraftSafeApplyResult,
  RuntimeMissionDraftSafeApplyRestoreResult,
  RuntimeMissionDraftSafeApplyStatus,
  RuntimeMissionDraftSafeApplyServerResult,
  RuntimeMissionDraftSafeApplyRecommendation,
  RuntimeMissionDraftSafeApplyAction,
  RuntimeMissionDraftSafeApplyIssue,
} from "./runtime-mission-draft-safe-apply-types";

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftSafeApplyOptions = {
  attempt_server?: boolean;
  force_local_only?: boolean;
  company_id?: string;
  user_id?: string;
  now?: string;
};

export type RuntimeMissionDraftSafeApplyRestoreOptions = {
  force_local_only?: boolean;
  now?: string;
};

// ── Base result (invariants) ──────────────────────────────────────────────────

function buildBaseResult(
  status: RuntimeMissionDraftSafeApplyStatus,
  now: string
): RuntimeMissionDraftSafeApplyResult {
  return {
    ok: status !== "local_failed" && status !== "validation_failed",
    status,
    local_saved: false,
    server_attempted: false,
    server_synced: false,
    db_write_performed: false,
    mission_created: false,
    execution_started: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
    issues: [],
    recommendations: [],
    actions: [],
    attempted_at: now,
  };
}

// ── Persist (localStorage-first) ──────────────────────────────────────────────

export async function persistRuntimeMissionDraftWithFallback(
  draft: RuntimeMissionDraft,
  options?: RuntimeMissionDraftSafeApplyOptions
): Promise<RuntimeMissionDraftSafeApplyResult> {
  const now = options?.now ?? new Date().toISOString();

  // 1. Validation
  const validation = validateRuntimeMissionDraft(draft);
  if (!validation.valid) {
    const result = buildBaseResult("validation_failed", now);
    result.draft = draft;
    result.issues = validation.issues.map((i) => ({ code: i.code, message: i.message, severity: i.severity }));
    result.recommendations = buildRuntimeMissionDraftSafeApplyRecommendations(result);
    result.actions = buildRuntimeMissionDraftSafeApplyActions(result);
    return result;
  }

  // 2. localStorage TOUJOURS en premier
  const flagEnabled = isRuntimeMissionDraftServerPersistenceEnabled();
  const serverSyncStatusHint = flagEnabled ? "not_attempted" : "disabled";
  const localSave = saveRuntimeMissionDraftToLocalStorage(draft, { now, server_sync_status: serverSyncStatusHint });

  if (!localSave.ok) {
    const result = buildBaseResult("local_failed", now);
    result.draft = draft;
    result.issues = localSave.issues.map((m) => ({ code: "local_save_failed", message: m, severity: "blocking" as const }));
    result.recommendations = buildRuntimeMissionDraftSafeApplyRecommendations(result);
    result.actions = buildRuntimeMissionDraftSafeApplyActions(result);
    return result;
  }

  // 3. Décider de la tentative serveur
  const wantServer = options?.attempt_server !== false && options?.force_local_only !== true;

  if (!wantServer || !flagEnabled) {
    const result = buildBaseResult("local_saved_server_disabled", now);
    result.local_saved = true;
    result.draft = draft;
    result.envelope = localSave.envelope ?? undefined;
    result.recommendations = buildRuntimeMissionDraftSafeApplyRecommendations(result);
    result.actions = buildRuntimeMissionDraftSafeApplyActions(result);
    return result;
  }

  // 4. Tentative serveur best-effort (via API client uniquement)
  let serverResult: RuntimeMissionDraftSafeApplyServerResult;
  let status: RuntimeMissionDraftSafeApplyStatus;
  try {
    const { response, http_status } = await postRuntimeMissionDraftServerSave(draft, options?.company_id);
    if (http_status === 423 || response.status === "disabled") {
      status = "local_saved_server_disabled";
      serverResult = { ok: false, status: "disabled", http_status, db_write_performed: false };
    } else if (response.ok && response.db_write_performed) {
      status = "local_saved_server_synced";
      serverResult = { ok: true, status: "ok", http_status, db_write_performed: true };
    } else {
      status = "local_saved_server_failed";
      serverResult = {
        ok: false,
        status: response.status,
        http_status,
        db_write_performed: false,
        error_message: response.error?.message,
      };
    }
  } catch {
    status = "local_saved_server_failed";
    serverResult = { ok: false, status: "error", http_status: 0, db_write_performed: false, error_message: "Appel serveur échoué." };
  }

  const result = buildBaseResult(status, now);
  result.local_saved = true;
  result.server_attempted = true;
  result.server_synced = serverResult.db_write_performed;
  result.db_write_performed = serverResult.db_write_performed;
  result.draft = draft;
  result.envelope = localSave.envelope ?? undefined;
  result.server_result = serverResult;
  result.recommendations = buildRuntimeMissionDraftSafeApplyRecommendations(result);
  result.actions = buildRuntimeMissionDraftSafeApplyActions(result);
  return result;
}

// ── Restore (localStorage-first) ──────────────────────────────────────────────

export async function restoreRuntimeMissionDraftWithFallback(
  options?: RuntimeMissionDraftSafeApplyRestoreOptions
): Promise<RuntimeMissionDraftSafeApplyRestoreResult> {
  const now = options?.now ?? new Date().toISOString();
  const localEnvelope = loadLatestRuntimeMissionDraftFromLocalStorage();

  // Flag off ou force local → restore local
  const flagEnabled = isRuntimeMissionDraftServerPersistenceEnabled();
  if (options?.force_local_only === true || !flagEnabled) {
    return {
      ok: localEnvelope !== null,
      status: localEnvelope ? "restored_local" : "restored_none",
      source: localEnvelope ? "localstorage" : "none",
      draft: localEnvelope?.payload ?? null,
      envelope: localEnvelope,
      execution_started: false,
      attempted_at: now,
    };
  }

  // Flag on : en P4.5, on conserve le restore local (lecture serveur affinée en P4.6).
  // Fallback local toujours garanti.
  return {
    ok: localEnvelope !== null,
    status: localEnvelope ? "restored_local" : "restored_none",
    source: localEnvelope ? "localstorage" : "none",
    draft: localEnvelope?.payload ?? null,
    envelope: localEnvelope,
    execution_started: false,
    attempted_at: now,
  };
}

// ── Recommendations / actions ─────────────────────────────────────────────────

export function buildRuntimeMissionDraftSafeApplyRecommendations(
  result: RuntimeMissionDraftSafeApplyResult
): RuntimeMissionDraftSafeApplyRecommendation[] {
  const recs: RuntimeMissionDraftSafeApplyRecommendation[] = [];
  if (result.status === "validation_failed") {
    recs.push({ id: "rec-validation", text: "Brouillon non conforme — relancer une simulation.", href: "/profile/messages", action_label: "Messages" });
  }
  if (result.status === "local_saved_server_disabled") {
    recs.push({ id: "rec-server-disabled", text: "Serveur optionnel désactivé (flag false) — brouillon conservé localement.", href: "/profile/messages", action_label: "Messages" });
  }
  if (result.status === "local_saved_server_failed") {
    recs.push({ id: "rec-server-failed", text: "Sync serveur échouée — le brouillon reste sauvegardé localement.", href: "/profile/messages", action_label: "Messages" });
  }
  recs.push({ id: "rec-local-first", text: "La sauvegarde concerne uniquement le brouillon, pas une mission réelle.", href: "/profile/agents", action_label: "Mon espace" });
  return recs;
}

export function buildRuntimeMissionDraftSafeApplyActions(
  result: RuntimeMissionDraftSafeApplyResult
): RuntimeMissionDraftSafeApplyAction[] {
  void result;
  return [
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: true },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: false },
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
  ];
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeMissionDraftSafeApplyResult(
  result: RuntimeMissionDraftSafeApplyResult
): string {
  const lines: string[] = [
    `[Safe Apply] status=${result.status}`,
    `  local_saved : ${result.local_saved} · server_attempted : ${result.server_attempted} · server_synced : ${result.server_synced}`,
    `  db_write_performed : ${result.db_write_performed} · mission_created : ${result.mission_created} · execution_started : ${result.execution_started}`,
    `  Brouillon uniquement — aucune mission réelle. Aucun appel Pierre. Scale 80k non prouvé.`,
  ];
  const issues: RuntimeMissionDraftSafeApplyIssue[] = result.issues;
  if (issues.length > 0) lines.push(`  Issues : ${issues.map((i) => i.code).join(", ")}`);
  return lines.join("\n");
}
