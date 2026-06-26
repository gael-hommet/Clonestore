// src/lib/pierre/v1/__integration__/p83-template-engine.itest.ts
// PHASE 8.3-B2 §7–§9 — template engine: secure merge, lifecycle, context builder.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import {
  mergeTemplate, buildGenerationContext, createTemplate, createTemplateVersion, validateTemplateVersion,
  submitTemplateForReview, approveTemplateVersion, publishTemplateVersion, deprecateTemplateVersion,
  getPublishedTemplateVersion, renderTemplatePreview, type TemplateField,
} from "../templates";
import type { CustomFieldDefinition } from "../field-policies";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

const CTX = () => ({ company: { display_name: "Acme" }, employee: { first_name: "Hélène", last_name: "Émard", salary: "secret" }, dates: { today: "2026-06-16" }, site: {}, employment: {}, contract: {}, manager: {}, validated_custom_fields: {} });

// ── §8 merge security (pure) ─────────────────────────────────────────────────
describe("§8 merge engine security", () => {
  const schema: TemplateField[] = [
    { field_key: "employee.first_name", source_path: "employee.first_name", required: true },
    { field_key: "company.display_name", source_path: "company.display_name", required: true },
    { field_key: "employee.salary", source_path: "employee.salary", sensitive: true },
  ];

  it("resolves allowed namespaces; never invents missing values", () => {
    const r = mergeTemplate("Bonjour {{employee.first_name}} de {{company.display_name}}. {{employee.middle_name}}", CTX(), schema, { canReadSensitive: false });
    expect(r.rendered_text).toContain("Hélène");
    expect(r.rendered_text).toContain("Acme");
    expect(r.rendered_text).toContain("{{employee.middle_name}}"); // undeclared → never resolved, left intact
    expect(r.unknown_fields).toContain("employee.middle_name");
    expect(r.missing_fields).not.toContain("employee.middle_name"); // unknown ≠ missing; safeGet never called
  });

  it("rejects __proto__ / constructor / prototype paths as invalid (no execution)", () => {
    const r = mergeTemplate("{{__proto__.x}} {{employee.constructor.name}} {{a.prototype.b}}", CTX(), schema, { canReadSensitive: true });
    expect(r.invalid_fields.length).toBeGreaterThanOrEqual(3);
    expect(r.ready_for_preview).toBe(false);
  });

  it("rejects non-allowed namespaces", () => {
    const r = mergeTemplate("{{secrets.api_key}} {{process.env.X}}", CTX(), schema, { canReadSensitive: true });
    expect(r.invalid_fields).toContain("secrets.api_key");
    expect(r.invalid_fields).toContain("process.env.X");
  });

  it("CANONICAL sensitivity (from the registry/custom def, NOT the template) is withheld without permission", () => {
    const defs = new Map<string, CustomFieldDefinition>([["secret_code", { field_key: "secret_code", data_type: "string", sensitivity: "sensitive", active: true }]]);
    const sch: TemplateField[] = [{ field_key: "validated_custom_fields.secret_code", source_path: "validated_custom_fields.secret_code", sensitive: false }]; // template lies "sensitive:false"
    const ctx = { ...CTX(), validated_custom_fields: { secret_code: "XYZ-SECRET" } };
    const without = mergeTemplate("Code: {{validated_custom_fields.secret_code}}", ctx, sch, { canReadSensitive: false, customDefs: defs });
    expect(without.rendered_text).not.toContain("XYZ-SECRET"); // registry wins over the template's false claim
    expect(without.missing_fields).toContain("validated_custom_fields.secret_code");
    const withPerm = mergeTemplate("Code: {{validated_custom_fields.secret_code}}", ctx, sch, { canReadSensitive: true, customDefs: defs });
    expect(withPerm.rendered_text).toContain("XYZ-SECRET");
    expect(withPerm.sensitive_fields_used).toContain("validated_custom_fields.secret_code");
  });

  it("a function in a canonical field's value is never resolved", () => {
    const ctx = { ...CTX(), employee: { ...CTX().employee, first_name: () => "x" } } as Record<string, unknown>;
    const r = mergeTemplate("{{employee.first_name}}", ctx, [{ field_key: "employee.first_name", source_path: "employee.first_name" }], { canReadSensitive: true });
    expect(r.rendered_text).toContain("{{employee.first_name}}");
    expect(r.missing_fields).toContain("employee.first_name");
  });

  it("context hash is deterministic", () => {
    const a = mergeTemplate("{{employee.first_name}}", CTX(), schema, { canReadSensitive: false });
    const b = mergeTemplate("{{employee.first_name}}", CTX(), schema, { canReadSensitive: false });
    expect(a.generation_context_hash).toBe(b.generation_context_hash);
    expect(a.template_content_hash).toBe(b.template_content_hash);
  });
});

