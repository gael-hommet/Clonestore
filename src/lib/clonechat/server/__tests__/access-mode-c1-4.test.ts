// src/lib/clonechat/server/__tests__/access-mode-c1-4.test.ts
// C1.4 §6/§13 — MATRICE D'ACCÈS (pure). Prouve la séparation des trois autorités :
// intention (voie) · droit Pierre (opérationnel) · entreprise (tenant). Aucune ne fabrique
// l'autre. La découverte publique C1.3 reste ouverte SANS droit et SANS entreprise.

import { describe, expect, it } from "vitest";
import { resolveCloneChatAccessMode, isOrdinaryNoCompany, type CloneChatAccessMode } from "../access-mode";
import type { PierreAccessResult } from "@/lib/pierre/access";
import type { TenantResolution } from "../company";
import type { NoCompanyIntent } from "../no-company-gate";

const COMPANY = "11111111-1111-4111-8111-111111111111";

const GRANTED: PierreAccessResult = { ok: true, status: "active", orderId: "o1", error: null };
const NO_ENTITLEMENT: PierreAccessResult = { ok: false, reason: "NO_ENTITLEMENT", error: null };
const LOOKUP_FAILED: PierreAccessResult = { ok: false, reason: "LOOKUP_FAILED", error: "PIERRE_ACCESS_LOOKUP_FAILED" };

const WITH_COMPANY: TenantResolution = { ok: true, companyId: COMPANY, role: "owner", siteIds: [], real: true };
const NO_COMPANY: TenantResolution = { ok: false, code: "MEMBERSHIP_REQUIRED" };
const SELECT_COMPANY: TenantResolution = { ok: false, code: "COMPANY_SELECTION_REQUIRED", companies: [{ id: COMPANY, name: "Acme" }] };
const SUSPENDED: TenantResolution = { ok: false, code: "MEMBERSHIP_SUSPENDED" };
const UNAVAILABLE: TenantResolution = { ok: false, code: "COMPANY_UNAVAILABLE" };

const mode = (intent: NoCompanyIntent, entitlement: PierreAccessResult, tenant: TenantResolution): CloneChatAccessMode["mode"] =>
  resolveCloneChatAccessMode({ intent, entitlement, tenant }).mode;

describe("C1.4 — découverte publique préservée (C1.3 non régressée)", () => {
  it("11. authentifié + AUCUN droit + question publique → DÉCOUVERTE", () => {
    expect(mode("public", NO_ENTITLEMENT, NO_COMPANY)).toBe("AUTHENTICATED_DISCOVERY");
  });
  it("authentifié + droit + pas d'entreprise + question publique → DÉCOUVERTE", () => {
    expect(mode("public", GRANTED, NO_COMPANY)).toBe("AUTHENTICATED_DISCOVERY");
  });
  it("26. droit sans entreprise : question publique OK", () => {
    expect(mode("public", GRANTED, SELECT_COMPANY)).toBe("AUTHENTICATED_DISCOVERY");
  });
  it("35. vérification du droit en panne + question publique → DÉCOUVERTE (n'accorde rien)", () => {
    const r = resolveCloneChatAccessMode({ intent: "public", entitlement: LOOKUP_FAILED, tenant: NO_COMPANY });
    expect(r.mode).toBe("AUTHENTICATED_DISCOVERY");
    if (r.mode === "AUTHENTICATED_DISCOVERY") expect(r.entitlementKnown).toBe(false);
  });
});

describe("C1.4 — l'opérationnel EXIGE le droit Pierre", () => {
  it("19. requête opérationnelle sans droit → ENTITLEMENT_REQUIRED", () => {
    expect(mode("company", NO_ENTITLEMENT, NO_COMPANY)).toBe("ENTITLEMENT_REQUIRED");
  });

  it("25. une entreprise ACTIVE seule NE contourne PAS le droit Pierre", () => {
    // L'utilisateur a une vraie entreprise mais aucune commande active → toujours refusé.
    expect(mode("company", NO_ENTITLEMENT, WITH_COMPANY)).toBe("ENTITLEMENT_REQUIRED");
  });

  it("une entreprise active + aucun droit + question publique → découverte (jamais mode entreprise)", () => {
    expect(mode("public", NO_ENTITLEMENT, WITH_COMPANY)).toBe("AUTHENTICATED_DISCOVERY");
  });

  it("ambigu sans droit → clarification (jamais un blocage automatique)", () => {
    expect(mode("ambiguous", NO_ENTITLEMENT, NO_COMPANY)).toBe("CLARIFICATION_REQUIRED");
  });
});

