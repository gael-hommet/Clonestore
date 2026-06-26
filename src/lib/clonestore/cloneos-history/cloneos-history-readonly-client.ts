// src/lib/clonestore/cloneos-history/cloneos-history-readonly-client.ts
// PHASE 3.2 — CloneOS History Server Persistence Design — Client lecture seule
//
// Lecture future de l'historique CloneOS depuis Supabase.
// PHASE 3.2 : design uniquement — la table n'est pas encore créée.
// PHASE 3.3 : activation après migration manuelle et validation RLS.
//
// INVARIANTS ABSOLUS :
//   - Aucune méthode insert() / update() / delete() / upsert()
//   - Clé anon uniquement (jamais la clé admin)
//   - Aucune écriture en DB
//   - Fallback silencieux si table absente (erreur 42P01 = table not found)
//   - Jamais de throw brut vers UI

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CloneOSHistoryItem,
  CloneOSHistoryReadResult,
} from "./cloneos-history-types";
import { CLONEOS_HISTORY_TABLE_NAME, CLONEOS_HISTORY_MAX_ITEMS } from "./cloneos-history-types";
import { loadCloneOSHistoryItemsFromLocalStorage } from "./cloneos-history-localstorage";

// ── Types internes ────────────────────────────────────────────────────────────

type DbRow = Record<string, unknown>;

// ── Mapping row DB → CloneOSHistoryItem ──────────────────────────────────────

export function mapCloneOSHistoryRowToItem(row: DbRow): CloneOSHistoryItem | null {
  const commandId = typeof row.command_id === "string" ? row.command_id : null;
  if (!commandId) return null;

  const now = new Date().toISOString();

  return {
    id: typeof row.id === "string" ? row.id : `server:${commandId}`,
    command_id: commandId,
    user_id: typeof row.user_id === "string" ? row.user_id : undefined,
    company_id: typeof row.company_id === "string" ? row.company_id : "unknown",
    raw_request_summary: typeof row.raw_request_summary === "string"
      ? row.raw_request_summary.slice(0, 280)
      : "Demande CloneOS",
    domain: typeof row.domain === "string"
      ? row.domain as CloneOSHistoryItem["domain"]
      : "unknown",
    intent: typeof row.intent === "string" ? row.intent : "unknown",
    status: typeof row.status === "string"
      ? row.status as CloneOSHistoryItem["status"]
      : "unknown",
    risk_level: typeof row.risk_level === "string"
      ? row.risk_level as CloneOSHistoryItem["risk_level"]
      : "low",
    employee_slug: typeof row.employee_slug === "string" ? row.employee_slug : undefined,
    employee_display_name: undefined,
    mission_title: typeof row.mission_title === "string" ? row.mission_title : undefined,
    mission_summary: typeof row.mission_summary === "string" ? row.mission_summary : undefined,
    task_count: typeof row.task_count === "number" ? row.task_count : 0,
    guard_decision: typeof row.guard_decision === "string" ? row.guard_decision : undefined,
    human_validation_required: row.human_validation_required === true,
    blocked: row.blocked === true,
    refused: row.refused === true,
    trace_event_count: typeof row.trace_event_count === "number" ? row.trace_event_count : 0,
    next_action: typeof row.next_action === "string" ? row.next_action : undefined,
    source: "server",
    created_at: typeof row.created_at === "string" ? row.created_at : now,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : now,
    read_only: true,
    metadata: (typeof row.metadata === "object" && row.metadata !== null)
      ? row.metadata as Record<string, unknown>
      : {},
  };
}

// ── Tri ───────────────────────────────────────────────────────────────────────

