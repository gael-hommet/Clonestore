// Versements automatiques Stripe Connect — sur PostgreSQL réel.
//
// Prouve les invariants financiers du circuit :
//   §4 dry-run = prévisualisation pure (aucune mutation, rejouable) ;
//   §5 mode réel : un seul transfert, clé d'idempotence déterministe, deux workers → un versement ;
//   §6 échecs : lot libéré (retryable/permanent) ou gelé pour rapprochement (issue inconnue) ;
//        une commission n'est JAMAIS `paid` sans confirmation Stripe ;
//   §9-D rapprochement : somme disponible = somme du lot = somme transférée.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { withService } from "../server/runtime";
import { createApplication } from "../server/applications";
import { attachAttributionAtSignup } from "../server/attribution";
import { applyPartnerCommercialEvent } from "../server/commission";
import { getPartnerBalances } from "../server/summary";
import {
  runMonthlyPayouts, previewPayouts, notifyAvailableCommissions, assertHomogeneousBatch, type PayoutDeps,
} from "../server/payouts";

let h: PartnerHarness;
beforeAll(async () => { h = await createPartnerHarness(); });
afterAll(async () => { await h.close(); });

const NOW = new Date();
const PERIOD = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 15));

/** UUID déterministe et valide, dérivé du tag (les tags ne sont pas hexadécimaux). */
function subjectUuid(tag: string): string {
  const hex = createHash("sha256").update(tag).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Cabinet actif, Connect prêt, réserve 0, seuil bas, avec UNE commission de 89,80 € mature. */
async function partnerWithMatureCommission(tag: string, opts?: { thresholdMinor?: number; payoutsEnabled?: boolean; connected?: boolean }): Promise<string> {
  const subject = subjectUuid(tag);
  const partnerId = await withService(h.db, async (tx) => {
    const app = await createApplication(tx, {
      cabinetName: `Cabinet ${tag}`, firstName: "A", lastName: "B", email: `${tag}@cab-${tag}.fr`,
      country: "FR", cabinetType: "expertise_comptable", consentContact: true, consentPrivacy: true,
    });
    if (!app.ok || app.duplicate || app.admitted !== "auto") throw new Error("auto-provisioning attendu");
    await tx.query(
      `update clonestore_pp_partners
          set status='active', contract_accepted_at=now(), activated_at=now(), reserve_days=0,
              payout_threshold_minor=$2, payouts_enabled=$3,
              stripe_onboarding_status=$4, stripe_connected_account_id=$5
        where id=$1`,
      [
        app.partnerId, opts?.thresholdMinor ?? 5_000, opts?.payoutsEnabled ?? true,
        (opts?.payoutsEnabled ?? true) ? "complete" : "restricted",
        (opts?.connected ?? true) ? `acct_${tag}` : null,
      ],
    );
    const t = await tx.query<{ touch_key: string }>(
      `insert into clonestore_pp_referral_touches (partner_id, source, expires_at)
       values ($1,'link', now()+interval '90 days') returning touch_key`, [app.partnerId],
    );
    await attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: `dg@soc-${tag}.fr`, touchKey: t.rows[0].touch_key });
    return app.partnerId;
  });

  await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, {
    eventId: `evt_${tag}`, type: "invoice.paid", livemode: false, eventCreated: 1,
    subscriptionId: `sub_${tag}`, customerId: `cus_${tag}`, subjectUserId: subject,
    invoiceId: `in_${tag}`, paymentIntentId: `pi_${tag}`,
    totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur",
  }));
  return partnerId;
}

const okDeps = (calls: string[]): PayoutDeps => ({
  createTransfer: async (i) => { calls.push(i.idempotencyKey); return { id: `tr_${calls.length}_${i.metadata.partner_id.slice(0, 6)}` }; },
  findTransfer: async () => null,
  stripeIsLive: () => false,
  productionAuthorized: () => false,
  stripeMode: () => "test",
});

const forbiddenDeps: PayoutDeps = {
  createTransfer: async () => { throw new Error("Stripe ne doit JAMAIS être appelé ici"); },
  findTransfer: async () => { throw new Error("Stripe ne doit JAMAIS être interrogé ici"); },
  stripeIsLive: () => false,
  productionAuthorized: () => false,
  stripeMode: () => "test",
};

