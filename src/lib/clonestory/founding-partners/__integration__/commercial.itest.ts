// CS-FINAL 3 — moteur de contribution commerciale (PGlite réel).
// Couvre : idempotence ledger, paiement autoritatif, activation, machine d'états,
// vérification + délai, registry_number, distinctions, remboursement/annulation/litige,
// événements hors ordre, RLS, réconciliation, outbox. (Points R 1–110 regroupés.)

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService, withPartner } from "../server/runtime";
import { registerPartner, verifyEmailToken } from "../server/store";
import { capturePartnerVisit, captureAccountAttribution } from "../server/attribution";
import { newVisitorId } from "../server/attribution-cookie";
import {
  applyCommercialStripeEvent, verifyCommercialContribution, reconcileCommercial,
  invalidateCommercialContribution, getContributionForOrder, getCommercialStatsForPartner,
  processCommercialOutbox, type CommercialStripeEvent, type CommercialDeps,
} from "../server/commercial";
import { randomUUID } from "node:crypto";

process.env.CLONESTORY_LOCAL_MODE = "1";
// Délai de validation = 0 par défaut → la réconciliation vérifie immédiatement (sauf
// test dédié à la fenêtre de sécurité qui le repasse temporairement à une grande valeur).
process.env.CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS = "0";

let h: ClonestoryHarness;
beforeAll(async () => { h = await createClonestoryHarness(); __setClonestoryDbForTests(h.db); });
afterAll(async () => { __setClonestoryDbForTests(null); await h.close(); });
beforeEach(() => { process.env.CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS = "0"; });

let seq = 0;
const ACC = new Map<string, string>();
function acct(label: string): string { if (!ACC.has(label)) ACC.set(label, randomUUID()); return ACC.get(label)!; }
let evN = 0;
function evId(): string { return `evt_${evN++}`; }

async function makePartner(label: string): Promise<{ id: string; email: string }> {
  const email = `cc-${label}-${seq++}@partner.test`;
  const r = await registerPartner({ firstName: "P", lastName: label, email });
  if (!r.ok) throw new Error("register");
  const v = await verifyEmailToken(r.verificationToken!);
  if (!v.ok) throw new Error("verify");
  return { id: r.partnerId, email };
}
async function linkVisitor(partnerId: string): Promise<string> {
  const vid = newVisitorId();
  await capturePartnerVisit({ partnerId, visitorId: vid, existingVisitorId: null });
  return vid;
}
/** Lie un compte prospect au partenaire (origine lien) et renvoie l'account user id. */
async function attribute(partnerId: string, label: string, email: string): Promise<string> {
  const vid = await linkVisitor(partnerId);
  const d = await captureAccountAttribution({ accountUserId: acct(label), email, visitorId: vid });
  if (!d.attributed) throw new Error("attribution failed: " + d.reason);
  return acct(label);
}
async function ccBySub(sub: string) {
  return (await withService(h.db, (tx) => tx.query<{ status: string; gross_amount: number; net_amount: number; refunded_amount: number; verified_active: boolean }>(
    `select status, gross_amount, net_amount, refunded_amount, verified_active from clonestory_fp_commercial_contributions where stripe_subscription_id=$1`, [sub],
  ))).rows[0] ?? null;
}
async function partnerOf(id: string) {
  return (await withService(h.db, (tx) => tx.query<{ registry_number: number | null; status: string }>(
    `select registry_number, status from clonestory_fp_partners where id=$1`, [id],
  ))).rows[0];
}
async function awards(partnerId: string): Promise<string[]> {
  return (await withService(h.db, (tx) => tx.query<{ distinction_code: string }>(
    `select distinction_code from clonestory_fp_partner_awards where partner_id=$1 and revoked_at is null`, [partnerId],
  ))).rows.map((r) => r.distinction_code);
}

