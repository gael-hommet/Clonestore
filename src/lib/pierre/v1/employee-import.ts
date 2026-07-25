// src/lib/pierre/v1/employee-import.ts
// PHASE 8.2-C — CSV employee import: parse → map → validate → dedup → preview →
// commit (batch, idempotent) → rollback. Tenant + RBAC scoped. Robust to BOM,
// delimiter (",", ";", tab), quoted fields, embedded newlines, accents.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";
import { normalizeSearch, buildSearchText } from "./employee-search";

// ── CSV parser (RFC-4180-ish, delimiter-detecting) ───────────────────────────
export function parseCsv(input: string): { headers: string[]; rows: string[][] } {
  const text = input.replace(/^﻿/, ""); // strip BOM
  // Delimiter detection from the first physical line.
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const counts: Record<string, number> = { ",": (firstLine.match(/,/g) || []).length, ";": (firstLine.match(/;/g) || []).length, "\t": (firstLine.match(/\t/g) || []).length };
  const delim = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0) > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ",";

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') { inQuotes = true; }
    else if (c === delim) { record.push(field); field = ""; }
    else if (c === "\r") { /* swallow */ }
    else if (c === "\n") { record.push(field); records.push(record); field = ""; record = []; }
    else field += c;
  }
  if (field.length > 0 || record.length > 0) { record.push(field); records.push(record); }
  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  return { headers, rows: nonEmpty.slice(1) };
}

// ── Column mapping ───────────────────────────────────────────────────────────
const FIELD_ALIASES: Record<string, string> = {
  first_name: "first_name", firstname: "first_name", prenom: "first_name", "prénom": "first_name",
  last_name: "last_name", lastname: "last_name", nom: "last_name", surname: "last_name",
  email: "email", "e-mail": "email", courriel: "email",
  professional_email: "professional_email", email_pro: "professional_email", "email professionnel": "professional_email",
  personal_email: "personal_email", email_perso: "personal_email",
  phone: "phone", telephone: "phone", "téléphone": "phone", tel: "phone",
  employee_number: "employee_number", matricule: "employee_number", "numéro": "employee_number", number: "employee_number",
  role_title: "role_title", poste: "role_title", title: "role_title", fonction: "role_title",
  department: "department", departement: "department", "département": "department", service: "department",
  team: "team", equipe: "team", "équipe": "team",
  site_code: "site_code", site: "site_code", etablissement: "site_code", "établissement": "site_code",
  contract_type: "contract_type", contrat: "contract_type", contract: "contract_type",
  external_ref: "external_ref", external_id: "external_ref", ref: "external_ref",
  hired_at: "hired_at", date_embauche: "hired_at", hire_date: "hired_at", start_date: "hired_at",
};
const CONTRACT_MAP: Record<string, string> = { cdi: "cdi", cdd: "cdd", interim: "interim", "intérim": "interim", stage: "stage", internship: "stage", alternance: "alternance", apprentissage: "alternance", freelance: "freelance", indep: "freelance" };

function mapHeaders(headers: string[], override?: Record<string, string>): Array<string | null> {
  return headers.map((h) => {
    const key = normalizeSearch(h).replace(/\s+/g, "_");
    if (override && override[h]) return override[h];
    return FIELD_ALIASES[key] ?? FIELD_ALIASES[normalizeSearch(h)] ?? null;
  });
}

type NormalizedRow = Record<string, string | null>;
function normalizeRow(headerMap: Array<string | null>, cols: string[]): NormalizedRow {
  const out: NormalizedRow = {};
  headerMap.forEach((field, idx) => {
    if (!field) return;
    let v: string | null = (cols[idx] ?? "").trim();
    if (v === "") v = null;
    if (v && field === "contract_type") v = CONTRACT_MAP[normalizeSearch(v)] ?? "other";
    if (v && field === "hired_at") { const d = parseDate(v); v = d; }
    out[field] = v;
  });
  return out;
}

function parseDate(v: string): string | null {
  // Accept ISO and dd/mm/yyyy.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function rowErrors(r: NormalizedRow): string[] {
  const e: string[] = [];
  if (!r.first_name) e.push("missing first_name");
  if (!r.last_name) e.push("missing last_name");
  for (const f of ["email", "professional_email", "personal_email"] as const) {
    if (r[f] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r[f] as string)) e.push(`invalid ${f}`);
  }
  return e;
}

