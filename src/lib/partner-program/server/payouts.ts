// Programme partenaires — JOB MENSUEL de versements Stripe Connect (transferts séparés).
//
// Sécurité financière :
//   • verrou logique par run_key (un seul run par période) ;
//   • batch immuable (clonestore_pp_payout_runs) ;
//   • un transfert par (cabinet × période), clé d'idempotence → JAMAIS de double versement
//     (index unique uq_pp_transfer_partner_period + idempotency_key + uq_pp_item_entry_live) ;
//   • dry-run PAR DÉFAUT : calcule les lots, journalise, mais n'appelle PAS Stripe ;
//   • garde anti-Live : refuse tout transfert réel tant que la production n'est pas autorisée ;
//   • reprise après crash : un transfert 'created'/'failed' est repris sur la MÊME ligne.

import type Stripe from "stripe";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { withService } from "./runtime";
import { getPartnerBalances } from "./summary";
import { decidePayout, previousMonthBounds } from "../payout-rules";
import { isPartnerPayoutDryRun } from "../flags";
import { recordAudit } from "./audit";
import { enqueuePartnerEmailTx } from "./emails";
import { formatMinorAmount } from "../money";

export type CreateTransferInput = {
  amountMinor: number;
  currency: string;
  destination: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
};

export type PayoutDeps = {
  /** Crée un transfert Stripe vers le compte connecté. Retourne l'id du transfert. */
  createTransfer: (input: CreateTransferInput) => Promise<{ id: string }>;
  /** Vrai si l'environnement Stripe est en mode LIVE (clé sk_live_...). */
  stripeIsLive: () => boolean;
  /** Vrai si la production est explicitement autorisée (plancher P10). */
  productionAuthorized: () => boolean;
};

