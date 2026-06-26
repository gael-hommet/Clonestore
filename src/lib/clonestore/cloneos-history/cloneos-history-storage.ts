// src/lib/clonestore/cloneos-history/cloneos-history-storage.ts
// PHASE 3.2 — CloneOS History Server Persistence Design — Storage (Write Design)
//
// Fonctions d'écriture safe pour l'historique CloneOS.
//
// IMPORTANT — PHASE 3.3 :
//   - L'écriture est branchée dans /profile/agents (best-effort, non bloquant).
//   - Activation via env var NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED
//   - Jamais de true hardcodé — dérivé de l'env uniquement.
//   - Fallback localStorage toujours actif si flag absent ou DB unavailable.
//
// Activation manuelle :
//   1. Appliquer supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql manuellement.
//   2. Valider RLS en environnement de test.
//   3. Définir env var dans .env.local (voir PHASE_3_3_CLONEOS_HISTORY_SAFE_APPLY.md).
//   4. Relancer build et tests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CloneOSHistoryItem,
  CloneOSHistoryPersistablePayload,
  CloneOSHistoryWriteResult,
} from "./cloneos-history-types";
import { CLONEOS_HISTORY_TABLE_NAME } from "./cloneos-history-types";
import {
  validateCloneOSHistoryPersistablePayload,
} from "./cloneos-history-validation";
import { redactCloneOSHistoryMetadata } from "./cloneos-history-mappers";

// ── Flag de garde ─────────────────────────────────────────────────────────────
// Dérivé de l'env var (PHASE 3.3).
// Default : false. Activation : NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true
// Jamais de true hardcodé ici.
import { isCloneOSHistoryServerPersistenceEnabled } from "./cloneos-history-flags";

export const CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED: boolean =
  isCloneOSHistoryServerPersistenceEnabled();

// ── Construction du payload persistable ──────────────────────────────────────

export function buildCloneOSHistoryPersistablePayload(
  item: CloneOSHistoryItem,
  userId: string
): CloneOSHistoryPersistablePayload {
  return {
    user_id: userId,
    company_id: item.company_id,
    command_id: item.command_id,
    employee_slug: item.employee_slug,
    domain: item.domain,
    intent: item.intent,
    status: item.status,
    risk_level: item.risk_level,
    raw_request_summary: item.raw_request_summary.slice(0, 500),
    mission_title: item.mission_title?.slice(0, 255),
    mission_summary: item.mission_summary?.slice(0, 500),
    task_count: item.task_count,
    guard_decision: item.guard_decision,
    human_validation_required: item.human_validation_required,
    blocked: item.blocked,
    refused: item.refused,
    trace_event_count: item.trace_event_count,
    next_action: item.next_action?.slice(0, 500),
    metadata: redactCloneOSHistoryMetadata(item.metadata),
    created_at: item.created_at,
    updated_at: new Date().toISOString(),
  };
}

// ── Vérification d'activation ─────────────────────────────────────────────────

export function canPersistCloneOSHistory(): boolean {
  // Activation via env var uniquement — jamais hardcodé
  return isCloneOSHistoryServerPersistenceEnabled();
}

// ── Persistence safe d'un item ───────────────────────────────────────────────
// NON appelée depuis l'UI en PHASE 3.2.
// Activation prévue en PHASE 3.3.

export async function persistCloneOSHistoryItemSafely(
  supabase: SupabaseClient,
  userId: string,
  item: CloneOSHistoryItem
): Promise<CloneOSHistoryWriteResult> {
  // Guard : persistence non activée
  if (!canPersistCloneOSHistory()) {
    return {
      ok: false,
      command_id: item.command_id,
      persisted: false,
      source: "localstorage",
      error: "Server persistence non activée (PHASE 3.2 — activation prévue en PHASE 3.3)",
    };
  }

  // Validation obligatoire avant écriture
  const payload = buildCloneOSHistoryPersistablePayload(item, userId);
  const validation = validateCloneOSHistoryPersistablePayload(payload);
  if (!validation.valid) {
    return {
      ok: false,
      command_id: item.command_id,
      persisted: false,
      source: "localstorage",
      error: `Validation échouée : ${validation.issues.map((i) => i.message).join("; ")}`,
    };
  }

  try {
    // Insert avec gestion de conflit (unique user_id + command_id)
    const { error } = await supabase
      .from(CLONEOS_HISTORY_TABLE_NAME)
      .insert(payload);

    if (error) {
      // Conflit command_id existant → ignorer silencieusement
      if (error.code === "23505") {
        return {
          ok: true,
          command_id: item.command_id,
          persisted: false,
          source: "server",
          error: null, // déjà persisté
        };
      }
      return {
        ok: false,
        command_id: item.command_id,
        persisted: false,
        source: "localstorage",
        error: error.message,
      };
    }

    return {
      ok: true,
      command_id: item.command_id,
      persisted: true,
      source: "server",
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      command_id: item.command_id,
      persisted: false,
      source: "localstorage",
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}

// ── Persistence en lot ────────────────────────────────────────────────────────
// Migre des items localStorage vers le serveur une fois la table créée.
// NON appelée depuis l'UI en PHASE 3.2.

export async function persistCloneOSHistoryBatchSafely(
  supabase: SupabaseClient,
  userId: string,
  items: CloneOSHistoryItem[]
): Promise<{ ok: boolean; persisted_count: number; error_count: number }> {
  if (!canPersistCloneOSHistory()) {
    return { ok: false, persisted_count: 0, error_count: 0 };
  }

  let persisted = 0;
  let errors = 0;

  for (const item of items) {
    const result = await persistCloneOSHistoryItemSafely(supabase, userId, item);
    if (result.persisted) persisted++;
    if (!result.ok) errors++;
  }

  return { ok: errors === 0, persisted_count: persisted, error_count: errors };
}
