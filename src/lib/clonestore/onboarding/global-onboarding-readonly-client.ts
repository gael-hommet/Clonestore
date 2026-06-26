// src/lib/clonestore/onboarding/global-onboarding-readonly-client.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Client lecture seule
//
// Lecture future du draft onboarding depuis Supabase.
// PHASE 3.5 : design uniquement — table non encore créée.
// PHASE 3.6 : activation après migration manuelle + validation RLS.
//
// INVARIANTS ABSOLUS :
//   - Aucune méthode insert() / update() / delete() / upsert()
//   - Clé anon uniquement (jamais la clé admin)
//   - Aucune écriture en DB
//   - Fallback localStorage si table absente
//   - Jamais de throw brut vers UI

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GlobalOnboardingDraft,
  GlobalOnboardingReadResult,
} from "./global-onboarding-types";
import { GLOBAL_ONBOARDING_TABLE_NAME } from "./global-onboarding-types";
import { loadGlobalOnboardingDraftFromLocalStorage } from "./global-onboarding-localstorage";
import { normalizeGlobalOnboardingPayload } from "./global-onboarding-localstorage";

// ── Types internes ────────────────────────────────────────────────────────────

type DbRow = Record<string, unknown>;

// ── Mapping row DB → GlobalOnboardingDraft ────────────────────────────────────

export function mapGlobalOnboardingRowToDraft(row: DbRow): GlobalOnboardingDraft | null {
  const companyId = typeof row.company_id === "string" ? row.company_id : null;
  const userId = typeof row.user_id === "string" ? row.user_id : null;
  if (!companyId) return null;

  const now = new Date().toISOString();

  return {
    id: typeof row.id === "string" ? row.id : `server:${companyId}`,
    user_id: userId ?? undefined,
    company_id: companyId,
    status: (typeof row.status === "string" ? row.status : "server_draft") as GlobalOnboardingDraft["status"],
    current_step: (typeof row.current_step === "string"
      ? row.current_step
      : "company_identity") as GlobalOnboardingDraft["current_step"],
    completion_score: typeof row.completion_score === "number" ? row.completion_score : 0,
    step_statuses: (typeof row.step_statuses === "object" && row.step_statuses
      ? row.step_statuses as GlobalOnboardingDraft["step_statuses"]
      : {
          company_identity: "pending",
          team_humans: "pending",
          documents: "pending",
          rules_validations: "pending",
          technologies: "pending",
          first_pierre_mission: "pending",
        }),
    company: (typeof row.company_json === "object" && row.company_json
      ? row.company_json as GlobalOnboardingDraft["company"]
      : { company_name: "", industry: "", size_range: "", country: "FR", language: "fr", timezone: "Europe/Paris", description: "" }),
    humans: Array.isArray(row.humans_json) ? row.humans_json as GlobalOnboardingDraft["humans"] : [],
    documents: Array.isArray(row.documents_json) ? row.documents_json as GlobalOnboardingDraft["documents"] : [],
    rules: Array.isArray(row.rules_json) ? row.rules_json as GlobalOnboardingDraft["rules"] : [],
    technologies: Array.isArray(row.technologies_json) ? row.technologies_json as GlobalOnboardingDraft["technologies"] : [],
    first_mission: (typeof row.first_mission_json === "object" && row.first_mission_json !== null &&
      "employee_slug" in (row.first_mission_json as object)
      ? row.first_mission_json as GlobalOnboardingDraft["first_mission"]
      : null),
    cloneadn_preview: typeof row.cloneadn_preview_json === "object" && row.cloneadn_preview_json
      ? row.cloneadn_preview_json as Record<string, unknown>
      : {},
    created_at: typeof row.created_at === "string" ? row.created_at : now,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : now,
    source: "server",
    read_only: false,
    metadata: typeof row.metadata === "object" && row.metadata
      ? row.metadata as Record<string, unknown>
      : {},
  };
}

// ── Tri ───────────────────────────────────────────────────────────────────────

export function sortGlobalOnboardingDrafts(
  drafts: GlobalOnboardingDraft[]
): GlobalOnboardingDraft[] {
  return [...drafts].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

// ── Chargement read-only ──────────────────────────────────────────────────────
// PHASE 3.6 : activé après migration.
// PHASE 3.5 : fallback localStorage.

export async function loadGlobalOnboardingDraftReadOnly(
  supabase: SupabaseClient | null,
  userId: string | null,
  companyId?: string
): Promise<GlobalOnboardingReadResult> {
  // Fallback localStorage si pas de client ou userId
  if (!supabase || !userId) {
    const lsRaw = loadGlobalOnboardingDraftFromLocalStorage();
    const lsDraft = lsRaw ? normalizeGlobalOnboardingPayload(lsRaw) : null;
    return {
      draft: lsDraft,
      source: lsDraft ? "localstorage" : "empty",
      error: null,
    };
  }

  try {
    // Tentative lecture DB
    let query = supabase
      .from(GLOBAL_ONBOARDING_TABLE_NAME)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (companyId) {
      query = query.eq("company_id", companyId) as typeof query;
    }

    const { data, error } = await query;

    if (error) {
      // Table absente → fallback localStorage
      const lsRaw = loadGlobalOnboardingDraftFromLocalStorage();
      const lsDraft = lsRaw ? normalizeGlobalOnboardingPayload(lsRaw) : null;
      return {
        draft: lsDraft,
        source: lsDraft ? "localstorage" : "empty",
        error: `Table ${GLOBAL_ONBOARDING_TABLE_NAME} non disponible — fallback localStorage`,
      };
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      // DB vide → fallback localStorage
      const lsRaw = loadGlobalOnboardingDraftFromLocalStorage();
      const lsDraft = lsRaw ? normalizeGlobalOnboardingPayload(lsRaw) : null;
      return {
        draft: lsDraft,
        source: lsDraft ? "localstorage" : "empty",
        error: null,
      };
    }

    const draft = mapGlobalOnboardingRowToDraft(rows[0] as DbRow);
    return {
      draft,
      source: draft ? "server" : "empty",
      error: null,
    };
  } catch (err) {
    const lsRaw = loadGlobalOnboardingDraftFromLocalStorage();
    const lsDraft = lsRaw ? normalizeGlobalOnboardingPayload(lsRaw) : null;
    return {
      draft: lsDraft,
      source: lsDraft ? "localstorage" : "empty",
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}
