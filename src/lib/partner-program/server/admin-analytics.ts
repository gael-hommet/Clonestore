// Programme partenaires — ANALYTIQUE ADMIN par cabinet.
//
// DOCTRINE :
//   • tous les agrégats sont calculés par PostgreSQL, jamais reconstruits dans le navigateur ;
//   • aucune requête ne charge tous les partenaires ET tous leurs clients : pagination serveur,
//     agrégats en sous-requêtes latérales bornées, détail chargé à la demande ;
//   • aucune donnée bancaire n'est lue ni renvoyée : CloneStore n'en possède aucune. Le seul
//     état Stripe exposé est la complétude du compte connecté et les exigences encore dues.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";

// ── Vue liste ────────────────────────────────────────────────────────────────

export type PartnerListSort = "recent" | "active_clients" | "client_mrr" | "available" | "commission_mrr";

export type PartnerListFilters = {
  /** Restreint à UN cabinet (vue détail) — mêmes agrégats que la liste, aucune divergence. */
  partnerId?: string | null;
  search?: string | null;
  status?: string | null;
  country?: string | null;
  /** ready = payouts activés ; incomplete = compte présent mais pas prêt ; none = aucun compte. */
  connect?: "ready" | "incomplete" | "none" | null;
  sort?: PartnerListSort;
  limit?: number;
  offset?: number;
};

export type PartnerListRow = {
  id: string;
  displayName: string;
  email: string;
  country: string;
  cabinetType: string;
  publicSlug: string;
  status: string;
  activationMode: string | null;
  appliedAt: string;
  activatedAt: string | null;
  lastActivityAt: string | null;

  connectState: ConnectState;
  payoutsEnabled: boolean;
  openRiskFlags: number;

  activeClients: number;
  totalClients: number;
  canceledClients: number;

  clientMrrMinor: number;      // MRR HT des clients apportés (base de calcul)
  commissionMrrMinor: number;  // 20 % de ce MRR, tel qu'enregistré au ledger
  grossMinor: number;
  reversalsMinor: number;
  reserveMinor: number;
  availableMinor: number;
  frozenMinor: number;
  paidMinor: number;
  currency: string;
  payoutThresholdMinor: number;
  lastPayoutAt: string | null;
};

