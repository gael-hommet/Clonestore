// src/lib/clonechat/analytics/types.ts
//
// CloneChat BLOC 12 — CloneAnalytics & Observability. Couche d'analytics / mesure de qualité /
// observabilité au-dessus du pipeline complet (Brain → Context → Diagnosis → Guide → Voice → Care →
// Actions → Visual → Inspector → Onboarding → Mission). Elle OBSERVE ; elle ne devient JAMAIS une
// autorité métier : ne modifie aucune décision/diagnostic, ne contourne pas CloneGuard, n'accorde
// aucune permission, ne change aucun tenant, ne confirme/n'exécute aucune action, ne casse jamais la
// réponse si le sink tombe, ne transforme jamais une absence de donnée en succès, ne prétend jamais
// qu'un événement a été envoyé s'il ne l'a pas été. Types PURS, versionnés, déterministes (temps,
// identifiants, hash et sink INJECTÉS). Réutilise CloneCare redaction + le hash FNV du Product Truth.

export const CLONECHAT_ANALYTICS_VERSION = "analytics-1" as const;

/** Étape réelle du pipeline (miroir strict des blocs existants). */
export type PipelineStage =
  | "request" | "brain" | "context" | "diagnosis" | "guide" | "voice" | "care"
  | "actions" | "visual" | "inspector" | "onboarding" | "mission" | "provider" | "security" | "internal";

/** Catégorie fonctionnelle. */
export type AnalyticsCategory =
  | "lifecycle" | "decision" | "resolution" | "support" | "action" | "guidance"
  | "evidence" | "onboarding" | "mission" | "reliability" | "security" | "quality";

/** Nature de l'événement : détermine la base de collecte. */
export type AnalyticsNature = "operational" | "product" | "security" | "quality";

/** Base de collecte : operational/security = strictement nécessaire ; product = consentement requis. */
export type CollectionBasis = "operational" | "product";

/** Niveau de sensibilité de l'événement (jamais de contenu brut, quel que soit le niveau). */
export type SensitivityLevel = "none" | "low" | "pseudonymous";

/** Politique d'échantillonnage. */
export type SamplingPolicy = { readonly kind: "always" } | { readonly kind: "rate"; readonly rate: number };

/** Stratégie de déduplication. */
export type DedupStrategy = "none" | "per_correlation" | "per_dedup_key";

/**
 * Résultat SÛR d'un événement. Volontairement RESTREINT : aucun "running"/"paid"/"charged" n'est
 * représentable. "executed" n'est autorisé QUE pour action.executed avec preuve observable (voir
 * registre). Les événements mission n'autorisent jamais executed/succeeded/completed.
 */
export type AnalyticsResult =
  | "ok" | "incomplete" | "needs_clarification" | "needs_information" | "needs_confirmation"
  | "blocked" | "refused" | "failed" | "fallback" | "not_found" | "stale" | "cancelled" | "duplicate"
  | "escalated" | "prepared" | "unavailable" | "started" | "resumed" | "interrupted" | "abandoned"
  | "expired" | "ready" | "completed" | "partial" | "executed";

/** Résultats TOUJOURS interdits, quel que soit l'événement (barrière anti-faux-succès). */
export const FORBIDDEN_RESULTS: ReadonlySet<string> = new Set(["running", "paid", "charged", "settled", "success"]);

/** Consentement appliqué à une émission. */
export type ConsentMode = "operational_only" | "product_enabled";

/** Statut HONNÊTE d'une émission (jamais un faux succès d'envoi). */
export type EmitStatus =
  | "accepted" // remis à un sink CAPABLE qui a confirmé la livraison COMPLÈTE
  | "buffered" // validé et mis en file (mode manuel), PAS encore livré
  | "partial" // le sink a confirmé une livraison PARTIELLE (jamais présenté comme complète)
  | "duplicate" // déjà vu (dédup)
  | "sampled_out" // écarté par l'échantillonnage
  | "disabled" // non collecté : pas de consentement produit OU aucun sink capable (no-op)
  | "rejected" // invalide / version inconnue / champ interdit / résultat impossible / backpressure
  | "failed"; // sink en échec (rien livré ; jamais présenté comme accepted)

