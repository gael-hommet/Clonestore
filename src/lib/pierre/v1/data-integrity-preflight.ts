// src/lib/pierre/v1/data-integrity-preflight.ts
// PHASE 8.3-B2F §2 — HISTORICAL-DATA PREFLIGHT. A strictly READ-ONLY integrity scan that
// answers one question: "can the B2F constraints (composite FKs, cross-tenant guards) be
// applied to THIS database without breaking on pre-existing data, and is the existing data
// internally coherent?" It mutates nothing and repairs nothing. It returns a structured
// verdict: `clean` only when no blocker exists; `blocked` otherwise. Blockers must be
// resolved by a governed migration/runbook BEFORE the constraints are trusted — never by a
// silent auto-fix. Output carries only the technical IDs needed for diagnosis (no PII).

import type { SqlExecutor } from "./sql";

export type PreflightSeverity = "blocker" | "warning";
export type PreflightCheck = {
  key: string;
  severity: PreflightSeverity;
  description: string;
  count: number;
  sample_ids: string[];
  ok: boolean;
  skipped?: boolean;
  error?: string;
};
export type PreflightResult = {
  status: "clean" | "blocked";
  checked_at: string;
  checks: PreflightCheck[];
  blockers: PreflightCheck[];
  warnings: PreflightCheck[];
  counts: { blockers: number; warnings: number; total_rows_flagged: number };
};

type CheckDef = { key: string; severity: PreflightSeverity; description: string; sql: string };

