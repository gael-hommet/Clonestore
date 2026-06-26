// Phase E.2 — Founder Access : accès données (PostgreSQL réel via SqlExecutor).
// Aucune source de vérité hors Postgres. Écritures transactionnelles & idempotentes.

import type { SqlExecutor, SqlRow } from "@/lib/pierre/v1/sql";
import type { CompanySize, ContactStatus, EmailDomainType, ReservationStatus } from "./types";
import { assertTransition } from "./state-machine";
import { emailJobKey } from "./email-sequence";

export interface CreateReservationInput {
  email: string;
  email_normalized: string;
  email_domain_type: EmailDomainType;
  company_name: string;
  company_size: CompanySize;
  verification_hash: string;
  verification_expires_at: string;
  // tracking (tous facultatifs)
  source?: string | null;
  referrer?: string | null;
  landing_path?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  anonymous_session_id?: string | null;
  ip_hash?: string | null;
  user_agent_summary?: string | null;
}

export interface ReservationCreateResult {
  id: string;
  status: ReservationStatus;
  already_confirmed: boolean;
}

/**
 * Crée OU met à jour (idempotent sur email_normalized) une réservation, enregistre
 * l'événement funnel et la file email de vérification, en UNE transaction.
 * Ne renvoie jamais le token ni le fait que l'email existait déjà (already_confirmed
 * sert uniquement à décider d'un (re)envoi côté serveur).
 */
export async function createOrUpdateReservation(
  db: SqlExecutor,
  input: CreateReservationInput,
): Promise<ReservationCreateResult> {
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{ id: string; status: ReservationStatus; already_confirmed: boolean }>(
      `insert into clonestore_founder_reservations
         (email, email_normalized, email_domain_type, company_name, company_size, status,
          verification_token_hash, verification_expires_at,
          source, referrer, landing_path, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          anonymous_session_id, ip_hash, user_agent_summary, privacy_consent_at)
       values ($1,$2,$3,$4,$5,'email_to_confirm',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
       on conflict (email_normalized) do update set
         company_name = excluded.company_name,
         company_size = excluded.company_size,
         email_domain_type = excluded.email_domain_type,
         verification_token_hash = case when clonestore_founder_reservations.email_verified_at is null
                                        then excluded.verification_token_hash
                                        else clonestore_founder_reservations.verification_token_hash end,
         verification_expires_at = case when clonestore_founder_reservations.email_verified_at is null
                                        then excluded.verification_expires_at
                                        else clonestore_founder_reservations.verification_expires_at end,
         status = case when clonestore_founder_reservations.status = 'started'
                       then 'email_to_confirm' else clonestore_founder_reservations.status end,
         source = coalesce(clonestore_founder_reservations.source, excluded.source),
         anonymous_session_id = coalesce(excluded.anonymous_session_id, clonestore_founder_reservations.anonymous_session_id),
         updated_at = now()
       returning id, status, (email_verified_at is not null) as already_confirmed`,
      [
        input.email, input.email_normalized, input.email_domain_type, input.company_name, input.company_size,
        input.verification_hash, input.verification_expires_at,
        input.source ?? null, input.referrer ?? null, input.landing_path ?? null,
        input.utm_source ?? null, input.utm_medium ?? null, input.utm_campaign ?? null,
        input.utm_content ?? null, input.utm_term ?? null,
        input.anonymous_session_id ?? null, input.ip_hash ?? null, input.user_agent_summary ?? null,
      ],
    );
    const r = rows[0];

    await tx.query(
      `insert into clonestore_founder_funnel_events (reservation_id, anonymous_session_id, event_name, source, metadata_safe)
       values ($1,$2,'founder_reservation_created',$3,$4)`,
      [r.id, input.anonymous_session_id ?? null, input.source ?? null, JSON.stringify({ company_size: input.company_size })],
    );

    if (!r.already_confirmed) {
      // file email idempotente : un seul job de vérification par réservation
      await tx.query(
        `insert into clonestore_founder_email_jobs (job_key, reservation_id, kind, status, send_at)
         values ($1,$2,'verification','pending', now())
         on conflict (job_key) do update set status='pending', send_at=now(), updated_at=now()`,
        [emailJobKey(r.id, "verification"), r.id],
      );
    }
    return { id: r.id, status: r.status, already_confirmed: r.already_confirmed };
  });
}

