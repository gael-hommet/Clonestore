// src/lib/clonestore/production/p15-monitoring-rollback.ts
// P15 §7 — Monitoring / rollback / incident. Vérifie que les chemins de logging, l'interrupteur
// d'arrêt d'urgence et les procédures de rollback existent. FAIL-CLOSED : la readiness n'est true que
// si l'owner atteste avoir vérifié le plan en ops (CLONESTORE_MONITORING_ROLLBACK_VERIFIED). Pur (lit l'env).

export type MonitoringEnv = Record<string, string | undefined>;
const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };

export interface MonitoringCheck { readonly key: string; readonly label: string; readonly structurallyPresent: boolean; readonly note: string }

/** Checks structurels (invariants de code) — présents dans le repo indépendamment de l'attestation. */
export const MONITORING_STRUCTURAL_CHECKS: readonly MonitoringCheck[] = [
  { key: "checkout_error_logging", label: "Logging des erreurs de checkout", structurallyPresent: true, note: "/api/checkout + /api/webhooks/stripe loggent les erreurs (console.error) et renvoient des statuts non-200 en cas d'échec." },
  { key: "webhook_error_logging", label: "Logging des erreurs webhook", structurallyPresent: true, note: "Webhook: 400 signature invalide, 503 DB non prête (Stripe retry), 500 erreur, jamais 200 sans vérif." },
  { key: "reconciliation_conflict_logging", label: "Logging des conflits de réconciliation pays", structurallyPresent: true, note: "Le gate de réconciliation P15 émet un audit (best-effort, error-swallowed) pour chaque conflit CH/EUR, FR/CHF, pays manquant, etc." },
  { key: "emergency_disable_switch", label: "Interrupteur d'arrêt d'urgence", structurallyPresent: true, note: "STRIPE_COUNTRY_PRICING_ENABLED=off désactive la tarification pays ; PRODUCTION_AUTHORIZED const P10 = plancher dur ; flags kill-switch existants." },
  { key: "pricing_disable_steps", label: "Procédure de désactivation pricing", structurallyPresent: true, note: "Retirer STRIPE_COUNTRY_PRICING_ENABLED → chemin legacy ; documenté dans le packet." },
  { key: "production_gate_disable", label: "Désactivation de la porte de production", structurallyPresent: true, note: "PRODUCTION_AUTHORIZED = false as const (P10) — changement de code délibéré requis pour lever." },
];

/** Checks nécessitant une VÉRIFICATION ops (attestation owner). */
export const MONITORING_OPS_CHECKS: readonly string[] = [
  "production_health_route_deployed",
  "owner_alert_path_verified",
  "webhook_disable_procedure_rehearsed",
  "rollback_steps_rehearsed",
  "incident_log_and_support_template_ready",
];

export interface MonitoringRollbackResult {
  readonly ready: boolean;                     // structurel OK + attestation owner
  readonly structuralAllPresent: boolean;
  readonly ownerVerified: boolean;             // CLONESTORE_MONITORING_ROLLBACK_VERIFIED
  readonly structuralChecks: readonly MonitoringCheck[];
  readonly opsChecksPending: string[];
  readonly blockers: string[];
  readonly note: string;
}

/**
 * Évalue le monitoring/rollback. Les checks structurels sont des invariants de code (présents).
 * La READINESS complète exige EN PLUS l'attestation owner que le plan a été répété en ops
 * (CLONESTORE_MONITORING_ROLLBACK_VERIFIED). Sans attestation → not ready (fail-closed). Pur.
 */
export function evaluateMonitoringRollback(env: MonitoringEnv = process.env): MonitoringRollbackResult {
  const structuralAllPresent = MONITORING_STRUCTURAL_CHECKS.every((c) => c.structurallyPresent);
  const ownerVerified = flagOn(env.CLONESTORE_MONITORING_ROLLBACK_VERIFIED);
  const blockers: string[] = [];
  if (!structuralAllPresent) blockers.push("Un check structurel de monitoring/rollback manque.");
  if (!ownerVerified) blockers.push("Plan monitoring/rollback NON attesté vérifié en ops (CLONESTORE_MONITORING_ROLLBACK_VERIFIED absent) — health route déployée, alerting owner, rollback répété.");
  return {
    ready: structuralAllPresent && ownerVerified,
    structuralAllPresent, ownerVerified,
    structuralChecks: MONITORING_STRUCTURAL_CHECKS,
    opsChecksPending: ownerVerified ? [] : [...MONITORING_OPS_CHECKS],
    blockers,
    note: "Readiness fail-closed : les invariants de code (logging, kill-switch, plancher P10) sont présents, mais le plan doit être vérifié en ops (health route déployée, alerting, rollback répété) et attesté par l'owner avant lancement public. Voir P15_MONITORING_ROLLBACK_PACKET.md.",
  };
}
