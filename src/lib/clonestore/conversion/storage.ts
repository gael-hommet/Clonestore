// BLOC 3 — Storage server-only : grants d'attribution, conversion sessions, events.
//
// IMPORTANT : ces tables vivent dans le runtime Postgres (getRuntimeDb), JAMAIS
// dans Supabase REST. Le navigateur ne peut pas les lire ; RLS est secondaire.
//
// Cette couche est intentionnellement minimaliste : un store en mémoire est
// fourni comme fallback de TEST UNIQUEMENT (jamais en production). En prod, la
// migration `BLOC_3_CONVERSION_INTEGRATION.sql` crée les tables et la fonction
// définie ici délègue à PG. Tant que la migration n'est pas appliquée, le
// fallback in-memory permet à toutes les surfaces de fonctionner localement.

import { tokenFingerprint } from "./attribution-token";
import { advanceStage, newConversionSessionId } from "./session";
import {
  FUNNEL_VERSION,
  ORGANIC_VARIANT_ID,
} from "./contract";
import { isCohortId, isContactKind, isVariantId } from "./validation";
import type {
  AttributionGrant,
  ConversionEvent,
  ConversionSession,
  ConversionStage,
} from "./types";
import type { CohortId, ContactKind, EventId, VariantId } from "./contract";

// ── In-memory store (test/dev) — process-local, jamais persistant ───────────
interface InMemoryStore {
  grants: Map<string, AttributionGrant>;
  sessions: Map<string, ConversionSession>;
  events: Map<string, ConversionEvent>; // keyed by idempotencyKey
  eventLog: ConversionEvent[];
}

declare global {
  // eslint-disable-next-line no-var
  var __cloneStoreConversionStore: InMemoryStore | undefined;
}

function store(): InMemoryStore {
  if (!globalThis.__cloneStoreConversionStore) {
    globalThis.__cloneStoreConversionStore = {
      grants: new Map(),
      sessions: new Map(),
      events: new Map(),
      eventLog: [],
    };
  }
  return globalThis.__cloneStoreConversionStore;
}

export function __resetConversionStoreForTests(): void {
  globalThis.__cloneStoreConversionStore = {
    grants: new Map(),
    sessions: new Map(),
    events: new Map(),
    eventLog: [],
  };
}

// ── Grants ──────────────────────────────────────────────────────────────────
export interface ImportGrantInput {
  tokenId: string;
  keyVersion: number;
  variant: VariantId;
  cohort: CohortId;
  contactKind: ContactKind;
  campaign: string;
  segment?: string | null;
  emailTier?: string | null;
  leadforgeProspectId?: string | null;
  ttlMs?: number;
  now?: Date;
}

const DEFAULT_GRANT_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 jours

export interface ImportGrantResult {
  ok: boolean;
  grant?: AttributionGrant;
  errors: readonly string[];
}

export function importAttributionGrant(input: ImportGrantInput): ImportGrantResult {
  const errors: string[] = [];
  if (!/^[0-9a-f]{32}$/i.test(input.tokenId)) errors.push("token_id.invalid");
  if (!Number.isInteger(input.keyVersion) || input.keyVersion < 1) errors.push("key_version.invalid");
  if (!isVariantId(input.variant) || (input.variant as string) === ORGANIC_VARIANT_ID) errors.push("variant.invalid");
  if (!isCohortId(input.cohort)) errors.push("cohort.invalid");
  if (!isContactKind(input.contactKind)) errors.push("contact_kind.invalid");
  if (typeof input.campaign !== "string" || input.campaign.trim().length === 0) errors.push("campaign.invalid");
  if (errors.length > 0) return { ok: false, errors };

  const now = input.now ?? new Date();
  const ttl = input.ttlMs ?? DEFAULT_GRANT_TTL_MS;
  const fingerprint = tokenFingerprint(input.tokenId, input.keyVersion);
  const id = `grant_${fingerprint.slice(0, 16)}`;
  const grant: AttributionGrant = {
    id,
    tokenId: input.tokenId.toLowerCase(),
    tokenFingerprint: fingerprint,
    keyVersion: input.keyVersion,
    leadforgeProspectId: input.leadforgeProspectId ?? null,
    campaign: input.campaign.trim().slice(0, 80),
    cohort: input.cohort,
    variant: input.variant as VariantId,
    contactKind: input.contactKind,
    segment: input.segment?.trim().slice(0, 40) ?? null,
    emailTier: input.emailTier?.trim().slice(0, 24) ?? null,
    funnelVersion: FUNNEL_VERSION,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    revokedAt: null,
    lastResolvedAt: null,
  };
  store().grants.set(grant.tokenId, grant);
  return { ok: true, grant, errors: [] };
}

