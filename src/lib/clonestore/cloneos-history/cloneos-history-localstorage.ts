// src/lib/clonestore/cloneos-history/cloneos-history-localstorage.ts
// PHASE 3.2 — CloneOS History Server Persistence Design — LocalStorage Abstraction
//
// Centralise la logique localStorage de l'historique CloneOS.
// Permet de retirer progressivement la logique inline de /profile/agents/page.tsx.
// Compatible server-safe : typeof window checks partout.
//
// Invariants :
//   - try/catch sur tous les accès localStorage
//   - max CLONEOS_HISTORY_MAX_ITEMS items
//   - jamais de throw brut vers l'UI

import type { CloneOSCommandCenterResult } from "@/lib/clonestore/cloneos";
import type { CloneOSHistoryItem } from "./cloneos-history-types";
import { CLONEOS_HISTORY_MAX_ITEMS } from "./cloneos-history-types";

// ── Constante clé (unique source de vérité) ───────────────────────────────────
// Doit rester identique à la valeur PHASE 2.4 pour compatibilité ascendante.

export const CLONEOS_HISTORY_LOCALSTORAGE_KEY =
  "clonestore.cloneos.commandHistory.v1" as const;

// ── Chargement ────────────────────────────────────────────────────────────────

export function loadCloneOSHistoryFromLocalStorage(): CloneOSCommandCenterResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLONEOS_HISTORY_LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CloneOSCommandCenterResult[];
  } catch {
    return [];
  }
}

// ── Sauvegarde complète ───────────────────────────────────────────────────────

export function saveCloneOSHistoryToLocalStorage(
  items: CloneOSCommandCenterResult[]
): void {
  if (typeof window === "undefined") return;
  try {
    const capped = items.slice(0, CLONEOS_HISTORY_MAX_ITEMS);
    window.localStorage.setItem(
      CLONEOS_HISTORY_LOCALSTORAGE_KEY,
      JSON.stringify(capped)
    );
  } catch {
    /* quota ou mode privé — silent fail */
  }
}

// ── Ajout d'un item ───────────────────────────────────────────────────────────

export function appendCloneOSHistoryToLocalStorage(
  item: CloneOSCommandCenterResult
): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadCloneOSHistoryFromLocalStorage();
    // Dédoublonnage par command_id
    const deduped = existing.filter((r) => r.command_id !== item.command_id);
    const updated = [item, ...deduped].slice(0, CLONEOS_HISTORY_MAX_ITEMS);
    saveCloneOSHistoryToLocalStorage(updated);
  } catch {
    /* silent fail */
  }
}

// ── Effacement ────────────────────────────────────────────────────────────────

export function clearCloneOSHistoryLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLONEOS_HISTORY_LOCALSTORAGE_KEY);
  } catch {
    /* silent fail */
  }
}

// ── Migration legacy payload ──────────────────────────────────────────────────
// Si l'ancien format localStorage diffère du nouveau, migrer proprement.

export function migrateLegacyCloneOSHistoryPayload(
  payload: unknown
): CloneOSCommandCenterResult[] {
  if (!Array.isArray(payload)) return [];
  // Filtrer les entrées avec command_id valide
  return payload.filter(
    (item): item is CloneOSCommandCenterResult =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).command_id === "string"
  );
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function normalizeCloneOSHistoryPayload(
  payload: unknown
): CloneOSCommandCenterResult[] {
  if (!payload) return [];
  if (!Array.isArray(payload)) return migrateLegacyCloneOSHistoryPayload(payload);
  return migrateLegacyCloneOSHistoryPayload(payload);
}

// ── Conversion localStorage → CloneOSHistoryItem[] ───────────────────────────
// Utilisé pour préparer des items UI depuis localStorage.

export function loadCloneOSHistoryItemsFromLocalStorage(
  userId?: string,
  companyId?: string
): CloneOSHistoryItem[] {
  const raw = loadCloneOSHistoryFromLocalStorage();
  if (raw.length === 0) return [];

  // Import dynamique pour éviter dépendance circulaire
  // Utiliser la version synchrone du mapper depuis mappers.ts
  return raw
    .map((result) => {
      const now = new Date().toISOString();
      const classified = result.classified_command;
      return {
        id: `local:${result.command_id}`,
        command_id: result.command_id,
        user_id: userId,
        company_id: companyId ?? "demo_company",
        raw_request_summary: (classified?.summary ?? "Demande CloneOS").slice(0, 280),
        domain: (classified?.domain ?? "unknown") as CloneOSHistoryItem["domain"],
        intent: classified?.intent ?? "unknown",
        status: result.status as CloneOSHistoryItem["status"],
        risk_level: (classified?.risk_level ?? "low") as CloneOSHistoryItem["risk_level"],
        employee_slug: result.selected_route?.is_available
          ? result.selected_route.employee_slug
          : undefined,
        employee_display_name: result.selected_route?.is_available
          ? result.selected_route.employee_display_name
          : undefined,
        mission_title: result.mission_plan?.title?.slice(0, 120),
        mission_summary: result.mission_plan
          ? `${result.mission_plan.tasks?.length ?? 0} tâche(s) — plan-only, non exécuté`
          : undefined,
        task_count: result.mission_plan?.tasks?.length ?? 0,
        guard_decision: result.guard_result?.overall_decision ?? undefined,
        human_validation_required:
          result.guard_result?.has_validation_required_tasks ?? false,
        blocked:
          result.status === "blocked" ||
          (result.guard_result?.has_blocked_tasks ?? false),
        refused:
          result.status === "refused" ||
          (result.guard_result?.has_refused_tasks ?? false),
        trace_event_count: result.trace_result?.event_count ?? 0,
        next_action: result.next_action?.slice(0, 200),
        source: "localstorage" as const,
        created_at: result.generated_at ?? now,
        updated_at: now,
        read_only: true as const,
        metadata: {
          plan_only: true,
          ok: result.ok,
        },
      } satisfies CloneOSHistoryItem;
    })
    .filter((item) => Boolean(item.command_id));
}
