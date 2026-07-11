// Programme partenaires — lectures dérivées (soldes, MRR, prospects). Aucune valeur inventée :
// tout est agrégé depuis le ledger append-only et les tables d'attribution/clients.
//
// Statuts d'une commission (dérivés, jamais annoncés comme acquis avant l'heure) :
//   • réserve      : status='pending' ET available_at > now (délai de réserve non écoulé)
//   • disponible   : status='pending' ET available_at <= now ET non gelée
//   • gelée        : status='frozen' (litige)
//   • versée       : status='paid'
// Le solde inclut les reversals (négatifs) → débit compensatoire net.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";

export type PartnerBalances = {
  currency: string;
  pendingReserveMinor: number; // en réserve (pas encore disponible)
  availableMinor: number; // disponible au versement (net des reversals)
  frozenMinor: number; // gelé (litige)
  paidMinor: number; // déjà versé
  lifetimeGrossMinor: number; // total des commissions enregistrées (hors reversals)
};

export async function getPartnerBalances(tx: SqlExecutor, partnerId: string): Promise<PartnerBalances> {
  const { rows } = await tx.query<{
    currency: string | null;
    reserve: string; available: string; frozen: string; paid: string; gross: string;
  }>(
    `select
       min(currency) as currency,
       coalesce(sum(commission_minor) filter (where status='pending' and available_at > now()),0) as reserve,
       coalesce(sum(commission_minor) filter (where status='pending' and available_at <= now()),0) as available,
       coalesce(sum(commission_minor) filter (where status='frozen'),0) as frozen,
       coalesce(sum(commission_minor) filter (where status='paid'),0) as paid,
       coalesce(sum(commission_minor) filter (where entry_type='commission'),0) as gross
     from clonestore_pp_commission_entries where partner_id = $1`,
    [partnerId],
  );
  const r = rows[0];
  const n = (v: string) => Number(v) || 0;
  return {
    currency: r?.currency ?? "eur",
    pendingReserveMinor: n(r?.reserve ?? "0"),
    availableMinor: n(r?.available ?? "0"),
    frozenMinor: n(r?.frozen ?? "0"),
    paidMinor: n(r?.paid ?? "0"),
    lifetimeGrossMinor: n(r?.gross ?? "0"),
  };
}

export type PartnerOverview = {
  balances: PartnerBalances;
  prospectsSubmitted: number;
  prospectsValidated: number;
  activeClients: number;
  totalClients: number;
  mrrMinor: number; // MRR HT apporté (clients actifs × commission de référence)
};

export async function getPartnerOverview(tx: SqlExecutor, partnerId: string): Promise<PartnerOverview> {
  const balances = await getPartnerBalances(tx, partnerId);
  const intro = await tx.query<{ submitted: string; validated: string }>(
    `select
       count(*) filter (where status in ('submitted','validated','matched')) as submitted,
       count(*) filter (where status in ('validated','matched')) as validated
     from clonestore_pp_introductions where partner_id = $1`,
    [partnerId],
  );
  const cust = await tx.query<{ active: string; total: string }>(
    `select count(*) filter (where status in ('active','past_due')) as active, count(*) as total
     from clonestore_pp_customers where partner_id = $1`,
    [partnerId],
  );
  // MRR HT apporté = somme des dernières commissions mensuelles enregistrées par client actif.
  const mrr = await tx.query<{ mrr: string }>(
    `select coalesce(sum(last_commission),0) as mrr from (
        select distinct on (stripe_subscription_id) commission_minor as last_commission
        from clonestore_pp_commission_entries
        where partner_id = $1 and entry_type='commission' and status <> 'void' and stripe_subscription_id is not null
        order by stripe_subscription_id, created_at desc
     ) t`,
    [partnerId],
  );
  const n = (v: string | undefined) => Number(v ?? "0") || 0;
  return {
    balances,
    prospectsSubmitted: n(intro.rows[0]?.submitted),
    prospectsValidated: n(intro.rows[0]?.validated),
    activeClients: n(cust.rows[0]?.active),
    totalClients: n(cust.rows[0]?.total),
    mrrMinor: n(mrr.rows[0]?.mrr),
  };
}

export type CommissionLine = {
  id: string;
  createdAt: string;
  entryType: string;
  status: string;
  commissionMinor: number;
  eligibleNetMinor: number;
  currency: string;
  stripeInvoiceId: string;
  availableAt: string;
};

/** Liste des commissions du cabinet (sans exposer de PII prospect excessive). */
export async function listPartnerCommissions(tx: SqlExecutor, partnerId: string, limit = 100): Promise<CommissionLine[]> {
  const { rows } = await tx.query<CommissionLine>(
    `select id, created_at as "createdAt", entry_type as "entryType", status, commission_minor as "commissionMinor",
            eligible_net_minor as "eligibleNetMinor", currency, stripe_invoice_id as "stripeInvoiceId", available_at as "availableAt"
     from clonestore_pp_commission_entries where partner_id = $1 order by created_at desc limit $2`,
    [partnerId, Math.min(limit, 500)],
  );
  return rows.map((r) => ({ ...r, commissionMinor: Number(r.commissionMinor) || 0, eligibleNetMinor: Number(r.eligibleNetMinor) || 0 }));
}
