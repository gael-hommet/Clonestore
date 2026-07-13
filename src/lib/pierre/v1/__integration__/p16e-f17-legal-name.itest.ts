// src/lib/pierre/v1/__integration__/p16e-f17-legal-name.itest.ts
// P16E §3 (F17) — la RAISON SOCIALE d'un contrat vient de la colonne juridique VÉRIFIÉE.
//
// DÉFAUT CORRIGÉ — `generation-context` mappait `company.legal_name` sur `company.name` (nom
// d'AFFICHAGE) : un nom d'affichage devenait silencieusement l'identité juridique d'un contrat.
// Correctif : `company.legal_name` lit la colonne `legal_name` ; si absente ⇒ null ⇒
// contract-readiness bloque le champ requis (aucune raison sociale inventée).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedEmployee } from "./b2g-helpers";
import { buildStrictGenerationContext } from "../generation-context";
import { evaluateContractReadiness } from "../contract-readiness";
import { getContractPolicy } from "../contract-policies";

let h: Harness; let owner: TenantContext; let emp: string;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  emp = await seedEmployee(h, h.companyA, { first_name: "Marie", last_name: "Martin", role_title: "Ingénieure" });
});
afterEach(async () => { await h.close(); });

const ctxFor = () => buildStrictGenerationContext(h.db, owner, {
  document_type: "employment_contract", employee_id: emp, site_id: null, contract_id: null,
  requested_fields: ["company.legal_name", "company.display_name", "company.registration_number"],
});

describe("P16E §3 F17 — raison sociale = colonne légale, jamais le nom d'affichage", () => {
  it("company.legal_name vient de la colonne legal_name (distincte du nom d'affichage)", async () => {
    await h.db.query(`update pierre_rt_companies set name=$2, legal_name=$3, registration_number=$4 where id=$1`,
      [h.companyA, "Acme (marque)", "ACME FRANCE SAS", "RCS Paris 123 456 789"]);
    const ctx = await ctxFor();
    expect(ctx.values["company.legal_name"]).toBe("ACME FRANCE SAS");
    expect(ctx.values["company.display_name"]).toBe("Acme (marque)");
    expect(ctx.values["company.legal_name"]).not.toBe(ctx.values["company.display_name"]);
    expect(ctx.values["company.registration_number"]).toBe("RCS Paris 123 456 789");
  });

  it("legal_name ABSENT ⇒ company.legal_name null ⇒ readiness BLOQUE (jamais inventée)", async () => {
    await h.db.query(`update pierre_rt_companies set name='Acme', legal_name=null where id=$1`, [h.companyA]);
    const ctx = await ctxFor();
    expect(ctx.values["company.legal_name"]).toBeNull(); // pas de repli sur le nom d'affichage

    // Le contrat CDI requiert company.legal_name : readiness doit bloquer.
    const policy = getContractPolicy("CDI_FULL_TIME")!;
    const r = evaluateContractReadiness({
      requested_action: "generate", policy, workflow_status: "draft",
      employee_ok: true, site_coherent: true, contract_matches_employee: true,
      template: { published: true, document_type: "employment_contract", allowed_renderers: ["pdf", "docx"] },
      context: ctx, renderer: "pdf", permissions: ["document.write"], role_keys: ["OWNER"],
      required_approvals: 1, approvals_valid: 0, legal_hold: false, is_latest_version: true, signed_or_superseded: false,
    });
    expect(r.missing_fields).toContain("company.legal_name");
    expect(r.blockers).toContain("missing_required_fields");
    expect(r.ready).toBe(false);
  });
});
