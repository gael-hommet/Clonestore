// Phase E.3 — Worker de file email (PostgreSQL réel). Claim atomique, verrou,
// retry exponentiel, dead-letter, reprise après interruption, idempotence.
// Aucun double envoi : un seul job par (réservation × type) via job_key unique,
// transition d'état pending→sending→sent/failed/dead, et SKIP LOCKED au claim.

import type { SqlExecutor, SqlRow } from "@/lib/pierre/v1/sql";
import { FOUNDER_EMAIL_SCHEDULE, dueScheduledEmails, type FounderEmailKind } from "./email-sequence";
import { renderVerificationEmail, renderScheduledEmail, type FounderEmailProvider } from "./email-provider";
import { deterministicVerificationToken, hashToken, VERIFICATION_TTL_MS, isTokenSecretConfigured } from "./token";
import { recordFunnelEvent } from "./store";
import { publicAppUrl, activationUrl, unsubscribeUrl } from "./mailing-links";

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 15 * 60_000;

export interface EmailTickResult {
  enqueued: number;
  reclaimed: number;
  claimed: number;
  sent: number;
  skipped: number;
  retried: number;
  dead: number;
}

interface EmailJobRow extends SqlRow {
  id: number; job_key: string; reservation_id: string; kind: FounderEmailKind;
  attempts: number; verification_token: string | null;
}

/** Enfile les emails programmés dus (un job par réservation éligible, idempotent). */
export async function enqueueDueScheduledEmails(db: SqlExecutor, now: Date = new Date()): Promise<number> {
  let enqueued = 0;
  for (const s of dueScheduledEmails(now)) {
    const filters = [
      "status <> 'unsubscribed'",
      s.requiresConfirmed ? "email_verified_at is not null" : null,
      s.skipIfActiveClient ? "status <> 'active_client'" : null,
    ].filter(Boolean).join(" and ");
    const { rows } = await db.query<{ id: string }>(
      `insert into clonestore_founder_email_jobs (job_key, reservation_id, kind, status, send_at)
       select id || ':' || $1, id, $1, 'pending', $2::timestamptz
       from clonestore_founder_reservations
       where ${filters}
       on conflict (job_key) do nothing
       returning reservation_id as id`,
      [s.kind, s.sendAtIso],
    );
    enqueued += rows.length;
  }
  return enqueued;
}

/** Reremet en file les jobs « sending » bloqués (worker interrompu). */
async function reclaimStale(db: SqlExecutor): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `update clonestore_founder_email_jobs
       set status='pending', locked_at=null, locked_by=null, updated_at=now()
     where status='sending' and locked_at < now() - ($1 || ' milliseconds')::interval
     returning id`,
    [STALE_LOCK_MS],
  );
  return rows.length;
}

/** Claim atomique de N jobs dus : pending → sending (SKIP LOCKED), attempts++. */
async function claimJobs(db: SqlExecutor, workerId: string, limit: number): Promise<EmailJobRow[]> {
  const { rows } = await db.query<EmailJobRow>(
    `update clonestore_founder_email_jobs j
       set status='sending', locked_at=now(), locked_by=$1, attempts=attempts+1, updated_at=now()
     where j.id in (
       select id from clonestore_founder_email_jobs
       where status='pending' and send_at <= now()
       order by send_at asc
       limit $2
       for update skip locked
     )
     returning j.id, j.job_key, j.reservation_id, j.kind, j.attempts, j.verification_token`,
    [workerId, limit],
  );
  return rows;
}

function backoffMs(attempts: number): number {
  return Math.min(6 * 60 * 60_000, 60_000 * Math.pow(2, Math.max(0, attempts - 1))); // 1min→…→6h max
}

async function markSent(db: SqlExecutor, id: number, messageId?: string | null, idempotencyKey?: string | null) {
  await db.query(
    `update clonestore_founder_email_jobs
       set status='sent', sent_at=now(), provider_message_id=$2, provider_attempt_id=$2,
           provider_idempotency_key=$3, last_provider_response_at=now(),
           locked_at=null, locked_by=null, last_error=null, updated_at=now()
     where id=$1`, [id, messageId ?? null, idempotencyKey ?? null]);
}
async function markSkipped(db: SqlExecutor, id: number, reason: string) {
  await db.query(
    `update clonestore_founder_email_jobs
       set status='skipped', skipped_at=now(), skip_reason=$2, locked_at=null, locked_by=null, updated_at=now()
     where id=$1`, [id, reason.slice(0, 200)]);
}
async function markRetryOrDead(db: SqlExecutor, job: EmailJobRow, error: string): Promise<"retried" | "dead"> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await db.query(
      `update clonestore_founder_email_jobs
         set status='dead', last_error=$2, locked_at=null, locked_by=null, updated_at=now() where id=$1`,
      [job.id, error.slice(0, 500)]);
    return "dead";
  }
  const delay = backoffMs(job.attempts);
  await db.query(
    `update clonestore_founder_email_jobs
       set status='pending', last_error=$2, next_attempt_at=now() + ($3 || ' milliseconds')::interval,
           send_at=now() + ($3 || ' milliseconds')::interval, locked_at=null, locked_by=null, updated_at=now()
     where id=$1`,
    [job.id, error.slice(0, 500), delay]);
  return "retried";
}

interface ReservationLite { email: string; status: string; email_verified_at: string | null; verification_token_version: number }