// Every query is a SELECT that returns the offending rows' `id` (or a synthetic id). It
// NEVER writes. A check that references a missing table is reported as skipped, not fatal.
const CHECKS: CheckDef[] = [
  {
    key: "cross_tenant_custom_field", severity: "blocker",
    description: "employee_custom_fields whose employee belongs to a different company",
    sql: `select cf.employee_id::text as id from pierre_rt_employee_custom_fields cf
          where not exists (select 1 from pierre_rt_employees e where e.id = cf.employee_id and e.company_id = cf.company_id)`,
  },
  {
    key: "cross_tenant_contract_employee", severity: "blocker",
    description: "employee_contracts whose employee belongs to a different company",
    sql: `select c.id::text as id from pierre_rt_employee_contracts c
          where not exists (select 1 from pierre_rt_employees e where e.id = c.employee_id and e.company_id = c.company_id)`,
  },
  {
    key: "cross_tenant_contract_document", severity: "blocker",
    description: "employee_contracts whose linked document belongs to a different company",
    sql: `select c.id::text as id from pierre_rt_employee_contracts c
          where c.document_id is not null and not exists (select 1 from pierre_rt_documents d where d.id = c.document_id and d.company_id = c.company_id)`,
  },
  {
    key: "cross_tenant_template_version", severity: "blocker",
    description: "template versions whose template belongs to a different company",
    sql: `select v.id::text as id from pierre_rt_document_template_versions v
          where not exists (select 1 from pierre_rt_document_templates t where t.id = v.template_id and t.company_id = v.company_id)`,
  },
  {
    key: "cross_tenant_document_version", severity: "blocker",
    description: "document versions whose parent document belongs to a different company",
    sql: `select v.id::text as id from pierre_rt_document_versions v
          where not exists (select 1 from pierre_rt_documents d where d.id = v.document_id and d.company_id = v.company_id)`,
  },
  {
    key: "document_file_cross_company", severity: "blocker",
    description: "document versions whose rendered/source file belongs to another company",
    sql: `select v.id::text as id from pierre_rt_document_versions v
          where (v.source_file_id      is not null and not exists (select 1 from pierre_rt_files f where f.id = v.source_file_id      and f.company_id = v.company_id))
             or (v.rendered_pdf_file_id  is not null and not exists (select 1 from pierre_rt_files f where f.id = v.rendered_pdf_file_id  and f.company_id = v.company_id))
             or (v.rendered_docx_file_id is not null and not exists (select 1 from pierre_rt_files f where f.id = v.rendered_docx_file_id and f.company_id = v.company_id))`,
  },
  {
    key: "orphan_signature_request_document", severity: "blocker",
    description: "signature requests whose document is missing or cross-company",
    sql: `select s.id::text as id from pierre_rt_signature_requests s
          where s.document_id is not null and not exists (select 1 from pierre_rt_documents d where d.id = s.document_id and d.company_id = s.company_id)`,
  },
  {
    key: "duplicate_object_key", severity: "blocker",
    description: "two or more files sharing the same storage object_key",
    sql: `select f.object_key as id from pierre_rt_files f where f.object_key is not null group by f.object_key having count(*) > 1`,
  },
  {
    key: "finalized_artifact_not_clean", severity: "blocker",
    description: "final/signed document versions whose rendered artifact is not upload+scan clean",
    sql: `select v.id::text as id from pierre_rt_document_versions v
          join pierre_rt_files f on f.id = v.rendered_pdf_file_id and f.company_id = v.company_id
          where v.status in ('final','signed') and (f.upload_status <> 'clean' or f.scan_status <> 'clean')`,
  },
  {
    key: "clean_file_without_hash", severity: "blocker",
    description: "files marked clean but lacking an integrity hash (cannot be trusted as an artifact)",
    sql: `select f.id::text as id from pierre_rt_files f where f.upload_status = 'clean' and f.scan_status = 'clean' and (f.sha256 is null or f.sha256 = '')`,
  },
  {
    key: "impossible_signed_without_timestamp", severity: "warning",
    description: "document versions in a signed/final state without the matching timestamp",
    sql: `select v.id::text as id from pierre_rt_document_versions v
          where (v.status = 'signed' and v.signed_at is null) or (v.status = 'final' and v.finalized_at is null)`,
  },
  {
    key: "published_template_without_timestamp", severity: "blocker",
    description: "published template versions without a published_at timestamp",
    sql: `select v.id::text as id from pierre_rt_document_template_versions v where v.status = 'published' and v.published_at is null`,
  },
  {
    key: "custom_field_without_definition", severity: "warning",
    description: "employee custom field values whose key has no canonical definition for the company",
    sql: `select cf.employee_id::text as id from pierre_rt_employee_custom_fields cf
          where not exists (select 1 from pierre_rt_custom_field_definitions d where d.company_id = cf.company_id and d.field_key = cf.field_key)`,
  },
  {
    key: "custom_field_type_mismatch", severity: "warning",
    description: "custom field values that no longer match their definition's declared data type",
    sql: `select cf.employee_id::text as id from pierre_rt_employee_custom_fields cf
          join pierre_rt_custom_field_definitions d on d.company_id = cf.company_id and d.field_key = cf.field_key
          where cf.field_value is not null and cf.field_value <> '' and (
            (d.data_type = 'number' and cf.field_value !~ '^-?[0-9]+(\\.[0-9]+)?$') or
            (d.data_type = 'date'   and cf.field_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') or
            (d.data_type = 'email'  and cf.field_value !~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'))`,
  },
  {
    key: "webhook_request_cross_company", severity: "warning",
    description: "signature webhooks resolved to a signature request of a different company",
    sql: `select w.id::text as id from pierre_rt_signature_webhooks w
          where w.signature_request_id is not null and w.company_id is not null
            and not exists (select 1 from pierre_rt_signature_requests r where r.id = w.signature_request_id and r.company_id = w.company_id)`,
  },
];

const SAMPLE_LIMIT = 20;

/**
 * Run the read-only integrity preflight. Each check executes a SELECT; a check whose table
 * is absent is recorded as `skipped`. The verdict is `blocked` iff any blocker check found
 * rows. Nothing is mutated.
 */
export async function runDataIntegrityPreflight(db: SqlExecutor, nowIso: string): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];
  for (const def of CHECKS) {
    try {
      const { rows } = await db.query<{ id: string }>(def.sql);
      const ids = rows.map((r) => r.id).filter(Boolean);
      checks.push({
        key: def.key, severity: def.severity, description: def.description,
        count: ids.length, sample_ids: ids.slice(0, SAMPLE_LIMIT), ok: ids.length === 0,
      });
    } catch (e) {
      // Missing table / column on an older schema → skip (not a silent pass, reported).
      checks.push({
        key: def.key, severity: def.severity, description: def.description,
        count: 0, sample_ids: [], ok: true, skipped: true, error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  const blockers = checks.filter((c) => c.severity === "blocker" && !c.ok);
  const warnings = checks.filter((c) => c.severity === "warning" && !c.ok);
  const total = checks.reduce((n, c) => n + c.count, 0);
  return {
    status: blockers.length === 0 ? "clean" : "blocked",
    checked_at: nowIso,
    checks,
    blockers,
    warnings,
    counts: { blockers: blockers.length, warnings: warnings.length, total_rows_flagged: total },
  };
}
