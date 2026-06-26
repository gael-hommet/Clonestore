// src/lib/clonestore/messages/message-center-readonly-client.ts
// PHASE 3.1 — Messages Real Data Read-Only Hook — Client lecture seule
// PHASE 3.4 — Brancher CloneOS History dans /profile/messages (lecture seule)
//
// Charge les données Pierre + CloneOS History depuis Supabase en lecture seule.
//
// INVARIANTS ABSOLUS :
//   - Aucune méthode insert() / update() / delete() / upsert()
//   - Clé anon uniquement (jamais la clé admin)
//   - Aucune écriture en DB
//   - Aucune exécution d'action
//   - Toujours filtrer user_id via RLS et filtre explicite
//   - pierre_* tables : agent_slug = "pierre" est implicite (nommage de table)
//   - Limiter les résultats : MESSAGE_CENTER_MAX_ITEMS_PER_TABLE items max par table
//   - Fallback silencieux si table vide ou erreur RLS
//   - CloneOS History : chargement best-effort, jamais bloquant

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MessageCenterItem,
  MessageCenterReadOnlyResult,
} from "./message-center-types";

import { MESSAGE_CENTER_MAX_ITEMS_PER_TABLE } from "./message-center-types";

import {
  mapPierreMissionToMessageItem,
  mapPierreTaskToMessageItem,
  mapPierreDocumentToMessageItem,
  mapPierreOutboundEmailToMessageItem,
} from "./message-center-mappers";

import { buildFallbackMessageCenterResult } from "./message-center-demo-data";

// ── PHASE 3.4 — Bridge CloneOS History ───────────────────────────────────────
// Read-only. Aucune écriture. Aucun appel à persistCloneOSHistoryWithFallback.
import {
  loadCloneOSHistoryMessageItemsReadOnly,
  mergePierreAndCloneOSMessageItems,
} from "./message-center-cloneos-history-bridge";

// ── Types internes ────────────────────────────────────────────────────────────

type DbRow = Record<string, unknown>;

// Note : pierre_missions, pierre_tasks, pierre_documents, pierre_outbound_emails
// sont des tables Pierre-spécifiques. L'agent_slug = "pierre" est implicite dans
// leur nommage. Pas de filtre agent_slug sur ces tables (colonnes non présentes).
// Pour agent_runs (non utilisé ici), le filtre agent_slug = "pierre" serait requis.
const PIERRE_AGENT_SLUG = "pierre"; // documenté pour reference agent_slug

// ── Chargement depuis pierre_missions ─────────────────────────────────────────

