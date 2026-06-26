// CS-FINAL 1 — résolution serveur de l'espace partenaire (PGlite réel).
// Statuts, isolation RLS (aucune fuite entre partenaires), pont de session, et
// fondation migration _05 (account_user_id + distinctions + awards).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService } from "../server/runtime";
import { registerPartner, verifyEmailToken, createIntroduction } from "../server/store";
import { resolvePartnerCockpit, resolvePartnerSession } from "../server/cockpit";

process.env.CLONESTORY_LOCAL_MODE = "1";

let h: ClonestoryHarness;
beforeAll(async () => {
  h = await createClonestoryHarness();
  __setClonestoryDbForTests(h.db);
});
afterAll(async () => {
  __setClonestoryDbForTests(null);
  await h.close();
});

async function makeVerified(email: string, first = "Cock", last = "Pit") {
  const r = await registerPartner({ firstName: first, lastName: last, email });
  if (!r.ok) throw new Error("register failed");
  const v = await verifyEmailToken(r.verificationToken!);
  if (!v.ok) throw new Error("verify failed");
  return r.partnerId;
}
async function setStatus(partnerId: string, status: string) {
  await withService(h.db, (tx) => tx.query(`update clonestory_fp_partners set status=$2 where id=$1`, [partnerId, status]));
}

describe("résolution cockpit — statuts", () => {
  it("non-membre : e-mail inconnu → member=false, status=non_member", async () => {
    const s = await resolvePartnerCockpit({ userId: "u1", email: "nobody@example.test" });
    expect(s.member).toBe(false);
    expect(s.status).toBe("non_member");
    expect(s.partner).toBeUndefined();
  });

  it("e-mail vide → non_member (jamais de match)", async () => {
    const s = await resolvePartnerCockpit({ userId: "u0", email: null });
    expect(s.status).toBe("non_member");
  });

  it("inscrit non vérifié → status=unverified", async () => {
    const r = await registerPartner({ firstName: "Un", lastName: "Verified", email: "unverif@example.test" });
    if (!r.ok) throw new Error();
    const s = await resolvePartnerCockpit({ userId: "u2", email: "unverif@example.test" });
    expect(s.status).toBe("unverified");
    expect(s.member).toBe(true);
  });

  it("partenaire vérifié → verified + code/lien + distinction 'Membre du Cercle Fondateur'", async () => {
    await makeVerified("verif@example.test", "Vera", "Fied");
    const s = await resolvePartnerCockpit({ userId: "u3", email: "VERIF@example.test" }); // casse différente → match normalisé
    expect(s.status).toBe("verified");
    expect(s.partner?.displayName).toBe("Vera Fied");
    expect(s.partner?.personalCode).toBeTruthy();
    expect(s.partner?.publicLink).toContain("/founding-partners/r/");
    const founding = s.partner!.distinctions.find((d) => d.code === "founding_member");
    expect(founding?.earned).toBe(true);
    // pas de Partenaire Fondateur tant qu'aucune contribution vérifiée
    expect(s.partner!.distinctions.find((d) => d.code === "founding_partner")?.earned).toBe(false);
    expect(s.partner!.founding).toBeNull();
  });

  it("statistiques réelles : une introduction déclarée se reflète", async () => {
    const pid = await makeVerified("stats@example.test", "Stat", "Run");
    const intro = await createIntroduction(pid, { prospectCompany: "ACME", prospectEmail: "p@acme.test", method: "declared" });
    expect(intro.ok).toBe(true);
    const s = await resolvePartnerCockpit({ userId: "u4", email: "stats@example.test" });
    expect(s.partner?.stats.introductionsDeclared).toBe(1);
    expect(s.partner?.stats.contributionsVerified).toBe(0);
    expect(s.partner?.distinctions.find((d) => d.code === "first_introduction")?.earned).toBe(true);
    // activité récente présente (introduction_declared)
    expect(s.partner!.recentActivity.some((a) => a.type === "introduction_declared")).toBe(true);
  });

  it("suspendu → status=suspended ; retiré → withdrawn", async () => {
    const susp = await makeVerified("susp@example.test");
    await setStatus(susp, "suspended");
    expect((await resolvePartnerCockpit({ userId: "u5", email: "susp@example.test" })).status).toBe("suspended");
    const wd = await makeVerified("wd@example.test");
    await setStatus(wd, "withdrawn");
    expect((await resolvePartnerCockpit({ userId: "u6", email: "wd@example.test" })).status).toBe("withdrawn");
  });
});

describe("isolation — aucune fuite entre partenaires", () => {
  it("la résolution de A ne renvoie jamais les données de B", async () => {
    await makeVerified("alice@example.test", "Alice", "Alpha");
    const bId = await makeVerified("bob@example.test", "Bob", "Beta");
    await createIntroduction(bId, { prospectCompany: "BobCorp", prospectEmail: "x@bobcorp.test", method: "declared" });
    const a = await resolvePartnerCockpit({ userId: "ua", email: "alice@example.test" });
    expect(a.partner?.displayName).toBe("Alice Alpha");
    expect(a.partner?.stats.introductionsDeclared).toBe(0); // ne voit PAS l'intro de Bob
    expect(JSON.stringify(a)).not.toContain("BobCorp");
    expect(JSON.stringify(a)).not.toContain("bob@example.test");
  });

  it("aucun token brut ni champ secret dans le résumé renvoyé", async () => {
    await makeVerified("clean@example.test");
    const s = await resolvePartnerCockpit({ userId: "uc", email: "clean@example.test" });
    const blob = JSON.stringify(s);
    expect(blob).not.toContain("csyv1.");
    expect(blob).not.toContain("link_token");
    expect(blob).not.toContain("verification_token");
    expect(blob).not.toContain("code_lookup_hash");
  });
});

describe("pont de session", () => {
  it("vérifié → {partnerId, status:verified} ; inconnu → null ; suspendu → status suspended", async () => {
    const pid = await makeVerified("bridge@example.test");
    const ok = await resolvePartnerSession("bridge@example.test");
    expect(ok?.partnerId).toBe(pid);
    expect(ok?.status).toBe("verified");
    expect(await resolvePartnerSession("ghost@example.test")).toBeNull();
    const susp = await makeVerified("bsusp@example.test");
    await setStatus(susp, "suspended");
    expect((await resolvePartnerSession("bsusp@example.test"))?.status).toBe("suspended");
  });
});

describe("fondation migration _05 (appliquée par le harnais)", () => {
  it("colonne account_user_id + tables distinctions/awards présentes, catalogue seedé", async () => {
    const r = await withService(h.db, async (tx) => {
      const col = await tx.query<{ n: number }>(
        `select count(*)::int n from information_schema.columns where table_name='clonestory_fp_partners' and column_name='account_user_id'`,
      );
      const cat = await tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_distinctions`);
      const aw = await tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_partner_awards`);
      return { col: col.rows[0].n, cat: cat.rows[0].n, aw: aw.rows[0].n };
    });
    expect(r.col).toBe(1);
    expect(r.cat).toBeGreaterThanOrEqual(9); // catalogue seedé
    expect(r.aw).toBe(0); // aucune attribution fictive
  });
});
