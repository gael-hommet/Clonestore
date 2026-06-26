// src/lib/clonestore/onboarding/global-onboarding-storage.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Safe Storage Design
//
// Design du write safe pour la persistence serveur.
// PHASE 3.5 : NON activé depuis l'UI.
// PHASE 3.6 : activation après migration manuelle + validation RLS.
//
// INVARIANTS ABSOLUS :
//   - Feature flag gate obligatoire avant tout write DB
//   - Validation avant chaque write
//   - Aucun service role côté client
//   - Aucun write automatique depuis /profile/onboarding en PHASE 3.5
//   - localStorage toujours écrit en premier (fallback actif)
//   - Tous les writes sont best-effort (jamais throw brut)

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GlobalOnboardingDraft,
  GlobalOnboardingPersistablePayload,
  GlobalOnboardingWriteResult,
} from "./global-onboarding-types";
import { GLOBAL_ONBOARDING_TABLE_NAME } from "./global-onboarding-types";
import { isGlobalOnboardingServerPersistenceEnabled } from "./global-onboarding-flags";
import { validateGlobalOnboardingPersistablePayload } from "./global-onboarding-validation";
import { sanitizeGlobalOnboardingDraft } from "./global-onboarding-validation";
import { redactGlobalOnboardingMetadata } from "./global-onboarding-mappers";
import { saveGlobalOnboardingDraftToLocalStorage } from "./global-onboarding-localstorage";

// ── Build payload persistable ─────────────────────────────────────────────────
// Construit un payload sanitisé prêt pour la DB.
// user_id devient obligatoire ici (absent en localStorage).

export function buildGlobalOnboardingPersistablePayload(
  draft: GlobalOnboardingDraft,
  userId: string
): GlobalOnboardingPersistablePayload {
  const sanitized = sanitizeGlobalOnboardingDraft(draft);
  return {
    user_id: userId,
    company_id: sanitized.company_id,
    status: sanitized.status,
    current_step: sanitized.current_step,
    completion_score: Math.max(0, Math.min(100, sanitized.completion_score)),
    step_statuses: sanitized.step_statuses,
    company: sanitized.company,
    humans: sanitized.humans,
    documents: sanitized.documents,
    rules: sanitized.rules,
    technologies: sanitized.technologies,
    first_mission: sanitized.first_mission,
    created_at: sanitized.created_at,
    updated_at: new Date().toISOString(),
    metadata: redactGlobalOnboardingMetadata(sanitized.metadata),
  };
}

// ── Gate de persistence ───────────────────────────────────────────────────────
// Feature flag gate — la seule source de vérité pour activer les writes DB.
// Par défaut false — ne jamais hardcoder true.

export function canPersistGlobalOnboarding(): boolean {
  return isGlobalOnboardingServerPersistenceEnabled();
}

// ── Safe persist ──────────────────────────────────────────────────────────────
// PHASE 3.5 : design non activé depuis l'UI — feature flag = false par défaut.
// PHASE 3.6 : activation après migration manuelle + validation RLS complète.
//
// Flux :
//   1. Toujours localStorage en premier.
//   2. Si flag false → retour immédiat, source "localstorage".
//   3. Si flag true + supabase + userId → validation + write best-effort.
//   4. Si write DB échoue → ok=true, persisted=false, source="localstorage".
//
// NE PAS appeler cette fonction depuis /profile/onboarding en PHASE 3.5.
// Elle est conçue pour PHASE 3.6 et testée en design uniquement ici.

export async function persistGlobalOnboardingDraftSafely(
  supabase: SupabaseClient | null,
  userId: string | null,
  draft: GlobalOnboardingDraft
): Promise<GlobalOnboardingWriteResult> {
  const localDraftId = draft.id;

  // 1. localStorage toujours en premier (fallback actif)
  saveGlobalOnboardingDraftToLocalStorage(draft);

  // 2. Feature flag gate — obligatoire
  if (!canPersistGlobalOnboarding()) {
    return {
      ok: true,
      draft_id: localDraftId,
      persisted: false,
      source: "localstorage",
      error: null,
    };
  }

  // 3. Vérification client et userId
  if (!supabase || !userId || !userId.trim()) {
    return {
      ok: true,
      draft_id: localDraftId,
      persisted: false,
      source: "localstorage",
      error: "Client Supabase ou userId manquant — localStorage uniquement.",
    };
  }

  // 4. Build payload
  const payload = buildGlobalOnboardingPersistablePayload(draft, userId);

  // 5. Validation avant write — jamais écrire un payload invalide
  const report = validateGlobalOnboardingPersistablePayload(payload);
  if (!report.valid) {
    const errorMessages = report.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.message)
      .join("; ");
    return {
      ok: false,
      draft_id: localDraftId,
      persisted: false,
      source: "localstorage",
      error: `Validation échouée — ${errorMessages}`,
    };
  }

  // 6. Write best-effort — colonne DB = jsonb columns séparées
  try {
    const dbPayload = {
      user_id: payload.user_id,
      company_id: payload.company_id,
      status: payload.status,
      current_step: payload.current_step,
      completion_score: payload.completion_score,
      company_json: payload.company,
      humans_json: payload.humans,
      documents_json: payload.documents,
      rules_json: payload.rules,
      technologies_json: payload.technologies,
      first_mission_json: payload.first_mission ?? {},
      cloneadn_preview_json: {},   // aperçu non persisté côté serveur
      metadata: payload.metadata,
      updated_at: payload.updated_at,
    };

    // upsert sur (user_id, company_id) — pas de delete, pas de service role
    const { data, error } = await supabase
      .from(GLOBAL_ONBOARDING_TABLE_NAME)
      .upsert(dbPayload, {
        onConflict: "user_id,company_id",
        ignoreDuplicates: false,
      })
      .select("id")
      .single();

    if (error) {
      // Write DB échoué — best-effort, localStorage est OK
      return {
        ok: true,
        draft_id: localDraftId,
        persisted: false,
        source: "localstorage",
        error: `Write DB échoué (best-effort) : ${error.message}`,
      };
    }

    const serverId = typeof data?.id === "string" ? data.id : localDraftId;
    return {
      ok: true,
      draft_id: serverId,
      persisted: true,
      source: "server",
      error: null,
    };
  } catch (err) {
    // Exception inattendue — best-effort, ne pas remonter à l'UI
    return {
      ok: true,
      draft_id: localDraftId,
      persisted: false,
      source: "localstorage",
      error: err instanceof Error ? err.message : "Erreur inconnue write DB",
    };
  }
}