/** Étape 2 facultative : qualification. Passe à qualified / strong_intent si contact demandé. */
export async function updateQualification(
  db: SqlExecutor,
  id: string,
  q: {
    full_name?: string;
    role?: string;
    primary_hr_need?: string;
    sector?: string;
    website?: string;
    phone?: string;
    contact_requested?: boolean;
  },
): Promise<{ id: string; status: ReservationStatus } | null> {
  return db.transaction(async (tx) => {
    const cur = await tx.query<{ status: ReservationStatus }>(
      "select status from clonestore_founder_reservations where id = $1 for update",
      [id],
    );
    if (cur.rows.length === 0) return null;
    const status = cur.rows[0].status;
    const strong = Boolean(q.contact_requested);
    // ne pas régresser un statut avancé ; sinon enrichir confirmed→qualified/strong_intent
    let nextStatus = status;
    if (status === "confirmed" || status === "qualified" || status === "strong_intent") {
      nextStatus = strong ? "strong_intent" : "qualified";
    }
    const { rows } = await tx.query<{ id: string; status: ReservationStatus }>(
      `update clonestore_founder_reservations set
         full_name = coalesce($2, full_name), role = coalesce($3, role),
         primary_hr_need = coalesce($4, primary_hr_need), sector = coalesce($5, sector),
         website = coalesce($6, website), phone = coalesce($7, phone),
         contact_requested = $8, strong_intent = (strong_intent or $8),
         status = $9, updated_at = now()
       where id = $1 returning id, status`,
      [id, q.full_name ?? null, q.role ?? null, q.primary_hr_need ?? null, q.sector ?? null,
       q.website ?? null, q.phone ?? null, strong, nextStatus],
    );
    // Événement de VÉRITÉ SERVEUR (la qualification a réellement été persistée).
    await tx.query(
      `insert into clonestore_founder_funnel_events (reservation_id, event_name, metadata_safe)
       values ($1,'founder_qualification_completed',$2)`,
      [id, JSON.stringify({ contact_requested: strong })],
    );
    if (strong) {
      await tx.query(
        `insert into clonestore_founder_funnel_events (reservation_id, event_name, metadata_safe)
         values ($1,'founder_contact_requested','{}'::jsonb)`,
        [id],
      );
    }
    return rows[0];
  });
}

/** Événement funnel append-only (ingest public / serveur). */
export async function recordFunnelEvent(
  db: SqlExecutor,
  e: {
    reservation_id?: string | null;
    anonymous_session_id?: string | null;
    event_name: string;
    source?: string | null;
    commercial_phase?: string | null;
    metadata_safe?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `insert into clonestore_founder_funnel_events
       (reservation_id, anonymous_session_id, event_name, source, commercial_phase, metadata_safe)
     values ($1,$2,$3,$4,$5,$6)`,
    [e.reservation_id ?? null, e.anonymous_session_id ?? null, e.event_name,
     e.source ?? null, e.commercial_phase ?? null, JSON.stringify(e.metadata_safe ?? {})],
  );
}

// ── Lectures administrateur ─────────────────────────────────────────────────

export interface DashboardMetrics {
  reservations_total: number;
  reservations_today: number;
  reservations_7d: number;
  emails_confirmed: number;
  confirmation_rate: number;
  strong_intent: number;
  contact_requested: number;
  activation_started: number;
  active_clients: number;
  generated_at: string;
}

export async function dashboardMetrics(db: SqlExecutor): Promise<DashboardMetrics> {
  const { rows } = await db.query<SqlRow>(
    `select
       count(*)::int as reservations_total,
       count(*) filter (where created_at >= date_trunc('day', now()))::int as reservations_today,
       count(*) filter (where created_at >= now() - interval '7 days')::int as reservations_7d,
       count(*) filter (where email_verified_at is not null)::int as emails_confirmed,
       count(*) filter (where strong_intent)::int as strong_intent,
       count(*) filter (where contact_requested)::int as contact_requested,
       count(*) filter (where status in ('activation_started','active_client'))::int as activation_started,
       count(*) filter (where status = 'active_client')::int as active_clients
     from clonestore_founder_reservations`,
  );
  const r = rows[0] as Record<string, number>;
  const total = Number(r.reservations_total) || 0;
  const confirmed = Number(r.emails_confirmed) || 0;
  return {
    reservations_total: total,
    reservations_today: Number(r.reservations_today) || 0,
    reservations_7d: Number(r.reservations_7d) || 0,
    emails_confirmed: confirmed,
    confirmation_rate: total > 0 ? Math.round((confirmed / total) * 1000) / 10 : 0,
    strong_intent: Number(r.strong_intent) || 0,
    contact_requested: Number(r.contact_requested) || 0,
    activation_started: Number(r.activation_started) || 0,
    active_clients: Number(r.active_clients) || 0,
    generated_at: new Date().toISOString(),
  };
}

export interface ReservationListFilters {
  search?: string;
  status?: ReservationStatus;
  company_size?: CompanySize;
  confirmed?: boolean;
  contact_requested?: boolean;
  contact_status?: ContactStatus;
  /** Exclut les clients actifs (onglet Prospects — E-R1 §20). */
  exclude_active_client?: boolean;
}

