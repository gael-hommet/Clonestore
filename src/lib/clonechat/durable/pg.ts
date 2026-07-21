// src/lib/clonechat/durable/pg.ts
// P9.4.1 — Client Postgres DURABLE pour CloneChat (server-only). Chaque opération
// tourne dans une transaction qui assume le rôle applicatif `clonechat_app` et pose
// les GUC de tenant (`app.current_company`, `app.current_user_id`) — la RLS isole donc
// réellement chaque entreprise. Le driver `pg` est importé dynamiquement (hors bundle
// client). Si aucune URL n'est configurée, le client est absent et l'appelant retombe
// sur l'implémentation in-memory (tests / dev sans DB).

export interface TenantCtx {
  readonly companyId: string;
  readonly userId?: string | null;
  /** Accès interne CloneStore (agrégats de bugs, écritures de knowledge globale). */
  readonly internal?: boolean;
}

export interface ClonechatQuery {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

export interface ClonechatDb {
  /** Exécute `fn` dans une transaction tenant-scopée (rôle + GUC posés, RLS active). */
  withTenant<T>(ctx: TenantCtx, fn: (q: ClonechatQuery) => Promise<T>): Promise<T>;
  /** Exécute `fn` en contexte interne (pas d'isolation tenant ; knowledge/bugs globaux). */
  withInternal<T>(fn: (q: ClonechatQuery) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** URL de la base durable CloneChat, ou null (⇒ repli in-memory). */
export function resolveClonechatDbUrl(): string | null {
  const url = process.env.CLONECHAT_DB_URL ?? process.env.DATABASE_URL ?? "";
  if (!(url && url.length > 10)) return null;

  // ── GARDE-FOU C1.8 — jamais de DB DISTANTE en mode TEST E2E ──────────────────
  // Le pont d'identité e2e permet d'AUTHENTIFIER CloneChat en test ; sans ce garde-fou, l'historique
  // authentifié partirait dans la DABASE DISTANTE réelle (DATABASE_URL pointe la PROD via .env.local).
  // On refuse donc catégoriquement toute URL non-locale quand le mode test est actif : défense en
  // profondeur par-dessus la neutralisation d'env, pour qu'un oubli n'écrive JAMAIS en production.
  if (process.env.PIERRE_E2E_TEST_MODE === "1" && process.env.NODE_ENV !== "production") {
    const isLocal = /(^|@)(localhost|127\.0\.0\.1|::1)([:/]|$)/.test(url);
    if (!isLocal) return null; // ⇒ repli in-memory : l'historique de test reste hors production
  }

  return url;
}

type PgPool = {
  connect(): Promise<PgClient>;
  end(): Promise<void>;
  on(event: "error", cb: (err: unknown) => void): void;
};
type PgClient = {
  query(text: string, params?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release(): void;
};

/** Construit un client Postgres durable. `assumeRole` par défaut = clonechat_app. */
export async function createPgClonechatDb(connectionString: string, opts?: { assumeRole?: string | null; ssl?: boolean }): Promise<ClonechatDb> {
  // Import serveur du driver pg (ce module n'est jamais bundlé côté client : il n'est
  // importé que par la couche serveur). Specifier statique → résolu par le runtime nodejs.
  const { default: pg } = (await import("pg")) as unknown as { default: { Pool: new (c: unknown) => PgPool } };
  const pool = new pg.Pool({ connectionString, max: 8, ...(opts?.ssl ? { ssl: { rejectUnauthorized: false } } : {}) });
  // OBLIGATOIRE (pg) : un client INACTIF du pool peut être coupé (redémarrage Postgres,
  // coupure réseau, arrêt côté serveur). pg relaie alors l'erreur au niveau du pool ; SANS
  // écouteur, Node émet un `uncaughtException` et le process PLANTE. On CONSOMME l'erreur et
  // on la trace (observable, jamais silencieuse) — le pool recrée les connexions à la demande.
  // Ce n'est pas un swallow global : l'écouteur est scopé à CE pool, sur l'évènement idle.
  pool.on("error", (err) => {
    try { console.warn("[clonechat] pg pool idle-client error (recovered):", (err as { message?: string })?.message ?? err); } catch { /* ignore */ }
  });
  const assumeRole = opts?.assumeRole === undefined ? "clonechat_app" : opts.assumeRole;

  async function run<T>(setup: (c: PgClient) => Promise<void>, fn: (q: ClonechatQuery) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("begin");
      if (assumeRole) await client.query(`set local role ${assumeRole}`);
      await setup(client);
      const q: ClonechatQuery = {
        async query(text, params) {
          const r = await client.query(text, params);
          return { rows: r.rows as never[], rowCount: r.rowCount ?? 0 };
        },
      };
      const out = await fn(q);
      await client.query("commit");
      return out;
    } catch (e) {
      try { await client.query("rollback"); } catch { /* ignore */ }
      throw e;
    } finally {
      client.release();
    }
  }

  return {
    withTenant(ctx, fn) {
      return run(async (c) => {
        await c.query("select set_config('app.current_company', $1, true)", [ctx.companyId]);
        await c.query("select set_config('app.current_user_id', $1, true)", [ctx.userId ?? ""]);
        await c.query("select set_config('app.clonechat_internal', $1, true)", [ctx.internal ? "true" : "false"]);
      }, fn);
    },
    withInternal(fn) {
      return run(async (c) => {
        await c.query("select set_config('app.clonechat_internal', 'true', true)");
      }, fn);
    },
    async close() { await pool.end(); },
  };
}