// ── Dedup: OR semantics (a row is a duplicate if ANY configured key matches) ──
type DedupDetail = { matched_key: string; matched_value: string; existing_employee_id: string | null; scope: "existing" | "internal"; first_seen_row?: number; decision: "skip" | "update" };

/** Normalized value of a single dedup key for a row (null if not present). */
function keyValueFor(r: Record<string, unknown>, key: string): string | null {
  if (key === "name_dob") {
    const fn = normalizeSearch(r.first_name as string | null);
    const ln = normalizeSearch(r.last_name as string | null);
    const dob = normalizeSearch((r.birth_date ?? r.date_of_birth) as string | null);
    if (fn && ln) return dob ? `${fn}|${ln}|${dob}` : `${fn}|${ln}`;
    return null;
  }
  const v = r[key];
  return v ? normalizeSearch(String(v)) : null;
}

/** Mask a matched value when it is sensitive (emails, birth date). */
function maskValue(key: string, value: string): string {
  if (key.includes("email")) { const [loc, dom] = value.split("@"); return `${(loc ?? "").slice(0, 1)}***${dom ? `@${dom}` : ""}`; }
  if (key === "name_dob") return value.replace(/\|[^|]+$/, "|***");
  return value;
}

// ── Batched staging insert (NOT one statement per row) ───────────────────────
async function insertImportRowsBatch(
  db: SqlExecutor, companyId: string, batchId: string,
  items: Array<{ row_number: number; raw: unknown; normalized: unknown; outcome: string; dedup_signature: string | null; errors: string[] }>,
): Promise<void> {
  const CHUNK = 1000;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK).map((it) => ({ id: newUuid(), row_number: it.row_number, raw: it.raw, normalized: it.normalized, outcome: it.outcome, dedup_signature: it.dedup_signature, errors: it.errors }));
    await db.query(
      `insert into pierre_rt_employee_import_rows (id, company_id, batch_id, row_number, raw, normalized, outcome, dedup_signature, errors)
       select (e->>'id')::uuid, $1, $2, (e->>'row_number')::int, e->'raw', e->'normalized', e->>'outcome', e->>'dedup_signature',
              coalesce(array(select jsonb_array_elements_text(e->'errors')), array[]::text[])
         from jsonb_array_elements($3::jsonb) e`,
      [companyId, batchId, JSON.stringify(chunk)]);
  }
}

// ── Preview ──────────────────────────────────────────────────────────────────
export type PreviewInput = { csv: string; mapping?: Record<string, string>; dedup_keys?: string[]; allow_partial?: boolean; idempotency_key?: string };
export type ImportSummary = { batch_id: string; status: string; total_rows: number; valid_rows: number; error_rows: number; duplicate_rows: number; inserted_rows: number; idempotent: boolean };

type PreviewRow = { row_number: number; outcome: string; errors: string[]; duplicate?: DedupDetail };

