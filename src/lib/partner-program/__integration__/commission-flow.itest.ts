// Flux commission de bout en bout sur PostgreSQL réel (PGlite) :
// candidature → cabinet actif → attribution → invoice.paid → commission → dédup →
// remboursement partiel → litige/gel → dégel → versement dry-run (sans double).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { withService } from "../server/runtime";
import { createApplication, acceptApplication } from "../server/applications";
import { attachAttributionAtSignup } from "../server/attribution";
import { applyPartnerCommercialEvent, type PartnerCommercialEvent } from "../server/commission";
import { getPartnerBalances } from "../server/summary";
import { runMonthlyPayouts, type PayoutDeps } from "../server/payouts";

let h: PartnerHarness;
beforeAll(async () => { h = await createPartnerHarness(); });
afterAll(async () => { await h.close(); });

const SUBJECT = "11111111-1111-4111-8111-111111111111";

async function setupActivePartner(): Promise<{ partnerId: string; slug: string; touchKey: string }> {
  return withService(h.db, async (tx) => {
    const app = await createApplication(tx, {
      cabinetName: "Cabinet Alpha", firstName: "Léa", lastName: "Martin", email: "lea@cabinet-alpha.fr",
      country: "FR", cabinetType: "expertise_comptable", consentContact: true, consentPrivacy: true,
    });
    if (!app.ok) throw new Error("application failed");
    // La candidature PROVISIONNE désormais le partenaire automatiquement (aucun admin).
    if (app.duplicate || app.admitted !== "auto") throw new Error("auto-provisioning attendu");
    const accepted = { partnerId: app.partnerId, publicSlug: app.publicSlug };
    const partnerId = accepted.partnerId;
    // Simule contrat + onboarding Connect complet + activation.
    await tx.query(
      `update clonestore_pp_partners set status='active', contract_accepted_at=now(), stripe_connected_account_id='acct_test', stripe_onboarding_status='complete', payouts_enabled=true, activated_at=now() where id=$1`,
      [partnerId],
    );
    // Touch de lien (clic serveur).
    const t = await tx.query<{ touch_key: string }>(
      `insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now() + interval '90 days') returning touch_key`,
      [partnerId],
    );
    return { partnerId, slug: accepted.publicSlug, touchKey: t.rows[0].touch_key };
  });
}

const invoicePaid = (over: Partial<PartnerCommercialEvent> = {}): PartnerCommercialEvent => ({
  eventId: "evt_inv_static", type: "invoice.paid", livemode: false, eventCreated: 1000,
  subscriptionId: "sub_static", customerId: "cus_1", subjectUserId: SUBJECT,
  invoiceId: "in_static", paymentIntentId: "pi_static",
  totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur",
  ...over,
});

