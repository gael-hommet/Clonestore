// src/lib/clonechat/hardening/readiness.ts
//
// Readiness Gate DÉTERMINISTE et FAIL-CLOSED. Chaque garantie requise doit être PROUVÉE par une
// evidence explicite (`proven`). Toute garantie sans evidence (→ `unknown`) ou `failed` ⇒ `blocked`.
// AUCUN booléen architectural n'est vrai par défaut : sans evidence injectée, active est BLOQUÉ.
// `provider_healthy` est la seule garantie « dégradante » (unhealthy → `degraded`, active refusé).
// `productionReadyClaim` est TOUJOURS false : le verdict signifie au mieux « prêt pour le BLOC 14 ».

import {
  CLONECHAT_HARDENING_VERSION, type HardeningConfig, type ReadinessCheck, type ReadinessReport, type ReadinessStatus,
} from "./types";
import type { ConfigDiagnostic } from "./config";

export type EvidenceState = "proven" | "unknown" | "failed";

export interface ReadinessEvidence {
  readonly id: string;
  readonly state: EvidenceState;
  readonly source: string; // d'où vient la preuve (module/route/test), jamais une constante anonyme
  readonly version: string;
  readonly reason: string;
}

/** Garanties BLOQUANTES requises pour `ready_for_b14`. */
export const REQUIRED_GUARANTEES = [
  "config_valid", "auth_fail_closed", "tenant_isolation", "redaction", "timeout_total", "abort",
  "rate_limiting", "concurrency_backpressure", "provider_policy", "actions_governed", "confirmation",
  "analytics_fail_open", "secrets_server_only", "safe_fallback", "no_unintended_external_effect",
] as const;
export type RequiredGuarantee = (typeof REQUIRED_GUARANTEES)[number];
/** Garantie DÉGRADANTE (non bloquante). */
export const DEGRADING_GUARANTEE = "provider_healthy" as const;

/** Faits de capacité RÉELS de la route/runtime → evidence. Chaque fait est falsifiable (un test peut
 *  fournir false → failed, ou l'omettre → unknown). Aucune valeur n'est true par défaut. */
export type ReadinessFacts = Partial<Record<RequiredGuarantee | typeof DEGRADING_GUARANTEE, boolean>>;

/**
 * Construit les evidences à partir de faits explicites. Un fait `true` → `proven`, `false` → `failed`,
 * ABSENT → `unknown`. `source`/`version` tracent l'origine (jamais une constante non falsifiable).
 */
export function buildReadinessEvidence(facts: ReadinessFacts, source: string, version = CLONECHAT_HARDENING_VERSION): ReadinessEvidence[] {
  const ids = [...REQUIRED_GUARANTEES, DEGRADING_GUARANTEE];
  return ids.map((id) => {
    const fact = facts[id];
    const state: EvidenceState = fact === true ? "proven" : fact === false ? "failed" : "unknown";
    return { id, state, source, version, reason: state === "proven" ? "capability wired & tested" : state === "failed" ? "capability asserted broken" : "no evidence provided" };
  });
}

/**
 * Évalue le readiness. `configResolution` (si fourni) prouve/failli `config_valid` depuis les
 * diagnostics serveur réels. Le reste vient des evidences. Sans evidence → blocked (fail-closed).
 */
export function evaluateReadiness(
  config: HardeningConfig,
  evidence: readonly ReadinessEvidence[] = [],
  configResolution?: { valid: boolean; diagnostics: readonly ConfigDiagnostic[] },
): ReadinessReport {
  const byId = new Map<string, ReadinessEvidence>();
  for (const e of evidence) byId.set(e.id, e);

  // config_valid dérivé des diagnostics serveur réels quand disponible (falsifiable via env).
  const configSane = config.version === CLONECHAT_HARDENING_VERSION
    && config.budgets.totalMs > 0 && config.budgets.providerMs > 0 && config.budgets.providerMs <= config.budgets.totalMs
    && config.limits.maxMessageChars > 0 && config.limits.maxOutputChars > 0
    && config.concurrency.maxConcurrent > 0 && config.concurrency.perTenantMaxConcurrent <= config.concurrency.maxConcurrent
    && config.actions.requireConfirmation === true && config.redactionEnabled === true && config.tenantScopeRequiredForPrivate === true;
  const configValidState: EvidenceState = configResolution
    ? (configResolution.valid && configSane ? "proven" : "failed")
    : (byId.get("config_valid")?.state ?? "unknown");

  const checks: ReadinessCheck[] = [];
  for (const id of REQUIRED_GUARANTEES) {
    const state: EvidenceState = id === "config_valid" ? configValidState : (byId.get(id)?.state ?? "unknown");
    const reason = id === "config_valid" && configResolution && !configResolution.valid
      ? `config invalide: ${configResolution.diagnostics.map((d) => d.key).join(", ") || "sanity"}`
      : (byId.get(id)?.reason ?? "no evidence provided");
    checks.push({ id, ok: state === "proven", severity: "blocking", reason: `${state}: ${reason}` });
  }
  const ph = byId.get(DEGRADING_GUARANTEE)?.state ?? "unknown";
  checks.push({ id: DEGRADING_GUARANTEE, ok: ph === "proven", severity: "degrading", reason: `${ph}: provider health` });

  const failingBlocking = checks.filter((c) => c.severity === "blocking" && !c.ok);
  const failingDegrading = checks.filter((c) => c.severity === "degrading" && !c.ok);
  const status: ReadinessStatus = failingBlocking.length ? "blocked" : failingDegrading.length ? "degraded" : "ready_for_b14";
  return {
    version: CLONECHAT_HARDENING_VERSION,
    status,
    checks,
    reasons: [...failingBlocking, ...failingDegrading].map((c) => `${c.id}: ${c.reason}`),
    productionReadyClaim: false,
  };
}

/** `active` autorisé UNIQUEMENT si intégralement vert. */
export function isActiveAllowed(report: ReadinessReport): boolean {
  return report.status === "ready_for_b14";
}