async function counts(partnerId: string) {
  const r = await withService(h.db, (tx) => tx.query<{ transfers: number; items: number; runs: number; paid: number }>(
    `select
       (select count(*)::int from clonestore_pp_transfers where partner_id=$1) transfers,
       (select count(*)::int from clonestore_pp_transfer_items where partner_id=$1 and released_at is null) items,
       (select count(*)::int from clonestore_pp_payout_runs) runs,
       (select count(*)::int from clonestore_pp_commission_entries where partner_id=$1 and status='paid') paid`,
    [partnerId],
  ));
  return r.rows[0];
}

// ── §4 — DRY-RUN : aucune mutation financière ────────────────────────────────

describe("§4 dry-run — prévisualisation pure", () => {
  it("ne crée aucun transfert, ne paie aucune commission, ne pose aucun verrou", async () => {
    const pid = await partnerWithMatureCommission("dry");

    const run = await runMonthlyPayouts(h.db, forbiddenDeps, { now: PERIOD, dryRunOverride: true });
    expect(run.dryRun).toBe(true);
    expect(run.runId).toBeNull();
    expect(run.transfersCreated).toBe(0);

    const line = run.preview?.lines.find((l) => l.partnerId === pid);
    expect(line?.outcome).toBe("included");
    expect(line?.amountMinor).toBe(8_980);
    expect(line?.entryCount).toBe(1);

    const c = await counts(pid);
    expect(c.transfers).toBe(0);
    expect(c.items).toBe(0);
    expect(c.runs).toBe(0); // pas même un verrou de période
    expect(c.paid).toBe(0);

    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    expect(bal.availableMinor).toBe(8_980); // TOUJOURS disponible
    expect(bal.paidMinor).toBe(0);
  });

  it("aucun e-mail de versement n'est enfilé en dry-run", async () => {
    const mails = await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestore_pp_email_outbox where kind='transfer_executed'`,
    ));
    expect(mails.rows[0].n).toBe(0);
  });

  it("est rejouable : trois simulations, toujours le même montant, toujours zéro mutation", async () => {
    for (let i = 0; i < 3; i++) {
      const p = await previewPayouts(h.db, { now: PERIOD });
      expect(p.totalAmountMinor).toBe(8_980);
    }
    const runs = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestore_pp_payout_runs`));
    expect(runs.rows[0].n).toBe(0);
  });

  it("puis le VRAI versement reste possible : la simulation n'a rien consommé", async () => {
    const pid = (await withService(h.db, (tx) => tx.query<{ id: string }>(`select id from clonestore_pp_partners where email_normalized='dry@cab-dry.fr'`))).rows[0].id;
    const calls: string[] = [];
    const real = await runMonthlyPayouts(h.db, okDeps(calls), { now: PERIOD, dryRunOverride: false });
    expect(real.perPartner.find((x) => x.partnerId === pid)?.status).toBe("transferred");
    expect(calls).toHaveLength(1);

    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    expect(bal.paidMinor).toBe(8_980);
    expect(bal.availableMinor).toBe(0);
  });
});

// ── §5 — Mode réel : idempotence ─────────────────────────────────────────────

