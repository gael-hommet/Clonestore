// E-R2/E-R3 §1/§2 — connexion DB DÉDIÉE au webhook Stripe. Le journal Stripe est
// écrit via la fonction contrôlée, réservée au rôle `clonestore_stripe_webhook_writer`.
//
// FAIL-CLOSED en production : sans CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL, on lève
// (la route renvoie 503 → Stripe retry). Aucun fallback privilégié en production.
// En dev/test uniquement, fallback explicite vers la connexion runtime.

import { getRuntimeDb, createRuntimeExecutorForUrl } from "@/lib/pierre/v1/db";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

const g = globalThis as unknown as {
  __founderStripeWebhookDb?: { db: SqlExecutor; close: () => Promise<void> };
  __founderWebhookReadiness?: { at: number; ok: boolean };
};

/** Base des erreurs DB webhook → la route renvoie 503 (Stripe retry). */
export class WebhookDatabaseError extends Error {}
export class WebhookDatabaseNotConfiguredError extends WebhookDatabaseError {
  constructor() {
    super("CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL non configurée : webhook Stripe fail-closed en production.");
    this.name = "WebhookDatabaseNotConfiguredError";
  }
}
export class WebhookDatabaseNotReadyError extends WebhookDatabaseError {
  constructor(public readonly cause_reason: string) {
    super(`Connexion webhook Stripe non prête : ${cause_reason}`);
    this.name = "WebhookDatabaseNotReadyError";
  }
}

export function isDedicatedWebhookDbConfigured(): boolean {
  return Boolean(process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL);
}

const READINESS_TTL_MS = 5 * 60_000;

/**
 * §5 — Vérifie (avec cache TTL) que la connexion est PRÊTE à écrire le journal Stripe :
 * pas le rôle applicatif général, EXECUTE de la fonction contrôlée accordé, INSERT brut
 * refusé. En production, lève si non prête. En dev/test, no-op (la base locale est l'owner).
 */
export async function assertStripeWebhookDatabaseReady(db: SqlExecutor): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  const now = Date.now();
  if (g.__founderWebhookReadiness && g.__founderWebhookReadiness.ok && now - g.__founderWebhookReadiness.at < READINESS_TTL_MS) return;
  let check;
  try {
    check = await verifyStripeWebhookDatabaseRole(db);
  } catch (e) {
    g.__founderWebhookReadiness = { at: now, ok: false };
    throw new WebhookDatabaseNotReadyError(e instanceof Error ? e.message : "role_check_failed");
  }
  g.__founderWebhookReadiness = { at: now, ok: check.ok };
  if (!check.ok) throw new WebhookDatabaseNotReadyError(check.reason);
}

export async function getStripeWebhookDb(): Promise<SqlExecutor> {
  const url = process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL;
  if (url) {
    if (!g.__founderStripeWebhookDb) g.__founderStripeWebhookDb = createRuntimeExecutorForUrl(url);
    const db = g.__founderStripeWebhookDb.db;
    // §5 — en production, la connexion dédiée doit être prouvée prête (rôle/grants).
    await assertStripeWebhookDatabaseReady(db);
    return db;
  }
  // §1 — production : pas de connexion dédiée → fail-closed (jamais le rôle général).
  if (process.env.NODE_ENV === "production") throw new WebhookDatabaseNotConfiguredError();
  // dev/test uniquement : connexion runtime (jamais pierre_rt_app, nologin).
  return getRuntimeDb();
}

// §2 — preuve du rôle de la connexion dédiée.
export interface WebhookDbRoleCheck {
  ok: boolean;
  current_user: string;
  current_role: string;
  is_writer_member: boolean;
  can_execute_journal_fn: boolean;
  raw_insert_blocked: boolean;
  reason: string;
}

/**
 * Vérifie que la connexion peut écrire le journal UNIQUEMENT via la fonction contrôlée
 * (membre du rôle writer / EXECUTE accordé) et NON par INSERT brut (moindre privilège).
 * Échoue si l'utilisateur courant est le rôle applicatif général ou peut insérer en brut.
 */
export async function verifyStripeWebhookDatabaseRole(db: SqlExecutor): Promise<WebhookDbRoleCheck> {
  const { rows } = await db.query<{
    current_user: string; current_role: string; is_writer: boolean; can_exec: boolean; raw_insert: boolean;
  }>(
    `select current_user::text as current_user,
            current_role::text as current_role,
            pg_has_role(current_user, 'clonestore_stripe_webhook_writer', 'member') as is_writer,
            has_function_privilege(current_user, 'clonestore_record_founder_stripe_event(jsonb)', 'EXECUTE') as can_exec,
            has_table_privilege(current_user, 'clonestore_founder_stripe_events', 'INSERT') as raw_insert`,
  );
  const r = rows[0];
  const rawInsertBlocked = !r.raw_insert;
  // L'utilisateur ne doit JAMAIS être le rôle applicatif général.
  const isGeneralRole = r.current_user === "pierre_rt_app" || r.current_role === "pierre_rt_app";
  const ok = !isGeneralRole && r.can_exec && rawInsertBlocked;
  return {
    ok,
    current_user: r.current_user, current_role: r.current_role,
    is_writer_member: r.is_writer, can_execute_journal_fn: r.can_exec, raw_insert_blocked: rawInsertBlocked,
    reason: ok ? "ok"
      : isGeneralRole ? "general_app_role_used"
      : !r.can_exec ? "cannot_execute_journal_fn"
      : "raw_insert_allowed",
  };
}
