// CloneStory — BLOC 2 : test d'intégration du moteur de contribution (PGlite réel).
// Prouve le parcours Jérémie → Paul → entreprise + attribution directe/réseau,
// l'isolation RLS, l'append-only et l'administration. Aucune confiance navigateur.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withPartner, withService } from "../server/runtime";
import {
  registerPartner,
  verifyEmailToken,
  getMyRegistry,
  createIntroduction,
  confirmIntroduction,
  refuseIntroduction,
  findPartnerByLinkToken,
  findPartnerByCode,
  regenerateCredentials,
} from "../server/store";
import { adminSetSuspension, adminRevokeLink, adminResolveDispute, adminListConflicts, adminGetPartnerDetail, adminListAudit } from "../server/admin-store";

// Mode local explicite : autorise les valeurs de développement (secrets) hors prod.
process.env.CLONESTORY_LOCAL_MODE = "1";

let h: ClonestoryHarness;
const ORIGIN = "https://clonestore.pro";

beforeAll(async () => {
  h = await createClonestoryHarness();
  __setClonestoryDbForTests(h.db);
});
afterAll(async () => {
  __setClonestoryDbForTests(null);
  await h.close();
});

async function register(email: string, first: string, last: string, introducerPartnerId?: string) {
  const r = await registerPartner({ firstName: first, lastName: last, email, displayName: `${first} ${last}` }, { introducerPartnerId });
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error("register failed");
  expect(r.verificationToken).toBeTruthy();
  const v = await verifyEmailToken(r.verificationToken!);
  expect(v.ok).toBe(true);
  if (!v.ok) throw new Error("verify failed");
  return v.partner;
}