export interface EmitResult {
  readonly status: EmitStatus;
  readonly eventName: string;
  readonly eventId: string | null; // null si rejeté avant construction
  readonly reason: string | null; // code sûr expliquant rejected/failed/sampled_out/disabled/duplicate
  readonly correlationId: string | null;
  /**
   * Comptes de livraison HONNÊTES. Jamais des nombres impossibles ; jamais une prétention de livraison
   * sans livraison réelle. En mode immédiat (un seul événement envoyé) :
   *   - accepted ⇒ delivered === 1 et failed === 0 ;
   *   - failed   ⇒ delivered === 0 et failed === 1 (un lot d'UN événement ne peut jamais être partiel :
   *                un « partial » annoncé par un sink y est normalisé en failed) ;
   *   - partial  ⇒ vraie livraison partielle, 0 < delivered, 0 < failed, delivered + failed === taille du lot
   *                (jamais atteignable pour un lot d'un seul événement).
   * La livraison N'EST PAS tentée pour buffered / disabled / sampled_out / duplicate / rejected :
   * delivered et failed valent alors null (aucune livraison ⇒ aucun compte de livraison inventé).
   */
  readonly delivered: number | null;
  readonly failed: number | null;
}

/** Valeur de métadonnée AUTORISÉE : primitive uniquement (jamais un objet/array du pipeline). */
export type MetaValue = string | number | boolean | null;

/** Spécification canonique d'un type d'événement. */
export interface AnalyticsEventSpec {
  readonly name: string;
  readonly version: typeof CLONECHAT_ANALYTICS_VERSION;
  readonly category: AnalyticsCategory;
  readonly stage: PipelineStage;
  readonly nature: AnalyticsNature;
  readonly basis: CollectionBasis; // operational (nécessaire) vs product (consentement)
  readonly sensitivity: SensitivityLevel;
  readonly requiredMeta: readonly string[]; // clés de meta obligatoires
  readonly allowedMeta: readonly string[]; // ALLOWLIST stricte des clés de meta (hors requises)
  readonly allowedResults: readonly AnalyticsResult[]; // résultats possibles ; tout autre = rejeté
  readonly sampling: SamplingPolicy;
  readonly dedup: DedupStrategy;
  readonly retentionDays: number | null; // durée de conservation LOGIQUE si connue
  readonly provenance: string; // origine réelle dans le repo
  readonly metricsFed: readonly string[]; // métriques alimentées par cet événement
  /** Preuve observable OBLIGATOIRE (ex. action.executed) : `meta.observable === true` requis. */
  readonly requiresObservableProof?: boolean;
}

/** Enveloppe d'événement additive, versionnée, strictement validée, SANS contenu brut. */
export interface AnalyticsEnvelope {
  readonly eventId: string; // opaque, déterministe
  readonly eventName: string;
  readonly version: typeof CLONECHAT_ANALYTICS_VERSION;
  readonly category: AnalyticsCategory;
  readonly stage: PipelineStage;
  readonly nature: AnalyticsNature;
  readonly occurredAtMs: number; // temps INJECTÉ
  readonly at: string; // ISO dérivé (déterministe)
  readonly correlationId: string; // trace/corrélation bout-en-bout
  readonly requestId: string | null;
  readonly sessionId: string | null; // opaque si présent
  readonly route: string | null; // route RÉELLE (registre) ou null — jamais inventée
  readonly surface: string; // surface logique (clonechat/onboarding/mission/voice/…)
  readonly environment: string;
  readonly result: AnalyticsResult;
  readonly durationMs: number | null;
  readonly attempt: number | null;
  readonly provider: string | null; // seulement si réellement connu
  readonly model: string | null; // seulement si réellement connu
  readonly errorCode: string | null; // code SÛR
  readonly viewerPseudo: string | null; // pseudonymisé, tenant-scopé (jamais un userId brut)
  readonly tenantPseudo: string | null; // pseudonymisé (jamais un companyId brut)
  readonly consent: ConsentMode; // base de collecte appliquée
  readonly dedupKey: string;
  readonly meta: Readonly<Record<string, MetaValue>>; // allowlist stricte, primitives uniquement
}

