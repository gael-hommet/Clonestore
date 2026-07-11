// RECETTE — ADMISSION AUTOMATIQUE, VOLUME ILLIMITÉ, ATTRIBUTION FIABLE.
// Scénarios A→I du cahier de recette, sur un VRAI moteur Postgres (PGlite), en pilotant
// le VRAI code (routes réelles + moteurs serveur). Aucune action administrateur sur le
// chemin normal : l'activation doit se produire SANS aucun clic admin.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { __setPartnerDbForTests, withService, withPartner } from "../server/runtime";
import { createApplication } from "../server/applications";
import { acceptContract, tryAutoActivate, getShareableCode, getPartnerById } from "../server/partners";
import { applyAccountUpdated } from "../server/connect";
import { submitIntroduction, listIntroductionsPaged } from "../server/introductions";
import { attachAttributionAtSignup, lockAttributionOnFirstPayment } from "../server/attribution";
import { applyPartnerCommercialEvent } from "../server/commission";

const H = vi.hoisted(() => ({ session: { userId: "", email: "" } }));
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: H.session.userId ? { id: H.session.userId, email: H.session.email } : null }, error: null }) } }),
}));

let h: PartnerHarness;
beforeAll(async () => {
  process.env.PARTNER_PROGRAM_ENABLED = "true";
  process.env.CLONESTORE_PP_CODE_KEY = "test_code_key_0123456789_abcdefgh";
  process.env.CLONESTORE_PP_COOKIE_SECRET = "test_cookie_secret_0123456789";
  h = await createPartnerHarness();
  __setPartnerDbForTests(h.db);
});
afterAll(async () => { __setPartnerDbForTests(null); await h.close(); });

let seq = 0;
function nextSeq() { return ++seq; }
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Candidature via la VRAIE route publique (aucune intervention admin). */
async function applyViaRoute(body: Record<string, unknown>, ip = "203.0.113.1") {
  const { POST } = await import("@/app/api/partners/apply/route");
  return POST(new Request("http://localhost/api/partners/apply", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ consentContact: true, consentPrivacy: true, website_hp: "", ...body }),
  }));
}

async function partnerByEmail(email: string) {
  return withService(h.db, async (tx) => {
    const r = await tx.query<{ id: string }>(`select id from clonestore_pp_partners where email_normalized=$1`, [email]);
    return r.rows[0] ? getPartnerById(tx, r.rows[0].id) : null;
  });
}