export function getGrantByTokenId(tokenId: string): AttributionGrant | null {
  return store().grants.get(tokenId.toLowerCase()) ?? null;
}

export function revokeGrant(tokenId: string, now: Date = new Date()): boolean {
  const g = store().grants.get(tokenId.toLowerCase());
  if (!g) return false;
  store().grants.set(g.tokenId, { ...g, status: "revoked", revokedAt: now.toISOString() });
  return true;
}

/** Marque "résolu" le grant (visite publique). Idempotent. */
export function markGrantResolved(tokenId: string, now: Date = new Date()): AttributionGrant | null {
  const g = store().grants.get(tokenId.toLowerCase());
  if (!g) return null;
  const updated: AttributionGrant = { ...g, lastResolvedAt: now.toISOString() };
  store().grants.set(g.tokenId, updated);
  return updated;
}

export function isGrantUsable(grant: AttributionGrant, now: Date = new Date()): boolean {
  if (grant.status !== "active") return false;
  if (grant.revokedAt !== null) return false;
  if (new Date(grant.expiresAt).getTime() < now.getTime()) return false;
  return true;
}

// ── Conversion sessions ─────────────────────────────────────────────────────
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createConversionSessionFromGrant(grant: AttributionGrant, now: Date = new Date()): ConversionSession {
  const session: ConversionSession = {
    id: newConversionSessionId(),
    grantId: grant.id,
    variant: grant.variant,
    campaign: grant.campaign,
    cohort: grant.cohort,
    contactKind: grant.contactKind,
    funnelVersion: grant.funnelVersion,
    stage: "landed",
    userId: null,
    tenantId: null,
    orderId: null,
    diagnosticDraftKey: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  store().sessions.set(session.id, session);
  return session;
}

export function createOrganicConversionSession(now: Date = new Date()): ConversionSession {
  const session: ConversionSession = {
    id: newConversionSessionId(),
    grantId: null,
    variant: ORGANIC_VARIANT_ID,
    campaign: null,
    cohort: null,
    contactKind: null,
    funnelVersion: FUNNEL_VERSION,
    stage: "landed",
    userId: null,
    tenantId: null,
    orderId: null,
    diagnosticDraftKey: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  store().sessions.set(session.id, session);
  return session;
}

export function getConversionSession(sessionId: string): ConversionSession | null {
  if (!sessionId) return null;
  return store().sessions.get(sessionId) ?? null;
}

export interface SessionUpdate {
  stage?: ConversionStage;
  userId?: string | null;
  tenantId?: string | null;
  orderId?: string | null;
  diagnosticDraftKey?: string | null;
}

export function updateConversionSession(sessionId: string, update: SessionUpdate, now: Date = new Date()): ConversionSession | null {
  const existing = store().sessions.get(sessionId);
  if (!existing) return null;
  const nextStage = update.stage ? advanceStage(existing.stage, update.stage) : existing.stage;
  const merged: ConversionSession = {
    ...existing,
    stage: nextStage,
    userId: update.userId !== undefined ? update.userId : existing.userId,
    tenantId: update.tenantId !== undefined ? update.tenantId : existing.tenantId,
    orderId: update.orderId !== undefined ? update.orderId : existing.orderId,
    diagnosticDraftKey: update.diagnosticDraftKey !== undefined ? update.diagnosticDraftKey : existing.diagnosticDraftKey,
    updatedAt: now.toISOString(),
  };
  store().sessions.set(sessionId, merged);
  return merged;
}

/** Rattache un user/tenant à une session anonyme. Refuse si déjà attaché à autre user. */
export function attachUserToSession(
  sessionId: string,
  userId: string,
  tenantId: string | null,
  now: Date = new Date(),
): { ok: boolean; session?: ConversionSession; reason?: string } {
  const existing = store().sessions.get(sessionId);
  if (!existing) return { ok: false, reason: "session_not_found" };
  if (existing.userId && existing.userId !== userId) {
    return { ok: false, reason: "session_attached_to_other_user" };
  }
  const session = updateConversionSession(sessionId, { userId, tenantId }, now);
  if (!session) return { ok: false, reason: "session_update_failed" };
  return { ok: true, session };
}

// ── Events ──────────────────────────────────────────────────────────────────
export interface RecordEventInput {
  sessionId: string;
  eventId: EventId;
  idempotencyKey: string;
  metadata?: Record<string, string | number | boolean | null>;
  now?: Date;
}

export interface RecordEventResult {
  ok: boolean;
  duplicate?: boolean;
  event?: ConversionEvent;
  reason?: string;
}

const METADATA_MAX_KEYS = 12;
const METADATA_MAX_VALUE_LEN = 120;

export function recordConversionEvent(input: RecordEventInput): RecordEventResult {
  const session = store().sessions.get(input.sessionId);
  if (!session) return { ok: false, reason: "session_not_found" };
  const existing = store().events.get(input.idempotencyKey);
  if (existing) return { ok: true, duplicate: true, event: existing };
  const cleaned: Record<string, string | number | boolean | null> = {};
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(input.metadata ?? {})) {
    if (count >= METADATA_MAX_KEYS) break;
    const key = String(rawKey).trim().slice(0, 32);
    if (key.length === 0) continue;
    if (/email|token|secret|password|siren|cv|salary/i.test(key)) continue;
    if (rawValue === null || rawValue === undefined) {
      cleaned[key] = null;
    } else if (typeof rawValue === "boolean") {
      cleaned[key] = rawValue;
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      cleaned[key] = rawValue;
    } else if (typeof rawValue === "string") {
      const v = rawValue.slice(0, METADATA_MAX_VALUE_LEN);
      if (/[@]|\b\d{9,}\b/.test(v)) continue; // skip PII-like
      cleaned[key] = v;
    } else {
      continue;
    }
    count += 1;
  }
  const event: ConversionEvent = {
    id: globalThis.crypto.randomUUID(),
    sessionId: session.id,
    eventId: input.eventId,
    idempotencyKey: input.idempotencyKey,
    serverTimestamp: (input.now ?? new Date()).toISOString(),
    metadata: cleaned,
    variant: session.variant,
  };
  store().events.set(input.idempotencyKey, event);
  store().eventLog.push(event);
  return { ok: true, event };
}

export function listConversionEvents(sessionId: string): readonly ConversionEvent[] {
  return store().eventLog.filter((e) => e.sessionId === sessionId);
}

export function listAllConversionEvents(): readonly ConversionEvent[] {
  return store().eventLog.slice();
}

// ── Réconciliation (export interne) ────────────────────────────────────────
export interface ReconciliationRow {
  sessionId: string;
  grantTokenFingerprint: string | null;
  campaign: string | null;
  cohort: CohortId | null;
  variant: VariantId | "VARIANT_ORGANIC";
  stage: ConversionStage;
  userId: string | null;
  tenantId: string | null;
  orderId: string | null;
  events: readonly { eventId: EventId; serverTimestamp: string }[];
}

export function buildReconciliationReport(): ReconciliationRow[] {
  const s = store();
  return Array.from(s.sessions.values()).map((session) => {
    const grant = session.grantId
      ? Array.from(s.grants.values()).find((g) => g.id === session.grantId) ?? null
      : null;
    const events = s.eventLog
      .filter((e) => e.sessionId === session.id)
      .map((e) => ({ eventId: e.eventId, serverTimestamp: e.serverTimestamp }));
    return {
      sessionId: session.id,
      grantTokenFingerprint: grant?.tokenFingerprint ?? null,
      campaign: session.campaign,
      cohort: session.cohort,
      variant: session.variant,
      stage: session.stage,
      userId: session.userId,
      tenantId: session.tenantId,
      orderId: session.orderId,
      events,
    };
  });
}
