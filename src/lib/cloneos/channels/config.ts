// src/lib/cloneos/channels/config.ts
// B33 — Channel runtime mode + env config. Pure, no async.
// Default: CHANNEL_RUNTIME_MODE=mock — safe without any external provider.

import type { ChannelRuntimeMode } from "./types";

const VALID_MODES: readonly ChannelRuntimeMode[] = ["mock", "disabled", "production"];
const DEFAULT_MODE: ChannelRuntimeMode = "mock";

function getEnvSafe(key: string): string | null {
  try {
    const v = process.env[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

function getEnvInt(key: string, fallback: number): number {
  const raw = getEnvSafe(key);
  if (raw === null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getEnvBool(key: string, fallback: boolean): boolean {
  const raw = getEnvSafe(key);
  if (raw === null) return fallback;
  return raw.toLowerCase() === "true";
}

// ── Runtime mode ──────────────────────────────────────────────────────────────

export function getChannelRuntimeMode(): ChannelRuntimeMode {
  try {
    const raw = process.env.CHANNEL_RUNTIME_MODE;
    if (typeof raw === "string" && (VALID_MODES as readonly string[]).includes(raw)) {
      return raw as ChannelRuntimeMode;
    }
  } catch {
    // ignore — process.env unavailable
  }
  return DEFAULT_MODE;
}

export function isChannelMockMode(): boolean {
  return getChannelRuntimeMode() === "mock";
}

export function isChannelDisabled(): boolean {
  return getChannelRuntimeMode() === "disabled";
}

export function isChannelProductionMode(): boolean {
  return getChannelRuntimeMode() === "production";
}

export function assertChannelModeDescription(mode: ChannelRuntimeMode): string {
  switch (mode) {
    case "mock":
      return "Mode mock — aucun envoi réel, tous les messages sont simulés.";
    case "disabled":
      return "Mode désactivé — toutes les opérations de canal sont bloquées.";
    case "production":
      return "Mode production — envois réels via les providers configurés.";
  }
}

// ── Channel configuration ─────────────────────────────────────────────────────

export type ChannelConfig = {
  runtime_mode: ChannelRuntimeMode;
  default_provider: string;
  allow_unverified_send: boolean;
  max_daily_sends_default: number;
  max_hourly_sends_default: number;
  log_body: boolean;
};

export function getChannelConfig(): ChannelConfig {
  return {
    runtime_mode: getChannelRuntimeMode(),
    default_provider: getEnvSafe("CHANNEL_DEFAULT_PROVIDER") ?? "mock",
    allow_unverified_send: getEnvBool("CHANNEL_ALLOW_UNVERIFIED_SEND", false),
    max_daily_sends_default: getEnvInt("CHANNEL_MAX_DAILY_SENDS_DEFAULT", 100),
    max_hourly_sends_default: getEnvInt("CHANNEL_MAX_HOURLY_SENDS_DEFAULT", 20),
    log_body: getEnvBool("CHANNEL_LOG_BODY", false),
  };
}
