// CloneStory — accès au Postgres runtime + liaison des GUC d'isolation RLS.
// SERVER-ONLY. Réutilise getRuntimeDb (DATABASE_URL / PGlite) et l'abstraction
// SqlExecutor de Pierre v1. Injection réservée aux tests.
//
// Deux modes d'accès (cf. migration) :
//   • SERVICE  → code serveur de confiance (inscription, vérification, attribution,
//                admin). Voit/écrit tout, après validation applicative.
//   • PARTNER  → lecture « Mon Registre » : la transaction ne voit QUE les lignes du
//                partenaire lié (isolation prouvée par RLS, pas seulement par le code).

import { getRuntimeDb } from "@/lib/pierre/v1/db";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { devAffordancesAllowed } from "./config";

let injected: SqlExecutor | null = null;

/** TEST ONLY — injecte (ou retire avec null) l'executor utilisé par CloneStory. */
export function __setClonestoryDbForTests(db: SqlExecutor | null): void {
  injected = db;
}

export async function getClonestoryDb(): Promise<SqlExecutor> {
  if (injected) return injected;
  // Dev/E2E local uniquement — JAMAIS en production (devAffordancesAllowed est
  // faux si NODE_ENV=production, même si CLONESTORY_LOCAL_PGLITE est posé).
  if (devAffordancesAllowed()) {
    const { getDevPgliteExecutor } = await import("./dev-db");
    return getDevPgliteExecutor(process.env.CLONESTORY_LOCAL_PGLITE!);
  }
  return getRuntimeDb();
}

// On bascule sur le rôle applicatif restreint (NON-superuser) le temps de la
// transaction : un superuser/propriétaire contourne RLS même sous FORCE. `set local
// role` force donc l'application réelle des politiques, en test ET en production
// (le rôle de connexion runtime doit pouvoir assumer pierre_rt_app — superuser ou
// membre, cas du déploiement existant). On nettoie aussi le GUC du mode opposé.
async function bindService(tx: SqlExecutor): Promise<void> {
  await tx.query("set local role pierre_rt_app");
  await tx.query("select set_config('app.clonestory_partner', '', true)");
  await tx.query("select set_config('app.clonestory_service', 'on', true)");
}

async function bindPartner(tx: SqlExecutor, partnerId: string): Promise<void> {
  await tx.query("set local role pierre_rt_app");
  await tx.query("select set_config('app.clonestory_service', '', true)");
  await tx.query("select set_config('app.clonestory_partner', $1, true)", [partnerId]);
}

/** Exécute `fn` en MODE SERVICE (transaction liée). */
export function withService<T>(db: SqlExecutor, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await bindService(tx);
    return fn(tx);
  });
}

/** Exécute `fn` en MODE MEMBRE (la transaction ne voit que les lignes du partenaire). */
export function withPartner<T>(db: SqlExecutor, partnerId: string, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await bindPartner(tx, partnerId);
    return fn(tx);
  });
}
