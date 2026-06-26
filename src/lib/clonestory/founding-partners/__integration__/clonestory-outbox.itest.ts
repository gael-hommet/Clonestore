// CloneStory — FIABILITÉ DE LIVRAISON (PGlite réel) : token stateless reconstruit,
// retry technique = même token, renvoi volontaire = nouvelle génération, claim
// concurrent, récupération des `sending` abandonnés, dead, et cron sécurisé.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService } from "../server/runtime";
import {
  registerPartner,
  verifyEmailToken,
  markVerificationFailed,
  processVerificationOutbox,
} from "../server/store";
import { buildVerificationToken } from "../server/verification-token";
import { GET as cronGet } from "@/app/api/cron/clonestory-outbox/route";

process.env.CLONESTORY_LOCAL_MODE = "1";

let h: ClonestoryHarness;
const savedCron = process.env.CLONESTORY_OUTBOX_CRON_SECRET;
const savedCron2 = process.env.CRON_SECRET;

beforeAll(async () => {
  h = await createClonestoryHarness();
  __setClonestoryDbForTests(h.db);
});
afterAll(async () => { __setClonestoryDbForTests(null); await h.close(); });
afterEach(() => {
  if (savedCron === undefined) delete process.env.CLONESTORY_OUTBOX_CRON_SECRET; else process.env.CLONESTORY_OUTBOX_CRON_SECRET = savedCron;
  if (savedCron2 === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedCron2;
});

async function topRow(partnerId: string) {
  const { rows } = await withService(h.db, (tx) =>
    tx.query<{ id: string; generation: number; token_exp_ms: string; status: string; attempts: number; idempotency_key: string }>(
      `select id::text, generation, token_exp_ms, status, attempts, idempotency_key from clonestory_fp_email_outbox where partner_id = $1 order by generation desc limit 1`,
      [partnerId],
    ),
  );
  return rows[0];
}

describe("outbox — livraison fiable", () => {
  it("token reconstructible : le token renvoyé == reconstruit depuis la ligne ; verify OK", async () => {
    const r = await registerPartner({ firstName: "Re", lastName: "Construct", email: "recon@x.fr" });
    if (!r.ok) throw new Error();
    const row = await topRow(r.partnerId);
    const rebuilt = buildVerificationToken(r.partnerId, Number(row.generation), Number(row.token_exp_ms));
    expect(rebuilt).toBe(r.verificationToken); // même token, sans stockage du brut
    expect((await verifyEmailToken(r.verificationToken!)).ok).toBe(true);
  });

  it("retry technique : worker renvoie le MÊME token ; le premier email reste valide", async () => {
    const r = await registerPartner({ firstName: "Tech", lastName: "Retry", email: "techretry@x.fr" });
    if (!r.ok) throw new Error();
    const token1 = r.verificationToken!;
    const keyBefore = (await topRow(r.partnerId)).idempotency_key;
    // L'envoi initial a « échoué » → on remet la ligne en file.
    await markVerificationFailed(r.outboxId!, "initial failure");
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_email_outbox set status='pending', next_attempt_at=now() where id=$1`, [r.outboxId]));
    const res = await processVerificationOutbox(50);
    expect(res.sent).toBe(1);
    const after = await topRow(r.partnerId);
    expect(after.status).toBe("sent");
    expect(after.idempotency_key).toBe(keyBefore); // MÊME clé d'idempotence (pas de nouvelle commande)
    // Le token du PREMIER email reste valide (même génération, pas de régénération).
    expect((await verifyEmailToken(token1)).ok).toBe(true);
  });

  it("renvoi volontaire : nouvelle génération ; ancien token INVALIDE, nouveau valide", async () => {
    const a = await registerPartner({ firstName: "Vol", lastName: "Renvoi", email: "volrenvoi@x.fr" });
    if (!a.ok) throw new Error();
    const oldToken = a.verificationToken!;
    const b = await registerPartner({ firstName: "Vol", lastName: "Renvoi", email: "volrenvoi@x.fr" });
    if (!b.ok) throw new Error();
    expect(b.generation).toBe(a.generation + 1);
    expect(b.verificationToken).not.toBe(oldToken);
    expect((await verifyEmailToken(oldToken)).ok).toBe(false); // ancienne génération révoquée
    expect((await verifyEmailToken(b.verificationToken!)).ok).toBe(true); // nouvelle valide
    // La nouvelle génération est réellement expédiable.
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_email_outbox set status='pending', next_attempt_at=now() where partner_id=$1 and generation=$2`, [b.partnerId, b.generation]));
    const res = await processVerificationOutbox(50);
    expect(res.sent).toBeGreaterThanOrEqual(1);
  });

  it("claim concurrent : deux workers → une seule prise en charge (SKIP LOCKED)", async () => {
    const r = await registerPartner({ firstName: "Con", lastName: "Current", email: "concurrent@x.fr" });
    if (!r.ok) throw new Error();
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_email_outbox set status='pending', next_attempt_at=now() where id=$1`, [r.outboxId]));
    const [w1, w2] = await Promise.all([processVerificationOutbox(50), processVerificationOutbox(50)]);
    expect(w1.processed + w2.processed).toBe(1); // une seule ligne réclamée au total
    expect(w1.sent + w2.sent).toBe(1); // un seul envoi
  });

  it("récupération d'un `sending` abandonné (bail expiré) sans invalider le lien", async () => {
    const r = await registerPartner({ firstName: "Stale", lastName: "Lock", email: "stale@x.fr" });
    if (!r.ok) throw new Error();
    const token = r.verificationToken!;
    // Simule un worker mort en plein envoi : status sending + locked_at ancien.
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_email_outbox set status='sending', locked_at = now() - interval '30 minutes', attempts=1 where id=$1`, [r.outboxId]));
    const res = await processVerificationOutbox(50);
    expect(res.sent).toBe(1); // réclamé puis envoyé
    expect((await topRow(r.partnerId)).status).toBe("sent");
    expect((await verifyEmailToken(token)).ok).toBe(true); // lien jamais invalidé
  });

  it("plafond de tentatives → dead", async () => {
    const r = await registerPartner({ firstName: "Dead", lastName: "End", email: "deadend@x.fr" });
    if (!r.ok) throw new Error();
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_email_outbox set attempts = max_attempts where id=$1`, [r.outboxId]));
    const dead = await markVerificationFailed(r.outboxId!, "permanent");
    expect(dead).toBe(true);
    expect((await topRow(r.partnerId)).status).toBe("dead");
  });

  it("cron : sans secret → 503 ; secret erroné → 401 ; secret correct → 200", async () => {
    delete process.env.CLONESTORY_OUTBOX_CRON_SECRET;
    delete process.env.CRON_SECRET;
    const noSecret = await cronGet(new Request("http://localhost/api/cron/clonestory-outbox"));
    expect(noSecret.status).toBe(503); // fail-closed

    process.env.CLONESTORY_OUTBOX_CRON_SECRET = "super-secret-cron-value-123456";
    const wrong = await cronGet(new Request("http://localhost/api/cron/clonestory-outbox", { headers: { authorization: "Bearer nope" } }));
    expect(wrong.status).toBe(401); // appel public/erroné refusé

    const ok = await cronGet(new Request("http://localhost/api/cron/clonestory-outbox", { headers: { authorization: "Bearer super-secret-cron-value-123456" } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).ok).toBe(true);
  });

  it("aucun secret ni token brut dans les lignes outbox", async () => {
    const r = await registerPartner({ firstName: "Clean", lastName: "Rows", email: "cleanrows@x.fr" });
    if (!r.ok) throw new Error();
    const { rows } = await withService(h.db, (tx) => tx.query(`select * from clonestory_fp_email_outbox where partner_id=$1`, [r.partnerId]));
    const blob = JSON.stringify(rows);
    expect(blob).not.toContain("csyv1."); // pas de token de vérification
    expect(blob).not.toContain("super-secret"); // pas de secret
  });
});
