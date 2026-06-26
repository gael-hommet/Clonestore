// CS-FINAL 2 — moteur d'attribution (PGlite réel). Lien, introduction, compte,
// entreprise, déduplication, conflits, priorité, machine d'états, RLS, administration.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService, withPartner } from "../server/runtime";
import { registerPartner, verifyEmailToken, createIntroduction, confirmIntroduction } from "../server/store";
import {
  capturePartnerVisit,
  captureAccountAttribution,
  getAttributionForAccount,
  listAttributionConflicts,
  invalidateAttribution,
  manualAttribute,
} from "../server/attribution";
import { newVisitorId } from "../server/attribution-cookie";
import { randomUUID } from "node:crypto";

process.env.CLONESTORY_LOCAL_MODE = "1";

// account_user_id est un UUID (= user.id Supabase). Map stable label → UUID.
const accountIds = new Map<string, string>();
function acct(label: string): string {
  if (!accountIds.has(label)) accountIds.set(label, randomUUID());
  return accountIds.get(label)!;
}

let h: ClonestoryHarness;
beforeAll(async () => {
  h = await createClonestoryHarness();
  __setClonestoryDbForTests(h.db);
});
afterAll(async () => {
  __setClonestoryDbForTests(null);
  await h.close();
});

let seq = 0;
async function makePartner(label: string): Promise<{ id: string; email: string }> {
  const email = `p-${label}-${seq++}@partner.test`;
  const r = await registerPartner({ firstName: "P", lastName: label, email });
  if (!r.ok) throw new Error("register");
  const v = await verifyEmailToken(r.verificationToken!);
  if (!v.ok) throw new Error("verify");
  return { id: r.partnerId, email };
}
async function introduceAndConfirm(partnerId: string, prospectEmail: string, company: string) {
  const intro = await createIntroduction(partnerId, { prospectCompany: company, prospectEmail, method: "declared" });
  if (!intro.ok) throw new Error("intro: " + intro.error);
  const c = await confirmIntroduction(intro.confirmToken);
  if (!c.ok) throw new Error("confirm");
  return intro.introductionId;
}
async function introStatus(id: string): Promise<string> {
  return (await withService(h.db, (tx) => tx.query<{ status: string }>(`select status from clonestory_fp_introductions where id=$1`, [id]))).rows[0].status;
}