/** Construit la clause WHERE partagée par la liste paginée et l'export keyset. */
function buildReservationWhere(filters: ReservationListFilters): { sql: string; params: unknown[] } {
  const conds: string[] = [];
  const p: unknown[] = [];
  if (filters.search) {
    const s = `%${filters.search.toLowerCase()}%`;
    p.push(s, s);
    conds.push(`(email_normalized like $${p.length - 1} or lower(company_name) like $${p.length})`);
  }
  if (filters.status) { p.push(filters.status); conds.push(`status = $${p.length}`); }
  if (filters.company_size) { p.push(filters.company_size); conds.push(`company_size = $${p.length}`); }
  if (filters.contact_status) { p.push(filters.contact_status); conds.push(`contact_status = $${p.length}`); }
  if (filters.exclude_active_client) conds.push("status <> 'active_client'");
  if (typeof filters.confirmed === "boolean") conds.push(filters.confirmed ? "email_verified_at is not null" : "email_verified_at is null");
  if (typeof filters.contact_requested === "boolean") { p.push(filters.contact_requested); conds.push(`contact_requested = $${p.length}`); }
  return { sql: conds.length ? `where ${conds.join(" and ")}` : "", params: p };
}

export interface ReservationRow {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  company_name: string;
  company_size: string;
  full_name: string | null;
  role: string | null;
  primary_hr_need: string | null;
  sector: string | null;
  source: string | null;
  email_verified_at: string | null;
  strong_intent: boolean;
  contact_requested: boolean;
  contact_status: ContactStatus;
  contacted_at: string | null;
  next_followup_at: string | null;
  status: ReservationStatus;
}

const RESERVATION_LIST_COLUMNS =
  `id, created_at, updated_at, email, company_name, company_size, full_name, role,
   primary_hr_need, sector, source, email_verified_at, strong_intent, contact_requested,
   contact_status, contacted_at, next_followup_at, status`;

export async function listReservations(
  db: SqlExecutor,
  filters: ReservationListFilters,
  page = 1,
  pageSize = 25,
): Promise<{ rows: ReservationRow[]; total: number; page: number; pageSize: number }> {
  const { sql: whereSql, params: p } = buildReservationWhere(filters);

  const totalRes = await db.query<{ n: number }>(`select count(*)::int n from clonestore_founder_reservations ${whereSql}`, p);
  const total = Number(totalRes.rows[0]?.n) || 0;

  const limit = Math.max(1, Math.min(200, pageSize));
  const offset = (Math.max(1, page) - 1) * limit;
  const listParams = [...p, limit, offset];
  const list = await db.query<ReservationRow>(
    `select ${RESERVATION_LIST_COLUMNS}
     from clonestore_founder_reservations ${whereSql}
     order by created_at desc, id desc limit $${p.length + 1} offset $${p.length + 2}`,
    listParams,
  );
  return { rows: list.rows, total, page: Math.max(1, page), pageSize: limit };
}

export interface ReservationDetail extends ReservationRow {
  internal_notes: string | null;
  contacted_by: string | null;
  last_contact_note: string | null;
  email_domain_type: string;
  utm_source: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_amount_cents: number | null;
  activated_at: string | null;
  events: Array<{ event_name: string; occurred_at: string; source: string | null }>;
  email_jobs: Array<{ kind: string; status: string; send_at: string; sent_at: string | null; attempts: number; last_error: string | null }>;
}

export async function getReservationDetail(db: SqlExecutor, id: string): Promise<ReservationDetail | null> {
  const res = await db.query<SqlRow>(
    `select ${RESERVATION_LIST_COLUMNS}, internal_notes, contacted_by, last_contact_note,
            email_domain_type, utm_source, utm_campaign, landing_path,
            stripe_customer_id, stripe_subscription_id, subscription_amount_cents, activated_at
     from clonestore_founder_reservations where id = $1`,
    [id],
  );
  if (res.rows.length === 0) return null;
  const ev = await db.query<{ event_name: string; occurred_at: string; source: string | null }>(
    `select event_name, occurred_at, source from clonestore_founder_funnel_events
     where reservation_id = $1 order by occurred_at asc limit 200`,
    [id],
  );
  const jobs = await db.query<{ kind: string; status: string; send_at: string; sent_at: string | null; attempts: number; last_error: string | null }>(
    `select kind, status, send_at, sent_at, attempts, last_error from clonestore_founder_email_jobs where reservation_id = $1 order by send_at asc`,
    [id],
  );
  const r = res.rows[0];
  return { ...(r as unknown as ReservationRow), internal_notes: (r.internal_notes as string) ?? null,
    contacted_by: (r.contacted_by as string) ?? null, last_contact_note: (r.last_contact_note as string) ?? null,
    email_domain_type: String(r.email_domain_type), utm_source: (r.utm_source as string) ?? null,
    utm_campaign: (r.utm_campaign as string) ?? null, landing_path: (r.landing_path as string) ?? null,
    stripe_customer_id: (r.stripe_customer_id as string) ?? null, stripe_subscription_id: (r.stripe_subscription_id as string) ?? null,
    subscription_amount_cents: r.subscription_amount_cents != null ? Number(r.subscription_amount_cents) : null,
    activated_at: (r.activated_at as string) ?? null,
    events: ev.rows, email_jobs: jobs.rows };
}

