// BLOC 3 — Storage server-only fail-closed.
//
// Trois backends possibles :
//   1) Runtime Postgres dédié (production / staging).
//   2) Store mémoire injecté EXPLICITEMENT par les tests
//      (`__setConversionStoreBackendForTests`).
//   3) Store mémoire de DEV LOCAL — autorisé uniquement quand la variable
//      d'environnement `CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE=true`
//      est posée. Cette autorisation NE prend PAS effet en production
//      (`NODE_ENV === 'production'` ignore toujours le fallback).
//
// En production, sans backend DB ni injection test, toute tentative de
// résolution/persistance jette `ConversionBackendUnavailableError` — la
// route publique `/p/[token]` retombe alors en réponse organique neutre
// et n'expose JAMAIS l'existence d'un prospect.
//
// Cette politique reflète l'exigence du brief BLOC 3 §5 : "Fail closed avec
// erreur contrôlée. Un visiteur peut toujours accéder à la démo organique
// générique, mais jamais avec une attribution prétendument persistante."

import { tokenFingerprint } from "./attribution-token";
import {
  FUNNEL_VERSION,
  ORGANIC_VARIANT_ID,
  VARIANT_IDS,
} from "./contract";
import { cleanEventMetadata, isContactKind, isEventType, UUID_V4_RE } from "./validation";
import type {
  AttributionGrant,
  ConversionEvent,
  ConversionSession,
  ConversionStage,
} from "./types";
import type { ContactKind, EventType, VariantId } from "./contract";

// ── Erreurs ────────────────────────────────────────────────────────────────
export class ConversionBackendUnavailableError extends Error {
  readonly code = "B3_CONVERSION_BACKEND_UNAVAILABLE";
  constructor(message = "conversion backend unavailable (fail-closed)") {
    super(message);
    this.name = "ConversionBackendUnavailableError";
  }
}

// ── Backend abstraction ────────────────────────────────────────────────────
export interface ConversionBackend {
  readonly kind: "in_memory" | "runtime_pg";
  // grants
  upsertGrant(grant: AttributionGrant): void;
  getGrantByTokenId(tokenId: string): AttributionGrant | null;
  markGrantVisited(tokenId: string, isoTimestamp: string): AttributionGrant | null;
  revokeGrant(tokenId: string, isoTimestamp: string): boolean;
  // sessions
  insertSession(session: ConversionSession): ConversionSession;
  getSession(sessionId: string): ConversionSession | null;
  updateSession(session: ConversionSession): ConversionSession;
  // events
  recordEvent(event: ConversionEvent): { inserted: boolean; existing: ConversionEvent | null };
  listEventsForSession(sessionId: string): readonly ConversionEvent[];
  listAllEvents(): readonly ConversionEvent[];
  // reset (tests only)
  resetForTests(): void;
}

// ── In-memory backend (tests + dev local explicite) ────────────────────────
function newInMemoryBackend(): ConversionBackend {
  const grants = new Map<string, AttributionGrant>();
  const sessions = new Map<string, ConversionSession>();
  const events = new Map<string, ConversionEvent>(); // keyed by idempotencyKey
  const eventLog: ConversionEvent[] = [];
  return {
    kind: "in_memory",
    upsertGrant(grant) {
      grants.set(grant.tokenId, grant);
    },
    getGrantByTokenId(tokenId) {
      return grants.get(tokenId.toLowerCase()) ?? null;
    },
    markGrantVisited(tokenId, isoTimestamp) {
      const g = grants.get(tokenId.toLowerCase());
      if (!g) return null;
      const updated: AttributionGrant = { ...g, lastVisitAt: isoTimestamp };
      grants.set(g.tokenId, updated);
      return updated;
    },
    revokeGrant(tokenId, isoTimestamp) {
      const g = grants.get(tokenId.toLowerCase());
      if (!g) return false;
      grants.set(g.tokenId, { ...g, status: "REVOKED", revokedAt: isoTimestamp });
      return true;
    },
    insertSession(session) {
      sessions.set(session.id, session);
      return session;
    },
    getSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    updateSession(session) {
      sessions.set(session.id, session);
      return session;
    },
    recordEvent(event) {
      const existing = events.get(event.idempotencyKey);
      if (existing) return { inserted: false, existing };
      events.set(event.idempotencyKey, event);
      eventLog.push(event);
      return { inserted: true, existing: null };
    },
    listEventsForSession(sessionId) {
      return eventLog.filter((e) => e.sessionId === sessionId);
    },
    listAllEvents() {
      return eventLog.slice();
    },
    resetForTests() {
      grants.clear();
      sessions.clear();
      events.clear();
      eventLog.length = 0;
    },
  };
}

