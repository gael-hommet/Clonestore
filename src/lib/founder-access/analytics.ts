// Phase E.5 — Analytics first-party (PostgreSQL réel). Respectueux de la vie privée :
// session anonyme, aucun fingerprinting invasif, métadonnées sûres. Présence et
// funnel calculés à partir d'événements réels (jamais inventés).

import type { SqlExecutor, SqlRow } from "@/lib/pierre/v1/sql";
import { CLIENT_ANALYTICS_EVENTS, SERVER_FUNNEL_EVENTS, type ClientAnalyticsEvent, type DeviceCategory } from "./types";

// Identifiant de session anonyme strict : UUID v4 (E-R1 §5). Aucun contrôle
// arbitraire d'une session par une chaîne libre.
export const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isValidSessionId(v: unknown): v is string {
  return typeof v === "string" && SESSION_ID_RE.test(v);
}

export interface WebSessionInput {
  anonymous_session_id: string;
  current_path?: string | null;
  landing_path?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  device_category?: DeviceCategory | null;
  browser_family?: string | null;
  commercial_phase?: string | null;
  reservation_id?: string | null;
}

/** Upsert d'une session web (heartbeat). Les champs d'origine ne sont posés qu'une fois. */
export async function upsertWebSession(db: SqlExecutor, s: WebSessionInput): Promise<void> {
  await db.query(
    `insert into clonestore_web_sessions
       (anonymous_session_id, current_path, landing_path, referrer, utm_source, utm_medium, utm_campaign,
        utm_content, utm_term, device_category, browser_family, commercial_phase, reservation_id, last_seen_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
     on conflict (anonymous_session_id) do update set
       current_path = excluded.current_path,
       commercial_phase = coalesce(excluded.commercial_phase, clonestore_web_sessions.commercial_phase),
       reservation_id = coalesce(excluded.reservation_id, clonestore_web_sessions.reservation_id),
       last_seen_at = now()`,
    [
      s.anonymous_session_id, s.current_path ?? null, s.landing_path ?? null, s.referrer ?? null,
      s.utm_source ?? null, s.utm_medium ?? null, s.utm_campaign ?? null, s.utm_content ?? null, s.utm_term ?? null,
      s.device_category ?? null, s.browser_family ?? null, s.commercial_phase ?? null, s.reservation_id ?? null,
    ],
  );
}

const CLIENT_EVENT_SET = new Set<string>(CLIENT_ANALYTICS_EVENTS);
const SERVER_EVENT_SET = new Set<string>(SERVER_FUNNEL_EVENTS);

/** Événement que le NAVIGATEUR a le droit d'émettre (ingestion publique). */
export function isClientAnalyticsEvent(name: string): name is ClientAnalyticsEvent {
  return CLIENT_EVENT_SET.has(name);
}
/** Événement de VÉRITÉ SERVEUR (jamais accepté depuis une route publique). */
export function isServerFunnelEvent(name: string): boolean {
  return SERVER_EVENT_SET.has(name);
}
/** Alias historique = liste blanche client. */
export const isAnalyticsEvent = isClientAnalyticsEvent;

/** Insère des événements web (noms validés, métadonnées bornées). Retourne le nb inséré. */
export async function recordWebEvents(
  db: SqlExecutor,
  sessionId: string | null,
  events: Array<{ name: string; path?: string | null; metadata_safe?: Record<string, unknown> }>,
): Promise<number> {
  let n = 0;
  for (const e of events.slice(0, 20)) {
    if (!isAnalyticsEvent(e.name)) continue;
    await db.query(
      "insert into clonestore_web_events (anonymous_session_id, event_name, path, metadata_safe) values ($1,$2,$3,$4)",
      [sessionId, e.name, (e.path ?? null), JSON.stringify(e.metadata_safe ?? {})],
    );
    n++;
  }
  return n;
}

export interface PresenceSnapshot {
  online_total: number;
  on_homepage: number;
  on_demo: number;
  on_demo_pierre: number;
  on_reserver: number;
  on_activate: number;
  on_checkout: number;
  window_seconds: number;
  /** Estimation first-party (jamais présentée comme une vérité absolue). */
  estimate: true;
  generated_at: string;
}

