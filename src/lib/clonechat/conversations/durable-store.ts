// src/lib/clonechat/conversations/durable-store.ts
// P9.4.1 — Implémentation DURABLE (Postgres) du ConversationStore. Toutes les
// opérations passent par `db.withTenant` : rôle applicatif + GUC tenant ⇒ la RLS isole
// réellement chaque entreprise (une conversation d'un autre tenant est INVISIBLE, pas
// juste filtrée applicativement). Multi-device : la vérité vit côté serveur, pas dans
// le navigateur. Multi-instance : plusieurs process partagent la même base.

import type { ClonechatDb } from "../durable/pg";
import type { ConversationStore, ConversationSummary, StoredMessage, ConversationCtx, AppendMessageInput } from "./types";
import { sanitizeContentForStorage } from "./types";

function mapConv(r: Record<string, unknown>): ConversationSummary {
  return {
    id: String(r.id), title: String(r.title), rollingSummary: (r.rolling_summary as string) ?? null,
    createdAt: isoOf(r.created_at), updatedAt: isoOf(r.updated_at), lastActivityAt: isoOf(r.last_activity_at),
    archivedAt: r.archived_at ? isoOf(r.archived_at) : null,
  };
}
function mapMsg(r: Record<string, unknown>): StoredMessage {
  return {
    id: String(r.id), conversationId: String(r.conversation_id), seq: Number(r.seq),
    role: r.role as StoredMessage["role"], content: (r.content as unknown[]) ?? [],
    sourceIds: (r.source_ids as string[]) ?? [], actionProposal: r.action_proposal ?? null,
    actionResult: r.action_result ?? null, usage: r.usage ?? null, imageMeta: r.image_meta ?? null,
    createdAt: isoOf(r.created_at),
  };
}
function isoOf(v: unknown): string { if (v instanceof Date) return v.toISOString(); return String(v ?? ""); }

export function createDurableConversationStore(db: ClonechatDb): ConversationStore {
  return {
    createConversation(ctx, input) {
      return db.withTenant(ctx, async (q) => {
        const r = await q.query(
          "insert into clonechat_conversations (company_id, user_id, title, created_at, updated_at, last_activity_at) values ($1,$2,$3,$4,$4,$4) returning *",
          [ctx.companyId, ctx.userId, (input.title?.trim() || "Conversation").slice(0, 200), input.at],
        );
        return mapConv(r.rows[0]);
      });
    },
    listConversations(ctx, opts) {
      return db.withTenant(ctx, async (q) => {
        const r = await q.query(
          `select * from clonechat_conversations where user_id = $1 ${opts?.includeArchived ? "" : "and archived_at is null"} order by last_activity_at desc limit $2`,
          [ctx.userId, opts?.limit ?? 30],
        );
        return r.rows.map(mapConv);
      });
    },
    getConversation(id, ctx) {
      return db.withTenant(ctx, async (q) => {
        const r = await q.query("select * from clonechat_conversations where id = $1 and user_id = $2", [id, ctx.userId]);
        return r.rows[0] ? mapConv(r.rows[0]) : null;
      });
    },
    getMessages(id, ctx, opts) {
      return db.withTenant(ctx, async (q) => {
        const owns = await q.query("select 1 from clonechat_conversations where id=$1 and user_id=$2", [id, ctx.userId]);
        if (owns.rowCount === 0) return [];
        const r = await q.query("select * from clonechat_messages where conversation_id = $1 order by seq asc limit $2", [id, opts?.limit ?? 200]);
        return r.rows.map(mapMsg);
      });
    },
    appendMessage(id, ctx, msg: AppendMessageInput) {
      // ATOMIQUE (P9.4.2) : le FOR UPDATE sur la conversation sérialise les appends
      // concurrents (le 2e bloque jusqu'au commit du 1er, puis lit un max(seq) à jour).
      // Filet supplémentaire : l'index unique (conversation_id, seq) garantit qu'aucun
      // doublon ne peut être écrit ; en cas de collision improbable, on RÉESSAIE une fois
      // (nouvelle transaction ⇒ nouveau verrou ⇒ seq à jour).
      const run = (): Promise<StoredMessage> => db.withTenant(ctx, async (q) => {
        const owns = await q.query("select 1 from clonechat_conversations where id=$1 and user_id=$2 for update", [id, ctx.userId]);
        if (owns.rowCount === 0) throw new Error("conversation_not_found");
        const seqRow = await q.query("select coalesce(max(seq),0)::int as s from clonechat_messages where conversation_id=$1", [id]);
        const seq = Number(seqRow.rows[0].s) + 1;
        const content = JSON.stringify(sanitizeContentForStorage(msg.content));
        const r = await q.query(
          `insert into clonechat_messages (conversation_id, company_id, user_id, seq, role, content, source_ids, action_proposal, action_result, usage, image_meta, created_at)
           values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12) returning *`,
          [id, ctx.companyId, ctx.userId, seq, msg.role, content, msg.sourceIds ?? [],
           js(msg.actionProposal), js(msg.actionResult), js(msg.usage), js(msg.imageMeta), msg.at],
        );
        await q.query("update clonechat_conversations set updated_at=$2, last_activity_at=$2 where id=$1", [id, msg.at]);
        return mapMsg(r.rows[0]);
      });
      return run().catch((e: unknown) => {
        // 23505 = unique_violation (conversation_id, seq) : réessai unique.
        if ((e as { code?: string })?.code === "23505") return run();
        throw e;
      });
    },
    renameConversation(id, ctx, title, at) {
      return db.withTenant(ctx, async (q) => { await q.query("update clonechat_conversations set title=$3, updated_at=$4 where id=$1 and user_id=$2", [id, ctx.userId, title.trim().slice(0, 200) || "Conversation", at]); });
    },
    archiveConversation(id, ctx, at) {
      return db.withTenant(ctx, async (q) => { await q.query("update clonechat_conversations set archived_at=$3, updated_at=$3 where id=$1 and user_id=$2", [id, ctx.userId, at]); });
    },
    deleteConversation(id, ctx) {
      return db.withTenant(ctx, async (q) => { await q.query("delete from clonechat_conversations where id=$1 and user_id=$2", [id, ctx.userId]); });
    },
    updateSummary(id, ctx, summary, at) {
      return db.withTenant(ctx, async (q) => { await q.query("update clonechat_conversations set rolling_summary=$3, updated_at=$4 where id=$1 and user_id=$2", [id, ctx.userId, summary.slice(0, 4000), at]); });
    },
  };
}

function js(v: unknown): string | null { return v === undefined || v === null ? null : JSON.stringify(v); }
