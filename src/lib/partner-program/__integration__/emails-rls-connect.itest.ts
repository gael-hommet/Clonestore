// Worker d'emails, isolation RLS cross-cabinet des commissions, et account.updated Connect.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { withService, withPartner } from "../server/runtime";
import { processPartnerEmailOutbox, enqueuePartnerEmailTx } from "../server/emails";
import { applyAccountUpdated } from "../server/connect";
import { applyPartnerCommercialEvent } from "../server/commission";
import { attachAttributionAtSignup } from "../server/attribution";
import { acceptApplication, createApplication } from "../server/applications";
import { listPartnerCommissions } from "../server/summary";

let h: PartnerHarness;
beforeAll(async () => { h = await createPartnerHarness(); });
afterAll(async () => { await h.close(); });

async function activePartner(tag: string): Promise<string> {
  return withService(h.db, async (tx) => {
    const app = await createApplication(tx, { cabinetName: `Cab ${tag}`, firstName: "A", lastName: "B", email: `${tag}@cab-${tag}.fr`, country: "FR", cabinetType: "expertise_comptable", consentContact: true, consentPrivacy: true });
    if (!app.ok) throw new Error("app");
    if (app.duplicate || app.admitted !== "auto") throw new Error("auto-provisioning attendu");
    const acc = { partnerId: app.partnerId, publicSlug: app.publicSlug, referralCode: app.referralCode };
    await tx.query(`update clonestore_pp_partners set status='active', reserve_days=0 where id=$1`, [acc.partnerId]);
    return acc.partnerId;
  });
}

describe("worker d'emails", () => {
  it("enqueue → process → statut sent (mode local)", async () => {
    await withService(h.db, (tx) => enqueuePartnerEmailTx(tx, { kind: "application_received", toEmail: "worker@test.fr", idempotencyKey: "pp-email:test:worker-1" }));
    const res = await processPartnerEmailOutbox(h.db, withService, 50);
    expect(res.sent).toBeGreaterThanOrEqual(1);
    const row = await withService(h.db, (tx) => tx.query<{ status: string }>(`select status from clonestore_pp_email_outbox where idempotency_key='pp-email:test:worker-1'`));
    expect(row.rows[0].status).toBe("sent");
  });

  it("idempotence : enqueue deux fois la même clé → une seule ligne", async () => {
    await withService(h.db, (tx) => enqueuePartnerEmailTx(tx, { kind: "application_received", toEmail: "x@test.fr", idempotencyKey: "pp-email:test:dup" }));
    await withService(h.db, (tx) => enqueuePartnerEmailTx(tx, { kind: "application_received", toEmail: "x@test.fr", idempotencyKey: "pp-email:test:dup" }));
    const rows = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_email_outbox where idempotency_key='pp-email:test:dup'`));
    expect(rows.rows).toHaveLength(1);
  });
});

describe("account.updated Connect", () => {
  it("détails soumis + charges + payouts → onboarding complete + payouts_enabled", async () => {
    const partnerId = await activePartner("con");
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set stripe_connected_account_id='acct_con' where id=$1`, [partnerId]));
    const res = await withService(h.db, (tx) => applyAccountUpdated(tx, { accountId: "acct_con", detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true }));
    expect(res.ok).toBe(true);
    const p = await withService(h.db, (tx) => tx.query<{ stripe_onboarding_status: string; payouts_enabled: boolean }>(`select stripe_onboarding_status, payouts_enabled from clonestore_pp_partners where id=$1`, [partnerId]));
    expect(p.rows[0].stripe_onboarding_status).toBe("complete");
    expect(p.rows[0].payouts_enabled).toBe(true);
  });

  it("détails incomplets → restricted, payouts non activés", async () => {
    const partnerId = await activePartner("con2");
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set stripe_connected_account_id='acct_con2' where id=$1`, [partnerId]));
    await withService(h.db, (tx) => applyAccountUpdated(tx, { accountId: "acct_con2", detailsSubmitted: true, chargesEnabled: false, payoutsEnabled: false }));
    const p = await withService(h.db, (tx) => tx.query<{ stripe_onboarding_status: string; payouts_enabled: boolean }>(`select stripe_onboarding_status, payouts_enabled from clonestore_pp_partners where id=$1`, [partnerId]));
    expect(p.rows[0].stripe_onboarding_status).toBe("restricted");
    expect(p.rows[0].payouts_enabled).toBe(false);
  });
});

describe("isolation RLS cross-cabinet des commissions", () => {
  it("un cabinet ne voit QUE ses commissions", async () => {
    const a = await activePartner("iso-a");
    const b = await activePartner("iso-b");
    const subjA = "00000000-0000-4000-8000-0000000000aa";
    const subjB = "00000000-0000-4000-8000-0000000000bb";

    await withService(h.db, async (tx) => {
      for (const [pid, subj, tag] of [[a, subjA, "a"], [b, subjB, "b"]] as const) {
        const t = await tx.query<{ touch_key: string }>(`insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now()+interval '90 days') returning touch_key`, [pid]);
        await attachAttributionAtSignup(tx, { subjectUserId: subj, subjectEmail: `c${tag}@soc${tag}.fr`, touchKey: t.rows[0].touch_key });
      }
    });
    await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, { eventId: "evt_iso_a", type: "invoice.paid", livemode: false, eventCreated: 1, subscriptionId: "sub_a", customerId: "cus_a", subjectUserId: subjA, invoiceId: "in_iso_a", paymentIntentId: "pi_iso_a", totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur" }));
    await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, { eventId: "evt_iso_b", type: "invoice.paid", livemode: false, eventCreated: 1, subscriptionId: "sub_b", customerId: "cus_b", subjectUserId: subjB, invoiceId: "in_iso_b", paymentIntentId: "pi_iso_b", totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur" }));

    // Cabinet A ne voit que sa commission ; jamais celle de B.
    const seenByA = await withPartner(h.db, a, (tx) => listPartnerCommissions(tx, a, 100));
    expect(seenByA.length).toBe(1);
    const aSeesB = await withPartner(h.db, a, (tx) => tx.query(`select 1 from clonestore_pp_commission_entries where stripe_invoice_id='in_iso_b'`));
    expect(aSeesB.rows).toHaveLength(0);
  });
});
