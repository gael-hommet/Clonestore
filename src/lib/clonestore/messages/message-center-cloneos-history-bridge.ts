// src/lib/clonestore/messages/message-center-cloneos-history-bridge.ts
// PHASE 3.3 — Apply CloneOS History Persistence Safely — Messages Bridge
//
// Charge les items CloneOS History et les transforme en MessageCenterItem.
// Utilisé par /profile/messages pour enrichir les onglets Suivis/Alertes
// avec l'historique des commandes CloneOS.
//
// Invariants :
//   - read_only = true toujours
//   - aucune écriture DB
//   - fallback silencieux si table absente
//   - items CloneOS History → Suivis ou Alertes selon statut

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCloneOSHistoryReadOnly } from "@/lib/clonestore/cloneos-history";
import { mapHistoryItemToMessageCenterItem } from "@/lib/clonestore/cloneos-history";
import type { MessageCenterItem } from "./message-center-types";

// ── Chargement depuis CloneOS History (read-only) ─────────────────────────────
// Retourne des items prêts à être intégrés dans /profile/messages.
// Aucun write. Fallback silencieux si table absente.

export async function loadCloneOSHistoryMessageItemsReadOnly(
  supabase: SupabaseClient | null,
  userId: string | null
): Promise<MessageCenterItem[]> {
  if (!supabase || !userId) return [];

  try {
    const historyResult = await loadCloneOSHistoryReadOnly(supabase, userId, {
      fallbackToLocalStorage: false, // messages page gère déjà sa propre démo
      localUserId: userId,
    });

    if (!historyResult.items || historyResult.items.length === 0) return [];

    return historyResult.items
      .map((item) => mapHistoryItemToMessageCenterItem(item))
      .filter((item): item is MessageCenterItem => item !== null);
  } catch {
    // silent fallback — ne bloque pas la messagerie
    return [];
  }
}

// ── Fusion items Pierre + CloneOS History ─────────────────────────────────────
// Dédoublonne par id. Priorité aux items Pierre (données réelles DB).

export function mergePierreAndCloneOSMessageItems(
  pierreItems: MessageCenterItem[],
  cloneOSItems: MessageCenterItem[]
): MessageCenterItem[] {
  if (cloneOSItems.length === 0) return pierreItems;
  if (pierreItems.length === 0) return cloneOSItems;

  // Dédoublonnage par id
  const seen = new Set(pierreItems.map((i) => i.id));
  const uniqueCloneOS = cloneOSItems.filter((i) => !seen.has(i.id));

  // Trier ensemble par date (décroissant)
  return [...pierreItems, ...uniqueCloneOS].sort(
    (a, b) =>
      new Date(b.updated_at ?? b.created_at).getTime() -
      new Date(a.updated_at ?? a.created_at).getTime()
  );
}