export async function previewImport(db: SqlExecutor, ctx: TenantContext, input: PreviewInput): Promise<ImportSummary & { rows: PreviewRow[] }> {
  requirePermission(ctx, "employee.write");
  const dedupKeys = input.dedup_keys && input.dedup_keys.length > 0 ? input.dedup_keys : ["employee_number", "professional_email"];

  // Idempotent preview/commit: a committed batch with the same key is returned as-is.
  if (input.idempotency_key) {
    const ex = await db.query<{ id: string; status: string; total_rows: number; valid_rows: number; error_rows: number; duplicate_rows: number; inserted_rows: number }>(
      `select id, status, total_rows, valid_rows, error_rows, duplicate_rows, inserted_rows from pierre_rt_employee_import_batches where company_id=$1 and idempotency_key=$2`, [ctx.company_id, input.idempotency_key]);
    if (ex.rows.length > 0) {
      const b = ex.rows[0];
      const raw = (await db.query<{ row_number: number; outcome: string; errors: string[]; normalized: { _dedup?: DedupDetail } | null }>(`select row_number, outcome, errors, normalized from pierre_rt_employee_import_rows where company_id=$1 and batch_id=$2 order by row_number`, [ctx.company_id, b.id])).rows;
      const rows: PreviewRow[] = raw.map((r) => ({ row_number: r.row_number, outcome: r.outcome, errors: r.errors, duplicate: r.normalized?._dedup }));
      return { batch_id: b.id, status: b.status, total_rows: b.total_rows, valid_rows: b.valid_rows, error_rows: b.error_rows, duplicate_rows: b.duplicate_rows, inserted_rows: b.inserted_rows, idempotent: true, rows };
    }
  }

  const { headers, rows } = parseCsv(input.csv);
  if (headers.length === 0) throw Errors.validation("CSV has no header row");
  const headerMap = mapHeaders(headers, input.mapping);
  if (!headerMap.includes("first_name") || !headerMap.includes("last_name")) throw Errors.validation("CSV must map first_name and last_name columns");

  // Preload existing values per dedup key (OR semantics, efficient at scale).
  const existing = (await db.query<{ id: string; employee_number: string | null; professional_email: string | null; external_ref: string | null; first_name: string; last_name: string }>(
    `select id, employee_number, professional_email, external_ref, first_name, last_name from pierre_rt_employees where company_id=$1 and archived_at is null`, [ctx.company_id])).rows;
  const existingByKey: Record<string, Map<string, string>> = {};
  const seenByKey: Record<string, Map<string, number>> = {};
  for (const k of dedupKeys) { existingByKey[k] = new Map(); seenByKey[k] = new Map(); }
  for (const e of existing) {
    for (const k of dedupKeys) { const v = keyValueFor(e as unknown as Record<string, unknown>, k); if (v && !existingByKey[k].has(v)) existingByKey[k].set(v, e.id); }
  }

  const batchId = newUuid();
  await db.query(`insert into pierre_rt_employee_import_batches (id, company_id, idempotency_key, status, dedup_keys, allow_partial, created_by) values ($1,$2,$3,'preview',$4,$5,$6)`,
    [batchId, ctx.company_id, input.idempotency_key ?? null, dedupKeys, !!input.allow_partial, ctx.user_id]);

  let valid = 0, errs = 0, dups = 0;
  const rowOut: PreviewRow[] = [];
  const toInsert: Array<{ row_number: number; raw: unknown; normalized: unknown; outcome: string; dedup_signature: string | null; errors: string[] }> = [];
  for (let i = 0; i < rows.length; i++) {
    const norm = normalizeRow(headerMap, rows[i]);
    const errors = rowErrors(norm);
    let outcome: string;
    let dup: DedupDetail | null = null;
    if (errors.length > 0) { outcome = "error"; errs++; }
    else {
      // OR semantics: duplicate if ANY single configured key matches existing OR earlier-in-batch.
      for (const k of dedupKeys) {
        const v = keyValueFor(norm, k);
        if (!v) continue;
        if (existingByKey[k].has(v)) { dup = { matched_key: k, matched_value: maskValue(k, v), existing_employee_id: existingByKey[k].get(v)!, scope: "existing", decision: "skip" }; break; }
        if (seenByKey[k].has(v)) { dup = { matched_key: k, matched_value: maskValue(k, v), existing_employee_id: null, scope: "internal", first_seen_row: seenByKey[k].get(v)!, decision: "skip" }; break; }
      }
      if (dup) { outcome = "duplicate"; dups++; }
      else { outcome = "valid"; valid++; for (const k of dedupKeys) { const v = keyValueFor(norm, k); if (v) seenByKey[k].set(v, i + 1); } }
    }
    const sig = dup ? `${dup.matched_key}=${dup.matched_value}` : null;
    const normPersist = dup ? { ...norm, _dedup: dup } : norm;
    toInsert.push({ row_number: i + 1, raw: rows[i], normalized: normPersist, outcome, dedup_signature: sig, errors });
    rowOut.push({ row_number: i + 1, outcome, errors, duplicate: dup ?? undefined });
  }
  await insertImportRowsBatch(db, ctx.company_id, batchId, toInsert);
  await db.query(`update pierre_rt_employee_import_batches set total_rows=$2, valid_rows=$3, error_rows=$4, duplicate_rows=$5 where id=$1`, [batchId, rows.length, valid, errs, dups]);
  return { batch_id: batchId, status: "preview", total_rows: rows.length, valid_rows: valid, error_rows: errs, duplicate_rows: dups, inserted_rows: 0, idempotent: false, rows: rowOut };
}