export type PartnerListPage = {
  items: PartnerListRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

/** État Stripe Connect exposé à l'admin. JAMAIS une donnée bancaire. */
export type ConnectState =
  | "not_started"       // aucun compte connecté
  | "in_progress"       // compte créé, informations non soumises
  | "missing_info"      // informations manquantes (requirements dus)
  | "restricted"        // compte restreint par Stripe
  | "ready";            // payouts activés : prêt à recevoir

export function connectState(p: {
  accountId: string | null; detailsSubmitted: boolean; onboardingStatus: string;
  payoutsEnabled: boolean; requirementsDue: string[]; disabledReason: string | null;
}): ConnectState {
  if (!p.accountId) return "not_started";
  if (p.payoutsEnabled && p.onboardingStatus === "complete") return "ready";
  if (p.disabledReason || p.onboardingStatus === "restricted") return "restricted";
  if (p.requirementsDue.length > 0) return "missing_info";
  if (!p.detailsSubmitted) return "in_progress";
  return "missing_info";
}

const SORTS: Record<PartnerListSort, string> = {
  recent: "p.created_at desc",
  active_clients: "agg.active_clients desc, p.created_at desc",
  client_mrr: "agg.client_mrr desc, p.created_at desc",
  commission_mrr: "agg.commission_mrr desc, p.created_at desc",
  available: "agg.available desc, p.created_at desc",
};

export function clampAdminPaging(limit?: number, offset?: number): { limit: number; offset: number } {
  const l = Number.isFinite(limit) && (limit as number) > 0 ? Math.min(Math.trunc(limit as number), 100) : 25;
  const o = Number.isFinite(offset) && (offset as number) > 0 ? Math.trunc(offset as number) : 0;
  return { limit: l, offset: o };
}

const n = (v: unknown): number => Number(v ?? 0) || 0;

/**
 * Liste paginée des cabinets avec TOUS les agrégats, calculés côté PostgreSQL.
 * Une seule requête : les agrégats sont des sous-requêtes corrélées, évaluées uniquement
 * pour la page demandée (jamais pour l'ensemble du portefeuille).
 */
export async function listPartnersWithAnalytics(tx: SqlExecutor, f: PartnerListFilters = {}): Promise<PartnerListPage> {
  const { limit, offset } = clampAdminPaging(f.limit, f.offset);
  const sort = SORTS[f.sort ?? "recent"] ?? SORTS.recent;

  const search = f.search?.trim() ? `%${f.search.trim().toLowerCase()}%` : null;
  const status = f.status?.trim() || null;
  const country = f.country?.trim()?.toUpperCase() || null;
  const connect = f.connect ?? null;

  // Le filtre Connect est traduit en prédicat SQL (jamais filtré après coup en mémoire).
  const connectPredicate =
    connect === "ready" ? `and p.payouts_enabled = true and p.stripe_onboarding_status = 'complete'`
    : connect === "none" ? `and p.stripe_connected_account_id is null`
    : connect === "incomplete" ? `and p.stripe_connected_account_id is not null and not (p.payouts_enabled = true and p.stripe_onboarding_status = 'complete')`
    : "";

  const partnerId = f.partnerId?.trim() || null;

  const where = `
    where ($1::text is null or lower(p.display_name) like $1 or lower(p.email_normalized) like $1 or lower(p.public_slug) like $1)
      and ($2::text is null or p.status = $2)
      and ($3::text is null or upper(p.country) = $3)
      and ($6::uuid is null or p.id = $6::uuid)
      ${connectPredicate}`;

  const totalRow = await tx.query<{ total: string }>(
    `select count(*)::bigint as total from clonestore_pp_partners p
      where ($1::text is null or lower(p.display_name) like $1 or lower(p.email_normalized) like $1 or lower(p.public_slug) like $1)
        and ($2::text is null or p.status = $2)
        and ($3::text is null or upper(p.country) = $3)
        and ($4::uuid is null or p.id = $4::uuid)
        ${connectPredicate}`,
    [search, status, country, partnerId],
  );

  const { rows } = await tx.query<Record<string, unknown>>(
    `select
        p.id, p.display_name, p.email, p.country, p.cabinet_type, p.public_slug, p.status,
        p.activation_mode, p.created_at, p.activated_at, p.updated_at,
        p.stripe_connected_account_id, p.stripe_onboarding_status, p.payouts_enabled,
        p.stripe_details_submitted, p.stripe_requirements_due, p.stripe_disabled_reason,
        p.payout_threshold_minor, p.payout_currency, p.last_payout_at,
        agg.*
      from clonestore_pp_partners p
      cross join lateral (
        select
          (select count(*) from clonestore_pp_risk_flags rf where rf.partner_id = p.id and rf.status = 'open') as open_flags,
          (select count(*) from clonestore_pp_customers c where c.partner_id = p.id and c.status in ('active','past_due')) as active_clients,
          (select count(*) from clonestore_pp_customers c where c.partner_id = p.id) as total_clients,
          (select count(*) from clonestore_pp_customers c where c.partner_id = p.id and c.status = 'canceled') as canceled_clients,
          -- MRR : dernière facture par abonnement ACTIF. HT côté client, commission côté cabinet.
          (select coalesce(sum(t.net),0) from (
              select distinct on (e.stripe_subscription_id) e.eligible_net_minor as net
                from clonestore_pp_commission_entries e
                join clonestore_pp_customers c2 on c2.stripe_subscription_id = e.stripe_subscription_id
               where e.partner_id = p.id and e.entry_type = 'commission' and e.status <> 'void'
                 and e.stripe_subscription_id is not null and c2.status in ('active','past_due')
               order by e.stripe_subscription_id, e.created_at desc
           ) t) as client_mrr,
          (select coalesce(sum(t.com),0) from (
              select distinct on (e.stripe_subscription_id) e.commission_minor as com
                from clonestore_pp_commission_entries e
                join clonestore_pp_customers c2 on c2.stripe_subscription_id = e.stripe_subscription_id
               where e.partner_id = p.id and e.entry_type = 'commission' and e.status <> 'void'
                 and e.stripe_subscription_id is not null and c2.status in ('active','past_due')
               order by e.stripe_subscription_id, e.created_at desc
           ) t) as commission_mrr,
          (select coalesce(sum(e.commission_minor) filter (where e.entry_type = 'commission'),0)
             from clonestore_pp_commission_entries e where e.partner_id = p.id) as gross,
          (select coalesce(sum(e.commission_minor) filter (where e.entry_type = 'reversal'),0)
             from clonestore_pp_commission_entries e where e.partner_id = p.id) as reversals,
          (select coalesce(sum(e.commission_minor) filter (where e.status='pending' and e.available_at > now()),0)
             from clonestore_pp_commission_entries e where e.partner_id = p.id) as reserve,
          (select coalesce(sum(e.commission_minor) filter (where e.status='pending' and e.available_at <= now()),0)
             from clonestore_pp_commission_entries e where e.partner_id = p.id) as available,
          (select coalesce(sum(e.commission_minor) filter (where e.status='frozen'),0)
             from clonestore_pp_commission_entries e where e.partner_id = p.id) as frozen,
          (select coalesce(sum(e.commission_minor) filter (where e.status='paid'),0)
             from clonestore_pp_commission_entries e where e.partner_id = p.id) as paid
      ) agg
      ${where}
      order by ${sort}
      limit $4 offset $5`,
    [search, status, country, limit, offset, partnerId],
  );

  const items: PartnerListRow[] = rows.map((r) => {
    const requirementsDue = Array.isArray(r.stripe_requirements_due) ? (r.stripe_requirements_due as string[]) : [];
    return {
      id: String(r.id),
      displayName: String(r.display_name),
      email: String(r.email),
      country: String(r.country ?? ""),
      cabinetType: String(r.cabinet_type ?? ""),
      publicSlug: String(r.public_slug),
      status: String(r.status),
      activationMode: (r.activation_mode as string | null) ?? null,
      appliedAt: String(r.created_at),
      activatedAt: (r.activated_at as string | null) ?? null,
      lastActivityAt: (r.updated_at as string | null) ?? null,

      connectState: connectState({
        accountId: (r.stripe_connected_account_id as string | null) ?? null,
        detailsSubmitted: r.stripe_details_submitted === true,
        onboardingStatus: String(r.stripe_onboarding_status ?? "none"),
        payoutsEnabled: r.payouts_enabled === true,
        requirementsDue,
        disabledReason: (r.stripe_disabled_reason as string | null) ?? null,
      }),
      payoutsEnabled: r.payouts_enabled === true,
      openRiskFlags: n(r.open_flags),

      activeClients: n(r.active_clients),
      totalClients: n(r.total_clients),
      canceledClients: n(r.canceled_clients),

      clientMrrMinor: n(r.client_mrr),
      commissionMrrMinor: n(r.commission_mrr),
      grossMinor: n(r.gross),
      reversalsMinor: n(r.reversals),
      reserveMinor: n(r.reserve),
      availableMinor: n(r.available),
      frozenMinor: n(r.frozen),
      paidMinor: n(r.paid),
      currency: String(r.payout_currency ?? "eur"),
      payoutThresholdMinor: n(r.payout_threshold_minor),
      lastPayoutAt: (r.last_payout_at as string | null) ?? null,
    };
  });

  const total = n(totalRow.rows[0]?.total);
  return { items, total, limit, offset, hasMore: offset + items.length < total };
}

// ── Vue détail (chargée à la demande, jamais avec la liste) ──────────────────

export type PartnerDetail = {
  partner: PartnerListRow;
  onboarding: {
    contractAccepted: boolean;
    contractAcceptedAt: string | null;
    connectState: ConnectState;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    hasConnectedAccount: boolean;
    requirementsDue: string[];
    disabledReason: string | null;
    remainingSteps: string[];
  };
  acquisition: {
    clicks: number;
    introductions: number;
    introductionsPending: number;
    introductionsMatched: number;
    prospectsSignedUp: number;
    attributionsPending: number;
    attributionsLocked: number;
    conflicts: number;
    clientsLost: number;
  };
  clients: {
    items: Array<{
      id: string; companyLabel: string | null; status: string;
      stripeSubscriptionId: string | null; currency: string;
      firstPaymentAt: string | null; lastPaymentAt: string | null;
      commissionMinor: number;
    }>;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  nextPayout: {
    estimatedMinor: number;
    thresholdMinor: number;
    thresholdReached: boolean;
    blockedReason: string | null;
  };
  transfers: Array<{
    id: string; periodStart: string; periodEnd: string; amountMinor: number; currency: string;
    status: string; stripeTransferId: string | null; failureReason: string | null;
    requiredAction: string | null; attempts: number; paidAt: string | null;
  }>;
  riskFlags: Array<{ id: string; kind: string; severity: string; explanation: string; status: string; createdAt: string }>;
  audit: Array<{ actor: string; action: string; reason: string; occurredAt: string }>;
};

export async function getPartnerDetail(
  tx: SqlExecutor, partnerId: string, clientPaging?: { limit?: number; offset?: number },
): Promise<PartnerDetail | null> {
  // Mêmes agrégats que la liste, produits par la MÊME requête : aucun chiffre ne peut diverger.
  const partner = (await listPartnersWithAnalytics(tx, { partnerId, limit: 1, offset: 0 })).items[0];
  if (!partner) return null;

  const p = await tx.query<Record<string, unknown>>(
    `select contract_accepted_at, stripe_connected_account_id, stripe_details_submitted,
            stripe_requirements_due, stripe_disabled_reason, stripe_onboarding_status, payouts_enabled, status
       from clonestore_pp_partners where id=$1`,
    [partnerId],
  );
  const pr = p.rows[0];
  const requirementsDue = Array.isArray(pr.stripe_requirements_due) ? (pr.stripe_requirements_due as string[]) : [];

  const remainingSteps: string[] = [];
  if (!pr.contract_accepted_at) remainingSteps.push("accept_terms");
  if (!(pr.payouts_enabled === true && pr.stripe_onboarding_status === "complete")) remainingSteps.push("complete_stripe_onboarding");
  if (partner.openRiskFlags > 0) remainingSteps.push("awaiting_review");

  const acq = await tx.query<Record<string, unknown>>(
    `select
       (select count(*) from clonestore_pp_referral_touches t where t.partner_id=$1) as clicks,
       (select count(*) from clonestore_pp_introductions i where i.partner_id=$1) as introductions,
       (select count(*) from clonestore_pp_introductions i where i.partner_id=$1 and i.status in ('submitted','validated')) as intro_pending,
       (select count(*) from clonestore_pp_introductions i where i.partner_id=$1 and i.status='matched') as intro_matched,
       (select count(*) from clonestore_pp_attributions a where a.partner_id=$1) as prospects,
       (select count(*) from clonestore_pp_attributions a where a.partner_id=$1 and a.status='pending') as attr_pending,
       (select count(*) from clonestore_pp_attributions a where a.partner_id=$1 and a.status='locked') as attr_locked,
       (select count(*) from clonestore_pp_risk_flags rf where rf.partner_id=$1 and rf.kind='attribution_conflict') as conflicts,
       (select count(*) from clonestore_pp_customers c where c.partner_id=$1 and c.status='canceled') as lost`,
    [partnerId],
  );
  const a = acq.rows[0];

  const cp = clampAdminPaging(clientPaging?.limit ?? 25, clientPaging?.offset ?? 0);
  const clientsTotal = await tx.query<{ total: string }>(
    `select count(*)::bigint total from clonestore_pp_customers where partner_id=$1`, [partnerId],
  );
  const clients = await tx.query<Record<string, unknown>>(
    `select c.id, c.company_label, c.status, c.stripe_subscription_id,
            coalesce(min(e.created_at), null) as first_payment_at,
            coalesce(max(e.created_at), null) as last_payment_at,
            coalesce(sum(e.commission_minor) filter (where e.entry_type='commission'),0) as commission,
            coalesce(min(e.currency), 'eur') as currency
       from clonestore_pp_customers c
       left join clonestore_pp_commission_entries e
         on e.partner_id = c.partner_id and e.stripe_subscription_id = c.stripe_subscription_id
      where c.partner_id = $1
      group by c.id, c.company_label, c.status, c.stripe_subscription_id
      order by max(e.created_at) desc nulls last, c.started_at desc
      limit $2 offset $3`,
    [partnerId, cp.limit, cp.offset],
  );

  const transfers = await tx.query<Record<string, unknown>>(
    `select id, period_start, period_end, amount_minor, currency, status, stripe_transfer_id,
            failure_reason, required_action, attempts, paid_at
       from clonestore_pp_transfers where partner_id=$1 order by created_at desc limit 24`,
    [partnerId],
  );

  const flags = await tx.query<Record<string, unknown>>(
    `select id, kind, severity, explanation, status, created_at
       from clonestore_pp_risk_flags where partner_id=$1 order by created_at desc limit 50`,
    [partnerId],
  );

  const audit = await tx.query<Record<string, unknown>>(
    `select actor, action, reason, occurred_at from clonestore_pp_admin_audit
      where entity_id = $1 order by occurred_at desc limit 50`,
    [partnerId],
  );

  // Prochain versement estimé = ce qui est disponible aujourd'hui, sous les mêmes gardes.
  const blocked =
    partner.status !== "active" ? "Le cabinet n’est pas actif."
    : partner.connectState !== "ready" ? "Le compte Stripe Connect n’est pas prêt à recevoir."
    : partner.frozenMinor > 0 ? "Un litige gèle des commissions."
    : partner.availableMinor < partner.payoutThresholdMinor ? "Le seuil de versement n’est pas atteint."
    : null;

  const clientsTotalN = n(clientsTotal.rows[0]?.total);
  return {
    partner,
    onboarding: {
      contractAccepted: Boolean(pr.contract_accepted_at),
      contractAcceptedAt: (pr.contract_accepted_at as string | null) ?? null,
      connectState: partner.connectState,
      detailsSubmitted: pr.stripe_details_submitted === true,
      payoutsEnabled: pr.payouts_enabled === true,
      hasConnectedAccount: Boolean(pr.stripe_connected_account_id),
      requirementsDue,
      disabledReason: (pr.stripe_disabled_reason as string | null) ?? null,
      remainingSteps,
    },
    acquisition: {
      clicks: n(a.clicks),
      introductions: n(a.introductions),
      introductionsPending: n(a.intro_pending),
      introductionsMatched: n(a.intro_matched),
      prospectsSignedUp: n(a.prospects),
      attributionsPending: n(a.attr_pending),
      attributionsLocked: n(a.attr_locked),
      conflicts: n(a.conflicts),
      clientsLost: n(a.lost),
    },
    clients: {
      items: clients.rows.map((c) => ({
        id: String(c.id),
        companyLabel: (c.company_label as string | null) ?? null,
        status: String(c.status),
        stripeSubscriptionId: (c.stripe_subscription_id as string | null) ?? null,
        currency: String(c.currency ?? "eur"),
        firstPaymentAt: (c.first_payment_at as string | null) ?? null,
        lastPaymentAt: (c.last_payment_at as string | null) ?? null,
        commissionMinor: n(c.commission),
      })),
      total: clientsTotalN,
      limit: cp.limit,
      offset: cp.offset,
      hasMore: cp.offset + clients.rows.length < clientsTotalN,
    },
    nextPayout: {
      estimatedMinor: blocked ? 0 : partner.availableMinor,
      thresholdMinor: partner.payoutThresholdMinor,
      thresholdReached: partner.availableMinor >= partner.payoutThresholdMinor,
      blockedReason: blocked,
    },
    transfers: transfers.rows.map((t) => ({
      id: String(t.id),
      periodStart: String(t.period_start),
      periodEnd: String(t.period_end),
      amountMinor: n(t.amount_minor),
      currency: String(t.currency ?? "eur"),
      status: String(t.status),
      stripeTransferId: (t.stripe_transfer_id as string | null) ?? null,
      failureReason: (t.failure_reason as string | null) ?? null,
      requiredAction: (t.required_action as string | null) ?? null,
      attempts: n(t.attempts),
      paidAt: (t.paid_at as string | null) ?? null,
    })),
    riskFlags: flags.rows.map((f) => ({
      id: String(f.id), kind: String(f.kind), severity: String(f.severity),
      explanation: String(f.explanation), status: String(f.status), createdAt: String(f.created_at),
    })),
    audit: audit.rows.map((x) => ({
      actor: String(x.actor), action: String(x.action), reason: String(x.reason), occurredAt: String(x.occurred_at),
    })),
  };
}
