// src/lib/clonechat/conversations/memory-store.ts
// P9.4.1 — Implémentation IN-MEMORY du ConversationStore (tests / dev sans DB). Pure,
// par processus, non durable — utilisée uniquement quand aucune URL de base durable
// n'est configurée. Applique la même isolation logique (company+user) que la version SQL.

import type { ConversationStore, ConversationSummary, StoredMessage, ConversationCtx, AppendMessageInput } from "./types";
import { sanitizeContentForStorage } from "./types";

let seq = 0;
const nid = (p: string) => `${p}-${++seq}`;

interface Row {
  id: string; companyId: string; userId: string;
  title: string; rollingSummary: string | null;
  createdAt: string; updatedAt: string; lastActivityAt: string; archivedAt: string | null;
}

export function createInMemoryConversationStore(): ConversationStore {
  const convs = new Map<string, Row>();
  const msgs = new Map<string, StoredMessage[]>();
  const owns = (r: Row | undefined, ctx: ConversationCtx) => !!r && r.companyId === ctx.companyId && r.userId === ctx.userId;

  return {
    async createConversation(ctx, input) {
      const id = nid("conv");
      const row: Row = { id, companyId: ctx.companyId, userId: ctx.userId, title: input.title?.trim() || "Conversation", rollingSummary: null, createdAt: input.at, updatedAt: input.at, lastActivityAt: input.at, archivedAt: null };
      convs.set(id, row); msgs.set(id, []);
      return pub(row);
    },
    async listConversations(ctx, opts) {
      const limit = opts?.limit ?? 30;
      return [...convs.values()]
        .filter((r) => r.companyId === ctx.companyId && r.userId === ctx.userId && (opts?.includeArchived || !r.archivedAt))
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
        .slice(0, limit).map(pub);
    },
    async getConversation(id, ctx) {
      const r = convs.get(id); return owns(r, ctx) ? pub(r!) : null;
    },
    async getMessages(id, ctx, opts) {
      const r = convs.get(id); if (!owns(r, ctx)) return [];
      const list = msgs.get(id) ?? [];
      const limit = opts?.limit ?? 200;
      return list.slice(-limit);
    },
    async appendMessage(id, ctx, msg: AppendMessageInput) {
      const r = convs.get(id); if (!owns(r, ctx)) throw new Error("conversation_not_found");
      const list = msgs.get(id)!;
      const m: StoredMessage = {
        id: nid("msg"), conversationId: id, seq: list.length + 1, role: msg.role,
        content: sanitizeContentForStorage(msg.content), sourceIds: msg.sourceIds ?? [],
        actionProposal: msg.actionProposal ?? null, actionResult: msg.actionResult ?? null,
        usage: msg.usage ?? null, imageMeta: msg.imageMeta ?? null, createdAt: msg.at,
      };
      list.push(m);
      r!.updatedAt = msg.at; r!.lastActivityAt = msg.at;
      return m;
    },
    async renameConversation(id, ctx, title, at) {
      const r = convs.get(id); if (!owns(r, ctx)) return; r!.title = title.trim().slice(0, 200) || r!.title; r!.updatedAt = at;
    },
    async archiveConversation(id, ctx, at) {
      const r = convs.get(id); if (!owns(r, ctx)) return; r!.archivedAt = at; r!.updatedAt = at;
    },
    async deleteConversation(id, ctx) {
      const r = convs.get(id); if (!owns(r, ctx)) return; convs.delete(id); msgs.delete(id);
    },
    async updateSummary(id, ctx, summary, at) {
      const r = convs.get(id); if (!owns(r, ctx)) return; r!.rollingSummary = summary.slice(0, 4000); r!.updatedAt = at;
    },
  };

  function pub(r: Row): ConversationSummary {
    return { id: r.id, title: r.title, rollingSummary: r.rollingSummary, createdAt: r.createdAt, updatedAt: r.updatedAt, lastActivityAt: r.lastActivityAt, archivedAt: r.archivedAt };
  }
}
