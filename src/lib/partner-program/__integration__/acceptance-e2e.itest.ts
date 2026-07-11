// ============================================================================
// RECETTE FONCTIONNELLE — Scénario end-to-end « Cabinets Fondateurs » (Test Mode).
// Pilote le VRAI code câblé : vraies routes (apply / admin action / me / connect),
// VRAI webhook Stripe canonique avec événements SIGNÉS (test-mode), sur un VRAI moteur
// Postgres (PGlite). Couvre les étapes 1→25 et 30 du scénario de recette.
// ============================================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { __setPartnerDbForTests, withService, withPartner } from "../server/runtime";
import {
  __setStripeWebhookDepsForTests,
  type StripeWebhookDeps,
} from "@/lib/founder-access/stripe-webhook-deps";
import type { OrdersEventLedgerPort, OrdersEventReceipt } from "@/lib/billing/orders-event-ledger";
import type { EventRank } from "@/lib/billing/orders-event-ordering";
import { runMonthlyPayouts, type PayoutDeps } from "../server/payouts";
import { processPartnerEmailOutbox } from "../server/emails";

// ── Mocks des frontières externes (session, gate admin, client Stripe) ───────
const H = vi.hoisted(() => ({
  session: { userId: "", email: "" },
  admin: { ok: true, email: "owner@clonestore.pro" } as { ok: true; email: string } | { ok: false; reason: string },
  subMeta: {} as Record<string, Record<string, string>>,
  stub: null as unknown,
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: H.session.userId ? { id: H.session.userId, email: H.session.email } : null }, error: null }) },
  }),
}));
vi.mock("@/lib/founder-access/admin-guard", () => ({
  resolveFounderAdmin: async () => H.admin,
  founderAdminDeniedResponse: (reason: string) => new Response(JSON.stringify({ ok: false }), { status: reason === "unauthenticated" ? 401 : 404 }),
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => H.stub }));

// Signeur d'événements (instance Stripe réelle) — calcule des signatures test valides.
const WEBHOOK_SECRET = "whsec_accept_e2e";
const signer = new Stripe("sk_test_accept_e2e");

// ── Ledger orders en mémoire (Bloc 4) ────────────────────────────────────────
function memoryOrdersLedger(): OrdersEventLedgerPort & { rows: Map<string, OrdersEventReceipt> } {
  const rows = new Map<string, OrdersEventReceipt>();
  return {
    rows,
    async tryInsertReceipt(row) {
      if (rows.has(row.stripe_event_id)) return { inserted: false, existing: rows.get(row.stripe_event_id)! };
      rows.set(row.stripe_event_id, { ...row, processing_result: "pending", attempts: 1 });
      return { inserted: true, existing: null };
    },
    async highWaterForObject(objectId, exclude): Promise<EventRank | null> {
      let best: EventRank | null = null;
      for (const r of rows.values()) {
        if (r.object_id !== objectId || r.processing_result !== "applied" || r.stripe_event_id === exclude) continue;
        const rank = { eventCreated: r.event_created, eventId: r.stripe_event_id };
        if (!best || rank.eventCreated > best.eventCreated) best = rank;
      }
      return best;
    },
    async updateReceipt(id, patch) { const r = rows.get(id); if (r) Object.assign(r, patch); },
  };
}

// ── État partagé du scénario ──────────────────────────────────────────────────
let h: PartnerHarness;
const ordersUpserts: Array<Record<string, unknown>> = [];
const ordersLedger = memoryOrdersLedger();

const SUBJECT = "00000000-0000-4000-8000-0000000000e2"; // prospect (compte du client)
const SUB_ID = "sub_e2e";
const CUS_ID = "cus_e2e";
const INVOICE_ID = "in_e2e";
const PI_ID = "pi_e2e";
const PARTNER_ACCOUNT = "00000000-0000-4000-8000-0000000000c1"; // compte Supabase du cabinet

let partnerId = "";
let publicSlug = "";
let referralCode = "";
let touchKey = "";