export interface AdminReservationPatch {
  status?: ReservationStatus;
  strong_intent?: boolean;
  internal_notes?: string;
  // Relation commerciale (§3.5) — réellement persistée.
  contact_status?: ContactStatus;
  contacted?: boolean;            // raccourci : passe contact_status à 'contacted' + horodate
  next_followup_at?: string | null;
  last_contact_note?: string;
}

/**
 * Mise à jour gouvernée (machine d'état) d'une réservation par un administrateur,
 * incluant la relation commerciale persistée. `actorEmail` horodate qui a contacté.
 */
export async function updateReservationAdmin(
  db: SqlExecutor,
  id: string,
  patch: AdminReservationPatch,
  actorEmail?: string | null,
): Promise<{ id: string; status: ReservationStatus; contact_status: ContactStatus } | null> {
  return db.transaction(async (tx) => {
    const cur = await tx.query<{ status: ReservationStatus }>(
      "select status from clonestore_founder_reservations where id = $1 for update",
      [id],
    );
    if (cur.rows.length === 0) return null;
    if (patch.status && patch.status !== cur.rows[0].status) assertTransition(cur.rows[0].status, patch.status);

    // 'contacted: true' est un raccourci pour le statut 'contacted'.
    const nextContact: ContactStatus | null = patch.contact_status ?? (patch.contacted ? "contacted" : null);
    const markContactedNow = patch.contacted === true || nextContact === "contacted";

    const { rows } = await tx.query<{ id: string; status: ReservationStatus; contact_status: ContactStatus }>(
      `update clonestore_founder_reservations set
         status = coalesce($2, status),
         strong_intent = coalesce($3, strong_intent),
         internal_notes = coalesce($4, internal_notes),
         contact_status = coalesce($5, contact_status),
         contacted_at = case when $6 and contacted_at is null then now() else contacted_at end,
         contacted_by = case when $6 then coalesce($7, contacted_by) else contacted_by end,
         next_followup_at = case when $8 then $9 else next_followup_at end,
         last_contact_note = coalesce($10, last_contact_note),
         updated_at = now()
       where id = $1 returning id, status, contact_status`,
      [
        id, patch.status ?? null,
        typeof patch.strong_intent === "boolean" ? patch.strong_intent : null,
        patch.internal_notes ?? null,
        nextContact,
        markContactedNow,
        actorEmail ?? null,
        patch.next_followup_at !== undefined,
        patch.next_followup_at ?? null,
        patch.last_contact_note ?? null,
      ],
    );
    return rows[0];
  });
}

// ── Export CSV : keyset pagination (aucun plafond silencieux) + anti-injection ──

const CSV_HEADERS = ["date", "email", "entreprise", "taille", "nom", "fonction", "besoin_rh", "secteur", "source", "email_confirme", "intention_forte", "contact_demande", "contact_status", "statut"];

/** Échappement CSV + neutralisation des formules (=,+,-,@,tab,CR en tête de cellule). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // préfixe apostrophe (mitigation injection)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(r: ReservationRow): string {
  return [
    r.created_at, r.email, r.company_name, r.company_size, r.full_name, r.role, r.primary_hr_need,
    r.sector, r.source, r.email_verified_at ? "oui" : "non", r.strong_intent ? "oui" : "non",
    r.contact_requested ? "oui" : "non", r.contact_status, r.status,
  ].map(csvCell).join(";");
}

/**
 * Itère les réservations filtrées par lots via keyset pagination stable
 * (created_at desc, id desc). Aucune charge complète en mémoire, aucun plafond.
 */
export async function* iterateReservationsForExport(
  db: SqlExecutor,
  filters: ReservationListFilters,
  batchSize = 500,
): AsyncGenerator<ReservationRow, void, unknown> {
  const limit = Math.max(1, Math.min(2000, batchSize));
  const base = buildReservationWhere(filters);
  let cursor: { created_at: string; id: string } | null = null;

  for (;;) {
    const params = [...base.params];
    let where = base.sql;
    if (cursor) {
      params.push(cursor.created_at, cursor.id);
      const keyset = `(created_at, id) < ($${params.length - 1}, $${params.length})`;
      where = where ? `${where} and ${keyset}` : `where ${keyset}`;
    }
    params.push(limit);
    const { rows } = await db.query<ReservationRow>(
      `select ${RESERVATION_LIST_COLUMNS}
       from clonestore_founder_reservations ${where}
       order by created_at desc, id desc limit $${params.length}`,
      params,
    );
    if (rows.length === 0) return;
    for (const r of rows) yield r;
    if (rows.length < limit) return;
    const last = rows[rows.length - 1];
    cursor = { created_at: last.created_at, id: last.id };
  }
}

/** Générateur de chunks CSV (en-tête puis lignes) — pour streaming HTTP. */
export async function* streamReservationsCsv(
  db: SqlExecutor,
  filters: ReservationListFilters,
  batchSize = 500,
): AsyncGenerator<string, void, unknown> {
  yield CSV_HEADERS.join(";") + "\n";
  for await (const r of iterateReservationsForExport(db, filters, batchSize)) {
    yield csvRow(r) + "\n";
  }
}

