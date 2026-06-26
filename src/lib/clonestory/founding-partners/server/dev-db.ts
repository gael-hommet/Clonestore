// CloneStory — base PGlite EN PROCESS, RÉSERVÉE AU DÉVELOPPEMENT / E2E LOCAL.
// Activée UNIQUEMENT si la variable CLONESTORY_LOCAL_PGLITE est définie (chemin du
// dossier de données). En production, cette variable n'est jamais posée : ce module
// n'est même pas importé (import dynamique dans runtime.ts), donc PGlite (devDep)
// n'est jamais chargé en production. Aucun impact sur Pierre ni sur getRuntimeDb.

import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import type { SqlExecutor, SqlRow } from "@/lib/pierre/v1/sql";

// Ancré sur globalThis : en dev, Next charge ce module dans plusieurs bundles
// (page / api / middleware). Sans cet ancrage, chaque instance ouvrirait SA propre
// connexion PGlite sur le même dossier → connexions concurrentes → résultats
// tronqués (JSON.parse vide → 500 intermittents). On garantit UNE seule connexion
// et UNE seule file de sérialisation par processus dev. (Aucun effet en prod.)
const GKEY = Symbol.for("clonestory.devPglite");
type GStore = { instances?: Map<string, Promise<SqlExecutor>> };
const gstore = globalThis as unknown as Record<symbol, GStore>;

export function getDevPgliteExecutor(dataDir: string): Promise<SqlExecutor> {
  const store = (gstore[GKEY] ??= {});
  const instances = (store.instances ??= new Map());
  let exec = instances.get(dataDir);
  if (!exec) { exec = init(dataDir); instances.set(dataDir, exec); }
  return exec;
}

async function init(dataDir: string): Promise<SqlExecutor> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create(dataDir);

  const existing = await pg.query<{ t: string | null }>("select to_regclass('public.clonestory_fp_partners') as t");
  if (!existing.rows[0]?.t) {
    const MIG = resolve(process.cwd(), "supabase/migrations");
    const files = readdirSync(MIG)
      .filter((f) => f.endsWith(".sql") && (f.includes("pierre_v") || f.includes("clonestory_fp")))
      .sort();
    for (const f of files) await pg.exec(readFileSync(resolve(MIG, f), "utf-8"));
  }

  // PGlite est une connexion EN PROCESS unique : deux transactions concurrentes
  // s'entrelaceraient sur la même connexion (résultats tronqués → erreurs
  // intermittentes). On sérialise donc TOUT accès de premier niveau via une file
  // (les requêtes internes d'une transaction passent par `tx`, hors file). Sans
  // effet en production (qui utilise getRuntimeDb / node-postgres et son pool).
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <R>(op: () => Promise<R>): Promise<R> => {
    const run = queue.then(op, op);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };

  const exec: SqlExecutor = {
    query<T = SqlRow>(text: string, params?: readonly unknown[]) {
      return serialize(async () => {
        const r = await pg.query(text, params ? [...params] : undefined);
        return { rows: r.rows as T[] };
      });
    },
    transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return serialize(() =>
        pg.transaction(async (tx) => {
          const txExec: SqlExecutor = {
            async query<T2 = SqlRow>(text: string, params?: readonly unknown[]) {
              const r = await tx.query(text, params ? [...params] : undefined);
              return { rows: r.rows as T2[] };
            },
            transaction(inner) {
              return inner(txExec);
            },
          };
          return fn(txExec);
        }) as Promise<T>,
      );
    },
  };
  return exec;
}
