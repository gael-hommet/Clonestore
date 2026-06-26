// TECH-03 — Global Technology Config ↔ B46 Bridge
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// This bridge allows TECH-03 GlobalTechnologyConfig to coexist with the
// pre-existing B46 layer (technology-b46-types.ts + technology-b46-registry.ts).
// Neither B46 file is modified. This bridge is one-way: Global → B46.
//
// B46 covers 6 visible technologies only.
// Global covers all 13 (including 7 roadmap/internal technologies).

import type {
  CloneStoreTechnologyId,
  B46TechnologyItem,
  B46TechnologyStatus,
  B46TechnologyGuardrails,
  B46TechnologyReadiness,
} from "./technology-b46-types";
import { B46_TECHNOLOGY_IDS } from "./technology-b46-types";
import type {
  GlobalTechnologyKey,
  GlobalTechnologyConfig,
  GlobalTechnologyConfigSnapshot,
} from "./global-tech-config";
import { DEFAULT_GLOBAL_TECH_CONFIGS, DEFAULT_GLOBAL_TECH_CONFIG_LIST } from "./global-tech-defaults";
import { buildGlobalTechnologyConfigSnapshot } from "./global-tech-snapshot";

// ── Type guard ────────────────────────────────────────────────────────────────

export function isB46TechnologyId(key: GlobalTechnologyKey): key is CloneStoreTechnologyId {
  return (B46_TECHNOLOGY_IDS as string[]).includes(key);
}

export function getB46VisibleTechnologyKeys(): CloneStoreTechnologyId[] {
  return [...B46_TECHNOLOGY_IDS];
}

// ── Status mapping ────────────────────────────────────────────────────────────

function mapGlobalStatusToB46(
  config: GlobalTechnologyConfig,
): B46TechnologyStatus {
  switch (config.status) {
    case "active":
      return config.runtime_status === "operational" ? "active" : "needs_configuration";
    case "partial":
      return config.runtime_status === "unavailable" ? "degraded" : "needs_configuration";
    case "disabled":
      return "disabled";
    case "roadmap":
      return "draft";
    case "locked":
      return "archived";
    default:
      return "disabled";
  }
}

// ── Guardrails mapping ────────────────────────────────────────────────────────

function mapGlobalGuardrailsToB46(
  config: GlobalTechnologyConfig,
): B46TechnologyGuardrails {
  return {
    requires_paid_customer: config.guardrails.requires_paid_access,
    requires_human_validation: config.guardrails.requires_human_validation,
    requires_security_guard: config.category === "governance",
    requires_audit: config.guardrails.requires_audit_trail,
    requires_cost_shield: config.guardrails.requires_paid_access,
    blocks_sensitive_actions: config.guardrails.blocks_autonomous_actions,
    blocks_unverified_channels: config.guardrails.requires_human_validation,
    no_public_demo_live: config.guardrails.no_live_production_without_approval,
    no_unpaid_live: config.guardrails.requires_paid_access,
    allowed_runtime_modes: config.mode === "disabled" ? ["disabled"] : ["production", "sandbox"],
    locked: config.locked_by_platform,
  };
}

// ── Readiness mapping ─────────────────────────────────────────────────────────

function mapGlobalReadinessToB46(
  config: GlobalTechnologyConfig,
): B46TechnologyReadiness {
  const score = config.readiness_score;
  const ready = score >= 60 && config.status !== "disabled" && config.status !== "roadmap";
  const activeSafe = score >= 70 && config.runtime_status !== "unavailable";
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (config.status === "roadmap") {
    blockers.push("Technology not yet implemented");
  }
  if (config.runtime_status === "unavailable") {
    blockers.push("Runtime unavailable");
  }
  if (config.runtime_status === "not_implemented") {
    blockers.push("Runtime not implemented");
  }
  if (score < 60 && config.status !== "roadmap" && config.status !== "disabled") {
    warnings.push(`Readiness score below threshold: ${score}/100`);
  }

  return {
    score,
    ready,
    active_safe: activeSafe,
    missing_required: [],
    warnings,
    blockers,
    dependencies_ok: true,
    last_checked_at: config.updated_at,
  };
}

// ── Single config → B46 item ──────────────────────────────────────────────────

/**
 * Maps a GlobalTechnologyConfig to a minimal B46TechnologyItem.
 * Only valid for the 6 B46-visible technology IDs.
 * Returns null for non-B46 technology keys.
 */
