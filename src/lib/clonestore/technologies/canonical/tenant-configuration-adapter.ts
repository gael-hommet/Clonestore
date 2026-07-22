// src/lib/clonestore/technologies/canonical/tenant-configuration-adapter.ts
// P20 — THE official, typed adapter between the canonical public technology authority and the
// TECH-03 tenant configuration layer.
//
// Direction is one-way and non-negotiable:
//   public-technology-projection (WHICH technologies exist, their status/ownership/order)
//     -> this adapter (joins each canonical id with its TECH-03 config IF one exists)
//       -> consumers (TECH-04 UI projection, /profile/agents, Bloc-18 legacy config routes)
//
// TECH-03 keeps its real domain data (readiness_score, guardrails, autonomy, control_level,
// visibility, tenant configurability). It simply no longer decides WHICH technologies exist:
// a technology absent from TECH-03 is not "non-existent", it is "not configurable yet".
//
// No fabricated readiness. No fabricated guardrails. No fabricated autonomy. The three states
// below are exhaustive and typed — a consumer cannot silently treat an unconfigured technology
// as configured.

import { buildPublicTechnologyProjection, type PublicLaunchStatus, type PublicTechnologyOwnership } from "./public-technology-projection";
import { DEFAULT_GLOBAL_TECH_CONFIGS } from "../global-tech-defaults";
import type { GlobalTechnologyConfig, GlobalTechnologyKey } from "../global-tech-config";

export type TenantConfigurationState =
  /** A real TECH-03 configuration exists for this technology (13 today). */
  | "CONFIGURED"
  /** Public per the canonical authority, but no TECH-03 configuration exists yet (CloneCall/CloneRoom). */
  | "NOT_CONFIGURABLE_YET"
  /** Owned by the external CloneChat workstream — P20 exposes metadata only, never configures it. */
  | "EXTERNAL_WORKSTREAM_METADATA_ONLY";

export type TenantConfiguredTechnology = {
  readonly id: string;
  /** Canonical human-facing name — consumers must render this, never the raw id. */
  readonly displayName: string;
  readonly ownership: PublicTechnologyOwnership;
  readonly launchStatus: PublicLaunchStatus;
  readonly displayOrder: number;
  readonly configurationState: TenantConfigurationState;
  /**
   * The real TECH-03 configuration, or null when none exists. NEVER a synthesised stand-in:
   * a null here means "we have no measurement", not "zero".
   */
  readonly config: GlobalTechnologyConfig | null;
  /**
   * Readiness ONLY when a real configuration exists. `null` for NOT_CONFIGURABLE_YET and
   * EXTERNAL_WORKSTREAM_METADATA_ONLY — consumers must render an honest absence, not a 0 score.
   */
  readonly readinessScore: number | null;
  /** True only when TECH-03 says the customer may configure it AND a config actually exists. */
  readonly customerConfigurable: boolean;
};

/** CloneChat is owned elsewhere: P20 surfaces its metadata but never claims to configure it. */
function stateFor(ownership: PublicTechnologyOwnership, config: GlobalTechnologyConfig | undefined): TenantConfigurationState {
  if (ownership === "EXTERNAL_CLONECHAT_WORKSTREAM") return "EXTERNAL_WORKSTREAM_METADATA_ONLY";
  return config ? "CONFIGURED" : "NOT_CONFIGURABLE_YET";
}

/**
 * Build the full tenant-configuration view over the canonical public authority.
 * Always returns exactly the canonical id set (15 today) in canonical display order.
 *
 * `overrides` lets a caller supply real per-tenant configs (e.g. loaded from the DB) keyed by id;
 * anything not overridden falls back to the TECH-03 platform defaults.
 */
export function buildTenantConfiguredTechnologies(
  overrides?: Partial<Record<string, GlobalTechnologyConfig>>,
): readonly TenantConfiguredTechnology[] {
  return buildPublicTechnologyProjection().map((entry) => {
    const config =
      overrides?.[entry.id] ?? DEFAULT_GLOBAL_TECH_CONFIGS[entry.id as GlobalTechnologyKey] ?? undefined;
    const configurationState = stateFor(entry.ownership, config);
    const effectiveConfig = configurationState === "CONFIGURED" ? config! : null;
    return {
      id: entry.id,
      displayName: entry.displayName,
      ownership: entry.ownership,
      launchStatus: entry.launchStatus,
      displayOrder: entry.displayOrder,
      configurationState,
      config: effectiveConfig,
      readinessScore: effectiveConfig ? effectiveConfig.readiness_score : null,
      customerConfigurable: effectiveConfig ? effectiveConfig.configurable_by_customer : false,
    };
  });
}

export function getTenantConfiguredTechnology(id: string): TenantConfiguredTechnology | undefined {
  return buildTenantConfiguredTechnologies().find((t) => t.id === id);
}

/** The canonical id set — the ONLY valid technology ids anywhere in the public/config surface. */
export function canonicalTechnologyIds(): readonly string[] {
  return buildPublicTechnologyProjection().map((e) => e.id);
}

/** True iff `id` is a technology the canonical authority recognises. Use instead of any local list. */
export function isCanonicalTechnologyId(id: string): boolean {
  return canonicalTechnologyIds().includes(id);
}

/** True iff `id` may be configured by the tenant configuration layer (Bloc-18/TECH-03). */
export function isConfigurableTechnologyId(id: string): boolean {
  return getTenantConfiguredTechnology(id)?.configurationState === "CONFIGURED";
}

export type CanonicalIdRejectionReason =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "UNKNOWN_TECHNOLOGY"; readonly message: string }
  | { readonly ok: false; readonly code: "NOT_CONFIGURABLE_YET"; readonly message: string }
  | { readonly ok: false; readonly code: "EXTERNAL_WORKSTREAM"; readonly message: string };

/**
 * Validate a technology id for a CONFIGURATION operation (read/write of tenant settings).
 * Fail-closed and explicit: an unknown id, an upcoming technology, and an externally-owned
 * technology are three different refusals — never silently collapsed into "not found".
 */
export function validateConfigurableTechnologyId(id: string): CanonicalIdRejectionReason {
  const entry = getTenantConfiguredTechnology(id);
  if (!entry) {
    return { ok: false, code: "UNKNOWN_TECHNOLOGY", message: `Technologie inconnue : « ${id} ».` };
  }
  if (entry.configurationState === "EXTERNAL_WORKSTREAM_METADATA_ONLY") {
    return { ok: false, code: "EXTERNAL_WORKSTREAM", message: `« ${id} » appartient à un chantier externe — non configurable ici.` };
  }
  if (entry.configurationState === "NOT_CONFIGURABLE_YET") {
    return { ok: false, code: "NOT_CONFIGURABLE_YET", message: `« ${id} » est à venir — aucune configuration disponible.` };
  }
  return { ok: true };
}
