// src/lib/clonestore/technologies/canonical/__tests__/tenant-technology-view-p19.test.ts
// P19 — the per-tenant Technologies Prime view: ONE canonical source for API + page, A/B isolation by
// construction (each tenant's settings produce its own view), providers honestly disabled, architecture-only
// never presented as available. Emits P19_TECHNOLOGY_UI_TENANT_PROOF.json from the real merge.

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildTenantTechnologyView } from "../tenant-technology-view";
import type { TechnologyCompanySetting } from "../../contracts";

const setting = (slug: string, status: string): TechnologyCompanySetting => ({
  technology_slug: slug as TechnologyCompanySetting["technology_slug"],
  status: status as TechnologyCompanySetting["status"],
  autonomy_level: "assisted" as TechnologyCompanySetting["autonomy_level"],
  risk_mode: "standard" as TechnologyCompanySetting["risk_mode"],
  configuration_status: "configured" as TechnologyCompanySetting["configuration_status"],
  enabled_for_employee_slugs: ["pierre"], disabled_for_employee_slugs: [],
  custom_rules: {}, validation_rules: {}, notification_rules: {}, memory_rules: {},
  created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z",
} as unknown as TechnologyCompanySetting);

describe("P19 — tenant Technologies Prime view (single canonical source)", () => {
  it("covers all 14 product technologies with id/version/readiness/provider/claims", () => {
    const v = buildTenantTechnologyView([]);
    expect(v.length).toBe(14);
    for (const e of v) {
      expect(e.id).toBeTruthy();
      expect(e.version).toBe("p19-canonical-1");
      expect(typeof e.claimableNow).toBe("string");
      expect(Array.isArray(e.mustNotClaim)).toBe(true);
    }
  });

  it("A/B tenants get DIFFERENT views from their own settings (isolation by construction)", () => {
    const a = buildTenantTechnologyView([setting("clonetrace", "maintenance")]);
    const b = buildTenantTechnologyView([]);
    const aTrace = a.find((e) => e.id === "clonetrace")!;
    const bTrace = b.find((e) => e.id === "clonetrace")!;
    expect(aTrace.availableForTenant).toBe(false);
    expect(aTrace.unavailabilityReason).toMatch(/Désactivée par votre entreprise/);
    expect(bTrace.availableForTenant).toBe(true);
    expect(bTrace.tenantConfigured).toBe(false);
  });

  it("provider-dependent technologies are HONESTLY disabled even if the tenant enables them", () => {
    const v = buildTenantTechnologyView([setting("clonevoice", "active"), setting("clonecall", "active")]);
    for (const id of ["clonevoice", "clonecall"]) {
      const e = v.find((x) => x.id === id)!;
      expect(e.availableForTenant).toBe(false);          // provider off ⇒ never live
      expect(e.unavailabilityReason).toMatch(/Provider externe non configuré/);
    }
  });

  it("architecture-only technology is never presented as available", () => {
    const room = buildTenantTechnologyView([]).find((e) => e.id === "cloneroom")!;
    expect(room.availableForTenant).toBe(false);
    expect(room.unavailabilityReason).toMatch(/non branché/);
  });

  it("emits the tenant UI proof from the real merge", () => {
    const A = buildTenantTechnologyView([setting("clonetrace", "maintenance")]);
    const B = buildTenantTechnologyView([]);
    const out = join(process.cwd(), ".p19-proofs");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "P19_TECHNOLOGY_UI_TENANT_PROOF.json"), JSON.stringify({
      generatedBy: "buildTenantTechnologyView (source canonique unique API + /profile/technologies)",
      apiWiring: "src/app/api/clonestore/technologies/route.ts → réponse champ `canonical`",
      pageWiring: "src/app/profile/technologies/page.tsx → PrimeStateSection (fetch /api/clonestore/technologies, aucune constante build-time)",
      tenantA_clonetrace: A.find((e) => e.id === "clonetrace"),
      tenantB_clonetrace: B.find((e) => e.id === "clonetrace"),
      providerDisabledHonest: B.filter((e) => e.providerState === "PROVIDER_READY_DISABLED").map((e) => ({ id: e.id, availableForTenant: e.availableForTenant, reason: e.unavailabilityReason })),
      total: B.length,
    }, null, 2), "utf8");
    expect(A.find((e) => e.id === "clonetrace")!.availableForTenant).not.toBe(B.find((e) => e.id === "clonetrace")!.availableForTenant);
  });
});