// ── Backend selector (singleton process-local) ─────────────────────────────
let _backend: ConversionBackend | null = null;
let _backendOverriddenForTests = false;

function inMemoryAllowedInThisEnv(): boolean {
  // Production : refuse TOUJOURS le fallback (sauf si injecté explicitement
  // par les tests via __setConversionStoreBackendForTests).
  if (process.env.NODE_ENV === "production") return false;
  // Hors production : autorisé seulement si le flag explicite est posé.
  return process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE === "true";
}

/**
 * Récupère (ou refuse de récupérer) le backend conversion. Throw si
 * production sans backend DB et sans injection test → fail-closed.
 */
function resolveBackend(): ConversionBackend {
  if (_backend) return _backend;
  if (_backendOverriddenForTests) {
    throw new ConversionBackendUnavailableError("test override cleared without re-injection");
  }
  if (inMemoryAllowedInThisEnv()) {
    _backend = newInMemoryBackend();
    return _backend;
  }
  // Production / staging strict : aucune persistance silencieuse.
  throw new ConversionBackendUnavailableError(
    "no conversion backend wired (set CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE=true for local dev, " +
      "or inject via __setConversionStoreBackendForTests in tests)",
  );
}

/** Indique si un backend est actuellement disponible — UTILE pour les routes
 *  publiques qui doivent FAIL-CLOSED en silence (réponse organique). */
export function isConversionBackendAvailable(): boolean {
  if (_backend) return true;
  return inMemoryAllowedInThisEnv();
}

/** Injection backend par les tests. Annule l'auto-instanciation. */
export function __setConversionStoreBackendForTests(backend: ConversionBackend | null): void {
  _backend = backend;
  _backendOverriddenForTests = backend !== null;
}

/** Reset complet pour test isolation. */
export function __resetConversionStoreForTests(): void {
  if (_backend) _backend.resetForTests();
  _backend = null;
  _backendOverriddenForTests = false;
}

// ── Grants ─────────────────────────────────────────────────────────────────
export interface ImportGrantInput {
  tokenId: string;
  keyVersion?: string;
  variant: VariantId;
  cohort: string;
  contactKind: ContactKind;
  campaignId: string;
  prospectId: string;
  siren?: string | null;
  segment?: string | null;
  emailTier?: string | null;
  ttlDays?: number;
  now?: Date;
}

const DEFAULT_TTL_DAYS = 45;
const TOKEN_ID_RE = /^[0-9a-f]{40}$/;

export interface ImportGrantResult {
  ok: boolean;
  grant?: AttributionGrant;
  errors: readonly string[];
}

export function importAttributionGrant(input: ImportGrantInput): ImportGrantResult {
  const errors: string[] = [];
  if (!TOKEN_ID_RE.test(input.tokenId)) errors.push("token_id.invalid");
  if (!(VARIANT_IDS as readonly string[]).includes(input.variant)) errors.push("variant.invalid");
  if (!isContactKind(input.contactKind)) errors.push("contact_kind.invalid");
  if (typeof input.cohort !== "string" || input.cohort.trim().length === 0) errors.push("cohort.invalid");
  if (typeof input.campaignId !== "string" || input.campaignId.trim().length === 0) errors.push("campaign.invalid");
  if (typeof input.prospectId !== "string" || input.prospectId.trim().length === 0) errors.push("prospect_id.invalid");
  if (errors.length > 0) return { ok: false, errors };

  const backend = resolveBackend();
  const now = input.now ?? new Date();
  const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const fingerprint = tokenFingerprint(input.tokenId);
  const id = `grant_${fingerprint.slice(0, 16)}`;
  const grant: AttributionGrant = {
    id,
    tokenId: input.tokenId.toLowerCase(),
    tokenFingerprint: fingerprint,
    keyVersion: input.keyVersion ?? "a1",
    prospectId: input.prospectId,
    siren: input.siren ?? null,
    campaignId: input.campaignId,
    cohort: input.cohort,
    variant: input.variant,
    contactKind: input.contactKind,
    segment: input.segment ?? null,
    emailTier: input.emailTier ?? null,
    funnelVersion: FUNNEL_VERSION,
    status: "ACTIVE",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
    lastVisitAt: null,
  };
  backend.upsertGrant(grant);
  return { ok: true, grant, errors: [] };
}

export function getGrantByTokenId(tokenId: string): AttributionGrant | null {
  try {
    const backend = resolveBackend();
    return backend.getGrantByTokenId(tokenId.toLowerCase());
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return null; // fail-closed
    throw e;
  }
}

export function markGrantVisited(tokenId: string, now: Date = new Date()): AttributionGrant | null {
  try {
    return resolveBackend().markGrantVisited(tokenId.toLowerCase(), now.toISOString());
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return null;
    throw e;
  }
}

