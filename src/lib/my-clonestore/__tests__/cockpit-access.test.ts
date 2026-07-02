import { describe, it, expect } from "vitest";
import { resolveCockpitAccess } from "../cockpit-access";
import type { CockpitAccessInput } from "../types";

const base: CockpitAccessInput = {
  authenticated: true,
  operationalState: "employee_active",
  ownsEmployee: true,
  companyIdentityComplete: true,
  onboardingSufficient: true,
  routeAvailable: true,
};

const at = (over: Partial<CockpitAccessInput>) => resolveCockpitAccess({ ...base, ...over });

describe("resolveCockpitAccess (Étape 8)", () => {
  it("ready : possédé, actif, onboarding suffisant → ouvre le cockpit existant", () => {
    const r = at({});
    expect(r.decision).toBe("ready");
    expect(r.canOpen).toBe(true);
    expect(r.cta.href).toBe("/agents/pierre/use");
  });

  it("account_incomplete : identité entreprise manquante", () => {
    const r = at({ companyIdentityComplete: false });
    expect(r.decision).toBe("account_incomplete");
    expect(r.canOpen).toBe(false);
    expect(r.cta.href).toBe("/profile/onboarding");
  });

  it("onboarding_required : identité ok mais onboarding insuffisant", () => {
    const r = at({ onboardingSufficient: false });
    expect(r.decision).toBe("onboarding_required");
    expect(r.canOpen).toBe(false);
    expect(r.cta.href).toBe("/profile/onboarding");
  });

  it("entitlement_pending : paiement / activation en cours", () => {
    expect(at({ operationalState: "payment_pending" }).decision).toBe("entitlement_pending");
    expect(at({ operationalState: "activation_pending" }).decision).toBe("entitlement_pending");
    expect(at({ operationalState: "payment_pending" }).canOpen).toBe(false);
  });

  it("entitlement_inactive : suspendu / terminé", () => {
    expect(at({ operationalState: "subscription_suspended" }).decision).toBe("entitlement_inactive");
    expect(at({ operationalState: "subscription_ended" }).decision).toBe("entitlement_inactive");
  });

  it("employee_not_owned : ne possède pas l'employé", () => {
    expect(at({ ownsEmployee: false }).decision).toBe("employee_not_owned");
    expect(at({ operationalState: "authenticated_without_employee", ownsEmployee: false }).decision).toBe(
      "employee_not_owned",
    );
    expect(at({ ownsEmployee: false }).cta.href).toBe("/agents/pierre");
  });

  it("unavailable : route absente", () => {
    const r = at({ routeAvailable: false });
    expect(r.decision).toBe("unavailable");
    expect(r.canOpen).toBe(false);
  });

  it("unavailable/login : non authentifié ou anonyme", () => {
    expect(at({ authenticated: false }).cta.href).toBe("/login");
    expect(at({ operationalState: "anonymous" }).cta.href).toBe("/login");
  });

  it("chaque décision a un titre, un message et un CTA non vides (pas de fuite technique)", () => {
    const states: CockpitAccessInput["operationalState"][] = [
      "anonymous",
      "authenticated_without_employee",
      "payment_pending",
      "activation_pending",
      "employee_active",
      "subscription_suspended",
      "subscription_ended",
    ];
    for (const s of states) {
      const r = at({ operationalState: s });
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.message.length).toBeGreaterThan(0);
      expect(r.cta.label.length).toBeGreaterThan(0);
      expect(r.cta.href.startsWith("/")).toBe(true);
    }
  });

  it("respecte les routes/labels personnalisés (autre employé)", () => {
    const r = resolveCockpitAccess(base, {
      cockpitHref: "/agents/clara/use",
      employeeLabel: "Clara",
    });
    expect(r.cta.href).toBe("/agents/clara/use");
    expect(r.message).toContain("Clara");
  });
});
