// CloneStory — administration minimale (SERVER-ONLY, mode service).
// Toute action sensible : exige une RAISON, conserve l'ancien et le nouvel état,
// est horodatée et tracée dans un journal APPEND-ONLY. Aucune suppression de preuve.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getClonestoryDb, withService } from "./runtime";
import type { IntroductionRow, PartnerRow } from "./store";
import {
  verifyCommercialContribution,
  invalidateCommercialContribution,
  reconcileCommercial,
} from "./commercial";
import { anonymizeIntroductionProspect, anonymizeWithdrawnPartner } from "./compliance";

const PARTNER_COLS =
  "id, status, email, email_normalized, first_name, last_name, display_name, phone, company, role, " +
  "introduced_by_partner_id, registry_number, public_slug, link_token, link_token_hash, link_revoked_at, personal_code, " +
  "email_verified_at, identity_verified_at, joined_at, suspended_at";

async function recordAudit(
  tx: SqlExecutor,
  a: { actor: string; action: string; partnerId?: string | null; introductionId?: string | null; reason: string; prev?: unknown; next?: unknown },
): Promise<void> {
  await tx.query(
    `insert into clonestory_fp_admin_audit (actor, action, partner_id, introduction_id, reason, prev_state, new_state)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [a.actor, a.action, a.partnerId ?? null, a.introductionId ?? null, a.reason, JSON.stringify(a.prev ?? null), JSON.stringify(a.next ?? null)],
  );
}

export async function adminSearchPartners(query: string, limit = 50): Promise<PartnerRow[]> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const q = `%${(query ?? "").trim().toLowerCase()}%`;
    const { rows } = await tx.query<PartnerRow>(
      `select ${PARTNER_COLS} from clonestory_fp_partners
        where ($1 = '%%' or lower(email) like $1 or lower(display_name) like $1 or personal_code like upper($1))
        order by joined_at desc limit $2`,
      [q, Math.min(limit, 200)],
    );
    return rows;
  });
}

export interface AdminPartnerDetail {
  partner: PartnerRow | null;
  introductions: IntroductionRow[];
  events: { id: string; type: string; source: string; evidence_ref: string | null; occurred_at: string }[];
  audit: { actor: string; action: string; reason: string; occurred_at: string }[];
}

export async function adminGetPartnerDetail(partnerId: string): Promise<AdminPartnerDetail> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows: pr } = await tx.query<PartnerRow>(`select ${PARTNER_COLS} from clonestory_fp_partners where id = $1`, [partnerId]);
    const { rows: introductions } = await tx.query<IntroductionRow>(
      `select id, partner_id, method, status, prospect_first_name, prospect_company, prospect_email, note,
              declared_at, confirmed_at, verified_at, dispute_flag
         from clonestory_fp_introductions where partner_id = $1 order by created_at desc limit 500`,
      [partnerId],
    );
    const { rows: events } = await tx.query<AdminPartnerDetail["events"][number]>(
      `select id::text, type, source, evidence_ref, occurred_at from clonestory_fp_contribution_events
        where partner_id = $1 order by occurred_at desc limit 500`,
      [partnerId],
    );
    const { rows: audit } = await tx.query<AdminPartnerDetail["audit"][number]>(
      `select actor, action, reason, occurred_at from clonestory_fp_admin_audit where partner_id = $1 order by occurred_at desc limit 500`,
      [partnerId],
    );
    return { partner: pr[0] ?? null, introductions, events, audit };
  });
}

export async function adminListConflicts(): Promise<IntroductionRow[]> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<IntroductionRow>(
      `select id, partner_id, method, status, prospect_first_name, prospect_company, prospect_email, note,
              declared_at, confirmed_at, verified_at, dispute_flag
         from clonestory_fp_introductions where status = 'disputed' or dispute_flag = true order by created_at desc limit 500`,
    );
    return rows;
  });
}

export async function adminSetSuspension(
  actor: string,
  partnerId: string,
  suspend: boolean,
  reason: string,
): Promise<{ ok: boolean }> {
  if (!reason?.trim()) return { ok: false };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{
      status: string; status_before_suspension: string | null;
      email_verified_at: string | null; identity_verified_at: string | null;
    }>(
      `select status, status_before_suspension, email_verified_at, identity_verified_at
         from clonestory_fp_partners where id = $1`,
      [partnerId],
    );
    if (!rows[0]) return { ok: false };
    const prev = rows[0].status;

    if (suspend) {
      // Mémorise le VRAI statut courant (sauf si déjà suspendu : on garde l'original).
      await tx.query(
        `update clonestory_fp_partners
            set status = 'suspended', suspended_at = now(), suspended_reason = $2,
                status_before_suspension = coalesce(case when status <> 'suspended' then status end, status_before_suspension),
                updated_at = now()
          where id = $1`,
        [partnerId, reason.trim()],
      );
      await recordAudit(tx, {
        actor, action: "partner.suspend", partnerId, reason: reason.trim(),
        prev: { status: prev }, next: { status: "suspended" },
      });
      return { ok: true };
    }

    // Réactivation : restaure le statut mémorisé ; sinon reconstruit depuis les jalons.
    let restored = rows[0].status_before_suspension;
    if (!restored || restored === "suspended" || restored === "withdrawn") {
      const { rows: m } = await tx.query<{ verified: number; confirmed: number }>(
        `select
           (select count(*)::int from clonestory_fp_introductions where partner_id = $1 and status = 'verified') as verified,
           (select count(*)::int from clonestory_fp_introductions where partner_id = $1
              and status in ('prospect_confirmed','prospect_registered','company_created','purchase_captured','activation_completed','validation_pending')) as confirmed`,
        [partnerId],
      );
      const verified = Number(m[0]?.verified) || 0;
      const confirmed = Number(m[0]?.confirmed) || 0;
      restored = verified >= 1 ? "founding_partner"
        : confirmed >= 1 ? "active_contributor"
        : rows[0].identity_verified_at ? "identity_verified"
        : rows[0].email_verified_at ? "email_verified"
        : "registered";
    }

    await tx.query(
      `update clonestory_fp_partners
          set status = $2, suspended_at = null, suspended_reason = null, status_before_suspension = null, updated_at = now()
        where id = $1`,
      [partnerId, restored],
    );
    await recordAudit(tx, {
      actor, action: "partner.reinstate", partnerId, reason: reason.trim(),
      prev: { status: prev }, next: { status: restored },
    });
    return { ok: true };
  });
}

export async function adminRevokeLink(actor: string, partnerId: string, reason: string): Promise<{ ok: boolean }> {
  if (!reason?.trim()) return { ok: false };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ link_token: string | null; link_revoked_at: string | null }>(
      `select link_token, link_revoked_at from clonestory_fp_partners where id = $1`,
      [partnerId],
    );
    if (!rows[0]) return { ok: false };
    await tx.query(`update clonestory_fp_partners set link_revoked_at = now(), updated_at = now() where id = $1`, [partnerId]);
    await recordAudit(tx, {
      actor, action: "partner.revoke_link", partnerId, reason: reason.trim(),
      prev: { link_revoked_at: rows[0].link_revoked_at }, next: { link_revoked_at: "now" },
    });
    return { ok: true };
  });
}

export async function adminResolveDispute(
  actor: string,
  introductionId: string,
  decision: "verified" | "canceled",
  reason: string,
): Promise<{ ok: boolean }> {
  if (!reason?.trim()) return { ok: false };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ partner_id: string; status: string }>(
      `select partner_id, status from clonestory_fp_introductions where id = $1`,
      [introductionId],
    );
    if (!rows[0]) return { ok: false };
    const prev = rows[0].status;
    await tx.query(
      `update clonestory_fp_introductions set status = $2, dispute_flag = false,
              canceled_at = case when $2 = 'canceled' then now() else canceled_at end, updated_at = now()
        where id = $1`,
      [introductionId, decision],
    );
    await tx.query(
      `insert into clonestory_fp_contribution_events (partner_id, introduction_id, type, source, evidence_ref)
       values ($1,$2,'manual_validation','manual',$3)`,
      [rows[0].partner_id, introductionId, `admin:${actor}`],
    );
    await recordAudit(tx, {
      actor, action: "dispute.resolve", partnerId: rows[0].partner_id, introductionId, reason: reason.trim(),
      prev: { status: prev }, next: { status: decision },
    });
    return { ok: true };
  });
}

export async function adminListAudit(limit = 100): Promise<{ actor: string; action: string; reason: string; occurred_at: string }[]> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ actor: string; action: string; reason: string; occurred_at: string }>(
      `select actor, action, reason, occurred_at from clonestory_fp_admin_audit order by occurred_at desc limit $1`,
      [Math.min(limit, 500)],
    );
    return rows;
  });
}

// ── CS-FINAL 3 — administration des contributions commerciales ──────────────────
// Lectures SÛRES : montants/devise/statut (contexte admin), JAMAIS de numéro de carte,
// de secret, de metadata interne, d'IP, de fingerprint ni d'e-mail prospect en clair.
export interface AdminCommercialRow {
  id: string; partner_id: string; status: string; product_slug: string | null;
  currency: string | null; gross_amount: number; refunded_amount: number; net_amount: number;
  validation_started_at: string | null; verified_at: string | null; created_at: string;
}

/** Contributions à examiner : en validation, en litige ou invalidées récemment. */
export async function adminListCommercialReview(limit = 100): Promise<AdminCommercialRow[]> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    try {
      const { rows } = await tx.query<AdminCommercialRow>(
        `select id::text, partner_id::text, status, product_slug, currency,
                gross_amount, refunded_amount, net_amount, validation_started_at, verified_at, created_at
           from clonestory_fp_commercial_contributions
          where status in ('validation_pending','disputed','invalidated')
          order by created_at desc limit $1`,
        [Math.min(limit, 500)],
      );
      return rows;
    } catch {
      return []; /* table absente (prod sans _07) */
    }
  });
}

/** Vérifie manuellement une contribution (admin) — peut forcer le délai, avec audit. */
export async function adminVerifyContribution(
  actor: string, contributionId: string, reason: string, overrideDelay = true,
): Promise<{ ok: boolean; verified?: boolean; reason?: string }> {
  if (!reason?.trim()) return { ok: false };
  const res = await verifyCommercialContribution(contributionId, new Date(), overrideDelay);
  const db = await getClonestoryDb();
  await withService(db, (tx) => recordAudit(tx, {
    actor, action: "commercial.verify", reason: reason.trim(),
    prev: null, next: { contributionId, verified: res.verified, reason: res.reason },
  }));
  return { ok: res.verified, verified: res.verified, reason: res.reason };
}

/** Invalide manuellement une contribution (admin), sans effacer l'historique. */
export async function adminInvalidateContribution(
  actor: string, contributionId: string, reason: string,
): Promise<{ ok: boolean }> {
  if (!reason?.trim()) return { ok: false };
  const res = await invalidateCommercialContribution(contributionId, `admin:${actor}:${reason.trim()}`);
  const db = await getClonestoryDb();
  await withService(db, (tx) => recordAudit(tx, {
    actor, action: "commercial.invalidate", reason: reason.trim(),
    prev: null, next: { contributionId, ok: res.ok },
  }));
  return res;
}

/** Déclenche une réconciliation contrôlée (admin) — idempotente, non destructive. */
export async function adminReconcileCommercial(actor: string, reason: string): Promise<{ ok: boolean; verified: number; scanned: number }> {
  if (!reason?.trim()) return { ok: false, verified: 0, scanned: 0 };
  const res = await reconcileCommercial(new Date());
  const db = await getClonestoryDb();
  await withService(db, (tx) => recordAudit(tx, {
    actor, action: "commercial.reconcile", reason: reason.trim(),
    prev: null, next: res,
  }));
  return { ok: true, ...res };
}

// ── CS-FINAL 4 — tableau de bord, notes, reprise email, anonymisation ───────────
export interface AdminDashboardCounts {
  partners: { total: number; verified: number; founding: number; suspended: number; withdrawn: number };
  funnel: { declared: number; confirmed: number; registered: number; companies: number; clients: number; verified: number };
  emails: { verificationDead: number; notificationsDead: number; commercialDead: number };
  stripe: { failed: number; pending: number };
  conflicts: number;
}

/** Comptages du tableau de bord admin (lecture seule, aucune PII, repli gracieux). */
export async function adminDashboardCounts(): Promise<AdminDashboardCounts> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const n = async (sql: string) => { try { return Number((await tx.query<{ n: number }>(sql)).rows[0]?.n ?? 0); } catch { return 0; } };
    const intro = (statuses: string[]) => `select count(*)::int n from clonestory_fp_introductions where status in (${statuses.map((s) => `'${s}'`).join(",")})`;
    return {
      partners: {
        total: await n(`select count(*)::int n from clonestory_fp_partners`),
        verified: await n(`select count(*)::int n from clonestory_fp_partners where email_verified_at is not null and status not in ('suspended','withdrawn')`),
        founding: await n(`select count(*)::int n from clonestory_fp_partners where registry_number is not null`),
        suspended: await n(`select count(*)::int n from clonestory_fp_partners where status = 'suspended'`),
        withdrawn: await n(`select count(*)::int n from clonestory_fp_partners where status = 'withdrawn'`),
      },
      funnel: {
        declared: await n(`select count(*)::int n from clonestory_fp_introductions`),
        confirmed: await n(intro(["prospect_confirmed", "prospect_registered", "company_created", "purchase_captured", "activation_completed", "validation_pending", "verified"])),
        registered: await n(intro(["prospect_registered", "company_created", "purchase_captured", "activation_completed", "validation_pending", "verified"])),
        companies: await n(intro(["company_created", "purchase_captured", "activation_completed", "validation_pending", "verified"])),
        clients: await n(intro(["purchase_captured", "activation_completed", "validation_pending", "verified"])),
        verified: await n(intro(["verified"])),
      },
      emails: {
        verificationDead: await n(`select count(*)::int n from clonestory_fp_email_outbox where status = 'dead'`),
        notificationsDead: await n(`select count(*)::int n from clonestory_fp_notifications_outbox where status = 'dead'`),
        commercialDead: await n(`select count(*)::int n from clonestory_fp_commercial_outbox where status = 'dead'`),
      },
      stripe: {
        failed: await n(`select count(*)::int n from clonestory_fp_stripe_events where processing_result = 'failed'`),
        pending: await n(`select count(*)::int n from clonestory_fp_stripe_events where processing_result = 'pending'`),
      },
      conflicts: await n(`select count(*)::int n from clonestory_fp_attribution_events where type = 'attribution_conflict_detected'`),
    };
  });
}

/** Ajoute une note interne (append-only) sur un partenaire. */
export async function adminAddNote(actor: string, partnerId: string, note: string): Promise<{ ok: boolean }> {
  const text = (note ?? "").trim();
  if (!text) return { ok: false };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(`select id from clonestory_fp_partners where id = $1`, [partnerId]);
    if (!rows[0]) return { ok: false };
    await tx.query(`insert into clonestory_fp_admin_notes (partner_id, author, note) values ($1,$2,$3)`, [partnerId, actor, text.slice(0, 2000)]);
    await recordAudit(tx, { actor, action: "partner.note", partnerId, reason: "note interne", prev: null, next: { len: text.length } });
    return { ok: true };
  });
}

/**
 * Reprise (re-armement) des emails MORTS/échoués des trois outboxes : status→pending,
 * attempts→0, next_attempt_at→now (même idempotency_key/token → aucun double envoi logique).
 */
export async function adminReplayEmails(actor: string, reason: string): Promise<{ ok: boolean; rearmed: number }> {
  if (!reason?.trim()) return { ok: false, rearmed: 0 };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    let rearmed = 0;
    for (const table of ["clonestory_fp_email_outbox", "clonestory_fp_notifications_outbox", "clonestory_fp_commercial_outbox"]) {
      try {
        const { rows } = await tx.query<{ id: string }>(
          `update ${table} set status='pending', attempts=0, next_attempt_at=now(), locked_at=null, updated_at=now()
            where status in ('dead','failed_retryable') returning id`,
        );
        rearmed += rows.length;
      } catch { /* table absente (prod sans _07/_08) */ }
    }
    await recordAudit(tx, { actor, action: "email.replay", reason: reason.trim(), prev: null, next: { rearmed } });
    return { ok: true, rearmed };
  });
}

/** Anonymise le prospect d'une introduction (RGPD) — non destructif, audité. */
export async function adminAnonymizeProspect(actor: string, introductionId: string, reason: string): Promise<{ ok: boolean }> {
  if (!reason?.trim()) return { ok: false };
  const res = await anonymizeIntroductionProspect(introductionId, actor, reason.trim());
  const db = await getClonestoryDb();
  await withService(db, (tx) => recordAudit(tx, { actor, action: "introduction.anonymize", introductionId, reason: reason.trim(), prev: null, next: res }));
  return res;
}

/** Anonymise un partenaire RETIRÉ (RGPD) — conserve registry_number, non destructif, audité. */
export async function adminAnonymizePartner(actor: string, partnerId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  if (!reason?.trim()) return { ok: false };
  const res = await anonymizeWithdrawnPartner(partnerId, actor, reason.trim());
  const db = await getClonestoryDb();
  await withService(db, (tx) => recordAudit(tx, { actor, action: "partner.anonymize", partnerId, reason: reason.trim(), prev: null, next: res }));
  return res;
}
