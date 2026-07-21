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

/**
 * Variante pour les routes beacon fire-and-forget (presence/funnel) UNIQUEMENT.
 * `getFounderDb()` jette délibérément quand la DB n'est pas configurée — un contrat correct
 * pour `reservations` et le webhook Stripe, où un échec DOIT être bruyant (jamais un faux succès
 * sur une écriture métier). Un heartbeat analytics n'est pas une écriture métier : il ne doit
 * jamais faire échouer la navigation de l'utilisateur pour autant. Retourne `null` (jamais un
 * throw) et journalise en interne un nom d'erreur SEUL (jamais de message, de stack ni de
 * chaîne de connexion) pour rester observable sans exposer de détail sensible.
 */
export async function getFounderDbForBeacon(): Promise<SqlExecutor | null> {
  try {
    return await getFounderDb();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[founder-access] beacon: dépendance indisponible, événement non persisté —", err instanceof Error ? err.name : "unknown");
    return null;
  }
}