// ── Constructeurs d'événements Stripe normalisés ────────────────────────────────
function checkout(sub: string, user: string, agent = "pierre", amountPaid = 0): CommercialStripeEvent {
  return { eventId: evId(), type: "checkout.session.completed", livemode: false, createdAt: 1_750_000_000,
    subscriptionId: sub, customerId: "cus_x", checkoutSessionId: `cs_${sub}`, paymentIntentId: null,
    amountPaid, currency: "eur", userId: user, agentSlug: agent };
}
function invoicePaid(sub: string, pi = "pi_x", amount = 44900, user: string | null = null, agent: string | null = null): CommercialStripeEvent {
  return { eventId: evId(), type: "invoice.paid", livemode: false, createdAt: 1_750_000_100,
    subscriptionId: sub, customerId: "cus_x", invoiceId: `in_${sub}`, paymentIntentId: pi,
    amountPaid: amount, currency: "eur", userId: user, agentSlug: agent };
}
function refund(pi: string, sub: string | null, amountRefunded: number): CommercialStripeEvent {
  return { eventId: evId(), type: "charge.refunded", livemode: false, createdAt: 1_750_000_200,
    subscriptionId: sub, customerId: "cus_x", chargeId: "ch_x", paymentIntentId: pi, invoiceId: "in_x",
    amountRefunded, currency: "eur" };
}
function dispute(type: "charge.dispute.created" | "charge.dispute.closed", pi: string, resolved?: "won" | "lost"): CommercialStripeEvent {
  return { eventId: evId(), type, livemode: false, createdAt: 1_750_000_300, subscriptionId: null,
    customerId: "cus_x", chargeId: "ch_x", paymentIntentId: pi, disputeResolved: resolved ?? null };
}

/** Cycle complet attribué : checkout (essai) → invoice payée → réconciliation (vérifie). */
async function fullCycle(partner: { id: string }, label: string, sub: string, pi = "pi_" + label): Promise<void> {
  const user = await attribute(partner.id, label, `${label}@dataco-${label}.test`);
  await applyCommercialStripeEvent(checkout(sub, user), {});
  await applyCommercialStripeEvent(invoicePaid(sub, pi), {});
  await reconcileCommercial(new Date());
}

