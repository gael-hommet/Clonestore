// src/lib/pierre/v1/employee-search.ts
// PHASE 8.2 / 8.2-C — employee search: accent-insensitive, typo-tolerant, scoped.
//
// `search_text` is an app-maintained normalized column (lowercased, diacritics
// stripped, includes identity/contact/role/site/manager tokens). Two engines:
//  - PRODUCTION: a pg_trgm GIN index (created in migration v4 when available)
//    powers `%` similarity search — accent + typo tolerant, index-backed.
//  - FALLBACK (PGlite / no pg_trgm): token-AND substring match (order-independent,
//    so "nom prénom" == "prénom nom") plus a JS trigram re-rank that tolerates a
//    single-letter typo. Proven by integration tests.

import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";
import { requirePermission, siteScopeArray } from "./rbac";
import type { EmployeeRow } from "./employees";

/** Normalize text for accent-insensitive matching. */
export function normalizeSearch(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Build the search_text from an employee's searchable fields (incl. site/manager when provided). */
export function buildSearchText(e: { first_name?: string | null; last_name?: string | null; preferred_name?: string | null; professional_email?: string | null; personal_email?: string | null; email?: string | null; phone?: string | null; employee_number?: string | null; role_title?: string | null; job_family?: string | null; department?: string | null; team?: string | null; external_ref?: string | null; site_name?: string | null; manager_name?: string | null }): string {
  return normalizeSearch([
    e.first_name, e.last_name, e.preferred_name, e.professional_email, e.personal_email, e.email,
    e.phone, e.employee_number, e.role_title, e.job_family, e.department, e.team, e.external_ref,
    e.site_name, e.manager_name,
  ].filter(Boolean).join(" "));
}

// ── JS trigram similarity (approximates pg_trgm) ─────────────────────────────
function trigrams(s: string): Set<string> {
  const p = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  return out;
}
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = trigrams(a), tb = trigrams(b);
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter++; });
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

let trgmCache: boolean | null = null;
export async function pgTrgmAvailable(db: SqlExecutor): Promise<boolean> {
  if (trgmCache !== null) return trgmCache;
  try {
    const { rows } = await db.query<{ ok: boolean }>(`select exists(select 1 from pg_extension where extname='pg_trgm') as ok`);
    trgmCache = !!rows[0]?.ok;
  } catch { trgmCache = false; }
  return trgmCache;
}
/** Test seam: reset the cached extension probe. */
export function __resetTrgmCache(): void { trgmCache = null; }

export async function searchEmployees(db: SqlExecutor, ctx: TenantContext, query: string, limit = 20): Promise<EmployeeRow[]> {
  requirePermission(ctx, "employee.read");
  const norm = normalizeSearch(query);
  if (norm.length === 0) return [];
  const lim = Math.max(1, Math.min(50, limit));
  const scope = siteScopeArray(ctx);

  // Production path: pg_trgm similarity (accent + typo tolerant, GIN-indexed).
  if (await pgTrgmAvailable(db)) {
    const params: unknown[] = [ctx.company_id, norm];
    let where = `company_id = $1 and archived_at is null and (search_text % $2 or search_text like '%' || $2 || '%')`;
    if (scope) { params.push(scope); where += ` and site_id = any($${params.length})`; }
    params.push(lim);
    const { rows } = await db.query<EmployeeRow>(
      `select * from pierre_rt_employees where ${where}
         order by similarity(search_text, $2) desc, last_name asc, first_name asc limit $${params.length}`, params);
    if (rows.length > 0) return rows;
  }

  // Fallback path: order-independent token-AND substring match.
  const tokens = norm.split(/\s+/).filter((t) => t.length > 0);
  const params: unknown[] = [ctx.company_id];
  let where = `company_id = $1 and archived_at is null`;
  for (const tok of tokens) { params.push(`%${tok}%`); where += ` and search_text like $${params.length}`; }
  if (scope) { params.push(scope); where += ` and site_id = any($${params.length})`; }
  params.push(lim);
  const strict = await db.query<EmployeeRow>(
    `select * from pierre_rt_employees where ${where} order by last_name asc, first_name asc limit $${params.length}`, params);
  if (strict.rows.length >= lim || strict.rows.length > 0) return strict.rows;

  // Typo-tolerant fallback: trigram re-rank over a bounded candidate set.
  const grams = [...trigrams(norm)].map((g) => g.trim()).filter((g) => g.length === 3).slice(0, 8);
  if (grams.length === 0) return strict.rows;
  const cparams: unknown[] = [ctx.company_id];
  const ors: string[] = [];
  for (const g of grams) { cparams.push(`%${g}%`); ors.push(`search_text like $${cparams.length}`); }
  let cwhere = `company_id = $1 and archived_at is null and (${ors.join(" or ")})`;
  if (scope) { cparams.push(scope); cwhere += ` and site_id = any($${cparams.length})`; }
  cparams.push(300);
  const cand = await db.query<EmployeeRow>(
    `select * from pierre_rt_employees where ${cwhere} limit $${cparams.length}`, cparams);
  const queryTokens = norm.split(/\s+/).filter(Boolean);
  const scoreOf = (e: EmployeeRow): number => {
    const text = e.search_text ?? buildSearchText(e);
    const cand = text.split(/\s+/).filter(Boolean);
    // Best per-query-token match against any candidate token (typo tolerance is
    // per word, not against the whole concatenated blob).
    let total = 0;
    for (const qt of queryTokens) {
      let best = 0;
      for (const ct of cand) best = Math.max(best, trigramSimilarity(qt, ct));
      total += best;
    }
    return queryTokens.length ? total / queryTokens.length : 0;
  };
  const scored = cand.rows
    .map((e) => ({ e, s: scoreOf(e) }))
    .filter((x) => x.s >= 0.34)
    .sort((a, b) => b.s - a.s)
    .slice(0, lim)
    .map((x) => x.e);
  return scored;
}
