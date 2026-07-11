// Programme partenaires — moteur de COMMISSIONS piloté par des événements Stripe SIGNÉS.
// La commission n'est créée qu'après une facture RÉELLEMENT PAYÉE (invoice.paid, montant > 0).
// Base = HT réellement encaissé (hors TVA, après remises). Remboursement = écriture
// compensatoire (reversal). Litige = gel. Ledger append-only, montants en centimes entiers.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getPartnerById } from "./partners";
import { lockAttributionOnFirstPayment } from "./attribution";
import { enqueuePartnerEmailTx } from "./emails";
import {
  eligibleNetFromInvoice,
  commissionDeltaMinor,
  refundEligibleNetMinor,
  formatMinorAmount,
} from "../money";

// ── Ledger d'idempotence des events Stripe du programme ──────────────────────

/** Insère (une fois) un receipt d'event. fresh=false si déjà vu (idempotence). */
async function recordStripeEvent(
  tx: SqlExecutor,
  e: { eventId: string; type: string; objectId: string | null; livemode: boolean; eventCreated: number | null },
): Promise<{ fresh: boolean }> {
  const { rows } = await tx.query<{ id: number }>(
    `insert into clonestore_pp_stripe_events (stripe_event_id, type, object_id, livemode, event_created_at, processing_result, attempts)
     values ($1,$2,$3,$4, to_timestamp($5), 'pending', 1)
     on conflict (stripe_event_id) do nothing returning id`,
    [e.eventId, e.type, e.objectId, e.livemode, e.eventCreated ?? 0],
  );
  return { fresh: rows.length > 0 };
}

async function finishStripeEvent(tx: SqlExecutor, eventId: string, result: "applied" | "ignored" | "failed", reason?: string): Promise<void> {
  await tx.query(
    `update clonestore_pp_stripe_events set processing_result=$2, ignored_reason=$3, processed_at=now(), updated_at=now() where stripe_event_id=$1`,
    [eventId, result, reason ?? null],
  );
}

// ── Événement normalisé (sans secret) consommé par le moteur ─────────────────

export type PartnerCommercialEvent = {
  eventId: string;
  type: string;
  livemode: boolean;
  eventCreated: number | null;
  subscriptionId: string | null;
  customerId: string | null;
  // user du prospect (résolu depuis la metadata de l'abonnement par le pont webhook)
  subjectUserId: string | null;
  // invoice.paid
  invoiceId?: string | null;
  paymentIntentId?: string | null;
  totalMinor?: number;
  taxMinor?: number;
  totalExcludingTaxMinor?: number | null;
  amountPaidMinor?: number;
  currency?: string | null;
  companyLabel?: string | null;
  // charge.refunded
  refundTtcMinor?: number; // CUMUL remboursé (absolu) pour le payment_intent
  // dispute
  disputeResolved?: "won" | "lost";
};

// ── Entrées ledger ────────────────────────────────────────────────────────────

