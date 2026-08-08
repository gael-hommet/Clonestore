// src/lib/clonechat/hardening/config.ts
//
// Configuration CANONIQUE du runtime durci, AVEC DIAGNOSTICS. Valeurs par défaut = constantes de ce
// module. Règle stricte : une variable serveur ABSENTE utilise le défaut canonique (OK, sans
// diagnostic) ; une variable PRÉSENTE MAIS INVALIDE (NaN, non entier, hors borne, mode/kill switch
// inconnu) produit un diagnostic BLOQUANT — le runtime ne prétend jamais qu'une config explicitement
// invalide est valide. Mode inconnu → `off` effectif (fail-safe) + diagnostic. AUCUN texte utilisateur
// ni réponse provider ne modifie ces politiques (source = env serveur uniquement).

import {
  CLONECHAT_HARDENING_VERSION, type HardeningConfig, type RuntimeMode, type ModeEffect,
  type InputLimits, type TimeBudgets, type ConcurrencyPolicy, type RetryPolicy, type CircuitPolicy, type ActionPolicy,
} from "./types";

// ── Constantes canoniques (valeurs par défaut sûres) ──────────────────────────
export const DEFAULT_LIMITS: InputLimits = Object.freeze({
  maxBodyBytes: 10 * 1024 * 1024,
  maxMessageChars: 8_000,
  maxHistoryMessages: 40,
  maxHistoryChars: 60_000,
  maxAttachments: 4,
  maxAttachmentBytes: 6 * 1024 * 1024,
  maxTotalAttachmentBytes: 6 * 1024 * 1024,
  maxOutputChars: 24_000,
});
export const DEFAULT_BUDGETS: TimeBudgets = Object.freeze({ totalMs: 60_000, providerMs: 45_000, transcriptionMs: 30_000, ttsMs: 20_000, inspectorMs: 15_000 });
export const DEFAULT_CONCURRENCY: ConcurrencyPolicy = Object.freeze({ maxConcurrent: 24, maxQueue: 48, perTenantMaxConcurrent: 6 });
export const DEFAULT_RETRY: RetryPolicy = Object.freeze({ maxRetries: 1, baseDelayMs: 200 });
export const DEFAULT_CIRCUIT: CircuitPolicy = Object.freeze({ failureThreshold: 5, cooldownMs: 30_000, halfOpenMaxProbes: 1 });
export const DEFAULT_ACTIONS: ActionPolicy = Object.freeze({ maxPreparedActions: 8, maxExecutableActions: 1, requireConfirmation: true });

export interface ConfigDiagnostic { readonly key: string; readonly severity: "blocking"; readonly reason: string; }
export interface ResolvedHardeningConfig { readonly config: HardeningConfig; readonly valid: boolean; readonly diagnostics: readonly ConfigDiagnostic[]; }

/** Lit le mode. Fail-safe : inconnu → off. Un mode présent mais inconnu émet un diagnostic. */
export function readRuntimeMode(env: NodeJS.ProcessEnv = process.env): RuntimeMode {
  const raw = (env.CLONECHAT_HARDENING_MODE ?? "").trim().toLowerCase();
  if (raw === "active") return "active";
  if (raw === "shadow") return "shadow";
  return "off";
}
export function readKillSwitch(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.CLONECHAT_HARDENING_KILL_SWITCH ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "kill";
}

function parseIntField(raw: string | undefined, key: string, def: number, min: number, max: number, diags: ConfigDiagnostic[]): number {
  if (raw === undefined || raw.trim() === "") return def; // ABSENT → défaut canonique (pas de diagnostic)
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    diags.push({ key, severity: "blocking", reason: `valeur invalide (attendu entier dans [${min},${max}])` });
    return def; // fail-safe pour l'exécution, mais la config est marquée invalide
  }
  return n;
}

/**
 * Résout la config effective AVEC diagnostics. `valid` est false dès qu'une variable explicitement
 * présente est invalide. Le `config` renvoyé reste utilisable (fail-safe) mais readiness/active doivent
 * le refuser tant que `valid` est false.
 */