describe("BLOC 2 — inscription, introduction, attribution", () => {
  it("inscrit + vérifie + émet un code public stable (lien /r/<code>)", async () => {
    const jeremie = await register("jeremie@maison.fr", "Jérémie", "Lefort");
    expect(jeremie.status).toBe("email_verified");
    expect(jeremie.email_verified_at).toBeTruthy();
    expect(jeremie.identity_verified_at).toBeNull(); // §3 — l'email ne vérifie PAS l'identité
    expect(jeremie.link_token).toBeNull(); // pas de token brut en clair
    expect(jeremie.personal_code).toMatch(/^[A-Z0-9]{8}$/); // code public stable (sans PII)
    expect(jeremie.public_slug).toBeTruthy();
    expect(jeremie.registry_number).toBeNull();

    // Le lien stable `/r/<code>` résout par hash du code ; un code modifié est rejeté.
    expect((await findPartnerByCode(jeremie.personal_code!))?.id).toBe(jeremie.id);
    expect(await findPartnerByCode(jeremie.personal_code! + "Z")).toBeNull();
  });

  it("§2 lien STABLE entre sessions + révocation/renouvellement explicite invalide l'ancien", async () => {
    const m = await register("rotate@maison.fr", "Rose", "Toll");
    const code1 = m.personal_code!;
    // Stable : reconnexions répétées → même code (lien toujours résoluble).
    const r1 = (await getMyRegistry(m.id, ORIGIN))!;
    const r2 = (await getMyRegistry(m.id, ORIGIN))!;
    expect(r1.publicLink).toBe(`${ORIGIN}/founding-partners/r/${code1}`);
    expect(r2.publicLink).toBe(r1.publicLink); // stable entre deux lectures/sessions
    expect((await findPartnerByCode(code1))?.id).toBe(m.id); // lien partagé valide

    // Renouvellement EXPLICITE → nouveau code, l'ancien cesse de résoudre.
    const code2 = await regenerateCredentials(m.id);
    expect(code2).toMatch(/^[A-Z0-9]{8}$/);
    expect(code2).not.toBe(code1);
    expect(await findPartnerByCode(code1)).toBeNull(); // ancien invalidé
    expect((await findPartnerByCode(code2!))?.id).toBe(m.id); // nouveau fonctionne
    const r3 = (await getMyRegistry(m.id, ORIGIN))!;
    expect(r3.publicLink).toBe(`${ORIGIN}/founding-partners/r/${code2}`); // registre affiche le nouveau

    // Aucun token brut en clair où que ce soit ; aucune PII dans le code.
    const clear = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_partners where link_token is not null`));
    expect(clear.rows[0].n).toBe(0);
    expect(code2).not.toContain("@");
  });

  it("email déjà utilisé → réémission, pas de doublon", async () => {
    const again = await registerPartner({ firstName: "Jérémie", lastName: "Lefort", email: "JEREMIE@maison.fr", displayName: "Jérémie L." });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.alreadyExisted).toBe(true);
    const { rows } = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_partners where email_normalized='jeremie@maison.fr'`));
    expect(rows[0].n).toBe(1);
  });

  it("lien invalide / token de vérif invalide refusés", async () => {
    expect(await findPartnerByLinkToken("fp_does_not_exist")).toBeNull();
    const bad = await verifyEmailToken("nope");
    expect(bad.ok).toBe(false);
  });

  it("PARCOURS COMPLET Jérémie → Paul → entreprise : direct à Paul, réseau à Jérémie, aucun titre", async () => {
    const jeremie = (await findPartnerByCode((await register("jeremie2@maison.fr", "Jérémie", "Branche")).personal_code!))!;

    // Jérémie introduit Paul ; auto-introduction refusée.
    const self = await createIntroduction(jeremie.id, { prospectCompany: "Maison", prospectEmail: "jeremie2@maison.fr" });
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.error).toBe("self_attribution");

    const introPaul = await createIntroduction(jeremie.id, { prospectCompany: "Atelier Paul", prospectEmail: "paul@atelier.fr", prospectFirstName: "Paul" });
    expect(introPaul.ok).toBe(true);
    if (!introPaul.ok) throw new Error("intro failed");

    // Tant que non confirmé : declared, aucune contribution.
    let reg = (await getMyRegistry(jeremie.id, ORIGIN))!;
    expect(reg.stats.inProgress).toBe(1);
    expect(reg.stats.confirmed).toBe(0);

    // Paul confirme.
    const conf = await confirmIntroduction(introPaul.confirmToken);
    expect(conf.ok).toBe(true);
    if (!conf.ok) throw new Error();
    expect(conf.disputed).toBe(false);

    reg = (await getMyRegistry(jeremie.id, ORIGIN))!;
    expect(reg.stats.inProgress).toBe(0);
    expect(reg.stats.confirmed).toBe(1);

    // Paul s'inscrit DEPUIS la branche de Jérémie.
    const paul = await register("paul@atelier.fr", "Paul", "Rivet", jeremie.id);
    expect(paul.introduced_by_partner_id).toBe(jeremie.id);

    // Paul introduit une entreprise, qui confirme.
    const introCo = await createIntroduction(paul.id, { prospectCompany: "Verrerie du Nord", prospectEmail: "contact@verreriedunord.fr" });
    expect(introCo.ok).toBe(true);
    if (!introCo.ok) throw new Error();
    expect((await confirmIntroduction(introCo.confirmToken)).ok).toBe(true);

    // Attribution directe → Paul. Impact réseau → Jérémie.
    const paulReg = (await getMyRegistry(paul.id, ORIGIN))!;
    expect(paulReg.stats.confirmed).toBe(1); // direct
    expect(paulReg.stats.networkConfirmed).toBe(0);
    expect(paulReg.introducerName).toBe("Jérémie Branche"); // origine de branche

    const jeremieReg = (await getMyRegistry(jeremie.id, ORIGIN))!;
    expect(jeremieReg.stats.confirmed).toBe(1); // sa propre intro de Paul confirmée (direct)
    expect(jeremieReg.stats.networkConfirmed).toBe(1); // l'entreprise apportée par Paul (réseau)

    // AUCUN titre public tant qu'aucun achat réel n'est vérifié.
    expect(paulReg.stats.verifiedDirect).toBe(0);
    expect(jeremieReg.partner.registry_number).toBeNull();
    expect(paulReg.partner.registry_number).toBeNull();
    expect(paulReg.partner.status).not.toBe("founding_partner");
  });

  it("ISOLATION RLS : un membre ne lit jamais les introductions d'un autre", async () => {
    const a = await register("rls-a@x.fr", "Alice", "A");
    const b = await register("rls-b@x.fr", "Bruno", "B");
    await createIntroduction(a.id, { prospectCompany: "Société A", prospectEmail: "lead@societea.fr" });

    // En MODE MEMBRE lié à B, on ne voit AUCUNE ligne de A (RLS).
    const seen = await withPartner(h.db, b.id, async (tx) => {
      const own = await tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_introductions`);
      const tryA = await tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_introductions where partner_id = $1`, [a.id]);
      return { own: own.rows[0].n, tryA: tryA.rows[0].n };
    });
    expect(seen.own).toBe(0); // B n'a aucune introduction
    expect(seen.tryA).toBe(0); // et ne peut pas lire celles de A

    // Le rôle applicatif restreint SANS GUC ne voit rien (fail-closed).
    const blind = await h.db.transaction(async (tx) => {
      await tx.query("set local role pierre_rt_app");
      return tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_partners`);
    });
    expect(blind.rows[0].n).toBe(0);
  });

  it("doublon entreprise : la 2ᵉ confirmation passe en litige (revue manuelle)", async () => {
    const x = await register("dup-x@x.fr", "Xavier", "X");
    const y = await register("dup-y@y.fr", "Yann", "Y");
    const ix = await createIntroduction(x.id, { prospectCompany: "Doublon SA", prospectEmail: "a@doublon.fr" });
    const iy = await createIntroduction(y.id, { prospectCompany: "Doublon SA", prospectEmail: "b@doublon.fr" });
    if (!ix.ok || !iy.ok) throw new Error();
    expect((await confirmIntroduction(ix.confirmToken)).ok).toBe(true);
    const second = await confirmIntroduction(iy.confirmToken);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.disputed).toBe(true); // entreprise déjà attribuée → litige
  });

  it("refus du prospect : annulation + purge PII", async () => {
    const m = await register("refus@x.fr", "Mona", "M");
    const i = await createIntroduction(m.id, { prospectCompany: "Refus SARL", prospectEmail: "refuse@refus.fr", prospectFirstName: "Léa", note: "à rappeler" });
    if (!i.ok) throw new Error();
    // Token de refus DISTINCT du token de confirmation (usages cloisonnés, CS-FINAL 4).
    expect((await refuseIntroduction(i.confirmToken)).ok).toBe(false); // un lien de confirmation ne refuse jamais
    expect((await refuseIntroduction(i.refuseToken)).ok).toBe(true);
    const row = await withService(h.db, (tx) => tx.query<{ status: string; prospect_email: string | null; note: string | null }>(
      `select status, prospect_email, note from clonestory_fp_introductions where id = $1`, [i.introductionId]));
    expect(row.rows[0].status).toBe("canceled");
    expect(row.rows[0].prospect_email).toBeNull(); // PII purgée
    expect(row.rows[0].note).toBeNull();
  });

  it("événements de contribution : APPEND-ONLY (update/delete refusés)", async () => {
    await expect(
      withService(h.db, (tx) => tx.query(`update clonestory_fp_contribution_events set type='manual_validation' where true`)),
    ).rejects.toThrow();
    await expect(
      withService(h.db, (tx) => tx.query(`delete from clonestory_fp_contribution_events where true`)),
    ).rejects.toThrow();
  });

  it("codes/liens uniques : collision impossible (contrainte)", async () => {
    const p = await register("uniq@x.fr", "Uma", "U");
    await expect(
      withService(h.db, (tx) => tx.query(
        `insert into clonestory_fp_partners (email,email_normalized,first_name,last_name,display_name,status,personal_code)
         values ('z@z.fr','z@z.fr','Z','Z','Z','registered',$1)`, [p.personal_code])),
    ).rejects.toThrow();
  });

  it("administration : suspension (raison obligatoire), révocation, litige, audit", async () => {
    const p = await register("admin-target@x.fr", "Théo", "T");
    expect((await adminSetSuspension("owner@clonestore.pro", p.id, true, "")).ok).toBe(false); // raison requise
    expect((await adminSetSuspension("owner@clonestore.pro", p.id, true, "fraude suspectée")).ok).toBe(true);
    const detail = await adminGetPartnerDetail(p.id);
    expect(detail.partner?.status).toBe("suspended");

    // Révocation de lien sur un partenaire NON suspendu (preuve isolée).
    const linkP = await register("admin-link@x.fr", "Léon", "L");
    const codeBefore = linkP.personal_code!;
    expect(await findPartnerByCode(codeBefore)).not.toBeNull(); // lien /r/<code> résoluble avant
    expect((await adminRevokeLink("owner@clonestore.pro", linkP.id, "")).ok).toBe(false); // raison requise
    expect((await adminRevokeLink("owner@clonestore.pro", linkP.id, "lien partagé publiquement")).ok).toBe(true);
    const after = await adminGetPartnerDetail(linkP.id);
    expect(after.partner?.link_revoked_at).toBeTruthy();
    expect(await findPartnerByCode(codeBefore)).toBeNull(); // lien révoqué → ne résout plus

    const audit = await adminListAudit(10);
    expect(audit.some((a) => a.action === "partner.suspend" && a.reason === "fraude suspectée")).toBe(true);
    expect(audit.some((a) => a.action === "partner.revoke_link")).toBe(true);
  });

  it("conflits + résolution de litige tracée", async () => {
    const conflicts = await adminListConflicts();
    expect(conflicts.length).toBeGreaterThanOrEqual(1); // le doublon Doublon SA
    const disputed = conflicts[0];
    expect((await adminResolveDispute("owner@clonestore.pro", disputed.id, "canceled", "entreprise déjà attribuée")).ok).toBe(true);
  });

  it("§4 IMPACT RÉSEAU RÉCURSIF : Jérémie→Paul→Marc, Marc direct=2, Paul & Jérémie réseau=2", async () => {
    const jeremie = await register("rec-jeremie@x.fr", "Jérémie", "Rec");
    const paul = await register("rec-paul@x.fr", "Paul", "Rec", jeremie.id);
    const marc = await register("rec-marc@x.fr", "Marc", "Rec", paul.id);

    // Marc apporte deux entreprises, toutes deux confirmées.
    for (const co of ["Marc Co A", "Marc Co B"]) {
      const i = await createIntroduction(marc.id, { prospectCompany: co, prospectEmail: `lead-${co.replace(/\s/g, "")}@x.fr` });
      if (!i.ok) throw new Error();
      expect((await confirmIntroduction(i.confirmToken)).ok).toBe(true);
    }

    const marcReg = (await getMyRegistry(marc.id, ORIGIN))!;
    expect(marcReg.stats.confirmed).toBe(2); // direct = 2
    expect(marcReg.stats.networkConfirmed).toBe(0);

    const paulReg = (await getMyRegistry(paul.id, ORIGIN))!;
    expect(paulReg.stats.confirmed).toBe(0); // Paul n'a aucune intro directe ici
    expect(paulReg.stats.networkConfirmed).toBe(2); // réseau = 2 (via Marc)

    const jeremieReg = (await getMyRegistry(jeremie.id, ORIGIN))!;
    expect(jeremieReg.stats.confirmed).toBe(0);
    expect(jeremieReg.stats.networkConfirmed).toBe(2); // réseau RÉCURSIF = 2 (via Paul→Marc)
  });

  it("§4 réseau récursif cycle-safe (un cycle ne boucle pas)", async () => {
    const a = await register("cyc-a@x.fr", "Cyc", "A");
    const b = await register("cyc-b@x.fr", "Cyc", "B", a.id);
    // Force un cycle a→b→a directement en base (état corrompu) ; le calcul doit terminer.
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_partners set introduced_by_partner_id = $1 where id = $2`, [b.id, a.id]));
    const reg = (await getMyRegistry(a.id, ORIGIN))!; // ne doit pas boucler ni planter
    expect(typeof reg.stats.networkConfirmed).toBe("number");
  });

  it("§5 réactivation restaure le VRAI statut antérieur (jamais un reset arbitraire)", async () => {
    // Membre simple (email_verified).
    const simple = await register("susp-simple@x.fr", "Sim", "Ple");
    expect((await adminSetSuspension("owner@clonestore.pro", simple.id, true, "test")).ok).toBe(true);
    expect((await adminSetSuspension("owner@clonestore.pro", simple.id, false, "réintégration")).ok).toBe(true);
    expect((await adminGetPartnerDetail(simple.id)).partner?.status).toBe("email_verified");

    // Statut élevé (ex. futur active_contributor / founding_partner) : on le pose en base
    // puis on suspend/réactive → il doit être RESTAURÉ tel quel, pas remis à email_verified.
    const high = await register("susp-high@x.fr", "Haut", "Rang");
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_partners set status = 'founding_partner', registry_number = 9001 where id = $1`, [high.id]));
    expect((await adminSetSuspension("owner@clonestore.pro", high.id, true, "vérification")).ok).toBe(true);
    expect((await adminGetPartnerDetail(high.id)).partner?.status).toBe("suspended");
    // Suspension multiple : re-suspendre ne perd pas le statut original mémorisé.
    expect((await adminSetSuspension("owner@clonestore.pro", high.id, true, "encore")).ok).toBe(true);
    expect((await adminSetSuspension("owner@clonestore.pro", high.id, false, "réintégration auditée")).ok).toBe(true);
    expect((await adminGetPartnerDetail(high.id)).partner?.status).toBe("founding_partner"); // restauré, pas reset

    const audit = await adminListAudit(20);
    expect(audit.some((x) => x.action === "partner.reinstate" && x.reason === "réintégration auditée")).toBe(true);
  });
});
