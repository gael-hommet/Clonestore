// Analytique admin par cabinet (§1, §9-A) — sur PostgreSQL réel.
//
// Prouve : agrégats EXACTS, cabinet à 0 client, cabinet à 100 clients, pagination serveur,
// tri, filtres, et ISOLATION (les chiffres d'un cabinet ne fuient jamais chez un autre).
// Prouve aussi qu'AUCUNE donnée bancaire n'existe dans CloneStore.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { withService } from "../server/runtime";
import { createApplication } from "../server/applications";
import { attachAttributionAtSignup } from "../server/attribution";
import { applyPartnerCommercialEvent } from "../server/commission";
import { applyAccountUpdated } from "../server/connect";
import { listPartnersWithAnalytics, getPartnerDetail } from "../server/admin-analytics";

let h: PartnerHarness;
beforeAll(async () => { h = await createPartnerHarness(); });
afterAll(async () => { await h.close(); });

function uuidFrom(seed: string): string {
  const x = createHash("sha256").update(seed).digest("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-8${x.slice(17, 20)}-${x.slice(20, 32)}`;
}

async function activePartner(tag: string, country = "FR"): Promise<string> {
  return withService(h.db, async (tx) => {
    const app = await createApplication(tx, {
      cabinetName: `Cabinet ${tag}`, firstName: "A", lastName: "B", email: `${tag}@cab-${tag}.fr`,
      country, cabinetType: "expertise_comptable", consentContact: true, consentPrivacy: true,
    });
    if (!app.ok || app.duplicate || app.admitted !== "auto") throw new Error("auto-provisioning attendu");
    await tx.query(
      `update clonestore_pp_partners set status='active', activated_at=now(), contract_accepted_at=now(),
              reserve_days=0, activation_mode='automatic' where id=$1`,
      [app.partnerId],
    );
    return app.partnerId;
  });
}

/** Un client apporté qui paie une facture de 449 € HT → commission 89,80 €. */
async function bringClient(partnerId: string, tag: string, i: number, canceled = false): Promise<void> {
  const subject = uuidFrom(`${tag}:${i}`);
  await withService(h.db, async (tx) => {
    const t = await tx.query<{ touch_key: string }>(
      `insert into clonestore_pp_referral_touches (partner_id, source, expires_at)
       values ($1,'link', now()+interval '90 days') returning touch_key`, [partnerId],
    );
    await attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: `dg${i}@soc-${tag}-${i}.fr`, touchKey: t.rows[0].touch_key });
  });
  await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, {
    eventId: `evt_${tag}_${i}`, type: "invoice.paid", livemode: false, eventCreated: 1,
    subscriptionId: `sub_${tag}_${i}`, customerId: `cus_${tag}_${i}`, subjectUserId: subject,
    invoiceId: `in_${tag}_${i}`, paymentIntentId: `pi_${tag}_${i}`,
    totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur",
  }));
  if (canceled) {
    await withService(h.db, (tx) => tx.query(
      `update clonestore_pp_customers set status='canceled', ended_at=now() where stripe_subscription_id=$1`,
      [`sub_${tag}_${i}`],
    ));
  }
}

