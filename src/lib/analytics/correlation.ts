// Canonical Analytics Runtime Wiring — corrélation serveur-authoritative du parcours.
// Relie visitor/session d'origine → reservation → user → checkout → order, sans PII et sans
// jamais faire confiance à un identifiant libre client. Références Stripe hachées avant stockage.
//
// Voir audit-20260723-full/ANALYTICS_CONVERSION_CORRELATION_EXISTING_STATE.md.

import { createHash } from "node:crypto";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import type { AnalyticsEnvironment } from "./schema";

/** Contrat de corrélation canonique (fermé). */
export interface CanonicalConversionCorrelation {
  visitorId: string | null;
  sessionId: string | null;
  reservationId: string | null;
  authenticatedUserId: string | null;
  checkoutSessionReference: string | null; // hachée
  orderReference: string | null; // hachée
  partnerAttributionId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuid(v: string | null | undefined): string | null {
  return v && UUID_RE.test(v) ? v : null;
}

/** Hache une référence Stripe brute (jamais stockée en clair). Borné. */
export function hashRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return "s_" + createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
}

export interface UpsertLinkInput {
  reservationId: string;
  environment: AnalyticsEnvironment;
  visitorId?: string | null;
  sessionId?: string | null;
  authenticatedUserId?: string | null;
  checkoutSessionRef?: string | null; // déjà haché
  orderRef?: string | null; // déjà haché
  partnerAttributionId?: string | null;
}

/**
 * Upsert idempotent d'une ligne de corrélation par (reservation_id, environment). Fusionne :
 * une valeur nouvelle non-nulle écrase, une valeur nulle laisse l'existant (coalesce), pour que
 * la réservation (visitor/session) puis le checkout (order/user) puis le webhook (order) puissent
 * enrichir la même ligne dans n'importe quel ordre. Best-effort côté appelant.
 */
export async function upsertConversionLink(db: SqlExecutor, input: UpsertLinkInput): Promise<void> {
  await db.query(
    `insert into clonestore_analytics_conversion_links_v1
       (reservation_id, environment, visitor_id, session_id, authenticated_user_id,
        checkout_session_ref, order_ref, partner_attribution_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (reservation_id, environment) do update set
       visitor_id = coalesce(excluded.visitor_id, clonestore_analytics_conversion_links_v1.visitor_id),
       session_id = coalesce(excluded.session_id, clonestore_analytics_conversion_links_v1.session_id),
       authenticated_user_id = coalesce(excluded.authenticated_user_id, clonestore_analytics_conversion_links_v1.authenticated_user_id),
       checkout_session_ref = coalesce(excluded.checkout_session_ref, clonestore_analytics_conversion_links_v1.checkout_session_ref),
       order_ref = coalesce(excluded.order_ref, clonestore_analytics_conversion_links_v1.order_ref),
       partner_attribution_id = coalesce(excluded.partner_attribution_id, clonestore_analytics_conversion_links_v1.partner_attribution_id)`,
    [
      input.reservationId,
      input.environment,
      asUuid(input.visitorId),
      asUuid(input.sessionId),
      asUuid(input.authenticatedUserId),
      input.checkoutSessionRef ?? null,
      input.orderRef ?? null,
      input.partnerAttributionId ?? null,
    ],
  );
}

interface LinkRow {
  reservation_id: string;
  visitor_id: string | null;
  session_id: string | null;
  authenticated_user_id: string | null;
  checkout_session_ref: string | null;
  order_ref: string | null;
  partner_attribution_id: string | null;
}

function rowToCorrelation(r: LinkRow | undefined): CanonicalConversionCorrelation | null {
  if (!r) return null;
  return {
    visitorId: r.visitor_id,
    sessionId: r.session_id,
    reservationId: r.reservation_id,
    authenticatedUserId: r.authenticated_user_id,
    checkoutSessionReference: r.checkout_session_ref,
    orderReference: r.order_ref,
    partnerAttributionId: r.partner_attribution_id,
  };
}

export async function resolveCorrelationByReservation(
  db: SqlExecutor,
  reservationId: string,
  environment: AnalyticsEnvironment,
): Promise<CanonicalConversionCorrelation | null> {
  const r = await db.query<LinkRow>(
    `select * from clonestore_analytics_conversion_links_v1 where reservation_id = $1 and environment = $2 limit 1`,
    [reservationId, environment],
  );
  return rowToCorrelation(r.rows[0]);
}

export async function resolveCorrelationByOrderRef(
  db: SqlExecutor,
  orderRef: string,
  environment: AnalyticsEnvironment,
): Promise<CanonicalConversionCorrelation | null> {
  const r = await db.query<LinkRow>(
    `select * from clonestore_analytics_conversion_links_v1 where order_ref = $1 and environment = $2 order by updated_at desc limit 1`,
    [orderRef, environment],
  );
  return rowToCorrelation(r.rows[0]);
}
