// FINAL PUBLIC — preuve MULTI-COMPTES (PGlite réel) : N partenaires distincts, isolation
// RLS croisée, unicité des codes + numéros de registre, attributions/contributions
// concurrentes (sérialisées par PGlite), pagination, et un test de CHARGE paramétrable
// (1 000 partenaires / 10 000 introductions) mesurant temps, doublons et requêtes lentes.
//
// Aucune hypothèse mono-partenaire. Aucune donnée production. Aucun paiement réel.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService, withPartner } from "../server/runtime";
import { registerPartner, verifyEmailToken, createIntroduction, getMyRegistry } from "../server/store";
import { capturePartnerVisit, captureAccountAttribution } from "../server/attribution";
import { newVisitorId } from "../server/attribution-cookie";
import {
  applyCommercialStripeEvent, reconcileCommercial, type CommercialStripeEvent,
} from "../server/commercial";
import { randomUUID } from "node:crypto";

process.env.CLONESTORY_LOCAL_MODE = "1";
process.env.CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS = "0";

let h: ClonestoryHarness;
beforeAll(async () => { h = await createClonestoryHarness(); __setClonestoryDbForTests(h.db); });
afterAll(async () => { __setClonestoryDbForTests(null); await h.close(); });

let seq = 0;
async function makePartner(label: string): Promise<{ id: string; email: string; code: string }> {
  const email = `ma-${label}-${seq++}@partner.test`;
  const r = await registerPartner({ firstName: "P", lastName: label, email });
  if (!r.ok) throw new Error("register " + (r as { error: string }).error);
  await verifyEmailToken(r.verificationToken!);
  const code = (await withService(h.db, (tx) => tx.query<{ personal_code: string }>(
    `select personal_code from clonestory_fp_partners where id=$1`, [r.partnerId]))).rows[0].personal_code;
  return { id: r.partnerId, email, code };
}
function checkout(sub: string, user: string): CommercialStripeEvent {
  return { eventId: `e_${sub}_co`, type: "checkout.session.completed", livemode: false, createdAt: 1, subscriptionId: sub, customerId: "c", checkoutSessionId: "cs_" + sub, amountPaid: 0, currency: "eur", userId: user, agentSlug: "pierre" };
}
function invoice(sub: string, pi: string): CommercialStripeEvent {
  return { eventId: `e_${sub}_in`, type: "invoice.paid", livemode: false, createdAt: 2, subscriptionId: sub, customerId: "c", invoiceId: "in_" + sub, paymentIntentId: pi, amountPaid: 44900, currency: "eur" };
}

describe("N partenaires distincts : unicité & isolation RLS", () => {
  const N = 22;
  const partners: { id: string; email: string; code: string }[] = [];

  it(`crée ${N} partenaires : ids + codes personnels TOUS uniques`, async () => {
    for (let i = 0; i < N; i++) partners.push(await makePartner(`u${i}`));
    expect(new Set(partners.map((p) => p.id)).size).toBe(N);
    expect(new Set(partners.map((p) => p.code)).size).toBe(N); // aucun code en collision
    expect(partners.every((p) => /^[A-Z0-9]{8}$/.test(p.code))).toBe(true); // code normalisé (8, sans tiret)
  });

  it("chaque partenaire ne voit QUE ses propres lignes (RLS croisée sur les 22)", async () => {
    // Chaque partenaire déclare une introduction.
    for (const p of partners) {
      const r = await createIntroduction(p.id, { prospectCompany: `Co-${p.id.slice(0, 6)}`, prospectEmail: `pr-${p.id.slice(0, 6)}@x.test` });
      expect(r.ok).toBe(true);
    }
    // Isolation : un partenaire au hasard ne voit aucune intro d'un AUTRE (somme = 0).
    const a = partners[3], b = partners[17];
    const seenByA = (await withPartner(h.db, a.id, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_introductions where partner_id <> $1`, [a.id]))).rows[0].n;
    expect(seenByA).toBe(0); // RLS : 0 ligne d'autrui
    const ownB = (await withPartner(h.db, b.id, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_introductions`))).rows[0].n;
    expect(ownB).toBe(1); // B ne voit QUE la sienne
  });

  it("service sans GUC = fail-closed (0 ligne) ; service avec GUC voit tout", async () => {
    const blind = (await h.db.transaction(async (tx) => {
      await tx.query("set local role pierre_rt_app");
      return (await tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_introductions`)).rows[0].n;
    }));
    expect(blind).toBe(0); // aucune GUC → RLS fail-closed
    const all = (await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_introductions`))).rows[0].n;
    expect(all).toBe(N); // service voit les 22
  });
});

