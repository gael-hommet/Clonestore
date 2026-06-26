// src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-storage.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Safe Storage Design
//
// DESIGN UNIQUEMENT en PHASE 3.13.
// NE PAS appeler depuis les pages UI existantes.
// Feature flag obligatoire avant tout write.
//
// Activation en PHASE 3.14 (Enterprise Footprint Safe Apply) après :
//   1. SQL PHASE_3_13 appliqué manuellement
//   2. RLS validée en env test
//   3. Health check select passe
//   4. NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true
//
// INVARIANTS :
//   - feature flag obligatoire avant write
//   - validation/sanitize avant write
//   - aucun service role
//   - localStorage toujours sauvegardé en premier
//   - jamais de throw brut
//   - localStorage = fallback permanent
//   - NE PAS importer depuis /profile/onboarding, /profile/agents,
//     /agents/pierre/setup, /agents/pierre/use en PHASE 3.13

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnterpriseFootprint } from "./enterprise-footprint-types";
import type {
  EnterpriseFootprintServerPayload,
  EnterpriseFootprintServerWriteResult,
} from "./enterprise-footprint-server-types";
import { ENTERPRISE_FOOTPRINT_SERVER_TABLE } from "./enterprise-footprint-server-schema";
import { isEnterpriseFootprintServerPersistenceEnabled } from "./enterprise-footprint-server-flags";
import {
  mapEnterpriseFootprintToServerPayload,
  mapEnterpriseFootprintToServerRowInsert,
} from "./enterprise-footprint-server-mappers";
import {
  validateEnterpriseFootprintServerPayload,
  sanitizeEnterpriseFootprintServerPayload,
  assertEnterpriseFootprintServerNoSensitiveLeak,
} from "./enterprise-footprint-server-validation";

// ── Build payload persistable ─────────────────────────────────────────────────

export function buildEnterpriseFootprintServerPersistablePayload(
  footprint: EnterpriseFootprint,
  userId: string
): EnterpriseFootprintServerPayload {
  return mapEnterpriseFootprintToServerPayload(footprint, userId);
}

// ── Can persist? ──────────────────────────────────────────────────────────────

export function canPersistEnterpriseFootprintServer(): boolean {
  return isEnterpriseFootprintServerPersistenceEnabled();
}

// ── Upsert safe (design-only) ─────────────────────────────────────────────────
// Jamais appelé depuis UI en PHASE 3.13.
// feature-flagged + validation obligatoire.

export async function upsertEnterpriseFootprintServerDraftSafely(
  supabase: SupabaseClient,
  payload: EnterpriseFootprintServerPayload
): Promise<EnterpriseFootprintServerWriteResult> {
  // Guard feature flag
  if (!isEnterpriseFootprintServerPersistenceEnabled()) {
    return {
      ok: false,
      row_id: null,
      server_version: null,
      error_code: "FEATURE_DISABLED",
      error_message: "Persistence serveur désactivée. Activer NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true après SQL + RLS validés.",
      skipped: true,
      skip_reason: "feature_flag_disabled",
    };
  }

  // Sanitize
  const sanitized = sanitizeEnterpriseFootprintServerPayload(payload);

  // Validate
  const validation = validateEnterpriseFootprintServerPayload(sanitized);
  if (!validation.valid) {
    return {
      ok: false,
      row_id: null,
      server_version: null,
      error_code: "VALIDATION_FAILED",
      error_message: validation.issues.join("; "),
      skipped: true,
      skip_reason: "validation_failed",
    };
  }

  // Leak check
  const leakCheck = assertEnterpriseFootprintServerNoSensitiveLeak(sanitized);
  if (!leakCheck.safe) {
    return {
      ok: false,
      row_id: null,
      server_version: null,
      error_code: "SENSITIVE_LEAK",
      error_message: leakCheck.issues.join("; "),
      skipped: true,
      skip_reason: "sensitive_data_detected",
    };
  }

  // Build row
  const rowInsert = mapEnterpriseFootprintToServerRowInsert(sanitized);

  try {
    const { data, error } = await supabase
      .from(ENTERPRISE_FOOTPRINT_SERVER_TABLE)
      .upsert(
        { ...rowInsert, server_version: 1 },
        { onConflict: "user_id,company_id" }
      )
      .select("id, server_version")
      .single();

    if (error) {
      return {
        ok: false,
        row_id: null,
        server_version: null,
        error_code: error.code ?? "UPSERT_ERROR",
        error_message: error.message ?? "Erreur persistence serveur.",
        skipped: false,
        skip_reason: null,
      };
    }

    const row = data as { id: string; server_version: number } | null;
    return {
      ok: true,
      row_id: row?.id ?? null,
      server_version: row?.server_version ?? 1,
      error_code: null,
      error_message: null,
      skipped: false,
      skip_reason: null,
    };
  } catch {
    return {
      ok: false,
      row_id: null,
      server_version: null,
      error_code: "UNEXPECTED_ERROR",
      error_message: "Erreur inattendue persistence serveur.",
      skipped: false,
      skip_reason: null,
    };
  }
}

// ── Persist safely (best-effort) ──────────────────────────────────────────────
// Wraps upsert. localStorage reste fallback permanent.
// Design-only en PHASE 3.13 — ne pas appeler depuis UI.

export async function persistEnterpriseFootprintServerSafely(
  supabase: SupabaseClient,
  userId: string,
  footprint: EnterpriseFootprint
): Promise<EnterpriseFootprintServerWriteResult> {
  const payload = buildEnterpriseFootprintServerPersistablePayload(footprint, userId);
  return upsertEnterpriseFootprintServerDraftSafely(supabase, payload);
}