describe("flux commission de bout en bout", () => {
  it("invoice.paid sur 449 € HT → commission 89,80 € (8980 centimes)", async () => {
    const { partnerId, touchKey } = await setupActivePartner();
    await withService(h.db, (tx) => attachAttributionAtSignup(tx, { subjectUserId: SUBJECT, subjectEmail: "client@societe-cliente.fr", touchKey }));

    const res = await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, invoicePaid()));
    expect(res.applied).toBe(true);
    expect(res.commissionMinor).toBe(8_980);

    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, partnerId));
    // Réserve 30j → en réserve, pas encore disponible.
    expect(bal.pendingReserveMinor).toBe(8_980);
    expect(bal.availableMinor).toBe(0);
    expect(bal.lifetimeGrossMinor).toBe(8_980);

    // Attribution verrouillée + relation client créée.
    const locked = await withService(h.db, (tx) => tx.query<{ status: string }>(`select status from clonestore_pp_attributions where subject_user_id=$1`, [SUBJECT]));
    expect(locked.rows[0].status).toBe("locked");
    const cust = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_customers where partner_id=$1`, [partnerId]));
    expect(cust.rows).toHaveLength(1);
  });

  it("invoice.paid REJOUÉ (même event id) → aucune seconde commission", async () => {
    const { partnerId, subject, sub, pi, invoiceEvt, invoiceId } = await freshPartnerWithInvoice();
    const before = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_commission_entries where partner_id=$1 and entry_type='commission'`, [partnerId]));
    expect(before.rows).toHaveLength(1); // la commission d'origine existe
    // Rejeu EXACT du même event (même id) → intercepté par le ledger d'idempotence.
    const dup = await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, {
      eventId: invoiceEvt, type: "invoice.paid", livemode: false, eventCreated: 1000,
      subscriptionId: sub, customerId: "cus_1", subjectUserId: subject, invoiceId, paymentIntentId: pi,
      totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur",
    }));
    expect(dup.applied).toBe(false);
    expect(dup.reason).toBe("duplicate_event");
    const count = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_commission_entries where partner_id=$1 and entry_type='commission'`, [partnerId]));
    expect(count.rows).toHaveLength(1);
  });

  it("remboursement 50 % → reversal -44,90 € (la somme facture = commission nette)", async () => {
    const { partnerId, sub, pi, invoiceEvt } = await freshPartnerWithInvoice();
    const refund = await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, {
      eventId: `evt_refund_${sub}`, type: "charge.refunded", livemode: false, eventCreated: 2000,
      subscriptionId: sub, customerId: "cus_1", subjectUserId: null, paymentIntentId: pi, refundTtcMinor: 26_940, currency: "eur",
    }));
    expect(refund.applied).toBe(true);
    expect(refund.commissionMinor).toBe(-4_490); // moitié de 8980

    const net = await withService(h.db, (tx) => tx.query<{ s: string }>(`select coalesce(sum(commission_minor),0) s from clonestore_pp_commission_entries where partner_id=$1`, [partnerId]));
    expect(Number(net.rows[0].s)).toBe(4_490); // 8980 - 4490
    void invoiceEvt;
  });

  it("litige → gel ; litige gagné → dégel", async () => {
    const { partnerId, sub, pi } = await freshPartnerWithInvoice();
    const opened = await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, { eventId: `evt_disp_${sub}`, type: "charge.dispute.created", livemode: false, eventCreated: 3000, subscriptionId: sub, customerId: "cus_1", subjectUserId: null, paymentIntentId: pi }));
    expect(opened.applied).toBe(true);
    const frozen = await withService(h.db, (tx) => getPartnerBalances(tx, partnerId));
    expect(frozen.frozenMinor).toBe(8_980);

    const won = await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, { eventId: `evt_dispc_${sub}`, type: "charge.dispute.closed", livemode: false, eventCreated: 4000, subscriptionId: sub, customerId: "cus_1", subjectUserId: null, paymentIntentId: pi, disputeResolved: "won" }));
    expect(won.applied).toBe(true);
    const after = await withService(h.db, (tx) => getPartnerBalances(tx, partnerId));
    expect(after.frozenMinor).toBe(0);
    expect(after.pendingReserveMinor).toBe(8_980);
  });

  it("versement dry-run : PRÉVISUALISATION PURE — zéro mutation, rejouable à l'infini", async () => {
    // Réserve 0 → la commission est immédiatement disponible (available_at est immuable
    // par conception : on ne la mute jamais, on crée le cabinet avec la bonne réserve).
    const { partnerId } = await freshPartnerWithInvoice(0);
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set payout_threshold_minor=5000 where id=$1`, [partnerId]));

    const deps: PayoutDeps = {
      createTransfer: async () => { throw new Error("Stripe ne doit JAMAIS être appelé en dry-run"); },
      findTransfer: async () => { throw new Error("Stripe ne doit JAMAIS être interrogé en dry-run"); },
      stripeIsLive: () => false,
      productionAuthorized: () => false,
      stripeMode: () => "test",
    };
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));

    const run1 = await runMonthlyPayouts(h.db, deps, { now: nextMonth, dryRunOverride: true });
    expect(run1.dryRun).toBe(true);
    expect(run1.transfersCreated).toBe(0); // aucun transfert : c'est une prévisualisation
    const line = run1.preview?.lines.find((l) => l.partnerId === partnerId);
    expect(line?.outcome).toBe("included");
    expect(line?.amountMinor).toBe(8_980); // ce QUI SERAIT versé

    // AUCUNE mutation financière : la commission reste disponible, rien n'est payé.
    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, partnerId));
    expect(bal.availableMinor).toBe(8_980);
    expect(bal.paidMinor).toBe(0);

    // Aucun lot, aucun transfert, aucun run : la simulation n'écrit RIEN.
    const rows = await withService(h.db, (tx) => tx.query<{ t: number; i: number; r: number }>(
      `select
         (select count(*)::int from clonestore_pp_transfers where partner_id=$1) t,
         (select count(*)::int from clonestore_pp_transfer_items where partner_id=$1) i,
         (select count(*)::int from clonestore_pp_payout_runs) r`,
      [partnerId],
    ));
    expect(rows.rows[0].t).toBe(0);
    expect(rows.rows[0].i).toBe(0);
    expect(rows.rows[0].r).toBe(0); // pas même un verrou de période : le vrai run reste possible

    // Rejouable : un second dry-run donne exactement le même résultat.
    const run2 = await runMonthlyPayouts(h.db, deps, { now: nextMonth, dryRunOverride: true });
    expect(run2.skipped).toBeUndefined(); // aucun verrou consommé
    expect(run2.preview?.lines.find((l) => l.partnerId === partnerId)?.amountMinor).toBe(8_980);
    const bal2 = await withService(h.db, (tx) => getPartnerBalances(tx, partnerId));
    expect(bal2.availableMinor).toBe(8_980);
    expect(bal2.paidMinor).toBe(0);
  });
});