describe("C1.4 — l'opérationnel EXIGE une entreprise (droit ne fabrique pas de tenant)", () => {
  it("27. droit OK + aucune entreprise + requête opérationnelle → COMPANY_REQUIRED", () => {
    expect(mode("company", GRANTED, NO_COMPANY)).toBe("COMPANY_REQUIRED");
    expect(mode("company", GRANTED, SELECT_COMPANY)).toBe("COMPANY_REQUIRED");
  });

  it("29. droit OK + entreprise valide → COMPANY_MODE (avec le vrai companyId)", () => {
    const r = resolveCloneChatAccessMode({ intent: "company", entitlement: GRANTED, tenant: WITH_COMPANY });
    expect(r.mode).toBe("COMPANY_MODE");
    if (r.mode === "COMPANY_MODE") expect(r.companyId).toBe(COMPANY);
    // Toutes les intentions passent en mode entreprise pour un utilisateur pleinement autorisé.
    expect(mode("public", GRANTED, WITH_COMPANY)).toBe("COMPANY_MODE");
  });
});

describe("C1.4 — échecs fail-closed", () => {
  it("34. panne de vérification du droit + requête opérationnelle → ACCESS_CHECK_UNAVAILABLE", () => {
    expect(mode("company", LOOKUP_FAILED, NO_COMPANY)).toBe("ACCESS_CHECK_UNAVAILABLE");
    expect(mode("company", LOOKUP_FAILED, WITH_COMPANY)).toBe("ACCESS_CHECK_UNAVAILABLE");
    // Une panne n'est JAMAIS lue comme un droit accordé.
    expect(mode("company", LOOKUP_FAILED, WITH_COMPANY)).not.toBe("COMPANY_MODE");
  });

  it("36. membership SUSPENDU → fail-closed, même pour une question publique", () => {
    expect(mode("public", GRANTED, SUSPENDED)).toBe("TENANT_FAIL_CLOSED");
    expect(mode("public", NO_ENTITLEMENT, SUSPENDED)).toBe("TENANT_FAIL_CLOSED");
    expect(mode("company", GRANTED, SUSPENDED)).toBe("TENANT_FAIL_CLOSED");
  });

  it("37. entreprise INDISPONIBLE (panne DB) → fail-closed pour tous", () => {
    expect(mode("public", GRANTED, UNAVAILABLE)).toBe("TENANT_FAIL_CLOSED");
    expect(mode("company", NO_ENTITLEMENT, UNAVAILABLE)).toBe("TENANT_FAIL_CLOSED");
  });

  it("la suspension n'est jamais convertie en accès entreprise", () => {
    expect(mode("company", GRANTED, SUSPENDED)).not.toBe("COMPANY_MODE");
  });

  it("isOrdinaryNoCompany : seuls MEMBERSHIP_REQUIRED / COMPANY_SELECTION_REQUIRED", () => {
    expect(isOrdinaryNoCompany(NO_COMPANY)).toBe(true);
    expect(isOrdinaryNoCompany(SELECT_COMPANY)).toBe(true);
    expect(isOrdinaryNoCompany(SUSPENDED)).toBe(false);
    expect(isOrdinaryNoCompany(UNAVAILABLE)).toBe(false);
    expect(isOrdinaryNoCompany(WITH_COMPANY)).toBe(false);
  });
});

describe("C1.4 — matrice complète (aucune combinaison n'accorde par accident)", () => {
  it("aucun mode opérationnel sans droit ET entreprise", () => {
    const intents: NoCompanyIntent[] = ["public", "company", "ambiguous"];
    const entitlements = [GRANTED, NO_ENTITLEMENT, LOOKUP_FAILED];
    const tenants = [WITH_COMPANY, NO_COMPANY, SELECT_COMPANY, SUSPENDED, UNAVAILABLE];
    for (const i of intents) {
      for (const e of entitlements) {
        for (const t of tenants) {
          const m = resolveCloneChatAccessMode({ intent: i, entitlement: e, tenant: t });
          if (m.mode === "COMPANY_MODE") {
            // COMPANY_MODE exige STRICTEMENT droit accordé + entreprise résolue.
            expect(e.ok, `${i}/${JSON.stringify(e)}/${JSON.stringify(t)}`).toBe(true);
            expect(t.ok).toBe(true);
          }
        }
      }
    }
  });
});