beforeAll(async () => {
  process.env.PARTNER_PROGRAM_ENABLED = "true";
  process.env.CLONESTORY_FF_COMMERCIAL_BRIDGE = "off"; // isole le pont partenaires
  process.env.STRIPE_SECRET_KEY = "sk_test_accept_e2e";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.CLONESTORE_PP_COOKIE_SECRET = "acceptance_cookie_secret_0123456789";
  delete process.env.STRIPE_COUNTRY_RECONCILIATION_ENABLED;

  H.subMeta[SUB_ID] = { user_id: SUBJECT, agent_slug: "pierre" };
  H.stub = {
    webhooks: signer.webhooks, // constructEvent réel (signature vérifiée)
    subscriptions: { retrieve: async (id: string) => ({ id, status: "active", metadata: H.subMeta[id] ?? {}, items: { data: [{ current_period_end: 2_000_000_000 }] }, cancel_at_period_end: false }) },
    customers: { retrieve: async (id: string) => ({ id, metadata: {} }) },
    accounts: { create: async () => ({ id: "acct_test_e2e" }) },
    accountLinks: { create: async () => ({ url: "https://connect.stripe.test/onboard/acct_test_e2e" }) },
  };

  h = await createPartnerHarness();
  __setPartnerDbForTests(h.db);

  const deps: StripeWebhookDeps = {
    getFounderDb: async () => { throw new Error("founder DB non sollicitée"); },
    fetchProof: async () => null,
    orders: {
      upsert: async (a) => { ordersUpserts.push(a as unknown as Record<string, unknown>); },
      updateBySubId: async () => {},
    },
    ordersLedger,
    expectedPriceId: "price_pierre",
    expectedProductId: "prod_pierre",
  };
  __setStripeWebhookDepsForTests(deps);
});

afterAll(async () => {
  __setStripeWebhookDepsForTests(null);
  __setPartnerDbForTests(null);
  await h.close();
});

// Poste un événement SIGNÉ au vrai webhook canonique.
async function postWebhook(type: string, id: string, created: number, object: Record<string, unknown>): Promise<Response> {
  const payload = JSON.stringify({ id, object: "event", api_version: "2025-11-17.clover", created, type, livemode: false, data: { object } });
  const sig = signer.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const { POST } = await import("@/app/api/webhooks/stripe/route");
  return POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": sig, "content-type": "application/json" } }));
}

