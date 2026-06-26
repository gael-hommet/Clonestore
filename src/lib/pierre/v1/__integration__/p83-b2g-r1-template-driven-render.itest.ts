// PHASE 8.3-B2G-R1.3 — the rendered contract content is driven by the PUBLISHED template body,
// not hardcoded. Changing the template changes the PDF/DOCX text and the canonical hash; an
// unknown/forbidden template variable fails closed.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import pdfParse from "pdf-parse";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, configureSignatory } from "./b2g-helpers";
import { compileContractTemplate } from "../contract-template-compiler";
import { createTemplate, createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion } from "../templates";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  await configureSignatory(h, h.companyA);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

const SCHEMA = [
  { field_key: "employee.first_name", source_path: "employee.first_name", required: true },
  { field_key: "employee.role_title", source_path: "employee.role_title", required: true },
  { field_key: "employment.start_date", source_path: "employment.start_date", required: true },
];
async function publish(body: string) {
  const t = await createTemplate(h.db, owner, { key: `emp-${newUuid()}`, name: "Contrat", document_type: "employment_contract" });
  const v = await createTemplateVersion(h.db, owner, t.id, { body, renderer: "both", field_schema: SCHEMA });
  await submitTemplateForReview(h.db, owner, v.id); await approveTemplateVersion(h.db, owner, v.id); await publishTemplateVersion(h.db, owner, v.id);
  return t.id;
}
async function genContract(): Promise<{ id: string; canonical: string; pdfText: string }> {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  const res = await C.generateContract(h.db, owner, c.id, { renderers: ["pdf"], field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  const fid = (await h.db.query<{ rendered_pdf_file_id: string }>(`select rendered_pdf_file_id from pierre_rt_document_versions where id=$1`, [res.document_version_id])).rows[0].rendered_pdf_file_id;
  const key = (await h.db.query<{ object_key: string }>(`select object_key from pierre_rt_files where id=$1`, [fid])).rows[0].object_key;
  const bytes = await sd.storage.downloadBytes(key);
  const parsed = await pdfParse(bytes);
  return { id: c.id, canonical: res.canonical_hash, pdfText: parsed.text };
}

describe("R1.3 template-driven render", () => {
  it("the compiler substitutes ONLY declared+known variables and fails closed on unknowns", () => {
    const ctx = { document_type: "employment_contract", employee_id: "e", site_id: null, contract_id: "c", values: { "employee.first_name": "Ada", "employee.role_title": "Dev" }, sensitive_fields: [], custom_field_keys: [] };
    const okc = compileContractTemplate("# T\nBonjour {{employee.first_name}}, poste {{employee.role_title}}.", SCHEMA, ctx as never);
    expect(okc.unknown_fields).toEqual([]);
    expect(JSON.stringify(okc.clauses)).toContain("Ada");
    // declared in schema but ABSENT from the context → unknown (fail closed)
    const missing = compileContractTemplate("Début {{employment.start_date}}.", SCHEMA, ctx as never);
    expect(missing.unknown_fields).toContain("employment.start_date");
    // not declared in schema at all → unknown
    const undeclared = compileContractTemplate("Secret {{employee.ssn}}.", SCHEMA, ctx as never);
    expect(undeclared.unknown_fields).toContain("employee.ssn");
  });

  it("changing the published template changes the rendered PDF text AND the canonical hash", async () => {
    await publish("# Préambule\nCLAUSE_ALPHA pour {{employee.first_name}}, poste {{employee.role_title}}, début {{employment.start_date}}.");
    const a = await genContract();
    // publish a different template (different body) for the SAME document type
    await publish("# Préambule\nCLAUSE_OMEGA pour {{employee.first_name}}, poste {{employee.role_title}}, début {{employment.start_date}}.");
    const b = await genContract();
    expect(a.pdfText).toContain("CLAUSE_ALPHA");
    expect(a.pdfText).not.toContain("CLAUSE_OMEGA");
    expect(b.pdfText).toContain("CLAUSE_OMEGA");
    expect(a.canonical).not.toBe(b.canonical); // business content changed → canonical hash changed
  });
});
