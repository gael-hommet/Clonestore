// src/lib/clonestore/enterprise-footprint/enterprise-footprint-storage.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — Safe Storage Design
//
// Design uniquement pour PHASE 3.8.
// NE PAS appeler depuis l'UI — feature flag obligatoire + table non encore créée.
//
// Note PHASE 3.8 : la persistence de l'Empreinte Entreprise réutilise
// le mécanisme de persistence du GlobalOnboardingDraft (PHASE 3.5–3.7).
// Pas de table SQL dédiée à créer en PHASE 3.8.
// La table `clonestore_enterprise_footprints` est différée à PHASE 3.9+.
//
// INVARIANTS :
//   - feature flag obligatoire avant tout write DB
//   - validation/sanitize avant write
//   - aucun service role
//   - localStorage toujours sauvegardé en premier

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EnterpriseFootprint,
  EnterpriseFootprintPersistablePayload,
  EnterpriseFootprintWriteResult,
} from "./enterprise-footprint-types";
import { ENTERPRISE_FOOTPRINT_TABLE_NAME } from "./enterprise-footprint-types";
import { isEnterpriseFootprintServerPersistenceEnabled } from "./enterprise-footprint-flags";
import { validateEnterpriseFootprintPersistablePayload } from "./enterprise-footprint-validation";
import { sanitizeEnterpriseFootprint } from "./enterprise-footprint-validation";
import { redactEnterpriseFootprintMetadata } from "./enterprise-footprint-mappers";
import { saveEnterpriseFootprintToLocalStorage } from "./enterprise-footprint-localstorage";

// ── Build payload persistable ─────────────────────────────────────────────────

export function buildEnterpriseFootprintPersistablePayload(
  footprint: EnterpriseFootprint,
  userId: string
): EnterpriseFootprintPersistablePayload {
  const sanitized = sanitizeEnterpriseFootprint(footprint);
  return {
    user_id: userId,
    company_id: sanitized.company_id,
    status: sanitized.status,
    source: sanitized.source,
    company: sanitized.company,
    humans: sanitized.humans,
    approval_rules: sanitized.approval_rules,
    documents: sanitized.documents,
    technologies: sanitized.technologies,
    coverage_score: Math.max(0, Math.min(100, sanitized.coverage_score)),
    readiness_score: sanitized.readiness_score,
    missing_items: sanitized.missing_items,
    warnings: sanitized.warnings,
    created_at: sanitized.created_at,
    updated_at: new Date().toISOString(),
    metadata: redactEnterpriseFootprintMetadata(sanitized.metadata),
  };
}

// ── Gate de persistence ───────────────────────────────────────────────────────

export function canPersistEnterpriseFootprint(): boolean {
  return isEnterpriseFootprintServerPersistenceEnabled();
}

// ── Safe persist (design uniquement PHASE 3.8) ───────────────────────────────
// Flux :
//   1. localStorage toujours en premier
//   2. Feature flag gate
//   3. Validation
//   4. Write DB best-effort (nécessite table SQL — PHASE 3.9+)
//
// NE PAS appeler depuis UI en PHASE 3.8 — table non créée.

export async function persistEnterpriseFootprintSafely(
  supabase: SupabaseClient | null,
  userId: string | null,
  footprint: EnterpriseFootprint
): Promise<EnterpriseFootprintWriteResult> {
  const localFootprintId = footprint.id;

  // 1. localStorage toujours en premier
  saveEnterpriseFootprintToLocalStorage(footprint);

  // 2. Feature flag gate
  if (!canPersistEnterpriseFootprint()) {
    return {
      ok: true,
      footprint_id: localFootprintId,
      persisted: false,
      source: "localstorage",
      error: null,
    };
  }

  if (!supabase || !userId || !userId.trim()) {
    return {
      ok: true,
      footprint_id: localFootprintId,
      persisted: false,
      source: "localstorage",
      error: "Client Supabase ou userId manquant — localStorage uniquement.",
    };
  }

  // 3. Build + validation payload
  const payload = buildEnterpriseFootprintPersistablePayload(footprint, userId);
  const report = validateEnterpriseFootprintPersistablePayload(payload);
  if (!report.valid) {
    const errorMessages = report.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.message)
      .join("; ");
    return {
      ok: false,
      footprint_id: localFootprintId,
      persisted: false,
      source: "localstorage",
      error: `Validation échouée — ${errorMessages}`,
    };
  }

  // 4. Write best-effort (table non créée en PHASE 3.8 — PHASE 3.9+)
  try {
    const { data, error } = await supabase
      .from(ENTERPRISE_FOOTPRINT_TABLE_NAME)
      .upsert(
        {
          user_id: payload.user_id,
          company_id: payload.company_id,
          status: payload.status,
          source: payload.source,
          company_json: payload.company,
          humans_json: payload.humans,
          approval_rules_json: payload.approval_rules,
          documents_json: payload.documents,
          technologies_json: payload.technologies,
          coverage_score: payload.coverage_score,
          readiness_score_json: payload.readiness_score,
          missing_items: payload.missing_items,
          warnings: payload.warnings,
          metadata: payload.metadata,
          updated_at: payload.updated_at,
        },
        { onConflict: "user_id,company_id" }
      )
      .select("id")
      .single();

    if (error) {
      return {
        ok: true,
        footprint_id: localFootprintId,
        persisted: false,
        source: "localstorage",
        error: `Write DB échoué (best-effort) : ${error.message}`,
      };
    }

    const serverId = typeof data?.id === "string" ? data.id : localFootprintId;
    return {
      ok: true,
      footprint_id: serverId,
      persisted: true,
      source: "server",
      error: null,
    };
  } catch (err) {
    return {
      ok: true,
      footprint_id: localFootprintId,
      persisted: false,
      source: "localstorage",
      error: err instanceof Error ? err.message : "Erreur inconnue write DB",
    };
  }
}
