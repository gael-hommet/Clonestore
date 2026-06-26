// Phase E.6 — Service central du Founder Command Center. Compose des LECTURES
// réelles (PostgreSQL + statut d'environnement). Aucune donnée inventée : ce qui
// n'est pas connecté est marqué « non connecté » ; un zéro mesuré reste un zéro.

import type { SqlExecutor, SqlRow } from "@/lib/pierre/v1/sql";
import {
  dashboardMetrics, founderRevenueMetrics, listReservations,
  type DashboardMetrics, type FounderRevenueMetrics, type ReservationRow,
} from "./store";
import { presenceSnapshot, funnelSnapshot, cohortFunnelSnapshot, acquisitionBreakdown, type PresenceSnapshot } from "./analytics";
import { getLastCronRun, FOUNDER_EMAIL_CRON_JOB, EMAIL_CRON_INTERVAL_MS } from "./cron-runs";
import { aiCostHealth, founderAiCostSummary, type FounderAiCostSummary } from "./ai-cost";
import { realtimeHealth } from "./realtime";

// ── Chargement résilient (E-R1 §18) ─────────────────────────────────────────
export type SectionStatus = "ok" | "error";
export interface Section<T> { status: SectionStatus; data: T; error_safe: string | null; generated_at: string }

async function safeSection<T>(fn: () => Promise<T>, fallback: T): Promise<Section<T>> {
  try {
    return { status: "ok", data: await fn(), error_safe: null, generated_at: new Date().toISOString() };
  } catch (e) {
    // error_safe : message générique, jamais de détail interne brut.
    return { status: "error", data: fallback, error_safe: e instanceof Error ? e.name : "error", generated_at: new Date().toISOString() };
  }
}

// ── Sources & santé RÉELLE (E-R1 §19) ───────────────────────────────────────
// Une variable d'environnement présente n'implique PAS « connecté » : Postgres et
// l'accès aux tables analytics sont réellement testés ; les autres sources reflètent
// la configuration (degraded si partielle). Aucun secret dans le résultat.
export type SourceState = "connected" | "degraded" | "misconfigured" | "unavailable" | "not_configured";
export interface SourceStatus { key: string; label: string; state: SourceState; detail: string }

const has = (v: string | undefined) => Boolean(v && v.length > 0);

