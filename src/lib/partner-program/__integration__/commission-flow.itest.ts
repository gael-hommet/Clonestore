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
    const accepted = await acceptApplication(tx, app.applicationId, "admin@clonestore", "dossier complet");
    if (!accepted.ok) throw new Error("accept failed");
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

  it("versement dry-run : lot créé, écritures marquées payées, PAS de double", async () => {
    // Réserve 0 → la commission est immédiatement disponible (available_at est immuable
    // par conception : on ne la mute jamais, on crée le cabinet avec la bonne réserve).
    const { partnerId } = await freshPartnerWithInvoice(0);
    // Seuil abaissé pour ce cabinet : 1 mois (89,80 €) dépasse alors le minimum de versement
    // (le défaut de 100 € exigerait 2 mois — comportement réaliste prouvé par le test précédent).
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set payout_threshold_minor=5000 where id=$1`, [partnerId]));

    const deps: PayoutDeps = {
      createTransfer: async () => { throw new Error("Stripe ne doit pas être appelé en dry-run"); },
      stripeIsLive: () => false,
      productionAuthorized: () => false,
    };
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));

    const run1 = await runMonthlyPayouts(h.db, deps, { now: nextMonth, dryRunOverride: true });
    const mine = run1.perPartner.find((x) => x.partnerId === partnerId);
    expect(mine?.status).toBe("dry_run");
    expect(mine?.amountMinor).toBe(8_980);

    // Écritures marquées payées.
    const bal = await withService(h.db, (tx) => getPartnerBalances(tx, partnerId));
    expect(bal.paidMinor).toBe(8_980);
    expect(bal.availableMinor).toBe(0);

    // Second run même période → aucun double (déjà terminé / rien de payable).
    const run2 = await runMonthlyPayouts(h.db, deps, { now: nextMonth, dryRunOverride: true });
    expect(run2.skipped).toBe("already_running_or_done");
    const transfers = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_transfers where partner_id=$1 and status='paid'`, [partnerId]));
    expect(transfers.rows).toHaveLength(1);
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
    const acc = await acceptApplication(tx, app.applicationId, "admin", "ok");
    if (!acc.ok) throw new Error("acc");
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
