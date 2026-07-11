// Cabinets Fondateurs — mises en relation nominatives (introductions).
//
// AUCUNE LIMITE DE VOLUME. « Cinq entreprises » est un premier objectif commercial,
// jamais un plafond produit : un cabinet peut en présenter 1, 5, 20, 100 ou davantage.
// Les lectures sont PAGINÉES côté serveur (jamais de chargement global).
//
// Le rapprochement d'attribution ne repose JAMAIS sur du texte non normalisé :
// on stocke un domaine normalisé + un e-mail normalisé + une empreinte d'entreprise.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { companyFingerprint, normalizeEmail, normalizeDomain, emailDomain } from "./identity";
import { getProgramSettings } from "./settings";
import { getPartnerById } from "./partners";
import { recordAudit } from "./audit";
import { enqueuePartnerEmailTx } from "./emails";

export type IntroductionInput = {
  companyName: string;
  companyDomain?: string | null; // site web de l'entreprise
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  note?: string | null;
};

export type SubmitResult =
  | { ok: true; introductionId: string; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Le cabinet enregistre une entreprise (même si elle n'a jamais cliqué sur son lien).
 * Idempotent sur (partenaire, empreinte entreprise) active. Aucun quota.
 */
export async function submitIntroduction(tx: SqlExecutor, partnerId: string, input: IntroductionInput): Promise<SubmitResult> {
  const partner = await getPartnerById(tx, partnerId);
  if (!partner) return { ok: false, error: "partner_not_found" };
  if (partner.status !== "active") return { ok: false, error: "partner_inactive" };
  if (!input.companyName || input.companyName.trim().length < 2) return { ok: false, error: "company_required" };

  // Normalisation : le domaine prime (site web), sinon le domaine de l'e-mail du contact.
  const domain = normalizeDomain(input.companyDomain ?? null) ?? emailDomain(input.contactEmail ?? null);
  const fingerprint = companyFingerprint({ companyName: input.companyName, email: input.contactEmail ?? null });

  // Anti-auto-parrainage : le cabinet ne peut pas s'introduire lui-même.
  if (domain && (partner.self_domains ?? []).map((d) => d.toLowerCase()).includes(domain)) {
    await tx.query(
      `insert into clonestore_pp_risk_flags (partner_id, entity_type, entity_id, kind, severity, explanation, status)
       values ($1,'introduction',$2,'self_referral_suspected','high','Le domaine de l’entreprise introduite est un domaine du cabinet lui-même.','open')`,
      [partnerId, partnerId],
    );
    return { ok: false, error: "self_referral" };
  }

  const mine = await tx.query<{ id: string }>(
    `select id from clonestore_pp_introductions
     where partner_id=$1 and company_fingerprint=$2 and status in ('submitted','validated','matched') limit 1`,
    [partnerId, fingerprint],
  );
  if (mine.rows.length) return { ok: true, introductionId: mine.rows[0].id, duplicate: true };

  // Entreprise déjà protégée par un AUTRE cabinet → conflit tracé, refus explicite.
  const other = await tx.query<{ id: string; partner_id: string }>(
    `select id, partner_id from clonestore_pp_introductions
     where (company_fingerprint=$1 or (company_domain is not null and company_domain=$2))
       and status in ('validated','matched') and partner_id <> $3 limit 1`,
    [fingerprint, domain, partnerId],
  );
  if (other.rows.length) {
    await tx.query(
      `insert into clonestore_pp_attribution_decisions
         (decision, source, partner_id, competing_partner_id, company_domain, company_fingerprint, introduction_id, reason, conflict)
       values ('conflict_manual_review','introduction',$1,$2,$3,$4,$5,'Entreprise déjà protégée par un autre cabinet.',true)`,
      [partnerId, other.rows[0].partner_id, domain, fingerprint, other.rows[0].id],
    );
    return { ok: false, error: "company_already_protected" };
  }

  const ins = await tx.query<{ id: string }>(
    `insert into clonestore_pp_introductions
       (partner_id, company_name, company_fingerprint, company_domain, contact_name, contact_email,
        contact_email_normalized, note, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'submitted') returning id`,
    [
      partnerId, input.companyName.slice(0, 200), fingerprint, domain,
      input.contactName?.slice(0, 160) ?? null, input.contactEmail?.slice(0, 200) ?? null,
      input.contactEmail ? normalizeEmail(input.contactEmail) : null,
      input.note?.slice(0, 1000) ?? null,
    ],
  );
  const introductionId = ins.rows[0].id;

  await enqueuePartnerEmailTx(tx, {
    partnerId, kind: "introduction_received", toEmail: partner.email_normalized,
    idempotencyKey: `pp-email:introduction_received:${introductionId}`,
    payload: { companyName: input.companyName },
  });
  return { ok: true, introductionId, duplicate: false };
}

// ── Validation / refus (admin, exception) ────────────────────────────────────

export async function validateIntroduction(tx: SqlExecutor, introductionId: string, actor: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const settings = await getProgramSettings(tx);
  const rows = await tx.query<{ id: string; company_fingerprint: string; company_domain: string | null; partner_id: string; status: string }>(
    `select id, company_fingerprint, company_domain, partner_id, status from clonestore_pp_introductions where id=$1`,
    [introductionId],
  );
  const intro = rows.rows[0];
  if (!intro) return { ok: false, error: "not_found" };
  if (intro.status !== "submitted") return { ok: false, error: "not_submittable" };

  const other = await tx.query(
    `select 1 from clonestore_pp_introductions
     where (company_fingerprint=$1 or (company_domain is not null and company_domain=$2))
       and status in ('validated','matched') and partner_id <> $3 limit 1`,
    [intro.company_fingerprint, intro.company_domain, intro.partner_id],
  );
  if (other.rows.length) return { ok: false, error: "company_already_protected" };

  const protectedUntil = new Date(Date.now() + settings.protectionWindowDays * 24 * 60 * 60 * 1000).toISOString();
  await tx.query(
    `update clonestore_pp_introductions set status='validated', validated_at=now(), validated_by=$2, protected_until=$3, updated_at=now() where id=$1`,
    [introductionId, actor, protectedUntil],
  );
  await recordAudit(tx, { actor, action: "introduction.validated", entityType: "introduction", entityId: introductionId, reason, next: { protectedUntil } });
  return { ok: true };
}

export async function rejectIntroduction(tx: SqlExecutor, introductionId: string, actor: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const res = await tx.query(
    `update clonestore_pp_introductions set status='rejected', rejected_reason=$2, updated_at=now() where id=$1 and status='submitted' returning id`,
    [introductionId, reason],
  );
  if (!res.rows.length) return { ok: false, error: "not_submittable" };
  await recordAudit(tx, { actor, action: "introduction.rejected", entityType: "introduction", entityId: introductionId, reason });
  return { ok: true };
}

// ── Lecture PAGINÉE (volume élevé supporté) ─────────────────────────────────

export type IntroductionLine = {
  id: string;
  companyName: string;
  companyDomain: string | null;
  status: string;
  submittedAt: string;
  protectedUntil: string | null;
};

export type IntroductionPage = {
  items: IntroductionLine[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

/** Bornes de pagination : jamais de chargement global, jamais de plafond métier. */
export function clampPaging(limit?: number, offset?: number): { limit: number; offset: number } {
  const l = Number.isFinite(limit) && (limit as number) > 0 ? Math.min(Math.floor(limit as number), 100) : 25;
  const o = Number.isFinite(offset) && (offset as number) >= 0 ? Math.floor(offset as number) : 0;
  return { limit: l, offset: o };
}

/**
 * Liste PAGINÉE des introductions d'un cabinet, avec filtre de statut optionnel.
 * Aucun quota : un cabinet peut en avoir 1 ou 10 000 — seule la page demandée est lue.
 */
export async function listIntroductionsPaged(
  tx: SqlExecutor,
  partnerId: string,
  opts?: { limit?: number; offset?: number; status?: string | null },
): Promise<IntroductionPage> {
  const { limit, offset } = clampPaging(opts?.limit, opts?.offset);
  const status = opts?.status && opts.status !== "all" ? opts.status : null;

  const totalRow = await tx.query<{ n: number }>(
    `select count(*)::int n from clonestore_pp_introductions where partner_id=$1 and ($2::text is null or status=$2)`,
    [partnerId, status],
  );
  const total = Number(totalRow.rows[0]?.n ?? 0);

  const { rows } = await tx.query<IntroductionLine>(
    `select id, company_name as "companyName", company_domain as "companyDomain", status,
            submitted_at as "submittedAt", protected_until as "protectedUntil"
     from clonestore_pp_introductions
     where partner_id=$1 and ($2::text is null or status=$2)
     order by submitted_at desc, id desc
     limit $3 offset $4`,
    [partnerId, status, limit, offset],
  );

  return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
}
