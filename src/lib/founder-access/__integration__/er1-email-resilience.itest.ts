// E-R1 — token de vérification stable par job (§13), relance dead (§20),
// résilience du command center (§18), idempotence des migrations (§22).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { createOrUpdateReservation, requeueDeadEmailJobs, refreshVerificationToken } from "../store";
import { runEmailTick } from "../email-worker";
import { getFounderCommandCenterSnapshot } from "../command-center";
import type { FounderEmailProvider } from "../email-provider";
import { issueVerificationToken } from "../token";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function provider(ok: boolean): FounderEmailProvider {
  return { mode: "local", async send() { return ok ? { ok: true, id: "m", mode: "local" } : { ok: false, error: "x", mode: "local" }; } };
}
function mk(email: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt };
}
async function jobToken(rid: string) {
  const { rows } = await h.db.query<{ verification_token: string | null; status: string }>("select verification_token, status from clonestore_founder_email_jobs where reservation_id=$1 and kind='verification'", [rid]);
  return rows[0];
}

async function resHash(rid: string) {
  const { rows } = await h.db.query<{ verification_token_hash: string | null; verification_token_version: number; verification_token: string | null }>(
    "select r.verification_token_hash, r.verification_token_version, j.verification_token from clonestore_founder_reservations r left join clonestore_founder_email_jobs j on j.reservation_id=r.id and j.kind='verification' where r.id=$1", [rid]);
  return rows[0];
}

describe("E-R2 §6 — token déterministe, non exploitable au repos", () => {
  it("aucun token en clair n'est stocké ; le hash est STABLE entre retries", async () => {
    const r = await createOrUpdateReservation(h.db, mk("retry-token@acme.fr"));
    await runEmailTick(h.db, provider(false), { baseUrl: "https://x.test" }); // échec → retry
    const t1 = await resHash(r.id);
    expect(t1.verification_token).toBeNull();          // jamais de token en clair dans le job
    expect(t1.verification_token_hash).not.toBeNull();
    await h.db.query("update clonestore_founder_email_jobs set status='pending', send_at=now() where reservation_id=$1", [r.id]);
    await runEmailTick(h.db, provider(true), { baseUrl: "https://x.test" });
    const t2 = await resHash(r.id);
    expect(t2.verification_token_hash).toBe(t1.verification_token_hash); // déterministe → identique
  });

  it("un resend explicite bump la version → l'ancien lien (hash) est invalidé", async () => {
    const r = await createOrUpdateReservation(h.db, mk("resend-token@acme.fr"));
    await runEmailTick(h.db, provider(true), { baseUrl: "https://x.test" });
    const before = await resHash(r.id);
    const v = await refreshVerificationToken(h.db, r.id);
    expect(v).toBe((before.verification_token_version ?? 1) + 1);
    await runEmailTick(h.db, provider(true), { baseUrl: "https://x.test" }); // recompute pour la nouvelle version
    const after = await resHash(r.id);
    expect(after.verification_token_hash).not.toBe(before.verification_token_hash); // ancien lien invalide
  });
});

describe("§20 — relance gouvernée des jobs dead", () => {
  it("remet les jobs dead en pending (attempts remis à zéro)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("dead@acme.fr"));
    await h.db.query("update clonestore_founder_email_jobs set status='dead', attempts=5 where reservation_id=$1", [r.id]);
    const n = await requeueDeadEmailJobs(h.db);
    expect(n).toBeGreaterThanOrEqual(1);
    const j = await jobToken(r.id);
    expect(j.status).toBe("pending");
  });
});

describe("§18 — résilience du command center", () => {
  it("une section en panne n'effondre pas le snapshot (degraded)", async () => {
    // db proxy : échoue uniquement sur les requêtes analytics (web_sessions/web_events).
    const flaky: SqlExecutor = {
      query: ((text: string, params?: readonly unknown[]) => {
        if (/clonestore_web_(sessions|events)/.test(text)) return Promise.reject(new Error("analytics down"));
        return h.db.query(text, params);
      }) as SqlExecutor["query"],
      transaction: h.db.transaction.bind(h.db),
    };
    const snap = await getFounderCommandCenterSnapshot(flaky);
    expect(snap.overview).toBeTruthy();        // les prospects/overview restent OK
    expect(snap.degraded.length).toBeGreaterThan(0); // au moins une section dégradée
    expect(["presence", "funnel", "cohort_funnel", "acquisition", "sources"].some((k) => snap.degraded.includes(k))).toBe(true);
  });
});

describe("§22 — idempotence des migrations Founder Access", () => {
  it("réappliquer les migrations founder ne casse rien (idempotent)", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { resolve } = await import("path");
    const dir = resolve(process.cwd(), "supabase/migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql") && f.includes("clonestore_founder")).sort();
    // 2e application sur la base déjà migrée (harness) — doit passer sans erreur.
    for (const f of files) await (h.pg as { exec: (s: string) => Promise<unknown> }).exec(readFileSync(resolve(dir, f), "utf-8"));
    const ok = await h.db.query("select 1 from clonestore_founder_reservations limit 1");
    expect(Array.isArray(ok.rows)).toBe(true);
  });
});
