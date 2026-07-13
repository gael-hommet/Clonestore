# E1 — Supabase Production Readiness

**Nature:** LOCAL audit only. Verifies the database code is production‑ready; **creates/mutates nothing live** and runs **no live migration**. Source: [`e1-supabase-readiness.ts`](src/lib/clonestore/external-enablement/e1/e1-supabase-readiness.ts). Machine copy: [supabase-local-readiness.json](.e1-proofs/external-enablement/supabase-local-readiness.json).

## Locally verified (green)
- **Migrations discovered in deterministic order** — 57 `.sql` files under `supabase/migrations/`, date‑prefixed, sort stable, **no duplicate names** (`ordered=true`, `deterministic=true`).
- **Fresh migration gate** — the embedded‑PG/PGlite migrate path (`scripts/db/migrate.mjs`) is exercised by the Pierre v1 integration suite; no dev‑only fixture is required for the schema.
- **RLS policy registry complete** — `verifyRlsPolicyCoverage(getAllExpectedPolicyIds())` → `is_production_ready=true`; the registry is internally consistent.
- **Critical tables covered** — `verifyCriticalTablesHaveRls` → `all_critical_tables_covered=true`, `uncoveredCriticalTables=[]` over `CRITICAL_TABLES`.
- **Service‑role usage is server‑only** — `SUPABASE_SERVICE_ROLE_KEY` is a server secret in the env contract (never `NEXT_PUBLIC_`).
- **Cross‑tenant tests** — Pierre v1 tenancy/RBAC/employee‑360 integration tests prove cross‑company reads/writes fail (green in non‑regression).
- **Errors don't leak secrets** — observability redaction layer strips sensitive fields.

## Understood but NOT performed (documented)
- **Migration replay / idempotency** — migrations are append‑only, date‑ordered; replay is understood. A production replay is an **owner** action.
- **Destructive‑migration risk** — any schema drop/rename must be backed up first (see below). None is run by E1.
- **Production seeding** — explicit and safe; no auto‑seed of customer data.
- **Observability / slow‑query** — the observability layer provides structured logging + health; vendor wiring is external.

## Fail‑closed production truths (code can never prove these)
| Flag | Value | Why |
|---|---|---|
| `supabaseProductionProjectConfigured` | **false** | owner creates the project + supplies URL/keys |
| `productionMigrationsAuthorized` | **false** | owner explicitly authorizes + runs migrations |
| `productionBackupConfigured` | **false** | owner enables PITR/backups + rehearses restore |
| `productionRlsVerified` | **false** | run `scripts/rls-runtime-verify.mjs` against the production project with two test users |

## Backup / recovery procedure (owner)
1. In the Supabase dashboard, enable **Point‑in‑Time Recovery** (or scheduled backups) on the production project.
2. Before any destructive migration, take a manual backup and note the restore point.
3. Rehearse a restore into a scratch project; confirm row counts + a cross‑tenant spot check.
4. Document the RPO/RTO in the incident runbook.

## Owner sequence
Create project → set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in the host secret manager → take a backup → **authorize + run** migrations → run the RLS runtime verification with two test accounts → enable backups + rehearse a restore. **No live migration may run until authorized.**
