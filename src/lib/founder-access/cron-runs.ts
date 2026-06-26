// Journal des exécutions planifiées (cron) Founder Access. Persiste chaque passage du
// moteur email pour fournir une PREUVE RÉELLE au cockpit (dernière exécution, statut,
// compteurs, durée). Métadonnées opérationnelles uniquement — aucune donnée personnelle.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";

export const FOUNDER_EMAIL_CRON_JOB = "founder_email_tick";
/** Cadence attendue du cron (vercel.json : toutes les 10 minutes). Sert au « prochaine ~ »
 *  et à la détection d'un planificateur arrêté. */
export const EMAIL_CRON_INTERVAL_MS = 10 * 60_000;

export interface CronRun {
  id: number; job_name: string; started_at: string; finished_at: string | null;
  status: "running" | "ok" | "error";
  processed: number; sent: number; skipped: number; retried: number; dead: number;
  duration_ms: number | null; error_safe: string | null;
}

export interface CronRunRecord {
  job_name: string; status: "ok" | "error";
  processed?: number; sent?: number; skipped?: number; retried?: number; dead?: number;
  duration_ms: number; error_safe?: string | null;
}

/** Enregistre une exécution terminée (ok/erreur) avec ses compteurs et sa durée. */
export async function recordCronRun(db: SqlExecutor, r: CronRunRecord): Promise<void> {
  await db.query(
    `insert into clonestore_founder_cron_runs
       (job_name, started_at, finished_at, status, processed, sent, skipped, retried, dead, duration_ms, error_safe)
     values ($1, now() - ($2 || ' milliseconds')::interval, now(), $3, $4, $5, $6, $7, $8, $9, $10)`,
    [r.job_name, Math.max(0, Math.round(r.duration_ms)), r.status,
      r.processed ?? 0, r.sent ?? 0, r.skipped ?? 0, r.retried ?? 0, r.dead ?? 0,
      Math.max(0, Math.round(r.duration_ms)), r.error_safe ?? null],
  );
}

/** Dernière exécution enregistrée pour un job (ou null si jamais exécuté). */
export async function getLastCronRun(db: SqlExecutor, jobName: string): Promise<CronRun | null> {
  const { rows } = await db.query<CronRun>(
    `select id, job_name, started_at::text as started_at, finished_at::text as finished_at, status,
            processed, sent, skipped, retried, dead, duration_ms, error_safe
       from clonestore_founder_cron_runs where job_name = $1 order by started_at desc limit 1`,
    [jobName],
  );
  return rows[0] ?? null;
}
