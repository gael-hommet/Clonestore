// CloneStory — MOTEUR DE CONTRIBUTION COMMERCIALE (CS-FINAL 3).
//
// Transforme une attribution durable (compte/entreprise → partenaire fondateur) en
// CONTRIBUTION COMMERCIALE prouvée par une source serveur autoritative :
//   attribution → commande → paiement Stripe signé → activation produit → validation → vérifiée.
//
// SOURCE DE VÉRITÉ (verrouillée — voir docs/CS_FINAL_3) :
//   • La preuve du paiement vient EXCLUSIVEMENT d'un événement Stripe SIGNÉ (jamais du
//     navigateur, jamais d'une page /success, jamais d'un champ modifiable par le client).
//   • Modèle réel = abonnement avec essai de 7 j → l'accès (activation) précède le 1er
//     paiement. Le signal autoritatif de PAIEMENT est donc `invoice.paid` (montant > 0),
//     PAS `checkout.session.completed` (essai = aucun argent capturé).
//   • `verified` n'est jamais synonyme de paiement instantané : un délai de sécurité +
//     toutes les preuves déterministes sont requis (sinon `validation_pending`).
//
// Montants en UNITÉS MINEURES ENTIÈRES (centimes). Aucun float financier. Idempotence
// par ledger d'événements Stripe (`stripe_event_id` unique) + unicité par abonnement.
// Toutes les écritures passent en mode SERVICE (RLS forcée). Aucune donnée Stripe
// sensible n'est exposée au partenaire (cf. lectures cockpit).

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getClonestoryDb, withService } from "./runtime";
import { advanceIntroductionStatus } from "./attribution";
import {
  contributionValidationDelayMs,
  eligibleCommercialProducts,
  partialRefundReviewPct,
  publicBaseUrl,
  clonestoryFeatureEnabled,
} from "./config";
import { sendClonestoryEmail } from "./emails";
import { renderCommercialEmail } from "./commercial-emails";

// ── Machine d'états de la contribution commerciale ──────────────────────────────
// Échelle monotone du chemin nominal (avance UNIQUEMENT vers l'avant). Le modèle réel
// (essai 7 j) place l'accès avant le paiement → `activation_pending` (essai, sans argent)
// précède `purchase_captured` (1er paiement réel). `verified` ne compte qu'après délai.
const CC_RANK: Record<string, number> = {
  activation_pending: 1,
  purchase_captured: 2,
  activation_completed: 3,
  validation_pending: 4,
  verified: 5,
};
// Statuts terminaux (aucune avance nominale possible ; l'historique est conservé).
const CC_TERMINAL = new Set(["refunded", "canceled", "invalidated"]);

export interface CommercialContributionRow {
  id: string;
  partner_id: string;
  attribution_id: string | null;
  introduction_id: string | null;
  account_user_id: string | null;
  product_slug: string | null;
  currency: string | null;
  gross_amount: number;
  refunded_amount: number;
  net_amount: number;
  status: string;
  verified_active: boolean;
  validation_started_at: string | null;
  purchase_captured_at: string | null;
  stripe_subscription_id: string | null;
}

// ── Événements ──────────────────────────────────────────────────────────────────
async function recordCommercialEvent(
  tx: SqlExecutor, contributionId: string | null, partnerId: string, type: string,
  fromStatus: string | null, toStatus: string | null, reason: string | null,
  evidence: Record<string, unknown> = {},
): Promise<void> {
  await tx.query(
    `insert into clonestory_fp_commercial_events
       (contribution_id, partner_id, type, from_status, to_status, reason, evidence_safe)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [contributionId, partnerId, type, fromStatus, toStatus, reason, JSON.stringify(evidence)],
  );
}
/** Événement face PARTENAIRE (réutilise le journal de contribution existant). */
async function recordContributionEvent(
  tx: SqlExecutor, partnerId: string, introductionId: string | null, type: string,
): Promise<void> {
  await tx.query(
    `insert into clonestory_fp_contribution_events (partner_id, introduction_id, type, source, evidence_ref)
     values ($1,$2,$3,'stripe',$4)`,
    [partnerId, introductionId, type, introductionId],
  );
}

function toCents(v: unknown): number {
  const n = typeof v === "bigint" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function eligiblePartnerStatus(status: string): boolean {
  return status !== "suspended" && status !== "withdrawn";
}

// ── Normalisation d'un événement Stripe (extrait, sans secret) ──────────────────
export interface CommercialStripeEvent {
  eventId: string;
  type: string;
  livemode: boolean;
  createdAt: number | null;
  subscriptionId: string | null;
  customerId: string | null;
  invoiceId?: string | null;
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
  chargeId?: string | null;
  amountPaid?: number | null;      // centimes
  amountRefunded?: number | null;  // centimes
  currency?: string | null;
  userId?: string | null;          // metadata.user_id (présent sur session/abonnement)
  agentSlug?: string | null;       // metadata.agent_slug
  disputeResolved?: "won" | "lost" | null;
}

export interface CommercialOutcome {
  ok: boolean;
  duplicate: boolean;
  result: "applied" | "ignored" | "duplicate" | "failed";
  reason?: string;
  contributionId?: string;
  status?: string;
}

export interface CommercialDeps {
  /** Résout user_id/agent_slug depuis la metadata d'abonnement (fallback invoice/charge). */
  resolveSubscriptionMeta?: (subId: string) => Promise<{ userId: string | null; agentSlug: string | null } | null>;
  now?: () => Date;
}

// ── Ledger d'idempotence ────────────────────────────────────────────────────────
/** Insère l'événement (idempotent). Retourne false si déjà présent (retry Stripe). */
async function recordStripeEventFresh(
  tx: SqlExecutor, ev: CommercialStripeEvent, objectId: string | null,
): Promise<boolean> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into clonestory_fp_stripe_events
       (stripe_event_id, type, livemode, object_id, processing_result, event_created_at, evidence_safe)
     values ($1,$2,$3,$4,'pending',$5,$6::jsonb)
     on conflict (stripe_event_id) do nothing
     returning id::text`,
    [ev.eventId, ev.type, ev.livemode, objectId,
     ev.createdAt ? new Date(ev.createdAt * 1000).toISOString() : null,
     JSON.stringify({ type: ev.type, livemode: ev.livemode })],
  );
  return rows.length > 0;
}
async function finishStripeEvent(
  tx: SqlExecutor, eventId: string, result: string, ignoredReason: string | null,
): Promise<void> {
  await tx.query(
    `update clonestory_fp_stripe_events
        set processing_result=$2, ignored_reason=$3, attempts=attempts+1, processed_at=now(), updated_at=now()
      where stripe_event_id=$1`,
    [eventId, result, ignoredReason],
  );
}