async function loadPierreMissions(
  supabase: SupabaseClient,
  userId: string
): Promise<MessageCenterItem[]> {
  try {
    const { data, error } = await supabase
      .from("pierre_missions")
      .select("id, title, request_text, summary, status, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MESSAGE_CENTER_MAX_ITEMS_PER_TABLE);

    if (error || !Array.isArray(data)) return [];

    return data
      .map((row) => mapPierreMissionToMessageItem(row as DbRow))
      .filter((item): item is MessageCenterItem => item !== null);
  } catch {
    return [];
  }
}

// ── Chargement depuis pierre_tasks ────────────────────────────────────────────

async function loadPierreTasks(
  supabase: SupabaseClient,
  userId: string
): Promise<MessageCenterItem[]> {
  try {
    const { data, error } = await supabase
      .from("pierre_tasks")
      .select("id, mission_id, title, type, status, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MESSAGE_CENTER_MAX_ITEMS_PER_TABLE);

    if (error || !Array.isArray(data)) return [];

    return data
      .map((row) => mapPierreTaskToMessageItem(row as DbRow))
      .filter((item): item is MessageCenterItem => item !== null);
  } catch {
    return [];
  }
}

// ── Chargement depuis pierre_documents ────────────────────────────────────────

async function loadPierreDocuments(
  supabase: SupabaseClient,
  userId: string
): Promise<MessageCenterItem[]> {
  try {
    const { data, error } = await supabase
      .from("pierre_documents")
      .select("id, mission_id, task_id, title, type, status, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MESSAGE_CENTER_MAX_ITEMS_PER_TABLE);

    if (error || !Array.isArray(data)) return [];

    return data
      .map((row) => mapPierreDocumentToMessageItem(row as DbRow))
      .filter((item): item is MessageCenterItem => item !== null);
  } catch {
    return [];
  }
}

// ── Chargement depuis pierre_outbound_emails ──────────────────────────────────

async function loadPierreOutboundEmails(
  supabase: SupabaseClient,
  userId: string
): Promise<MessageCenterItem[]> {
  try {
    const { data, error } = await supabase
      .from("pierre_outbound_emails")
      .select("id, mission_id, task_id, subject, status, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MESSAGE_CENTER_MAX_ITEMS_PER_TABLE);

    if (error || !Array.isArray(data)) return [];

    return data
      .map((row) => mapPierreOutboundEmailToMessageItem(row as DbRow))
      .filter((item): item is MessageCenterItem => item !== null);
  } catch {
    return [];
  }
}

// ── Chargement principal ──────────────────────────────────────────────────────
// Charge toutes les tables Pierre en parallèle.
// Respecte RLS via le client anon avec session utilisateur.
// JAMAIS : insert, update, delete, upsert.

export async function loadPierreMessageCenterRows(
  supabase: SupabaseClient,
  userId: string
): Promise<MessageCenterItem[]> {
  // _ référence agent_slug = PIERRE_AGENT_SLUG pour documentation
  void PIERRE_AGENT_SLUG; // pierre_* tables scope le filtrage implicitement

  const [missions, tasks, documents, emails] = await Promise.all([
    loadPierreMissions(supabase, userId),
    loadPierreTasks(supabase, userId),
    loadPierreDocuments(supabase, userId),
    loadPierreOutboundEmails(supabase, userId),
  ]);

  return [...missions, ...tasks, ...documents, ...emails];
}

// ── Tri ───────────────────────────────────────────────────────────────────────

export function sortMessageCenterItems(
  items: MessageCenterItem[]
): MessageCenterItem[] {
  return [...items].sort((a, b) => {
    // Priorité urgente d'abord
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const pA = priorityOrder[a.priority] ?? 2;
    const pB = priorityOrder[b.priority] ?? 2;
    if (pA !== pB) return pA - pB;
    // Puis par date décroissante
    return (
      new Date(b.updated_at ?? b.created_at).getTime() -
      new Date(a.updated_at ?? a.created_at).getTime()
    );
  });
}

// ── Groupement par onglet ────────────────────────────────────────────────────

export function groupMessageCenterItemsByTab(
  items: MessageCenterItem[]
): Record<"suivis" | "briefings" | "livraisons" | "alertes", MessageCenterItem[]> {
  return {
    suivis: items.filter((i) => i.tab === "suivis"),
    briefings: items.filter((i) => i.tab === "briefings"),
    livraisons: items.filter((i) => i.tab === "livraisons"),
    alertes: items.filter((i) => i.tab === "alertes"),
  };
}

// ── Filtrage ──────────────────────────────────────────────────────────────────

export function filterMessageCenterItems(
  items: MessageCenterItem[],
  filters: { tab?: string; query?: string }
): MessageCenterItem[] {
  let result = items;

  if (filters.tab && filters.tab !== "all") {
    result = result.filter((i) => i.tab === filters.tab);
  }

  if (filters.query) {
    const q = filters.query.toLowerCase();
    result = result.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  return result;
}

// ── Fusion réel + fallback ────────────────────────────────────────────────────

export function mergeRealAndFallbackMessages(
  realItems: MessageCenterItem[],
  fallbackItems: MessageCenterItem[]
): MessageCenterItem[] {
  // Si données réelles disponibles, les utiliser seules
  if (realItems.length > 0) {
    return sortMessageCenterItems(realItems);
  }
  // Sinon, utiliser les données de démo
  return fallbackItems;
}

// ── Point d'entrée principal ──────────────────────────────────────────────────
// PHASE 3.4 : charge Pierre + CloneOS History en read-only et fusionne.
// Utilise uniquement la clé anon avec session utilisateur (RLS actif).
// N'écrit rien en DB.
// CloneOS History : best-effort, silencieux si table absente.

export async function loadMessageCenterReadOnlyItems(
  supabase: SupabaseClient | null,
  userId: string | null
): Promise<MessageCenterReadOnlyResult> {
  // Pas de client Supabase → fallback démo
  if (!supabase) {
    return buildFallbackMessageCenterResult("demo");
  }

  // Pas de userId → auth_required
  if (!userId) {
    return buildFallbackMessageCenterResult("auth_required");
  }

  try {
    // ── Étape 1 : Charger données Pierre (tables pierre_*) ────────────────────
    const pierreItems = await loadPierreMessageCenterRows(supabase, userId);

    // ── Étape 2 : Charger CloneOS History (read-only, best-effort) ────────────
    // Silencieux si table absente (PHASE 3.2 SQL non encore appliqué).
    // Jamais bloquant pour Pierre. Jamais d'écriture.
    let cloneOSItems: MessageCenterItem[] = [];
    try {
      cloneOSItems = await loadCloneOSHistoryMessageItemsReadOnly(supabase, userId);
    } catch {
      // silent — CloneOS History non disponible, Pierre reste OK
    }

    // ── Étape 3 : Fusionner Pierre + CloneOS History ──────────────────────────
    const mergedItems = mergePierreAndCloneOSMessageItems(pierreItems, cloneOSItems);
    const sorted = sortMessageCenterItems(mergedItems);

    if (sorted.length === 0) {
      // Tout vide → fallback démo
      const fallback = buildFallbackMessageCenterResult("demo");
      return {
        ...fallback,
        mode: "demo_fallback",
        error: null,
        real_count: 0,
      };
    }

    return {
      items: sorted,
      mode: "real_readonly",
      error: null,
      real_count: sorted.length,
      fallback_count: 0,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur inconnue";
    const fallback = buildFallbackMessageCenterResult("error");
    return {
      ...fallback,
      error: `Lecture seule — données réelles non disponibles : ${message}`,
    };
  }
}
