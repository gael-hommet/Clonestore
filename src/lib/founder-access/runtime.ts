// E-R3 §4 — accès DB des routes publiques Founder Access, avec injection RÉSERVÉE
// AUX TESTS. Le runtime public utilise toujours getRuntimeDb(). Un test peut injecter
// un SqlExecutor PGlite réel via __setFounderDbForTests pour exercer les vraies routes.

import { getRuntimeDb } from "@/lib/pierre/v1/db";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

let injected: SqlExecutor | null = null;

/** TEST ONLY — injecte (ou retire avec null) l'executor utilisé par les routes founder. */
export function __setFounderDbForTests(db: SqlExecutor | null): void {
  injected = db;
}

export async function getFounderDb(): Promise<SqlExecutor> {
  if (injected) return injected;
  return getRuntimeDb();
}