describe("idempotence du ledger Stripe (R 7,8,24,25)", () => {
  it("event rejoué → aucune double contribution ; ledger unique", async () => {
    const p = await makePartner("idem");
    const user = await attribute(p.id, "idem", "buyer@idem-co.test");
    const ev = checkout("sub_idem", user);
    const r1 = await applyCommercialStripeEvent(ev, {});
    const r2 = await applyCommercialStripeEvent(ev, {}); // même event.id
    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(true);
    const n = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_commercial_contributions where stripe_subscription_id='sub_idem'`))).rows[0].n;
    expect(n).toBe(1);
  });
});

describe("paiement autoritatif & activation (R 13,21,22,26,32,33)", () => {
  it("essai (checkout) → activation_pending ; invoice payée → validation_pending", async () => {
    const p = await makePartner("pay");
    const user = await attribute(p.id, "pay", "buyer@pay-co.test");
    await applyCommercialStripeEvent(checkout("sub_pay", user), {});
    expect((await ccBySub("sub_pay"))?.status).toBe("activation_pending"); // accès essai, AUCUN argent
    await applyCommercialStripeEvent(invoicePaid("sub_pay", "pi_pay"), {});
    const c = await ccBySub("sub_pay");
    expect(c?.status).toBe("validation_pending"); // capture → activation → fenêtre
    expect(Number(c?.gross_amount)).toBe(44900);
  });

  it("session payée immédiatement (hors essai) → capture directe", async () => {
    const p = await makePartner("direct");
    const user = await attribute(p.id, "direct", "buyer@direct-co.test");
    await applyCommercialStripeEvent(checkout("sub_direct", user, "pierre", 44900), {});
    expect((await ccBySub("sub_direct"))?.status).toBe("validation_pending");
  });

  it("facture d'essai (montant 0) → ignorée (aucune capture)", async () => {
    const p = await makePartner("trial0");
    const user = await attribute(p.id, "trial0", "buyer@trial0-co.test");
    await applyCommercialStripeEvent(checkout("sub_trial0", user), {});
    await applyCommercialStripeEvent(invoicePaid("sub_trial0", "pi_t0", 0), {});
    expect((await ccBySub("sub_trial0"))?.status).toBe("activation_pending");
  });
});

describe("commande sans attribution / hors ordre (R 14,63,64,66)", () => {
  it("invoice payée sans attribution → ignorée (commande valide, hors Cercle)", async () => {
    await applyCommercialStripeEvent(invoicePaid("sub_noattr", "pi_noattr", 44900, randomUUID(), "pierre"), {});
    expect(await ccBySub("sub_noattr")).toBeNull();
  });

  it("remboursement AVANT paiement → ignoré (aucune contribution)", async () => {
    const r = await applyCommercialStripeEvent(refund("pi_ghost", "sub_ghost", 44900), {});
    expect(r.result).toBe("ignored");
  });

  it("invoice AVANT checkout → contribution créée via metadata d'abonnement", async () => {
    const p = await makePartner("oo");
    const user = await attribute(p.id, "oo", "buyer@oo-co.test");
    const deps: CommercialDeps = { resolveSubscriptionMeta: async () => ({ userId: user, agentSlug: "pierre" }) };
    await applyCommercialStripeEvent(invoicePaid("sub_oo", "pi_oo"), deps);
    expect((await ccBySub("sub_oo"))?.status).toBe("validation_pending");
  });
});

describe("vérification : preuves + délai (R 34-44)", () => {
  it("vérification refusée sans paiement / sans activation ; double vérif idempotente", async () => {
    const p = await makePartner("ver");
    const user = await attribute(p.id, "ver", "buyer@ver-co.test");
    await applyCommercialStripeEvent(checkout("sub_ver", user), {});
    const id = (await getContributionForOrder(`${user}:pierre`))!.id;
    const r0 = await verifyCommercialContribution(id, new Date());
    expect(r0.verified).toBe(false); // activation incomplète (pas de paiement)
    await applyCommercialStripeEvent(invoicePaid("sub_ver", "pi_ver"), {});
    const r1 = await verifyCommercialContribution(id, new Date()); // délai = 0
    expect(r1.verified).toBe(true);
    const r2 = await verifyCommercialContribution(id, new Date());
    expect(r2.reason).toBe("already_verified"); // idempotent
  });

  it("fenêtre de sécurité ouverte → reste validation_pending", async () => {
    process.env.CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS = String(7 * 24 * 3600 * 1000);
    const p = await makePartner("win");
    await fullCycleNoReconcile(p, "win", "sub_win", "pi_win");
    const id = (await getContributionForOrder(`${acct("win")}:pierre`))!.id;
    const res = await verifyCommercialContribution(id, new Date());
    expect(res.reason).toBe("validation_window_open");
    expect((await ccBySub("sub_win"))?.status).toBe("validation_pending");
  });

  it("produit inéligible → vérification refusée", async () => {
    const p = await makePartner("prod");
    const user = await attribute(p.id, "prod", "buyer@prod-co.test");
    await applyCommercialStripeEvent(checkout("sub_prod", user, "zzz"), {});
    await applyCommercialStripeEvent(invoicePaid("sub_prod", "pi_prod"), {});
    const id = (await getContributionForOrder(`${user}:zzz`))!.id;
    expect((await verifyCommercialContribution(id, new Date())).reason).toBe("product_ineligible");
  });

  it("partenaire suspendu → vérification refusée", async () => {
    const p = await makePartner("susp");
    await fullCycleNoReconcile(p, "susp", "sub_susp", "pi_susp");
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_partners set status='suspended' where id=$1`, [p.id]));
    const id = (await getContributionForOrder(`${acct("susp")}:pierre`))!.id;
    expect((await verifyCommercialContribution(id, new Date())).reason).toBe("partner_ineligible");
  });

  it("attribution invalidée → vérification refusée", async () => {
    const p = await makePartner("inv");
    await fullCycleNoReconcile(p, "inv", "sub_inv", "pi_inv");
    await withService(h.db, (tx) => tx.query(
      `update clonestory_fp_attributions set status='invalidated' where account_user_id=$1`, [acct("inv")]));
    const id = (await getContributionForOrder(`${acct("inv")}:pierre`))!.id;
    expect((await verifyCommercialContribution(id, new Date())).reason).toBe("attribution_inactive");
  });
});

async function fullCycleNoReconcile(p: { id: string }, label: string, sub: string, pi: string): Promise<void> {
  const user = await attribute(p.id, label, `${label}@co-${label}.test`);
  await applyCommercialStripeEvent(checkout(sub, user), {});
  await applyCommercialStripeEvent(invoicePaid(sub, pi), {});
}