// Crée un nouveau cabinet actif + une facture payée, isolé par un subject unique.
let seq = 0;
async function freshPartnerWithInvoice(reserveDays?: number): Promise<{ partnerId: string; subject: string; sub: string; pi: string; invoiceEvt: string; invoiceId: string }> {
  seq += 1;
  const subject = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`; // UUID valide unique
  const sub = `sub_${seq}`;
  const pi = `pi_${seq}`;
  const invoiceEvt = `evt_inv_fresh_${seq}`;
  const invoiceId = `in_${seq}`;
  const partnerId = await withService(h.db, async (tx) => {
    const app = await createApplication(tx, { cabinetName: `Cabinet ${seq}`, firstName: "A", lastName: "B", email: `p${seq}@cab-${seq}.fr`, country: "FR", cabinetType: "expertise_comptable", consentContact: true, consentPrivacy: true });
    if (!app.ok) throw new Error("app");
    if (app.duplicate || app.admitted !== "auto") throw new Error("auto-provisioning attendu");
    const acc = { partnerId: app.partnerId, publicSlug: app.publicSlug, referralCode: app.referralCode };
    await tx.query(`update clonestore_pp_partners set status='active', contract_accepted_at=now(), stripe_connected_account_id=$2, stripe_onboarding_status='complete', payouts_enabled=true, activated_at=now(), reserve_days=$3 where id=$1`, [acc.partnerId, `acct_${seq}`, reserveDays ?? 30]);
    const t = await tx.query<{ touch_key: string }>(`insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now() + interval '90 days') returning touch_key`, [acc.partnerId]);
    await attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: `client${seq}@societe${seq}.fr`, touchKey: t.rows[0].touch_key });
    return acc.partnerId;
  });
  const applied = await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, {
    eventId: invoiceEvt, type: "invoice.paid", livemode: false, eventCreated: 1000,
    subscriptionId: sub, customerId: "cus_1", subjectUserId: subject, invoiceId, paymentIntentId: pi,
    totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur",
  }));
  if (!applied.applied) throw new Error(`fresh invoice not applied: ${applied.reason}`);
  return { partnerId, subject, sub, pi, invoiceEvt, invoiceId };
}