describe("origine A — clic de lien", () => {
  it("crée une attribution anonyme ; first-touch conservé ; 2e partenaire ne vole pas", async () => {
    const a = await makePartner("linkA");
    const b = await makePartner("linkB");
    const vid = newVisitorId();
    const r1 = await capturePartnerVisit({ partnerId: a.id, visitorId: vid, existingVisitorId: null });
    expect(r1.ok).toBe(true);
    expect(r1.alreadyAttributed).toBe(false);
    // 2e clic, MÊME visiteur, AUTRE partenaire → first-touch (A) conservé
    const r2 = await capturePartnerVisit({ partnerId: b.id, visitorId: vid, existingVisitorId: vid });
    expect(r2.partnerId).toBe(a.id);
    expect(r2.alreadyAttributed).toBe(true);
  });

  it("partenaire suspendu → inéligible (aucune attribution)", async () => {
    const a = await makePartner("susp");
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_partners set status='suspended' where id=$1`, [a.id]));
    const r = await capturePartnerVisit({ partnerId: a.id, visitorId: newVisitorId(), existingVisitorId: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("partner_ineligible");
  });
});

describe("origine B + convergence — compte", () => {
  it("compte depuis un lien → account_linked", async () => {
    const a = await makePartner("acctlink");
    const vid = newVisitorId();
    await capturePartnerVisit({ partnerId: a.id, visitorId: vid, existingVisitorId: null });
    const d = await captureAccountAttribution({ accountUserId: acct("acctlink"), email: "prospect-acctlink@x.test", visitorId: vid });
    expect(d.attributed).toBe(true);
    expect(d.partnerId).toBe(a.id);
    expect(d.source).toBe("partner_link");
    expect((await getAttributionForAccount(acct("acctlink")))?.partnerId).toBe(a.id);
  });

  it("compte depuis introduction confirmée → account_linked + intro→prospect_registered", async () => {
    const a = await makePartner("acctintro");
    const introId = await introduceAndConfirm(a.id, "prospect-intro@acme-corp.test", "Acme Corp");
    expect(await introStatus(introId)).toBe("prospect_confirmed");
    const d = await captureAccountAttribution({ accountUserId: acct("acctintro"), email: "prospect-intro@acme-corp.test" });
    expect(d.attributed).toBe(true);
    expect(d.partnerId).toBe(a.id);
    expect(d.source).toBe("confirmed_introduction");
    expect(await introStatus(introId)).toBe("prospect_registered");
  });

  it("PRIORITÉ : introduction confirmée (B) > clic de lien (A) ; lien superséd é + conflit", async () => {
    const a = await makePartner("prioLink"); // clic
    const b = await makePartner("prioIntro"); // introduction
    const email = "prospect-prio@firmco.test";
    await introduceAndConfirm(b.id, email, "Firm Co");
    const vid = newVisitorId();
    await capturePartnerVisit({ partnerId: a.id, visitorId: vid, existingVisitorId: null });
    const d = await captureAccountAttribution({ accountUserId: acct("prio"), email, visitorId: vid });
    expect(d.partnerId).toBe(b.id); // l'introduction gagne
    expect(d.conflict).toBe(true);
    // le lien anonyme de A est superséd é
    const supersededA = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_attributions where partner_id=$1 and status='superseded'`, [a.id]))).rows[0].n;
    expect(supersededA).toBe(1);
  });

  it("compte DÉJÀ attribué → conservé (aucun vol) + idempotent", async () => {
    const a = await makePartner("keep");
    const vid = newVisitorId();
    await capturePartnerVisit({ partnerId: a.id, visitorId: vid, existingVisitorId: null });
    const d1 = await captureAccountAttribution({ accountUserId: acct("keep"), email: "p-keep@x.test", visitorId: vid });
    expect(d1.partnerId).toBe(a.id);
    // 2e source (autre partenaire) ne remplace pas
    const b = await makePartner("steal");
    await introduceAndConfirm(b.id, "p-keep@x.test", "Keep Co");
    const d2 = await captureAccountAttribution({ accountUserId: acct("keep"), email: "p-keep@x.test" });
    expect(d2.partnerId).toBe(a.id); // toujours A
    expect(d2.reason).toBe("existing_kept");
    const active = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_attributions where account_user_id=$1 and status in ('account_linked','company_linked')`, [acct("keep")]))).rows[0].n;
    expect(active).toBe(1); // aucun doublon actif
  });

  it("auto-attribution refusée (e-mail du partenaire lui-même)", async () => {
    const a = await makePartner("selfattr");
    const vid = newVisitorId();
    await capturePartnerVisit({ partnerId: a.id, visitorId: vid, existingVisitorId: null });
    const d = await captureAccountAttribution({ accountUserId: acct("self"), email: a.email, visitorId: vid });
    expect(d.attributed).toBe(false);
    expect(d.reason).toBe("no_eligible_source");
  });
});

describe("entreprise & déduplication", () => {
  it("companyName → company_linked + intro→company_created", async () => {
    const a = await makePartner("co");
    const email = "founder@dedup-corp.test";
    const introId = await introduceAndConfirm(a.id, email, "Dedup Corp");
    const d = await captureAccountAttribution({ accountUserId: acct("co"), email, companyName: "Dedup Corp" });
    expect(d.attributed).toBe(true);
    expect(d.companyLinked).toBe(true);
    expect(await introStatus(introId)).toBe("company_created");
  });

  it("entreprise déjà attribuée à un autre partenaire → pas de vol", async () => {
    const a = await makePartner("coA");
    const b = await makePartner("coB");
    await captureAccountAttribution({ accountUserId: acct("coA2"), email: "x@shared-co.test", companyName: "Shared Co", visitorId: await linkVisitor(a.id) });
    await captureAccountAttribution({ accountUserId: acct("coB2"), email: "y@shared-co.test", companyName: "Shared Co", visitorId: await linkVisitor(b.id) });
    const holder = (await withService(h.db, (tx) => tx.query<{ partner_id: string }>(
      `select partner_id::text from clonestory_fp_attributions where status='company_linked' and company_ref='Shared Co' limit 1`))).rows[0];
    expect(holder?.partner_id).toBe(a.id); // l'entreprise reste au premier (A)
  });

  it("domaine générique (gmail) seul → pas d'attribution d'entreprise", async () => {
    const a = await makePartner("gmail");
    const vid = await linkVisitor(a.id);
    const d = await captureAccountAttribution({ accountUserId: acct("gmail"), email: "someone@gmail.com", visitorId: vid });
    expect(d.attributed).toBe(true); // compte lié (par lien)
    expect(d.companyLinked).toBeFalsy(); // mais PAS d'entreprise (domaine générique, pas de companyName)
  });
});

async function linkVisitor(partnerId: string): Promise<string> {
  const vid = newVisitorId();
  await capturePartnerVisit({ partnerId, visitorId: vid, existingVisitorId: null });
  return vid;
}

describe("administration & RLS", () => {
  it("listAttributionConflicts expose les conflits, invalidate fonctionne", async () => {
    const conflicts = await listAttributionConflicts();
    expect(Array.isArray(conflicts)).toBe(true);
    expect(conflicts.length).toBeGreaterThanOrEqual(1); // le conflit de priorité plus haut
    // invalidation : l'attribution active disparaît
    const a = await makePartner("inval");
    await captureAccountAttribution({ accountUserId: acct("inval"), email: "p-inval@x.test", visitorId: await linkVisitor(a.id) });
    const attrId = (await withService(h.db, (tx) => tx.query<{ id: string }>(
      `select id::text from clonestory_fp_attributions where account_user_id=$1 limit 1`, [acct("inval")]))).rows[0].id;
    expect(await invalidateAttribution(attrId, "test")).toBe(true);
    expect(await getAttributionForAccount(acct("inval"))).toBeNull();
  });

  it("attribution manuelle (admin) supersède et prend la priorité", async () => {
    const a = await makePartner("man");
    await captureAccountAttribution({ accountUserId: acct("man"), email: "p-man@x.test", visitorId: await linkVisitor(a.id) });
    const b = await makePartner("manB");
    const m = await manualAttribute({ partnerId: b.id, accountUserId: acct("man"), awardedBy: "admin@clonestore.pro", reason: "litige résolu" });
    expect(m.ok).toBe(true);
    expect((await getAttributionForAccount(acct("man")))?.partnerId).toBe(b.id);
    expect((await getAttributionForAccount(acct("man")))?.source).toBe("manual_admin");
  });

  it("RLS : un partenaire ne lit QUE ses propres attributions", async () => {
    const a = await makePartner("rlsA");
    const b = await makePartner("rlsB");
    await captureAccountAttribution({ accountUserId: acct("rlsA"), email: "x@rlsa-co.test", companyName: "RlsA Co", visitorId: await linkVisitor(a.id) });
    const seenByB = (await withPartner(h.db, b.id, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_attributions where partner_id=$1`, [a.id]))).rows[0].n;
    expect(seenByB).toBe(0); // B ne voit pas les attributions de A
  });

  it("aucun e-mail de PROSPECT en clair ni token (empreintes hachées)", async () => {
    const rows = (await withService(h.db, (tx) => tx.query<{ email_fingerprint: string | null }>(
      `select * from clonestory_fp_attributions limit 100`))).rows;
    const blob = JSON.stringify(rows);
    for (const e of [
      "prospect-acctlink@x.test", "prospect-intro@acme-corp.test", "founder@dedup-corp.test",
      "x@shared-co.test", "x@rlsa-co.test", "p-keep@x.test",
    ]) {
      expect(blob, `e-mail prospect en clair: ${e}`).not.toContain(e);
    }
    expect(blob).not.toContain("csyv1.");
    // email_fingerprint = hash 64 hex (jamais l'adresse)
    for (const r of rows) if (r.email_fingerprint) expect(String(r.email_fingerprint)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("fondation _06 + _05 corrigée", () => {
  it("tables d'attribution présentes ; account_user_id UNIQUE", async () => {
    const r = await withService(h.db, async (tx) => {
      const t = await tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_attributions`);
      const e = await tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_attribution_events`);
      const idx = await tx.query<{ n: number }>(`select count(*)::int n from pg_indexes where indexname='uq_csy_partner_account'`);
      return { t: t.rows[0].n, e: e.rows[0].n, idx: idx.rows[0].n };
    });
    expect(r.t).toBeGreaterThanOrEqual(0);
    expect(r.e).toBeGreaterThan(0);
    expect(r.idx).toBe(1); // index unique account_user_id (fix _05)
  });
});
