// src/lib/cloneos/ai/mode.ts
// AI Runtime Mode — reads AI_RUNTIME_MODE from process.env. Pure, no async.
// Default: "mock" — safe for dev and test without any API keys.

import type { AiRuntimeMode } from "./types";

const VALID_MODES: readonly AiRuntimeMode[] = ["mock", "disabled", "production"];
const DEFAULT_MODE: AiRuntimeMode = "mock";

export function getAiRuntimeMode(): AiRuntimeMode {
  try {
    const raw = process.env.AI_RUNTIME_MODE;
    if (typeof raw === "string" && (VALID_MODES as readonly string[]).includes(raw)) {
      return raw as AiRuntimeMode;
    }
  } catch {
    // ignore — process.env unavailable in edge contexts
  }
  return DEFAULT_MODE;
}

export function isAiProductionMode(): boolean {
  return getAiRuntimeMode() === "production";
}

export function isAiMockMode(): boolean {
  return getAiRuntimeMode() === "mock";
}

export function isAiDisabled(): boolean {
  return getAiRuntimeMode() === "disabled";
}

export function assertAiModeDescription(mode: AiRuntimeMode): string {
  switch (mode) {
    case "mock":
      return "Mode mock — aucun appel API réel, toutes les réponses sont simulées.";
    case "disabled":
      return "Mode désactivé — toutes les requêtes AI sont bloquées.";
    case "production":
      return "Mode production — appels API réels via les providers configurés.";
  }
}