describe("registry_number + distinctions (R 45-50)", () => {
  it("1re contribution vérifiée → registry_number + founding_partner + first_client", async () => {
    const p = await makePartner("reg");
    await fullCycle(p, "reg", "sub_reg", "pi_reg");
    const pr = await partnerOf(p.id);
    expect(pr.registry_number).toBeGreaterThanOrEqual(1);
    expect(pr.status).toBe("founding_partner");
    const a = await awards(p.id);
    expect(a).toContain("founding_partner");
    expect(a).toContain("first_client");
  });

  it("registry_number unique et séquentiel entre partenaires ; ré-vérif idempotente", async () => {
    const p1 = await makePartner("seqA");
    const p2 = await makePartner("seqB");
    await fullCycle(p1, "seqA", "sub_seqA", "pi_seqA");
    await fullCycle(p2, "seqB", "sub_seqB", "pi_seqB");
    const n1 = (await partnerOf(p1.id)).registry_number!;
    const n2 = (await partnerOf(p2.id)).registry_number!;
    expect(n1).not.toBe(n2);
    // ré-vérification → ne réalloue pas
    const id = (await getContributionForOrder(`${acct("seqA")}:pierre`))!.id;
    await verifyCommercialContribution(id, new Date());
    expect((await partnerOf(p1.id)).registry_number).toBe(n1);
  });

  it("5 contributions vérifiées actives → Bâtisseur ; remboursée NON comptée", async () => {
    const p = await makePartner("b5");
    for (let i = 0; i < 5; i++) await fullCycle(p, `b5_${i}`, `sub_b5_${i}`, `pi_b5_${i}`);
    expect(await awards(p.id)).toContain("builder_5");
    // un remboursement total fait repasser sous le seuil → révocation
    await applyCommercialStripeEvent(refund("pi_b5_0", "sub_b5_0", 44900), {});
    expect(await awards(p.id)).not.toContain("builder_5");
  });
});

describe("remboursement / annulation / litige (R 51-62)", () => {
  it("remboursement total → refunded, net 0, distinction recalculée, historique conservé", async () => {
    const p = await makePartner("rfull");
    await fullCycle(p, "rfull", "sub_rfull", "pi_rfull");
    expect((await ccBySub("sub_rfull"))?.status).toBe("verified");
    await applyCommercialStripeEvent(refund("pi_rfull", "sub_rfull", 44900), {});
    const c = await ccBySub("sub_rfull");
    expect(c?.status).toBe("refunded");
    expect(Number(c?.net_amount)).toBe(0);
    expect(c?.verified_active).toBe(false);
    // l'événement de vérification d'origine est conservé (append-only)
    const evVer = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_commercial_events e
         join clonestory_fp_commercial_contributions c on c.id=e.contribution_id
        where c.stripe_subscription_id='sub_rfull' and e.type='contribution_verified'`))).rows[0].n;
    expect(evVer).toBe(1);
  });

  it("remboursement partiel < seuil → conservé ; ≥ seuil → revue", async () => {
    process.env.CLONESTORY_PARTIAL_REFUND_REVIEW_PCT = "50";
    const p = await makePartner("rpart");
    await fullCycle(p, "rpart", "sub_rpart", "pi_rpart");
    await applyCommercialStripeEvent(refund("pi_rpart", "sub_rpart", 10000), {}); // 22% < 50%
    expect((await ccBySub("sub_rpart"))?.status).toBe("verified");
    await applyCommercialStripeEvent(refund("pi_rpart", "sub_rpart", 30000), {}); // cumul 30000 = 66% ≥ 50%
    expect((await ccBySub("sub_rpart"))?.status).toBe("validation_pending");
  });

  it("litige créé → disputed ; gagné → restauré ; perdu → refunded", async () => {
    const pw = await makePartner("dwon");
    await fullCycle(pw, "dwon", "sub_dwon", "pi_dwon");
    await applyCommercialStripeEvent(dispute("charge.dispute.created", "pi_dwon"), {});
    expect((await ccBySub("sub_dwon"))?.status).toBe("disputed");
    await applyCommercialStripeEvent(dispute("charge.dispute.closed", "pi_dwon", "won"), {});
    expect((await ccBySub("sub_dwon"))?.status).toBe("verified"); // restauré

    const pl = await makePartner("dlost");
    await fullCycle(pl, "dlost", "sub_dlost", "pi_dlost");
    await applyCommercialStripeEvent(dispute("charge.dispute.created", "pi_dlost"), {});
    await applyCommercialStripeEvent(dispute("charge.dispute.closed", "pi_dlost", "lost"), {});
    expect((await ccBySub("sub_dlost"))?.status).toBe("refunded");
  });

  it("session expirée / abonnement supprimé avant capture → canceled", async () => {
    const p = await makePartner("exp");
    const user = await attribute(p.id, "exp", "buyer@exp-co.test");
    await applyCommercialStripeEvent(checkout("sub_exp", user), {});
    await applyCommercialStripeEvent({ eventId: evId(), type: "checkout.session.expired", livemode: false, createdAt: 1, subscriptionId: "sub_exp", customerId: "cus_x" }, {});
    expect((await ccBySub("sub_exp"))?.status).toBe("canceled");
  });

  it("churn APRÈS vérification ne retire pas la contribution ; renouvellement ≠ nouveau client", async () => {
    const p = await makePartner("churn");
    await fullCycle(p, "churn", "sub_churn", "pi_churn");
    // 2e facture (renouvellement) → AUCUNE nouvelle contribution
    await applyCommercialStripeEvent(invoicePaid("sub_churn", "pi_churn2", 44900), {});
    const n = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_commercial_contributions where stripe_subscription_id='sub_churn'`))).rows[0].n;
    expect(n).toBe(1);
    // abonnement supprimé après vérification → reste verified
    await applyCommercialStripeEvent({ eventId: evId(), type: "customer.subscription.deleted", livemode: false, createdAt: 1, subscriptionId: "sub_churn", customerId: "cus_x" }, {});
    expect((await ccBySub("sub_churn"))?.status).toBe("verified");
  });
});