describe("§1 analytique admin — agrégats par cabinet", () => {
  it("cabinet SANS aucun client : tous les agrégats à zéro, aucune valeur inventée", async () => {
    const pid = await activePartner("zero");
    const page = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { partnerId: pid }));
    const row = page.items[0];

    expect(row.activeClients).toBe(0);
    expect(row.totalClients).toBe(0);
    expect(row.clientMrrMinor).toBe(0);
    expect(row.commissionMrrMinor).toBe(0);
    expect(row.grossMinor).toBe(0);
    expect(row.availableMinor).toBe(0);
    expect(row.paidMinor).toBe(0);
    expect(row.connectState).toBe("not_started"); // aucun compte Stripe
    expect(row.status).toBe("active");
    expect(row.activationMode).toBe("automatic");
  });

  it("cabinet avec 3 clients (dont 1 annulé) : agrégats EXACTS", async () => {
    const pid = await activePartner("trois");
    await bringClient(pid, "trois", 1);
    await bringClient(pid, "trois", 2);
    await bringClient(pid, "trois", 3, true); // annulé

    const row = (await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { partnerId: pid }))).items[0];

    expect(row.totalClients).toBe(3);
    expect(row.activeClients).toBe(2);
    expect(row.canceledClients).toBe(1);
    // MRR : seuls les clients ACTIFS comptent. 2 × 449 € HT = 898 €.
    expect(row.clientMrrMinor).toBe(2 * 44_900);
    // MRR de commission : 20 % du MRR client = 2 × 89,80 €.
    expect(row.commissionMrrMinor).toBe(2 * 8_980);
    // Commissions brutes : les 3 factures ont été payées, y compris celle du client parti.
    expect(row.grossMinor).toBe(3 * 8_980);
    expect(row.availableMinor).toBe(3 * 8_980); // réserve 0 → disponible
    expect(row.paidMinor).toBe(0);
  });

  it("cabinet avec 100 clients : les agrégats tiennent, sans charger les clients", async () => {
    const pid = await activePartner("cent");
    for (let i = 1; i <= 100; i++) await bringClient(pid, "cent", i);

    const row = (await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { partnerId: pid }))).items[0];
    expect(row.totalClients).toBe(100);
    expect(row.activeClients).toBe(100);
    expect(row.clientMrrMinor).toBe(100 * 44_900);
    expect(row.commissionMrrMinor).toBe(100 * 8_980);
    expect(row.grossMinor).toBe(100 * 8_980);

    // Le détail pagine les clients : 25 par page, jamais les 100 d'un coup.
    const detail = await withService(h.db, (tx) => getPartnerDetail(tx, pid, { limit: 25, offset: 0 }));
    expect(detail?.clients.items).toHaveLength(25);
    expect(detail?.clients.total).toBe(100);
    expect(detail?.clients.hasMore).toBe(true);

    const p4 = await withService(h.db, (tx) => getPartnerDetail(tx, pid, { limit: 25, offset: 75 }));
    expect(p4?.clients.items).toHaveLength(25);
    expect(p4?.clients.hasMore).toBe(false);

    // Aucun doublon entre les pages.
    const ids = new Set([...(detail?.clients.items ?? []), ...(p4?.clients.items ?? [])].map((c) => c.id));
    expect(ids.size).toBe(50);
  });

  it("ISOLATION : les chiffres d'un cabinet ne fuient jamais chez un autre", async () => {
    const zero = (await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { search: "zero" }))).items[0];
    const cent = (await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { search: "cent" }))).items[0];
    expect(zero.totalClients).toBe(0);
    expect(cent.totalClients).toBe(100);
    expect(zero.grossMinor).toBe(0);
  });
});

describe("§1 analytique admin — pagination, tri, filtres (côté serveur)", () => {
  it("pagination serveur : le total est exact, jamais tout chargé", async () => {
    const p1 = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { limit: 2, offset: 0 }));
    expect(p1.items).toHaveLength(2);
    expect(p1.total).toBeGreaterThanOrEqual(3);
    expect(p1.hasMore).toBe(true);
    expect(p1.limit).toBe(2);

    const p2 = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { limit: 2, offset: 2 }));
    const overlap = p1.items.filter((a) => p2.items.some((b) => b.id === a.id));
    expect(overlap).toHaveLength(0); // aucune ligne servie deux fois
  });

  it("tri par clients actifs : le cabinet à 100 clients arrive en tête", async () => {
    const page = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { sort: "active_clients", limit: 1 }));
    expect(page.items[0].activeClients).toBe(100);
  });

  it("tri par MRR client puis par commissions disponibles", async () => {
    const byMrr = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { sort: "client_mrr", limit: 1 }));
    expect(byMrr.items[0].clientMrrMinor).toBe(100 * 44_900);
    const byAvail = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { sort: "available", limit: 1 }));
    expect(byAvail.items[0].availableMinor).toBe(100 * 8_980);
  });

  it("recherche + filtres pays/statut/Connect", async () => {
    const found = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { search: "Cabinet trois" }));
    expect(found.total).toBe(1);
    expect(found.items[0].displayName).toBe("Cabinet trois");

    await activePartner("belge", "BE");
    const be = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { country: "BE" }));
    expect(be.items.every((i) => i.country === "BE")).toBe(true);
    expect(be.total).toBe(1);

    const noConnect = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { connect: "none" }));
    expect(noConnect.items.every((i) => i.connectState === "not_started")).toBe(true);

    const ready = await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { connect: "ready" }));
    expect(ready.total).toBe(0); // aucun cabinet n'a encore terminé Stripe
  });
});

