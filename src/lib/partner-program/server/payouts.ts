// Programme partenaires — VERSEMENTS AUTOMATIQUES via Stripe Connect.
//
// INVARIANTS FINANCIERS (chacun est prouvé par un test) :
//
//   1. DRY-RUN = PRÉVISUALISATION PURE. Aucune écriture, nulle part : ni transfert, ni lot,
//      ni écriture marquée payée, ni e-mail, ni faux identifiant Stripe. Rejouable à l'infini.
//   2. Une commission n'est `paid` QU'APRÈS confirmation du transfert par Stripe.
//      Jamais avant. Un échec ne laisse donc jamais une commission « payée » non versée.
//   3. Un lot en échec LIBÈRE ses commissions (elles retournent au pool du mois suivant).
//   4. Une issue INCONNUE (timeout, réseau) ne libère RIEN et ne paie RIEN :
//      le lot passe en `reconciliation_required` et Stripe est interrogé avant toute recréation.
//   5. Clé d'idempotence déterministe `partner-payout:<partnerId>:<periodKey>:<batchHash>` :
//      deux workers, deux relances → un seul transfert.

import type Stripe from "stripe";
import { createHash } from "crypto";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { withService } from "./runtime";
import { getPartnerBalances } from "./summary";
import {
  decidePayout, previousMonthBounds, monthPeriodKey, payoutIdempotencyKey, classifyTransferFailure,
} from "../payout-rules";
import { isPartnerPayoutDryRun } from "../flags";
import { isPartnerLivePayoutAuthorized, explainLiveBlock } from "../live-authorization";
// PLANCHER DUR P10 — constante de code, jamais une variable d'environnement. Aucun mouvement
// d'argent LIVE (y compris un transfert Connect vers un cabinet) tant que la production n'est pas
// autorisée par un changement de code DÉLIBÉRÉ. C'est ce que `.env.example` promet déjà.
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
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
  /** Crée un transfert Stripe vers le compte connecté. Idempotent côté Stripe. */
  createTransfer: (input: CreateTransferInput) => Promise<{ id: string }>;
  /**
   * Retrouve un transfert DÉJÀ créé pour cette clé d'idempotence (rapprochement après
   * timeout). Retourne null s'il n'existe pas. Ne crée JAMAIS rien.
   */
  findTransfer: (input: { idempotencyKey: string; destination: string; metadata: Record<string, string> }) => Promise<{ id: string } | null>;
  /** Vrai si l'environnement Stripe est en mode LIVE (clé sk_live_…). */
  stripeIsLive: () => boolean;
  /** Vrai si TOUTES les gardes d'autorisation Live sont satisfaites (fail-closed). */
  productionAuthorized: () => boolean;
  /**
   * Mode RÉEL du client Stripe utilisé pour l'opération sortante. Dérivé de la clé, jamais
   * d'un paramètre : une écriture Test ne doit jamais entrer dans un transfert Live.
   */
  stripeMode: () => "test" | "live";
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
    findTransfer: async (input) => {
      // Rapprochement : on cherche un transfert déjà émis pour ce lot exact. On compare
      // l'empreinte du lot (metadata), jamais un montant seul — deux mois peuvent coïncider.
      const list = await stripe.transfers.list({ destination: input.destination, limit: 100 });
      const found = list.data.find(
        (t) => t.metadata?.batch_hash === input.metadata.batch_hash && t.metadata?.partner_id === input.metadata.partner_id,
      );
      return found ? { id: found.id } : null;
    },
    stripeIsLive: () => (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_"),
    // Autorisation d'un transfert LIVE = PLANCHER DUR P10 **ET** garde d'environnement.
    //
    //   · Le plancher P10 (`PRODUCTION_AUTHORIZED`) est une CONSTANTE de code. Aucune variable
    //     d'environnement ne peut le lever : il faut un changement de code délibéré du propriétaire.
    //   · La garde d'environnement (NODE_ENV + VERCEL_ENV production + payouts activés + dry-run
    //     explicitement désactivé + autorisation Live explicite + clé Live + secret cron) ne peut
    //     qu'AJOUTER des restrictions — jamais contourner le plancher.
    //
    // L'ordre est un ET : le plancher d'abord. `PARTNER_PAYOUT_DRY_RUN=false` — ni aucune autre
    // variable, ni même la forme `sk_live_` d'une clé — ne suffit JAMAIS à autoriser un versement.
    productionAuthorized: () => Boolean(PRODUCTION_AUTHORIZED) && isPartnerLivePayoutAuthorized(),
    // Mode réel du client Stripe : dérivé de la CLÉ utilisée, jamais d'un paramètre.
    stripeMode: () => ((process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_") ? "live" : "test"),
  };
}

// ── Prévisualisation (dry-run) — ZÉRO écriture ───────────────────────────────

export type PayoutPreviewLine = {
  partnerId: string;
  displayName: string;
  /** included : serait versé. excluded : ne le serait pas, avec la raison exacte. */
  outcome: "included" | "excluded";
  amountMinor: number;
  currency: string;
  entryIds: string[];
  entryCount: number;
  thresholdMinor: number;
  reason?: string;
};

export type PayoutPreview = {
  dryRun: true;
  periodKey: string;
  /** Mode Stripe RÉEL de l'opération sortante (dérivé de la clé, jamais d'un paramètre). */
  stripeMode: "test" | "live";
  partnersConsidered: number;
  included: number;
  excluded: number;
  totalAmountMinor: number;
  lines: PayoutPreviewLine[];
};

export type PayableEntry = { id: string; commission_minor: number; currency: string; stripe_mode: string };

/**
 * Écritures réellement payables d'un cabinet : réserve écoulée, non gelées, non déjà
 * verrouillées sur un lot vivant, et **du même mode Stripe** que l'opération sortante.
 * Une écriture Test ne peut donc JAMAIS entrer dans un transfert Live (et inversement) :
 * la garde est dans la requête de sélection, pas dans un filtre applicatif qu'on oublie.
 */
async function payableEntries(
  tx: SqlExecutor, partnerId: string, mode: "test" | "live", lock: boolean,
): Promise<PayableEntry[]> {
  const { rows } = await tx.query<{ id: string; commission_minor: number; currency: string; stripe_mode: string }>(
    `select e.id, e.commission_minor, e.currency, e.stripe_mode from clonestore_pp_commission_entries e
      where e.partner_id = $1 and e.status = 'pending' and e.available_at <= now()
        and e.stripe_mode = $2
        and not exists (
          select 1 from clonestore_pp_transfer_items i
           where i.entry_id = e.id and i.released_at is null
        )
      order by e.created_at asc
      ${lock ? "for update of e" : ""}`,
    [partnerId, mode],
  );
  return rows.map((r) => ({
    id: r.id, commission_minor: Number(r.commission_minor) || 0,
    currency: String(r.currency).toLowerCase(), stripe_mode: String(r.stripe_mode),
  }));
}

/**
 * Vérifie qu'un lot est homogène : un seul mode Stripe, une seule devise, et la devise du
 * lot est bien celle de versement du cabinet. Un lot hétérogène n'est JAMAIS transféré.
 */
export function assertHomogeneousBatch(
  entries: readonly PayableEntry[], mode: "test" | "live", payoutCurrency: string,
): { ok: true; currency: string } | { ok: false; reason: string } {
  if (!entries.length) return { ok: false, reason: "nothing_payable" };

  const modes = new Set(entries.map((e) => e.stripe_mode));
  if (modes.size > 1) return { ok: false, reason: "mixed_stripe_mode" };
  if (!modes.has(mode)) return { ok: false, reason: "stripe_mode_mismatch" };

  const currencies = new Set(entries.map((e) => e.currency));
  if (currencies.size > 1) return { ok: false, reason: "mixed_currency" };

  const currency = [...currencies][0];
  if (currency !== payoutCurrency.toLowerCase()) return { ok: false, reason: "currency_mismatch_with_payout_account" };

  return { ok: true, currency };
}

/** Empreinte du lot : dépend EXACTEMENT des écritures sélectionnées. */
export function batchHash(entryIds: readonly string[]): string {
  return createHash("sha256").update([...entryIds].sort().join("|")).digest("hex").slice(0, 32);
}

/**
 * PRÉVISUALISATION. N'écrit rien : ni lot, ni transfert, ni statut, ni e-mail.
 * C'est le seul comportement du dry-run.
 */
export async function previewPayouts(
  db: SqlExecutor, opts: { now: Date; stripeMode?: "test" | "live" },
): Promise<PayoutPreview> {
  const { key } = previousMonthBounds(opts.now);
  // Mode RÉEL de l'opération sortante : dérivé de la clé Stripe, jamais d'une entrée utilisateur.
  const mode: "test" | "live" = opts.stripeMode ?? ((process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_") ? "live" : "test");

  const partners = await withService(db, (tx) =>
    tx.query<{
      id: string; display_name: string; status: string; payouts_enabled: boolean;
      stripe_onboarding_status: string; payout_threshold_minor: number; payout_currency: string;
      stripe_connected_account_id: string | null;
    }>(
      `select id, display_name, status, payouts_enabled, stripe_onboarding_status,
              payout_threshold_minor, payout_currency, stripe_connected_account_id
         from clonestore_pp_partners where status = 'active' order by created_at asc`,
    ),
  );

  const lines: PayoutPreviewLine[] = [];
  let total = 0;

  for (const p of partners.rows) {
    const line = await withService(db, async (tx) => {
      const dispute = await tx.query(
        `select 1 from clonestore_pp_commission_entries where partner_id=$1 and status='frozen' limit 1`, [p.id],
      );
      const balances = await getPartnerBalances(tx, p.id);
      const entries = await payableEntries(tx, p.id, mode, false); // lecture seule : AUCUN verrou
      const amount = entries.reduce((s, e) => s + e.commission_minor, 0);

      const base = {
        partnerId: p.id, displayName: p.display_name, currency: p.payout_currency,
        thresholdMinor: Number(p.payout_threshold_minor) || 0,
        entryIds: entries.map((e) => e.id), entryCount: entries.length,
      };

      const decision = decidePayout({
        partnerStatus: p.status as "active",
        payoutsEnabled: p.payouts_enabled,
        onboardingStatus: p.stripe_onboarding_status as "complete",
        availableMinor: balances.availableMinor,
        frozenMinor: balances.frozenMinor,
        thresholdMinor: Number(p.payout_threshold_minor) || 0,
        hasOpenDispute: dispute.rows.length > 0,
      });
      if (!decision.eligible) {
        return { ...base, outcome: "excluded" as const, amountMinor: 0, reason: decision.reason };
      }
      if (!p.stripe_connected_account_id) {
        return { ...base, outcome: "excluded" as const, amountMinor: 0, reason: "no_connected_account" };
      }
      if (amount <= 0) return { ...base, outcome: "excluded" as const, amountMinor: 0, reason: "nothing_payable" };

      // Lot homogène exigé : un seul mode Stripe, une seule devise, cohérente avec le compte.
      const homo = assertHomogeneousBatch(entries, mode, p.payout_currency);
      if (!homo.ok) return { ...base, outcome: "excluded" as const, amountMinor: amount, reason: homo.reason };

      if (amount < base.thresholdMinor) {
        return { ...base, outcome: "excluded" as const, amountMinor: amount, reason: "below_threshold" };
      }
      return { ...base, outcome: "included" as const, amountMinor: amount };
    });

    lines.push(line);
    if (line.outcome === "included") total += line.amountMinor;
  }

  return {
    dryRun: true,
    periodKey: key,
    stripeMode: mode,
    partnersConsidered: partners.rows.length,
    included: lines.filter((l) => l.outcome === "included").length,
    excluded: lines.filter((l) => l.outcome === "excluded").length,
    totalAmountMinor: total,
    lines,
  };
}

// ── Exécution réelle ─────────────────────────────────────────────────────────

export type PayoutOutcome = {
  partnerId: string;
  amountMinor: number;
  status: "transferred" | "reconciled" | "skipped" | "failed_retryable" | "failed_permanent" | "reconciliation_required" | "already_paid";
  reason?: string;
  requiredAction?: string;
  stripeTransferId?: string;
};

export type PayoutRunResult = {
  runId: string | null;
  periodKey: string;
  dryRun: boolean;
  /** Mode Stripe RÉEL de l'opération (dérivé de la clé). */
  stripeMode: "test" | "live";
  skipped?: string;
  partnersConsidered: number;
  transfersCreated: number;
  transfersFailed: number;
  totalAmountMinor: number;
  perPartner: PayoutOutcome[];
  /** Rempli UNIQUEMENT en dry-run : la prévisualisation, sans aucune écriture. */
  preview?: PayoutPreview;
};

/**
 * Exécute le versement mensuel de la période précédente.
 *
 * En dry-run (défaut), délègue à `previewPayouts` : rien n'est écrit, aucun verrou de run
 * n'est pris — une simulation ne doit JAMAIS empêcher le vrai versement ultérieur.
 */
export async function runMonthlyPayouts(
  db: SqlExecutor,
  deps: PayoutDeps,
  opts: { now: Date; dryRunOverride?: boolean },
): Promise<PayoutRunResult> {
  const dryRun = opts.dryRunOverride ?? isPartnerPayoutDryRun();
  const { start, end, key } = previousMonthBounds(opts.now);

  const mode = deps.stripeMode();

  if (dryRun) {
    const preview = await previewPayouts(db, { now: opts.now, stripeMode: mode });
    return {
      runId: null, periodKey: key, dryRun: true, stripeMode: mode,
      partnersConsidered: preview.partnersConsidered,
      transfersCreated: 0, // aucun transfert : c'est une prévisualisation
      transfersFailed: 0,
      totalAmountMinor: preview.totalAmountMinor,
      // Aucun transfert : chaque ligne est une INTENTION, jamais une exécution.
      perPartner: preview.lines.map((l) => ({
        partnerId: l.partnerId,
        amountMinor: l.amountMinor,
        status: "skipped" as const,
        reason: l.outcome === "included" ? "preview_would_transfer" : l.reason,
      })),
      preview,
    };
  }

  // Garde anti-Live FAIL-CLOSED : un transfert Live exige le PLANCHER P10 **et** toutes les gardes
  // d'environnement. `PARTNER_PAYOUT_DRY_RUN=false` ne suffit jamais à lui seul.
  if (deps.stripeIsLive() && !deps.productionAuthorized()) {
    // Le refus doit dire LAQUELLE des deux causes a joué. Sans cela, un environnement pleinement
    // autorisé bloqué par le plancher afficherait « toutes les gardes sont satisfaites » — un
    // message qui contredirait le refus qu'il accompagne.
    console.warn(
      "[partner-payouts]",
      PRODUCTION_AUTHORIZED
        ? explainLiveBlock()
        : "Versements Live BLOQUÉS par le PLANCHER DUR P10 (PRODUCTION_AUTHORIZED=false). Aucune variable d'environnement ne peut l'autoriser : seul un changement de code délibéré du propriétaire lève ce plancher.",
    );
    return { runId: null, periodKey: key, dryRun, stripeMode: mode, skipped: "live_not_authorized", partnersConsidered: 0, transfersCreated: 0, transfersFailed: 0, totalAmountMinor: 0, perPartner: [] };
  }

  // Verrou logique : un seul run réel par période (deux workers → un seul détient le run).
  const runKey = `pp-payout:${key}`;
  const runId = await withService(db, async (tx) => {
    const ins = await tx.query<{ id: string }>(
      `insert into clonestore_pp_payout_runs (run_key, dry_run, status) values ($1,false,'running')
       on conflict (run_key) do nothing returning id`,
      [runKey],
    );
    if (ins.rows.length) return ins.rows[0].id;
    const cur = await tx.query<{ id: string; status: string }>(`select id, status from clonestore_pp_payout_runs where run_key=$1`, [runKey]);
    if (cur.rows[0]?.status === "failed") {
      await tx.query(`update clonestore_pp_payout_runs set status='running' where id=$1`, [cur.rows[0].id]);
      return cur.rows[0].id;
    }
    return null; // déjà en cours ou terminé
  });

  if (!runId) {
    return { runId: null, periodKey: key, dryRun, stripeMode: mode, skipped: "already_running_or_done", partnersConsidered: 0, transfersCreated: 0, transfersFailed: 0, totalAmountMinor: 0, perPartner: [] };
  }

  const partners = await withService(db, (tx) =>
    tx.query<PartnerRow>(
      `select id, status, payouts_enabled, stripe_onboarding_status, payout_threshold_minor,
              payout_currency, stripe_connected_account_id, email_normalized
         from clonestore_pp_partners where status='active' order by created_at asc`,
    ),
  );

  const perPartner: PayoutOutcome[] = [];
  let created = 0, failed = 0, total = 0;

  for (const p of partners.rows) {
    const outcome = await processPartnerPayout(db, deps, { partner: p, runId, periodStart: start, periodEnd: end, periodKey: key, mode });
    perPartner.push(outcome);
    if (outcome.status === "transferred" || outcome.status === "reconciled") { created += 1; total += outcome.amountMinor; }
    if (outcome.status === "failed_retryable" || outcome.status === "failed_permanent" || outcome.status === "reconciliation_required") failed += 1;
  }

  await withService(db, (tx) =>
    tx.query(
      `update clonestore_pp_payout_runs set status='completed', finished_at=now(), partners_considered=$2,
              transfers_created=$3, transfers_failed=$4, total_amount_minor=$5, report_safe=$6::jsonb where id=$1`,
      [runId, partners.rows.length, created, failed, total, JSON.stringify({ perPartner, dryRun: false })],
    ),
  );

  return { runId, periodKey: key, dryRun: false, stripeMode: mode, partnersConsidered: partners.rows.length, transfersCreated: created, transfersFailed: failed, totalAmountMinor: total, perPartner };
}

type PartnerRow = {
  id: string; status: string; payouts_enabled: boolean; stripe_onboarding_status: string;
  payout_threshold_minor: number; payout_currency: string; stripe_connected_account_id: string | null;
  email_normalized: string;
};

type Ctx = { partner: PartnerRow; runId: string; periodStart: string; periodEnd: string; periodKey: string; mode: "test" | "live" };

/** Marque le lot payé et les écritures `paid` — UNIQUEMENT après confirmation de Stripe. */
async function settle(db: SqlExecutor, p: PartnerRow, transferRowId: string, stripeTransferId: string, amount: number, periodKey: string, reconciled: boolean): Promise<void> {
  await withService(db, async (tx) => {
    await tx.query(
      `update clonestore_pp_transfers
          set status='transferred', stripe_transfer_id=$2, paid_at=now(), updated_at=now(),
              failure_code=null, failure_reason=null, required_action=null
        where id=$1`,
      [transferRowId, stripeTransferId],
    );
    // Les écritures du lot passent à `paid` MAINTENANT, pas avant.
    const items = await tx.query<{ entry_id: string }>(
      `select entry_id from clonestore_pp_transfer_items where transfer_id=$1 and released_at is null`, [transferRowId],
    );
    for (const it of items.rows) {
      await tx.query(`update clonestore_pp_commission_entries set status='paid', updated_at=now() where id=$1 and status='pending'`, [it.entry_id]);
      await tx.query(
        `insert into clonestore_pp_commission_events (entry_id, partner_id, type, from_status, to_status, reason, evidence_safe)
         values ($1,$2,'entry_paid','pending','paid',$3,$4::jsonb)`,
        [it.entry_id, p.id, `versement ${periodKey}`, JSON.stringify({ transferId: stripeTransferId })],
      );
    }
    await tx.query(`update clonestore_pp_partners set last_payout_at=now() where id=$1`, [p.id]);
    await recordAudit(tx, {
      actor: "system",
      action: reconciled ? "payout.reconciled" : "payout.transferred",
      entityType: "partner", entityId: p.id,
      reason: reconciled ? `rapprochement du versement ${periodKey} (transfert déjà émis chez Stripe)` : `versement ${periodKey}`,
      next: { transferId: stripeTransferId, amountMinor: amount, entries: items.rows.length },
    });
    // E-mail de versement : JAMAIS en dry-run (ce chemin n'est atteint qu'en mode réel).
    await enqueuePartnerEmailTx(tx, {
      partnerId: p.id, kind: "transfer_executed", toEmail: p.email_normalized,
      idempotencyKey: `pp-email:transfer_executed:${transferRowId}`,
      payload: { amount: formatMinorAmount(amount, p.payout_currency), period: periodKey },
    });
  });
}

/** Échec : le lot est libéré (les commissions retournent au pool) ou gelé pour rapprochement. */
async function failBatch(
  db: SqlExecutor, p: PartnerRow, transferRowId: string,
  fail: { klass: "failed_retryable" | "failed_permanent" | "reconciliation_required"; message: string; requiredAction: string },
  code: string | null,
): Promise<void> {
  await withService(db, async (tx) => {
    await tx.query(
      `update clonestore_pp_transfers
          set status=$2, failure_code=$3, failure_reason=$4, required_action=$5, updated_at=now()
        where id=$1`,
      [transferRowId, fail.klass, code, fail.message, fail.requiredAction],
    );

    if (fail.klass === "reconciliation_required") {
      // Issue INCONNUE : on ne libère RIEN et on ne paie RIEN. Les écritures restent
      // verrouillées sur ce lot : elles ne peuvent pas être versées deux fois.
      await recordAudit(tx, {
        actor: "system", action: "payout.reconciliation_required", entityType: "partner", entityId: p.id,
        reason: fail.message, next: { requiredAction: fail.requiredAction },
      });
      return;
    }

    // Échec net : le lot est LIBÉRÉ, les commissions redeviennent disponibles.
    await tx.query(`update clonestore_pp_transfer_items set released_at=now() where transfer_id=$1 and released_at is null`, [transferRowId]);
    await recordAudit(tx, {
      actor: "system", action: "payout.failed", entityType: "partner", entityId: p.id,
      reason: fail.message, next: { klass: fail.klass, requiredAction: fail.requiredAction },
    });
    await enqueuePartnerEmailTx(tx, {
      partnerId: p.id, kind: "payout_blocked", toEmail: p.email_normalized,
      idempotencyKey: `pp-email:payout_blocked:${transferRowId}:${fail.klass}`,
      payload: { reason: fail.message, action: fail.requiredAction },
    });
  });
}

async function processPartnerPayout(db: SqlExecutor, deps: PayoutDeps, ctx: Ctx): Promise<PayoutOutcome> {
  const p = ctx.partner;

  // ── 1. Lot laissé en suspens — TOUTE période confondue ─────────────────────
  // Un lot dont l'issue est inconnue doit être rapproché AVANT d'en créer un nouveau.
  // Ses commissions restent verrouillées : elles ne peuvent pas partir dans un second lot.
  const inFlight = await withService(db, (tx) =>
    tx.query<{ id: string; status: string; amount_minor: number; batch_hash: string | null; idempotency_key: string; period_start: string }>(
      `select id, status, amount_minor, batch_hash, idempotency_key, period_start
         from clonestore_pp_transfers
        where partner_id=$1 and status in ('processing','reconciliation_required')
        order by created_at asc limit 1`,
      [p.id],
    ),
  );
  const stuck = inFlight.rows[0];
  if (stuck) {
    if (!p.stripe_connected_account_id) {
      return { partnerId: p.id, amountMinor: 0, status: "reconciliation_required", reason: "Compte Stripe Connect absent alors qu'un lot attend un rapprochement." };
    }
    const stuckKey = monthPeriodKey(new Date(stuck.period_start));
    const amount = Number(stuck.amount_minor) || 0;

    // On interroge Stripe AVANT toute recréation : jamais deux transferts.
    const found = await deps.findTransfer({
      idempotencyKey: stuck.idempotency_key,
      destination: p.stripe_connected_account_id,
      metadata: { partner_id: p.id, period: stuckKey, batch_hash: stuck.batch_hash ?? "" },
    });
    if (found) {
      await settle(db, p, stuck.id, found.id, amount, stuckKey, true);
      return { partnerId: p.id, amountMinor: amount, status: "reconciled", stripeTransferId: found.id };
    }
    // Stripe n'a rien émis : le transfert n'est jamais parti → on réémet SUR LA MÊME LIGNE,
    // avec la MÊME clé d'idempotence (même lot, même empreinte).
    return await attemptTransfer(
      db, deps, { ...ctx, periodKey: stuckKey }, stuck.id, amount, stuck.idempotency_key, stuck.batch_hash ?? "",
    );
  }

  // Déjà versé pour CETTE période ?
  const done = await withService(db, (tx) =>
    tx.query<{ stripe_transfer_id: string | null }>(
      `select stripe_transfer_id from clonestore_pp_transfers
        where partner_id=$1 and period_start=$2::date and period_end=($3::date - interval '1 day')
          and status in ('transferred','paid')`,
      [p.id, ctx.periodStart, ctx.periodEnd],
    ),
  );
  if (done.rows.length) {
    return { partnerId: p.id, amountMinor: 0, status: "already_paid", stripeTransferId: done.rows[0].stripe_transfer_id ?? undefined };
  }

  // ── 2. Éligibilité ────────────────────────────────────────────────────────
  const gate = await withService(db, async (tx) => {
    const dispute = await tx.query(`select 1 from clonestore_pp_commission_entries where partner_id=$1 and status='frozen' limit 1`, [p.id]);
    const balances = await getPartnerBalances(tx, p.id);
    return decidePayout({
      partnerStatus: p.status as "active",
      payoutsEnabled: p.payouts_enabled,
      onboardingStatus: p.stripe_onboarding_status as "complete",
      availableMinor: balances.availableMinor,
      frozenMinor: balances.frozenMinor,
      thresholdMinor: Number(p.payout_threshold_minor) || 0,
      hasOpenDispute: dispute.rows.length > 0,
    });
  });
  if (!gate.eligible) return { partnerId: p.id, amountMinor: 0, status: "skipped", reason: gate.reason };
  if (!p.stripe_connected_account_id) return { partnerId: p.id, amountMinor: 0, status: "skipped", reason: "no_connected_account" };

  // ── 3. Réservation ATOMIQUE du lot — les écritures restent `pending` ───────
  // Le verrou anti double-versement est `uq_pp_item_entry_live` (une écriture ne peut être
  // rattachée qu'à UN lot vivant), PAS le statut `paid`.
  const reserved = await withService(db, async (tx) => {
    // Sélection RESTREINTE au mode Stripe réel : une écriture Test ne peut pas entrer
    // dans un lot Live, ni l'inverse (garde dans la requête, pas dans un filtre applicatif).
    const entries = await payableEntries(tx, p.id, ctx.mode, true);
    const amount = entries.reduce((s, e) => s + e.commission_minor, 0);
    if (amount <= 0) return { blocked: "nothing_payable" as const };

    // Lot homogène obligatoire : un seul mode, une seule devise, cohérente avec le compte.
    const homo = assertHomogeneousBatch(entries, ctx.mode, p.payout_currency);
    if (!homo.ok) return { blocked: homo.reason };

    if (amount < (Number(p.payout_threshold_minor) || 0)) return { blocked: "below_threshold" as const };

    const hash = batchHash(entries.map((e) => e.id));
    const key = payoutIdempotencyKey(p.id, ctx.periodKey, hash);

    const ins = await tx.query<{ id: string }>(
      `insert into clonestore_pp_transfers
         (partner_id, payout_run_id, period_start, period_end, amount_minor, currency, entry_count,
          stripe_mode, status, idempotency_key, batch_hash)
       values ($1,$2,$3::date,($4::date - interval '1 day'),$5,$6,$7,$10,'processing',$8,$9)
       returning id`,
      [p.id, ctx.runId, ctx.periodStart, ctx.periodEnd, amount, homo.currency, entries.length, key, hash, ctx.mode],
    );
    const transferRowId = ins.rows[0].id;

    for (const e of entries) {
      await tx.query(
        `insert into clonestore_pp_transfer_items (transfer_id, partner_id, entry_id, amount_minor) values ($1,$2,$3,$4)`,
        [transferRowId, p.id, e.id, e.commission_minor],
      );
    }
    await tx.query(
      `insert into clonestore_pp_commission_events (partner_id, type, reason, evidence_safe)
       values ($1,'transfer_created',$2,$3::jsonb)`,
      [p.id, `lot ${ctx.periodKey} réservé`, JSON.stringify({ amountMinor: amount, entryCount: entries.length, batchHash: hash })],
    );
    return { transferRowId, amount, key, hash };
  });

  // Raison EXACTE de l'exclusion — jamais un « below_threshold » attrape-tout.
  if ("blocked" in reserved) return { partnerId: p.id, amountMinor: 0, status: "skipped", reason: reserved.blocked };

  return await attemptTransfer(db, deps, ctx, reserved.transferRowId, reserved.amount, reserved.key, reserved.hash);
}

/** Appelle Stripe puis règle le lot. Les écritures ne deviennent `paid` qu'ici, après succès. */
async function attemptTransfer(
  db: SqlExecutor, deps: PayoutDeps, ctx: Ctx,
  transferRowId: string, amount: number, idempotencyKey: string, hash: string,
): Promise<PayoutOutcome> {
  const p = ctx.partner;

  await withService(db, (tx) =>
    tx.query(`update clonestore_pp_transfers set status='processing', attempts=attempts+1, last_attempt_at=now(), updated_at=now() where id=$1`, [transferRowId]),
  );

  try {
    const transfer = await deps.createTransfer({
      amountMinor: amount,
      currency: p.payout_currency,
      destination: p.stripe_connected_account_id as string,
      idempotencyKey,
      metadata: { partner_id: p.id, period: ctx.periodKey, batch_hash: hash },
    });
    await settle(db, p, transferRowId, transfer.id, amount, ctx.periodKey, false);
    return { partnerId: p.id, amountMinor: amount, status: "transferred", stripeTransferId: transfer.id };
  } catch (err) {
    const e = err as { code?: string; type?: string; message?: string };
    const fail = classifyTransferFailure({ code: e.code, type: e.type ?? (err as Error)?.name, message: e.message });
    await failBatch(db, p, transferRowId, fail, e.code ?? null);
    return {
      partnerId: p.id,
      amountMinor: 0,
      status: fail.klass,
      reason: fail.message,
      requiredAction: fail.requiredAction,
    };
  }
}

// ── Notification « commission disponible » (exactement une fois) ─────────────

/**
 * Prévient les cabinets dont des commissions viennent d'arriver à maturité.
 * `available_notified_at` garantit un seul e-mail par écriture. N'écrit AUCUN montant :
 * seule une colonne non financière est renseignée (le trigger du ledger l'autorise).
 */
export async function notifyAvailableCommissions(db: SqlExecutor): Promise<{ notified: number }> {
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ partner_id: string; email_normalized: string; total: string; n: string }>(
      `select e.partner_id, p.email_normalized,
              sum(e.commission_minor) as total, count(*) as n
         from clonestore_pp_commission_entries e
         join clonestore_pp_partners p on p.id = e.partner_id
        where e.status='pending' and e.available_at <= now() and e.available_notified_at is null
          and e.entry_type='commission'
        group by e.partner_id, p.email_normalized`,
    );

    for (const r of rows) {
      const cur = await tx.query<{ payout_currency: string }>(`select payout_currency from clonestore_pp_partners where id=$1`, [r.partner_id]);
      await enqueuePartnerEmailTx(tx, {
        partnerId: r.partner_id, kind: "commission_available", toEmail: r.email_normalized,
        // Une clé par cabinet ET par vague : un cabinet peut être notifié à nouveau le mois suivant.
        idempotencyKey: `pp-email:commission_available:${r.partner_id}:${batchHash([r.total, r.n])}`,
        payload: { amount: formatMinorAmount(Number(r.total) || 0, cur.rows[0]?.payout_currency ?? "eur"), count: String(r.n) },
      });
      await tx.query(
        `update clonestore_pp_commission_entries set available_notified_at=now()
          where partner_id=$1 and status='pending' and available_at <= now() and available_notified_at is null`,
        [r.partner_id],
      );
    }
    return { notified: rows.length };
  });
}