export function mapGlobalConfigToB46Item(
  config: GlobalTechnologyConfig,
): B46TechnologyItem | null {
  if (!isB46TechnologyId(config.key)) {
    return null;
  }

  const b46Id = config.key as CloneStoreTechnologyId;

  return {
    id: b46Id,
    display: {
      name: config.display_name,
      short_label: config.key,
      description: config.short_description,
      customer_description: config.short_description,
      icon_key: config.key,
      accent: "#4F46E5",
      order: B46_TECHNOLOGY_IDS.indexOf(b46Id),
    },
    status: mapGlobalStatusToB46(config),
    runtime_mode: config.mode === "production" ? "production" : "sandbox",
    visibility: config.visible_to_customer ? "visible_to_customer" : "hidden_until_ready",
    enabled: config.status === "active" || config.status === "partial",
    locked: config.locked_by_platform,
    capabilities: [],
    guardrails: mapGlobalGuardrailsToB46(config),
    readiness: mapGlobalReadinessToB46(config),
    launch_critical: config.required_for_public_launch,
    pierre_required: config.required_for_employee_runtime,
    dependencies: config.dependencies
      .filter(isB46TechnologyId)
      .map((dep) => ({
        technology_id: dep as CloneStoreTechnologyId,
        required: true,
        status: "ok" as const,
        reason: "Required dependency",
      })),
  };
}

// ── Snapshot → B46 items ──────────────────────────────────────────────────────

/**
 * Extracts the 6 B46-visible items from a GlobalTechnologyConfigSnapshot.
 * Skips any non-B46 keys silently.
 */
export function mapGlobalSnapshotToB46Items(
  snapshot: GlobalTechnologyConfigSnapshot,
): B46TechnologyItem[] {
  const items: B46TechnologyItem[] = [];

  for (const config of snapshot.technologies) {
    const item = mapGlobalConfigToB46Item(config);
    if (item !== null) {
      items.push(item);
    }
  }

  // Sort by B46 display order
  items.sort((a, b) => a.display.order - b.display.order);
  return items;
}

/**
 * Builds a B46-compatible array of technology items from the default global configs.
 * Preserves B46 ordering (cloneos, cloneadn, cloneguard, clonetrace, clonevoice, clonechat).
 */
export function buildB46CompatibleTechnologyItemsFromGlobal(
  configs?: GlobalTechnologyConfig[],
): B46TechnologyItem[] {
  const snapshot = buildGlobalTechnologyConfigSnapshot(configs);
  return mapGlobalSnapshotToB46Items(snapshot);
}

// ── B46 technology map helpers ────────────────────────────────────────────────

/**
 * Returns only the B46 keys from the global config list.
 */
export function getB46ConfigsFromGlobal(
  configs?: GlobalTechnologyConfig[],
): GlobalTechnologyConfig[] {
  const resolved = configs ?? DEFAULT_GLOBAL_TECH_CONFIG_LIST;
  return resolved.filter((c) => isB46TechnologyId(c.key));
}

/**
 * Returns only the non-B46 (internal/roadmap) configs from the global config list.
 */
export function getNonB46ConfigsFromGlobal(
  configs?: GlobalTechnologyConfig[],
): GlobalTechnologyConfig[] {
  const resolved = configs ?? DEFAULT_GLOBAL_TECH_CONFIG_LIST;
  return resolved.filter((c) => !isB46TechnologyId(c.key));
}

/**
 * Quick check: do all 6 B46 keys have configs in the global set?
 */
export function allB46KeysPresentInGlobal(
  configs?: GlobalTechnologyConfig[],
): boolean {
  const resolved = configs ?? DEFAULT_GLOBAL_TECH_CONFIG_LIST;
  const presentKeys = new Set(resolved.map((c) => c.key));
  return B46_TECHNOLOGY_IDS.every((id) => presentKeys.has(id));
}

// ── Reverse: B46 → global config lookup ──────────────────────────────────────

/**
 * Given a B46 technology ID, returns the corresponding GlobalTechnologyConfig.
 * Returns default config if no overrides provided.
 */
export function getGlobalConfigForB46Id(
  b46Id: CloneStoreTechnologyId,
  configs?: Partial<Record<GlobalTechnologyKey, GlobalTechnologyConfig>>,
): GlobalTechnologyConfig {
  const key = b46Id as GlobalTechnologyKey;
  if (configs && configs[key]) {
    return configs[key]!;
  }
  return DEFAULT_GLOBAL_TECH_CONFIGS[key];
}