describe("§5 mode réel — idempotence", () => {
  it("clé déterministe partner-payout:<partnerId>:<periodKey>:<batchHash>", async () => {
    const pid = await partnerWithMatureCommission("idem");
    const calls: string[] = [];
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 2, 15));
    await runMonthlyPayouts(h.db, okDeps(calls), { now: period, dryRunOverride: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(new RegExp(`^partner-payout:${pid}:\\d{4}-\\d{2}:[0-9a-f]{32}$`));
  });

  it("relancer le cron sur la même période ne crée JAMAIS un second transfert", async () => {
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 2, 15));
    const calls: string[] = [];
    const again = await runMonthlyPayouts(h.db, okDeps(calls), { now: period, dryRunOverride: false });
    expect(again.skipped).toBe("already_running_or_done"); // le verrou de période tient
    expect(calls).toHaveLength(0);
  });

  it("double worker simultané → exactement UN transfert", async () => {
    const pid = await partnerWithMatureCommission("race");
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 3, 15));
    const calls: string[] = [];
    const deps = okDeps(calls);

    const [a, b] = await Promise.all([
      runMonthlyPayouts(h.db, deps, { now: period, dryRunOverride: false }),
      runMonthlyPayouts(h.db, deps, { now: period, dryRunOverride: false }),
    ]);
    const winners = [a, b].filter((r) => !r.skipped);
    expect(winners).toHaveLength(1); // un seul worker détient le run

    expect(calls).toHaveLength(1); // un seul appel Stripe
    const t = await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestore_pp_transfers where partner_id=$1 and status='transferred'`, [pid],
    ));
    expect(t.rows[0].n).toBe(1);
  });
});

// ── §6 — Échecs et rapprochement ─────────────────────────────────────────────

describe("§6 échecs — l'argent n'est jamais perdu ni inventé", () => {
  it("solde plateforme insuffisant → lot LIBÉRÉ, commission toujours disponible, JAMAIS payée", async () => {
    const pid = await partnerWithMatureCommission("bal");
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 4, 15));
    const deps: PayoutDeps = {
      createTransfer: async () => { const e = new Error("Insufficient funds") as Error & { code: string }; e.code = "balance_insufficient"; throw e; },
      findTransfer: async () => null,
      stripeIsLive: () => false, productionAuthorized: () => false, stripeMode: () => "test" as const,
    };
    const run = await runMonthlyPayouts(h.db, deps, { now: period, dryRunOverride: false });
    const mine = run.perPartner.find((x) => x.partnerId === pid);
    expect(mine?.status).toBe("failed_retryable");
    expect(mine?.reason).toContain("solde de la plateforme");
    expect(mine?.requiredAction).toBeTruthy(); // l'admin sait quoi faire

    // La commission n'est PAS payée et redevient sélectionnable.
    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    expect(bal.paidMinor).toBe(0);
    expect(bal.availableMinor).toBe(8_980);
    const c = await counts(pid);
    expect(c.items).toBe(0); // le lot a été libéré
    expect(c.paid).toBe(0);

    // Un e-mail « action nécessaire » a été enfilé — jamais un e-mail de versement.
    const mails = await withService(h.db, (tx) => tx.query<{ kind: string }>(
      `select kind from clonestore_pp_email_outbox where partner_id=$1`, [pid],
    ));
    expect(mails.rows.map((m) => m.kind)).toContain("payout_blocked");
    expect(mails.rows.map((m) => m.kind)).not.toContain("transfer_executed");
  });

  it("le mois suivant, la commission libérée est bien reversée", async () => {
    const pid = (await withService(h.db, (tx) => tx.query<{ id: string }>(`select id from clonestore_pp_partners where email_normalized='bal@cab-bal.fr'`))).rows[0].id;
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 5, 15));
    const calls: string[] = [];
    const run = await runMonthlyPayouts(h.db, okDeps(calls), { now: period, dryRunOverride: false });
    expect(run.perPartner.find((x) => x.partnerId === pid)?.status).toBe("transferred");
    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    expect(bal.paidMinor).toBe(8_980);
  });

  it("compte Connect incomplet → jamais de transfert, raison explicite", async () => {
    const pid = await partnerWithMatureCommission("inc", { payoutsEnabled: false });
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 6, 15));
    const calls: string[] = [];
    const run = await runMonthlyPayouts(h.db, okDeps(calls), { now: period, dryRunOverride: false });
    const mine = run.perPartner.find((x) => x.partnerId === pid);
    expect(mine?.status).toBe("skipped");
    expect(mine?.reason).toBe("stripe_not_ready");
    expect(calls.every((k) => !k.includes(pid))).toBe(true);
  });

  it("seuil non atteint → reporté, aucune écriture consommée", async () => {
    const pid = await partnerWithMatureCommission("thr", { thresholdMinor: 100_000 });
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 7, 15));
    const calls: string[] = [];
    const run = await runMonthlyPayouts(h.db, okDeps(calls), { now: period, dryRunOverride: false });
    const mine = run.perPartner.find((x) => x.partnerId === pid);
    expect(mine?.status).toBe("skipped");
    expect(mine?.reason).toBe("below_threshold");
    const c = await counts(pid);
    expect(c.transfers).toBe(0);
    expect(c.paid).toBe(0);
  });

  it("TIMEOUT Stripe → reconciliation_required : rien payé, rien libéré, rien perdu", async () => {
    const pid = await partnerWithMatureCommission("tmo");
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 8, 15));
    const timeoutDeps: PayoutDeps = {
      createTransfer: async () => { const e = new Error("timeout") as Error & { type: string }; e.type = "StripeConnectionError"; throw e; },
      findTransfer: async () => null,
      stripeIsLive: () => false, productionAuthorized: () => false, stripeMode: () => "test" as const,
    };
    const run = await runMonthlyPayouts(h.db, timeoutDeps, { now: period, dryRunOverride: false });
    const mine = run.perPartner.find((x) => x.partnerId === pid);
    expect(mine?.status).toBe("reconciliation_required");

    // Ni payé, ni libéré : le lot reste verrouillé → aucun double versement possible.
    const c = await counts(pid);
    expect(c.paid).toBe(0);
    expect(c.items).toBe(1); // les écritures restent rattachées au lot
    const t = await withService(h.db, (tx) => tx.query<{ status: string; required_action: string }>(
      `select status, required_action from clonestore_pp_transfers where partner_id=$1`, [pid],
    ));
    expect(t.rows[0].status).toBe("reconciliation_required");
    expect(t.rows[0].required_action).toContain("Rapprochement");
  });

  it("reprise après timeout : Stripe AVAIT créé le transfert → rapproché, jamais recréé", async () => {
    const pid = (await withService(h.db, (tx) => tx.query<{ id: string }>(`select id from clonestore_pp_partners where email_normalized='tmo@cab-tmo.fr'`))).rows[0].id;
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 9, 15));
    const created: string[] = [];
    const deps: PayoutDeps = {
      // Le transfert existait déjà chez Stripe : on le RETROUVE, on ne le recrée jamais.
      createTransfer: async (i) => { created.push(i.idempotencyKey); return { id: "tr_never" }; },
      findTransfer: async () => ({ id: "tr_already_sent" }),
      stripeIsLive: () => false, productionAuthorized: () => false, stripeMode: () => "test" as const,
    };
    const run = await runMonthlyPayouts(h.db, deps, { now: period, dryRunOverride: false });
    const mine = run.perPartner.find((x) => x.partnerId === pid);
    expect(mine?.status).toBe("reconciled");
    expect(created).toHaveLength(0); // AUCUNE recréation : pas de double versement

    const t = await withService(h.db, (tx) => tx.query<{ status: string; stripe_transfer_id: string }>(
      `select status, stripe_transfer_id from clonestore_pp_transfers where partner_id=$1`, [pid],
    ));
    expect(t.rows[0].status).toBe("transferred");
    expect(t.rows[0].stripe_transfer_id).toBe("tr_already_sent");
    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    expect(bal.paidMinor).toBe(8_980); // payé APRÈS confirmation du transfert réel
  });

  it("litige ouvert → aucun versement (gel de sécurité)", async () => {
    const pid = await partnerWithMatureCommission("dsp");
    await withService(h.db, (tx) => tx.query(
      `update clonestore_pp_commission_entries set status='frozen', frozen_reason='dispute' where partner_id=$1`, [pid],
    ));
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 10, 15));
    const calls: string[] = [];
    const run = await runMonthlyPayouts(h.db, okDeps(calls), { now: period, dryRunOverride: false });
    const mine = run.perPartner.find((x) => x.partnerId === pid);
    expect(mine?.status).toBe("skipped");
    expect(mine?.reason).toBe("open_dispute");
  });
});

// ── §9-D — Rapprochement comptable ───────────────────────────────────────────

describe("§9-D rapprochement — les sommes se recoupent exactement", () => {
  it("somme des commissions disponibles = somme du lot = somme transférée", async () => {
    const pid = await partnerWithMatureCommission("rec");
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 11, 15));

    const before = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    const availableBefore = before.availableMinor;
    expect(availableBefore).toBe(8_980);

    const transferred: number[] = [];
    const deps: PayoutDeps = {
      createTransfer: async (i) => { transferred.push(i.amountMinor); return { id: `tr_rec_${transferred.length}` }; },
      findTransfer: async () => null,
      stripeIsLive: () => false, productionAuthorized: () => false, stripeMode: () => "test" as const,
    };
    await runMonthlyPayouts(h.db, deps, { now: period, dryRunOverride: false });

    const batch = await withService(h.db, (tx) => tx.query<{ amount: string; items: string }>(
      `select t.amount_minor::text amount,
              (select coalesce(sum(i.amount_minor),0)::text from clonestore_pp_transfer_items i where i.transfer_id = t.id) items
         from clonestore_pp_transfers t where t.partner_id=$1 and t.status='transferred'`,
      [pid],
    ));
    expect(Number(batch.rows[0].amount)).toBe(availableBefore); // lot = disponible
    expect(Number(batch.rows[0].items)).toBe(availableBefore);  // lignes du lot = lot
    expect(transferred[0]).toBe(availableBefore);               // transféré = lot

    const after = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    expect(after.paidMinor).toBe(availableBefore);
    expect(after.availableMinor).toBe(0);
  });
});

// ── §8 — Notification de disponibilité ───────────────────────────────────────

describe("§8 e-mails — commission disponible", () => {
  it("prévient le cabinet une seule fois, sans toucher au montant", async () => {
    const pid = await partnerWithMatureCommission("ntf", { thresholdMinor: 100_000 });
    const before = await withService(h.db, (tx) => getPartnerBalances(tx, pid));

    await notifyAvailableCommissions(h.db);
    await notifyAvailableCommissions(h.db); // second passage : aucun doublon

    const mails = await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestore_pp_email_outbox where partner_id=$1 and kind='commission_available'`, [pid],
    ));
    expect(mails.rows[0].n).toBe(1);

    const after = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    expect(after.availableMinor).toBe(before.availableMinor); // aucun montant modifié
    expect(after.paidMinor).toBe(before.paidMinor);
  });
});

