// src/lib/pierre/v1/customer-activation-db.ts
// PHASE 8.6 — dedicated CUSTOMER-ACTIVATION WORKER DB executor. A REAL server connection bound to the
// least-privilege role `pierre_rt_customer_activation_worker` (the dedicated DSN authenticates as that
// role). It is the ONLY path allowed to claim an activation and atomically provision a company + owner
// membership + entitlement + onboarding via the governed SECURITY DEFINER functions. It is NEVER
// browser-exposed, NEVER the Supabase service role, and NEVER a silent fallback to the application
// executor. Fail-closed: a missing dedicated DSN THROWS. No credential is ever logged.

import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

export class CustomerActivationDbError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "customer_activation_db_unconfigured", status = 503) {
    super(message);
    this.name = "CustomerActivationDbError";
    this.code = code;
    this.status = status;
  }
}

export function getCustomerActivationDatabaseUrl(): string | null {
  return process.env.PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL ?? null;
}
export function isCustomerActivationDbConfigured(): boolean {
  return !!getCustomerActivationDatabaseUrl();
}

const globalForActivationPool = globalThis as unknown as { __pierreCustomerActivationPool?: unknown };

/** A DB executor bound to pierre_rt_customer_activation_worker. Fail-closed: never the service/app role.
 *  In deterministic LOCAL E2E mode it shares the in-process PGlite (role still bound + asserted by
 *  withCustomerActivationTransaction). Never in production. */
export async function createCustomerActivationExecutor(): Promise<SqlExecutor> {
  const { isE2ETestRuntime } = await import("./db");
  if (isE2ETestRuntime()) { const { getTestRuntimeDb } = await import("./test-runtime-db"); return getTestRuntimeDb(); }
  const url = getCustomerActivationDatabaseUrl();
  if (!url) throw new CustomerActivationDbError("customer activation database is not configured (PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL)");
  const pg = await import("pg");
  if (!globalForActivationPool.__pierreCustomerActivationPool) {
    globalForActivationPool.__pierreCustomerActivationPool = new pg.default.Pool({
      connectionString: url,
      max: Number(process.env.PIERRE_CUSTOMER_ACTIVATION_DB_MAX ?? 2),
      idleTimeoutMillis: 30000,
      application_name: "pierre_customer_activation_worker",
    });
    (globalForActivationPool.__pierreCustomerActivationPool as { on(e: string, cb: (err: NodeJS.ErrnoException) => void): void }).on("error", (err) => {
      console.error("[pierre-customer-activation-db] idle client error:", err.code ?? err.name ?? "unknown");
    });
  }
  return createPgExecutor(globalForActivationPool.__pierreCustomerActivationPool as never);
}

/** Fail-closed assertion that the bound role is EXACTLY pierre_rt_customer_activation_worker. */
export async function assertCustomerActivationRole(tx: SqlExecutor): Promise<void> {
  const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
  if (cu !== "pierre_rt_customer_activation_worker")
    throw new CustomerActivationDbError(`activation role binding failed: current_user=${cu}, expected pierre_rt_customer_activation_worker`, "activation_role_mismatch", 500);
}

/**
 * Run a callback in ONE transaction bound to the activation-worker role. The claim/provision functions
 * derive the tenant inside SECURITY DEFINER bodies (the company does not yet exist at claim time), so no
 * app.current_company binding is set here. SET LOCAL ROLE is transaction-scoped.
 */
export async function withCustomerActivationTransaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const db = await createCustomerActivationExecutor();
  return db.transaction(async (tx) => {
    await tx.query(`set local role pierre_rt_customer_activation_worker`);
    await assertCustomerActivationRole(tx);
    return fn(tx);
  });
}
