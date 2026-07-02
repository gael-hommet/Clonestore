// src/lib/clonechat/server/runtime.ts
// P9.4.1 — Résolution SERVER-ONLY des stores CloneChat. Utilise la couche DURABLE
// (Postgres) si une URL est configurée (CLONECHAT_DB_URL/DATABASE_URL), sinon un repli
// in-memory (tests/dev). Une seule API pour la route : budget (reserve/commit/release),
// support (findReusable/report/verify/cases), conversations (durables multi-device).

import { getClonechatDurable } from "../durable";
import { createInMemoryBudget } from "../budget-memory";
import { createInMemorySupportMemory, type SupportMemory } from "../support-memory";
import { createInMemoryConversationStore } from "../conversations/memory-store";
import type { ConversationStore } from "../conversations/types";
import type { DurableBudget } from "../durable/budget-store";

export interface CloneChatStores {
  readonly durable: boolean;
  readonly budget: DurableBudget;
  readonly support: SupportMemory;
  readonly conversations: ConversationStore;
}

// Repli in-memory persistant par PROCESSUS (comme P9.4 ; non durable/multi-instance).
const g = globalThis as unknown as {
  __cc941Budget?: DurableBudget;
  __cc941Support?: SupportMemory;
  __cc941Conv?: ConversationStore;
};
function memBudget(): DurableBudget { return (g.__cc941Budget ??= createInMemoryBudget()); }
function memSupport(): SupportMemory { return (g.__cc941Support ??= createInMemorySupportMemory()); }
function memConv(): ConversationStore { return (g.__cc941Conv ??= createInMemoryConversationStore()); }

/** Récupère les stores CloneChat (durables si configurés, sinon in-memory). */
export async function getCloneChatStores(): Promise<CloneChatStores> {
  const durable = await getClonechatDurable();
  if (durable) {
    return { durable: true, budget: durable.budget, support: durable.support, conversations: durable.conversations };
  }
  return { durable: false, budget: memBudget(), support: memSupport(), conversations: memConv() };
}
