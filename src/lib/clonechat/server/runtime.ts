// src/lib/clonechat/server/runtime.ts
// P9.4.1 — Résolution SERVER-ONLY des stores CloneChat. Utilise la couche DURABLE
// (Postgres) si une URL est configurée (CLONECHAT_DB_URL/DATABASE_URL), sinon un repli
// in-memory (tests/dev). Une seule API pour la route : budget (reserve/commit/release),
// support (findReusable/report/verify/cases), conversations (durables multi-device).

import { getClonechatDurable } from "../durable";
import { createInMemoryBudget } from "../budget-memory";
import { createResilientBudget } from "./resilient-budget";
import { createInMemorySupportMemory, type SupportMemory } from "../support-memory";
import { createInMemoryConversationStore } from "../conversations/memory-store";
import { createInMemoryCommandLedger, type CommandLedger } from "../durable/command-ledger";
import { createInMemoryProposalStore, type ProposalStore } from "../durable/proposal-store";
import type { ConversationStore } from "../conversations/types";
import type { DurableBudget } from "../durable/budget-store";

// NOTE (P9.4.2 r2) : l'ancien `idempotency` store (durable/idempotency-store.ts) est SUPERSÉDÉ
// par le registre de COMMANDES durable (`commands`/`proposals` + command-executor). Il n'est
// PLUS exposé ici (aucun consommateur en production) : l'exécution effective passe uniquement
// par le command ledger. Le module durable/index.ts le construit encore pour ses tests d'intégration.
export interface CloneChatStores {
  readonly durable: boolean;
  readonly budget: DurableBudget;
  readonly support: SupportMemory;
  readonly conversations: ConversationStore;
  readonly commands: CommandLedger;
  readonly proposals: ProposalStore;
}

// Repli in-memory persistant par PROCESSUS (comme P9.4 ; non durable/multi-instance).
const g = globalThis as unknown as {
  __cc941Budget?: DurableBudget;
  __cc941Support?: SupportMemory;
  __cc941Conv?: ConversationStore;
  __cc942Cmd?: CommandLedger;
  __cc942Prop?: ProposalStore;
};
function memBudget(): DurableBudget { return (g.__cc941Budget ??= createInMemoryBudget()); }
function memSupport(): SupportMemory { return (g.__cc941Support ??= createInMemorySupportMemory()); }
function memConv(): ConversationStore { return (g.__cc941Conv ??= createInMemoryConversationStore()); }
function memCmd(): CommandLedger { return (g.__cc942Cmd ??= createInMemoryCommandLedger()); }
function memProp(): ProposalStore { return (g.__cc942Prop ??= createInMemoryProposalStore()); }

/** Récupère les stores CloneChat (durables si configurés, sinon in-memory). */
export async function getCloneChatStores(): Promise<CloneChatStores> {
  const durable = await getClonechatDurable();
  if (durable) {
    return {
      durable: true,
      // C1.8 FINAL — Le budget durable est enveloppé d'un filet EN MÉMOIRE.
      //
      // Sans cela, une base injoignable (ou, comme en production, une migration CloneChat jamais
      // appliquée) faisait échouer CHAQUE `reserve()`. La route attrapait l'erreur en silence, et
      // « pas de réservation » signifie « pas d'appel modèle » : le produit entier retombait sur
      // le moteur déterministe, définitivement, sans un seul log. Un plafond doit tenir ; une
      // PANNE ne doit pas rendre le produit muet. Les plafonds continuent de s'appliquer
      // (compteur mémoire), et la dégradation devient EXPLICITE (`budgetHealth()`).
      budget: createResilientBudget(durable.budget, memBudget()),
      support: durable.support,
      conversations: durable.conversations,
      commands: durable.commands,
      proposals: durable.proposals,
    };
  }
  return { durable: false, budget: memBudget(), support: memSupport(), conversations: memConv(), commands: memCmd(), proposals: memProp() };
}
