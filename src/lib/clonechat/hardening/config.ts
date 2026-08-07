// src/lib/clonechat/hardening/config.ts
//
// Configuration CANONIQUE du runtime durci. Valeurs par défaut = constantes de ce module ; seuls des
// overrides SERVEUR strictement parsés (entiers finis positifs bornés) peuvent les remplacer. AUCUN
// texte utilisateur, en-tête client (hors mécanisme QA authentifié existant, hors périmètre ici) ou
// réponse provider ne peut modifier ces politiques. Mode par défaut `off` ; kill switch prioritaire.

import {
  CLONECHAT_HARDENING_VERSION, type HardeningConfig, type RuntimeMode, type ModeEffect,
  type InputLimits, type TimeBudgets, type ConcurrencyPolicy, type RetryPolicy, type CircuitPolicy, type ActionPolicy,
} from "./types";

// ── Constantes canoniques (valeurs par défaut sûres) ──────────────────────────
export const DEFAULT_LIMITS: InputLimits = Object.freeze({
  maxBodyBytes: 10 * 1024 * 1024, // borne de corps de requête (transport en ligne)
  maxMessageChars: 8_000,
  maxHistoryMessages: 40,
  maxHistoryChars: 60_000,
  maxAttachments: 4, // aligné sur la borne existante de la route
  maxAttachmentBytes: 6 * 1024 * 1024,
  maxTotalAttachmentBytes: 6 * 1024 * 1024, // ~ MAX_TOTAL_BASE64_CHARS décodé
  maxOutputChars: 24_000,
});

export const DEFAULT_BUDGETS: TimeBudgets = Object.freeze({
  totalMs: 60_000,
  providerMs: 45_000,
  transcriptionMs: 30_000,
  ttsMs: 20_000,
  inspectorMs: 15_000,
});

export const DEFAULT_CONCURRENCY: ConcurrencyPolicy = Object.freeze({
  maxConcurrent: 24,
  maxQueue: 48,
  perTenantMaxConcurrent: 6,
});

export const DEFAULT_RETRY: RetryPolicy = Object.freeze({ maxRetries: 1, baseDelayMs: 200 });

export const DEFAULT_CIRCUIT: CircuitPolicy = Object.freeze({ failureThreshold: 5, cooldownMs: 30_000, halfOpenMaxProbes: 1 });

export const DEFAULT_ACTIONS: ActionPolicy = Object.freeze({ maxPreparedActions: 8, maxExecutableActions: 1, requireConfirmation: true });

/** Fail-closed : toute valeur non reconnue vaut `off`. */
export function readRuntimeMode(env: NodeJS.ProcessEnv = process.env): RuntimeMode {
  const raw = (env.CLONECHAT_HARDENING_MODE ?? "").trim().toLowerCase();
  if (raw === "active") return "active";
  if (raw === "shadow") return "shadow";
  return "off";
}

/** Kill switch serveur PRIORITAIRE : n'importe quelle valeur « vraie » désactive le runtime durci. */
export function readKillSwitch(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.CLONECHAT_HARDENING_KILL_SWITCH ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "kill";
}

/** Parse un entier serveur borné ; retombe sur la valeur par défaut si absent/invalide (fail-safe). */
function parseBoundedInt(raw: string | undefined, def: number, min: number, max: number): number {
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return def;
  return n;
}

/**
 * Construit la configuration effective. `env` est la SEULE source d'override (serveur). En l'absence
 * d'override, tout vaut les constantes canoniques. Le résultat est gelé (immuable à l'exécution).
 */
export function resolveHardeningConfig(env: NodeJS.ProcessEnv = process.env): HardeningConfig {
  const mode = readRuntimeMode(env);
  const killSwitch = readKillSwitch(env);
  const limits: InputLimits = Object.freeze({
    ...DEFAULT_LIMITS,
    maxMessageChars: parseBoundedInt(env.CLONECHAT_HARDENING_MAX_MESSAGE_CHARS, DEFAULT_LIMITS.maxMessageChars, 1, 100_000),
    maxHistoryMessages: parseBoundedInt(env.CLONECHAT_HARDENING_MAX_HISTORY_MESSAGES, DEFAULT_LIMITS.maxHistoryMessages, 0, 500),
  });
  const budgets: TimeBudgets = Object.freeze({
    ...DEFAULT_BUDGETS,
    totalMs: parseBoundedInt(env.CLONECHAT_HARDENING_TOTAL_MS, DEFAULT_BUDGETS.totalMs, 1_000, 300_000),
    providerMs: parseBoundedInt(env.CLONECHAT_HARDENING_PROVIDER_MS, DEFAULT_BUDGETS.providerMs, 1_000, 300_000),
  });
  const concurrency: ConcurrencyPolicy = Object.freeze({
    ...DEFAULT_CONCURRENCY,
    maxConcurrent: parseBoundedInt(env.CLONECHAT_HARDENING_MAX_CONCURRENT, DEFAULT_CONCURRENCY.maxConcurrent, 1, 1_000),
    maxQueue: parseBoundedInt(env.CLONECHAT_HARDENING_MAX_QUEUE, DEFAULT_CONCURRENCY.maxQueue, 0, 10_000),
    perTenantMaxConcurrent: parseBoundedInt(env.CLONECHAT_HARDENING_PER_TENANT_MAX, DEFAULT_CONCURRENCY.perTenantMaxConcurrent, 1, 1_000),
  });
  return Object.freeze({
    version: CLONECHAT_HARDENING_VERSION,
    mode,
    killSwitch,
    limits,
    budgets,
    concurrency,
    retry: DEFAULT_RETRY,
    circuit: DEFAULT_CIRCUIT,
    actions: DEFAULT_ACTIONS,
    redactionEnabled: true,
    tenantScopeRequiredForPrivate: true,
  });
}

/** Effet du mode courant. Kill switch ⇒ passthrough (comme `off`). Effets externes JAMAIS en off/shadow. */
export function modeEffect(config: HardeningConfig): ModeEffect {
  const effectiveMode: RuntimeMode = config.killSwitch ? "off" : config.mode;
  return {
    mode: effectiveMode,
    enforce: effectiveMode === "active",
    observeOnly: effectiveMode === "shadow",
    passthrough: effectiveMode === "off",
    externalEffectsAllowed: effectiveMode === "active",
  };
}