async function loadReservation(db: SqlExecutor, id: string): Promise<ReservationLite | null> {
  const { rows } = await db.query<ReservationLite>(
    "select email, status, email_verified_at, coalesce(verification_token_version,1) as verification_token_version from clonestore_founder_reservations where id=$1", [id]);
  return rows[0] ?? null;
}

/**
 * Traite un job. Retourne l'issue. Les emails de vérification ré-émettent un token
 * FRAIS au moment de l'envoi (le hash seul est stocké → le worker ne peut pas
 * reconstruire l'ancien token).
 */
type JobOutcome = "sent" | "skipped" | "retried" | "dead";

async function processJob(db: SqlExecutor, job: EmailJobRow, provider: FounderEmailProvider, baseUrl: string): Promise<JobOutcome> {
  const res = await loadReservation(db, job.reservation_id);
  if (!res) { await markSkipped(db, job.id, "reservation_missing"); return "skipped"; }
  if (res.status === "unsubscribed") { await markSkipped(db, job.id, "unsubscribed"); return "skipped"; }

  const schedule = FOUNDER_EMAIL_SCHEDULE.find((s) => s.kind === job.kind);

  let subject: string;
  let html: string;
  let text: string;
  // §7 — clé d'idempotence : stable entre retries, change au resend (version de token).
  let generation = 1;

  if (job.kind === "verification") {
    if (res.email_verified_at) { await markSkipped(db, job.id, "already_verified"); return "skipped"; }
    // §7 — secret de token absent en production → skip diagnostique (jamais de token faible).
    if (!isTokenSecretConfigured() && process.env.NODE_ENV === "production") {
      await markSkipped(db, job.id, "token_secret_missing"); return "skipped";
    }
    // E-R2 §6 — token DÉTERMINISTE HMAC reconstruit depuis (reservation_id, version) :
    // jamais stocké en clair ; identique à chaque retry ; invalidé par un bump de version.
    generation = res.verification_token_version;
    const plain = deterministicVerificationToken(job.reservation_id, generation);
    const tokenHash = hashToken(plain);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    await db.query(
      "update clonestore_founder_reservations set verification_token_hash=$2, verification_expires_at=$3, updated_at=now() where id=$1 and email_verified_at is null",
      [job.reservation_id, tokenHash, expiresAt]);
    const verifyUrl = `${baseUrl}/api/founder-access/verify?rid=${encodeURIComponent(job.reservation_id)}&token=${encodeURIComponent(plain)}`;
    const m = renderVerificationEmail(verifyUrl);
    subject = "Confirmez votre réservation de Pierre"; html = m.html; text = m.text;
  } else {
    if (!schedule) { await markSkipped(db, job.id, "unknown_kind"); return "skipped"; }
    if (schedule.requiresConfirmed && !res.email_verified_at) { await markSkipped(db, job.id, "not_confirmed"); return "skipped"; }
    if (schedule.skipIfActiveClient && res.status === "active_client") { await markSkipped(db, job.id, "active_client"); return "skipped"; }
    const activationKinds: FounderEmailKind[] = ["launch_open", "post_launch_followup", "j14_before_close", "j5_before_close", "j1_before_close", "close"];
    const actionUrl = activationKinds.includes(job.kind) ? activationUrl(job.reservation_id) : `${baseUrl}/demo/pierre`;
    const m = renderScheduledEmail(job.kind, { actionUrl, unsubscribeUrl: unsubscribeUrl(job.reservation_id) });
    subject = schedule.subject; html = m.html; text = m.text;
  }

  const idempotencyKey = `founder-email:${job.job_key}:${generation}`;
  let send;
  try {
    send = await provider.send({ to: res.email, subject, html, text, idempotencyKey });
  } catch (e) {
    return markRetryOrDead(db, job, e instanceof Error ? e.message : "send_threw");
  }
  if (!send.ok) return markRetryOrDead(db, job, send.error ?? "send_failed");

  await markSent(db, job.id, send.id, idempotencyKey);
  if (job.kind === "verification") {
    await recordFunnelEvent(db, { reservation_id: job.reservation_id, event_name: "founder_verification_sent" });
  }
  return "sent";
}

/**
 * Tick complet : reprise des verrous périmés, enfilement des programmés dus,
 * claim + traitement par lot. `provider` injectable (tests). `baseUrl` absolu.
 */
export async function runEmailTick(
  db: SqlExecutor,
  provider: FounderEmailProvider,
  opts: { limit?: number; workerId?: string; baseUrl?: string; now?: Date } = {},
): Promise<EmailTickResult> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 25));
  const workerId = opts.workerId ?? `tick-${Date.now()}`;
  const baseUrl = (opts.baseUrl ?? publicAppUrl()).replace(/\/+$/, "");

  const reclaimed = await reclaimStale(db);
  const enqueued = await enqueueDueScheduledEmails(db, opts.now);
  const jobs = await claimJobs(db, workerId, limit);

  const result: EmailTickResult = { enqueued, reclaimed, claimed: jobs.length, sent: 0, skipped: 0, retried: 0, dead: 0 };
  for (const job of jobs) {
    const outcome = await processJob(db, job, provider, baseUrl);
    if (outcome === "sent") result.sent++;
    else if (outcome === "skipped") result.skipped++;
    else if (outcome === "retried") result.retried++;
    else if (outcome === "dead") result.dead++;
  }
  return result;
}