// ── Commit ───────────────────────────────────────────────────────────────────
export async function commitImport(db: SqlExecutor, ctx: TenantContext, batchId: string): Promise<ImportSummary> {
  requirePermission(ctx, "employee.write");
  return db.transaction(async (tx) => {
    const b = await tx.query<{ id: string; status: string; allow_partial: boolean; error_rows: number; idempotency_key: string | null }>(
      `select id, status, allow_partial, error_rows, idempotency_key from pierre_rt_employee_import_batches where company_id=$1 and id=$2 for update`, [ctx.company_id, batchId]);
    if (b.rows.length === 0) throw Errors.notFound("Import batch not found");
    const batch = b.rows[0];
    if (batch.status === "committed") {
      // Idempotent rerun.
      const s = await batchSummary(tx, ctx, batchId);
      return { ...s, idempotent: true };
    }
    if (batch.status !== "preview") throw Errors.conflict(`Batch is ${batch.status}`);
    if (!batch.allow_partial && batch.error_rows > 0) throw Errors.validation(`Batch has ${batch.error_rows} error rows; set allow_partial to commit valid rows only`);

    const valid = (await tx.query<{ id: string; normalized: NormalizedRow; row_number: number }>(
      `select id, normalized, row_number from pierre_rt_employee_import_rows where company_id=$1 and batch_id=$2 and outcome='valid' order by row_number`, [ctx.company_id, batchId])).rows;

    // Resolve sites once (code/name → id) instead of one query per row.
    const siteRows = (await tx.query<{ id: string; code: string | null; name: string }>(`select id, code, name from pierre_rt_sites where company_id=$1 and archived_at is null`, [ctx.company_id])).rows;
    const siteByKey = new Map<string, string>();
    for (const s of siteRows) { if (s.code) siteByKey.set(normalizeSearch(s.code), s.id); siteByKey.set(normalizeSearch(s.name), s.id); }

    // Build employee payloads in memory (search_text computed in JS), then insert
    // and back-link in set-based batches — NOT one INSERT per row.
    const payloads = valid.map((r) => {
      const n = r.normalized;
      const empId = newUuid();
      const siteId = n.site_code ? (siteByKey.get(normalizeSearch(n.site_code)) ?? null) : null;
      const search = buildSearchText(n as never);
      return {
        id: empId, import_row_id: r.id, site_id: siteId,
        external_ref: n.external_ref ?? null, first_name: n.first_name, last_name: n.last_name,
        email: n.email ?? null, phone: n.phone ?? null, contract_type: n.contract_type ?? "cdi",
        role_title: n.role_title ?? null, hired_at: n.hired_at ?? null, search_text: search,
        employee_number: n.employee_number ?? null, professional_email: n.professional_email ?? null,
        personal_email: n.personal_email ?? null, department: n.department ?? null, team: n.team ?? null,
      };
    });

    const CHUNK = 1000;
    let inserted = 0;
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const chunk = payloads.slice(i, i + CHUNK);
      const j = JSON.stringify(chunk);
      // 1. employees (set-based)
      await tx.query(
        `insert into pierre_rt_employees
           (id, company_id, site_id, external_ref, first_name, last_name, email, phone, status, contract_type, role_title, sensitivity, hired_at, metadata, search_text, employee_number, professional_email, personal_email, department, team)
         select (e->>'id')::uuid, $1, nullif(e->>'site_id','')::uuid, e->>'external_ref', e->>'first_name', e->>'last_name', e->>'email', e->>'phone',
                'active', coalesce(nullif(e->>'contract_type',''),'cdi'), e->>'role_title', 'normal', nullif(e->>'hired_at','')::date, '{}'::jsonb, e->>'search_text',
                e->>'employee_number', e->>'professional_email', e->>'personal_email', e->>'department', e->>'team'
           from jsonb_array_elements($2::jsonb) e`,
        [ctx.company_id, j]);
      // 2. initial status history (set-based)
      await tx.query(
        `insert into pierre_rt_employee_status_history (id, company_id, employee_id, prev_status, new_status)
         select gen_random_uuid(), $1, (e->>'id')::uuid, null, 'active' from jsonb_array_elements($2::jsonb) e`,
        [ctx.company_id, j]);
      // 3. import event (set-based, audit)
      await tx.query(
        `insert into pierre_rt_employee_events (id, company_id, employee_id, type, actor_type, actor_id, metadata)
         select gen_random_uuid(), $1, (e->>'id')::uuid, 'employee_imported', 'system', $3, jsonb_build_object('batch_id',$4::text) from jsonb_array_elements($2::jsonb) e`,
        [ctx.company_id, j, ctx.user_id, batchId]);
      // 4. back-link import rows → employees (set-based)
      await tx.query(
        `update pierre_rt_employee_import_rows r set outcome='inserted', employee_id=(e->>'id')::uuid
           from jsonb_array_elements($2::jsonb) e
          where r.company_id=$1 and r.id=(e->>'import_row_id')::uuid`,
        [ctx.company_id, j]);
      inserted += chunk.length;
    }
    await tx.query(`update pierre_rt_employee_import_batches set status='committed', inserted_rows=$3, committed_at=now() where company_id=$1 and id=$2`, [ctx.company_id, batchId, inserted]);
    await tx.query(`insert into pierre_rt_data_access_log (id, company_id, subject_type, subject_id, actor_user_id, action) values ($1,$2,'import',$3,$4,$5)`,
      [newUuid(), ctx.company_id, batchId, ctx.user_id, `import_committed:${inserted}`]);
    const s = await batchSummary(tx, ctx, batchId);
    return { ...s, idempotent: false };
  });
}