// ── §7 lifecycle (DB) ────────────────────────────────────────────────────────
describe("§7 template lifecycle", () => {
  const schema: TemplateField[] = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];

  it("draft → review → approve → publish; published is immutable; getPublished works", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "Attestation", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "Bonjour {{employee.first_name}}", field_schema: schema });
    expect((await validateTemplateVersion(h.db, owner, v.id)).ok).toBe(true);
    await submitTemplateForReview(h.db, owner, v.id);
    await approveTemplateVersion(h.db, owner, v.id);
    await publishTemplateVersion(h.db, owner, v.id);
    const pub = await getPublishedTemplateVersion(h.db, owner, t.id);
    expect(pub?.id).toBe(v.id);
    await expect(submitTemplateForReview(h.db, owner, v.id)).rejects.toMatchObject({ code: "illegal_transition" });
  });

  it("rejects an undeclared placeholder + an invalid field path", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "X", document_type: "generic_hr_document" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}} {{employee.undeclared}}", field_schema: schema });
    expect((await validateTemplateVersion(h.db, owner, v.id)).ok).toBe(false);
    await expect(createTemplateVersion(h.db, owner, t.id, { body: "x", field_schema: [{ field_key: "secrets.x", source_path: "secrets.x" }] })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("approve requires review; publish requires approved; deprecate works", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "X", document_type: "generic_hr_document" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
    await expect(approveTemplateVersion(h.db, owner, v.id)).rejects.toMatchObject({ code: "illegal_transition" });
    await submitTemplateForReview(h.db, owner, v.id);
    await expect(publishTemplateVersion(h.db, owner, v.id)).rejects.toMatchObject({ code: "illegal_transition" });
    await approveTemplateVersion(h.db, owner, v.id);
    await publishTemplateVersion(h.db, owner, v.id);
    await deprecateTemplateVersion(h.db, owner, v.id);
    expect(await getPublishedTemplateVersion(h.db, owner, t.id)).toBeNull();
  });
});

// ── §9 generation context builder (DB) ───────────────────────────────────────
describe("§9 generation context builder", () => {
  async function mkEmployee(co: string, site?: string) {
    return (await h.db.query<{ id: string }>(`insert into pierre_rt_employees (id,company_id,first_name,last_name,professional_email,site_id,search_text) values ($1,$2,'Sophie','Durand','s@acme.test',$3,'s d') returning id`, [newUuid(), co, site ?? null])).rows[0].id;
  }

  it("builds a tenant/site-scoped context from canonical services; no sensitive comp injected", async () => {
    const empId = await mkEmployee(h.companyA);
    // a client-controlled "salary" must NOT leak in — the builder pulls only canonical fields
    await h.db.query(`insert into pierre_rt_employee_sensitive_data (id,company_id,employee_id,category,value_encrypted) values ($1,$2,$3,'compensation','enc::42000')`, [newUuid(), h.companyA, empId]);
    const { context, provenance, hash } = await buildGenerationContext(h.db, owner, { employee_id: empId });
    const c = context as Record<string, Record<string, unknown>>;
    expect(c.employee.first_name).toBe("Sophie");
    expect(c.company).toBeTruthy();
    expect(JSON.stringify(context)).not.toContain("42000"); // sensitive comp never injected
    expect(provenance.employee).toContain("360");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuses a cross-tenant employee", async () => {
    const empB = await mkEmployee(h.companyB);
    await expect(buildGenerationContext(h.db, owner, { employee_id: empB })).rejects.toMatchObject({ code: "not_found" });
  });

  it("preview merges canonical context", async () => {
    const empId = await mkEmployee(h.companyA);
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "X", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "Nom: {{employee.first_name}} {{employee.last_name}}", field_schema: [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }, { field_key: "employee.last_name", source_path: "employee.last_name", required: true }] });
    const preview = await renderTemplatePreview(h.db, owner, v.id, { employee_id: empId });
    expect(preview.rendered_text).toContain("Sophie");
    expect(preview.rendered_text).toContain("Durand");
  });
});