export async function sourcesHealth(db: SqlExecutor): Promise<SourceStatus[]> {
  // Postgres : test réel.
  let pg: SourceStatus;
  try {
    await db.query("select 1 as ok");
    pg = { key: "postgres", label: "PostgreSQL (runtime)", state: "connected", detail: "Requête de test réussie" };
  } catch {
    pg = { key: "postgres", label: "PostgreSQL (runtime)", state: "unavailable", detail: "Requête de test échouée" };
  }
  // Analytics : tables réellement accessibles ?
  let analytics: SourceStatus;
  try {
    await db.query("select 1 from clonestore_web_events limit 1");
    analytics = { key: "analytics", label: "Analytics first-party", state: "connected", detail: "Tables accessibles (présence = estimation)" };
  } catch {
    analytics = { key: "analytics", label: "Analytics first-party", state: "unavailable", detail: "Tables analytics inaccessibles" };
  }

  const stripe: SourceStatus = has(process.env.STRIPE_SECRET_KEY)
    ? (has(process.env.STRIPE_WEBHOOK_SECRET)
        ? { key: "stripe", label: "Stripe", state: "connected", detail: "Clé + webhook configurés" }
        : { key: "stripe", label: "Stripe", state: "degraded", detail: "Webhook secret absent (activation impossible)" })
    : { key: "stripe", label: "Stripe", state: "not_configured", detail: "STRIPE_SECRET_KEY absent" };

  const ownerGateOk = has(process.env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH) && has(process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET) && has(process.env.CLONESTORE_OWNER_COCKPIT_SLUG);

  // Cron email : PREUVE = dernière exécution réellement enregistrée (jamais vert sur secret seul).
  const cronSecret = has(process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET);
  const lastCron = await getLastCronRun(db, FOUNDER_EMAIL_CRON_JOB).catch(() => null);
  const emailCron: SourceStatus = (() => {
    if (!lastCron) {
      return cronSecret
        ? { key: "email_cron", label: "Cron email", state: "misconfigured", detail: "Secret présent mais aucune exécution enregistrée (planificateur non actif ?)" }
        : { key: "email_cron", label: "Cron email", state: "not_configured", detail: "CLONESTORE_FOUNDER_EMAIL_CRON_SECRET absent" };
    }
    const when = new Date(lastCron.finished_at ?? lastCron.started_at);
    const fmt = when.toLocaleString("fr-FR");
    if (lastCron.status === "error") {
      return { key: "email_cron", label: "Cron email", state: "degraded", detail: `Dernière exécution en erreur : ${fmt}${lastCron.error_safe ? ` (${lastCron.error_safe})` : ""}` };
    }
    if (Date.now() - when.getTime() > EMAIL_CRON_INTERVAL_MS * 6) {
      return { key: "email_cron", label: "Cron email", state: "degraded", detail: `Dernière exécution réussie ${fmt} — planificateur arrêté ?` };
    }
    const next = new Date(when.getTime() + EMAIL_CRON_INTERVAL_MS).toLocaleString("fr-FR");
    return { key: "email_cron", label: "Cron email", state: "connected", detail: `Dernière exécution réussie : ${fmt} · prochaine ~${next}` };
  })();

  // Temps réel : état serveur du flux SSE (transport prêt + connexions actives).
  const rt = realtimeHealth();
  // Coûts IA : agrégation réelle exécutée contre le ledger gouverné.
  const ai = await aiCostHealth();

  return [
    pg,
    { key: "supabase_auth", label: "Supabase Auth", state: has(process.env.NEXT_PUBLIC_SUPABASE_URL) ? "connected" : "not_configured", detail: has(process.env.NEXT_PUBLIC_SUPABASE_URL) ? "Projet Supabase configuré" : "NEXT_PUBLIC_SUPABASE_URL absent" },
    stripe,
    { key: "resend", label: "Resend (email)", state: has(process.env.RESEND_API_KEY) ? "connected" : "not_configured", detail: has(process.env.RESEND_API_KEY) ? "Clé configurée" : "RESEND_API_KEY absent (mode local en dev)" },
    emailCron,
    { key: "owner_gate", label: "Porte propriétaire", state: ownerGateOk ? "connected" : "misconfigured", detail: "Hash + secret cookie + slug requis" },
    analytics,
    { key: "realtime", label: "Temps réel", state: rt.state, detail: rt.detail },
    { key: "ai_cost", label: "Coûts IA (OpenAI/Anthropic)", state: ai.state, detail: ai.detail },
  ];
}

/** Variante synchrone (config seule) pour les alertes — sans I/O. */
export function sourcesStatus(): SourceStatus[] {
  const stripeConnected = has(process.env.STRIPE_SECRET_KEY) && has(process.env.STRIPE_WEBHOOK_SECRET);
  return [
    { key: "stripe", label: "Stripe", state: stripeConnected ? "connected" : "not_configured", detail: stripeConnected ? "Clé + webhook configurés" : "Stripe non configuré" },
    { key: "resend", label: "Resend (email)", state: has(process.env.RESEND_API_KEY) ? "connected" : "not_configured", detail: "" },
    { key: "email_cron", label: "Cron email", state: has(process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET) ? "connected" : "not_configured", detail: "" },
    { key: "owner_gate", label: "Porte propriétaire", state: (has(process.env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH) && has(process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET) && has(process.env.CLONESTORE_OWNER_COCKPIT_SLUG)) ? "connected" : "misconfigured", detail: "" },
  ];
}

// ── Opérations email ────────────────────────────────────────────────────────
export interface EmailOperations {
  pending: number; sending: number; sent: number; skipped: number; failed: number; dead: number;
  next_sends: Array<{ kind: string; send_at: string; count: number }>;
  recent_errors: Array<{ kind: string; last_error: string; updated_at: string }>;
  provider_configured: boolean;
  generated_at: string;
}

