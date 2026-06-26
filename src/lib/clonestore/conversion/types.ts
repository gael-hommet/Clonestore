// BLOC 3 — Types partagés conversion (alignés LeadForge db9b166).
import type { ContactKind, EventType, VariantId } from "./contract";

// ── Attribution grant (cf. attribution_links table dans LeadForge storage) ──
export interface AttributionGrant {
  readonly id: string;                  // "grant_" + fingerprint[:16]
  readonly tokenId: string;             // 40 hex
  readonly tokenFingerprint: string;    // sha256(token_id) — 64 hex
  readonly keyVersion: string;          // LeadForge "a1"
  readonly prospectId: string;          // lf_XXXX (jamais l'email)
  readonly siren: string | null;        // server-only, jamais exposé en URL
  readonly campaignId: string;
  readonly cohort: string;              // V0-A..D
  readonly variant: VariantId;
  readonly contactKind: ContactKind;
  readonly segment: string | null;
  readonly emailTier: string | null;
  readonly funnelVersion: string;
  readonly status: "ACTIVE" | "EXPIRED" | "REVOKED";
  readonly createdAt: string;           // ISO UTC
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly lastVisitAt: string | null;
}

// ── Conversion session (CloneStore-only, identifiée par cookie signé) ──────
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

export interface ConversionSession {
  readonly id: string;                  // UUID v4
  readonly grantId: string | null;
  readonly variant: VariantId | "VARIANT_ORGANIC";
  readonly campaign: string | null;
  readonly cohort: string | null;
  readonly contactKind: ContactKind | null;
  readonly funnelVersion: string;
  readonly stage: ConversionStage;
  readonly userId: string | null;
  readonly tenantId: string | null;
  readonly orderId: string | null;
  readonly diagnosticDraftKey: string | null;
  readonly correlationId: string;       // pour réconciliation cross-repo
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

// ── Conversion event (cf. events.py) ───────────────────────────────────────
export interface ConversionEvent {
  readonly eventId: string;             // uuid hex
  readonly idempotencyKey: string;
  readonly eventType: EventType;
  readonly serverTimestamp: string;     // ISO UTC
  readonly prospectToken: string;       // token_id ONLY (jamais le bearer)
  readonly sessionId: string;
  readonly campaign: string;
  readonly cohort: string;
  readonly variant: string;
  readonly funnelVersion: string;
  readonly sourcePage: string;
  readonly correlationId: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

// ── Diagnostic ──────────────────────────────────────────────────────────────
export interface DiagnosticAnswers {
  readonly headcount?: number;
  readonly hr_team_size?: number;
  readonly monthly_hires?: number;
  readonly monthly_on_offboardings?: number;
  readonly monthly_docs_emails_ops?: number;
  readonly current_tools?: string;
  readonly autonomy_level?: "low" | "medium" | "high";
  readonly validation_required?: boolean;
}

export interface DiagnosticAssumptions {
  readonly minutes_per_operation: number;
  readonly automatable_share_low: number;
  readonly automatable_share_central: number;
  readonly automatable_share_high: number;
  readonly ops_per_hire: number;
  readonly ops_per_on_offboarding: number;
}

export interface DiagnosticBand {
  readonly automatable_ops_month: number;
  readonly operational_hours_month: number;
}

export interface DiagnosticResult {
  readonly operational_load: {
    readonly declared_ops_month: number;
    readonly derived_ops_month: number;
    readonly base_ops_month: number;
    readonly hr_team_size: number;
  };
  readonly recommended_missions: readonly string[];
  readonly priorities: readonly string[];
  readonly compatibility: "low" | "medium" | "high";
  readonly compatibility_score: number;
  readonly actions_requiring_validation: readonly string[];
  readonly volume_estimate: {
    readonly low: DiagnosticBand;
    readonly central: DiagnosticBand;
    readonly high: DiagnosticBand;
  };
  readonly assumptions: DiagnosticAssumptions;
  readonly formulas: Readonly<Record<string, string>>;
  readonly limits: readonly string[];
  readonly price_comparison: { readonly pierre_eur_month: number };
  readonly next_steps: readonly string[];
  readonly financial_saving: null | {
    readonly basis: "user_supplied_hourly_cost";
    readonly hourly_cost_eur: number;
    readonly central_monthly_saving_eur: number;
    readonly vs_pierre_eur_month: number;
    readonly note: string;
  };
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
