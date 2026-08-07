// src/lib/clonechat/hardening/types.ts
//
// CloneChat BLOC 13 — Production Hardening. Contrat TYPÉ et VERSIONNÉ de la politique de runtime
// (fail-closed, borné, observable) au-dessus du pipeline BLOC 0→12 (Product Truth → Brain →
// CloneContext → Diagnosis → CloneGuide → CloneVoice → CloneCare → CloneActions/CloneGuard → Visual →
// CloneInspector → Onboarding → Mission → CloneAnalytics). Aucune valeur n'est jamais dérivée d'un
// texte utilisateur ou d'une réponse provider : toutes viennent de constantes canoniques ou d'une
// configuration serveur STRICTEMENT parsée. Ce module N'AUTORISE rien de nouveau en Production : le
// mode par défaut est `off` (comportement historique inchangé), et il ne déclare JAMAIS
// « production ready » — au mieux « prêt pour les preuves finales du BLOC 14 ».

export const CLONECHAT_HARDENING_VERSION = "hardening-1" as const;

/**
 * Mode de runtime durci. Fail-closed : toute valeur non reconnue vaut `off`.
 *   off    — aucun comportement BLOC 13 ne change la réponse servie (défaut, y compris en Production).
 *   shadow — observation/read-only strictement sûre : aucune action externe, aucune mutation, aucune
 *            création de mission, aucune confirmation implicite, aucun résultat shadow substitué à la
 *            réponse utilisateur.
 *   active — enforcement complet ; n'est accepté QUE si le readiness gate déterministe est vert, et
 *            n'est JAMAIS activé en Production pendant le BLOC 13.
 */
export type RuntimeMode = "off" | "shadow" | "active";

/** Taxonomie d'erreurs SÛRE et stable (aucune fuite ; codes HTTP cohérents). */
export type HardeningErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "tenant_required"
  | "forbidden"
  | "payload_too_large"
  | "message_too_long"
  | "history_too_long"
  | "too_many_attachments"
  | "attachment_too_large"
  | "output_too_large"
  | "rate_limited"
  | "concurrency_limited"
  | "timeout"
  | "provider_unavailable"
  | "circuit_open"
  | "cancelled"
  | "dependency_failure"
  | "config_invalid"
  | "runtime_disabled"
  | "internal_safe_error";

export interface InputLimits {
  readonly maxBodyBytes: number;
  readonly maxMessageChars: number;
  readonly maxHistoryMessages: number;
  readonly maxHistoryChars: number;
  readonly maxAttachments: number;
  readonly maxAttachmentBytes: number;
  readonly maxTotalAttachmentBytes: number;
  readonly maxOutputChars: number;
}

export interface TimeBudgets {
  readonly totalMs: number;
  readonly providerMs: number;
  readonly transcriptionMs: number;
  readonly ttsMs: number;
  readonly inspectorMs: number;
}

export interface ConcurrencyPolicy {
  readonly maxConcurrent: number;
  readonly maxQueue: number;
  readonly perTenantMaxConcurrent: number;
}

export interface RetryPolicy {
  readonly maxRetries: number; // borne DURE ; jamais infini
  readonly baseDelayMs: number;
}

export interface CircuitPolicy {
  readonly failureThreshold: number; // échecs consécutifs avant ouverture
  readonly cooldownMs: number; // durée avant passage en half-open
  readonly halfOpenMaxProbes: number; // sondes autorisées en half-open
}

export interface ActionPolicy {
  readonly maxPreparedActions: number;
  readonly maxExecutableActions: number;
  readonly requireConfirmation: boolean; // une action à effet exige TOUJOURS une confirmation liée
}

export interface HardeningConfig {
  readonly version: typeof CLONECHAT_HARDENING_VERSION;
  readonly mode: RuntimeMode;
  readonly killSwitch: boolean; // prioritaire : true ⇒ runtime durci désactivé (comportement `off`)
  readonly limits: InputLimits;
  readonly budgets: TimeBudgets;
  readonly concurrency: ConcurrencyPolicy;
  readonly retry: RetryPolicy;
  readonly circuit: CircuitPolicy;
  readonly actions: ActionPolicy;
  readonly redactionEnabled: boolean;
  readonly tenantScopeRequiredForPrivate: boolean;
}

/** Résultat d'erreur SÛR renvoyable au client : jamais de stack/secret/SQL/chemin/prompt/tenant. */
export interface SafeError {
  readonly ok: false;
  readonly code: HardeningErrorCode;
  readonly httpStatus: number;
  readonly message: string; // message générique, stable, non sensible
  readonly correlationId: string | null; // opaque/pseudonymisé, jamais un id brut
}

/** Effet du mode courant : est-ce que l'enforcement/les effets externes sont permis ? */
export interface ModeEffect {
  readonly mode: RuntimeMode;
  readonly enforce: boolean; // active uniquement
  readonly observeOnly: boolean; // shadow uniquement
  readonly passthrough: boolean; // off (ou kill switch) : ne change rien
  readonly externalEffectsAllowed: boolean; // jamais en off/shadow
}

// ── Readiness ────────────────────────────────────────────────────────────────
export type ReadinessStatus = "ready_for_b14" | "degraded" | "blocked";

export interface ReadinessCheck {
  readonly id: string;
  readonly ok: boolean;
  readonly severity: "blocking" | "degrading";
  readonly reason: string; // exact, non sensible
}

export interface ReadinessReport {
  readonly version: typeof CLONECHAT_HARDENING_VERSION;
  readonly status: ReadinessStatus;
  readonly checks: readonly ReadinessCheck[];
  readonly reasons: readonly string[]; // raisons des checks non-ok
  /** Jamais `true` : le BLOC 13 ne prétend pas la Production validée. Verdict = prêt (ou non) pour B14. */
  readonly productionReadyClaim: false;
}

// ── Circuit breaker ────────────────────────────────────────────────────────────
export type CircuitState = "closed" | "open" | "half_open";
