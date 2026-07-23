// C1.9 — ATTENTE BORNÉE SUR LA BASE DURABLE.
//
// Défaut trouvé pendant le diagnostic du blocage de compilation : `pg` attend
// INDÉFINIMENT par défaut (`connectionTimeoutMillis` vaut 0). Une base injoignable — TLS
// intercepté, réseau coupé, base volontairement débranchée pendant une compilation — ne
// produisait alors ni erreur ni repli : le processus restait suspendu, sans mémoire ni CPU,
// indistinguable d'un travail en cours.
//
// Ces tests prouvent les trois propriétés qui comptent :
//   1. aucune URL configurée ⇒ AUCUNE tentative de connexion, repli honnête ;
//   2. base injoignable ⇒ échec BORNÉ, jamais une attente infinie ;
//   3. base valide ⇒ comportement transactionnel INCHANGÉ (rôle, GUC, commit).
import { describe, it, expect, vi, beforeEach } from "vitest";

/** Configuration réellement passée au driver — c'est elle qui borne l'attente. */
let lastPoolConfig: Record<string, unknown> | null = null;
/** Comportement de `connect()` piloté par chaque test. */
let connectBehaviour: "ok" | "reject" = "ok";
const queries: string[] = [];

vi.mock("pg", () => {
  class FakePool {
    constructor(config: Record<string, unknown>) { lastPoolConfig = config; }
    on() { /* écouteur idle — sans effet ici */ }
    async connect() {
      if (connectBehaviour === "reject") {
        // Ce que fait `pg` UNE FOIS BORNÉ : il abandonne au lieu d'attendre sans fin.
        throw Object.assign(new Error("timeout exceeded when trying to connect"), { code: "ETIMEDOUT" });
      }
      return {
        query: async (text: string) => { queries.push(text); return { rows: [], rowCount: 0 }; },
        release: () => {},
      };
    }
    async end() {}
  }
  return { default: { Pool: FakePool } };
});

import { createPgClonechatDb, resolveClonechatDbUrl } from "../pg";

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  lastPoolConfig = null;
  connectBehaviour = "ok";
  queries.length = 0;
});

describe("C1.9 — la base durable ne peut plus attendre sans fin", () => {
  it("ne tente AUCUNE connexion quand aucune URL n'est configurée", () => {
    delete process.env.CLONECHAT_DB_URL;
    delete process.env.DATABASE_URL;
    expect(resolveClonechatDbUrl()).toBeNull();

    // Une URL vide ou trop courte est traitée comme une absence : c'est le chemin
    // emprunté par une compilation lancée base débranchée. Rien ne se connecte, donc
    // rien ne peut se suspendre.
    process.env.DATABASE_URL = "";
    expect(resolveClonechatDbUrl()).toBeNull();
    process.env.DATABASE_URL = "disabled";
    expect(resolveClonechatDbUrl()).toBeNull();
    expect(lastPoolConfig).toBeNull();
  });

  it("borne explicitement l'attente du driver — connexion ET requête", async () => {
    await createPgClonechatDb("postgres://u:p@127.0.0.1:5432/db");
    expect(lastPoolConfig).not.toBeNull();

    const cfg = lastPoolConfig!;
    for (const key of ["connectionTimeoutMillis", "statement_timeout", "query_timeout"]) {
      const v = cfg[key];
      expect(typeof v, `${key} doit être borné`).toBe("number");
      expect(Number.isFinite(v as number), `${key} doit être fini`).toBe(true);
      expect(v as number, `${key} doit être strictement positif`).toBeGreaterThan(0);
      // Une borne trop haute ne borne rien : une compilation ne peut pas attendre une minute.
      expect(v as number, `${key} doit rester court`).toBeLessThanOrEqual(30_000);
    }
    // `0` est la valeur par défaut de pg et signifie « jamais » : elle doit être exclue.
    expect(cfg.connectionTimeoutMillis).not.toBe(0);
  });

  it("échoue FRANCHEMENT quand la base est injoignable, au lieu de se suspendre", async () => {
    connectBehaviour = "reject";
    const db = await createPgClonechatDb("postgres://u:p@10.255.255.1:5432/db");

    const started = Date.now();
    await expect(db.withTenant({ companyId: "c1" }, async () => "jamais atteint")).rejects.toThrow(/timeout/i);
    await expect(db.withInternal(async () => "jamais atteint")).rejects.toThrow(/timeout/i);
    // Le test lui-même ne doit pas dépendre de la vitesse de la machine : ce qu'on prouve,
    // c'est que l'appel REND LA MAIN — pas qu'il la rend en N millisecondes.
    expect(Date.now() - started).toBeLessThan(20_000);
    expect(queries, "aucune requête ne doit partir sans connexion").toEqual([]);
  });

  it("laisse le chemin nominal STRICTEMENT inchangé quand la base répond", async () => {
    const db = await createPgClonechatDb("postgres://u:p@127.0.0.1:5432/db");
    const out = await db.withTenant({ companyId: "acme", userId: "u-7" }, async (q) => {
      await q.query("select 1");
      return "ok";
    });
    expect(out).toBe("ok");
    expect(queries[0]).toBe("begin");
    expect(queries[1]).toBe("set local role clonechat_app");
    expect(queries.some((t) => t.includes("app.current_company"))).toBe(true);
    expect(queries.some((t) => t.includes("app.current_user_id"))).toBe(true);
    expect(queries.some((t) => t.includes("app.clonechat_internal"))).toBe(true);
    expect(queries).toContain("select 1");
    expect(queries[queries.length - 1]).toBe("commit");
    expect(queries).not.toContain("rollback");
  });

  it("annule la transaction quand la fonction échoue, sans masquer l'erreur", async () => {
    const db = await createPgClonechatDb("postgres://u:p@127.0.0.1:5432/db");
    await expect(db.withInternal(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(queries).toContain("rollback");
    expect(queries).not.toContain("commit");
  });
});