export function sortCloneOSHistoryItems(
  items: CloneOSHistoryItem[]
): CloneOSHistoryItem[] {
  return [...items].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ── Filtrage ──────────────────────────────────────────────────────────────────

export function filterCloneOSHistoryItems(
  items: CloneOSHistoryItem[],
  filter: {
    domain?: string;
    status?: string;
    risk_level?: string;
    blocked?: boolean;
    refused?: boolean;
    requires_validation?: boolean;
  }
): CloneOSHistoryItem[] {
  return items.filter((item) => {
    if (filter.domain && filter.domain !== "all" && item.domain !== filter.domain) return false;
    if (filter.status && filter.status !== "all" && item.status !== filter.status) return false;
    if (filter.risk_level && item.risk_level !== filter.risk_level) return false;
    if (filter.blocked !== undefined && item.blocked !== filter.blocked) return false;
    if (filter.refused !== undefined && item.refused !== filter.refused) return false;
    if (filter.requires_validation !== undefined &&
        item.human_validation_required !== filter.requires_validation) return false;
    return true;
  });
}

// ── Chargement read-only depuis Supabase ──────────────────────────────────────
// PHASE 3.3 : activé après migration.
// PHASE 3.2 : fallback localStorage uniquement.
//
// La fonction tente la lecture DB, si la table n'existe pas (erreur PGRST),
// retourne gracieusement le fallback localStorage.

export async function loadCloneOSHistoryReadOnly(
  supabase: SupabaseClient | null,
  userId: string | null,
  options: {
    fallbackToLocalStorage?: boolean;
    localUserId?: string;
    localCompanyId?: string;
  } = {}
): Promise<CloneOSHistoryReadResult> {
  const { fallbackToLocalStorage = true, localUserId, localCompanyId } = options;

  // Fallback localStorage si pas de client ou pas de userId
  if (!supabase || !userId) {
    if (fallbackToLocalStorage) {
      const lsItems = loadCloneOSHistoryItemsFromLocalStorage(localUserId, localCompanyId);
      return {
        items: sortCloneOSHistoryItems(lsItems),
        source: "localstorage",
        count: lsItems.length,
        error: null,
      };
    }
    return { items: [], source: "localstorage", count: 0, error: "auth_required" };
  }

  try {
    // PHASE 3.2 : tentative de lecture, table peut ne pas exister encore
    const { data, error } = await supabase
      .from(CLONEOS_HISTORY_TABLE_NAME)
      .select("id, command_id, user_id, company_id, raw_request_summary, domain, intent, status, risk_level, employee_slug, mission_title, mission_summary, task_count, guard_decision, human_validation_required, blocked, refused, trace_event_count, next_action, metadata, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(CLONEOS_HISTORY_MAX_ITEMS);

    if (error) {
      // Table non encore créée → fallback localStorage
      if (fallbackToLocalStorage) {
        const lsItems = loadCloneOSHistoryItemsFromLocalStorage(localUserId ?? userId, localCompanyId);
        return {
          items: sortCloneOSHistoryItems(lsItems),
          source: "localstorage",
          count: lsItems.length,
          error: `Table ${CLONEOS_HISTORY_TABLE_NAME} non disponible — fallback localStorage`,
        };
      }
      return {
        items: [],
        source: "server",
        count: 0,
        error: error.message,
      };
    }

    const items = Array.isArray(data)
      ? data
          .map((row) => mapCloneOSHistoryRowToItem(row as DbRow))
          .filter((item): item is CloneOSHistoryItem => item !== null)
      : [];

    // Si DB vide → ajouter items localStorage si demandé
    if (items.length === 0 && fallbackToLocalStorage) {
      const lsItems = loadCloneOSHistoryItemsFromLocalStorage(localUserId ?? userId, localCompanyId);
      if (lsItems.length > 0) {
        return {
          items: sortCloneOSHistoryItems(lsItems),
          source: "localstorage",
          count: lsItems.length,
          error: null,
        };
      }
    }

    return {
      items: sortCloneOSHistoryItems(items),
      source: "server",
      count: items.length,
      error: null,
    };
  } catch (err) {
    if (fallbackToLocalStorage) {
      const lsItems = loadCloneOSHistoryItemsFromLocalStorage(localUserId ?? (userId ?? undefined), localCompanyId);
      return {
        items: sortCloneOSHistoryItems(lsItems),
        source: "localstorage",
        count: lsItems.length,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      };
    }
    return {
      items: [],
      source: "server",
      count: 0,
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}