export function resolveHardeningConfig(env: NodeJS.ProcessEnv = process.env): ResolvedHardeningConfig {
  const diagnostics: ConfigDiagnostic[] = [];

  const modeRaw = (env.CLONECHAT_HARDENING_MODE ?? "").trim().toLowerCase();
  let mode: RuntimeMode = "off";
  if (modeRaw === "active") mode = "active";
  else if (modeRaw === "shadow") mode = "shadow";
  else if (modeRaw === "off" || modeRaw === "") mode = "off";
  else { diagnostics.push({ key: "CLONECHAT_HARDENING_MODE", severity: "blocking", reason: `mode inconnu "${modeRaw}" → off forcé (fail-safe)` }); mode = "off"; }

  const ksRaw = (env.CLONECHAT_HARDENING_KILL_SWITCH ?? "").trim().toLowerCase();
  let killSwitch = false;
  if (ksRaw === "" ) killSwitch = false;
  else if (["1", "true", "on", "kill"].includes(ksRaw)) killSwitch = true;
  else if (["0", "false", "off"].includes(ksRaw)) killSwitch = false;
  else { diagnostics.push({ key: "CLONECHAT_HARDENING_KILL_SWITCH", severity: "blocking", reason: `valeur invalide "${ksRaw}"` }); killSwitch = false; }

  const limits: InputLimits = Object.freeze({
    ...DEFAULT_LIMITS,
    maxMessageChars: parseIntField(env.CLONECHAT_HARDENING_MAX_MESSAGE_CHARS, "CLONECHAT_HARDENING_MAX_MESSAGE_CHARS", DEFAULT_LIMITS.maxMessageChars, 1, 100_000, diagnostics),
    maxHistoryMessages: parseIntField(env.CLONECHAT_HARDENING_MAX_HISTORY_MESSAGES, "CLONECHAT_HARDENING_MAX_HISTORY_MESSAGES", DEFAULT_LIMITS.maxHistoryMessages, 0, 500, diagnostics),
    maxBodyBytes: parseIntField(env.CLONECHAT_HARDENING_MAX_BODY_BYTES, "CLONECHAT_HARDENING_MAX_BODY_BYTES", DEFAULT_LIMITS.maxBodyBytes, 1024, 64 * 1024 * 1024, diagnostics),
  });
  const budgets: TimeBudgets = Object.freeze({
    ...DEFAULT_BUDGETS,
    totalMs: parseIntField(env.CLONECHAT_HARDENING_TOTAL_MS, "CLONECHAT_HARDENING_TOTAL_MS", DEFAULT_BUDGETS.totalMs, 1_000, 300_000, diagnostics),
    providerMs: parseIntField(env.CLONECHAT_HARDENING_PROVIDER_MS, "CLONECHAT_HARDENING_PROVIDER_MS", DEFAULT_BUDGETS.providerMs, 1_000, 300_000, diagnostics),
  });
  const concurrency: ConcurrencyPolicy = Object.freeze({
    ...DEFAULT_CONCURRENCY,
    maxConcurrent: parseIntField(env.CLONECHAT_HARDENING_MAX_CONCURRENT, "CLONECHAT_HARDENING_MAX_CONCURRENT", DEFAULT_CONCURRENCY.maxConcurrent, 1, 1_000, diagnostics),
    maxQueue: parseIntField(env.CLONECHAT_HARDENING_MAX_QUEUE, "CLONECHAT_HARDENING_MAX_QUEUE", DEFAULT_CONCURRENCY.maxQueue, 0, 10_000, diagnostics),
    perTenantMaxConcurrent: parseIntField(env.CLONECHAT_HARDENING_PER_TENANT_MAX, "CLONECHAT_HARDENING_PER_TENANT_MAX", DEFAULT_CONCURRENCY.perTenantMaxConcurrent, 1, 1_000, diagnostics),
  });
  // Cohérence dérivée : provider budget ne peut dépasser le total.
  if (budgets.providerMs > budgets.totalMs) diagnostics.push({ key: "CLONECHAT_HARDENING_PROVIDER_MS", severity: "blocking", reason: "provider budget > total budget" });

  const config: HardeningConfig = Object.freeze({
    version: CLONECHAT_HARDENING_VERSION, mode, killSwitch, limits, budgets, concurrency,
    retry: DEFAULT_RETRY, circuit: DEFAULT_CIRCUIT, actions: DEFAULT_ACTIONS,
    redactionEnabled: true, tenantScopeRequiredForPrivate: true,
  });
  return { config, valid: diagnostics.length === 0, diagnostics };
}

/** Raccourci : la config seule (fail-safe), quand les diagnostics ne sont pas nécessaires. */
export function hardeningConfig(env: NodeJS.ProcessEnv = process.env): HardeningConfig {
  return resolveHardeningConfig(env).config;
}

/** Effet du mode courant. Kill switch ⇒ passthrough (comme off). Effets externes JAMAIS en off/shadow. */
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
