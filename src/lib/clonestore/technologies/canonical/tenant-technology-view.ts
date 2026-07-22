// src/lib/clonestore/technologies/canonical/tenant-technology-view.ts
// P19 — THE per-tenant Technologies Prime view. ONE source feeds the API (/api/clonestore/technologies)
// and the UI (/profile/technologies): the canonical runtime registry (14 product technologies over T1),
// merged with the tenant's own persisted settings (clonestore_company_technologies, already tenant-scoped
// by the API's authenticated query — no cross-tenant read is possible here because the settings given to
// this function are the caller's own). Pure & deterministic. NOT a new registry: a projection.

import { buildCanonicalTechnologyRegistry, type CanonicalTechnologyEntry } from "./runtime-technology-registry";
import type { TechnologyCompanySetting } from "../contracts";

export type TenantTechnologyView = CanonicalTechnologyEntry & {
  /** The tenant's own operational state for this technology (null = platform default, not configured). */
  readonly tenantStatus: string | null;
  readonly tenantAutonomyLevel: string | null;
  readonly tenantConfigured: boolean;
  /** True only when the technology is locally operational AND the tenant has not disabled it. */
  readonly availableForTenant: boolean;
  /** Honest reason when unavailable (provider disabled / architecture-only / tenant-disabled). */
  readonly unavailabilityReason: string | null;
};

/** Map canonical ids ↔ Bloc-18 slugs where they coincide (same lowercase clonexxx naming). */
function settingFor(settings: readonly TechnologyCompanySetting[], id: string): TechnologyCompanySetting | null {
  return settings.find((s) => s.technology_slug === id) ?? null;
}

/**
 * Build the tenant's Technologies Prime view. `settings` MUST be the authenticated tenant's own rows —
 * the merge itself never mixes tenants. Pure.
 */
export function buildTenantTechnologyView(settings: readonly TechnologyCompanySetting[]): readonly TenantTechnologyView[] {
  return buildCanonicalTechnologyRegistry().map((entry) => {
    const s = settingFor(settings, entry.id);
    // Statuts Bloc-18 réels : enabled | degraded | maintenance | not_configured. Une techno est
    // indisponible côté tenant quand elle est explicitement en maintenance ou non configurée.
    const tenantDisabled = s != null && (s.status === "maintenance" || s.status === "not_configured");
    const providerBlocked = entry.providerState === "PROVIDER_READY_DISABLED";
    const archOnly = entry.readiness === "architecture_only";
    const availableForTenant = !tenantDisabled && !providerBlocked && !archOnly;
    const unavailabilityReason = tenantDisabled
      ? "Désactivée par votre entreprise."
      : providerBlocked
      ? "Provider externe non configuré — technologie prête mais désactivée (aucun faux actif)."
      : archOnly
      ? "Contrat défini — parcours produit non branché (jamais présenté comme disponible)."
      : null;
    return {
      ...entry,
      tenantStatus: s?.status ?? null,
      tenantAutonomyLevel: s?.autonomy_level ?? null,
      tenantConfigured: s != null,
      availableForTenant,
      unavailabilityReason,
    };
  });
}