/** Visiteurs « en ligne » = sessions vues dans la fenêtre. Estimation first-party. */
export async function presenceSnapshot(db: SqlExecutor, windowSeconds = 120): Promise<PresenceSnapshot> {
  const { rows } = await db.query<SqlRow>(
    `select
       count(*)::int as online_total,
       count(*) filter (where current_path = '/')::int as on_homepage,
       count(*) filter (where current_path like '/demo/pierre%')::int as on_demo_pierre,
       count(*) filter (where current_path like '/demo%' and current_path not like '/demo/pierre%')::int as on_demo,
       count(*) filter (where current_path like '/reserver%')::int as on_reserver,
       count(*) filter (where current_path like '/activate%')::int as on_activate,
       count(*) filter (where current_path like '/checkout%' or current_path like '/paiement%')::int as on_checkout
     from clonestore_web_sessions
     where last_seen_at >= now() - ($1 || ' seconds')::interval`,
    [windowSeconds],
  );
  const r = rows[0] as Record<string, number>;
  return {
    online_total: Number(r.online_total) || 0,
    on_homepage: Number(r.on_homepage) || 0,
    on_demo: Number(r.on_demo) || 0,
    on_demo_pierre: Number(r.on_demo_pierre) || 0,
    on_reserver: Number(r.on_reserver) || 0,
    on_activate: Number(r.on_activate) || 0,
    on_checkout: Number(r.on_checkout) || 0,
    window_seconds: windowSeconds,
    estimate: true,
    generated_at: new Date().toISOString(),
  };
}

// ── Funnel commercial (volumes + conversions, à partir d'événements réels) ───
export interface FunnelStage { key: string; label: string; event: string; count: number; from_prev: number | null; from_top: number | null }

const FUNNEL_DEFS: Array<{ key: string; label: string; event: string }> = [
  { key: "site", label: "Visiteur du site", event: "site_viewed" },
  { key: "demo", label: "Visiteur /demo", event: "demo_viewed" },
  { key: "demo_done", label: "Fin /demo", event: "demo_completed" },
  { key: "pierre", label: "Début /demo/pierre", event: "pierre_demo_started" },
  { key: "pierre_done", label: "Fin /demo/pierre", event: "pierre_demo_completed" },
  { key: "cta", label: "Clic réservation", event: "founder_cta_clicked" },
  { key: "form", label: "Formulaire commencé", event: "founder_form_step1_started" },
  { key: "reservation", label: "Réservation", event: "founder_reservation_created" },
  { key: "confirmed", label: "Email confirmé", event: "founder_email_verified" },
  { key: "activation", label: "Activation commencée", event: "founder_activation_started" },
  { key: "checkout", label: "Checkout", event: "founder_checkout_started" },
  { key: "payment", label: "Paiement", event: "founder_payment_completed" },
];

/** Funnel agrégé : sessions distinctes par étape, conversions vs précédent et vs sommet. */
export async function funnelSnapshot(db: SqlExecutor, sinceDays = 30): Promise<{ stages: FunnelStage[]; since_days: number; generated_at: string }> {
  const { rows } = await db.query<{ event_name: string; n: number }>(
    `select event_name, count(distinct coalesce(anonymous_session_id, 'e:' || id::text))::int as n
     from (
       select event_name, anonymous_session_id, id, occurred_at from clonestore_web_events
       union all
       select event_name, anonymous_session_id, id, occurred_at from clonestore_founder_funnel_events
     ) u
     where occurred_at >= now() - ($1 || ' days')::interval
     group by event_name`,
    [sinceDays],
  );
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.event_name, Number(r.n) || 0);

  const top = counts.get(FUNNEL_DEFS[0].event) || 0;
  let prev: number | null = null;
  const stages: FunnelStage[] = FUNNEL_DEFS.map((d) => {
    const count = counts.get(d.event) || 0;
    const from_prev = prev && prev > 0 ? Math.round((count / prev) * 1000) / 10 : null;
    const from_top = top > 0 ? Math.round((count / top) * 1000) / 10 : null;
    prev = count;
    return { key: d.key, label: d.label, event: d.event, count, from_prev, from_top };
  });
  return { stages, since_days: sinceDays, generated_at: new Date().toISOString() };
}

