// src/lib/clonechat/hardening/readiness.ts
//
// Readiness Gate DÉTERMINISTE. Verdict honnête : `ready_for_b14` (toutes les garanties bloquantes
// vertes), `degraded` (seule une garantie « dégradante » manque), ou `blocked` (au moins une garantie
// bloquante manque), AVEC les raisons exactes. Il ne prétend JAMAIS « Production validée » :
// productionReadyClaim est TOUJOURS false. Le verdict signifie uniquement : prêt (ou non) pour les
// preuves finales du BLOC 14. Le mode `active` n'est autorisé QUE si le gate est intégralement vert.

import {
  CLONECHAT_HARDENING_VERSION, type HardeningConfig, type ReadinessCheck, type ReadinessReport, type ReadinessStatus,
} from "./types";

/** Propriétés (garanties) évaluées. Les booléens config-dérivés sont calculés ; les propriétés
 *  architecturales sont fournies par l'intégration (défaut sûr = true, un test peut les invalider). */
export interface ReadinessProbes {
  readonly authFailClosed: boolean;
  readonly tenantIsolation: boolean;
  readonly abortSupported: boolean;
  readonly rateLimitingPresent: boolean;
  readonly analyticsFailOpen: boolean;
  readonly secretsServerOnly: boolean;
  readonly safeFallbackPresent: boolean;
  readonly noUnintendedExternalEffect: boolean;
  /** Santé runtime (dégradante, non bloquante) : un provider en circuit ouvert → `degraded`. */
  readonly providerHealthy?: boolean;
}

export function defaultReadinessProbes(over: Partial<ReadinessProbes> = {}): ReadinessProbes {
  return {
    authFailClosed: true,
    tenantIsolation: true,
    abortSupported: true,
    rateLimitingPresent: true,
    analyticsFailOpen: true,
    secretsServerOnly: true,
    safeFallbackPresent: true,
    noUnintendedExternalEffect: true,
    providerHealthy: true,
    ...over,
  };
}

function configChecks(config: HardeningConfig): ReadinessCheck[] {
  const l = config.limits, b = config.budgets, c = config.concurrency, a = config.actions;
  const limitsPresent =
    l.maxMessageChars > 0 && l.maxHistoryMessages >= 0 && l.maxAttachments >= 0 &&
    l.maxAttachmentBytes > 0 && l.maxTotalAttachmentBytes > 0 && l.maxOutputChars > 0 && l.maxBodyBytes > 0;
  const timeoutsBounded = b.totalMs > 0 && b.providerMs > 0 && b.providerMs <= b.totalMs;
  const concurrencyGuard = c.maxConcurrent > 0 && c.maxQueue >= 0 && c.perTenantMaxConcurrent > 0 && c.perTenantMaxConcurrent <= c.maxConcurrent;
  const retryBounded = config.retry.maxRetries >= 0 && config.retry.maxRetries <= 5;
  const circuitValid = config.circuit.failureThreshold > 0 && config.circuit.cooldownMs > 0;
  const actionsGoverned = a.maxExecutableActions >= 0 && a.maxPreparedActions >= a.maxExecutableActions;
  return [
    { id: "config_version", ok: config.version === CLONECHAT_HARDENING_VERSION, severity: "blocking", reason: "config version mismatch" },
    { id: "limits_present", ok: limitsPresent, severity: "blocking", reason: "input/output limits missing or non-positive" },
    { id: "timeouts_bounded", ok: timeoutsBounded, severity: "blocking", reason: "time budgets missing or provider budget exceeds total" },
    { id: "concurrency_guard", ok: concurrencyGuard, severity: "blocking", reason: "concurrency policy invalid" },
    { id: "retry_bounded", ok: retryBounded, severity: "blocking", reason: "retry budget unbounded or too high" },
    { id: "circuit_valid", ok: circuitValid, severity: "blocking", reason: "circuit breaker policy invalid" },
    { id: "actions_governed", ok: actionsGoverned, severity: "blocking", reason: "action policy invalid" },
    { id: "confirmation_required", ok: a.requireConfirmation === true, severity: "blocking", reason: "confirmation not required for effectful actions" },
    { id: "redaction_enabled", ok: config.redactionEnabled === true, severity: "blocking", reason: "redaction disabled" },
    { id: "tenant_scope_required", ok: config.tenantScopeRequiredForPrivate === true, severity: "blocking", reason: "tenant scope not required for private context" },
  ];
}

function probeChecks(probes: ReadinessProbes): ReadinessCheck[] {
  return [
    { id: "auth_fail_closed", ok: probes.authFailClosed, severity: "blocking", reason: "auth not fail-closed" },
    { id: "tenant_isolation", ok: probes.tenantIsolation, severity: "blocking", reason: "tenant isolation not guaranteed" },
    { id: "abort_supported", ok: probes.abortSupported, severity: "blocking", reason: "cancellation/abort not supported" },
    { id: "rate_limiting_present", ok: probes.rateLimitingPresent, severity: "blocking", reason: "rate limiting absent" },
    { id: "analytics_fail_open", ok: probes.analyticsFailOpen, severity: "blocking", reason: "analytics failure can break the response" },
    { id: "secrets_server_only", ok: probes.secretsServerOnly, severity: "blocking", reason: "secrets not strictly server-only" },
    { id: "safe_fallback", ok: probes.safeFallbackPresent, severity: "blocking", reason: "no safe fallback path" },
    { id: "no_unintended_external_effect", ok: probes.noUnintendedExternalEffect, severity: "blocking", reason: "possible unintended external effect" },
    { id: "provider_healthy", ok: probes.providerHealthy !== false, severity: "degrading", reason: "a provider circuit is open (degraded)" },
  ];
}

export function evaluateReadiness(config: HardeningConfig, probes: ReadinessProbes = defaultReadinessProbes()): ReadinessReport {
  const checks = [...configChecks(config), ...probeChecks(probes)];
  const failing = checks.filter((c) => !c.ok);
  const blocked = failing.some((c) => c.severity === "blocking");
  const degraded = !blocked && failing.some((c) => c.severity === "degrading");
  const status: ReadinessStatus = blocked ? "blocked" : degraded ? "degraded" : "ready_for_b14";
  return {
    version: CLONECHAT_HARDENING_VERSION,
    status,
    checks,
    reasons: failing.map((c) => `${c.id}: ${c.reason}`),
    productionReadyClaim: false,
  };
}

/** Le mode `active` n'est ACCEPTÉ que si le readiness gate est intégralement vert (ready_for_b14). */
export function isActiveAllowed(report: ReadinessReport): boolean {
  return report.status === "ready_for_b14";
}