export async function rollbackImport(db: SqlExecutor, ctx: TenantContext, batchId: string): Promise<ImportSummary> {
  requirePermission(ctx, "employee.write");
  return db.transaction(async (tx) => {
    const b = await tx.query<{ status: string }>(`select status from pierre_rt_employee_import_batches where company_id=$1 and id=$2 for update`, [ctx.company_id, batchId]);
    if (b.rows.length === 0) throw Errors.notFound("Import batch not found");
    if (b.rows[0].status !== "committed") throw Errors.conflict(`Only committed batches can be rolled back (is ${b.rows[0].status})`);
    const cnt = (await tx.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_import_rows where company_id=$1 and batch_id=$2 and outcome='inserted' and employee_id is not null`, [ctx.company_id, batchId])).rows[0].n;
    // Set-based delete (cascades satellites via FK) — NOT one delete per row.
    await tx.query(
      `delete from pierre_rt_employees e
        using pierre_rt_employee_import_rows r
        where r.company_id=$1 and r.batch_id=$2 and r.outcome='inserted' and r.employee_id = e.id and e.company_id=$1`,
      [ctx.company_id, batchId]);
    await tx.query(`update pierre_rt_employee_import_rows set outcome='valid', employee_id=null where company_id=$1 and batch_id=$2 and outcome='inserted'`, [ctx.company_id, batchId]);
    const inserted = { length: cnt };
    await tx.query(`update pierre_rt_employee_import_batches set status='rolled_back', inserted_rows=0, rolled_back_at=now() where company_id=$1 and id=$2`, [ctx.company_id, batchId]);
    await tx.query(`insert into pierre_rt_data_access_log (id, company_id, subject_type, subject_id, actor_user_id, action) values ($1,$2,'import',$3,$4,$5)`,
      [newUuid(), ctx.company_id, batchId, ctx.user_id, `import_rolled_back:${inserted.length}`]);
    return batchSummary(tx, ctx, batchId);
  });
}

export async function getImportBatch(db: SqlExecutor, ctx: TenantContext, batchId: string): Promise<ImportSummary & { rows: Array<{ row_number: number; outcome: string; errors: string[]; employee_id: string | null; duplicate?: DedupDetail }> }> {
  requirePermission(ctx, "employee.read");
  const s = await batchSummary(db, ctx, batchId);
  const raw = (await db.query<{ row_number: number; outcome: string; errors: string[]; employee_id: string | null; normalized: { _dedup?: DedupDetail } | null }>(
    `select row_number, outcome, errors, employee_id, normalized from pierre_rt_employee_import_rows where company_id=$1 and batch_id=$2 order by row_number`, [ctx.company_id, batchId])).rows;
  const rows = raw.map((r) => ({ row_number: r.row_number, outcome: r.outcome, errors: r.errors, employee_id: r.employee_id, duplicate: r.normalized?._dedup }));
  return { ...s, rows };
}

async function batchSummary(db: SqlExecutor, ctx: TenantContext, batchId: string): Promise<ImportSummary> {
  const { rows } = await db.query<{ id: string; status: string; total_rows: number; valid_rows: number; error_rows: number; duplicate_rows: number; inserted_rows: number }>(
    `select id, status, total_rows, valid_rows, error_rows, duplicate_rows, inserted_rows from pierre_rt_employee_import_batches where company_id=$1 and id=$2`, [ctx.company_id, batchId]);
  if (rows.length === 0) throw Errors.notFound("Import batch not found");
  const b = rows[0];
  return { batch_id: b.id, status: b.status, total_rows: b.total_rows, valid_rows: b.valid_rows, error_rows: b.error_rows, duplicate_rows: b.duplicate_rows, inserted_rows: b.inserted_rows, idempotent: false };
}