describe("§2 Stripe Connect — état seulement, JAMAIS de donnée bancaire", () => {
  it("onboarding incomplet → missing_info, avec les exigences dues (noms de champs)", async () => {
    const pid = await activePartner("connect");
    await withService(h.db, (tx) => tx.query(
      `update clonestore_pp_partners set stripe_connected_account_id='acct_connect', stripe_onboarding_status='pending' where id=$1`, [pid],
    ));
    await withService(h.db, (tx) => applyAccountUpdated(tx, {
      accountId: "acct_connect", detailsSubmitted: true, chargesEnabled: false, payoutsEnabled: false,
      requirementsDue: ["individual.verification.document", "external_account"],
      disabledReason: null,
    }));

    const detail = await withService(h.db, (tx) => getPartnerDetail(tx, pid));
    expect(detail?.onboarding.hasConnectedAccount).toBe(true);
    expect(detail?.onboarding.detailsSubmitted).toBe(true);
    expect(detail?.onboarding.payoutsEnabled).toBe(false);
    expect(detail?.onboarding.requirementsDue).toContain("external_account");
    expect(detail?.partner.connectState).toBe("restricted");
    expect(detail?.onboarding.remainingSteps).toContain("complete_stripe_onboarding");
  });

  it("payouts activés → ready, et le cabinet est prévenu qu'il peut recevoir", async () => {
    const pid = (await withService(h.db, (tx) => tx.query<{ id: string }>(`select id from clonestore_pp_partners where email_normalized='connect@cab-connect.fr'`))).rows[0].id;
    await withService(h.db, (tx) => applyAccountUpdated(tx, {
      accountId: "acct_connect", detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true,
      requirementsDue: [], disabledReason: null,
    }));

    const row = (await withService(h.db, (tx) => listPartnersWithAnalytics(tx, { partnerId: pid }))).items[0];
    expect(row.connectState).toBe("ready");
    expect(row.payoutsEnabled).toBe(true);

    const mails = await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestore_pp_email_outbox where partner_id=$1 and kind='connect_ready'`, [pid],
    ));
    expect(mails.rows[0].n).toBe(1); // exactement une fois
  });

  it("AUCUNE colonne bancaire n'existe dans le schéma CloneStore", async () => {
    // Motifs ancrés sur des MOTS entiers : « attribution » contient « rib », ce n'est pas un RIB.
    const cols = await withService(h.db, (tx) => tx.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema='public' and table_name like 'clonestore_pp_%'
          and column_name ~* '(^|_)(iban|bic|rib|bank|swift|routing|sort_code|account_number|card_number|last4)($|_)'`,
    ));
    expect(cols.rows).toHaveLength(0); // CloneStore ne peut pas stocker un IBAN : aucune colonne ne le permet
  });

  it("le détail admin n'expose aucune donnée bancaire", async () => {
    const pid = (await withService(h.db, (tx) => tx.query<{ id: string }>(`select id from clonestore_pp_partners where email_normalized='connect@cab-connect.fr'`))).rows[0].id;
    const detail = await withService(h.db, (tx) => getPartnerDetail(tx, pid));
    const json = JSON.stringify(detail).toLowerCase();
    for (const forbidden of ["iban", "\"bic\"", "swift", "routing_number", "account_number"]) {
      expect(json).not.toContain(forbidden);
    }
  });
});