export async function emailOperations(db: SqlExecutor): Promise<EmailOperations> {
  const counts = await db.query<SqlRow>(
    `select status, count(*)::int n from clonestore_founder_email_jobs group by status`,
  );
  const byStatus: Record<string, number> = {};
  for (const r of counts.rows) byStatus[String((r as Record<string, unknown>).status)] = Number((r as Record<string, unknown>).n) || 0;

  const next = await db.query<{ kind: string; send_at: string; count: number }>(
    `select kind, min(send_at) as send_at, count(*)::int as count
       from clonestore_founder_email_jobs where status='pending' and send_at > now()
       group by kind order by send_at asc limit 8`,
  );
  const errors = await db.query<{ kind: string; last_error: string; updated_at: string }>(
    `select kind, last_error, updated_at from clonestore_founder_email_jobs
       where last_error is not null and status in ('pending','failed','dead')
       order by updated_at desc limit 8`,
  );
  return {
    pending: byStatus.pending ?? 0, sending: byStatus.sending ?? 0, sent: byStatus.sent ?? 0,
    skipped: byStatus.skipped ?? 0, failed: byStatus.failed ?? 0, dead: byStatus.dead ?? 0,
    next_sends: next.rows.map((r) => ({ kind: r.kind, send_at: r.send_at, count: Number(r.count) || 0 })),
    recent_errors: errors.rows,
    provider_configured: Boolean(process.env.RESEND_API_KEY),
    generated_at: new Date().toISOString(),
  };
}

// ── Alertes réelles ─────────────────────────────────────────────────────────
export type AlertSeverity = "critical" | "warning" | "info";
export interface FounderAlert { severity: AlertSeverity; code: string; message: string; recommendation: string }

