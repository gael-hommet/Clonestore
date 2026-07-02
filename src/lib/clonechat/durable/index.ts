// src/lib/clonechat/durable/index.ts
// P9.4.1 — Fabrique centrale de la couche durable CloneChat. Sélectionne l'implémentation
// DURABLE (Postgres) quand une URL est configurée (CLONECHAT_DB_URL/DATABASE_URL), sinon
// signale l'absence (l'appelant retombe alors sur les stores in-memory pour tests/dev).
// Server-only : n'importer que côté serveur (le driver pg est chargé dynamiquement).

import { createPgClonechatDb, resolveClonechatDbUrl, type ClonechatDb } from "./pg";
import { createDurableConversationStore } from "../conversations/durable-store";
import { createDurableSupportMemory } from "./support-store";
import { createDurableBudget, type DurableBudget } from "./budget-store";
import type { ConversationStore } from "../conversations/types";
import type { SupportMemory } from "../support-memory";

export * from "./pg";
export * from "./budget-store";
export * from "./support-store";

export interface ClonechatDurable {
  readonly db: ClonechatDb;
  readonly conversations: ConversationStore;
  readonly support: SupportMemory;
  readonly budget: DurableBudget;
}

/** Construit la couche durable à partir d'une URL explicite (tests/preuves). */
export async function buildClonechatDurable(url: string, opts?: { assumeRole?: string | null; ssl?: boolean }): Promise<ClonechatDurable> {
  const db = await createPgClonechatDb(url, opts);
  return {
    db,
    conversations: createDurableConversationStore(db),
    support: createDurableSupportMemory(db),
    budget: createDurableBudget(db),
  };
}

// Cache par processus (une seule pool). Null si aucune URL n'est configurée.
const g = globalThis as unknown as { __clonechatDurable?: Promise<ClonechatDurable | null> };

/** Récupère la couche durable si configurée, sinon null (⇒ repli in-memory). */
export function getClonechatDurable(): Promise<ClonechatDurable | null> {
  if (g.__clonechatDurable) return g.__clonechatDurable;
  const url = resolveClonechatDbUrl();
  g.__clonechatDurable = url
    ? buildClonechatDurable(url, { ssl: /supabase|amazonaws|\.com\b/.test(url) && !url.includes("localhost") && !url.includes("127.0.0.1") }).catch(() => null)
    : Promise.resolve(null);
  return g.__clonechatDurable;
}