export function revokeGrant(tokenId: string, now: Date = new Date()): boolean {
  try {
    return resolveBackend().revokeGrant(tokenId.toLowerCase(), now.toISOString());
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return false;
    throw e;
  }
}

export function isGrantUsable(grant: AttributionGrant, now: Date = new Date()): boolean {
  if (grant.status !== "ACTIVE") return false;
  if (grant.revokedAt !== null) return false;
  if (new Date(grant.expiresAt).getTime() < now.getTime()) return false;
  return true;
}

// ── Sessions ───────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function newSessionId(): string {
  return globalThis.crypto.randomUUID();
}

function newCorrelationId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

export function createConversionSessionFromGrant(
  grant: AttributionGrant,
  now: Date = new Date(),
): ConversionSession {
  const backend = resolveBackend();
  const session: ConversionSession = {
    id: newSessionId(),
    grantId: grant.id,
    variant: grant.variant,
    campaign: grant.campaignId,
    cohort: grant.cohort,
    contactKind: grant.contactKind,
    funnelVersion: grant.funnelVersion,
    stage: "landed",
    userId: null,
    tenantId: null,
    orderId: null,
    diagnosticDraftKey: null,
    correlationId: newCorrelationId(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  return backend.insertSession(session);
}

export function createOrganicConversionSession(now: Date = new Date()): ConversionSession {
  // Pour les sessions organiques (sans grant), on peut tolérer l'absence
  // de backend en RENDANT QUAND MÊME une session ÉPHÉMÈRE non persistée :
  // la démo organique reste accessible. Si le backend est disponible, on
  // persiste pour pouvoir corréler les events.
  const session: ConversionSession = {
    id: newSessionId(),
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
    correlationId: newCorrelationId(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  try {
    return resolveBackend().insertSession(session);
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return session;
    throw e;
  }
}

export function getConversionSession(sessionId: string): ConversionSession | null {
  if (!sessionId || !UUID_V4_RE.test(sessionId)) return null;
  try {
    return resolveBackend().getSession(sessionId);
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return null;
    throw e;
  }
}

export interface SessionUpdate {
  stage?: ConversionStage;
  userId?: string | null;
  tenantId?: string | null;
  orderId?: string | null;
  diagnosticDraftKey?: string | null;
}

const STAGE_ORDER: readonly ConversionStage[] = [
  "landed",
  "demo_seen",
  "diagnostic_in_progress",
  "diagnostic_completed",
  "checkout_pending",
  "checkout_completed",
  "onboarding",
  "activated",
  "expired",
];

function advanceStage(current: ConversionStage, next: ConversionStage): ConversionStage {
  const ci = STAGE_ORDER.indexOf(current);
  const ni = STAGE_ORDER.indexOf(next);
  if (ci < 0 || ni < 0) return current;
  return ni > ci ? next : current;
}

export function updateConversionSession(
  sessionId: string,
  update: SessionUpdate,
  now: Date = new Date(),
): ConversionSession | null {
  let backend: ConversionBackend;
  try {
    backend = resolveBackend();
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return null;
    throw e;
  }
  const existing = backend.getSession(sessionId);
  if (!existing) return null;
  const merged: ConversionSession = {
    ...existing,
    stage: update.stage ? advanceStage(existing.stage, update.stage) : existing.stage,
    userId: update.userId !== undefined ? update.userId : existing.userId,
    tenantId: update.tenantId !== undefined ? update.tenantId : existing.tenantId,
    orderId: update.orderId !== undefined ? update.orderId : existing.orderId,
    diagnosticDraftKey: update.diagnosticDraftKey !== undefined ? update.diagnosticDraftKey : existing.diagnosticDraftKey,
    updatedAt: now.toISOString(),
  };
  return backend.updateSession(merged);
}

/** Rattachement atomique user/tenant. Refuse si déjà attaché à un autre user. */
export function attachUserToSession(
  sessionId: string,
  userId: string,
  tenantId: string | null,
  now: Date = new Date(),
): { ok: boolean; session?: ConversionSession; reason?: string } {
  let backend: ConversionBackend;
  try {
    backend = resolveBackend();
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return { ok: false, reason: "backend_unavailable" };
    throw e;
  }
  const existing = backend.getSession(sessionId);
  if (!existing) return { ok: false, reason: "session_not_found" };
  if (existing.userId && existing.userId !== userId) {
    return { ok: false, reason: "session_attached_to_other_user" };
  }
  if (existing.tenantId && tenantId && existing.tenantId !== tenantId) {
    return { ok: false, reason: "session_attached_to_other_tenant" };
  }
  const updated = updateConversionSession(sessionId, { userId, tenantId }, now);
  if (!updated) return { ok: false, reason: "session_update_failed" };
  return { ok: true, session: updated };
}

// ── Events ─────────────────────────────────────────────────────────────────
export interface RecordEventInput {
  sessionId: string;
  eventType: EventType;
  idempotencyKey: string;
  campaign?: string | null;
  cohort?: string | null;
  variant?: string | null;
  sourcePage?: string | null;
  prospectToken?: string | null; // sera réduit à token_id
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  now?: Date;
}

export interface RecordEventResult {
  ok: boolean;
  duplicate?: boolean;
  event?: ConversionEvent;
  reason?: string;
}

import { safeProspectToken } from "./attribution-token";

export function recordConversionEvent(input: RecordEventInput): RecordEventResult {
  if (!isEventType(input.eventType)) return { ok: false, reason: "event_type_invalid" };
  let backend: ConversionBackend;
  try {
    backend = resolveBackend();
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return { ok: false, reason: "backend_unavailable" };
    throw e;
  }
  const session = backend.getSession(input.sessionId);
  if (!session) return { ok: false, reason: "session_not_found" };

  const cleaned = cleanEventMetadata(input.metadata ?? {});
  const event: ConversionEvent = {
    eventId: globalThis.crypto.randomUUID().replace(/-/g, ""),
    idempotencyKey: input.idempotencyKey,
    eventType: input.eventType,
    serverTimestamp: (input.now ?? new Date()).toISOString(),
    prospectToken: safeProspectToken(input.prospectToken ?? ""),
    sessionId: session.id,
    campaign: input.campaign ?? session.campaign ?? "",
    cohort: input.cohort ?? session.cohort ?? "",
    variant: input.variant ?? session.variant,
    funnelVersion: session.funnelVersion,
    sourcePage: input.sourcePage ?? "",
    correlationId: input.correlationId ?? session.correlationId,
    metadata: cleaned.cleaned,
  };
  const result = backend.recordEvent(event);
  if (!result.inserted) {
    return { ok: true, duplicate: true, event: result.existing ?? event };
  }
  return { ok: true, event };
}

export function listConversionEvents(sessionId: string): readonly ConversionEvent[] {
  try {
    return resolveBackend().listEventsForSession(sessionId);
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return [];
    throw e;
  }
}

export function listAllConversionEvents(): readonly ConversionEvent[] {
  try {
    return resolveBackend().listAllEvents();
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return [];
    throw e;
  }
}

// ── Réconciliation ─────────────────────────────────────────────────────────
export interface ReconciliationRow {
  sessionId: string;
  grantTokenFingerprint: string | null;
  campaign: string | null;
  cohort: string | null;
  variant: string;
  stage: ConversionStage;
  userId: string | null;
  tenantId: string | null;
  orderId: string | null;
  correlationId: string;
  events: readonly { eventType: EventType; serverTimestamp: string }[];
}

export function buildReconciliationReport(): ReconciliationRow[] {
  try {
    const backend = resolveBackend();
    const allEvents = backend.listAllEvents();
    const bySession = new Map<string, ConversionEvent[]>();
    for (const e of allEvents) {
      const arr = bySession.get(e.sessionId) ?? [];
      arr.push(e);
      bySession.set(e.sessionId, arr);
    }
    const rows: ReconciliationRow[] = [];
    for (const [sessionId, events] of bySession) {
      const session = backend.getSession(sessionId);
      if (!session) continue;
      const grant = session.grantId
        ? // Sans index direct, on cherche dans les grants connues : pour les
          // backends in-memory c'est OK. Pour PG ce sera une requête SQL.
          findGrantById(backend, session.grantId)
        : null;
      rows.push({
        sessionId: session.id,
        grantTokenFingerprint: grant?.tokenFingerprint ?? null,
        campaign: session.campaign,
        cohort: session.cohort,
        variant: session.variant,
        stage: session.stage,
        userId: session.userId,
        tenantId: session.tenantId,
        orderId: session.orderId,
        correlationId: session.correlationId,
        events: events.map((e) => ({ eventType: e.eventType, serverTimestamp: e.serverTimestamp })),
      });
    }
    return rows;
  } catch (e) {
    if (e instanceof ConversionBackendUnavailableError) return [];
    throw e;
  }
}

function findGrantById(backend: ConversionBackend, grantId: string): AttributionGrant | null {
  // Helper temporaire : scanne via getGrantByTokenId pour tous les grants
  // mémorisés. Implémentation in-memory uniquement.
  if (backend.kind !== "in_memory") return null;
  // Pour le backend in-memory, on doit recourir à une approche par contournement.
  // Cette fonction sera étendue lorsque le backend PG sera branché.
  return null;
}
