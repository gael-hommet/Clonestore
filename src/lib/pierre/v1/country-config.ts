// P22 — governed Country Configuration service. Persists a real, versioned country config + pack binding
// (pierre_rt_country_configs), tenant-scoped. No legal rule is invented — it only binds a declared pack
// key to a tenant/country and stores an operational config blob. Country must be one of FR/BE/LU/CH.
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type CountryConfigRow = {
  id: string; company_id: string; country_code: string; pack_key: string; config: unknown;
  status: string; created_by: string | null; created_at: string; updated_at: string; version: number;
};

const COUNTRIES = new Set(["FR", "BE", "LU", "CH"]);

/** Bind a country pack to the tenant (idempotent per (company, country) — a re-bind updates the pack
 *  and bumps the version rather than creating a duplicate). */
export async function bindCountryPack(
  db: SqlExecutor, ctx: TenantContext,
  input: { country_code: string; pack_key: string; config?: Record<string, unknown>; status?: string },
): Promise<CountryConfigRow> {
  requirePermission(ctx, "company.admin");
  const country = String(input.country_code || "").toUpperCase();
  if (!COUNTRIES.has(country)) throw Errors.validation(`unsupported country: ${input.country_code}`);
  if (!input.pack_key?.trim()) throw Errors.validation("pack_key is required");
  const id = newUuid();
  const { rows } = await db.query<CountryConfigRow>(
    `insert into pierre_rt_country_configs (id, company_id, country_code, pack_key, config, status, created_by)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7)
     on conflict (company_id, country_code)
       do update set pack_key=excluded.pack_key, config=excluded.config, status=excluded.status,
                     updated_at=now(), version=pierre_rt_country_configs.version+1
     returning *`,
    [id, ctx.company_id, country, input.pack_key, JSON.stringify(input.config ?? {}), input.status ?? "active", ctx.user_id]);
  return rows[0];
}
