import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compute } from "../diagnostic";
import { sanitizeDiagnosticAnswers, sanitizeCheckoutMetadata } from "../validation";
import type { DiagnosticResult } from "../types";

interface FixtureVector {
  name: string;
  answers: Record<string, unknown>;
  hourly_cost_eur: number | null;
  result: DiagnosticResult;
}

const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "leadforge-contract-db9b166.json"), "utf8"),
) as { diagnostic_vectors: FixtureVector[] };

describe("BLOC 3 — diagnostic golden vectors (parité LeadForge Python)", () => {
  for (const vector of FIXTURE.diagnostic_vectors) {
    it(`golden vector: ${vector.name} produit byte-pour-byte le résultat Python`, () => {
      const tsResult = compute({
        answers: vector.answers as Record<string, never>,
        monthly_cost_eur: vector.hourly_cost_eur ?? null,
      });
      expect(tsResult).toEqual(vector.result);
    });
  }

  it("calcul déterministe : même entrée → même sortie", () => {
    const input = { headcount: 60, monthly_hires: 4, monthly_on_offboardings: 3, autonomy_level: "medium", validation_required: true } as const;
    expect(compute({ answers: input })).toEqual(compute({ answers: input }));
  });

  it("aucune économie financière sans coût horaire", () => {
    const r = compute({ answers: { monthly_hires: 5, monthly_on_offboardings: 2, autonomy_level: "high" } });
    expect(r.financial_saving).toBeNull();
  });

  it("économie financière UNIQUEMENT si coût horaire fourni", () => {
    const r = compute({
      answers: { monthly_hires: 5, monthly_on_offboardings: 2, autonomy_level: "high" },
      monthly_cost_eur: 50,
    });
    expect(r.financial_saving).not.toBeNull();
    expect(r.financial_saving!.basis).toBe("user_supplied_hourly_cost");
    expect(r.financial_saving!.hourly_cost_eur).toBe(50);
    expect(r.financial_saving!.vs_pierre_eur_month).toBe(449);
  });
});

describe("BLOC 3 — sanitizeDiagnosticAnswers (allowlist LeadForge FR)", () => {
  it("rejette les inputs interdits FR (nom_salarié, salaire_individuel, sanction, dossier_disciplinaire)", () => {
    const r = sanitizeDiagnosticAnswers({
      headcount: 50,
      nom_salarié: "Alice Dupont",
      salaire_individuel: 42000,
      sanction: "info",
      dossier_disciplinaire: "info",
      monthly_hires: 5,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("forbidden_input:nom_salarié"))).toBe(true);
    expect(r.errors.some((e) => e.includes("forbidden_input:salaire_individuel"))).toBe(true);
    expect(r.errors.some((e) => e.includes("forbidden_input:sanction"))).toBe(true);
    expect(r.errors.some((e) => e.includes("forbidden_input:dossier_disciplinaire"))).toBe(true);
    expect(r.cleaned["headcount"]).toBe(50);
    expect(r.cleaned["monthly_hires"]).toBe(5);
    expect("nom_salarié" in r.cleaned).toBe(false);
  });

  it("rejette une valeur ressemblant à un email même sur champ autorisé", () => {
    const r = sanitizeDiagnosticAnswers({ headcount: "alice@acme.test" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("looks_sensitive"))).toBe(true);
  });

  it("ignore silencieusement les champs inconnus", () => {
    const r = sanitizeDiagnosticAnswers({ headcount: 10, foobar: 42 });
    expect(r.ok).toBe(true);
    expect("foobar" in r.cleaned).toBe(false);
  });
});

describe("BLOC 3 — sanitizeCheckoutMetadata (allowlist LeadForge + CloneStore)", () => {
  it("accepte les 5 champs LeadForge + 5 champs CloneStore", () => {
    const r = sanitizeCheckoutMetadata({
      prospect_token: "abcdef0123456789abcdef0123456789abcdef00",
      campaign: "spring_2026",
      cohort: "V0-A",
      variant: "VARIANT_DEPARTMENT_OUTCOME",
      funnel_version: "v0.1",
      user_id: "u1",
      agent_slug: "pierre",
      order_id: "ord_1",
      tenant_id: "t_1",
      founder_reservation_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(r.ok).toBe(true);
    expect(Object.keys(r.cleaned).sort()).toEqual([
      "agent_slug",
      "campaign",
      "cohort",
      "founder_reservation_id",
      "funnel_version",
      "order_id",
      "prospect_token",
      "tenant_id",
      "user_id",
      "variant",
    ].sort());
  });

  it("réduit prospect_token au token_id seul (drop signature)", () => {
    const r = sanitizeCheckoutMetadata({
      prospect_token: "abcdef0123456789abcdef0123456789abcdef00.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      user_id: "u1",
    });
    expect(r.cleaned["prospect_token"]).toBe("abcdef0123456789abcdef0123456789abcdef00");
  });

  it("rejette les clés hors allowlist (prospect_email, stripe_secret_token)", () => {
    const r = sanitizeCheckoutMetadata({
      user_id: "u1",
      prospect_email: "leak@x.test",
      stripe_secret_token: "secret",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("forbidden_key:prospect_email"))).toBe(true);
  });

  it("rejette les caractères de contrôle dans les valeurs", () => {
    const r = sanitizeCheckoutMetadata({ user_id: "u1\nDROP", agent_slug: "pierre" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith("metadata.control_chars"))).toBe(true);
  });
});