/** Export CSV complet en mémoire (petits exports / tests). S'appuie sur le keyset. */
export async function exportReservationsCsv(db: SqlExecutor, filters: ReservationListFilters): Promise<string> {
  let out = "";
  for await (const chunk of streamReservationsCsv(db, filters)) out += chunk;
  return out.replace(/\n$/, "");
}

/** Confirme l'email via token (vérifie hash + expiration). Idempotent. */
export async function confirmReservation(
  db: SqlExecutor,
  id: string,
  providedToken: string,
): Promise<{ ok: boolean; reason?: "not_found" | "invalid" | "expired"; status?: ReservationStatus }> {
  const { verifyTokenHash, isExpired } = await import("./token");
  return db.transaction(async (tx) => {
    const cur = await tx.query<{ verification_token_hash: string | null; verification_expires_at: string | null; status: ReservationStatus; email_verified_at: string | null }>(
      "select verification_token_hash, verification_expires_at, status, email_verified_at from clonestore_founder_reservations where id = $1 for update",
      [id],
    );
    if (cur.rows.length === 0) return { ok: false, reason: "not_found" as const };
    const row = cur.rows[0];
    if (row.email_verified_at) return { ok: true, status: row.status }; // déjà confirmé (idempotent)
    if (!verifyTokenHash(providedToken, row.verification_token_hash)) return { ok: false, reason: "invalid" as const };
    if (isExpired(row.verification_expires_at)) return { ok: false, reason: "expired" as const };
    const nextStatus: ReservationStatus = row.status === "email_to_confirm" || row.status === "started" ? "confirmed" : row.status;
    await tx.query(
      "update clonestore_founder_reservations set email_verified_at = now(), status = $2, verification_token_hash = null, updated_at = now() where id = $1",
      [id, nextStatus],
    );
    await tx.query(
      "insert into clonestore_founder_funnel_events (reservation_id, event_name, metadata_safe) values ($1,'founder_email_verified','{}'::jsonb)",
      [id],
    );
    await tx.query(
      "update clonestore_founder_email_jobs set status='sent', sent_at=now(), updated_at=now() where reservation_id=$1 and kind='verification' and status<>'sent'",
      [id],
    );
    return { ok: true, status: nextStatus };
  });
}

/** Réservation non encore vérifiée correspondant à un email (pour le renvoi). */
export async function findReservationForResend(
  db: SqlExecutor,
  emailNormalized: string,
): Promise<{ id: string; verified: boolean; unsubscribed: boolean } | null> {
  const { rows } = await db.query<{ id: string; email_verified_at: string | null; status: ReservationStatus }>(
    "select id, email_verified_at, status from clonestore_founder_reservations where email_normalized=$1",
    [emailNormalized],
  );
  if (rows.length === 0) return null;
  return { id: rows[0].id, verified: rows[0].email_verified_at !== null, unsubscribed: rows[0].status === "unsubscribed" };
}

/**
 * E-R2 §6 — resend explicite : INCRÉMENTE la version de token (l'ancien lien
 * déterministe devient invalide), efface le hash courant (le worker recompute le
 * nouveau token), et remet le job de vérification en file. Retourne la nouvelle
 * version, ou null si la réservation est déjà confirmée. Idempotent côté file.
 */
export async function refreshVerificationToken(db: SqlExecutor, id: string): Promise<number | null> {
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{ verification_token_version: number }>(
      `update clonestore_founder_reservations
         set verification_token_version = coalesce(verification_token_version,1) + 1,
             verification_token_hash = null, updated_at = now()
       where id=$1 and email_verified_at is null
       returning verification_token_version`,
      [id],
    );
    if (rows.length === 0) return null; // déjà confirmé → rien à renvoyer
    await tx.query(
      `insert into clonestore_founder_email_jobs (job_key, reservation_id, kind, status, send_at)
       values ($1,$2,'verification','pending', now())
       on conflict (job_key) do update set status='pending', send_at=now(), next_attempt_at=null, verification_token=null, updated_at=now()`,
      [emailJobKey(id, "verification"), id],
    );
    return rows[0].verification_token_version;
  });
}

/** Pose le hash de vérification (token déterministe) si non encore confirmé. */
export async function setVerificationHash(db: SqlExecutor, id: string, hash: string, expiresAt: string): Promise<void> {
  await db.query(
    "update clonestore_founder_reservations set verification_token_hash=$2, verification_expires_at=$3, updated_at=now() where id=$1 and email_verified_at is null",
    [id, hash, expiresAt],
  );
}

