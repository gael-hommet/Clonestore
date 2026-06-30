// src/lib/pierre/v1/billing-webhook-db.ts
// PHASE 8.6 — dedicated BILLING-WEBHOOK DB executor. A REAL server connection bound to the least-
// privilege role `pierre_rt_billing_webhook` (the dedicated DSN authenticates as that role). It is the
// ONLY path allowed to ingest a verified commercial event, resolve it onto a company, transition a
// product entitlement and unblock provisioning. It is NEVER browser-exposed, NEVER the Supabase service
// role, and NEVER a silent fallback to the application executor. Fail-closed: a missing dedicated DSN
// THROWS — the commercial path is never served with a broader role. No credential is ever logged.

import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

export class BillingWebhookDbError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "billing_webhook_db_unconfigured", status = 503) {
    super(message);
    this.name = "BillingWebhookDbError";
    this.code = code;
    this.status = status;
  }
}

export function getBillingWebhookDatabaseUrl(): string | null {
  return process.env.PIERRE_BILLING_WEBHOOK_DATABASE_URL ?? null;
}
export function isBillingWebhookDbConfigured(): boolean {
  return !!getBillingWebhookDatabaseUrl();
}

const globalForBillingPool = globalThis as unknown as { __pierreBillingWebhookPool?: unknown };

/** A DB executor bound to pierre_rt_billing_webhook. Fail-closed: never the service/app role. In
 *  deterministic LOCAL E2E mode it shares the in-process PGlite (the role is still bound + asserted by
 *  withBillingWebhookTransaction's SET LOCAL ROLE). Never in production. */
export async function createBillingWebhookExecutor(): Promise<SqlExecutor> {
  const { isE2ETestRuntime } = await import("./db");
  if (isE2ETestRuntime()) { const { getTestRuntimeDb } = await import("./test-runtime-db"); return getTestRuntimeDb(); }
  const url = getBillingWebhookDatabaseUrl();
  if (!url) throw new BillingWebhookDbError("billing webhook database is not configured (PIERRE_BILLING_WEBHOOK_DATABASE_URL)");
  const pg = await import("pg");
  if (!globalForBillingPool.__pierreBillingWebhookPool) {
    globalForBillingPool.__pierreBillingWebhookPool = new pg.default.Pool({
      connectionString: url,
      max: Number(process.env.PIERRE_BILLING_WEBHOOK_DB_MAX ?? 2),
      idleTimeoutMillis: 30000,
      application_name: "pierre_billing_webhook",
    });
    (globalForBillingPool.__pierreBillingWebhookPool as { on(e: string, cb: (err: NodeJS.ErrnoException) => void): void }).on("error", (err) => {
      console.error("[pierre-billing-webhook-db] idle client error:", err.code ?? err.name ?? "unknown");
    });
  }
  return createPgExecutor(globalForBillingPool.__pierreBillingWebhookPool as never);
}

/** Fail-closed assertion that the bound role is EXACTLY pierre_rt_billing_webhook. */
export async function assertBillingWebhookRole(tx: SqlExecutor): Promise<void> {
  const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
  if (cu !== "pierre_rt_billing_webhook")
    throw new BillingWebhookDbError(`billing role binding failed: current_user=${cu}, expected pierre_rt_billing_webhook`, "billing_role_mismatch", 500);
}

/**
 * Run a callback in ONE transaction bound to the billing-webhook role. SET LOCAL is transaction-scoped
 * (reset at COMMIT), so nothing leaks across reused pooled connections. The optional company binding is
 * set only AFTER the server has resolved the company from persisted commercial references — never from a
 * payload. Commercial ingress itself runs WITHOUT a company binding (the event is pre-tenant).
 */
export async function withBillingWebhookTransaction<T>(
  binding: { company_id?: string | null },
  fn: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
  const db = await createBillingWebhookExecutor();
  return db.transaction(async (tx) => {
    await tx.query(`set local role pierre_rt_billing_webhook`);
    await assertBillingWebhookRole(tx);
    if (binding.company_id) await tx.query(`select set_config('app.current_company', $1, true)`, [binding.company_id]);
    return fn(tx);
  });
}