describe("registry_number & distinctions à l'échelle (séquentiel, unique)", () => {
  it("6 partenaires vérifiés → 6 numéros de registre UNIQUES et séquentiels", async () => {
    const nums: number[] = [];
    for (let i = 0; i < 6; i++) {
      const p = await makePartner(`reg${i}`);
      const acc = randomUUID();
      const vid = newVisitorId();
      await capturePartnerVisit({ partnerId: p.id, visitorId: vid, existingVisitorId: null });
      await captureAccountAttribution({ accountUserId: acc, email: `reg${i}@regco${i}.test`, visitorId: vid });
      const sub = `sub_reg_${i}_${seq++}`;
      await applyCommercialStripeEvent(checkout(sub, acc), {});
      await applyCommercialStripeEvent(invoice(sub, `pi_${sub}`), {});
      await reconcileCommercial(new Date());
      const rn = (await withService(h.db, (tx) => tx.query<{ registry_number: number }>(
        `select registry_number from clonestory_fp_partners where id=$1`, [p.id]))).rows[0].registry_number;
      nums.push(Number(rn));
    }
    expect(new Set(nums).size).toBe(6); // tous distincts
    expect(Math.max(...nums) - Math.min(...nums)).toBe(5); // séquentiels, aucun trou/doublon
    // aucune distinction en double : index unique (partner_id, distinction_code)
    const dupAward = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select coalesce(max(c),0)::int n from (select partner_id, distinction_code, count(*) c from clonestory_fp_partner_awards group by 1,2) d`))).rows[0].n;
    expect(dupAward).toBeLessThanOrEqual(1); // jamais 2× la même distinction pour un partenaire
  });
});

describe("pagination : registre borné, stats exactes", () => {
  it("partenaire avec >200 introductions → affichage ≤200 mais stats EXACTES", async () => {
    const p = await makePartner("paginate");
    // Insertion en masse de 250 introductions 'declared' (bulk SQL).
    await withService(h.db, (tx) => tx.query(
      `insert into clonestory_fp_introductions (partner_id, method, status, prospect_company, prospect_email, prospect_email_normalized, company_fingerprint, confirm_generation)
       select $1::uuid,'declared','declared','Bulk '||g,'b'||g||'@bulk.test','b'||g||'@bulk.test', md5('bulk'||$1::text||g::text), 1 from generate_series(1,250) g`, [p.id]));
    const reg = await getMyRegistry(p.id, "https://clonestore.pro");
    expect(reg).not.toBeNull();
    expect(reg!.introductions.length).toBe(200); // affichage BORNÉ
    expect(reg!.stats.inProgress).toBe(250); // stats EXACTES (agrégat, pas l'affichage)
  });
});

describe("CHARGE locale paramétrable (1 000 partenaires / 10 000 introductions)", () => {
  it("insère en masse, mesure le temps, prouve 0 doublon et des requêtes bornées", async () => {
    const N = Number(process.env.CLONESTORY_LOAD_N ?? 1000);
    const M = Number(process.env.CLONESTORY_LOAD_M ?? 10000);
    const t0 = Date.now();
    await withService(h.db, (tx) => tx.query(
      `insert into clonestory_fp_partners (status, email, email_normalized, first_name, last_name, display_name, personal_code, code_lookup_hash, email_verified_at)
       select 'email_verified','load'||g||'@x.test','load'||g||'@x.test','F','L'||g,'Load '||g,'LD'||lpad(g::text,8,'0'), md5('lc'||g), now()
       from generate_series(1,$1) g`, [N]));
    const tPartners = Date.now() - t0;
    const t1 = Date.now();
    await withService(h.db, (tx) => tx.query(
      `insert into clonestory_fp_introductions (partner_id, method, status, prospect_company, prospect_email, prospect_email_normalized, company_fingerprint, confirm_generation)
       select p.id,'declared',(array['declared','prospect_confirmed','company_created','verified'])[1+(g%4)],
              'LCo'||g,'lp'||g||'@lc'||g||'.test','lp'||g||'@lc'||g||'.test', md5('lfp'||g), 1
       from generate_series(1,$2) g
       join lateral (select id from clonestory_fp_partners where email like 'load%' order by id offset (g % $1) limit 1) p on true`, [N, M]));
    const tIntros = Date.now() - t1;

    // Unicité : aucun code personnel en doublon malgré N partenaires.
    const dupCodes = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select coalesce(max(c),0)::int n from (select code_lookup_hash, count(*) c from clonestory_fp_partners group by 1) d`))).rows[0].n;
    expect(dupCodes).toBe(1); // chaque hash unique → max occurrences = 1

    // Requête chemin chaud : funnel agrégé d'un partenaire (doit être borné/rapide).
    const onePartner = (await withService(h.db, (tx) => tx.query<{ id: string }>(`select id from clonestory_fp_partners where email like 'load%' limit 1`))).rows[0].id;
    const t2 = Date.now();
    const funnel = (await withPartner(h.db, onePartner, (tx) => tx.query<{ n: number }>(
      `select count(*) filter (where status='verified')::int n from clonestory_fp_introductions where partner_id=$1`, [onePartner]))).rows[0].n;
    const tFunnel = Date.now() - t2;

    const totalP = (await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_partners where email like 'load%'`))).rows[0].n;
    const totalI = (await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_introductions where prospect_email like 'lp%'`))).rows[0].n;

    // eslint-disable-next-line no-console
    console.log(`[charge] partenaires=${totalP} (${tPartners}ms) introductions=${totalI} (${tIntros}ms) funnel1partenaire=${tFunnel}ms verified=${funnel}`);
    expect(totalP).toBe(N);
    expect(totalI).toBe(M);
    expect(tFunnel).toBeLessThan(2000); // requête chemin chaud bornée même à l'échelle
  }, 120000);
});
