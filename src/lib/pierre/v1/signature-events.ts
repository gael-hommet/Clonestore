// src/lib/pierre/v1/signature-events.ts
// PHASE 8.3-B3.6/B3.7 — canonical signature event model + provider→business status mapping.
// Unknown provider events are kept as unknown and NEVER applied as success. Out-of-order
// events never regress the state (rank-based monotonicity).

export type CanonicalSignatureEvent =
  | "request.created" | "request.activated"
  | "recipient.sent" | "recipient.delivered" | "recipient.viewed" | "recipient.signed"
  | "request.completed" | "request.declined" | "request.expired" | "request.cancelled" | "request.failed";

export const CANONICAL_EVENTS: ReadonlySet<string> = new Set([
  "request.created", "request.activated", "recipient.sent", "recipient.delivered", "recipient.viewed",
  "recipient.signed", "request.completed", "request.declined", "request.expired", "request.cancelled", "request.failed",
]);

// Per-provider event-type → canonical mapping. Unmapped types → null (kept unknown).
const PROVIDER_EVENT_MAP: Record<string, Record<string, CanonicalSignatureEvent>> = {
  fake_provider: {
    "request.created": "request.created", "request.activated": "request.activated",
    "recipient.sent": "recipient.sent", "recipient.delivered": "recipient.delivered",
    "recipient.viewed": "recipient.viewed", "recipient.signed": "recipient.signed",
    "request.completed": "request.completed", "request.declined": "request.declined",
    "request.expired": "request.expired", "request.cancelled": "request.cancelled", "request.failed": "request.failed",
  },
  // Official Yousign API v3 webhook event names.
  yousign: {
    "signature_request.activated": "request.activated",
    "signature_request.done": "request.completed",
    "signature_request.declined": "request.declined",
    "signature_request.rejected": "request.declined",
    "signature_request.expired": "request.expired",
    "signature_request.canceled": "request.cancelled",
    "signer.notified": "recipient.sent",
    "signer.link_opened": "recipient.viewed",
    "signer.done": "recipient.signed",
    "signer.signed": "recipient.signed",
    "signer.declined": "request.declined",
    "signer.error": "request.failed",
  },
};

export function mapProviderEventToCanonical(provider: string, providerEventType: string): CanonicalSignatureEvent | null {
  return PROVIDER_EVENT_MAP[provider]?.[providerEventType] ?? null;
}

// Monotonic rank: a lower-rank event arriving after a higher-rank state is ignored (no regression).
const RANK: Record<CanonicalSignatureEvent, number> = {
  "request.created": 0, "request.activated": 1,
  "recipient.sent": 2, "recipient.delivered": 3, "recipient.viewed": 4, "recipient.signed": 5,
  "request.completed": 6, "request.declined": 6, "request.expired": 6, "request.cancelled": 6, "request.failed": 6,
};
export function eventRank(e: CanonicalSignatureEvent): number { return RANK[e]; }

const TERMINALS: ReadonlySet<CanonicalSignatureEvent> = new Set(["request.completed", "request.declined", "request.expired", "request.cancelled", "request.failed"]);
export function isTerminalEvent(e: CanonicalSignatureEvent): boolean { return TERMINALS.has(e); }

export type SignatureRequestStatus = "ready" | "submitted" | "in_progress" | "completed" | "declined" | "expired" | "cancelled" | "failed";

/** The local signature-request status implied by a canonical event (before finalization). */
export function requestStatusForEvent(e: CanonicalSignatureEvent): SignatureRequestStatus | null {
  switch (e) {
    case "request.activated": return "submitted";
    case "recipient.sent": case "recipient.delivered": case "recipient.viewed": case "recipient.signed": return "in_progress";
    case "request.completed": return "completed"; // contract becomes 'signed' only AFTER finalization
    case "request.declined": return "declined";
    case "request.expired": return "expired";
    case "request.cancelled": return "cancelled";
    case "request.failed": return "failed";
    default: return null;
  }
}

/** The contract workflow_status implied by a canonical event (terminal completion is handled by finalization). */
export function contractStatusForEvent(e: CanonicalSignatureEvent): string | null {
  switch (e) {
    case "request.activated": return "submitted";
    case "recipient.sent": case "recipient.delivered": case "recipient.viewed": case "recipient.signed": return "in_progress";
    case "request.declined": return "declined";
    case "request.expired": return "expired";
    case "request.cancelled": return "cancelled";
    case "request.failed": return "failed";
    // request.completed → contract goes to 'signed' through finalization, not directly here.
    default: return null;
  }
}

// Rank of a local request status, for monotonic comparison with incoming events.
const STATUS_RANK: Record<string, number> = { ready: 0, submitted: 1, in_progress: 3, completed: 6, declined: 6, expired: 6, cancelled: 6, failed: 6, signed: 7 };
export function statusRank(s: string): number { return STATUS_RANK[s] ?? 0; }
