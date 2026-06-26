// CloneStory — PATCH D'ATOMICITÉ : préflight production + outbox atomique (PGlite réel).

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService } from "../server/runtime";
import {
  registerPartner,
  markVerificationFailed,
  processVerificationOutbox,
} from "../server/store";
import { POST } from "@/app/api/founding-partners/register/route";

// Mode dev local AVANT le snapshot d'env (sinon afterEach le retire et registerPartner,
// qui construit désormais le token stateless via sessionSecret(), échouerait).
process.env.CLONESTORY_LOCAL_MODE = "1";

const ENV_KEYS = [
  "NODE_ENV", "CLONESTORY_LOCAL_MODE", "CLONESTORY_REGISTRATION_OPEN",
  "CLONESTORY_SESSION_SECRET", "CLONESTORY_COMPANY_SALT", "RESEND_API_KEY",
  "CLONESTORE_FOUNDER_EMAIL_FROM", "DATABASE_URL",
];
const ENV = process.env as Record<string, string | undefined>; // mutable (NODE_ENV typé readonly)
let envSnap: Record<string, string | undefined> = {};
function snapEnv() { const s: Record<string, string | undefined> = {}; for (const k of ENV_KEYS) s[k] = ENV[k]; return s; }
function restoreEnv(s: Record<string, string | undefined>) { for (const k of ENV_KEYS) { if (s[k] === undefined) delete ENV[k]; else ENV[k] = s[k]; } }

let h: ClonestoryHarness;
beforeAll(async () => {
  h = await createClonestoryHarness();
  __setClonestoryDbForTests(h.db);
  envSnap = snapEnv();
});
afterAll(async () => { __setClonestoryDbForTests(null); await h.close(); });
afterEach(() => { restoreEnv(envSnap); __setClonestoryDbForTests(h.db); });

