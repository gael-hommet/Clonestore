// BLOC 4 — Logique pure/testable de la voie QA INTERNE (Production) qui récupère de manière
// contrôlée la VRAIE URL de vérification d'une réservation QA synthétique, SANS envoyer d'email.
// Le handler HTTP (src/app/api/internal/qa/founder-verification-link/route.ts) ne fait que câbler
// l'environnement + process.env dans cette fonction. Voir la route pour les gardes détaillées.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import type { AnalyticsEnvironment } from "@/lib/analytics/schema";
import { isAuthenticatedProductionQaRequest } from "@/lib/analytics/qa-auth";
import { resolveReservationTrafficClass } from "@/lib/analytics/adapters/founder-access-adapter";
import { issueVerificationToken } from "./token";
import { setVerificationHash } from "./store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MintQaLinkParams {
  reservationId: string;
  environment: AnalyticsEnvironment;
  providedToken: string | null | undefined;
  configuredToken: string | null | undefined;
  origin: string;
}
export type MintQaLinkResult =
  | { ok: true; verifyUrl: string }
  | { ok: false; status: number; error: string };

/**
 * Gardes (toutes fail-closed) puis émission du VRAI token de vérification :
 *  1. secret QA serveur, Production uniquement, temps constant (isAuthenticatedProductionQaRequest) ;
 *  2. la réservation DOIT être QA synthétique (reservation_created classé `test`) — une vraie
 *     réservation (external) ⇒ 403, jamais ciblable ;
 *  3. la réservation doit exister.
 * Émet ensuite `issueVerificationToken()` (aléatoire, aucun secret requis), stocke SON hash et
 * renvoie l'URL de la VRAIE route /api/founder-access/verify. Aucun email. Le token n'est jamais
 * journalisé — il n'est renvoyé qu'à l'appelant QA authentifié serveur.
 */
export async function mintQaVerificationLink(db: SqlExecutor, p: MintQaLinkParams): Promise<MintQaLinkResult> {
  if (!isAuthenticatedProductionQaRequest({ environment: p.environment, providedToken: p.providedToken, configuredToken: p.configuredToken })) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (!UUID_RE.test(p.reservationId)) return { ok: false, status: 400, error: "bad_id" };
  const cls = await resolveReservationTrafficClass(db, p.reservationId, p.environment);
  if (cls !== "test") return { ok: false, status: 403, error: "not_qa_reservation" };
  const { rows } = await db.query<{ email_verified_at: string | null }>(
    "select email_verified_at from clonestore_founder_reservations where id = $1",
    [p.reservationId],
  );
  if (rows.length === 0) return { ok: false, status: 404, error: "not_found" };
  const t = issueVerificationToken();
  await setVerificationHash(db, p.reservationId, t.hash, t.expiresAt);
  const verifyUrl = `${p.origin}/api/founder-access/verify?rid=${p.reservationId}&token=${encodeURIComponent(t.token)}`;
  return { ok: true, verifyUrl };
}