/** Désinscription (droit utilisateur) : état terminal, hors machine d'état. Idempotent. */
export async function unsubscribeReservation(db: SqlExecutor, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `update clonestore_founder_reservations
         set status='unsubscribed', unsubscribed_at=coalesce(unsubscribed_at, now()), updated_at=now()
       where id=$1 returning id`,
      [id],
    );
    if (rows.length === 0) return false;
    // Annuler les emails en attente pour ce destinataire.
    await tx.query(
      "update clonestore_founder_email_jobs set status='skipped', skipped_at=now(), skip_reason='unsubscribed', updated_at=now() where reservation_id=$1 and status in ('pending')",
      [id],
    );
    await tx.query(
      "insert into clonestore_founder_funnel_events (reservation_id, event_name, metadata_safe) values ($1,'founder_unsubscribed','{}'::jsonb)",
      [id],
    );
    return true;
  });
}

/** Relance gouvernée des jobs email en dead-letter → pending (E-R1 §20). Retourne le nb. */
export async function requeueDeadEmailJobs(db: SqlExecutor, jobId?: number): Promise<number> {
  const sql = jobId
    ? `update clonestore_founder_email_jobs set status='pending', attempts=0, send_at=now(), next_attempt_at=null, locked_at=null, locked_by=null, last_error=null, updated_at=now() where status='dead' and id=$1 returning id`
    : `update clonestore_founder_email_jobs set status='pending', attempts=0, send_at=now(), next_attempt_at=null, locked_at=null, locked_by=null, last_error=null, updated_at=now() where status='dead' returning id`;
  const { rows } = await db.query<{ id: number }>(sql, jobId ? [jobId] : []);
  return rows.length;
}

/** Marque le job de vérification envoyé + enregistre l'événement (envoi immédiat best-effort). */
export async function markVerificationSent(db: SqlExecutor, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      "update clonestore_founder_email_jobs set status='sent', sent_at=now(), updated_at=now() where reservation_id=$1 and kind='verification'",
      [id],
    );
    await tx.query(
      "insert into clonestore_founder_funnel_events (reservation_id, event_name, metadata_safe) values ($1,'founder_verification_sent','{}'::jsonb)",
      [id],
    );
  });
}

// ── E.4 — Vérité Stripe : pont webhook → réservation fondateur ───────────────

export type StripeSubStatus = "active" | "trialing" | "incomplete" | "past_due" | "canceled" | "unpaid" | "incomplete_expired" | "paused" | "none";

export interface FounderStripeEventInput {
  stripe_event_id: string;            // OBLIGATOIRE (idempotence forte) — E-R1 §10
  event_type: string;
  event_created_at?: number | null;   // Stripe event.created (epoch secondes) — ordre monotone §7
  livemode?: boolean | null;
  api_version?: string | null;
  reservation_id: string | null;
  subscription_id?: string | null;
  customer_id?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  subscription_status: StripeSubStatus;
  current_period_end?: number | null;
  user_id?: string | null;
  /** E-R2 §4 — statut Stripe inconnu : journalisé 'unsupported', aucune mutation. */
  unsupported_raw_status?: string | null;
  /** E-R2 §2 — preuve commerciale refusée : journalisée 'proof_failed', aucune mutation. */
  proof_failed_reason?: string | null;
}

export type StripeApplyResult = { applied: boolean; duplicate: boolean; ignored?: "stale" | "same_order" | "terminal_precedence" | "no_reservation" | "reservation_missing" | "unsupported_status" };

/**
 * E-R2 §5 — écrit le journal Stripe via la fonction SECURITY DEFINER (aucun INSERT
 * brut applicatif). Retourne true si une ligne a été insérée (false = doublon idempotent).
 */
async function recordStripeEventControlled(
  exec: SqlExecutor, evt: FounderStripeEventInput, eventTs: string | null,
  processingResult: string, ignoredReason: string | null, payloadSafe: Record<string, unknown>,
  journalReservationId: string | null,
): Promise<boolean> {
  // journalReservationId : id de réservation à journaliser (null si la réservation
  // n'existe pas → on enregistre l'événement comme preuve, sans violer la FK).
  const p = {
    stripe_event_id: evt.stripe_event_id, event_type: evt.event_type, event_created_at: eventTs,
    livemode: evt.livemode ?? null, api_version: evt.api_version ?? null, reservation_id: journalReservationId,
    subscription_id: evt.subscription_id ?? null, customer_id: evt.customer_id ?? null,
    amount_cents: evt.amount_cents ?? null, currency: evt.currency ?? null,
    processing_result: processingResult, ignored_reason: ignoredReason, payload_safe: payloadSafe,
  };
  const { rows } = await exec.query<{ id: number | null }>(
    "select clonestore_record_founder_stripe_event($1::jsonb) as id", [JSON.stringify(p)],
  );
  return rows[0]?.id != null;
}

/** Vérifie l'existence d'une réservation (pour décider du lien FK du journal). */
async function reservationExistsFor(exec: SqlExecutor, id: string | null): Promise<boolean> {
  if (!id) return false;
  const { rows } = await exec.query<{ n: number }>("select count(*)::int n from clonestore_founder_reservations where id=$1", [id]);
  return (Number(rows[0]?.n) || 0) > 0;
}

const STRIPE_GRANTED: StripeSubStatus[] = ["active", "trialing"];
const STRIPE_UNFAVORABLE: StripeSubStatus[] = ["canceled", "unpaid", "incomplete_expired"];

