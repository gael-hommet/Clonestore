// src/lib/pierre/v1/__integration__/b2g-helpers.ts
// Shared B2G integration helpers (NOT a test file). Seeds an employee and a PUBLISHED
// employment-contract template via the real template lifecycle.

import { join } from "path";
import { tmpdir } from "os";
import type { Harness } from "./harness";
import { newUuid } from "../sql";
import type { TenantContext } from "../tenant-context";
import { LocalFilesystemStorageProvider } from "../file-storage";
import { DeterministicTestScanProvider } from "../file-scan";
import { createTemplate, createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion } from "../templates";

export function storageDeps() {
  const storage = new LocalFilesystemStorageProvider({ bucket: "pierre-test", baseDir: join(tmpdir(), `pierre-b2g-${newUuid()}`) });
  const scanner = new DeterministicTestScanProvider();
  return { storage, scanner, deps: () => ({ storage, scanner }) };
}

export async function seedEmployee(h: Harness, company: string, over: Record<string, string | null> = {}): Promise<string> {
  const id = newUuid();
  await h.db.query(
    `insert into pierre_rt_employees (id, company_id, first_name, last_name, role_title, email) values ($1,$2,$3,$4,$5,$6)`,
    [id, company, over.first_name ?? "Ada", over.last_name ?? "Lovelace", over.role_title ?? "Ingénieure", over.email === undefined ? "ada@ex.com" : over.email]);
  return id;
}

/** R1.5 — configure the employer signatory so signature preparation can resolve recipients. */
export async function configureSignatory(h: Harness, company: string, email: string | null = "hr@acme.test", name = "Acme HR"): Promise<void> {
  await h.db.query(`update pierre_rt_companies set signatory_email=$2, signatory_name=$3 where id=$1`, [company, email, name]);
}

/** Create + publish an employment-contract template (renderer 'both'). Returns the template id. */
export async function publishContractTemplate(h: Harness, owner: TenantContext): Promise<string> {
  const t = await createTemplate(h.db, owner, { key: `emp-${newUuid()}`, name: "Contrat de travail", document_type: "employment_contract" });
  const v = await createTemplateVersion(h.db, owner, t.id, {
    body: "Contrat pour {{employee.first_name}} {{employee.last_name}}, poste {{employee.role_title}}, début {{employment.start_date}}.",
    renderer: "both",
    field_schema: [
      { field_key: "employee.first_name", source_path: "employee.first_name", required: true },
      { field_key: "employee.last_name", source_path: "employee.last_name", required: true },
      { field_key: "employee.role_title", source_path: "employee.role_title", required: true },
      { field_key: "employment.start_date", source_path: "employment.start_date", required: true },
    ],
  });
  await submitTemplateForReview(h.db, owner, v.id);
  await approveTemplateVersion(h.db, owner, v.id);
  await publishTemplateVersion(h.db, owner, v.id);
  await configureSignatory(h, owner.company_id); // so signature preparation can resolve recipients
  return t.id;
}
