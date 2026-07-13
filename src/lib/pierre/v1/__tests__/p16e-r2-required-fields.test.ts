// src/lib/pierre/v1/__tests__/p16e-r2-required-fields.test.ts
// P16E §4.B — R2 : un champ REQUIS vide ne peut pas atteindre un document final.
//
// Verdict : R2 est correctement géré par conception (P16D l'avait supposé ; ici on le PROUVE).
//   1) `evaluateContractReadiness` bloque la GÉNÉRATION dès qu'un `policy.required_fields`
//      n'est pas `present()` — et `present()` exclut null / undefined / "" ET l'em-dash "—".
//      Donc même une valeur déjà rendue en "—" est traitée comme MANQUANTE.
//   2) Les contrôles de champs n'ont lieu qu'au stade DRAFT/GENERATE ; un draft bloqué ne peut
//      être ni approuvé ni finalisé (statut requis 'approved' inatteignable).
//   3) Un champ OPTIONNEL vide ne bloque pas et se rend en "—" (placeholder neutre, pas une
//      donnée inventée).
//
// Ces tests sont PURS (aucune base) : ils exercent directement le moteur de readiness et le
// compilateur de template — les deux autorités réelles.

import { describe, it, expect } from "vitest";
import { evaluateContractReadiness, type ContractReadinessInput } from "@/lib/pierre/v1/contract-readiness";
import { getContractPolicy } from "@/lib/pierre/v1/contract-policies";
import { compileContractTemplate } from "@/lib/pierre/v1/contract-template-compiler";
import type { StrictGenerationContext } from "@/lib/pierre/v1/generation-context";

const policy = getContractPolicy("CDI_FULL_TIME")!;

function ctxWith(values: Record<string, string | null>): StrictGenerationContext {
  return { document_type: "employment_contract", employee_id: "e1", site_id: null, contract_id: "c1", values, sensitive_fields: [], custom_field_keys: [], rejected_overrides: [] };
}

function readiness(over: Partial<ContractReadinessInput>): ReturnType<typeof evaluateContractReadiness> {
  return evaluateContractReadiness({
    requested_action: "generate", policy, workflow_status: "draft",
    employee_ok: true, site_coherent: true, contract_matches_employee: true,
    template: { published: true, document_type: "employment_contract", allowed_renderers: ["pdf", "docx"] },
    context: null, renderer: "pdf", permissions: ["document.write"], role_keys: ["OWNER"],
    required_approvals: 1, approvals_valid: 0, legal_hold: false, is_latest_version: true, signed_or_superseded: false,
    ...over,
  });
}

/** Toutes les valeurs requises présentes (base contrat CDI). */
const complete = () => ctxWith({
  "company.legal_name": "ACME SARL", "employee.first_name": "Marie", "employee.last_name": "MARTIN",
  "employee.role_title": "Ingénieure", "employment.start_date": "2026-03-01", "employment.weekly_hours": "35",
});

describe("P16E §4.B — R2 : readiness bloque tout champ requis vide", () => {
  it("contexte complet ⇒ prêt (aucun blocage, aucun champ manquant)", () => {
    const r = readiness({ context: complete() });
    expect(r.missing_fields).toEqual([]);
    expect(r.blockers).not.toContain("missing_required_fields");
  });

  it.each([null, "", "—"])("un champ requis à %s ⇒ generation BLOQUÉE (missing_required_fields)", (bad) => {
    const values = complete().values; values["employee.last_name"] = bad as string;
    const r = readiness({ context: ctxWith(values) });
    expect(r.missing_fields).toContain("employee.last_name");
    expect(r.blockers).toContain("missing_required_fields");
    expect(r.ready).toBe(false);
  });

  it("l'em-dash « — » est explicitement traité comme MANQUANT (pas comme une valeur)", () => {
    const values = complete().values; values["company.legal_name"] = "—";
    const r = readiness({ context: ctxWith(values) });
    expect(r.missing_fields).toContain("company.legal_name");
    expect(r.blockers).toContain("missing_required_fields");
  });

  it("un contexte de génération absent bloque (fail-closed, jamais 'prêt' par défaut)", () => {
    const r = readiness({ context: null });
    expect(r.blockers).toContain("generation_context_missing");
    expect(r.ready).toBe(false);
  });

  it("les champs ne sont vérifiés qu'au stade DRAFT : la finalisation dépend de l'artefact/approbations, un draft bloqué ne peut donc jamais être finalisé", () => {
    // Un draft avec un champ requis vide n'est jamais généré ⇒ pas de version 'approved' ⇒
    // finalize exige workflow_status 'approved' (STATUS_OK). On prouve la précondition de statut.
    const rFinalizeFromDraft = readiness({ requested_action: "finalize", workflow_status: "draft", context: complete() });
    expect(rFinalizeFromDraft.blockers).toContain("status_does_not_allow_action");
  });
});

describe("P16E §4.B — R2 : le compilateur ne peut afficher « — » que pour un champ OPTIONNEL vide", () => {
  it("un champ requis vide est déjà bloqué en amont ; un OPTIONNEL vide se rend en « — » (neutre)", () => {
    const body = "Poste: {{employee.role_title}}\nPrime optionnelle: {{employment.optional_bonus}}";
    const schema = [
      { field_key: "employee.role_title", source_path: "employee.role_title", required: true },
      { field_key: "employment.optional_bonus", source_path: "employment.optional_bonus", required: false },
    ];
    const compiled = compileContractTemplate(body, schema, ctxWith({ "employee.role_title": "Ingénieure", "employment.optional_bonus": "" }));
    const text = JSON.stringify(compiled);
    expect(text).toContain("Ingénieure");   // valeur réelle préservée
    expect(text).toContain("—");             // optionnel vide ⇒ placeholder neutre
  });

  it("un placeholder NON déclaré dans le field_schema n'est jamais substitué (reste {{...}}, signalé unknown)", () => {
    const compiled = compileContractTemplate("X: {{secret.path}}", [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }], ctxWith({ "employee.first_name": "Marie" }));
    expect(JSON.stringify(compiled)).toContain("{{secret.path}}"); // non déclaré ⇒ non résolu
  });
});
