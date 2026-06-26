// E-R2 §8/§9 — la clé d'idempotence est RÉELLEMENT transmise au provider, stable
// entre retries → un seul envoi logique même provider déduplique. Persistance des
// champs fournisseur. + token déterministe non exploitable au repos.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { createOrUpdateReservation } from "../store";
import { runEmailTick } from "../email-worker";
import type { FounderEmailProvider, FounderEmailMessage } from "../email-provider";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function mk(email: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt };
}

/**
 * Provider fake réaliste : reçoit la clé d'idempotence. Le PREMIER appel avec une clé
 * « timeoute » (échec côté worker) mais l'envoi logique est déjà accepté/dédupliqué.
 * Les appels suivants avec la MÊME clé ne créent pas de nouvel envoi logique.
 */
function dedupingProvider() {
  const keysSeen: string[] = [];
  const logicalSends = new Set<string>();
  let failFirst = true;
  const provider: FounderEmailProvider = {
    mode: "local",
    async send(msg: FounderEmailMessage) {
      const key = msg.idempotencyKey ?? "(none)";
      keysSeen.push(key);
      logicalSends.add(key); // un seul envoi logique par clé (dédup provider)
      if (failFirst) { failFirst = false; return { ok: false, error: "timeout", mode: "local", idempotencyKey: key }; }
      return { ok: true, id: "msg_" + key, mode: "local", idempotencyKey: key };
    },
  };
  return { provider, keysSeen, logicalSends };
}

describe("§8 — idempotency key transmise et stable", () => {
  it("retry réutilise la MÊME clé → un seul envoi logique", async () => {
    const r = await createOrUpdateReservation(h.db, mk("idem@acme.fr"));
    const fake = dedupingProvider();

    // 1er tick : provider échoue (timeout simulé) → retry programmé.
    await runEmailTick(h.db, fake.provider, { baseUrl: "https://x.test" });
    // forcer l'échéance et re-tenter (2e tentative, même envoi logique).
    await h.db.query("update clonestore_founder_email_jobs set status='pending', send_at=now() where reservation_id=$1", [r.id]);
    await runEmailTick(h.db, fake.provider, { baseUrl: "https://x.test" });

    expect(fake.keysSeen.length).toBe(2);          // deux tentatives réseau
    expect(new Set(fake.keysSeen).size).toBe(1);   // …avec la MÊME clé
    expect(fake.logicalSends.size).toBe(1);        // …donc un seul envoi logique
    expect(fake.keysSeen[0]).toMatch(/^founder-email:.*:verification:1$/);

    // Champs fournisseur persistés.
    const { rows } = await h.db.query<{ provider_idempotency_key: string | null; provider_message_id: string | null; last_provider_response_at: string | null; status: string }>(
      "select provider_idempotency_key, provider_message_id, last_provider_response_at, status from clonestore_founder_email_jobs where reservation_id=$1 and kind='verification'", [r.id]);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].provider_idempotency_key).toBe(fake.keysSeen[0]);
    expect(rows[0].last_provider_response_at).not.toBeNull();
  });
});
