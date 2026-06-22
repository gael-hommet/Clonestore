// BLOC 3 — Pont Checkout / Webhook.
//
// Module ADDITIF : ne remplace pas /api/checkout ni /api/webhooks/stripe, ne
// duplique ni l'auth, ni le billing engine, ni le onboarding. Il fournit
// uniquement des helpers purs que les routes existantes peuvent appeler côté
// serveur après leurs propres garde-fous (idempotency, signature, etc.).
//
// Les helpers :
//   • `buildConversionCheckoutMetadata` — prépare une metadata Stripe
//     limitée à l'allowlist contractuelle (cf. contract.ts) et sans bearer/PII.
//   • `bridgeCheckoutStarted` — émet l'événement serveur `checkout_started`
//     attaché à la session de conversion lue dans le cookie signé.
//   • `bridgeCheckoutCompleted` — émet `checkout_completed` à partir d'une
//     metadata Stripe vérifiée (webhook-side, fail-closed sur signature/preuve).
//
// Aucun appel direct à Stripe ; aucun accès au navigateur ; aucun accès cross-tenant.

import { FUNNEL_VERSION } from "./contract";
import { sanitizeCheckoutMetadata } from "./validation";
import { recordConversionEvent, updateConversionSession, getConversionSession } from "./storage";
import type { ConversionSession } from "./types";

export interface ConversionMetadataInput {
  conversion_session_id: string;
  user_id: string;
  agent_slug: string;
  order_id?: string | null;
  tenant_id?: string | null;
  founder_reservation_id?: string | null;
}

export interface BuiltCheckoutMetadata {
  ok: boolean;
  metadata: Record<string, string>;
  errors: readonly string[];
}

export function buildConversionCheckoutMetadata(input: ConversionMetadataInput): BuiltCheckoutMetadata {
  const session = getConversionSession(input.conversion_session_id);
  const base: Record<string, string> = {
    user_id: input.user_id,
    agent_slug: input.agent_slug,
    conversion_session_id: input.conversion_session_id,
    funnel_version: FUNNEL_VERSION,
    conversion_variant: session?.variant ?? "VARIANT_ORGANIC",
  };
  if (input.order_id) base.order_id = input.order_id;
  if (input.tenant_id) base.tenant_id = input.tenant_id;
  if (input.founder_reservation_id) base.founder_reservation_id = input.founder_reservation_id;
  if (session?.campaign) base.conversion_campaign = session.campaign;
  if (session?.cohort) base.conversion_cohort = session.cohort;
  const sanitized = sanitizeCheckoutMetadata(base);
  return { ok: sanitized.ok, metadata: sanitized.cleaned, errors: sanitized.errors };
}

export interface BridgeCheckoutEventResult {
  ok: boolean;
  session?: ConversionSession;
  reason?: string;
}

export function bridgeCheckoutStarted(args: {
  sessionId: string;
  orderId?: string | null;
  userId: string;
  tenantId?: string | null;
}): BridgeCheckoutEventResult {
  const existing = getConversionSession(args.sessionId);
  if (!existing) return { ok: false, reason: "session_not_found" };
  const session = updateConversionSession(args.sessionId, {
    stage: "checkout_pending",
    userId: args.userId,
    tenantId: args.tenantId ?? null,
    orderId: args.orderId ?? null,
  });
  if (!session) return { ok: false, reason: "session_update_failed" };
  recordConversionEvent({
    sessionId: args.sessionId,
    eventId: "checkout_started",
    idempotencyKey: `checkout_started:${args.sessionId}:${args.orderId ?? "no_order"}`,
    metadata: {
      variant: session.variant,
      cohort: session.cohort ?? null,
      campaign: session.campaign ?? null,
    },
  });
  return { ok: true, session };
}

export function bridgeCheckoutCompleted(args: {
  metadata: Readonly<Record<string, string>>;
  orderId?: string | null;
}): BridgeCheckoutEventResult {
  const sessionId = args.metadata["conversion_session_id"];
  if (!sessionId) return { ok: false, reason: "session_id_missing" };
  const session = getConversionSession(sessionId);
  if (!session) return { ok: false, reason: "session_not_found" };
  // L'utilisateur authentifié doit correspondre à la session (si attaché). On
  // ne change pas l'user_id ici — c'est la route checkout qui l'a déjà fait.
  if (args.metadata["user_id"] && session.userId && args.metadata["user_id"] !== session.userId) {
    return { ok: false, reason: "user_mismatch" };
  }
  const updated = updateConversionSession(sessionId, {
    stage: "checkout_completed",
    orderId: args.orderId ?? session.orderId ?? null,
  });
  if (!updated) return { ok: false, reason: "session_update_failed" };
  recordConversionEvent({
    sessionId,
    eventId: "checkout_completed",
    idempotencyKey: `checkout_completed:${sessionId}:${args.orderId ?? "no_order"}`,
    metadata: {
      variant: updated.variant,
      cohort: updated.cohort ?? null,
      campaign: updated.campaign ?? null,
    },
  });
  return { ok: true, session: updated };
}

export function bridgePierreActivated(args: { sessionId: string }): BridgeCheckoutEventResult {
  const existing = getConversionSession(args.sessionId);
  if (!existing) return { ok: false, reason: "session_not_found" };
  const session = updateConversionSession(args.sessionId, { stage: "activated" });
  if (!session) return { ok: false, reason: "session_update_failed" };
  recordConversionEvent({
    sessionId: args.sessionId,
    eventId: "pierre_activated",
    idempotencyKey: `pierre_activated:${args.sessionId}`,
    metadata: { variant: session.variant },
  });
  return { ok: true, session };
}
