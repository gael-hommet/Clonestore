// Accès DB de l'ingestion analytics canonique, avec injection réservée aux tests — même pattern
// que founder-access/runtime.ts.

import { getRuntimeDb } from "@/lib/pierre/v1/db";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

let injected: SqlExecutor | null = null;

/** TEST ONLY — injecte (ou retire avec null) l'executor utilisé par les routes analytics. */
export function __setAnalyticsDbForTests(db: SqlExecutor | null): void {
  injected = db;
}

export async function getAnalyticsDb(): Promise<SqlExecutor> {
  if (injected) return injected;
  return getRuntimeDb();
}

/**
 * Variante fire-and-forget pour l'ingestion analytics : une dépendance indisponible ne doit
 * jamais transformer une navigation utilisateur en erreur visible. Retourne `null` (jamais un
 * throw), journalise un nom d'erreur seul (jamais de message/stack/chaîne de connexion).
 */
export async function getAnalyticsDbForIngestion(): Promise<SqlExecutor | null> {
  try {
    return await getAnalyticsDb();
  } catch (err) {
    console.warn("[analytics] ingestion: dépendance indisponible, événement non persisté —", err instanceof Error ? err.name : "unknown");
    return null;
  }
}