/** Résultat de validation d'enveloppe. */
export type ValidatedEnvelope =
  | { readonly ok: true; readonly envelope: AnalyticsEnvelope; readonly dedupKey: string }
  | { readonly ok: false; readonly reason: string };

// ── Sinks ───────────────────────────────────────────────────────────────────
export type SinkDeliveryStatus = "ok" | "partial" | "failed" | "timeout";
export interface SinkDeliveryResult {
  readonly status: SinkDeliveryStatus;
  readonly delivered: number;
  readonly failed: number;
}
/**
 * Sink abstrait et injectable. Ne DOIT jamais lever : renvoie un résultat honnête.
 * `capable` = le sink peut réellement CONSERVER ou TRANSMETTRE un événement. Un sink `capable:false`
 * (no-op) n'a aucune destination : le collecteur ne présente alors JAMAIS un événement comme livré
 * (statut `disabled`, raison `sink_noop`).
 */
export interface AnalyticsSink {
  readonly id: string;
  readonly capable: boolean;
  deliver(batch: readonly AnalyticsEnvelope[]): SinkDeliveryResult;
}

// ── Agrégation (read-only) ────────────────────────────────────────────────────
export interface LatencyStat {
  readonly count: number;
  readonly minMs: number | null;
  readonly maxMs: number | null;
  readonly avgMs: number | null;
}
export interface AggregateSnapshot {
  readonly version: typeof CLONECHAT_ANALYTICS_VERSION;
  readonly tenantScope: string | null; // pseudonyme du tenant filtré, ou null = tous (jamais un id brut)
  readonly totalEvents: number;
  readonly requests: number;
  readonly byEvent: Readonly<Record<string, number>>;
  readonly byBrainMode: Readonly<Record<string, number>>;
  readonly byDiagnosis: Readonly<Record<string, number>>;
  readonly byGuideStatus: Readonly<Record<string, number>>;
  readonly byCareStatus: Readonly<Record<string, number>>;
  readonly byActionState: Readonly<Record<string, number>>;
  readonly byGuardDecision: Readonly<Record<string, number>>;
  readonly byVisualState: Readonly<Record<string, number>>;
  readonly byInspectionStatus: Readonly<Record<string, number>>;
  readonly byOnboardingStatus: Readonly<Record<string, number>>;
  readonly byMissionStatus: Readonly<Record<string, number>>;
  readonly byErrorCode: Readonly<Record<string, number>>;
  readonly routesUsed: Readonly<Record<string, number>>;
  readonly latencyByStage: Readonly<Record<string, LatencyStat>>;
  readonly incompleteContextRate: number | null;
  readonly clarificationRate: number | null;
  readonly fallbackRate: number | null;
  readonly securityRefusals: number;
  readonly providerFailures: number;
  readonly confirmations: { readonly requested: number; readonly received: number; readonly expired: number; readonly invalid: number };
  readonly onboardingResumes: number;
  readonly onboardingAbandons: number;
}
export interface HealthSnapshot {
  readonly version: typeof CLONECHAT_ANALYTICS_VERSION;
  readonly pipelineAvailable: boolean;
  readonly providerAvailable: boolean;
  readonly errorRate: number | null;
  readonly avgLatencyMs: number | null;
  readonly bufferSaturation: number; // 0..1
  readonly rejectedEvents: number;
  readonly deduplicatedEvents: number;
  readonly failedDeliveries: number;
  readonly productAnalyticsDisabled: boolean; // désactivée faute de consentement
}
