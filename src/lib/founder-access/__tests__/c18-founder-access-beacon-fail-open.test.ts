// C1.8 — défaut trouvé par l'acceptation propriétaire assistée par IA : `presence` et `funnel`
// renvoyaient un 500 brut quand leur dépendance DB était indisponible (getFounderDb() jetait
// AVANT tout bloc try/catch). Ces deux routes sont des beacons fire-and-forget (sendBeacon,
// réponse jamais lue côté client) : une dépendance indisponible ne doit jamais devenir visible.
// Voir C18_FOUNDER_ACCESS_FIX_PLAN.md pour l'analyse de cause racine complète.
import { describe, it, expect, afterEach } from "vitest";
import { __setFounderDbForTests } from "../runtime";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

afterEach(() => { __setFounderDbForTests(null); });

async function presencePost(body: Record<string, unknown> = { current_path: "/" }) {
  const { POST } = await import("@/app/api/founder-access/presence/route");
  return POST(new Request("http://x/api/founder-access/presence", { method: "POST", body: JSON.stringify(body) }));
}
async function funnelPost(body: Record<string, unknown> = { name: "founder_cta_clicked" }) {
  const { POST } = await import("@/app/api/founder-access/funnel/route");
  return POST(new Request("http://x/api/founder-access/funnel", { method: "POST", body: JSON.stringify(body) }));
}

/** Simule une DB techniquement présente mais dont TOUTE requête échoue (panne de requête, pas
 *  d'absence de config) — exerce le chemin différent de "DATABASE_URL absente". */
function throwingDb(): SqlExecutor {
  const db: SqlExecutor = {
    query: async () => { throw new Error("simulated query failure — never logged, never in response"); },
    transaction: async (fn) => fn(db),
  };
  return db;
}

async function withoutDatabaseUrl<T>(fn: () => Promise<T>): Promise<T> {
  const saved = { a: process.env.DATABASE_URL, b: process.env.SUPABASE_DB_URL };
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_URL;
  try {
    return await fn();
  } finally {
    if (saved.a !== undefined) process.env.DATABASE_URL = saved.a;
    if (saved.b !== undefined) process.env.SUPABASE_DB_URL = saved.b;
  }
}

describe("C1.8 — presence/funnel : une dépendance indisponible ne casse jamais l'expérience", () => {
  it("3. getFounderDb échoue (DATABASE_URL absente, rien d'injecté) → presence ne renvoie JAMAIS 500", async () => {
    __setFounderDbForTests(null);
    const res = await withoutDatabaseUrl(() => presencePost());
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("4. getFounderDb échoue (DATABASE_URL absente, rien d'injecté) → funnel ne renvoie JAMAIS 500", async () => {
    __setFounderDbForTests(null);
    const res = await withoutDatabaseUrl(() => funnelPost());
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("5. le rate-limit échoue techniquement (requête DB qui jette) → aucune route ne renvoie 500", async () => {
    __setFounderDbForTests(throwingDb());
    const r1 = await presencePost();
    expect(r1.status).not.toBe(500);
    __setFounderDbForTests(throwingDb());
    const r2 = await funnelPost();
    expect(r2.status).not.toBe(500);
  });

  it("6. l'écriture analytics échoue (DB qui jette après le rate-limit dégradé) → aucune route ne renvoie 500", async () => {
    // distributedRateLimit dégrade déjà vers un compteur en mémoire sur throw ; l'écriture
    // (upsertWebSession/recordFunnelEvent) jette ensuite et doit rester absorbée par le
    // try/catch EXISTANT (non modifié par ce correctif) — régression garde.
    __setFounderDbForTests(throwingDb());
    const r1 = await presencePost();
    expect(r1.status).not.toBe(500);
    __setFounderDbForTests(throwingDb());
    const r2 = await funnelPost();
    expect(r2.status).not.toBe(500);
  });

  it("7. aucune réponse ne contient de stack trace, secret ou détail de connexion (corps 204 structurellement vide)", async () => {
    __setFounderDbForTests(null);
    const res = await withoutDatabaseUrl(() => presencePost());
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe("");
    expect(text).not.toMatch(/DATABASE_URL|postgres|password|secret|at Object|at async|\.ts:\d+/i);
  });

  it("8. régression — un événement de vérité serveur reste refusé (422), jamais transformé en faux succès", async () => {
    for (const name of ["founder_payment_completed", "founder_email_verified", "founder_reservation_created"]) {
      const res = await funnelPost({ name });
      expect(res.status).toBe(422);
    }
  });

  it("8b. régression — un événement inconnu reste ignoré (204) sans jamais toucher la DB", async () => {
    __setFounderDbForTests(null); // si la route touchait la DB ici, DATABASE_URL absente ferait échouer différemment
    const res = await withoutDatabaseUrl(() => funnelPost({ name: "totally_unknown_event" }));
    expect(res.status).toBe(204);
  });

  it("9. aucun appel externe en mode fail-closed : l'échec est SYNCHRONE (pas de tentative réseau/timeout)", async () => {
    __setFounderDbForTests(null);
    const start = Date.now();
    await withoutDatabaseUrl(() => presencePost());
    // `if (!url) throw` est synchrone : aucune tentative de connexion TCP ne peut avoir lieu.
    // Marge large pour absorber une machine chargée, bornée assez bas pour exclure un timeout réseau.
    expect(Date.now() - start).toBeLessThan(3000);
  });
});
