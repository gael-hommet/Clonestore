// src/lib/pierre/v1/__integration__/p16d-contract-field-injection.itest.ts
// P16D §6/§8 — un CORPS DE REQUÊTE CLIENT ne peut pas falsifier les valeurs FAISANT AUTORITÉ
// imprimées dans un contrat.
//
// DÉFAUT CORRIGÉ (CRITIQUE, confirmé 3/3, reproduit ici sur un vrai Postgres) —
// `field_values` (map brute du corps HTTP de POST /contracts/[id]/generate) était étalée EN
// DERNIER dans `extra` (contracts.ts) et l'emportait, dans `buildStrictGenerationContext`, sur
// la valeur RÉELLEMENT chargée en base (generation-context.ts). Un client pouvait ainsi réécrire
// le nom du salarié, la raison sociale, le SALAIRE et les DATES dans le PDF rendu, haché,
// approuvé puis signé. Le seul contrôle était que le PATH soit canonique — la VALEUR n'était
// jamais validée ni comparée à la base. `required_provenance:"payroll_system"` (salaire) n'était
// appliqué NULLE PART.
//
// Correction (deux verrous) :
//   1) toute clé possédée par la base (identité employé/entreprise/manager/site) ⇒ la BASE gagne.
//   2) toute clé à `required_provenance` (paie) fournie par le client ⇒ REJETÉE (fail-closed).
//   + les dates d'autorité (version du contrat) étalées en dernier ⇒ gagnent sur `field_values`.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedEmployee } from "./b2g-helpers";
import { buildStrictGenerationContext } from "../generation-context";

let h: Harness; let owner: TenantContext; let emp: string;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  // Vérité en base : MARTIN, ingénieure. La raison sociale vient de la company du harness.
  emp = await seedEmployee(h, h.companyA, { first_name: "Marie", last_name: "MARTIN", role_title: "Ingénieure" });
});
afterEach(async () => { await h.close(); });

describe("P16D §6/§8 — l'identité vient de la BASE, jamais du corps client", () => {
  it("un client qui forge nom / raison sociale / salaire est IGNORÉ ; la base fait foi", async () => {
    const forged = {
      "employee.last_name": "DUPONT",           // forge : la base dit MARTIN
      "employee.first_name": "IMPOSTEUR",
      "company.legal_name": "ACME LUX SARL",    // forge : != company réelle
      "compensation.base_salary": "120000",     // forge : à provenance paie, jamais du client
    };
    const ctx = await buildStrictGenerationContext(h.db, owner, {
      document_type: "employment_contract", employee_id: emp, site_id: null, contract_id: null,
      requested_fields: ["employee.first_name", "employee.last_name", "company.legal_name", "compensation.base_salary"],
      extra_values: forged,
    });

    // La base gagne partout.
    expect(ctx.values["employee.last_name"]).toBe("MARTIN");
    expect(ctx.values["employee.first_name"]).toBe("Marie");
    expect(ctx.values["employee.last_name"]).not.toBe("DUPONT");
    // La raison sociale = la company réelle du harness, pas « ACME LUX SARL ».
    expect(ctx.values["company.legal_name"]).not.toBe("ACME LUX SARL");
    // Le salaire à provenance paie fourni par le client est REJETÉ → null (fail-closed).
    expect(ctx.values["compensation.base_salary"]).toBeNull();

    // Toutes les tentatives de forge sont TRACÉES (preuve d'anti-forge).
    expect(ctx.rejected_overrides).toEqual(
      expect.arrayContaining(["employee.last_name", "employee.first_name", "company.legal_name", "compensation.base_salary"]),
    );
  });

  it("non-régression : un champ NON possédé par la base (heures hebdo) reste fourni par le client", async () => {
    const ctx = await buildStrictGenerationContext(h.db, owner, {
      document_type: "employment_contract", employee_id: emp, site_id: null, contract_id: null,
      requested_fields: ["employment.weekly_hours", "employee.last_name"],
      extra_values: { "employment.weekly_hours": "35" },
    });
    // weekly_hours n'est ni canonique-DB ni à provenance ⇒ légitimement fourni par l'appelant.
    expect(ctx.values["employment.weekly_hours"]).toBe("35");
    expect(ctx.rejected_overrides).not.toContain("employment.weekly_hours");
    // …mais l'identité reste la base.
    expect(ctx.values["employee.last_name"]).toBe("MARTIN");
  });

  it("sans aucun override client, le contexte est inchangé (pas de rejet fantôme)", async () => {
    const ctx = await buildStrictGenerationContext(h.db, owner, {
      document_type: "employment_contract", employee_id: emp, site_id: null, contract_id: null,
      requested_fields: ["employee.first_name", "employee.last_name"],
    });
    expect(ctx.values["employee.last_name"]).toBe("MARTIN");
    expect(ctx.rejected_overrides).toEqual([]);
  });
});
