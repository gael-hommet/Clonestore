// ONBOARDING SEAMLESS (PGlite réel) : liaison compte (no-steal/idempotente), statut
// d'inscription (pending→verified→linked), confirmation seamless (mint/reuse/conflict/
// invalid/idempotent/account_taken) avec la mécanique Supabase Auth INJECTÉE (mock).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService } from "../server/runtime";
import { registerPartner, verifyEmailToken, linkPartnerAccount, getRegistrationStatus } from "../server/store";
import { runSeamlessConfirm, type SeamlessDeps } from "../server/auth-onboarding";
import { randomUUID } from "node:crypto";

process.env.CLONESTORY_LOCAL_MODE = "1";

let h: ClonestoryHarness;
beforeAll(async () => { h = await createClonestoryHarness(); __setClonestoryDbForTests(h.db); });
afterAll(async () => { __setClonestoryDbForTests(null); await h.close(); });

let seq = 0;
async function register(label: string): Promise<{ id: string; email: string; token: string }> {
  const email = `so-${label}-${seq++}@partner.test`;
  const r = await registerPartner({ firstName: "P", lastName: label, email });
  if (!r.ok) throw new Error("register");
  return { id: r.partnerId, email, token: r.verificationToken! };
}
async function accountOf(partnerId: string): Promise<string | null> {
  return (await withService(h.db, (tx) => tx.query<{ a: string | null }>(
    `select account_user_id::text a from clonestory_fp_partners where id=$1`, [partnerId]))).rows[0].a;
}
/** Mock injectable des dépendances Supabase (jamais de vrai GoTrue en test). */
function mockDeps(opts: { currentEmail?: string | null; currentId?: string; mintUserId?: string; mintOk?: boolean }): SeamlessDeps & { minted: () => number } {
  let minted = 0;
  return {
    minted: () => minted,
    currentUser: async () => (opts.currentEmail ? { id: opts.currentId ?? randomUUID(), email: opts.currentEmail } : null),
    mintSession: async () => { minted++; return opts.mintOk === false ? { ok: false, error: "x" } : { ok: true, userId: opts.mintUserId ?? randomUUID() }; },
  };
}

describe("liaison compte (no-steal, idempotente)", () => {
  it("lie un compte ; rejoue = already ; un compte ne peut servir 2 partenaires", async () => {
    const p = await register("link"); const acc = randomUUID();
    expect((await linkPartnerAccount(p.id, acc)).reason).toBe("linked");
    expect((await linkPartnerAccount(p.id, acc)).reason).toBe("already"); // idempotent
    expect(await accountOf(p.id)).toBe(acc);
    // même compte sur un AUTRE partenaire → refusé
    const q = await register("link2");
    expect((await linkPartnerAccount(q.id, acc)).reason).toBe("account_taken");
    expect(await accountOf(q.id)).toBeNull();
    // partenaire déjà lié à un AUTRE compte → jamais écrasé
    expect((await linkPartnerAccount(p.id, randomUUID())).reason).toBe("partner_linked_other");
    expect(await accountOf(p.id)).toBe(acc);
  });
});

describe("statut d'inscription (page d'attente)", () => {
  it("pending → verified → linked", async () => {
    const p = await register("status");
    expect((await getRegistrationStatus(p.id))?.status).toBe("pending");
    await verifyEmailToken(p.token);
    expect((await getRegistrationStatus(p.id))?.status).toBe("verified");
    await linkPartnerAccount(p.id, randomUUID());
    expect((await getRegistrationStatus(p.id))?.status).toBe("linked");
    const masked = (await getRegistrationStatus(p.id))?.emailMasked;
    expect(masked).toContain("•");      // partie locale masquée
    expect(masked).not.toBe(p.email);   // jamais l'adresse complète
  });
});

describe("confirmation seamless (auth injectée)", () => {
  it("nouvel utilisateur → mint + lié ; account_user_id posé", async () => {
    const p = await register("mint"); const uid = randomUUID();
    const d = mockDeps({ currentEmail: null, mintUserId: uid });
    const r = await runSeamlessConfirm(p.token, d);
    expect(r.state).toBe("linked");
    expect(d.minted()).toBe(1);
    expect(await accountOf(p.id)).toBe(uid);
  });

  it("déjà connecté MÊME adresse → reuse (aucun mint)", async () => {
    const p = await register("reuse"); const uid = randomUUID();
    const d = mockDeps({ currentEmail: p.email, currentId: uid });
    const r = await runSeamlessConfirm(p.token, d);
    expect(r.state).toBe("linked");
    expect(d.minted()).toBe(0); // session réutilisée
    expect(await accountOf(p.id)).toBe(uid);
  });

  it("déjà connecté AUTRE adresse → conflict (aucune liaison, email tout de même vérifié)", async () => {
    const p = await register("conflict");
    const d = mockDeps({ currentEmail: "someone-else@other.test", currentId: randomUUID() });
    const r = await runSeamlessConfirm(p.token, d);
    expect(r.state).toBe("conflict");
    expect(d.minted()).toBe(0);
    expect(await accountOf(p.id)).toBeNull(); // jamais lié au compte d'autrui
    // mais l'email du partenaire EST vérifié (la vérification précède la décision d'auth)
    expect((await getRegistrationStatus(p.id))?.status).toBe("verified");
  });

  it("token invalide → invalid ; double confirmation → idempotent (linked)", async () => {
    const p = await register("idem"); const uid = randomUUID();
    expect((await runSeamlessConfirm("csyv1.bad.bad", mockDeps({}))).state).toBe("invalid");
    const d = mockDeps({ mintUserId: uid });
    expect((await runSeamlessConfirm(p.token, d)).state).toBe("linked");
    // retry du MÊME token → reverify idempotent, relie (already), reste linked
    const d2 = mockDeps({ currentEmail: p.email, currentId: uid });
    expect((await runSeamlessConfirm(p.token, d2)).state).toBe("linked");
    expect(await accountOf(p.id)).toBe(uid);
  });

  it("compte déjà pris par un autre partenaire → account_taken", async () => {
    const a = await register("taA"); const b = await register("taB"); const shared = randomUUID();
    await runSeamlessConfirm(a.token, mockDeps({ mintUserId: shared })); // A lié à `shared`
    const r = await runSeamlessConfirm(b.token, mockDeps({ mintUserId: shared })); // B tente le même compte
    expect(r.state).toBe("account_taken");
    expect(await accountOf(b.id)).toBeNull();
  });

  it("auth échouée (mint ko) → auth_failed (email vérifié, registre accessible via membre)", async () => {
    const p = await register("authfail");
    const r = await runSeamlessConfirm(p.token, mockDeps({ mintOk: false }));
    expect(r.state).toBe("auth_failed");
    expect((await getRegistrationStatus(p.id))?.status).toBe("verified"); // email vérifié malgré l'échec auth
  });
});