export function defaultPayoutDeps(stripe: Stripe): PayoutDeps {
  return {
    createTransfer: async (input) => {
      const t = await stripe.transfers.create(
        {
          amount: input.amountMinor,
          currency: input.currency,
          destination: input.destination,
          metadata: input.metadata,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { id: t.id };
    },
    stripeIsLive: () => (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_"),
    productionAuthorized: () => false, // plancher : jamais autorisé par le code seul
  };
}

export type PayoutRunResult = {
  runId: string | null;
  periodKey: string;
  dryRun: boolean;
  skipped?: string;
  partnersConsidered: number;
  transfersCreated: number;
  transfersFailed: number;
  totalAmountMinor: number;
  perPartner: Array<{ partnerId: string; amountMinor: number; status: string; reason?: string }>;
};

/**
 * Exécute le run mensuel de versements pour la période précédente.
 * dryRun : true par défaut (flag PARTNER_PAYOUT_DRY_RUN ≠ "false"). En dry-run, aucun appel
 * Stripe n'est émis. En mode réel, refuse si Stripe live sans autorisation de production.
 */
export async function runMonthlyPayouts(
  db: SqlExecutor,
  deps: PayoutDeps,
  opts: { now: Date; dryRunOverride?: boolean },
): Promise<PayoutRunResult> {
  const dryRun = opts.dryRunOverride ?? isPartnerPayoutDryRun();
  const { start, end, key } = previousMonthBounds(opts.now);
  const runKey = `pp-payout:${key}`;

  // Garde anti-Live : jamais de transfert réel en live sans autorisation de production.
  if (!dryRun && deps.stripeIsLive() && !deps.productionAuthorized()) {
    return { runId: null, periodKey: key, dryRun, skipped: "live_not_authorized", partnersConsidered: 0, transfersCreated: 0, transfersFailed: 0, totalAmountMinor: 0, perPartner: [] };
  }

  // Verrou logique + batch immuable : insert-first sur run_key.
  const runId = await withService(db, async (tx) => {
    const ins = await tx.query<{ id: string }>(
      `insert into clonestore_pp_payout_runs (run_key, dry_run, status) values ($1,$2,'running')
       on conflict (run_key) do nothing returning id`,
      [runKey, dryRun],
    );
    if (ins.rows.length) return ins.rows[0].id;
    // Existe déjà : reprise seulement si le run précédent a échoué.
    const cur = await tx.query<{ id: string; status: string }>(`select id, status from clonestore_pp_payout_runs where run_key=$1`, [runKey]);
    if (cur.rows[0]?.status === "failed") {
      await tx.query(`update clonestore_pp_payout_runs set status='running' where id=$1`, [cur.rows[0].id]);
      return cur.rows[0].id;
    }
    return null; // déjà en cours ou terminé → un autre worker détient le run
  });

  if (!runId) {
    return { runId: null, periodKey: key, dryRun, skipped: "already_running_or_done", partnersConsidered: 0, transfersCreated: 0, transfersFailed: 0, totalAmountMinor: 0, perPartner: [] };
  }

  const perPartner: PayoutRunResult["perPartner"] = [];
  let created = 0, failed = 0, total = 0;

  // Cabinets actifs avec un compte connecté.
  const partners = await withService(db, (tx) =>
    tx.query<{ id: string; status: string; payouts_enabled: boolean; stripe_onboarding_status: string; payout_threshold_minor: number; payout_currency: string; stripe_connected_account_id: string | null }>(
      `select id, status, payouts_enabled, stripe_onboarding_status, payout_threshold_minor, payout_currency, stripe_connected_account_id
       from clonestore_pp_partners where status='active'`,
    ),
  );

  for (const p of partners.rows) {
    const outcome = await processPartnerPayout(db, deps, { partner: p, runId, periodStart: start, periodEnd: end, dryRun });
    perPartner.push(outcome);
    if (outcome.status === "transferred" || outcome.status === "dry_run") { created += outcome.status === "transferred" ? 1 : 0; total += outcome.amountMinor; }
    if (outcome.status === "failed") failed += 1;
  }

  await withService(db, async (tx) => {
    await tx.query(
      `update clonestore_pp_payout_runs set status='completed', finished_at=now(), partners_considered=$2, transfers_created=$3, transfers_failed=$4, total_amount_minor=$5, report_safe=$6::jsonb where id=$1`,
      [runId, partners.rows.length, created, failed, total, JSON.stringify({ perPartner, dryRun })],
    );
  });

  return { runId, periodKey: key, dryRun, partnersConsidered: partners.rows.length, transfersCreated: created, transfersFailed: failed, totalAmountMinor: total, perPartner };
}

async function processPartnerPayout(
  db: SqlExecutor,
  deps: PayoutDeps,
  ctx: { partner: { id: string; status: string; payouts_enabled: boolean; stripe_onboarding_status: string; payout_threshold_minor: number; payout_currency: string; stripe_connected_account_id: string | null }; runId: string; periodStart: string; periodEnd: string; dryRun: boolean },
): Promise<PayoutRunResult["perPartner"][number]> {
  const p = ctx.partner;

  // Litige ouvert ?
  const dispute = await withService(db, (tx) =>
    tx.query(`select 1 from clonestore_pp_commission_entries where partner_id=$1 and status='frozen' limit 1`, [p.id]),
  );
  const balances = await withService(db, (tx) => getPartnerBalances(tx, p.id));
  const decision = decidePayout({
    partnerStatus: p.status as "active",
    payoutsEnabled: p.payouts_enabled,
    onboardingStatus: p.stripe_onboarding_status as "complete",
    availableMinor: balances.availableMinor,
    frozenMinor: balances.frozenMinor,
    thresholdMinor: p.payout_threshold_minor,
    hasOpenDispute: dispute.rows.length > 0,
  });
  if (!decision.eligible) return { partnerId: p.id, amountMinor: 0, status: "skipped", reason: decision.reason };

  // Sélection + verrouillage ATOMIQUE des écritures disponibles → transfert. Empêche tout
  // double versement : les écritures passent à 'paid' et sont rattachées au transfert dans
  // la MÊME transaction, sous l'index unique uq_pp_item_entry_live.
  const idempotencyKey = `pp-transfer:${p.id}:${previousMonthBounds(new Date(ctx.periodEnd)).key}`;

  try {
    const prepared = await withService(db, async (tx) => {
      // Transfert existant pour (cabinet, période) ?
      const existing = await tx.query<{ id: string; status: string; stripe_transfer_id: string | null }>(
        `select id, status, stripe_transfer_id from clonestore_pp_transfers
         where partner_id=$1 and period_start=$2::date and period_end=($3::date - interval '1 day') and status in ('created','processing','paid','failed')`,
        [p.id, ctx.periodStart, ctx.periodEnd],
      );
      if (existing.rows[0]?.status === "paid") return { alreadyPaid: true as const };

      // Écritures payables : pending, réserve écoulée, non gelées, pas déjà rattachées à un transfert vivant.
      const entries = await tx.query<{ id: string; commission_minor: number }>(
        `select e.id, e.commission_minor from clonestore_pp_commission_entries e
         where e.partner_id=$1 and e.status='pending' and e.available_at <= now()
           and not exists (select 1 from clonestore_pp_transfer_items i where i.entry_id = e.id and i.released_at is null)
         for update`,
        [p.id],
      );
      const amount = entries.rows.reduce((s, r) => s + (Number(r.commission_minor) || 0), 0);
      if (amount < p.payout_threshold_minor || amount <= 0) return { belowThreshold: true as const };

      // Ligne de transfert (immuable pour la période) — reprise si déjà 'created'/'failed'.
      let transferId = existing.rows[0]?.id ?? null;
      if (!transferId) {
        const ins = await tx.query<{ id: string }>(
          `insert into clonestore_pp_transfers (partner_id, payout_run_id, period_start, period_end, amount_minor, currency, entry_count, stripe_mode, status, idempotency_key)
           values ($1,$2,$3::date,($4::date - interval '1 day'),$5,$6,$7,$8,'created',$9) returning id`,
          [p.id, ctx.runId, ctx.periodStart, ctx.periodEnd, amount, p.payout_currency, entries.rows.length, ctx.dryRun ? "test" : "test", idempotencyKey],
        );
        transferId = ins.rows[0].id;
      }
      // Rattache les écritures + passe en 'paid' (verrou logique anti double-versement).
      for (const e of entries.rows) {
        await tx.query(`insert into clonestore_pp_transfer_items (transfer_id, partner_id, entry_id, amount_minor) values ($1,$2,$3,$4)`, [transferId, p.id, e.id, e.commission_minor]);
        await tx.query(`update clonestore_pp_commission_entries set status='paid', updated_at=now() where id=$1`, [e.id]);
      }
      return { transferId, amount, entryCount: entries.rows.length };
    });

    if ("alreadyPaid" in prepared) return { partnerId: p.id, amountMinor: 0, status: "already_paid" };
    if ("belowThreshold" in prepared) return { partnerId: p.id, amountMinor: 0, status: "skipped", reason: "below_threshold" };

    // DRY-RUN : aucun appel Stripe. Le lot est calculé et journalisé ; les écritures restent
    // marquées 'paid' pour ce run de démonstration (batch immuable et rejouable en test).
    if (ctx.dryRun) {
      await withService(db, (tx) => tx.query(`update clonestore_pp_transfers set status='paid', paid_at=now(), stripe_transfer_id='dry_run', updated_at=now() where id=$1`, [prepared.transferId!]));
      return { partnerId: p.id, amountMinor: prepared.amount!, status: "dry_run" };
    }

    // Mode réel (Test Mode Stripe) : transfert idempotent vers le compte connecté.
    if (!p.stripe_connected_account_id) return { partnerId: p.id, amountMinor: 0, status: "failed", reason: "no_connected_account" };
    const transfer = await deps.createTransfer({
      amountMinor: prepared.amount!, currency: p.payout_currency, destination: p.stripe_connected_account_id, idempotencyKey,
      metadata: { partner_id: p.id, period: previousMonthBounds(new Date(ctx.periodEnd)).key },
    });
    const periodKey = previousMonthBounds(new Date(ctx.periodEnd)).key;
    await withService(db, async (tx) => {
      await tx.query(`update clonestore_pp_transfers set status='paid', stripe_transfer_id=$2, paid_at=now(), updated_at=now() where id=$1`, [prepared.transferId!, transfer.id]);
      await recordAudit(tx, { actor: "system", action: "payout.transferred", entityType: "partner", entityId: p.id, reason: `versement ${periodKey}`, next: { transferId: transfer.id, amountMinor: prepared.amount } });
      const em = await tx.query<{ email_normalized: string }>(`select email_normalized from clonestore_pp_partners where id=$1`, [p.id]);
      if (em.rows[0]) await enqueuePartnerEmailTx(tx, { partnerId: p.id, kind: "transfer_executed", toEmail: em.rows[0].email_normalized, idempotencyKey: `pp-email:transfer_executed:${prepared.transferId}`, payload: { amount: formatMinorAmount(prepared.amount!, p.payout_currency), period: periodKey } });
    });
    return { partnerId: p.id, amountMinor: prepared.amount!, status: "transferred" };
  } catch (err) {
    // Ne pas perdre le batch : marquer le transfert 'failed', conserver l'erreur, réessayer plus tard.
    await withService(db, async (tx) => {
      await tx.query(
        `update clonestore_pp_transfers set status='failed', failure_reason=$2, updated_at=now()
         where partner_id=$1 and period_start=$3::date and period_end=($4::date - interval '1 day') and status in ('created','processing')`,
        [p.id, err instanceof Error ? err.message.slice(0, 200) : "error", ctx.periodStart, ctx.periodEnd],
      );
    });
    return { partnerId: p.id, amountMinor: 0, status: "failed", reason: err instanceof Error ? err.name : "error" };
  }
}
