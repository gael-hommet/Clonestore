// src/lib/pierre/v1/__integration__/p84-helpers.ts
// Shared P8.4 communication helpers (NOT a test file). Seeds a real document object in the tenant,
// configures the employer signatory email, and emits governed outbox events.
import type { Harness } from "./harness";
import type { TenantContext } from "../tenant-context";
import { newUuid } from "../sql";

export async function configureSignatory(h: Harness, company: string, email = "hr@acme.test"): Promise<void> {
  await h.db.query(`update pierre_rt_companies set signatory_email=$2, signatory_name='Acme HR' where id=$1`, [company, email]);
}

/** Insert a real document in the tenant; returns its id (the communication object). Sets a real
 *  created_by (requester) + owner_membership_id (approver) so the strategy resolver resolves them. */
export async function seedDocument(h: Harness, ctx: TenantContext, title = "Contrat CDI", over: { created_by?: string; owner_membership_id?: string | null } = {}): Promise<string> {
  const id = newUuid();
  const owner = over.owner_membership_id !== undefined ? over.owner_membership_id : (await h.db.query<{ id: string }>(`select id from pierre_rt_members where company_id=$1 and role in ('owner','admin') order by case role when 'owner' then 0 else 1 end, created_at asc limit 1`, [ctx.company_id])).rows[0]?.id ?? null;
  await h.db.query(
    `insert into pierre_rt_documents (id, company_id, document_type, title, sensitivity, status, created_by, owner_membership_id) values ($1,$2,'employment_contract',$3,'high','draft',$4,$5)`,
    [id, ctx.company_id, title, over.created_by ?? ctx.user_id, owner]);
  return id;
}

/** Emit a governed outbox event (as a producer would), pending for the P8.4 dispatcher. */
export async function emitOutbox(h: Harness, ctx: TenantContext, kind: string, payload: Record<string, unknown>, dedupKey?: string): Promise<string> {
  const id = newUuid();
  await h.db.query(
    `insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key) values ($1,$2,$3,$4,$5) on conflict (company_id, dedup_key) do nothing`,
    [id, ctx.company_id, kind, JSON.stringify(payload), dedupKey ?? `${kind}:${JSON.stringify(payload)}`]);
  const row = (await h.db.query<{ id: string }>(`select id from pierre_rt_outbox where company_id=$1 and dedup_key=$2`, [ctx.company_id, dedupKey ?? `${kind}:${JSON.stringify(payload)}`])).rows[0];
  return row.id;
}
