// B46 — Technology Runtime Mode Mapping
// Pure except process.env reads (injectable via env param). No throw.

import type { CloneStoreTechnologyId, B46TechnologyRuntimeMode } from "./technology-b46-types";

const VALID_MODES = new Set<B46TechnologyRuntimeMode>([
  "mock", "dry_run", "sandbox", "production", "disabled",
]);

function parseMode(val: string | undefined, fallback: B46TechnologyRuntimeMode): B46TechnologyRuntimeMode {
  if (val && VALID_MODES.has(val as B46TechnologyRuntimeMode)) return val as B46TechnologyRuntimeMode;
  return fallback;
}

// ── Get runtime mode for a single technology ─────────────────────────────────

export function getRuntimeModeForTechnology(
  id: CloneStoreTechnologyId,
  env?: Record<string, string | undefined>,
): B46TechnologyRuntimeMode {
  const e = env ?? (typeof process !== "undefined" ? process.env : {});

  switch (id) {
    case "cloneos":
      // CloneOS follows AI runtime mode
      return parseMode(e["AI_RUNTIME_MODE"], "mock") === "mock" ? "mock" : "production";
    case "cloneadn":
      // CloneADN reads from Supabase empreinte — always production (DB adapter)
      return "production";
    case "cloneguard":
      // CloneGuard is pure evaluation — always production
      return "production";
    case "clonetrace":
      // CloneTrace writes to Supabase logs — always production
      return "production";
    case "clonevoice":
      return parseMode(e["CLONEVOICE_RUNTIME_MODE"], "disabled");
    case "clonechat":
      return parseMode(e["CLONECHAT_RUNTIME_MODE"], "dry_run");
    default:
      return "mock";
  }
}

// ── Map env to all 6 technologies at once ─────────────────────────────────────

export function mapEnvToTechnologyRuntimeModes(
  env?: Record<string, string | undefined>,
): Record<CloneStoreTechnologyId, B46TechnologyRuntimeMode> {
  const ids: CloneStoreTechnologyId[] = ["cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice", "clonechat"];
  const result = {} as Record<CloneStoreTechnologyId, B46TechnologyRuntimeMode>;
  for (const id of ids) {
    result[id] = getRuntimeModeForTechnology(id, env);
  }
  return result;
}

// ── Safety check ──────────────────────────────────────────────────────────────

export function isTechnologyRuntimeSafe(
  id: CloneStoreTechnologyId,
  mode: B46TechnologyRuntimeMode,
): boolean {
  if (mode === "disabled") return id === "clonevoice"; // clonevoice may be safely disabled
  if (mode === "production") {
    if (id === "cloneguard" || id === "clonetrace") return true;
    if (id === "clonevoice") return false; // needs provider
    return true;
  }
  return true; // mock, dry_run, sandbox are always safe
}

// ── Labels ────────────────────────────────────────────────────────────────────

export function getRuntimeModeLabel(mode: B46TechnologyRuntimeMode): string {
  switch (mode) {
    case "mock":       return "Mode simulé";
    case "dry_run":    return "Mode simulation sèche";
    case "sandbox":    return "Mode bac à sable";
    case "production": return "Mode production";
    case "disabled":   return "Désactivé";
    default:           return "Inconnu";
  }
}

export function getRuntimeModeSafetyLabel(
  mode: B46TechnologyRuntimeMode,
): "safe" | "limited" | "production" | "disabled" {
  switch (mode) {
    case "mock":       return "safe";
    case "dry_run":    return "safe";
    case "sandbox":    return "limited";
    case "production": return "production";
    case "disabled":   return "disabled";
    default:           return "disabled";
  }
}
