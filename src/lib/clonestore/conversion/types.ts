// BLOC 3 — Types partagés conversion.

import type { CohortId, ContactKind, EventId, VariantId } from "./contract";

// ── Token d'attribution opaque (LeadForge) ──────────────────────────────────
export interface AttributionTokenParts {
  readonly tokenId: string;     // 16 hex bytes
  readonly signature: string;   // 32 hex bytes (HMAC-SHA256 truncated)
  readonly keyVersion: number;  // 1-byte version
}

export interface AttributionGrant {
  readonly id: string;
  readonly tokenId: string;
  readonly tokenFingerprint: string;
  readonly keyVersion: number;
  readonly leadforgeProspectId: string | null;
  readonly campaign: string;
  readonly cohort: CohortId;
  readonly variant: VariantId;
  readonly contactKind: ContactKind;
  readonly segment: string | null;
  readonly emailTier: string | null;
  readonly funnelVersion: string;
  readonly status: "active" | "expired" | "revoked";
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly lastResolvedAt: string | null;
}

// ── Conversion session (server-only, identifiée par cookie signé) ───────────
export interface ConversionSession {
  readonly id: string;          // UUID v4
  readonly grantId: string | null;
  readonly variant: VariantId | "VARIANT_ORGANIC";
  readonly campaign: string | null;
  readonly cohort: CohortId | null;
  readonly contactKind: ContactKind | null;
  readonly funnelVersion: string;
  readonly stage: ConversionStage;
  readonly userId: string | null;
  readonly tenantId: string | null;
  readonly orderId: string | null;
  readonly diagnosticDraftKey: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

export type ConversionStage =
  | "landed"
  | "demo_seen"
  | "diagnostic_in_progress"
  | "diagnostic_completed"
  | "checkout_pending"
  | "checkout_completed"
  | "onboarding"
  | "activated"
  | "expired";

// ── Événement conversion (event ledger) ─────────────────────────────────────
export interface ConversionEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly eventId: EventId;
  readonly idempotencyKey: string;
  readonly serverTimestamp: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
  readonly variant: VariantId | "VARIANT_ORGANIC";
}

// ── Diagnostic ──────────────────────────────────────────────────────────────
export interface DiagnosticDraft {
  readonly version: string;
  readonly answers: Readonly<Record<string, string | number | readonly string[] | null>>;
  readonly hourlyCostHypothesis?: number | null; // saisie utilisateur uniquement
}

export interface DiagnosticResult {
  readonly version: string;
  readonly compatibilityLevel: "high" | "partial" | "limited";
  readonly compatibilityReasonCodes: readonly string[];
  readonly suggestedMissions: readonly string[];
  readonly humanControls: readonly string[];
  readonly estimatedSavedHoursPerMonth: { low: number; central: number; high: number } | null;
  readonly estimatedFinancialRangeEur: { low: number; central: number; high: number } | null;
  readonly hypotheses: readonly string[];
  readonly limitations: readonly string[];
}

// ── Erreurs typées ──────────────────────────────────────────────────────────
export class ConversionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ConversionError";
    this.code = code;
  }
}