describe("RLS, sécurité, append-only (R 68,69,75,77,78)", () => {
  it("un partenaire ne voit QUE ses contributions", async () => {
    const a = await makePartner("rlsA");
    const b = await makePartner("rlsB");
    await fullCycle(a, "rlsA", "sub_rlsA", "pi_rlsA");
    const seenByB = (await withPartner(h.db, b.id, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_commercial_contributions where partner_id=$1`, [a.id]))).rows[0].n;
    expect(seenByB).toBe(0);
  });

  it("ledger Stripe : aucun e-mail prospect, aucun secret, aucune donnée bancaire", async () => {
    const blob = JSON.stringify((await withService(h.db, (tx) => tx.query(`select * from clonestory_fp_stripe_events limit 200`))).rows);
    expect(blob).not.toContain("@");
    expect(blob.toLowerCase()).not.toContain("sk_");
    expect(blob).not.toContain("card");
  });

  it("événements commerciaux append-only (update refusé)", async () => {
    await expect(withService(h.db, (tx) => tx.query(`update clonestory_fp_commercial_events set reason='x'`))).rejects.toBeTruthy();
  });
});

describe("réconciliation & outbox (R 65,67,90,O)", () => {
  it("réconciliation vérifie les validation_pending échus, idempotente", async () => {
    const p = await makePartner("rec");
    await fullCycleNoReconcile(p, "rec", "sub_rec", "pi_rec");
    expect((await ccBySub("sub_rec"))?.status).toBe("validation_pending");
    const r1 = await reconcileCommercial(new Date());
    expect(r1.verified).toBeGreaterThanOrEqual(1);
    expect((await ccBySub("sub_rec"))?.status).toBe("verified");
    const r2 = await reconcileCommercial(new Date()); // idempotent
    expect(r2.verified).toBe(0);
  });

  it("outbox commerciale : notifications enfilées, worker sans doublon", async () => {
    const p = await makePartner("mail");
    await fullCycle(p, "mail", "sub_mail", "pi_mail");
    const enq = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_commercial_outbox where partner_id=$1`, [p.id]))).rows[0].n;
    expect(enq).toBeGreaterThanOrEqual(1); // client_paid + activation + validation + verified
    const run = await processCommercialOutbox(50);
    expect(run.processed).toBeGreaterThanOrEqual(1);
    const stuck = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_commercial_outbox where status='sending'`))).rows[0].n;
    expect(stuck).toBe(0); // aucun message bloqué en 'sending'
  });

  it("stats cockpit : comptes seulement, vérifiées exactes", async () => {
    const p = await makePartner("stats");
    await fullCycle(p, "stats", "sub_stats", "pi_stats");
    const s = await withPartner(h.db, p.id, (tx) => getCommercialStatsForPartner(tx, p.id));
    expect(s.contributionsVerified).toBe(1);
    expect(s.clientsPaid).toBeGreaterThanOrEqual(1);
  });
});

describe("invalidation admin (R 42)", () => {
  it("invalide sans effacer l'historique", async () => {
    const p = await makePartner("adminv");
    await fullCycle(p, "adminv", "sub_adminv", "pi_adminv");
    const id = (await getContributionForOrder(`${acct("adminv")}:pierre`))!.id;
    expect((await invalidateCommercialContribution(id, "fraude")).ok).toBe(true);
    expect((await ccBySub("sub_adminv"))?.status).toBe("invalidated");
  });
});