/**
 * Applique un événement Stripe VÉRIFIÉ à la réservation fondateur. Source de vérité :
 * un prospect ne devient client actif que sur preuve webhook. Idempotent par
 * stripe_event_id (journal append-only, NOT NULL). Ordre MONOTONE (§7) : un événement
 * plus ancien que le dernier appliqué est ignoré (jamais de réactivation d'un canceled
 * par un ancien active). N'active jamais sur simple page de succès.
 */
export async function applyFounderStripeEvent(
  db: SqlExecutor,
  evt: FounderStripeEventInput,
): Promise<StripeApplyResult> {
  const eventTs = typeof evt.event_created_at === "number" ? new Date(evt.event_created_at * 1000).toISOString() : null;
  const periodEnd = typeof evt.current_period_end === "number" ? new Date(evt.current_period_end * 1000).toISOString() : null;

  const { decideStripeApplication } = await import("./stripe-proof");
  const incomingKey = { created: typeof evt.event_created_at === "number" ? evt.event_created_at : 0, event_id: evt.stripe_event_id };
  const incomingGrants = STRIPE_GRANTED.includes(evt.subscription_status);

  // E-R2 §2/§4 — événement non activable (statut inconnu / preuve commerciale refusée) :
  // journalisé fail-closed, AUCUNE mutation de la réservation.
  const failClosed = evt.unsupported_raw_status
    ? { result: "unsupported", reason: `unsupported_stripe_status:${evt.unsupported_raw_status}`.slice(0, 200), ignored: "unsupported_status" as const }
    : evt.proof_failed_reason
    ? { result: "proof_failed", reason: `proof_failed:${evt.proof_failed_reason}`.slice(0, 200), ignored: "unsupported_status" as const }
    : null;
  if (failClosed) {
    const journalRid = (await reservationExistsFor(db, evt.reservation_id ?? null)) ? (evt.reservation_id ?? null) : null;
    const inserted = await recordStripeEventControlled(db, evt, eventTs, failClosed.result, failClosed.reason, { raw_status: evt.unsupported_raw_status ?? null }, journalRid);
    return { applied: false, duplicate: !inserted, ignored: failClosed.ignored };
  }

  return db.transaction(async (tx) => {
    // 1) Verrou + ordre TOTAL déterministe (created + event_id, précédence terminale).
    let reservationExists = false;
    let decision: ReturnType<typeof decideStripeApplication> = { apply: true };
    if (evt.reservation_id) {
      const cur = await tx.query<{ stripe_event_created_at: string | null; last_stripe_event_id: string | null; subscription_status: StripeSubStatus | null }>(
        "select stripe_event_created_at, last_stripe_event_id, subscription_status from clonestore_founder_reservations where id=$1 for update",
        [evt.reservation_id],
      );
      reservationExists = cur.rows.length > 0;
      if (reservationExists) {
        const prevTs = cur.rows[0].stripe_event_created_at;
        const last = prevTs ? { created: Math.floor(new Date(prevTs).getTime() / 1000), event_id: cur.rows[0].last_stripe_event_id ?? "" } : null;
        const currentUnfavorable = cur.rows[0].subscription_status != null && STRIPE_UNFAVORABLE.includes(cur.rows[0].subscription_status);
        decision = decideStripeApplication({ incoming: incomingKey, last, incomingGrants, currentUnfavorable });
      }
    }
    const ignoredReason = decision.apply ? null : decision.reason;
    const result: string = !evt.reservation_id ? "no_reservation" : !reservationExists ? "reservation_missing" : decision.apply ? "applied" : `ignored_${decision.reason}`;

    // 2) Journal append-only + idempotence forte par stripe_event_id (insert contrôlé §5).
    const journalRid = reservationExists ? (evt.reservation_id ?? null) : null;
    const inserted = await recordStripeEventControlled(tx, evt, eventTs, result, ignoredReason, { status: evt.subscription_status }, journalRid);
    if (!inserted) return { applied: false, duplicate: true };

    if (!evt.reservation_id) return { applied: true, duplicate: false, ignored: "no_reservation" };
    if (!reservationExists) return { applied: false, duplicate: false, ignored: "reservation_missing" };
    if (!decision.apply) return { applied: false, duplicate: false, ignored: decision.reason };

    const granted = incomingGrants;
    if (granted) {
      await tx.query(
        `update clonestore_founder_reservations set
           status='active_client', subscription_status=$2,
           activated_at=coalesce(activated_at, now()),
           stripe_customer_id=coalesce($3, stripe_customer_id),
           stripe_subscription_id=coalesce($4, stripe_subscription_id),
           subscription_amount_cents=coalesce($5, subscription_amount_cents),
           currency=coalesce($6, currency),
           user_id=coalesce($7, user_id),
           subscription_current_period_end=coalesce($8, subscription_current_period_end),
           last_stripe_event_id=$9, last_stripe_event_type=$10, stripe_event_created_at=coalesce($11, stripe_event_created_at),
           updated_at=now()
         where id=$1`,
        [evt.reservation_id, evt.subscription_status, evt.customer_id ?? null, evt.subscription_id ?? null,
         evt.amount_cents ?? null, evt.currency ?? null, evt.user_id ?? null, periodEnd,
         evt.stripe_event_id, evt.event_type, eventTs],
      );
      await tx.query(
        "insert into clonestore_founder_funnel_events (reservation_id, event_name, metadata_safe) values ($1,'founder_payment_completed','{}'::jsonb), ($1,'founder_subscription_active','{}'::jsonb)",
        [evt.reservation_id],
      );
    } else {
      // Révocation/impayé : refléter le statut (le MRR n'en tient plus compte) sans
      // effacer l'historique d'activation. Événement de funnel serveur correspondant.
      await tx.query(
        `update clonestore_founder_reservations set
           subscription_status=$2,
           last_stripe_event_id=$3, last_stripe_event_type=$4, stripe_event_created_at=coalesce($5, stripe_event_created_at),
           updated_at=now()
         where id=$1`,
        [evt.reservation_id, evt.subscription_status, evt.stripe_event_id, evt.event_type, eventTs],
      );
      const churnEvent = evt.subscription_status === "past_due" ? "founder_subscription_past_due" : "founder_subscription_canceled";
      await tx.query(
        "insert into clonestore_founder_funnel_events (reservation_id, event_name, metadata_safe) values ($1,$2,'{}'::jsonb)",
        [evt.reservation_id, churnEvent],
      );
    }
    return { applied: true, duplicate: false };
  });
}

