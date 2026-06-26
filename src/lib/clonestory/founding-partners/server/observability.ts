// CloneStory — OBSERVABILITÉ structurée (SERVER-ONLY, CS-FINAL 4).
//
// Émet des événements techniques append-only (jamais de PII en clair, jamais de token,
// jamais de secret, jamais de body Stripe complet) + un instantané de santé pour les
// diagnostics internes protégés. Best-effort : l'observabilité ne casse jamais un flux.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getClonestoryDb, withService } from "./runtime";

export type ObsLevel = "debug" | "info" | "warn" | "error";

/** Émet un événement d'observabilité (best-effort, jamais bloquant). */
export async function recordObservabilityEvent(
  kind: string,
  opts: { refType?: string | null; refId?: string | null; level?: ObsLevel; message?: string | null; evidence?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const db = await getClonestoryDb();
    await withService(db, (tx) => recordObservabilityEventTx(tx, kind, opts));
  } catch {
    /* observabilité best-effort */
  }
}

/** Variante transactionnelle (à appeler dans une écriture déjà ouverte). */
export async function recordObservabilityEventTx(
  tx: SqlExecutor, kind: string,
  opts: { refType?: string | null; refId?: string | null; level?: ObsLevel; message?: string | null; evidence?: Record<string, unknown> } = {},
): Promise<void> {
  await tx.query(
    `insert into clonestory_fp_observability_events (kind, ref_type, ref_id, level, message_safe, evidence_safe)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [kind, opts.refType ?? null, opts.refId ?? null, opts.level ?? "info",
     (opts.message ?? "").slice(0, 300) || null, JSON.stringify(opts.evidence ?? {})],
  );
}

export interface HealthSnapshot {
  ok: boolean;
  databaseReachable: boolean;
  migrations: { _05: boolean; _06: boolean; _07: boolean; _08: boolean };
  outbox: { verificationBacklog: number; verificationDead: number; commercialBacklog: number; commercialDead: number; notificationsBacklog: number; notificationsDead: number };
  stripe: { pendingEvents: number; failedEvents: number; lastEventAt: string | null };
  contributions: { validationPending: number };
  conflicts: { open: number };
  registrationsOpen: boolean;
  errorsLastHour: number;
}

async function tableExists(tx: SqlExecutor, name: string): Promise<boolean> {
  const { rows } = await tx.query<{ n: number }>(
    `select count(*)::int n from information_schema.tables where table_name = $1`, [name],
  );
  return (rows[0]?.n ?? 0) > 0;
}
async function safeCount(tx: SqlExecutor, sql: string, params: unknown[] = []): Promise<number> {
  try {
    const { rows } = await tx.query<{ n: number }>(sql, params);
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

/** Instantané de santé (lecture seule, sans donnée sensible). Pour /api/internal health. */
export async function getHealthSnapshot(registrationsOpen: boolean): Promise<HealthSnapshot> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const has06 = await tableExists(tx, "clonestory_fp_attributions");
    const has07 = await tableExists(tx, "clonestory_fp_commercial_contributions");
    const has08 = await tableExists(tx, "clonestory_fp_notifications_outbox");
    const has05 = await tableExists(tx, "clonestory_fp_distinctions");

    const lastEvt = has07
      ? (await tx.query<{ at: string | null }>(`select max(event_created_at) at from clonestory_fp_stripe_events`)).rows[0]?.at ?? null
      : null;

    return {
      ok: true,
      databaseReachable: true,
      migrations: { _05: has05, _06: has06, _07: has07, _08: has08 },
      outbox: {
        verificationBacklog: await safeCount(tx, `select count(*)::int n from clonestory_fp_email_outbox where status in ('pending','failed_retryable','sending')`),
        verificationDead: await safeCount(tx, `select count(*)::int n from clonestory_fp_email_outbox where status = 'dead'`),
        commercialBacklog: has07 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_commercial_outbox where status in ('pending','failed_retryable','sending')`) : 0,
        commercialDead: has07 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_commercial_outbox where status = 'dead'`) : 0,
        notificationsBacklog: has08 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_notifications_outbox where status in ('pending','failed_retryable','sending')`) : 0,
        notificationsDead: has08 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_notifications_outbox where status = 'dead'`) : 0,
      },
      stripe: {
        pendingEvents: has07 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_stripe_events where processing_result = 'pending'`) : 0,
        failedEvents: has07 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_stripe_events where processing_result = 'failed'`) : 0,
        lastEventAt: lastEvt ? new Date(lastEvt).toISOString() : null,
      },
      contributions: { validationPending: has07 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_commercial_contributions where status = 'validation_pending'`) : 0 },
      conflicts: { open: has06 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_attribution_events where type = 'attribution_conflict_detected'`) : 0 },
      registrationsOpen,
      errorsLastHour: has08 ? await safeCount(tx, `select count(*)::int n from clonestory_fp_observability_events where level = 'error' and occurred_at > now() - interval '1 hour'`) : 0,
    };
  });
}

/** Seuils d'alerte → liste d'anomalies (pour alerting). Aucune donnée sensible. */
export function evaluateAlerts(h: HealthSnapshot): { level: ObsLevel; code: string; detail: string }[] {
  const a: { level: ObsLevel; code: string; detail: string }[] = [];
  if (h.outbox.verificationDead > 0) a.push({ level: "error", code: "verification_dead", detail: `${h.outbox.verificationDead} email(s) vérif morts` });
  if (h.outbox.commercialDead > 0) a.push({ level: "error", code: "commercial_dead", detail: `${h.outbox.commercialDead} email(s) commerciaux morts` });
  if (h.outbox.notificationsDead > 0) a.push({ level: "error", code: "notifications_dead", detail: `${h.outbox.notificationsDead} notification(s) mortes` });
  if (h.stripe.failedEvents > 0) a.push({ level: "error", code: "stripe_failed", detail: `${h.stripe.failedEvents} event(s) Stripe en échec` });
  if (h.stripe.pendingEvents > 5) a.push({ level: "warn", code: "stripe_pending", detail: `${h.stripe.pendingEvents} event(s) Stripe en attente` });
  if (h.conflicts.open > 0) a.push({ level: "warn", code: "conflicts_open", detail: `${h.conflicts.open} conflit(s) d'attribution` });
  if (!h.migrations._07) a.push({ level: "warn", code: "migration_07_absent", detail: "migration _07 non appliquée" });
  if (!h.migrations._08) a.push({ level: "warn", code: "migration_08_absent", detail: "migration _08 non appliquée" });
  return a;
}