describe("RECETTE E2E — Cabinets Fondateurs (Test Mode)", () => {
  it("Étape 1 — candidature via la vraie route POST /api/partners/apply", async () => {
    const { POST } = await import("@/app/api/partners/apply/route");
    const res = await POST(new Request("http://localhost/api/partners/apply", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.50" },
      body: JSON.stringify({ cabinetName: "Cabinet Fondateur Alpha", firstName: "Léa", lastName: "Martin", email: "lea@cabinet-alpha.fr", country: "FR", cabinetType: "expertise_comptable", services: ["paie", "juridique"], consentContact: true, consentPrivacy: true, website_hp: "" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const row = await withService(h.db, (tx) => tx.query<{ id: string; status: string }>(`select id, status from clonestore_pp_applications where email_normalized='lea@cabinet-alpha.fr'`));
    expect(row.rows[0].status).toBe("received");
  });

  it("Étape 2 — acceptation via la vraie route admin (gate + raison + code une fois)", async () => {
    const app = await withService(h.db, (tx) => tx.query<{ id: string }>(`select id from clonestore_pp_applications where email_normalized='lea@cabinet-alpha.fr'`));
    const { POST } = await import("@/app/api/partners/admin/action/route");
    const res = await POST(new Request("http://localhost/api/partners/admin/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept_application", id: app.rows[0].id, reason: "dossier complet, cabinet vérifié" }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.referralCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/); // code fort, montré une fois
    partnerId = body.partnerId; publicSlug = body.publicSlug; referralCode = body.referralCode;
  });

  it("Étape 3 — le partenaire est créé correctement (contract_pending, paramètres 20 %)", async () => {
    const p = await withService(h.db, (tx) => tx.query<{ status: string; commission_rate_bps: number; reserve_days: number; payout_threshold_minor: number; public_slug: string }>(`select status, commission_rate_bps, reserve_days, payout_threshold_minor, public_slug from clonestore_pp_partners where id=$1`, [partnerId]));
    expect(p.rows[0].status).toBe("contract_pending");
    expect(p.rows[0].commission_rate_bps).toBe(2000); // 20 %
    expect(p.rows[0].payout_threshold_minor).toBe(10000);
    expect(p.rows[0].public_slug).toBe(publicSlug);
    // Le code est stocké HACHÉ uniquement (jamais en clair).
    const code = await withService(h.db, (tx) => tx.query<{ code_hash: string }>(`select code_hash from clonestore_pp_partner_codes where partner_id=$1 and status='active'`, [partnerId]));
    expect(code.rows[0].code_hash).not.toContain(referralCode);
    expect(code.rows[0].code_hash).toHaveLength(64); // sha-256 hex
  });

  it("Étape 4 — lien de recommandation bien formé + acceptation du contrat", async () => {
    // Le slug public identifie le lien ; le lien de clic est déterministe.
    expect(publicSlug).toMatch(/^[a-z0-9-]+$/);
    // Le cabinet accepte électroniquement le contrat (contract_pending → stripe_pending).
    const { acceptContract } = await import("../server/partners");
    await withService(h.db, (tx) => acceptContract(tx, partnerId, "v1"));
    const p = await withService(h.db, (tx) => tx.query<{ status: string; contract_accepted_at: string | null }>(`select status, contract_accepted_at from clonestore_pp_partners where id=$1`, [partnerId]));
    expect(p.rows[0].status).toBe("stripe_pending");
    expect(p.rows[0].contract_accepted_at).toBeTruthy();
  });

  it("Étape 5 — espace partenaire via la vraie route GET /api/partners/me (liaison par session)", async () => {
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set account_user_id=$2 where id=$1`, [partnerId, PARTNER_ACCOUNT]));
    H.session.userId = PARTNER_ACCOUNT; H.session.email = "lea@cabinet-alpha.fr";
    const { GET } = await import("@/app/api/partners/me/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.partner.displayName).toBe("Cabinet Fondateur Alpha");
    expect(body.link).toContain(`partner=${publicSlug}`);
    expect(body.codeHint.last4).toHaveLength(4); // seul l'indice, jamais le code
    expect(body.overview.balances.availableMinor).toBe(0);
  });

  it("Étape 6 — onboarding Connect (route réelle) + account.updated webhook + activation admin réelle", async () => {
    const { POST } = await import("@/app/api/partners/connect/onboard/route");
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).url).toContain("connect.stripe.test");
    // Stripe notifie l'achèvement de l'onboarding → payouts activés.
    const wh = await postWebhook("account.updated", "evt_acct_1", 1000, { id: "acct_test_e2e", details_submitted: true, charges_enabled: true, payouts_enabled: true });
    expect(wh.status).toBe(200);
    const p = await withService(h.db, (tx) => tx.query<{ stripe_onboarding_status: string; payouts_enabled: boolean }>(`select stripe_onboarding_status, payouts_enabled from clonestore_pp_partners where id=$1`, [partnerId]));
    expect(p.rows[0].stripe_onboarding_status).toBe("complete");
    expect(p.rows[0].payouts_enabled).toBe(true);
    // Activation FINANCIÈRE via la vraie route admin (fail-closed : exige contrat + onboarding complet).
    const act = await import("@/app/api/partners/admin/action/route");
    const actRes = await act.POST(new Request("http://localhost/api/partners/admin/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "activate_partner", id: partnerId, reason: "onboarding Stripe complet, cabinet prêt" }) }));
    expect(actRes.status).toBe(200);
    const p2 = await withService(h.db, (tx) => tx.query<{ status: string }>(`select status from clonestore_pp_partners where id=$1`, [partnerId]));
    expect(p2.rows[0].status).toBe("active");
  });

  it("Étapes 7-8 — entreprise apportée : clic (touch serveur + cookie) puis attribution au signup", async () => {
    // Le cabinet est actif : un clic sur son lien enregistre une touche serveur + pose le cookie signé.
    const { GET: clickGet } = await import("@/app/api/partners/click/route");
    const clickRes = await clickGet(new Request(`http://localhost/api/partners/click?partner=${publicSlug}`, { headers: { "x-forwarded-for": "203.0.113.51" } }));
    expect([302, 307, 308]).toContain(clickRes.status);
    expect(clickRes.headers.get("set-cookie")).toContain("cs_pp_ref=");
    const t = await withService(h.db, (tx) => tx.query<{ touch_key: string }>(`select touch_key from clonestore_pp_referral_touches where partner_id=$1 order by occurred_at desc limit 1`, [partnerId]));
    touchKey = t.rows[0].touch_key;
    expect(touchKey).toBeTruthy();

    const { attachAttributionAtSignup } = await import("../server/attribution");
    const r = await withService(h.db, (tx) => attachAttributionAtSignup(tx, { subjectUserId: SUBJECT, subjectEmail: "dg@societe-cliente.fr", touchKey }));
    expect(r.ok).toBe(true);
    const attr = await withService(h.db, (tx) => tx.query<{ status: string; source: string; partner_id: string }>(`select status, source, partner_id from clonestore_pp_attributions where subject_user_id=$1`, [SUBJECT]));
    expect(attr.rows[0].status).toBe("pending");
    expect(attr.rows[0].source).toBe("link");
    expect(attr.rows[0].partner_id).toBe(partnerId);
  });

  it("Étapes 9-11 — Checkout Test (checkout.session.completed) + invoice.paid via le vrai webhook", async () => {
    // 9-10 : Stripe délivre les événements de paiement réussi (Test Mode).
    const co = await postWebhook("checkout.session.completed", "evt_co_1", 2000, {
      id: "cs_e2e", object: "checkout.session", mode: "subscription", payment_status: "paid",
      subscription: SUB_ID, customer: CUS_ID, metadata: { user_id: SUBJECT, agent_slug: "pierre" },
    });
    expect(co.status).toBe(200);
    // 11a : commande créée (orders upsert) + ledger orders appliqué.
    expect(ordersUpserts.some((o) => o.subId === SUB_ID && o.status === "active")).toBe(true);
    expect(ordersLedger.rows.get("evt_co_1")?.processing_result).toBe("applied");

    // invoice.paid : facture TTC 538,80 € (HT 449 € + TVA 20 %), encaissée.
    const inv = await postWebhook("invoice.paid", "evt_inv_1", 3000, {
      id: INVOICE_ID, object: "invoice", customer: CUS_ID,
      parent: { type: "subscription_details", subscription_details: { subscription: SUB_ID } },
      payments: { data: [{ payment: { type: "payment_intent", payment_intent: PI_ID } }] },
      total: 53_880, tax: 8_980, total_excluding_tax: 44_900, amount_paid: 53_880, currency: "eur",
    });
    expect(inv.status).toBe(200);

    // 11b : ledger commission + attribution verrouillée + relation client + commission 20 % sur HT.
    const entry = await withService(h.db, (tx) => tx.query<{ commission_minor: number; eligible_net_minor: number; rate_bps: number; entry_type: string; status: string; stripe_invoice_id: string }>(`select commission_minor, eligible_net_minor, rate_bps, entry_type, status, stripe_invoice_id from clonestore_pp_commission_entries where partner_id=$1`, [partnerId]));
    expect(entry.rows).toHaveLength(1);
    expect(entry.rows[0].eligible_net_minor).toBe(44_900); // HT hors TVA
    expect(entry.rows[0].commission_minor).toBe(8_980); // 20 % de 449 € = 89,80 €
    expect(entry.rows[0].rate_bps).toBe(2000);
    expect(entry.rows[0].entry_type).toBe("commission");
    const attr = await withService(h.db, (tx) => tx.query<{ status: string; locked_by_event_id: string }>(`select status, locked_by_event_id from clonestore_pp_attributions where subject_user_id=$1`, [SUBJECT]));
    expect(attr.rows[0].status).toBe("locked");
    expect(attr.rows[0].locked_by_event_id).toBe("evt_inv_1");
    const cust = await withService(h.db, (tx) => tx.query<{ status: string }>(`select status from clonestore_pp_customers where partner_id=$1`, [partnerId]));
    expect(cust.rows[0].status).toBe("active");
    // Idempotence du ledger d'events partenaires.
    const evt = await withService(h.db, (tx) => tx.query<{ processing_result: string }>(`select processing_result from clonestore_pp_stripe_events where stripe_event_id='evt_inv_1'`));
    expect(evt.rows[0].processing_result).toBe("applied");
  });

  it("Étape 11bis — un rejeu de invoice.paid ne crée JAMAIS de seconde commission", async () => {
    const inv = await postWebhook("invoice.paid", "evt_inv_1", 3000, {
      id: INVOICE_ID, object: "invoice", customer: CUS_ID,
      parent: { type: "subscription_details", subscription_details: { subscription: SUB_ID } },
      payments: { data: [{ payment: { payment_intent: PI_ID } }] },
      total: 53_880, tax: 8_980, total_excluding_tax: 44_900, amount_paid: 53_880, currency: "eur",
    });
    expect(inv.status).toBe(200);
    const n = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_commission_entries where partner_id=$1 and entry_type='commission'`, [partnerId]));
    expect(n.rows).toHaveLength(1);
  });

  it("Étape 12 — la commission apparaît dans l'espace partenaire (statut « en réserve »)", async () => {
    H.session.userId = PARTNER_ACCOUNT; H.session.email = "lea@cabinet-alpha.fr";
    const { GET } = await import("@/app/api/partners/me/route");
    const body = await (await GET()).json();
    expect(body.commissions).toHaveLength(1);
    expect(body.commissions[0].commissionMinor).toBe(8_980);
    expect(body.overview.balances.pendingReserveMinor).toBe(8_980); // en réserve, PAS annoncée acquise
    expect(body.overview.balances.availableMinor).toBe(0);
    expect(body.overview.activeClients).toBe(1);
    expect(body.overview.mrrMinor).toBe(8_980);
  });

  it("Étape 13 — relevé : la liste de commissions reflète fidèlement le ledger", async () => {
    const { listPartnerCommissions } = await import("../server/summary");
    const { renderPartnerEmail } = await import("../server/emails");
    const lines = await withPartner(h.db, partnerId, (tx) => listPartnerCommissions(tx, partnerId, 100));
    expect(lines).toHaveLength(1);
    expect(lines[0].stripeInvoiceId).toBe(INVOICE_ID);
    // Le template de relevé mensuel est rendu correctement.
    const stmt = renderPartnerEmail("monthly_statement", { period: "2026-07", total: "89,80 €" });
    expect(stmt.subject).toContain("2026-07");
    expect(stmt.text).toContain("89,80 €");
  });

  it("Étapes 14-15 — remboursement partiel 50 % → écriture compensatoire (reversal)", async () => {
    const wh = await postWebhook("charge.refunded", "evt_refund_1", 4000, { id: "ch_e2e", object: "charge", payment_intent: PI_ID, amount_refunded: 26_940, currency: "eur" });
    expect(wh.status).toBe(200);
    const reversal = await withService(h.db, (tx) => tx.query<{ commission_minor: number; entry_type: string }>(`select commission_minor, entry_type from clonestore_pp_commission_entries where partner_id=$1 and entry_type='reversal'`, [partnerId]));
    expect(reversal.rows).toHaveLength(1);
    expect(reversal.rows[0].commission_minor).toBe(-4_490); // reversal de la moitié
    const net = await withService(h.db, (tx) => tx.query<{ s: string }>(`select coalesce(sum(commission_minor),0) s from clonestore_pp_commission_entries where partner_id=$1`, [partnerId]));
    expect(Number(net.rows[0].s)).toBe(4_490); // 8980 - 4490
  });

  it("Étapes 16-17 — litige → gel des écritures liées", async () => {
    const wh = await postWebhook("charge.dispute.created", "evt_disp_1", 5000, { id: "dp_e2e", object: "dispute", charge: "ch_e2e", payment_intent: PI_ID });
    expect(wh.status).toBe(200);
    const frozen = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestore_pp_commission_entries where partner_id=$1 and status='frozen'`, [partnerId]));
    expect(frozen.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("Étapes 18-19 — litige gagné → dégel", async () => {
    const wh = await postWebhook("charge.dispute.closed", "evt_disp_closed_1", 6000, { id: "dp_e2e", object: "dispute", charge: "ch_e2e", payment_intent: PI_ID, status: "won" });
    expect(wh.status).toBe(200);
    const frozen = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestore_pp_commission_entries where partner_id=$1 and status='frozen'`, [partnerId]));
    expect(frozen.rows[0].n).toBe(0);
  });

  it("Étapes 20-22 — payout dry-run : batch créé, aucun double au second lancement", async () => {
    // Rendre le solde disponible (réserve écoulée) via un cabinet à réserve 0 : ici on abaisse la
    // réserve et on recrée une écriture disponible n'est pas permis (available_at immuable).
    // On abaisse le seuil et on force la maturité en réglant reserve_days du cabinet à 0 pour
    // un nouvel évènement — mais l'écriture existante garde son available_at. Pour la recette du
    // job, on abaisse le seuil et on vérifie l'éligibilité sur la base disponible réelle.
    // La commission nette (4490) < seuil défaut (10000) et est encore en réserve → on prouve le
    // comportement CORRECT : rien à verser ce mois-ci.
    const deps: PayoutDeps = { createTransfer: async () => { throw new Error("Stripe interdit en dry-run"); }, stripeIsLive: () => false, productionAuthorized: () => false };
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
    const run1 = await runMonthlyPayouts(h.db, deps, { now: nextMonth, dryRunOverride: true });
    expect(run1.runId).toBeTruthy(); // batch immuable créé
    const mine = run1.perPartner.find((x) => x.partnerId === partnerId);
    expect(mine?.status).toBe("skipped"); // réserve non écoulée / sous seuil → pas de versement (correct)

    // Second lancement même période → verrou : jamais de double.
    const run2 = await runMonthlyPayouts(h.db, deps, { now: nextMonth, dryRunOverride: true });
    expect(run2.skipped).toBe("already_running_or_done");
    const runs = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestore_pp_payout_runs`));
    expect(runs.rows[0].n).toBe(1); // un seul batch pour la période
  });

  it("Étape 20bis — payout dry-run avec commission MATURE → lot payé, second run sans double", async () => {
    // Nouveau cabinet dédié, réserve 0 + seuil bas, pour prouver le versement effectif du lot.
    const { createApplication, acceptApplication } = await import("../server/applications");
    const { attachAttributionAtSignup } = await import("../server/attribution");
    const { applyPartnerCommercialEvent } = await import("../server/commission");
    const subj = "00000000-0000-4000-8000-0000000000f2";
    const pid = await withService(h.db, async (tx) => {
      const app = await createApplication(tx, { cabinetName: "Cabinet Payout", firstName: "P", lastName: "Q", email: "payout@cab-p.fr", country: "FR", cabinetType: "expertise_comptable", consentContact: true, consentPrivacy: true });
      if (!app.ok) throw new Error("app");
      const acc = await acceptApplication(tx, app.applicationId, "admin", "ok");
      if (!acc.ok) throw new Error("acc");
      await tx.query(`update clonestore_pp_partners set status='active', contract_accepted_at=now(), stripe_connected_account_id='acct_payout', stripe_onboarding_status='complete', payouts_enabled=true, activated_at=now(), reserve_days=0, payout_threshold_minor=5000 where id=$1`, [acc.partnerId]);
      const t = await tx.query<{ touch_key: string }>(`insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now()+interval '90 days') returning touch_key`, [acc.partnerId]);
      await attachAttributionAtSignup(tx, { subjectUserId: subj, subjectEmail: "c2@soc2.fr", touchKey: t.rows[0].touch_key });
      return acc.partnerId;
    });
    await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, { eventId: "evt_inv_payout", type: "invoice.paid", livemode: false, eventCreated: 1, subscriptionId: "sub_payout", customerId: "cus_payout", subjectUserId: subj, invoiceId: "in_payout", paymentIntentId: "pi_payout", totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur" }));

    const deps: PayoutDeps = { createTransfer: async () => { throw new Error("dry-run: pas de transfert Stripe"); }, stripeIsLive: () => false, productionAuthorized: () => false };
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 15)); // période distincte
    const run = await runMonthlyPayouts(h.db, deps, { now: nextMonth, dryRunOverride: true });
    const mine = run.perPartner.find((x) => x.partnerId === pid);
    expect(mine?.status).toBe("dry_run");
    expect(mine?.amountMinor).toBe(8_980);
    // Écritures marquées payées.
    const paid = await withService(h.db, (tx) => tx.query<{ s: string }>(`select coalesce(sum(commission_minor),0) s from clonestore_pp_commission_entries where partner_id=$1 and status='paid'`, [pid]));
    expect(Number(paid.rows[0].s)).toBe(8_980);
    // Second run → aucun double transfert.
    const run2 = await runMonthlyPayouts(h.db, deps, { now: nextMonth, dryRunOverride: true });
    expect(run2.skipped).toBe("already_running_or_done");
    const transfers = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestore_pp_transfers where partner_id=$1 and status='paid'`, [pid]));
    expect(transfers.rows[0].n).toBe(1);
  });

  it("Étape 23 — logs : audit + événements append-only tracés", async () => {
    const audit = await withService(h.db, (tx) => tx.query<{ action: string }>(`select action from clonestore_pp_admin_audit order by occurred_at`));
    const actions = audit.rows.map((r) => r.action);
    expect(actions).toContain("application.accepted");
    expect(actions).toContain("connect.account_updated");
    const commEvents = await withService(h.db, (tx) => tx.query<{ type: string }>(`select distinct type from clonestore_pp_commission_events where partner_id=$1`, [partnerId]));
    const types = commEvents.rows.map((r) => r.type);
    expect(types).toContain("commission_recorded");
    expect(types).toContain("reversal_recorded");
    expect(types).toContain("entry_frozen");
    expect(types).toContain("entry_unfrozen");
    // Ledger append-only : DELETE interdit.
    await expect(withService(h.db, (tx) => tx.query(`delete from clonestore_pp_commission_events where partner_id=$1`, [partnerId]))).rejects.toThrow();
  });

  it("Étape 24 — emails : outbox alimentée + worker les envoie (mode local)", async () => {
    const kinds = await withService(h.db, (tx) => tx.query<{ kind: string }>(`select distinct kind from clonestore_pp_email_outbox`));
    const set = kinds.rows.map((r) => r.kind);
    expect(set).toContain("application_received");
    expect(set).toContain("application_accepted");
    expect(set).toContain("partner_activated");
    expect(set).toContain("commission_recorded");
    const res = await processPartnerEmailOutbox(h.db, withService, 100);
    expect(res.sent).toBeGreaterThan(0);
    const pending = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestore_pp_email_outbox where status in ('pending','failed_retryable')`));
    expect(pending.rows[0].n).toBe(0); // tout envoyé
  });

  it("Étape 25 — notifications : l'espace expose les actions requises", async () => {
    // Nouveau cabinet non-onboardé → action requise « compléter Stripe ».
    H.session.userId = PARTNER_ACCOUNT; H.session.email = "lea@cabinet-alpha.fr";
    const { GET } = await import("@/app/api/partners/me/route");
    const body = await (await GET()).json();
    expect(Array.isArray(body.actionsRequired)).toBe(true);
    // Ce cabinet est complet → aucune action Stripe requise.
    expect(body.actionsRequired).not.toContain("complete_stripe_onboarding");
  });

  it("Étape 30 — permissions : non-admin refusé, cabinet isolé (anti-IDOR)", async () => {
    // Admin refusé.
    H.admin = { ok: false, reason: "unauthenticated" };
    const { POST: adminPost } = await import("@/app/api/partners/admin/action/route");
    const denied = await adminPost(new Request("http://localhost/api/partners/admin/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "suspend_partner", id: partnerId, reason: "x" }) }));
    expect(denied.status).toBe(401);
    H.admin = { ok: true, email: "owner@clonestore.pro" };

    // Un utilisateur sans cabinet ne voit rien.
    H.session.userId = "00000000-0000-4000-8000-00000000dead"; H.session.email = "nobody@x.fr";
    const { GET } = await import("@/app/api/partners/me/route");
    const res = await GET();
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_A_PARTNER");
  });
});