function reqFor(email: string) {
  return new Request("http://localhost/api/founding-partners/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
    body: JSON.stringify({ firstName: "Pré", lastName: "Flight", email, acceptTerms: true, website: "" }),
  });
}
async function partnerCount(emailNorm: string) {
  const { rows } = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_partners where email_normalized = $1`, [emailNorm]));
  return Number(rows[0].n) || 0;
}
async function outboxRows(partnerId: string) {
  return (await withService(h.db, (tx) => tx.query<Record<string, unknown>>(`select * from clonestory_fp_email_outbox where partner_id = $1`, [partnerId]))).rows;
}

function setProd(missing: "session" | "company" | "email") {
  ENV.NODE_ENV = "production";
  ENV.CLONESTORY_REGISTRATION_OPEN = "true";
  ENV.CLONESTORY_SESSION_SECRET = "s".repeat(40);
  ENV.CLONESTORY_COMPANY_SALT = "c".repeat(40);
  ENV.DATABASE_URL = "postgres://example";
  ENV.RESEND_API_KEY = "re_example";
  ENV.CLONESTORE_FOUNDER_EMAIL_FROM = "Cercle <fondateur@clonestore.pro>";
  if (missing === "session") delete ENV.CLONESTORY_SESSION_SECRET;
  if (missing === "company") delete ENV.CLONESTORY_COMPANY_SALT;
  if (missing === "email") delete ENV.RESEND_API_KEY;
}

describe("préflight production — route register (zéro écriture si incomplet)", () => {
  for (const miss of ["session", "company", "email"] as const) {
    it(`flag true + ${miss} absent (prod) → 503, AUCUN compte`, async () => {
      const email = `prod-${miss}@x.fr`;
      setProd(miss);
      const res = await POST(reqFor(email));
      expect(res.status).toBe(503);
      expect((await res.json()).error).toBe("unavailable");
      expect(await partnerCount(email)).toBe(0); // aucune écriture
    });
  }
});

describe("création atomique + outbox", () => {
  // Mode dev local explicite pour les tests au niveau store (secrets de dev).
  beforeAll(() => { process.env.CLONESTORY_LOCAL_MODE = "1"; });

  it("partenaire + token + outbox = UNE transaction : si l'outbox échoue → rollback, zéro partenaire", async () => {
    // On retire la table outbox (en tant que propriétaire) → l'insert outbox de
    // registerPartner échoue → toute la transaction (y compris le partenaire) annulée.
    await h.db.query(`alter table clonestory_fp_email_outbox rename to clonestory_fp_email_outbox_bak`);
    let threw = false;
    try {
      await registerPartner({ firstName: "Roll", lastName: "Back", email: "rollback@x.fr" });
    } catch {
      threw = true;
    } finally {
      await h.db.query(`alter table clonestory_fp_email_outbox_bak rename to clonestory_fp_email_outbox`);
    }
    expect(threw).toBe(true);
    expect(await partnerCount("rollback@x.fr")).toBe(0); // aucun compte orphelin
  });

  it("commit OK puis envoi échoué → partenaire CONSERVÉ + outbox failed_retryable", async () => {
    const r = await registerPartner({ firstName: "Garde", lastName: "Fou", email: "kept@x.fr" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    expect(r.outboxId).toBeTruthy();
    // Simule un échec d'envoi.
    await markVerificationFailed(r.outboxId!, "resend down");
    const rows = await outboxRows(r.partnerId);
    expect(rows[0].status).toBe("failed_retryable"); // reprise possible
    expect(await partnerCount("kept@x.fr")).toBe(1); // partenaire conservé (jamais supprimé)
  });

  it("réinscription idempotente : 1 partenaire, 1 SEULE génération active (anciennes superseded)", async () => {
    const a = await registerPartner({ firstName: "Idem", lastName: "Potent", email: "idem@x.fr" });
    const b = await registerPartner({ firstName: "Idem", lastName: "Potent", email: "IDEM@x.fr" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error();
    expect(b.partnerId).toBe(a.partnerId); // même partenaire — jamais de doublon
    expect(await partnerCount("idem@x.fr")).toBe(1);
    expect(b.generation).toBe(a.generation + 1); // vrai renvoi → nouvelle génération
    const rows = await outboxRows(a.partnerId);
    const active = rows.filter((r) => r.status !== "superseded" && r.status !== "dead");
    expect(active.length).toBe(1); // une seule commande logique ACTIVE
    expect(rows.filter((r) => r.status === "superseded").length).toBe(1); // l'ancienne génération révoquée
  });

  it("reprise : processVerificationOutbox envoie une fois, pas de double email logique", async () => {
    const r = await registerPartner({ firstName: "Re", lastName: "Prise", email: "resume@x.fr" });
    if (!r.ok) throw new Error();
    // remet l'outbox en pending (comme si l'envoi initial avait échoué)
    await markVerificationFailed(r.outboxId!, "init failed");
    await withService(h.db, (tx) => tx.query(`update clonestory_fp_email_outbox set status='pending', next_attempt_at=now() where id=$1`, [r.outboxId]));
    const first = await processVerificationOutbox(50);
    expect(first.sent).toBeGreaterThanOrEqual(1);
    const rows = await outboxRows(r.partnerId);
    expect(rows[0].status).toBe("sent");
    // un second passage ne renvoie pas (déjà sent) → aucun double email logique
    const second = await processVerificationOutbox(50);
    const stillSent = (await outboxRows(r.partnerId))[0].status;
    expect(stillSent).toBe("sent");
    expect(second.processed).toBe(0);
  });

  it("aucun token brut dans l'outbox", async () => {
    const r = await registerPartner({ firstName: "No", lastName: "Leak", email: "noleak@x.fr" });
    if (!r.ok) throw new Error();
    expect(r.verificationToken).toMatch(/^csyv1\./); // token stateless renvoyé en mémoire
    const rows = await outboxRows(r.partnerId);
    const serialized = JSON.stringify(rows[0]);
    expect(serialized).not.toContain(r.verificationToken!); // jamais persisté dans l'outbox
    expect(serialized).not.toContain("csyv1."); // aucun token brut stocké
  });
});