async function insertEntry(
  tx: SqlExecutor,
  e: {
    partnerId: string; attributionId: string | null; customerId: string | null; subjectUserId: string | null;
    stripeCustomerId: string | null; stripeSubscriptionId: string | null; stripeInvoiceId: string; stripePaymentIntentId: string | null;
    stripeEventId: string | null; stripeMode: "test" | "live"; currency: string;
    invoiceTotalMinor: number; invoiceTaxMinor: number; eligibleNetMinor: number; rateBps: number; commissionMinor: number;
    entryType: "commission" | "reversal" | "adjustment"; status: "pending" | "frozen"; availableAt: string; reason?: string | null; reversalOfId?: string | null;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into clonestore_pp_commission_entries
       (partner_id, attribution_id, customer_id, subject_user_id, stripe_customer_id, stripe_subscription_id,
        stripe_invoice_id, stripe_payment_intent_id, stripe_event_id, stripe_mode, currency,
        invoice_total_minor, invoice_tax_minor, eligible_net_minor, rate_bps, commission_minor,
        entry_type, status, available_at, reason, reversal_of_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     returning id`,
    [
      e.partnerId, e.attributionId, e.customerId, e.subjectUserId, e.stripeCustomerId, e.stripeSubscriptionId,
      e.stripeInvoiceId, e.stripePaymentIntentId, e.stripeEventId, e.stripeMode, e.currency,
      e.invoiceTotalMinor, e.invoiceTaxMinor, e.eligibleNetMinor, e.rateBps, e.commissionMinor,
      e.entryType, e.status, e.availableAt, e.reason ?? null, e.reversalOfId ?? null,
    ],
  );
  return rows[0].id;
}

async function recordCommissionEvent(
  tx: SqlExecutor,
  e: { entryId: string | null; partnerId: string; type: string; fromStatus?: string | null; toStatus?: string | null; reason?: string; evidence?: unknown },
): Promise<void> {
  await tx.query(
    `insert into clonestore_pp_commission_events (entry_id, partner_id, type, from_status, to_status, reason, evidence_safe)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [e.entryId, e.partnerId, e.type, e.fromStatus ?? null, e.toStatus ?? null, e.reason ?? null, JSON.stringify(e.evidence ?? {})],
  );
}

function reserveAvailableAt(reserveDays: number): string {
  return new Date(Date.now() + reserveDays * 24 * 60 * 60 * 1000).toISOString();
}

// ── Machine principale ────────────────────────────────────────────────────────

export type ApplyOutcome = { applied: boolean; reason: string; commissionMinor?: number };

/**
 * Applique un événement commercial Stripe au ledger de commissions (idempotent par event).
 * invoice.paid → commission ; charge.refunded → reversal ; dispute.created → gel ;
 * dispute.closed(won) → dégel.
 */
export async function applyPartnerCommercialEvent(tx: SqlExecutor, ev: PartnerCommercialEvent): Promise<ApplyOutcome> {
  const objectId = ev.invoiceId ?? ev.subscriptionId ?? ev.paymentIntentId ?? null;
  const { fresh } = await recordStripeEvent(tx, { eventId: ev.eventId, type: ev.type, objectId, livemode: ev.livemode, eventCreated: ev.eventCreated });
  if (!fresh) return { applied: false, reason: "duplicate_event" };

  try {
    let outcome: ApplyOutcome;
    switch (ev.type) {
      case "invoice.paid":
      case "invoice.payment_succeeded":
        outcome = await onInvoicePaid(tx, ev);
        break;
      case "charge.refunded":
        outcome = await onRefund(tx, ev);
        break;
      case "charge.dispute.created":
        outcome = await onDisputeOpened(tx, ev);
        break;
      case "charge.dispute.closed":
        outcome = await onDisputeClosed(tx, ev);
        break;
      default:
        outcome = { applied: false, reason: "unsupported_type" };
    }
    await finishStripeEvent(tx, ev.eventId, outcome.applied ? "applied" : "ignored", outcome.reason);
    return outcome;
  } catch (err) {
    await finishStripeEvent(tx, ev.eventId, "failed", err instanceof Error ? err.message.slice(0, 200) : "error");
    throw err;
  }
}

async function onInvoicePaid(tx: SqlExecutor, ev: PartnerCommercialEvent): Promise<ApplyOutcome> {
  if (!ev.invoiceId || !ev.subjectUserId) return { applied: false, reason: "missing_invoice_or_user" };
  if ((ev.amountPaidMinor ?? 0) <= 0) return { applied: false, reason: "invoice_not_collected" };

  // Verrouille l'attribution à la 1ʳᵉ facture payée (idempotent) + crée la relation client.
  const lock = await lockAttributionOnFirstPayment(tx, {
    subjectUserId: ev.subjectUserId, stripeEventId: ev.eventId,
    stripeCustomerId: ev.customerId, stripeSubscriptionId: ev.subscriptionId, companyLabel: ev.companyLabel ?? null,
  });
  if (!lock.ok) return { applied: false, reason: lock.error };

  const partner = await getPartnerById(tx, lock.partnerId);
  if (!partner) return { applied: false, reason: "partner_missing" };
  if (partner.status === "suspended" || partner.status === "archived") return { applied: false, reason: "partner_inactive" };

  // Une seule écriture 'commission' par facture (index unique) — anti double-crédit.
  const dup = await tx.query(
    `select 1 from clonestore_pp_commission_entries where stripe_invoice_id = $1 and entry_type = 'commission' and status <> 'void' limit 1`,
    [ev.invoiceId],
  );
  if (dup.rows.length) return { applied: false, reason: "commission_exists" };

  const eligibleNet = eligibleNetFromInvoice({
    totalMinor: ev.totalMinor ?? 0,
    taxMinor: ev.taxMinor ?? 0,
    totalExcludingTaxMinor: ev.totalExcludingTaxMinor ?? null,
    amountPaidMinor: ev.amountPaidMinor ?? 0,
  });
  const commissionMinor = commissionDeltaMinor({ eligibleNetTotalMinor: eligibleNet, rateBps: partner.commission_rate_bps, alreadyWrittenMinor: 0 });
  if (commissionMinor <= 0) return { applied: false, reason: "zero_commission" };

  const customerRow = await tx.query<{ id: string }>(
    `select id from clonestore_pp_customers where subject_user_id = $1 order by started_at desc limit 1`,
    [ev.subjectUserId],
  );

  const entryId = await insertEntry(tx, {
    partnerId: partner.id, attributionId: lock.attributionId, customerId: customerRow.rows[0]?.id ?? null, subjectUserId: ev.subjectUserId,
    stripeCustomerId: ev.customerId, stripeSubscriptionId: ev.subscriptionId, stripeInvoiceId: ev.invoiceId, stripePaymentIntentId: ev.paymentIntentId ?? null,
    stripeEventId: ev.eventId, stripeMode: ev.livemode ? "live" : "test", currency: (ev.currency ?? partner.payout_currency).toLowerCase(),
    invoiceTotalMinor: ev.totalMinor ?? 0, invoiceTaxMinor: ev.taxMinor ?? 0, eligibleNetMinor: eligibleNet, rateBps: partner.commission_rate_bps, commissionMinor,
    entryType: "commission", status: "pending", availableAt: reserveAvailableAt(partner.reserve_days),
  });
  await recordCommissionEvent(tx, { entryId, partnerId: partner.id, type: "commission_recorded", toStatus: "pending", reason: `facture ${ev.invoiceId}`, evidence: { eligibleNet, commissionMinor, rateBps: partner.commission_rate_bps } });
  await enqueuePartnerEmailTx(tx, {
    partnerId: partner.id, kind: "commission_recorded", toEmail: partner.email_normalized,
    idempotencyKey: `pp-email:commission_recorded:${entryId}`,
    payload: { amount: formatMinorAmount(commissionMinor, (ev.currency ?? partner.payout_currency)) },
  });
  return { applied: true, reason: "commission_recorded", commissionMinor };
}

async function onRefund(tx: SqlExecutor, ev: PartnerCommercialEvent): Promise<ApplyOutcome> {
  if (!ev.paymentIntentId) return { applied: false, reason: "missing_payment_intent" };
  // Écritures existantes de la facture rattachée à ce payment_intent.
  const entries = await tx.query<{ id: string; partner_id: string; stripe_invoice_id: string; currency: string; rate_bps: number; invoice_total_minor: number; eligible_net_minor: number; commission_minor: number; entry_type: string; status: string; available_at: string; reserve_ref: string | null }>(
    `select id, partner_id, stripe_invoice_id, currency, rate_bps, invoice_total_minor, eligible_net_minor, commission_minor, entry_type, status, available_at, null as reserve_ref
     from clonestore_pp_commission_entries where stripe_payment_intent_id = $1 order by created_at asc`,
    [ev.paymentIntentId],
  );
  if (!entries.rows.length) return { applied: false, reason: "no_entries_for_refund" };

  const base = entries.rows.find((r) => r.entry_type === "commission");
  if (!base) return { applied: false, reason: "no_commission_base" };

  const invoiceTotal = base.invoice_total_minor;
  const originalEligibleNet = base.eligible_net_minor;
  // Base HT nette déjà reversée (somme des reversals, en valeur absolue de eligible_net).
  const alreadyReversedNet = entries.rows.filter((r) => r.entry_type === "reversal").reduce((s, r) => s + Math.abs(r.eligible_net_minor), 0);
  const remainingNet = Math.max(0, originalEligibleNet - alreadyReversedNet);

  // Part HT du remboursement (au prorata TTC → HT), bornée par le reste.
  const refundNet = refundEligibleNetMinor({
    refundTtcMinor: ev.refundTtcMinor ?? 0,
    invoiceTotalMinor: invoiceTotal,
    invoiceEligibleNetMinor: originalEligibleNet,
    remainingEligibleNetMinor: remainingNet,
  });
  if (refundNet <= 0) return { applied: false, reason: "zero_refund_net" };

  // Cible cumulée après remboursement.
  const newTotalNet = originalEligibleNet - alreadyReversedNet - refundNet;
  const alreadyWrittenCommission = entries.rows.reduce((s, r) => s + r.commission_minor, 0);
  const delta = commissionDeltaMinor({ eligibleNetTotalMinor: newTotalNet, rateBps: base.rate_bps, alreadyWrittenMinor: alreadyWrittenCommission });
  if (delta >= 0) return { applied: false, reason: "no_negative_delta" };

  const entryId = await insertEntry(tx, {
    partnerId: base.partner_id, attributionId: null, customerId: null, subjectUserId: null,
    stripeCustomerId: null, stripeSubscriptionId: null, stripeInvoiceId: base.stripe_invoice_id, stripePaymentIntentId: ev.paymentIntentId,
    stripeEventId: ev.eventId, stripeMode: ev.livemode ? "live" : "test", currency: base.currency,
    invoiceTotalMinor: invoiceTotal, invoiceTaxMinor: 0, eligibleNetMinor: -refundNet, rateBps: base.rate_bps, commissionMinor: delta,
    entryType: "reversal", status: "pending", availableAt: reserveAvailableAt(0), reversalOfId: base.id, reason: "remboursement",
  });
  await recordCommissionEvent(tx, { entryId, partnerId: base.partner_id, type: "reversal_recorded", toStatus: "pending", reason: `remboursement ${ev.paymentIntentId}`, evidence: { refundNet, delta } });
  return { applied: true, reason: "reversal_recorded", commissionMinor: delta };
}

async function onDisputeOpened(tx: SqlExecutor, ev: PartnerCommercialEvent): Promise<ApplyOutcome> {
  if (!ev.paymentIntentId) return { applied: false, reason: "missing_payment_intent" };
  const res = await tx.query<{ id: string; partner_id: string }>(
    `update clonestore_pp_commission_entries set status='frozen', frozen_reason='dispute', updated_at=now()
     where stripe_payment_intent_id = $1 and status in ('pending','available') returning id, partner_id`,
    [ev.paymentIntentId],
  );
  for (const r of res.rows) await recordCommissionEvent(tx, { entryId: r.id, partnerId: r.partner_id, type: "entry_frozen", toStatus: "frozen", reason: `litige ${ev.paymentIntentId}` });
  return { applied: res.rows.length > 0, reason: res.rows.length ? "frozen" : "no_entries" };
}

async function onDisputeClosed(tx: SqlExecutor, ev: PartnerCommercialEvent): Promise<ApplyOutcome> {
  if (!ev.paymentIntentId) return { applied: false, reason: "missing_payment_intent" };
  if (ev.disputeResolved === "lost") {
    // Litige perdu : reversal total des commissions gelées liées (compensation).
    const frozen = await tx.query<{ id: string; partner_id: string; stripe_invoice_id: string; currency: string; rate_bps: number; commission_minor: number; eligible_net_minor: number; invoice_total_minor: number }>(
      `select id, partner_id, stripe_invoice_id, currency, rate_bps, commission_minor, eligible_net_minor, invoice_total_minor
       from clonestore_pp_commission_entries where stripe_payment_intent_id = $1 and entry_type='commission' and status='frozen'`,
      [ev.paymentIntentId],
    );
    for (const r of frozen.rows) {
      const entryId = await insertEntry(tx, {
        partnerId: r.partner_id, attributionId: null, customerId: null, subjectUserId: null,
        stripeCustomerId: null, stripeSubscriptionId: null, stripeInvoiceId: r.stripe_invoice_id, stripePaymentIntentId: ev.paymentIntentId,
        stripeEventId: ev.eventId, stripeMode: ev.livemode ? "live" : "test", currency: r.currency,
        invoiceTotalMinor: r.invoice_total_minor, invoiceTaxMinor: 0, eligibleNetMinor: -r.eligible_net_minor, rateBps: r.rate_bps, commissionMinor: -r.commission_minor,
        entryType: "reversal", status: "pending", availableAt: reserveAvailableAt(0), reversalOfId: r.id, reason: "litige perdu",
      });
      await recordCommissionEvent(tx, { entryId, partnerId: r.partner_id, type: "reversal_recorded", toStatus: "pending", reason: `litige perdu ${ev.paymentIntentId}` });
    }
    return { applied: frozen.rows.length > 0, reason: "dispute_lost_reversed" };
  }
  // Litige gagné : dégel.
  const res = await tx.query<{ id: string; partner_id: string }>(
    `update clonestore_pp_commission_entries set status='pending', frozen_reason=null, updated_at=now()
     where stripe_payment_intent_id = $1 and status='frozen' returning id, partner_id`,
    [ev.paymentIntentId],
  );
  for (const r of res.rows) await recordCommissionEvent(tx, { entryId: r.id, partnerId: r.partner_id, type: "entry_unfrozen", toStatus: "pending", reason: `litige gagné ${ev.paymentIntentId}` });
  return { applied: res.rows.length > 0, reason: res.rows.length ? "dispute_won_unfrozen" : "no_entries" };
}
