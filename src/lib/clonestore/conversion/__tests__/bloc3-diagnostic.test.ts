import { describe, it, expect } from "vitest";
import { computeDiagnostic } from "../diagnostic";
import { sanitizeDiagnosticAnswers, sanitizeCheckoutMetadata } from "../validation";

describe("BLOC 3 — diagnostic RH", () => {
  it("forte compatibilité quand volume élevé + équipe RH + autonomie supervisée", () => {
    const r = computeDiagnostic({
      version: "v1",
      answers: {
        headcount: "50-249",
        rh_team_size: "2-5",
        monthly_hires: "6-15",
        monthly_onboardings: "2-5",
        recurring_ops_volume: "high",
        autonomy_target: "supervised",
        validation_requirements: "medium",
      },
    });
    expect(r.compatibilityLevel).toBe("high");
    expect(r.estimatedSavedHoursPerMonth).not.toBeNull();
    // Pas d'estimation financière sans coût horaire fourni
    expect(r.estimatedFinancialRangeEur).toBeNull();
    expect(r.hypotheses.length).toBeGreaterThan(0);
    expect(r.limitations.length).toBeGreaterThan(0);
    expect(r.suggestedMissions.length).toBeGreaterThan(0);
    // Pas de score type 97/100
    expect(JSON.stringify(r)).not.toMatch(/97\s*\/\s*100/);
  });

  it("estimation financière UNIQUEMENT si l'utilisateur fournit un coût horaire", () => {
    const a = computeDiagnostic({
      version: "v1",
      answers: {
        headcount: "10-49",
        rh_team_size: "1",
        monthly_hires: "2-5",
        monthly_onboardings: "2-5",
        recurring_ops_volume: "medium",
        autonomy_target: "supervised",
        validation_requirements: "medium",
      },
      hourlyCostHypothesis: 35,
    });
    expect(a.estimatedFinancialRangeEur).not.toBeNull();
    expect(a.estimatedFinancialRangeEur!.low).toBeGreaterThanOrEqual(0);
    expect(a.estimatedFinancialRangeEur!.high).toBeGreaterThanOrEqual(a.estimatedFinancialRangeEur!.low);
    expect(a.hypotheses.some((h) => h.includes("Coût horaire saisi"))).toBe(true);
  });

  it("compatibilité limitée si volume nul et aucune équipe RH", () => {
    const r = computeDiagnostic({
      version: "v1",
      answers: {
        headcount: "1-9",
        rh_team_size: "0",
        monthly_hires: "0-1",
        monthly_onboardings: "0-1",
        recurring_ops_volume: "low",
        autonomy_target: "human_first",
        validation_requirements: "high",
      },
    });
    expect(r.compatibilityLevel === "limited" || r.compatibilityLevel === "partial").toBe(true);
  });

  it("calcul déterministe (même entrée → même sortie)", () => {
    const draft = {
      version: "v1",
      answers: {
        headcount: "50-249",
        rh_team_size: "2-5",
        monthly_hires: "6-15",
        monthly_onboardings: "2-5",
        recurring_ops_volume: "high",
        autonomy_target: "supervised",
        validation_requirements: "medium",
      } as const,
    };
    expect(computeDiagnostic(draft)).toEqual(computeDiagnostic(draft));
  });
});

describe("BLOC 3 — sanitizeDiagnosticAnswers refuse les champs interdits", () => {
  it("rejette name/email/salary/CV/siren/santé silencieusement", () => {
    const r = sanitizeDiagnosticAnswers({
      headcount: "50-249",
      name: "Alice Dupont",
      email: "alice@acme.test",
      salary: 42000,
      cv: "https://...",
      siren: "123456789",
      health: "info",
      absence_individual: "Thomas",
      monthly_hires: "2-5",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith("diagnostic.forbidden_field:"))).toBe(true);
    // Les champs autorisés sont nettoyés ; les interdits absents.
    expect(r.cleaned["headcount"]).toBe("50-249");
    expect(r.cleaned["monthly_hires"]).toBe("2-5");
    expect("email" in r.cleaned).toBe(false);
    expect("name" in r.cleaned).toBe(false);
  });

  it("rejette une valeur qui ressemble à un email même sur champ autorisé", () => {
    const r = sanitizeDiagnosticAnswers({
      headcount: "alice@acme.test",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith("diagnostic.looks_sensitive"))).toBe(true);
  });
});

describe("BLOC 3 — sanitizeCheckoutMetadata", () => {
  it("rejette les clés hors allowlist", () => {
    const r = sanitizeCheckoutMetadata({
      user_id: "u1",
      prospect_email: "leak@x.test",
      stripe_secret_token: "secret",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("metadata.forbidden_key:prospect_email"))).toBe(true);
    expect(r.cleaned["user_id"]).toBe("u1");
  });

  it("accepte les clés de l'allowlist contractuelle uniquement", () => {
    const r = sanitizeCheckoutMetadata({
      user_id: "u1",
      agent_slug: "pierre",
      conversion_session_id: "abc",
      conversion_variant: "VARIANT_DEPARTMENT_OUTCOME",
      funnel_version: "v1",
    });
    expect(r.ok).toBe(true);
    expect(Object.keys(r.cleaned).sort()).toEqual(
      ["agent_slug", "conversion_session_id", "conversion_variant", "funnel_version", "user_id"].sort(),
    );
  });

  it("refuse les caractères de contrôle dans les valeurs", () => {
    const r = sanitizeCheckoutMetadata({
      user_id: "u1\nDROP",
      agent_slug: "pierre",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith("metadata.control_chars"))).toBe(true);
  });
});
