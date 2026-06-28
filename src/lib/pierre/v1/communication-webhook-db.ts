// src/lib/pierre/v1/communication-webhook-db.ts
// PHASE 8.4-R1.3 — dedicated communication WEBHOOK DB executor. A REAL server connection bound to the
// least-privilege role `pierre_rt_communication_webhook` (the dedicated DSN authenticates as that
// role). This is DISTINCT from the signature ingress role (`pierre_rt_webhook_ingress`): the
// communication webhook role may ONLY call the communication resolver + idempotent ingest function,
// can NOT update a delivery's state, and can NOT read a contract/employee. It is NEVER browser-
// exposed and NEVER the Supabase service role. Fail-closed: a missing dedicated DSN THROWS. No
// credential is ever logged.

import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

export class CommunicationWebhookDbError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "comm_webhook_db_unconfigured", status = 503) {
    super(message);
    this.name = "CommunicationWebhookDbError";
    this.code = code;
    this.status = status;
  }
}

/** The dedicated communication-webhook DSN (its user IS pierre_rt_communication_webhook). */
export function getCommunicationWebhookDatabaseUrl(): string | null {
  return process.env.PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL ?? null;
}

export function isCommunicationWebhookDbConfigured(): boolean {
  return !!getCommunicationWebhookDatabaseUrl();
}

const globalForWebhookPool = globalThis as unknown as { __pierreCommWebhookPool?: unknown };

/**
 * Build a DB executor bound to the least-privilege communication webhook role. Fail-closed: if the
 * dedicated DSN is not configured, this THROWS — the communication webhook is NEVER served with the
 * signature ingress role, the service role, or the application role.
 */
export async function createCommunicationWebhookExecutor(): Promise<SqlExecutor> {
  const url = getCommunicationWebhookDatabaseUrl();
  if (!url) throw new CommunicationWebhookDbError("communication webhook database is not configured (PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL)");
  const pg = await import("pg");
  if (!globalForWebhookPool.__pierreCommWebhookPool) {
    globalForWebhookPool.__pierreCommWebhookPool = new pg.default.Pool({
      connectionString: url,
      max: Number(process.env.PIERRE_COMMUNICATION_WEBHOOK_DB_MAX ?? 2),
      idleTimeoutMillis: 30000,
      application_name: "pierre_communication_webhook",
    });
    (globalForWebhookPool.__pierreCommWebhookPool as { on(e: string, cb: (err: NodeJS.ErrnoException) => void): void }).on("error", (err) => {
      console.error("[pierre-comm-webhook-db] idle client error:", err.code ?? err.name ?? "unknown");
    });
  }
  return createPgExecutor(globalForWebhookPool.__pierreCommWebhookPool as never);
}