// ════════════════════════════════════════════════════════════════════════════
describe("A — Candidature normale : partenaire créé et ACTIVÉ sans aucun clic admin", () => {
  const email = "lea@cabinet-auto.fr";

  it("A1 — la candidature provisionne immédiatement le partenaire (onboarding_pending)", async () => {
    const res = await applyViaRoute({ cabinetName: "Cabinet Auto", firstName: "Léa", lastName: "Martin", email, country: "FR", cabinetType: "expertise_comptable" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.admitted).toBe("auto");
    expect(body.spaceReady).toBe(true);

    const p = await partnerByEmail(email);
    expect(p).not.toBeNull();
    expect(p!.status).toBe("onboarding_pending"); // créé automatiquement
    expect(p!.public_slug).toBeTruthy(); // lien immédiat
    expect(p!.commission_rate_bps).toBe(2000); // 20 % inchangé

    // Le code existe et est RE-PARTAGEABLE (chiffré, jamais en clair).
    const code = await withPartner(h.db, p!.id, (tx) => getShareableCode(tx, p!.id));
    expect(code?.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const stored = await withService(h.db, (tx) => tx.query<{ code_cipher: string; code_hash: string }>(`select code_cipher, code_hash from clonestore_pp_partner_codes where partner_id=$1`, [p!.id]));
    expect(stored.rows[0].code_cipher).not.toContain(code!.code!); // jamais en clair
    expect(stored.rows[0].code_hash).toHaveLength(64);

    // Aucune action admin n'a eu lieu.
    const admin = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_admin_audit where actor <> 'system'`));
    expect(admin.rows).toHaveLength(0);
  });

  it("A2 — conditions acceptées : pas encore actif (Stripe manquant), étapes explicites", async () => {
    const p = (await partnerByEmail(email))!;
    const r = await withService(h.db, (tx) => acceptContract(tx, p.id, "cf-2026-07"));
    expect(r.activated).toBe(false);
    expect(r.activated === false && r.code).toBe("stripe_onboarding_incomplete");
    expect(r.activated === false && r.remaining).toEqual(["complete_stripe_onboarding"]);
  });

  it("A3 — Stripe Connect terminé → ACTIVATION AUTOMATIQUE (aucun clic admin)", async () => {
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set stripe_connected_account_id='acct_auto' where id=$1`, [p.id]));

    // Stripe notifie la fin de l'onboarding : c'est le SEUL déclencheur.
    const res = await withService(h.db, (tx) => applyAccountUpdated(tx, { accountId: "acct_auto", detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true }));
    expect(res.activated).toBe(true);

    const after = (await partnerByEmail(email))!;
    expect(after.status).toBe("active");

    // Preuve : activation AUTOMATIQUE, acteur système, aucun admin humain.
    const audit = await withService(h.db, (tx) => tx.query<{ actor: string; action: string }>(
      `select actor, action from clonestore_pp_admin_audit where action='partner.activated_automatically'`));
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].actor).toBe("system");
    const mode = await withService(h.db, (tx) => tx.query<{ activation_mode: string }>(`select activation_mode from clonestore_pp_partners where id=$1`, [after.id]));
    expect(mode.rows[0].activation_mode).toBe("automatic");
    // ZÉRO action d'un administrateur humain sur tout le parcours.
    const humanAdmin = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_admin_audit where actor <> 'system'`));
    expect(humanAdmin.rows).toHaveLength(0);
  });

  it("A4 — activation idempotente (rejouer account.updated ne change rien)", async () => {
    const res = await withService(h.db, (tx) => applyAccountUpdated(tx, { accountId: "acct_auto", detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true }));
    expect(res.activated).toBe(false); // déjà actif
    const audit = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_admin_audit where action='partner.activated_automatically'`));
    expect(audit.rows).toHaveLength(1); // une seule activation
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("B — Candidature suspecte : manual_review, AUCUNE activation automatique", () => {
  it("B1 — e-mail jetable → manual_review, aucun partenaire créé", async () => {
    const res = await applyViaRoute({ cabinetName: "Cabinet Louche", firstName: "X", lastName: "Y", email: "test@yopmail.com", country: "FR", cabinetType: "autre" }, "203.0.113.90");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.admitted).toBe("review");
    expect(body.spaceReady).toBe(false);

    const app = await withService(h.db, (tx) => tx.query<{ status: string; created_partner_id: string | null }>(
      `select status, created_partner_id from clonestore_pp_applications where email_normalized='test@yopmail.com'`));
    expect(app.rows[0].status).toBe("manual_review");
    expect(app.rows[0].created_partner_id).toBeNull(); // aucun partenaire

    const flags = await withService(h.db, (tx) => tx.query<{ kind: string }>(`select kind from clonestore_pp_risk_flags where entity_type='application' and status='open'`));
    expect(flags.rows.map((f) => f.kind)).toContain("disposable_email");
  });

  it("B2 — pays hors périmètre → manual_review", async () => {
    const res = await applyViaRoute({ cabinetName: "Cabinet US", firstName: "J", lastName: "D", email: "j@cabinet-us.com", country: "US", cabinetType: "conseil_rh" }, "203.0.113.91");
    expect((await res.json()).admitted).toBe("review");
  });

  it("B3 — un risque bloquant ouvert EMPÊCHE l'activation automatique", async () => {
    const email = "risk@cabinet-risk.fr";
    await applyViaRoute({ cabinetName: "Cabinet Risk", firstName: "R", lastName: "K", email, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.92");
    const p = (await partnerByEmail(email))!;
    // On ouvre un risque bloquant a posteriori.
    await withService(h.db, (tx) => tx.query(
      `insert into clonestore_pp_risk_flags (partner_id, entity_type, entity_id, kind, severity, explanation, status)
       values ($1::uuid,'partner',$1::text,'shared_stripe_account','high','test','open')`, [p.id]));
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set contract_accepted_at=now(), stripe_onboarding_status='complete', payouts_enabled=true where id=$1`, [p.id]));

    const r = await withService(h.db, (tx) => tryAutoActivate(tx, p.id));
    expect(r.activated).toBe(false);
    expect(r.activated === false && r.code).toBe("blocking_risk_flag");
    expect((await partnerByEmail(email))!.status).not.toBe("active");
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("C — Cent introductions : AUCUNE limite à cinq, pagination correcte", () => {
  it("C1 — un cabinet enregistre 100 entreprises et les lit page par page", async () => {
    const email = "vol@cabinet-volume.fr";
    await applyViaRoute({ cabinetName: "Cabinet Volume", firstName: "V", lastName: "L", email, country: "FR", cabinetType: "expertise_comptable" }, "203.0.113.20");
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active' where id=$1`, [p.id]));

    for (let i = 1; i <= 100; i++) {
      const r = await withService(h.db, (tx) => submitIntroduction(tx, p.id, {
        companyName: `Entreprise ${i}`, companyDomain: `entreprise-${i}.fr`, contactEmail: `dg@entreprise-${i}.fr`,
      }));
      expect(r.ok).toBe(true); // aucun refus au-delà de 5
    }

    const total = await withPartner(h.db, p.id, (tx) => listIntroductionsPaged(tx, p.id, { limit: 1, offset: 0 }));
    expect(total.total).toBe(100); // les 100 sont bien enregistrées

    // Pagination : 4 pages de 25, aucune fuite, aucun doublon.
    const seen = new Set<string>();
    for (let off = 0; off < 100; off += 25) {
      const page = await withPartner(h.db, p.id, (tx) => listIntroductionsPaged(tx, p.id, { limit: 25, offset: off }));
      expect(page.items).toHaveLength(25);
      expect(page.limit).toBe(25);
      page.items.forEach((i) => seen.add(i.id));
      expect(page.hasMore).toBe(off + 25 < 100);
    }
    expect(seen.size).toBe(100);

    // La page demandée seule est lue (jamais tout le portefeuille).
    const one = await withPartner(h.db, p.id, (tx) => listIntroductionsPaged(tx, p.id, { limit: 10, offset: 90 }));
    expect(one.items).toHaveLength(10);
    expect(one.hasMore).toBe(false);
  }, 60_000);
});

