// Programme « Cabinets Fondateurs » — accès Postgres runtime + liaison des GUC d'isolation RLS.
// SERVER-ONLY. Réutilise getRuntimeDb (DATABASE_URL / PGlite) et l'abstraction SqlExecutor
// de Pierre v1 — aucun runtime parallèle. Injection réservée aux tests.
//
// Deux modes d'accès (cf. migrations clonestore_pp) :
//   • SERVICE  → code serveur de confiance (candidature, revue admin, attribution, webhook,
//                commissions, versements). Voit/écrit tout après validation applicative.
//   • PARTNER  → espace cabinet : la transaction ne voit QUE les lignes du cabinet lié
//                (isolation prouvée par RLS, pas seulement par le code).

import { getRuntimeDb } from "@/lib/pierre/v1/db";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

let injected: SqlExecutor | null = null;

/** TEST ONLY — injecte (ou retire avec null) l'executor utilisé par le programme partenaires. */
export function __setPartnerDbForTests(db: SqlExecutor | null): void {
  injected = db;
}

export async function getPartnerDb(): Promise<SqlExecutor> {
  if (injected) return injected;
  return getRuntimeDb();
}

// On bascule sur le rôle applicatif restreint (NON-superuser) le temps de la transaction :
// un superuser/propriétaire contourne la RLS même sous FORCE. `set local role` force donc
// l'application réelle des politiques, en test ET en production.
async function bindService(tx: SqlExecutor): Promise<void> {
  await tx.query("set local role pierre_rt_app");
  await tx.query("select set_config('app.pp_partner', '', true)");
  await tx.query("select set_config('app.pp_service', 'on', true)");
}

async function bindPartner(tx: SqlExecutor, partnerId: string): Promise<void> {
  await tx.query("set local role pierre_rt_app");
  await tx.query("select set_config('app.pp_service', '', true)");
  await tx.query("select set_config('app.pp_partner', $1, true)", [partnerId]);
}

/** Exécute `fn` en MODE SERVICE (transaction liée). */
export function withService<T>(db: SqlExecutor, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await bindService(tx);
    return fn(tx);
  });
}

/** Exécute `fn` en MODE CABINET (la transaction ne voit que les lignes du partenaire). */
export function withPartner<T>(db: SqlExecutor, partnerId: string, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await bindPartner(tx, partnerId);
    return fn(tx);
  });
}