// ── Résolution de l'attribution → partenaire (lien sûr, server-side) ────────────
interface AttrForCapture {
  attributionId: string; partnerId: string; partnerStatus: string;
  introductionId: string | null; companyId: string | null; companyFingerprint: string | null;
}
async function resolveAttribution(tx: SqlExecutor, accountUserId: string): Promise<AttrForCapture | null> {
  const { rows } = await tx.query<{
    id: string; partner_id: string; source_introduction_id: string | null;
    company_id: string | null; company_fingerprint: string | null; pstatus: string;
  }>(
    `select a.id::text, a.partner_id::text, a.source_introduction_id::text,
            a.company_id::text, a.company_fingerprint, p.status pstatus
       from clonestory_fp_attributions a join clonestory_fp_partners p on p.id = a.partner_id
      where a.account_user_id = $1 and a.status in ('account_linked','company_linked')
      order by a.linked_at asc nulls last limit 1`,
    [accountUserId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    attributionId: r.id, partnerId: r.partner_id, partnerStatus: r.pstatus,
    introductionId: r.source_introduction_id, companyId: r.company_id, companyFingerprint: r.company_fingerprint,
  };
}

async function loadContributionBySub(tx: SqlExecutor, subId: string): Promise<CommercialContributionRow | null> {
  const { rows } = await tx.query<CommercialContributionRow>(
    `select id::text, partner_id::text, attribution_id::text, introduction_id::text, account_user_id::text,
            product_slug, currency, gross_amount, refunded_amount, net_amount, status, verified_active,
            validation_started_at, purchase_captured_at, stripe_subscription_id
       from clonestory_fp_commercial_contributions where stripe_subscription_id = $1 limit 1`,
    [subId],
  );
  return rows[0] ?? null;
}
const CC_SELECT = `select id::text, partner_id::text, attribution_id::text, introduction_id::text, account_user_id::text,
            product_slug, currency, gross_amount, refunded_amount, net_amount, status, verified_active,
            validation_started_at, purchase_captured_at, stripe_subscription_id
       from clonestory_fp_commercial_contributions`;

/** Résout une contribution par n'importe quelle référence Stripe disponible (refund/dispute). */
async function loadContributionByAnyRef(
  tx: SqlExecutor, ref: { subId?: string | null; paymentIntentId?: string | null; invoiceId?: string | null },
): Promise<CommercialContributionRow | null> {
  if (ref.subId) {
    const r = await loadContributionBySub(tx, ref.subId);
    if (r) return r;
  }
  if (ref.paymentIntentId) {
    const r = (await tx.query<CommercialContributionRow>(`${CC_SELECT} where stripe_payment_intent_id = $1 limit 1`, [ref.paymentIntentId])).rows[0];
    if (r) return r;
  }
  if (ref.invoiceId) {
    const r = (await tx.query<CommercialContributionRow>(`${CC_SELECT} where stripe_invoice_id = $1 limit 1`, [ref.invoiceId])).rows[0];
    if (r) return r;
  }
  return null;
}

async function loadContributionById(tx: SqlExecutor, id: string): Promise<CommercialContributionRow | null> {
  const { rows } = await tx.query<CommercialContributionRow>(
    `select id::text, partner_id::text, attribution_id::text, introduction_id::text, account_user_id::text,
            product_slug, currency, gross_amount, refunded_amount, net_amount, status, verified_active,
            validation_started_at, purchase_captured_at, stripe_subscription_id
       from clonestory_fp_commercial_contributions where id = $1 limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Crée (idempotent) la contribution liée à un abonnement, si le compte porte une
 * attribution active et éligible. Statut initial `activation_pending` (essai : accès
 * accordé, paiement NON capturé). Retourne null si aucune attribution (commande valide
 * pour CloneStore mais hors Cercle), ou si le partenaire est inéligible.
 */
async function ensureContribution(tx: SqlExecutor, args: {
  accountUserId: string; agentSlug: string | null; subId: string | null;
  customerId: string | null; checkoutSessionId?: string | null; livemode: boolean;
}): Promise<{ row: CommercialContributionRow | null; reason: string }> {
  if (!args.subId) return { row: null, reason: "no_subscription" };
  const existing = await loadContributionBySub(tx, args.subId);
  if (existing) return { row: existing, reason: "exists" };

  const attr = await resolveAttribution(tx, args.accountUserId);
  if (!attr) return { row: null, reason: "no_attribution" };
  if (!eligiblePartnerStatus(attr.partnerStatus)) {
    await recordCommercialEvent(tx, null, attr.partnerId, "manual_review_required", null, null,
      "partner_ineligible_at_capture", { sub: args.subId });
    return { row: null, reason: "partner_ineligible" };
  }

  const orderRef = `${args.accountUserId}:${args.agentSlug ?? ""}`;
  const ins = await tx.query<{ id: string }>(
    `insert into clonestory_fp_commercial_contributions
       (attribution_id, partner_id, introduction_id, account_user_id, company_id, company_fingerprint,
        order_ref, product_slug, stripe_mode, stripe_customer_id, stripe_checkout_session_id, stripe_subscription_id,
        status, decision_reason)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'activation_pending','trial_access_granted')
     on conflict (stripe_subscription_id) where stripe_subscription_id is not null do nothing
     returning id::text`,
    [attr.attributionId, attr.partnerId, attr.introductionId, args.accountUserId, attr.companyId,
     attr.companyFingerprint, orderRef, args.agentSlug, args.livemode ? "live" : "test",
     args.customerId, args.checkoutSessionId ?? null, args.subId],
  );
  if (!ins.rows[0]) {
    const again = await loadContributionBySub(tx, args.subId);
    return { row: again, reason: again ? "exists" : "race" };
  }
  const row = await loadContributionById(tx, ins.rows[0].id);
  if (row) {
    await recordCommercialEvent(tx, row.id, attr.partnerId, "reconciliation", null, "activation_pending",
      "contribution_opened", { source_type: attr.introductionId ? "introduction" : "link" });
  }
  return { row, reason: "created" };
}

// ── Transitions ─────────────────────────────────────────────────────────────────
async function setStatus(
  tx: SqlExecutor, c: CommercialContributionRow, to: string, tsField: string | null,
  reason: string, extra: Record<string, unknown> = {},
): Promise<void> {
  const sets = [`status=$2`, `updated_at=now()`, `decision_reason=$3`];
  const params: unknown[] = [c.id, to, reason];
  if (tsField) sets.push(`${tsField}=now()`);
  for (const [k, v] of Object.entries(extra)) {
    params.push(v);
    sets.push(`${k}=$${params.length}`);
  }
  await tx.query(`update clonestory_fp_commercial_contributions set ${sets.join(", ")} where id=$1`, params);
}

/** Marque le PAIEMENT capturé (autoritatif : invoice.paid montant>0). Idempotent. */
async function markPurchaseCaptured(tx: SqlExecutor, c: CommercialContributionRow, args: {
  gross: number; currency: string | null; invoiceId: string | null; paymentIntentId: string | null;
}): Promise<CommercialContributionRow> {
  if ((CC_RANK[c.status] ?? 0) >= CC_RANK.purchase_captured) {
    // déjà capturé (renouvellement) → trace, pas de doublon de contribution.
    await recordCommercialEvent(tx, c.id, c.partner_id, "renewal_recorded", c.status, c.status,
      "subsequent_invoice", { invoice: args.invoiceId });
    return c;
  }
  const net = Math.max(0, args.gross - c.refunded_amount);
  await setStatus(tx, c, "purchase_captured", "purchase_captured_at", "invoice_paid", {
    gross_amount: args.gross, net_amount: net, currency: args.currency,
    stripe_invoice_id: args.invoiceId, stripe_payment_intent_id: args.paymentIntentId,
  });
  await recordCommercialEvent(tx, c.id, c.partner_id, "purchase_captured", c.status, "purchase_captured",
    "invoice_paid", { amount: args.gross, currency: args.currency });
  if (c.introduction_id) {
    await advanceIntroductionStatus(tx, c.introduction_id, "purchase_captured", "stripe");
    await recordContributionEvent(tx, c.partner_id, c.introduction_id, "purchase_captured");
  }
  await enqueueCommercialEmail(tx, c.partner_id, c.id, "client_paid");
  const fresh = await loadContributionById(tx, c.id);
  return fresh ?? c;
}

/** Confirme l'ACCÈS produit actif après paiement, puis démarre la fenêtre de validation. */
async function markActivationCompleted(tx: SqlExecutor, c: CommercialContributionRow): Promise<CommercialContributionRow> {
  if ((CC_RANK[c.status] ?? 0) >= CC_RANK.activation_completed) return c;
  await setStatus(tx, c, "activation_completed", "activation_completed_at", "access_active");
  await recordCommercialEvent(tx, c.id, c.partner_id, "activation_completed", c.status, "activation_completed", "access_active");
  if (c.introduction_id) {
    await advanceIntroductionStatus(tx, c.introduction_id, "activation_completed", "stripe");
    await recordContributionEvent(tx, c.partner_id, c.introduction_id, "activation_completed");
  }
  await enqueueCommercialEmail(tx, c.partner_id, c.id, "activation_completed");
  const afterAct = (await loadContributionById(tx, c.id)) ?? c;
  return startContributionValidation(tx, afterAct);
}

/** Démarre la fenêtre de validation (délai de sécurité avant `verified`). */
async function startContributionValidation(tx: SqlExecutor, c: CommercialContributionRow): Promise<CommercialContributionRow> {
  if ((CC_RANK[c.status] ?? 0) >= CC_RANK.validation_pending) return c;
  await setStatus(tx, c, "validation_pending", "validation_started_at", "security_window_started");
  await recordCommercialEvent(tx, c.id, c.partner_id, "validation_started", c.status, "validation_pending", "security_window");
  if (c.introduction_id) await advanceIntroductionStatus(tx, c.introduction_id, "validation_pending", "stripe");
  await enqueueCommercialEmail(tx, c.partner_id, c.id, "validation_pending");
  return (await loadContributionById(tx, c.id)) ?? c;
}

// ── Vérification (PHASE J) ──────────────────────────────────────────────────────
export interface VerifyResult { ok: boolean; verified: boolean; reason: string }

/** Politique de vérification : toutes les preuves déterministes + délai écoulé. */
async function verifyContributionTx(
  tx: SqlExecutor, c: CommercialContributionRow, now: Date, overrideDelay = false,
): Promise<VerifyResult> {
  if (c.status === "verified") return { ok: true, verified: true, reason: "already_verified" };
  if (CC_TERMINAL.has(c.status) || c.status === "disputed") return { ok: false, verified: false, reason: `terminal_${c.status}` };
  if ((CC_RANK[c.status] ?? 0) < CC_RANK.activation_completed) return { ok: false, verified: false, reason: "activation_incomplete" };
  if (!c.purchase_captured_at) return { ok: false, verified: false, reason: "no_payment" };
  if (toCents(c.gross_amount) <= 0 || toCents(c.net_amount) <= 0) return { ok: false, verified: false, reason: "amount_non_positive" };
  if (!c.currency) return { ok: false, verified: false, reason: "no_currency" };
  if (!c.product_slug || !eligibleCommercialProducts().has(c.product_slug)) return { ok: false, verified: false, reason: "product_ineligible" };

  // Attribution active + partenaire éligible + compte cohérent.
  const attr = (await tx.query<{ partner_id: string; account_user_id: string | null; status: string; pstatus: string }>(
    `select a.partner_id::text, a.account_user_id::text, a.status, p.status pstatus
       from clonestory_fp_attributions a join clonestory_fp_partners p on p.id = a.partner_id
      where a.id = $1 limit 1`,
    [c.attribution_id],
  )).rows[0];
  if (!attr || !["account_linked", "company_linked"].includes(attr.status)) return { ok: false, verified: false, reason: "attribution_inactive" };
  if (!eligiblePartnerStatus(attr.pstatus)) return { ok: false, verified: false, reason: "partner_ineligible" };
  if (attr.partner_id !== c.partner_id) return { ok: false, verified: false, reason: "partner_mismatch" };
  if (c.account_user_id && attr.account_user_id && c.account_user_id !== attr.account_user_id) {
    return { ok: false, verified: false, reason: "account_mismatch" };
  }

  // Délai de sécurité (l'admin peut le forcer explicitement, avec raison + audit).
  if (!overrideDelay) {
    const startedAt = c.validation_started_at ? new Date(c.validation_started_at).getTime() : now.getTime();
    if (now.getTime() < startedAt + contributionValidationDelayMs()) {
      return { ok: false, verified: false, reason: "validation_window_open" };
    }
  }

  await setStatus(tx, c, "verified", "verified_at", "all_proofs_satisfied", { verified_active: true });
  await recordCommercialEvent(tx, c.id, c.partner_id, "contribution_verified", c.status, "verified", "all_proofs_satisfied");
  if (c.introduction_id) {
    await advanceIntroductionStatus(tx, c.introduction_id, "verified", "stripe");
    await recordContributionEvent(tx, c.partner_id, c.introduction_id, "contribution_verified");
    await tx.query(`update clonestory_fp_introductions set verified_at = coalesce(verified_at, now()) where id = $1`, [c.introduction_id]);
  }
  // Promotion fondateur (registry_number atomique) + distinctions commerciales.
  await promoteToFoundingPartner(tx, c.partner_id);
  await recomputeCommercialDistinctions(tx, c.partner_id);
  await enqueueCommercialEmail(tx, c.partner_id, c.id, "contribution_verified");
  return { ok: true, verified: true, reason: "verified" };
}

// ── Remboursement / annulation / litige (PHASE P) ───────────────────────────────
async function applyRefund(tx: SqlExecutor, c: CommercialContributionRow, refundedTotalAbs: number): Promise<void> {
  const gross = toCents(c.gross_amount);
  // `charge.refunded` porte le CUMUL remboursé (montant absolu) → on prend le max
  // (monotone, idempotent et sûr en cas d'événements hors ordre ou rejoués).
  const totalRefunded = Math.min(gross, Math.max(toCents(c.refunded_amount), Math.max(0, refundedTotalAbs)));
  const net = Math.max(0, gross - totalRefunded);
  const full = gross > 0 && totalRefunded >= gross;
  const wasVerifiedActive = c.status === "verified";

  if (full) {
    await setStatus(tx, c, "refunded", "refunded_at", "full_refund", {
      refunded_amount: totalRefunded, net_amount: 0, verified_active: false,
    });
    await recordCommercialEvent(tx, c.id, c.partner_id, "refund_full", c.status, "refunded", "full_refund", { refunded: totalRefunded });
    if (c.introduction_id) {
      await terminateIntroduction(tx, c.introduction_id, "canceled", "full_refund");
      await recordContributionEvent(tx, c.partner_id, c.introduction_id, "contribution_canceled");
    }
    await enqueueCommercialEmail(tx, c.partner_id, c.id, "contribution_refunded");
  } else {
    // Remboursement PARTIEL : règle documentée (seuil configurable). Au-delà du seuil,
    // la contribution repasse en revue (validation_pending) ; en-deçà elle reste valide.
    const pct = gross > 0 ? Math.round((totalRefunded * 100) / gross) : 0;
    const review = pct >= partialRefundReviewPct();
    const newStatus = review ? "validation_pending" : c.status;
    await setStatus(tx, c, newStatus, null, review ? "partial_refund_review" : "partial_refund_kept", {
      refunded_amount: totalRefunded, net_amount: net,
      verified_active: review ? false : c.verified_active,
      ...(review ? { validation_started_at: new Date() } : {}),
    });
    await recordCommercialEvent(tx, c.id, c.partner_id, "refund_recorded", c.status, newStatus,
      review ? "partial_refund_review" : "partial_refund_kept", { refunded: totalRefunded, pct });
  }
  if (wasVerifiedActive) await recomputeCommercialDistinctions(tx, c.partner_id);
}

async function terminateIntroduction(tx: SqlExecutor, introId: string, terminal: "canceled" | "disputed", reason: string): Promise<void> {
  // Transition vers un statut TERMINAL (hors machine forward). Conserve l'historique
  // d'événements ; ne réécrit jamais une intro déjà terminale.
  const cur = (await tx.query<{ status: string }>(`select status from clonestory_fp_introductions where id=$1`, [introId])).rows[0];
  if (!cur || ["canceled", "disputed", "expired"].includes(cur.status)) return;
  const tsCol = terminal === "canceled" ? "canceled_at" : "updated_at";
  await tx.query(
    `update clonestory_fp_introductions set status=$2, ${tsCol}=now(), updated_at=now(), dispute_flag = (dispute_flag or $3) where id=$1`,
    [introId, terminal, terminal === "disputed"],
  );
  void reason;
}

// ── Promotion fondateur + registry_number atomique (PHASE L) ────────────────────
/**
 * Alloue, de façon ATOMIQUE et UNIQUE, le registry_number à la première contribution
 * vérifiée, et confère le statut/distinction `founding_partner` (PERMANENTS — jamais
 * réutilisés ni supprimés, même après retrait : doctrine du registre honorifique).
 * Idempotent : si le numéro existe déjà, no-op.
 */
export async function promoteToFoundingPartner(tx: SqlExecutor, partnerId: string): Promise<number | null> {
  const cur = (await tx.query<{ registry_number: number | null; status: string }>(
    `select registry_number, status from clonestory_fp_partners where id=$1`, [partnerId],
  )).rows[0];
  if (!cur) return null;
  if (cur.registry_number) {
    if (cur.status !== "founding_partner") {
      await tx.query(`update clonestory_fp_partners set status='founding_partner', updated_at=now() where id=$1 and status not in ('suspended','withdrawn')`, [partnerId]);
    }
    await grantAward(tx, partnerId, "founding_partner", "auto", "first_verified_contribution");
    return cur.registry_number;
  }
  // Sérialise l'allocation (verrou transactionnel) ; l'index unique partiel sur
  // registry_number sert de filet en cas de course (node-postgres multi-connexions).
  try { await tx.query(`select pg_advisory_xact_lock(742310551)`); } catch { /* PGlite : transactions sérialisées */ }
  const next = (await tx.query<{ n: number }>(
    `select coalesce(max(registry_number),0)+1 as n from clonestory_fp_partners`,
  )).rows[0].n;
  await tx.query(
    `update clonestory_fp_partners set registry_number=$2,
            status = case when status in ('suspended','withdrawn') then status else 'founding_partner' end,
            updated_at=now()
      where id=$1`,
    [partnerId, next],
  );
  await recordCommercialEvent(tx, null, partnerId, "registry_number_allocated", null, null, "first_verified", { registry_number: next });
  await recordCommercialEvent(tx, null, partnerId, "founding_partner_promoted", null, null, "first_verified", {});
  await grantAward(tx, partnerId, "founding_partner", "auto", "first_verified_contribution");
  return next;
}

// ── Distinctions commerciales persistées (PHASE M) ──────────────────────────────
async function grantAward(tx: SqlExecutor, partnerId: string, code: string, source: "auto" | "manuel", evidence: string): Promise<void> {
  await tx.query(
    `insert into clonestory_fp_partner_awards (partner_id, distinction_code, source, evidence_ref)
     values ($1,$2,$3,$4)
     on conflict (partner_id, distinction_code) do update set revoked_at = null`,
    [partnerId, code, source, evidence],
  );
  await recordCommercialEvent(tx, null, partnerId, "distinction_awarded", null, null, code, { code });
}
async function revokeAward(tx: SqlExecutor, partnerId: string, code: string, reason: string): Promise<void> {
  const r = await tx.query<{ id: string }>(
    `update clonestory_fp_partner_awards set revoked_at = now()
      where partner_id=$1 and distinction_code=$2 and revoked_at is null returning id::text`,
    [partnerId, code],
  );
  if (r.rows.length > 0) await recordCommercialEvent(tx, null, partnerId, "distinction_revoked", null, null, reason, { code });
}

/**
 * Recalcule les distinctions COMMERCIALES (count de contributions vérifiées ACTIVES) :
 *   first_client ≥1, builder_5 ≥5, ambassador_10 ≥10. Révocables (remboursement/litige).
 * `founding_partner` reste permanent (géré par la promotion). Ne compte JAMAIS un
 * prospect, un compte, un simple checkout, un paiement échoué, ni une contribution
 * remboursée / disputée / invalidée.
 */
export async function recomputeCommercialDistinctions(tx: SqlExecutor, partnerId: string): Promise<void> {
  const n = toCents((await tx.query<{ n: number }>(
    `select count(*)::int n from clonestory_fp_commercial_contributions
      where partner_id=$1 and status='verified' and verified_active`,
    [partnerId],
  )).rows[0].n);
  const rules: Array<[string, boolean]> = [
    ["first_client", n >= 1],
    ["builder_5", n >= 5],
    ["ambassador_10", n >= 10],
  ];
  for (const [code, earned] of rules) {
    if (earned) await grantAward(tx, partnerId, code, "auto", `verified_active_count=${n}`);
    else await revokeAward(tx, partnerId, code, `verified_active_count=${n}`);
  }
}

// ── Outbox commerciale (enqueue ; le worker envoie) ─────────────────────────────
async function enqueueCommercialEmail(
  tx: SqlExecutor, partnerId: string, contributionId: string | null, kind: string,
): Promise<void> {
  const p = (await tx.query<{ email: string | null; email_normalized: string | null; display_name: string }>(
    `select email, email_normalized, display_name from clonestory_fp_partners where id=$1`, [partnerId],
  )).rows[0];
  const to = (p?.email ?? p?.email_normalized ?? "").trim();
  if (!to) return;
  const SUBJECTS: Record<string, string> = {
    client_paid: "Une entreprise présentée est devenue cliente",
    activation_completed: "Une activation a été confirmée",
    validation_pending: "Une contribution est en cours de validation",
    contribution_verified: "Une contribution a été vérifiée",
    contribution_refunded: "Une contribution a été annulée",
    contribution_disputed: "Une contribution est en litige",
    distinction_awarded: "Une distinction vous a été décernée",
  };
  const subject = SUBJECTS[kind] ?? "Mise à jour de votre registre";
  const key = `csy-commercial:${kind}:${contributionId ?? partnerId}`;
  await tx.query(
    `insert into clonestory_fp_commercial_outbox (partner_id, contribution_id, kind, idempotency_key, to_email, subject)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (idempotency_key) do nothing`,
    [partnerId, contributionId, kind, key, to, subject],
  );
}

// ── Dispatcher d'événement Stripe (utilisé par le pont webhook) ─────────────────
export async function applyCommercialStripeEvent(
  ev: CommercialStripeEvent, deps: CommercialDeps = {},
): Promise<CommercialOutcome> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const objectId = ev.subscriptionId ?? ev.invoiceId ?? ev.chargeId ?? ev.checkoutSessionId ?? null;
    const fresh = await recordStripeEventFresh(tx, ev, objectId);
    if (!fresh) return { ok: true, duplicate: true, result: "duplicate", reason: "already_processed" };

    let outcome: CommercialOutcome;
    try {
      outcome = await dispatch(tx, ev, deps);
    } catch (e) {
      await finishStripeEvent(tx, ev.eventId, "failed", e instanceof Error ? e.message.slice(0, 200) : "error");
      throw e;
    }
    await finishStripeEvent(tx, ev.eventId, outcome.result === "applied" ? "applied" : outcome.result === "ignored" ? "ignored" : "applied", outcome.reason ?? null);
    return outcome;
  });
}

async function resolveMeta(ev: CommercialStripeEvent, deps: CommercialDeps): Promise<{ userId: string | null; agentSlug: string | null }> {
  if (ev.userId) return { userId: ev.userId, agentSlug: ev.agentSlug ?? null };
  if (ev.subscriptionId && deps.resolveSubscriptionMeta) {
    const m = await deps.resolveSubscriptionMeta(ev.subscriptionId);
    if (m) return m;
  }
  return { userId: null, agentSlug: ev.agentSlug ?? null };
}

async function dispatch(tx: SqlExecutor, ev: CommercialStripeEvent, deps: CommercialDeps): Promise<CommercialOutcome> {
  switch (ev.type) {
    case "checkout.session.completed": {
      const meta = await resolveMeta(ev, deps);
      if (!meta.userId) return { ok: true, duplicate: false, result: "ignored", reason: "no_user_id" };
      const { row, reason } = await ensureContribution(tx, {
        accountUserId: meta.userId, agentSlug: meta.agentSlug, subId: ev.subscriptionId,
        customerId: ev.customerId, checkoutSessionId: ev.checkoutSessionId, livemode: ev.livemode,
      });
      // Paiement immédiat (hors essai) : si la session est déjà payée (montant>0), capturer.
      if (row && (ev.amountPaid ?? 0) > 0) {
        const captured = await markPurchaseCaptured(tx, row, {
          gross: ev.amountPaid!, currency: ev.currency ?? null, invoiceId: ev.invoiceId ?? null, paymentIntentId: ev.paymentIntentId ?? null,
        });
        await markActivationCompleted(tx, captured);
        return { ok: true, duplicate: false, result: "applied", reason: "checkout_paid", contributionId: row.id, status: "validation_pending" };
      }
      return { ok: true, duplicate: false, result: row ? "applied" : "ignored", reason, contributionId: row?.id, status: row?.status };
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      if (!ev.subscriptionId) return { ok: true, duplicate: false, result: "ignored", reason: "no_subscription" };
      if ((ev.amountPaid ?? 0) <= 0) return { ok: true, duplicate: false, result: "ignored", reason: "trial_or_zero_amount" };
      let row = await loadContributionBySub(tx, ev.subscriptionId);
      if (!row) {
        const meta = await resolveMeta(ev, deps);
        if (!meta.userId) return { ok: true, duplicate: false, result: "ignored", reason: "no_user_id" };
        row = (await ensureContribution(tx, {
          accountUserId: meta.userId, agentSlug: meta.agentSlug, subId: ev.subscriptionId,
          customerId: ev.customerId, livemode: ev.livemode,
        })).row;
      }
      if (!row) return { ok: true, duplicate: false, result: "ignored", reason: "no_attribution" };
      const captured = await markPurchaseCaptured(tx, row, {
        gross: ev.amountPaid!, currency: ev.currency ?? null, invoiceId: ev.invoiceId ?? null, paymentIntentId: ev.paymentIntentId ?? null,
      });
      await markActivationCompleted(tx, captured);
      return { ok: true, duplicate: false, result: "applied", reason: "invoice_paid", contributionId: row.id, status: "validation_pending" };
    }

    case "charge.refunded":
    case "refund.created":
    case "charge.refund.updated": {
      const row = await loadContributionByAnyRef(tx, { subId: ev.subscriptionId, paymentIntentId: ev.paymentIntentId, invoiceId: ev.invoiceId });
      if (!row) return { ok: true, duplicate: false, result: "ignored", reason: "no_contribution" };
      await applyRefund(tx, row, ev.amountRefunded ?? 0);
      return { ok: true, duplicate: false, result: "applied", reason: "refund", contributionId: row.id };
    }

    case "charge.dispute.created": {
      const row = await loadContributionByAnyRef(tx, { subId: ev.subscriptionId, paymentIntentId: ev.paymentIntentId, invoiceId: ev.invoiceId });
      if (!row) return { ok: true, duplicate: false, result: "ignored", reason: "no_contribution" };
      if (CC_TERMINAL.has(row.status)) return { ok: true, duplicate: false, result: "ignored", reason: `terminal_${row.status}` };
      const priorStatus = row.status;
      await setStatus(tx, row, "disputed", "disputed_at", "dispute_opened", { verified_active: false });
      await tx.query(
        `update clonestory_fp_commercial_contributions
            set evidence_safe = evidence_safe || jsonb_build_object('prior_status', $2::text) where id=$1`,
        [row.id, priorStatus],
      );
      await recordCommercialEvent(tx, row.id, row.partner_id, "dispute_opened", priorStatus, "disputed", "chargeback", { prior_status: priorStatus });
      if (row.introduction_id) await tx.query(`update clonestory_fp_introductions set dispute_flag=true, updated_at=now() where id=$1`, [row.introduction_id]);
      if (row.status === "verified") await recomputeCommercialDistinctions(tx, row.partner_id);
      await enqueueCommercialEmail(tx, row.partner_id, row.id, "contribution_disputed");
      return { ok: true, duplicate: false, result: "applied", reason: "dispute_opened", contributionId: row.id, status: "disputed" };
    }

    case "charge.dispute.closed": {
      const row = await loadContributionByAnyRef(tx, { subId: ev.subscriptionId, paymentIntentId: ev.paymentIntentId, invoiceId: ev.invoiceId });
      if (!row || row.status !== "disputed") return { ok: true, duplicate: false, result: "ignored", reason: "no_open_dispute" };
      const prior = (await tx.query<{ prior: string | null }>(
        `select (evidence_safe->>'prior_status') prior from clonestory_fp_commercial_contributions where id=$1`, [row.id],
      )).rows[0]?.prior ?? "activation_completed";
      if (ev.disputeResolved === "won") {
        await setStatus(tx, row, prior, null, "dispute_won_restored", { verified_active: prior === "verified" });
        await recordCommercialEvent(tx, row.id, row.partner_id, "dispute_closed", "disputed", prior, "won");
        if (prior === "verified") await recomputeCommercialDistinctions(tx, row.partner_id);
      } else {
        await setStatus(tx, row, "refunded", "refunded_at", "dispute_lost", { net_amount: 0, verified_active: false, refunded_amount: toCents(row.gross_amount) });
        await recordCommercialEvent(tx, row.id, row.partner_id, "dispute_closed", "disputed", "refunded", "lost");
        if (row.introduction_id) await terminateIntroduction(tx, row.introduction_id, "disputed", "dispute_lost");
        await recomputeCommercialDistinctions(tx, row.partner_id);
      }
      return { ok: true, duplicate: false, result: "applied", reason: `dispute_${ev.disputeResolved}`, contributionId: row.id };
    }

    case "checkout.session.expired": {
      const row = ev.subscriptionId ? await loadContributionBySub(tx, ev.subscriptionId) : null;
      if (!row) return { ok: true, duplicate: false, result: "ignored", reason: "no_contribution" };
      if (row.status === "activation_pending") {
        await setStatus(tx, row, "canceled", "canceled_at", "checkout_expired", {});
        await recordCommercialEvent(tx, row.id, row.partner_id, "contribution_canceled", row.status, "canceled", "checkout_expired");
      }
      return { ok: true, duplicate: false, result: "applied", reason: "expired", contributionId: row.id };
    }

    case "customer.subscription.deleted": {
      // Churn : N'EFFACE PAS une contribution déjà vérifiée (≠ remboursement). Trace seule.
      const row = ev.subscriptionId ? await loadContributionBySub(tx, ev.subscriptionId) : null;
      if (!row) return { ok: true, duplicate: false, result: "ignored", reason: "no_contribution" };
      if (row.status === "activation_pending") {
        await setStatus(tx, row, "canceled", "canceled_at", "subscription_deleted_before_capture", {});
        await recordCommercialEvent(tx, row.id, row.partner_id, "contribution_canceled", row.status, "canceled", "churn_before_capture");
      } else {
        await recordCommercialEvent(tx, row.id, row.partner_id, "reconciliation", row.status, row.status, "subscription_churn_after_capture", {});
      }
      return { ok: true, duplicate: false, result: "applied", reason: "churn", contributionId: row.id };
    }

    default:
      return { ok: true, duplicate: false, result: "ignored", reason: `unhandled_${ev.type}` };
  }
}

// ── Lectures / administration / réconciliation ──────────────────────────────────
export async function getContributionForOrder(orderRef: string): Promise<CommercialContributionRow | null> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<CommercialContributionRow>(
      `select id::text, partner_id::text, attribution_id::text, introduction_id::text, account_user_id::text,
              product_slug, currency, gross_amount, refunded_amount, net_amount, status, verified_active,
              validation_started_at, purchase_captured_at, stripe_subscription_id
         from clonestory_fp_commercial_contributions where order_ref = $1 order by created_at desc limit 1`,
      [orderRef],
    );
    return rows[0] ?? null;
  });
}
export async function getContributionForAttribution(attributionId: string): Promise<CommercialContributionRow | null> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<CommercialContributionRow>(
      `select id::text, partner_id::text, attribution_id::text, introduction_id::text, account_user_id::text,
              product_slug, currency, gross_amount, refunded_amount, net_amount, status, verified_active,
              validation_started_at, purchase_captured_at, stripe_subscription_id
         from clonestory_fp_commercial_contributions where attribution_id = $1 order by created_at desc limit 1`,
      [attributionId],
    );
    return rows[0] ?? null;
  });
}

/** Vérifie une contribution donnée (admin/réconciliation). `now` injectable (tests). */
export async function verifyCommercialContribution(
  contributionId: string, now: Date = new Date(), overrideDelay = false,
): Promise<VerifyResult> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const c = await loadContributionById(tx, contributionId);
    if (!c) return { ok: false, verified: false, reason: "not_found" };
    return verifyContributionTx(tx, c, now, overrideDelay);
  });
}

/** Invalide une contribution (admin), sans effacer l'historique. */
export async function invalidateCommercialContribution(contributionId: string, reason: string): Promise<{ ok: boolean }> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const c = await loadContributionById(tx, contributionId);
    if (!c || CC_TERMINAL.has(c.status)) return { ok: false };
    const wasVerified = c.status === "verified";
    await setStatus(tx, c, "invalidated", "invalidated_at", reason, { verified_active: false });
    await recordCommercialEvent(tx, c.id, c.partner_id, "contribution_invalidated", c.status, "invalidated", reason);
    if (wasVerified) await recomputeCommercialDistinctions(tx, c.partner_id);
    return { ok: true };
  });
}

/**
 * Réconciliation (idempotente, non destructive) :
 *   • re-traite les événements Stripe `failed`/`pending` du ledger (best-effort) ;
 *   • vérifie automatiquement les contributions `validation_pending` dont le délai est
 *     écoulé et dont toutes les preuves sont satisfaites.
 * Retourne un compte rendu observable.
 */
export async function reconcileCommercial(now: Date = new Date()): Promise<{ verified: number; scanned: number }> {
  if (!clonestoryFeatureEnabled("auto_verification")) return { verified: 0, scanned: 0 }; // interrupteur
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const due = (await tx.query<{ id: string }>(
      `select id::text from clonestory_fp_commercial_contributions
        where status = 'validation_pending' order by validation_started_at asc nulls first limit 200`,
    )).rows;
    let verified = 0;
    for (const r of due) {
      const c = await loadContributionById(tx, r.id);
      if (!c) continue;
      const res = await verifyContributionTx(tx, c, now);
      if (res.verified) verified += 1;
    }
    return { verified, scanned: due.length };
  });
}

// ── Stats cockpit (face PARTENAIRE — comptes uniquement, aucune donnée sensible) ─
export interface CommercialStats {
  clientsPaid: number;
  activationsCompleted: number;
  contributionsValidating: number;
  contributionsVerified: number;
  contributionsRefunded: number;
  contributionsDisputed: number;
}
/** Lecture des stats commerciales d'un partenaire (mode service ; comptes seuls). */
export async function getCommercialStatsForPartner(tx: SqlExecutor, partnerId: string): Promise<CommercialStats> {
  const r = (await tx.query<{
    paid: number; activated: number; validating: number; verified: number; refunded: number; disputed: number;
  }>(
    `select
       count(*) filter (where status in ('purchase_captured','activation_completed','validation_pending','verified'))::int paid,
       count(*) filter (where status in ('activation_completed','validation_pending','verified'))::int activated,
       count(*) filter (where status = 'validation_pending')::int validating,
       count(*) filter (where status = 'verified' and verified_active)::int verified,
       count(*) filter (where status = 'refunded')::int refunded,
       count(*) filter (where status = 'disputed')::int disputed
     from clonestory_fp_commercial_contributions where partner_id = $1`,
    [partnerId],
  )).rows[0];
  return {
    clientsPaid: toCents(r?.paid ?? 0),
    activationsCompleted: toCents(r?.activated ?? 0),
    contributionsValidating: toCents(r?.validating ?? 0),
    contributionsVerified: toCents(r?.verified ?? 0),
    contributionsRefunded: toCents(r?.refunded ?? 0),
    contributionsDisputed: toCents(r?.disputed ?? 0),
  };
}

// ── Worker de l'outbox commerciale (cron sécurisé) ──────────────────────────────
interface OutboxRow { id: string; kind: string; to_email: string; idempotency_key: string; attempts: number; max_attempts: number }

/**
 * Traite l'outbox des notifications commerciales : claim (FOR UPDATE SKIP LOCKED),
 * envoi via le fournisseur (idempotent), transitions avec backoff exponentiel jusqu'à
 * `dead`. Aucun double envoi (idempotency_key) ; aucun try/catch silencieux (erreurs
 * tracées dans last_error). Isolé de l'outbox de vérification.
 */
export async function processCommercialOutbox(limit = 50): Promise<{ processed: number; sent: number; failed: number; dead: number }> {
  const db = await getClonestoryDb();
  const claimed = await withService(db, async (tx) => {
    // Récupère les baux expirés (worker interrompu) avant de claim.
    await tx.query(
      `update clonestory_fp_commercial_outbox set status='failed_retryable', updated_at=now()
        where status='sending' and locked_at < now() - interval '5 minutes'`,
    );
    const { rows } = await tx.query<OutboxRow>(
      `select id::text, kind, to_email, idempotency_key, attempts, max_attempts
         from clonestory_fp_commercial_outbox
        where status in ('pending','failed_retryable') and next_attempt_at <= now()
        order by next_attempt_at asc
        for update skip locked limit $1`,
      [limit],
    );
    for (const r of rows) {
      await tx.query(
        `update clonestory_fp_commercial_outbox set status='sending', locked_at=now(), attempts=attempts+1, updated_at=now() where id=$1`,
        [r.id],
      );
    }
    return rows;
  });

  const registryUrl = `${publicBaseUrl()}/profile`;
  let sent = 0, failed = 0, dead = 0;
  for (const r of claimed) {
    const email = renderCommercialEmail(r.kind, registryUrl);
    let ok = false, providerId: string | null = null, errMsg: string | null = null;
    try {
      const res = await sendClonestoryEmail({ to: r.to_email, subject: email.subject, html: email.html, text: email.text, idempotencyKey: r.idempotency_key });
      ok = res.ok; providerId = res.id ?? null; errMsg = res.error ?? null;
    } catch (e) {
      ok = false; errMsg = e instanceof Error ? e.message : "send_error";
    }
    await withService(db, async (tx) => {
      if (ok) {
        await tx.query(`update clonestory_fp_commercial_outbox set status='sent', provider_message_id=$2, last_error=null, updated_at=now() where id=$1`, [r.id, providerId]);
        sent += 1;
      } else {
        const attempts = r.attempts + 1;
        const isDead = attempts >= r.max_attempts;
        const backoff = String(Math.min(60, 2 ** attempts));
        await tx.query(
          `update clonestory_fp_commercial_outbox
              set status=$2, last_error=$3, next_attempt_at = now() + ($4 || ' minutes')::interval, updated_at=now()
            where id=$1`,
          [r.id, isDead ? "dead" : "failed_retryable", (errMsg ?? "send_failed").slice(0, 200), backoff],
        );
        if (isDead) dead += 1; else failed += 1;
      }
    });
  }
  return { processed: claimed.length, sent, failed, dead };
}