// ════════════════════════════════════════════════════════════════════════════
describe("D — Attribution par LIEN : clic → inscription → paiement → verrouillage", () => {
  it("D1 — parcours complet, commission 20 % correcte", async () => {
    const n = nextSeq();
    const email = `lien${n}@cabinet-lien.fr`;
    await applyViaRoute({ cabinetName: `Cabinet Lien ${n}`, firstName: "L", lastName: "N", email, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.30");
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active', reserve_days=0 where id=$1`, [p.id]));

    // Clic sur le lien public → touch enregistré CÔTÉ SERVEUR.
    const { GET } = await import("@/app/api/partners/click/route");
    const click = await GET(new Request(`http://localhost/api/partners/click?partner=${p.public_slug}`, { headers: { "x-forwarded-for": "203.0.113.31" } }));
    expect(click.headers.get("set-cookie")).toContain("cs_pp_ref="); // cookie signé
    const t = await withService(h.db, (tx) => tx.query<{ touch_key: string }>(`select touch_key from clonestore_pp_referral_touches where partner_id=$1 order by occurred_at desc limit 1`, [p.id]));

    const subject = uuid(1000 + n);
    const att = await withService(h.db, (tx) => attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: `dg@client-lien-${n}.fr`, touchKey: t.rows[0].touch_key }));
    expect("attributionId" in att && att.source).toBe("link");

    // Paiement → verrouillage + commission.
    await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, {
      eventId: `evt_lien_${n}`, type: "invoice.paid", livemode: false, eventCreated: 1,
      subscriptionId: `sub_lien_${n}`, customerId: `cus_lien_${n}`, subjectUserId: subject,
      invoiceId: `in_lien_${n}`, paymentIntentId: `pi_lien_${n}`,
      totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur",
    }));

    const a = await withService(h.db, (tx) => tx.query<{ status: string }>(`select status from clonestore_pp_attributions where subject_user_id=$1`, [subject]));
    expect(a.rows[0].status).toBe("locked");
    const c = await withService(h.db, (tx) => tx.query<{ commission_minor: number; eligible_net_minor: number }>(`select commission_minor, eligible_net_minor from clonestore_pp_commission_entries where partner_id=$1`, [p.id]));
    expect(c.rows[0].eligible_net_minor).toBe(44_900); // HT
    expect(c.rows[0].commission_minor).toBe(8_980); // 20 % — inchangé
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("E — Attribution par INTRODUCTION : inscription SANS clic, rapprochement normalisé", () => {
  it("E1 — rapprochement par domaine (l'entreprise n'a jamais cliqué)", async () => {
    const n = nextSeq();
    const email = `intro${n}@cabinet-intro.fr`;
    await applyViaRoute({ cabinetName: `Cabinet Intro ${n}`, firstName: "I", lastName: "T", email, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.40");
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active' where id=$1`, [p.id]));

    // Introduction directe, avec un domaine écrit « salement » → normalisé.
    const sub = await withService(h.db, (tx) => submitIntroduction(tx, p.id, {
      companyName: "Société Cliente SARL", companyDomain: "HTTPS://WWW.Societe-Cliente.fr/contact",
    }));
    expect(sub.ok).toBe(true);
    const stored = await withService(h.db, (tx) => tx.query<{ company_domain: string }>(`select company_domain from clonestore_pp_introductions where partner_id=$1`, [p.id]));
    expect(stored.rows[0].company_domain).toBe("societe-cliente.fr"); // normalisé

    // L'entreprise s'inscrit SANS jamais cliquer : rapprochement par domaine e-mail.
    const subject = uuid(2000 + n);
    const att = await withService(h.db, (tx) => attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: "dg@societe-cliente.fr" }));
    expect("attributionId" in att && att.source).toBe("introduction");

    const intro = await withService(h.db, (tx) => tx.query<{ status: string }>(`select status from clonestore_pp_introductions where partner_id=$1`, [p.id]));
    expect(intro.rows[0].status).toBe("matched");
  });

  it("E2 — l'introduction est PRIORITAIRE sur un lien concurrent", async () => {
    const n = nextSeq();
    // Cabinet A introduit l'entreprise ; cabinet B a un lien cliqué.
    const emailA = `pa${n}@cab-a-${n}.fr`, emailB = `pb${n}@cab-b-${n}.fr`;
    await applyViaRoute({ cabinetName: `Cab A ${n}`, firstName: "A", lastName: "A", email: emailA, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.41");
    await applyViaRoute({ cabinetName: `Cab B ${n}`, firstName: "B", lastName: "B", email: emailB, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.42");
    const A = (await partnerByEmail(emailA))!, B = (await partnerByEmail(emailB))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active' where id in ($1,$2)`, [A.id, B.id]));

    await withService(h.db, (tx) => submitIntroduction(tx, A.id, { companyName: `Cible ${n}`, companyDomain: `cible-${n}.fr` }));
    const t = await withService(h.db, (tx) => tx.query<{ touch_key: string }>(
      `insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now()+interval '90 days') returning touch_key`, [B.id]));

    const subject = uuid(3000 + n);
    const att = await withService(h.db, (tx) => attachAttributionAtSignup(tx, {
      subjectUserId: subject, subjectEmail: `dg@cible-${n}.fr`, touchKey: t.rows[0].touch_key,
    }));
    expect("attributionId" in att && att.source).toBe("introduction"); // introduction > lien

    const owner = await withService(h.db, (tx) => tx.query<{ partner_id: string }>(`select partner_id from clonestore_pp_attributions where subject_user_id=$1 and status='pending'`, [subject]));
    expect(owner.rows[0].partner_id).toBe(A.id); // c'est bien le cabinet qui a introduit
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("F — Conflit : deux cabinets présentent la même entreprise", () => {
  it("F1 — le second est refusé, le conflit est tracé, aucune double attribution", async () => {
    const n = nextSeq();
    const emailA = `fa${n}@cab-fa-${n}.fr`, emailB = `fb${n}@cab-fb-${n}.fr`;
    await applyViaRoute({ cabinetName: `Cab FA ${n}`, firstName: "F", lastName: "A", email: emailA, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.50");
    await applyViaRoute({ cabinetName: `Cab FB ${n}`, firstName: "F", lastName: "B", email: emailB, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.51");
    const A = (await partnerByEmail(emailA))!, B = (await partnerByEmail(emailB))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active' where id in ($1,$2)`, [A.id, B.id]));

    const domain = `conflit-${n}.fr`;
    const r1 = await withService(h.db, (tx) => submitIntroduction(tx, A.id, { companyName: `Conflit ${n}`, companyDomain: domain }));
    expect(r1.ok).toBe(true);
    // A valide son introduction (protection nominative).
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_introductions set status='validated', validated_at=now(), protected_until=now()+interval '180 days' where partner_id=$1`, [A.id]));

    const r2 = await withService(h.db, (tx) => submitIntroduction(tx, B.id, { companyName: `Conflit ${n}`, companyDomain: domain }));
    expect(r2.ok).toBe(false);
    expect(!r2.ok && r2.error).toBe("company_already_protected"); // aucune double attribution

    const dec = await withService(h.db, (tx) => tx.query<{ decision: string; conflict: boolean }>(
      `select decision, conflict from clonestore_pp_attribution_decisions where competing_partner_id=$1`, [A.id]));
    expect(dec.rows[0].decision).toBe("conflict_manual_review"); // conflit audité
    expect(dec.rows[0].conflict).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("G — Auto-parrainage : bloqué", () => {
  it("G1 — le cabinet ne peut pas s'introduire lui-même", async () => {
    const n = nextSeq();
    const email = `self${n}@cabinet-self-${n}.fr`;
    await applyViaRoute({ cabinetName: `Cabinet Self ${n}`, firstName: "S", lastName: "F", email, country: "FR", cabinetType: "conseil_rh", website: `https://cabinet-self-${n}.fr` }, "203.0.113.60");
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active' where id=$1`, [p.id]));

    const r = await withService(h.db, (tx) => submitIntroduction(tx, p.id, { companyName: "Mon propre cabinet", companyDomain: `cabinet-self-${n}.fr` }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("self_referral");
  });

  it("G2 — attribution auto-parrainage refusée et journalisée", async () => {
    const n = nextSeq();
    const email = `self2${n}@cab-self2-${n}.fr`;
    await applyViaRoute({ cabinetName: `Cabinet Self2 ${n}`, firstName: "S", lastName: "G", email, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.61");
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active' where id=$1`, [p.id]));
    const t = await withService(h.db, (tx) => tx.query<{ touch_key: string }>(
      `insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now()+interval '90 days') returning touch_key`, [p.id]));

    // Le prospect a le MÊME domaine que le cabinet → auto-parrainage.
    const subject = uuid(4000 + n);
    const att = await withService(h.db, (tx) => attachAttributionAtSignup(tx, {
      subjectUserId: subject, subjectEmail: `dg@cab-self2-${n}.fr`, touchKey: t.rows[0].touch_key,
    }));
    expect("skipped" in att && att.skipped).toBe("self_referral");

    const dec = await withService(h.db, (tx) => tx.query<{ decision: string }>(`select decision from clonestore_pp_attribution_decisions where subject_user_id=$1`, [subject]));
    expect(dec.rows[0].decision).toBe("rejected_self_referral"); // journalisé
    const attrs = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_attributions where subject_user_id=$1`, [subject]));
    expect(attrs.rows).toHaveLength(0); // aucune attribution créée
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("H — Client existant : aucune attribution rétroactive", () => {
  it("H1 — client antérieur à la source → refus journalisé", async () => {
    const n = nextSeq();
    const email = `ex${n}@cab-ex-${n}.fr`;
    await applyViaRoute({ cabinetName: `Cabinet Ex ${n}`, firstName: "E", lastName: "X", email, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.70");
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active' where id=$1`, [p.id]));
    const t = await withService(h.db, (tx) => tx.query<{ touch_key: string }>(
      `insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now()+interval '90 days') returning touch_key`, [p.id]));

    const subject = uuid(5000 + n);
    // L'entreprise était DÉJÀ cliente il y a un an, bien avant ce clic.
    const att = await withService(h.db, (tx) => attachAttributionAtSignup(tx, {
      subjectUserId: subject, subjectEmail: `dg@deja-client-${n}.fr`,
      touchKey: t.rows[0].touch_key,
      subjectCustomerSince: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
    }));
    expect("skipped" in att && att.skipped).toBe("existing_client");

    const dec = await withService(h.db, (tx) => tx.query<{ decision: string }>(`select decision from clonestore_pp_attribution_decisions where subject_user_id=$1`, [subject]));
    expect(dec.rows[0].decision).toBe("rejected_existing_client");
    const attrs = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_attributions where subject_user_id=$1`, [subject]));
    expect(attrs.rows).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("I — Rejeu Stripe : aucune double commission", () => {
  it("I1 — le même invoice.paid rejoué ne crée pas de seconde commission", async () => {
    const n = nextSeq();
    const email = `rj${n}@cab-rj-${n}.fr`;
    await applyViaRoute({ cabinetName: `Cabinet Rejeu ${n}`, firstName: "R", lastName: "J", email, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.80");
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active', reserve_days=0 where id=$1`, [p.id]));
    const t = await withService(h.db, (tx) => tx.query<{ touch_key: string }>(
      `insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now()+interval '90 days') returning touch_key`, [p.id]));

    const subject = uuid(6000 + n);
    await withService(h.db, (tx) => attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: `dg@client-rj-${n}.fr`, touchKey: t.rows[0].touch_key }));

    const ev = {
      eventId: `evt_rj_${n}`, type: "invoice.paid" as const, livemode: false, eventCreated: 1,
      subscriptionId: `sub_rj_${n}`, customerId: `cus_rj_${n}`, subjectUserId: subject,
      invoiceId: `in_rj_${n}`, paymentIntentId: `pi_rj_${n}`,
      totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur",
    };
    const first = await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, ev));
    expect(first.applied).toBe(true);
    const replay = await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, ev));
    expect(replay.applied).toBe(false);
    expect(replay.reason).toBe("duplicate_event");

    const n2 = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_commission_entries where partner_id=$1 and entry_type='commission'`, [p.id]));
    expect(n2.rows).toHaveLength(1); // une seule commission
  });

  it("I2 — verrouillage idempotent (aucune seconde attribution)", async () => {
    const n = nextSeq();
    const email = `lk${n}@cab-lk-${n}.fr`;
    await applyViaRoute({ cabinetName: `Cabinet Lock ${n}`, firstName: "L", lastName: "K", email, country: "FR", cabinetType: "conseil_rh" }, "203.0.113.81");
    const p = (await partnerByEmail(email))!;
    await withService(h.db, (tx) => tx.query(`update clonestore_pp_partners set status='active' where id=$1`, [p.id]));
    const t = await withService(h.db, (tx) => tx.query<{ touch_key: string }>(
      `insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now()+interval '90 days') returning touch_key`, [p.id]));
    const subject = uuid(7000 + n);
    await withService(h.db, (tx) => attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: `dg@cli-lk-${n}.fr`, touchKey: t.rows[0].touch_key }));

    const l1 = await withService(h.db, (tx) => lockAttributionOnFirstPayment(tx, { subjectUserId: subject, stripeEventId: `evt_lk_${n}`, stripeSubscriptionId: `sub_lk_${n}` }));
    const l2 = await withService(h.db, (tx) => lockAttributionOnFirstPayment(tx, { subjectUserId: subject, stripeEventId: `evt_lk_${n}`, stripeSubscriptionId: `sub_lk_${n}` }));
    expect(l1.ok && !l1.alreadyLocked).toBe(true);
    expect(l2.ok && l2.alreadyLocked).toBe(true);

    // Une attribution verrouillée ne change JAMAIS automatiquement.
    const again = await withService(h.db, (tx) => attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: `dg@cli-lk-${n}.fr`, code: "AAAA-BBBB-CCCC-DDDD" }));
    expect("skipped" in again && again.skipped).toBe("locked_exists");
  });
});