export async function followupsDue(db: SqlExecutor): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int n from clonestore_founder_reservations
       where next_followup_at is not null and next_followup_at <= now()
         and contact_status not in ('converted','closed')`,
  );
  return Number(rows[0]?.n) || 0;
}

export function buildAlerts(args: {
  revenue: FounderRevenueMetrics; emails: EmailOperations; followups: number; sources: SourceStatus[];
}): FounderAlert[] {
  const a: FounderAlert[] = [];
  const src = (k: string) => {
    const st = args.sources.find((s) => s.key === k)?.state;
    return st === "connected";
  };

  if (!src("stripe")) a.push({ severity: "critical", code: "stripe_not_configured", message: "Stripe n'est pas configuré (clé ou webhook manquant).", recommendation: "Configurer STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET ; aucune activation payante possible sinon." });
  if (!src("resend")) a.push({ severity: "warning", code: "resend_not_configured", message: "Resend n'est pas configuré : aucun email réel ne part en production.", recommendation: "Configurer RESEND_API_KEY (et l'expéditeur)." });
  if (!src("email_cron")) a.push({ severity: "warning", code: "cron_not_configured", message: "Le secret de tick email est absent : la file ne sera pas drainée automatiquement.", recommendation: "Configurer CLONESTORE_FOUNDER_EMAIL_CRON_SECRET et planifier le cron." });
  if (!src("owner_gate")) a.push({ severity: "warning", code: "owner_gate_incomplete", message: "La porte propriétaire n'est pas entièrement configurée.", recommendation: "Définir hash, secret cookie et slug du cockpit." });
  if (args.emails.dead > 0) a.push({ severity: "critical", code: "email_dead_letter", message: `${args.emails.dead} email(s) en échec définitif (dead-letter).`, recommendation: "Inspecter les erreurs et relancer de manière gouvernée." });
  if (args.revenue.past_due > 0) a.push({ severity: "warning", code: "past_due", message: `${args.revenue.past_due} abonnement(s) en impayé.`, recommendation: "Suivre la régularisation du paiement." });
  if (args.followups > 0) a.push({ severity: "info", code: "followups_due", message: `${args.followups} relance(s) prospect arrivée(s) à échéance.`, recommendation: "Traiter les relances dues dans l'onglet Prospects." });
  if (a.length === 0) a.push({ severity: "info", code: "all_clear", message: "Aucune alerte active.", recommendation: "Système nominal." });
  return a;
}

// ── Snapshot complet ────────────────────────────────────────────────────────
export interface OverviewMetrics extends DashboardMetrics {
  followups_due: number;
  emails_dead: number;
  online_estimate: number;
}

export interface CommandCenterSnapshot {
  overview: OverviewMetrics;
  revenue: FounderRevenueMetrics;
  presence: PresenceSnapshot;
  funnel: Awaited<ReturnType<typeof funnelSnapshot>>;
  cohort_funnel: Awaited<ReturnType<typeof cohortFunnelSnapshot>>;
  acquisition: Awaited<ReturnType<typeof acquisitionBreakdown>>;
  emails: EmailOperations;
  alerts: FounderAlert[];
  sources: SourceStatus[];
  /** Coûts IA agrégés (ledger gouverné) — null si désactivé/inaccessible. */
  ai_cost: FounderAiCostSummary | null;
  /** Sections en erreur (panne isolée d'une source optionnelle) — jamais de crash global. */
  degraded: string[];
  generated_at: string;
}

const EMPTY_REVENUE: FounderRevenueMetrics = { active_subscriptions: 0, mrr_active_cents: 0, arr_active_cents: 0, activated_total: 0, past_due: 0, canceled: 0, stripe_connected: false, generated_at: new Date().toISOString() };
const EMPTY_METRICS: DashboardMetrics = { reservations_total: 0, reservations_today: 0, reservations_7d: 0, emails_confirmed: 0, confirmation_rate: 0, strong_intent: 0, contact_requested: 0, activation_started: 0, active_clients: 0, generated_at: new Date().toISOString() };
const EMPTY_EMAILS: EmailOperations = { pending: 0, sending: 0, sent: 0, skipped: 0, failed: 0, dead: 0, next_sends: [], recent_errors: [], provider_configured: Boolean(process.env.RESEND_API_KEY), generated_at: new Date().toISOString() };
const EMPTY_PRESENCE: PresenceSnapshot = { online_total: 0, on_homepage: 0, on_demo: 0, on_demo_pierre: 0, on_reserver: 0, on_activate: 0, on_checkout: 0, window_seconds: 120, estimate: true, generated_at: new Date().toISOString() };

/**
 * Snapshot RÉSILIENT (E-R1 §18) : chaque section est chargée isolément. La panne d'une
 * source optionnelle (analytics, Stripe…) n'effondre jamais le cockpit ; la section
 * concernée est marquée « degraded ». Aucun secret dans les erreurs.
 */
export async function getFounderCommandCenterSnapshot(db: SqlExecutor): Promise<CommandCenterSnapshot> {
  const [metrics, revenue, presence, funnel, cohort, acquisition, emails, followups, sources, aiCost] = await Promise.all([
    safeSection(() => dashboardMetrics(db), EMPTY_METRICS),
    safeSection(() => founderRevenueMetrics(db), EMPTY_REVENUE),
    safeSection(() => presenceSnapshot(db), EMPTY_PRESENCE),
    safeSection(() => funnelSnapshot(db), { stages: [], since_days: 30, generated_at: new Date().toISOString() }),
    safeSection(() => cohortFunnelSnapshot(db), { eligible: 0, stages: [], since_days: 30, generated_at: new Date().toISOString() }),
    safeSection(() => acquisitionBreakdown(db), [] as Awaited<ReturnType<typeof acquisitionBreakdown>>),
    safeSection(() => emailOperations(db), EMPTY_EMAILS),
    safeSection(() => followupsDue(db), 0),
    safeSection(() => sourcesHealth(db), sourcesStatus()),
    safeSection(() => founderAiCostSummary(), null as FounderAiCostSummary | null),
  ]);

  const degraded = [
    ["overview", metrics], ["revenue", revenue], ["presence", presence], ["funnel", funnel],
    ["cohort_funnel", cohort], ["acquisition", acquisition], ["emails", emails], ["sources", sources],
  ].filter(([, s]) => (s as Section<unknown>).status === "error").map(([k]) => k as string);

  const overview: OverviewMetrics = { ...metrics.data, followups_due: followups.data, emails_dead: emails.data.dead, online_estimate: presence.data.online_total };
  return {
    overview, revenue: revenue.data, presence: presence.data, funnel: funnel.data, cohort_funnel: cohort.data,
    acquisition: acquisition.data, emails: emails.data,
    alerts: buildAlerts({ revenue: revenue.data, emails: emails.data, followups: followups.data, sources: sources.data }),
    sources: sources.data, ai_cost: aiCost.data, degraded, generated_at: new Date().toISOString(),
  };
}

/** Clients réellement actifs (status active_client), masquant les identifiants Stripe. */
export interface FounderClientRow {
  id: string; company_name: string; email: string; activated_at: string | null;
  subscription_status: string | null; subscription_amount_cents: number | null; currency: string | null;
  stripe_subscription_masked: string | null;
}
export async function listFounderClients(db: SqlExecutor, page = 1, pageSize = 25): Promise<{ rows: FounderClientRow[]; total: number }> {
  const limit = Math.max(1, Math.min(100, pageSize));
  const offset = (Math.max(1, page) - 1) * limit;
  const total = await db.query<{ n: number }>("select count(*)::int n from clonestore_founder_reservations where status='active_client'");
  const { rows } = await db.query<SqlRow>(
    `select id, company_name, email, activated_at, subscription_status, subscription_amount_cents, currency, stripe_subscription_id
       from clonestore_founder_reservations where status='active_client'
       order by activated_at desc nulls last limit $1 offset $2`,
    [limit, offset],
  );
  return {
    total: Number(total.rows[0]?.n) || 0,
    rows: rows.map((r) => {
      const sub = (r.stripe_subscription_id as string) ?? null;
      return {
        id: String(r.id), company_name: String(r.company_name), email: String(r.email),
        activated_at: (r.activated_at as string) ?? null, subscription_status: (r.subscription_status as string) ?? null,
        subscription_amount_cents: r.subscription_amount_cents != null ? Number(r.subscription_amount_cents) : null,
        currency: (r.currency as string) ?? null,
        stripe_subscription_masked: sub ? `${sub.slice(0, 7)}…${sub.slice(-4)}` : null,
      };
    }),
  };
}

// ── Liste paginée des jobs email (E-R2 §14) ─────────────────────────────────
export interface EmailJobRow {
  id: number; reservation_email: string; kind: string; status: string; attempts: number;
  send_at: string; next_attempt_at: string | null; last_error: string | null; updated_at: string;
}
export async function listEmailJobs(db: SqlExecutor, page = 1, pageSize = 25, status?: string): Promise<{ rows: EmailJobRow[]; total: number; page: number; pageSize: number }> {
  const limit = Math.max(1, Math.min(100, pageSize));
  const offset = (Math.max(1, page) - 1) * limit;
  const where = status ? "where j.status = $3" : "";
  const params: unknown[] = [limit, offset];
  if (status) params.push(status);
  const total = await db.query<{ n: number }>(`select count(*)::int n from clonestore_founder_email_jobs j ${where}`, status ? [status] : []);
  const { rows } = await db.query<EmailJobRow>(
    `select j.id, r.email as reservation_email, j.kind, j.status, j.attempts, j.send_at,
            j.next_attempt_at, j.last_error, j.updated_at
     from clonestore_founder_email_jobs j join clonestore_founder_reservations r on r.id=j.reservation_id
     ${where} order by j.updated_at desc limit $1 offset $2`,
    params,
  );
  return { rows, total: Number(total.rows[0]?.n) || 0, page: Math.max(1, page), pageSize: limit };
}

export type { ReservationRow };
