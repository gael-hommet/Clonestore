import { describe, it, expect } from "vitest";
import { buildEmptyGlobalOnboardingDraft } from "@/lib/clonestore/onboarding";
import { applyQuickStart, computeFootprintInputs, extractQuickStart } from "../storage";
import { createEmptyQuickStart } from "../quick-start";

const NOW = "2026-07-01T00:00:00.000Z";

describe("storage — mappers Quick Start ↔ draft existant", () => {
  it("extractQuickStart reflète les valeurs par défaut du draft (pays FR pré-rempli)", () => {
    const qs = extractQuickStart(buildEmptyGlobalOnboardingDraft());
    expect(qs).toEqual({ ...createEmptyQuickStart(), country: "FR" });
  });

  it("extractQuickStart(null) → vide", () => {
    expect(extractQuickStart(null)).toEqual(createEmptyQuickStart());
  });

  it("applyQuickStart écrit dans draft.company + first_mission (réutilise le modèle existant)", () => {
    const draft = buildEmptyGlobalOnboardingDraft();
    const qs = {
      companyName: "Acme SAS",
      companySize: "11-50",
      sector: "Services",
      country: "France",
      firstObjective: "Préparer les contrats d'embauche.",
    };
    const next = applyQuickStart(draft, qs, NOW);
    expect(next.company.company_name).toBe("Acme SAS");
    expect(next.company.size_range).toBe("11-50");
    expect(next.company.industry).toBe("Services");
    expect(next.company.country).toBe("France");
    expect(next.first_mission?.prompt).toBe("Préparer les contrats d'embauche.");
    expect(next.first_mission?.employee_slug).toBe("pierre");
    expect(next.first_mission?.plan_only).toBe(true);
    expect(next.updated_at).toBe(NOW);
    // Round-trip.
    expect(extractQuickStart(next)).toEqual(qs);
  });

  it("applyQuickStart n'écrase pas la mission si objectif vide", () => {
    const draft = buildEmptyGlobalOnboardingDraft();
    const next = applyQuickStart(draft, createEmptyQuickStart(), NOW);
    expect(next.first_mission).toBeNull();
  });
});

describe("storage — complétudes d'empreinte depuis le contenu réel", () => {
  it("draft vide → identité 0.25 (pays FR par défaut), autres sections 0", () => {
    const inputs = computeFootprintInputs(buildEmptyGlobalOnboardingDraft());
    expect(inputs.identity.completion).toBe(0.25); // country=FR pré-rempli
    expect(inputs.team.completion).toBe(0);
    expect(inputs.mission.completion).toBe(0);
  });

  it("identité partielle → fraction ; sections avec contenu → 1", () => {
    const draft = buildEmptyGlobalOnboardingDraft();
    draft.company.company_name = "Acme";
    draft.company.size_range = "11-50";
    // country vaut déjà "FR" (défaut) → 3 champs remplis sur 4.
    draft.humans = [{ id: "h1", full_name: "X", role_title: "DRH", is_approver: true, validation_scope: [] } as never];
    draft.first_mission = { mission_type: "x", prompt: "faire un truc", employee_slug: "pierre", plan_only: true };
    const inputs = computeFootprintInputs(draft);
    expect(inputs.identity.completion).toBeCloseTo(0.75, 5); // 3/4 (name, size, country)
    expect(inputs.team.completion).toBe(1);
    expect(inputs.mission.completion).toBe(1);
    expect(inputs.documents.completion).toBe(0);
  });
});
