// BLOC 3 — Pont Checkout / Webhook conforme contrat LeadForge db9b166.
//
// Module ADDITIF appelé par les routes Phase E existantes.
// La metadata Stripe ne contient JAMAIS :
//   • le bearer complet (token_id.signature)
//   • un email de prospect
//   • un SIREN
//   • un secret
// Cf. clonestore_contract.py:CHECKOUT_METADATA_FIELDS.

import { CHECKOUT_METADATA_FIELDS, FUNNEL_VERSION } from "./contract";
import { sanitizeCheckoutMetadata } from "./validation";
import { safeProspectToken } from "./attribution-token";
import {
  recordConversionEvent,
  updateConversionSession,
  getConversionSession,
  isConversionBackendAvailable,
} from "./storage";
import type { ConversionSession } from "./types";

export interface ConversionMetadataInput {
  conversionSessionId: string;
  userId: string;
  agentSlug: string;
  orderId?: string | null;
  tenantId?: string | null;
  founderReservationId?: string | null;
  /**
   * Token public complet présent en cookie/back-channel (jamais en URL).
   * Sera RÉDUIT à token_id (avant le ".") avant insertion en metadata.
   */
  prospectTokenRaw?: string | null;
}

export interface BuiltCheckoutMetadata {
  ok: boolean;
  metadata: Record<string, string>;
  errors: readonly string[];
}

/**
 * Construit la metadata Stripe SANS PII ni bearer. Inclut uniquement les
 * 5 clés LeadForge (`prospect_token, campaign, cohort, variant, funnel_version`)
 * + les clés CloneStore (`user_id, agent_slug, order_id, tenant_id,
 * founder_reservation_id`) — toutes validées par l'allowlist.
 */
export function buildConversionCheckoutMetadata(input: ConversionMetadataInput): BuiltCheckoutMetadata {
  const session = getConversionSession(input.conversionSessionId);
  const variant = session?.variant ?? "VARIANT_ORGANIC";
  const base: Record<string, string> = {
    // Allowlist LeadForge
    variant,
    funnel_version: session?.funnelVersion ?? FUNNEL_VERSION,
    // Allowlist CloneStore (additionnelle, autorisée par validation.ts)
    user_id: input.userId,
    agent_slug: input.agentSlug,
  };
  if (session?.campaign) base.campaign = session.campaign;
  if (session?.cohort) base.cohort = session.cohort;
  if (input.orderId) base.order_id = input.orderId;
  if (input.tenantId) base.tenant_id = input.tenantId;
  if (input.founderReservationId) base.founder_reservation_id = input.founderReservationId;
  if (input.prospectTokenRaw) {
    const reduced = safeProspectToken(input.prospectTokenRaw);
    if (reduced) base.prospect_token = reduced;
  }
  const sanitized = sanitizeCheckoutMetadata(base);
  return { ok: sanitized.ok, metadata: sanitized.cleaned, errors: sanitized.errors };
}

// Export les noms de champs LeadForge pour permettre aux tests d'audit.
export const LEADFORGE_CHECKOUT_METADATA_FIELDS = CHECKOUT_METADATA_FIELDS;

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
  if (!isConversionBackendAvailable()) return { ok: false, reason: "backend_unavailable" };
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
    eventType: "checkout_started",
    idempotencyKey: `checkout_started:${args.sessionId}:${args.orderId ?? "no_order"}`,
    metadata: { stage: "checkout_pending" },
  });
  return { ok: true, session };
}

export function bridgeCheckoutCompleted(args: {
  metadata: Readonly<Record<string, string>>;
  orderId?: string | null;
}): BridgeCheckoutEventResult {
  if (!isConversionBackendAvailable()) return { ok: false, reason: "backend_unavailable" };
  // La session est portée par metadata (server-side only — vérité)
  const reducedToken = safeProspectToken(args.metadata["prospect_token"] ?? "");
  const conversionSessionId =
    args.metadata["conversion_session_id"] ??
    args.metadata["session_id"] ??
    "";
  if (!conversionSessionId) return { ok: false, reason: "session_id_missing" };
  const session = getConversionSession(conversionSessionId);
  if (!session) return { ok: false, reason: "session_not_found" };
  if (args.metadata["user_id"] && session.userId && args.metadata["user_id"] !== session.userId) {
    return { ok: false, reason: "user_mismatch" };
  }
  const updated = updateConversionSession(conversionSessionId, {
    stage: "checkout_completed",
    orderId: args.orderId ?? session.orderId ?? null,
  });
  if (!updated) return { ok: false, reason: "session_update_failed" };
  recordConversionEvent({
    sessionId: conversionSessionId,
    eventType: "checkout_completed",
    idempotencyKey: `checkout_completed:${conversionSessionId}:${args.orderId ?? "no_order"}`,
    prospectToken: reducedToken,
    metadata: { stage: "checkout_completed" },
  });
  return { ok: true, session: updated };
}

export function bridgeCheckoutFailed(args: {
  sessionId: string;
  reason: string;
  orderId?: string | null;
}): BridgeCheckoutEventResult {
  if (!isConversionBackendAvailable()) return { ok: false, reason: "backend_unavailable" };
  const session = getConversionSession(args.sessionId);
  if (!session) return { ok: false, reason: "session_not_found" };
  recordConversionEvent({
    sessionId: args.sessionId,
    eventType: "checkout_failed",
    idempotencyKey: `checkout_failed:${args.sessionId}:${args.orderId ?? "no_order"}`,
    metadata: { reason: args.reason.slice(0, 100) },
  });
  return { ok: true, session };
}

export function bridgePierreActivated(args: { sessionId: string }): BridgeCheckoutEventResult {
  if (!isConversionBackendAvailable()) return { ok: false, reason: "backend_unavailable" };
  const existing = getConversionSession(args.sessionId);
  if (!existing) return { ok: false, reason: "session_not_found" };
  const session = updateConversionSession(args.sessionId, { stage: "activated" });
  if (!session) return { ok: false, reason: "session_update_failed" };
  recordConversionEvent({
    sessionId: args.sessionId,
    eventType: "pierre_activated",
    idempotencyKey: `pierre_activated:${args.sessionId}`,
    metadata: { stage: "activated" },
  });
  return { ok: true, session };
}
