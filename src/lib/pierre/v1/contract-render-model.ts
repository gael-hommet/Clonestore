// src/lib/pierre/v1/contract-render-model.ts
// PHASE 8.3-B2G §3 — ONE canonical business representation of a contract, rendered to BOTH
// PDF and DOCX from the same model (no divergent engines). Three distinct hashes: the
// canonical business hash (format-independent), the PDF bytes hash, the DOCX bytes hash.

import { createHash } from "crypto";
import { PdfRenderer, DocxRenderer, type RenderInput, type RenderOutput } from "./renderers";
import type { ContractPolicy } from "./contract-policies";
import type { StrictGenerationContext } from "./generation-context";
import type { CompiledTemplate } from "./contract-template-compiler";

export type ContractClause = { heading: string; paragraphs: string[] };
export type ContractTable = { heading?: string; headers?: string[]; rows: string[][] };
export type ContractRenderModel = {
  reference: string;
  version: number;
  is_final: boolean;
  title: string;
  company_name: string;
  employee_name: string;
  contract_type: string;
  contract_type_label: string;
  signature_level: string;
  fields: Array<{ label: string; value: string }>;
  clauses: ContractClause[];
  tables: ContractTable[];
  signatures: Array<{ role: string; name?: string }>;
  generated_at: string;
};

const v = (ctx: StrictGenerationContext, path: string): string => {
  const x = ctx.values[path];
  return x === null || x === undefined ? "—" : String(x);
};

/**
 * Build the canonical contract model from a strict generation context + policy + metadata.
 * Deterministic given the same inputs. `generatedAt` is supplied by the caller (no implicit
 * clock) so the model is reproducible.
 */
export function buildContractRenderModel(args: {
  policy: ContractPolicy;
  context: StrictGenerationContext;
  compiled: CompiledTemplate;       // R1.3 — the clauses come from the PUBLISHED template body
  reference: string;
  version: number;
  is_final: boolean;
  generated_at: string;
}): ContractRenderModel {
  const { policy, context, compiled, reference, version, is_final, generated_at } = args;
  const company = v(context, "company.legal_name");
  const employee = `${v(context, "employee.first_name")} ${v(context, "employee.last_name")}`.trim();

  // Engine-provided recap (header metadata), NOT the contractual clauses.
  const fields: Array<{ label: string; value: string }> = [
    { label: "Type de contrat", value: policy.label },
    { label: "Poste", value: v(context, "employee.role_title") },
    { label: "Date de début", value: v(context, "employment.start_date") },
  ];
  if (policy.fixed_term) fields.push({ label: "Date de fin", value: v(context, "employment.end_date") });
  if (context.values["employment.weekly_hours"] !== undefined && context.values["employment.weekly_hours"] !== null) fields.push({ label: "Temps de travail", value: v(context, "employment.weekly_hours") });
  if (context.values["compensation.base_salary"] !== undefined && context.values["compensation.base_salary"] !== null) fields.push({ label: "Rémunération brute", value: v(context, "compensation.base_salary") });
  if (context.values["site.name"] !== undefined && context.values["site.name"] !== null) fields.push({ label: "Site", value: v(context, "site.name") });

  // R1.3 — the contractual clauses are compiled FROM THE TEMPLATE, never hardcoded.
  const clauses: ContractClause[] = compiled.clauses.length > 0 ? compiled.clauses : [{ heading: "", paragraphs: ["(template vide)"] }];
  const tables: ContractTable[] = [{ heading: "Récapitulatif", headers: ["Champ", "Valeur"], rows: fields.map((f) => [f.label, f.value]) }, ...compiled.tables];
  const signatures = [{ role: "L'employeur", name: company }, { role: "Le salarié", name: employee }];

  return {
    reference, version, is_final,
    title: policy.label.toUpperCase(),
    company_name: company, employee_name: employee,
    contract_type: policy.key, contract_type_label: policy.label,
    signature_level: policy.signature_level,
    fields, clauses, tables, signatures, generated_at,
  };
}

function toRenderInput(model: ContractRenderModel): RenderInput {
  return {
    title: model.title,
    reference: `Réf. ${model.reference} — version ${model.version}`,
    subtitle: `${model.company_name} · ${model.employee_name}`,
    watermark: model.is_final ? undefined : "BROUILLON",
    footer: `${model.company_name} — généré le ${model.generated_at.slice(0, 10)}`,
    blocks: [
      ...model.clauses.map((c) => ({ heading: c.heading, lines: c.paragraphs })),
      ...model.tables.map((t) => ({ heading: t.heading, table: { headers: t.headers, rows: t.rows } })),
      { heading: "Signatures", signatures: model.signatures, pageBreak: false },
    ],
  };
}

export function renderContractPdf(model: ContractRenderModel): RenderOutput { return PdfRenderer.render(toRenderInput(model)); }
export function renderContractDocx(model: ContractRenderModel): RenderOutput { return DocxRenderer.render(toRenderInput(model)); }

/**
 * Canonical business-content hash — format-independent. Excludes presentation-only fields
 * (generated_at, is_final/watermark) so a draft and a final render of the SAME content share
 * one canonical hash, while their PDF/DOCX byte hashes differ.
 */
export function canonicalContractHash(model: ContractRenderModel): string {
  const canonical = {
    reference: model.reference, version: model.version, contract_type: model.contract_type,
    company_name: model.company_name, employee_name: model.employee_name, signature_level: model.signature_level,
    fields: model.fields, clauses: model.clauses, tables: model.tables,
    signatures: model.signatures.map((s) => ({ role: s.role, name: s.name ?? null })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