/** E-R2 §4 — nombre d'événements Stripe non traités (statut inconnu / preuve refusée). */
export async function stripeAnomalyCount(db: SqlExecutor): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int n from clonestore_founder_stripe_events where processing_result in ('unsupported','proof_failed')",
  );
  return Number(rows[0]?.n) || 0;
}

export interface ReservationForActivation {
  id: string; email_normalized: string; company_name: string; status: ReservationStatus;
  verified: boolean; unsubscribed: boolean; user_id: string | null;
}

/** Réservation pour l'activation (vérification serveur : email lié, phase, statut). */
export async function getReservationForActivation(
  db: SqlExecutor, id: string,
): Promise<ReservationForActivation | null> {
  const { rows } = await db.query<{ id: string; email_normalized: string; company_name: string; status: ReservationStatus; email_verified_at: string | null; user_id: string | null }>(
    "select id, email_normalized, company_name, status, email_verified_at, user_id from clonestore_founder_reservations where id=$1",
    [id],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id, email_normalized: r.email_normalized, company_name: r.company_name, status: r.status,
    verified: r.email_verified_at !== null, unsubscribed: r.status === "unsubscribed", user_id: r.user_id ?? null,
  };
}

export interface FounderRevenueMetrics {
  active_subscriptions: number;
  mrr_active_cents: number;
  arr_active_cents: number;
  activated_total: number;
  past_due: number;
  canceled: number;
  /** La source Stripe est-elle connectée ? Sinon le cockpit affiche « Source non connectée ». */
  stripe_connected: boolean;
  generated_at: string;
}

/** Revenu RÉEL dérivé des activations confirmées par webhook (jamais inventé). */
export async function founderRevenueMetrics(db: SqlExecutor): Promise<FounderRevenueMetrics> {
  const { rows } = await db.query<SqlRow>(
    `select
       count(*) filter (where subscription_status in ('active','trialing'))::int as active_subscriptions,
       coalesce(sum(subscription_amount_cents) filter (where subscription_status in ('active','trialing')),0)::bigint as mrr_active_cents,
       count(*) filter (where activated_at is not null)::int as activated_total,
       count(*) filter (where subscription_status='past_due')::int as past_due,
       count(*) filter (where subscription_status='canceled')::int as canceled
     from clonestore_founder_reservations`,
  );
  const r = rows[0] as Record<string, unknown>;
  const mrr = Number(r.mrr_active_cents) || 0;
  return {
    active_subscriptions: Number(r.active_subscriptions) || 0,
    mrr_active_cents: mrr,
    arr_active_cents: mrr * 12,
    activated_total: Number(r.activated_total) || 0,
    past_due: Number(r.past_due) || 0,
    canceled: Number(r.canceled) || 0,
    stripe_connected: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    generated_at: new Date().toISOString(),
  };
}

// ── Audit administrateur (append-only) ──────────────────────────────────────

export async function recordAdminAudit(
  db: SqlExecutor,
  a: { actor_email: string; action: string; target?: string | null; result?: string | null; context_safe?: Record<string, unknown> },
): Promise<void> {
  await db.query(
    `insert into clonestore_founder_admin_audit (actor_email, action, target, result, context_safe)
     values ($1,$2,$3,$4,$5)`,
    [a.actor_email, a.action, a.target ?? null, a.result ?? null, JSON.stringify(a.context_safe ?? {})],
  );
}
