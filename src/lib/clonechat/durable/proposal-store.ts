// src/lib/clonechat/durable/proposal-store.ts
// P9.4.2 r2 — Propositions PERSISTÉES côté serveur. Quand le modèle propose une action
// effective, le serveur enregistre la proposition avec un payload CANONIQUE validé
// serveur. Le client confirme par proposal_id ; le serveur RECHARGE la proposition
// (scopée company+actor) et reconstruit l'action — jamais de payload de confiance client.

import type { ClonechatDb } from "./pg";

export interface ProposalInput {
  readonly conversationId: string | null;
  readonly actionKind: string;
  readonly payload: Record<string, unknown>;
  readonly at: string;
}
export interface StoredProposal {
  readonly id: string;
  readonly conversationId: string | null;
  readonly actionKind: string;
  readonly payload: Record<string, unknown>;
}
export interface ProposalCtx { readonly companyId: string; readonly userId: string; }

export interface ProposalStore {
  create(ctx: ProposalCtx, input: ProposalInput): Promise<{ id: string }>;
  load(id: string, ctx: ProposalCtx): Promise<StoredProposal | null>;
}

export function createDurableProposalStore(db: ClonechatDb): ProposalStore {
  return {
    create(ctx, input) {
      return db.withTenant(ctx, async (q) => {
        const r = await q.query<{ id: string }>(
          "insert into clonechat_proposals (company_id, user_id, conversation_id, action_kind, payload, created_at) values ($1,$2,$3,$4,$5::jsonb,$6) returning id",
          [ctx.companyId, ctx.userId, input.conversationId, input.actionKind, JSON.stringify(input.payload), input.at],
        );
        return { id: String(r.rows[0].id) };
      });
    },
    load(id, ctx) {
      return db.withTenant(ctx, async (q) => {
        const r = await q.query<Record<string, unknown>>(
          "select id, conversation_id, action_kind, payload from clonechat_proposals where id=$1 and company_id=$2 and user_id=$3",
          [id, ctx.companyId, ctx.userId]);
        const row = r.rows[0];
        return row ? { id: String(row.id), conversationId: (row.conversation_id as string) ?? null, actionKind: String(row.action_kind), payload: (row.payload as Record<string, unknown>) ?? {} } : null;
      });
    },
  };
}

// In-memory (tests / repli). Scopé company+user (jamais de fuite cross-tenant).
export function createInMemoryProposalStore(): ProposalStore {
  const rows = new Map<string, StoredProposal & { companyId: string; userId: string }>();
  let n = 0;
  return {
    async create(ctx, input) {
      const id = `prop-${++n}`;
      rows.set(id, { id, companyId: ctx.companyId, userId: ctx.userId, conversationId: input.conversationId, actionKind: input.actionKind, payload: input.payload });
      return { id };
    },
    async load(id, ctx) {
      const r = rows.get(id);
      if (!r || r.companyId !== ctx.companyId || r.userId !== ctx.userId) return null;
      return { id: r.id, conversationId: r.conversationId, actionKind: r.actionKind, payload: r.payload };
    },
  };
}