// ── Chantier 1.2 — stripe_mode DYNAMIQUE et lot homogène ─────────────────────

describe("§1.2 mode Stripe — une écriture Test n'entre JAMAIS dans un lot Live", () => {
  it("le lot porte le mode RÉEL du client Stripe, jamais 'test' en dur", async () => {
    const pid = await partnerWithMatureCommission("mode");
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 12, 15));
    const calls: string[] = [];
    await runMonthlyPayouts(h.db, okDeps(calls), { now: period, dryRunOverride: false });

    const t = await withService(h.db, (tx) => tx.query<{ stripe_mode: string }>(
      `select stripe_mode from clonestore_pp_transfers where partner_id=$1`, [pid],
    ));
    expect(t.rows[0].stripe_mode).toBe("test"); // deps.stripeMode() = test → lot test
  });

  it("un client Stripe LIVE ignore les écritures TEST : rien à verser", async () => {
    const pid = await partnerWithMatureCommission("live");
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 13, 15));
    const calls: string[] = [];
    // Client Stripe en mode live, mais TOUTES les commissions du cabinet sont en mode test.
    const liveDeps: PayoutDeps = {
      ...okDeps(calls),
      stripeIsLive: () => true,
      productionAuthorized: () => true, // gardes satisfaites : on teste le filtre de MODE, pas la garde
      stripeMode: () => "live",
    };
    const run = await runMonthlyPayouts(h.db, liveDeps, { now: period, dryRunOverride: false });
    const mine = run.perPartner.find((x) => x.partnerId === pid);
    expect(mine?.status).toBe("skipped");
    expect(mine?.reason).toBe("nothing_payable"); // les écritures test sont INVISIBLES en live
    expect(calls).toHaveLength(0); // aucun transfert Live sur des commissions Test

    // Les commissions Test restent intactes et disponibles.
    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, pid));
    expect(bal.availableMinor).toBe(8_980);
    expect(bal.paidMinor).toBe(0);
  });

  it("la prévisualisation annonce le mode Stripe et la devise", async () => {
    const p = await previewPayouts(h.db, { now: PERIOD, stripeMode: "test" });
    expect(p.stripeMode).toBe("test");
    expect(p.lines.every((l) => l.currency === "eur")).toBe(true);
  });

  it("garde pure : lot à modes mélangés ou devises mélangées → REFUSÉ", () => {
    const eurTest = { id: "a", commission_minor: 1000, currency: "eur", stripe_mode: "test" };
    const eurLive = { id: "b", commission_minor: 1000, currency: "eur", stripe_mode: "live" };
    const chfTest = { id: "c", commission_minor: 1000, currency: "chf", stripe_mode: "test" };

    expect(assertHomogeneousBatch([eurTest, eurLive], "test", "eur")).toEqual({ ok: false, reason: "mixed_stripe_mode" });
    expect(assertHomogeneousBatch([eurTest, chfTest], "test", "eur")).toEqual({ ok: false, reason: "mixed_currency" });
    expect(assertHomogeneousBatch([eurLive], "test", "eur")).toEqual({ ok: false, reason: "stripe_mode_mismatch" });
    expect(assertHomogeneousBatch([chfTest], "test", "eur")).toEqual({ ok: false, reason: "currency_mismatch_with_payout_account" });
    expect(assertHomogeneousBatch([], "test", "eur")).toEqual({ ok: false, reason: "nothing_payable" });
    expect(assertHomogeneousBatch([eurTest], "test", "eur")).toEqual({ ok: true, currency: "eur" });
  });

  it("garde Live fail-closed : clé live sans autorisation → aucun transfert", async () => {
    const period = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 14, 15));
    const calls: string[] = [];
    const blocked: PayoutDeps = {
      ...okDeps(calls),
      stripeIsLive: () => true,
      productionAuthorized: () => false, // la garde refuse
      stripeMode: () => "live",
    };
    const run = await runMonthlyPayouts(h.db, blocked, { now: period, dryRunOverride: false });
    expect(run.skipped).toBe("live_not_authorized");
    expect(calls).toHaveLength(0);
  });
});