// ── Funnel COHORTÉ (E-R1 §17) ────────────────────────────────────────────────
// Cohorte unique = sessions ayant vu le site (site_viewed) dans la période. Chaque
// étape compte les sessions de CETTE cohorte ayant atteint l'étape → conversion depuis
// le sommet bornée à 100 % (pas de populations différentes). Session-scopé : les
// événements de vérité serveur sans session (paiement) ne figurent pas ici — voir le
// funnel événementiel pour ces étapes. Honnête par construction.
export async function cohortFunnelSnapshot(db: SqlExecutor, sinceDays = 30): Promise<{ eligible: number; stages: FunnelStage[]; since_days: number; generated_at: string }> {
  const stageEvents = FUNNEL_DEFS.map((d) => d.event);
  // Première occurrence de chaque étape, par session, dans la période. La cohorte est
  // l'ensemble des sessions ayant vu le site (site_viewed). Session-scopé : les
  // événements serveur sans session n'apparaissent pas ici (voir funnelSnapshot).
  const { rows } = await db.query<{ sid: string; event_name: string; first_at: string }>(
    `with u as (
       select anonymous_session_id sid, event_name, occurred_at from clonestore_web_events
       union all select anonymous_session_id, event_name, occurred_at from clonestore_founder_funnel_events)
     select sid, event_name, min(occurred_at) as first_at
     from u
     where sid is not null and occurred_at >= now() - ($1 || ' days')::interval and event_name = any($2)
     group by sid, event_name`,
    [sinceDays, stageEvents],
  );

  // Map session → { event → premier timestamp (ms) }.
  const perSession = new Map<string, Map<string, number>>();
  for (const r of rows) {
    let m = perSession.get(r.sid);
    if (!m) { m = new Map(); perSession.set(r.sid, m); }
    m.set(r.event_name, new Date(r.first_at).getTime());
  }

  // §10 — franchissement TEMPOREL : une session atteint l'étape k seulement si toutes
  // les étapes 1..k ont une première occurrence en ordre non décroissant.
  const counts = new Array(FUNNEL_DEFS.length).fill(0);
  let eligible = 0;
  for (const m of perSession.values()) {
    const topTime = m.get(FUNNEL_DEFS[0].event);
    if (topTime === undefined) continue; // pas dans la cohorte (pas de site_viewed)
    eligible++;
    counts[0]++;
    let prevTime = topTime;
    for (let k = 1; k < FUNNEL_DEFS.length; k++) {
      const t = m.get(FUNNEL_DEFS[k].event);
      if (t === undefined || t < prevTime) break; // étape manquante ou antérieure → s'arrête
      counts[k]++;
      prevTime = t;
    }
  }

  let prev: number | null = null;
  const stages: FunnelStage[] = FUNNEL_DEFS.map((d, i) => {
    const count = counts[i];
    const from_prev = prev && prev > 0 ? Math.round((count / prev) * 1000) / 10 : null;
    const from_top = eligible > 0 ? Math.round((count / eligible) * 1000) / 10 : null;
    prev = count;
    return { key: d.key, label: d.label, event: d.event, count, from_prev, from_top };
  });
  return { eligible, stages, since_days: sinceDays, generated_at: new Date().toISOString() };
}

// ── Acquisition multi-dimensions (E-R1 §15) ─────────────────────────────────
export type AcquisitionDimension = "source" | "source_medium" | "campaign" | "referrer";
export interface AcquisitionRow {
  key: string; sessions: number; reservations: number; activations: number; payments: number;
  reservation_conversion_rate: number; payment_conversion_rate: number;
  /** alias historique = reservation_conversion_rate. */
  conversion: number;
}

const DIM_SQL: Record<AcquisitionDimension, string> = {
  source: "coalesce(nullif(s.utm_source,''),'(direct)')",
  source_medium: "coalesce(nullif(s.utm_source,''),'(direct)') || ' / ' || coalesce(nullif(s.utm_medium,''),'(none)')",
  campaign: "coalesce(nullif(s.utm_campaign,''),'(none)')",
  referrer: "coalesce(nullif(s.referrer,''),'(direct)')",
};

export async function acquisitionByDimension(db: SqlExecutor, dimension: AcquisitionDimension = "source", sinceDays = 30): Promise<AcquisitionRow[]> {
  const dim = DIM_SQL[dimension] ?? DIM_SQL.source;
  const { rows } = await db.query<{ key: string; sessions: number; reservations: number; activations: number; payments: number }>(
    `select ${dim} as key,
            count(distinct s.anonymous_session_id)::int as sessions,
            count(distinct r.id)::int as reservations,
            count(distinct r.id) filter (where r.activated_at is not null)::int as activations,
            count(distinct r.id) filter (where r.subscription_status in ('active','trialing'))::int as payments
     from clonestore_web_sessions s
     left join clonestore_founder_reservations r on r.anonymous_session_id = s.anonymous_session_id
     where s.started_at >= now() - ($1 || ' days')::interval
     group by 1 order by sessions desc limit 50`,
    [sinceDays],
  );
  return rows.map((r) => {
    const sessions = Number(r.sessions) || 0;
    const reservations = Number(r.reservations) || 0;
    const payments = Number(r.payments) || 0;
    const resRate = sessions > 0 ? Math.round((reservations / sessions) * 1000) / 10 : 0;
    return {
      key: r.key, sessions, reservations,
      activations: Number(r.activations) || 0, payments,
      reservation_conversion_rate: resRate,
      payment_conversion_rate: sessions > 0 ? Math.round((payments / sessions) * 1000) / 10 : 0,
      conversion: resRate,
    };
  });
}

/** Compat : breakdown par source (utilisé par le snapshot par défaut). */
export async function acquisitionBreakdown(db: SqlExecutor, sinceDays = 30): Promise<Array<{ utm_source: string; sessions: number; reservations: number }>> {
  const rows = await acquisitionByDimension(db, "source", sinceDays);
  return rows.map((r) => ({ utm_source: r.key, sessions: r.sessions, reservations: r.reservations }));
}
