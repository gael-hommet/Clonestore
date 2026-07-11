// Programme partenaires — mises en relation nominatives (introductions).
// Le cabinet propose des entreprises ; l'admin valide → protection nominative (6 mois par
// défaut). Une entreprise validée n'est protégée que pour UN cabinet (index unique).

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { companyFingerprint, normalizeEmail } from "./identity";
import { getProgramSettings } from "./settings";
import { getPartnerById } from "./partners";
import { recordAudit } from "./audit";
import { enqueuePartnerEmailTx } from "./emails";

export type IntroductionInput = {
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  note?: string | null;
};

export type SubmitResult =
  | { ok: true; introductionId: string; duplicate: boolean }
  | { ok: false; error: string };

/** Le cabinet soumet une entreprise. Idempotent sur (partenaire, empreinte entreprise) active. */
export async function submitIntroduction(tx: SqlExecutor, partnerId: string, input: IntroductionInput): Promise<SubmitResult> {
  const partner = await getPartnerById(tx, partnerId);
  if (!partner) return { ok: false, error: "partner_not_found" };
  if (partner.status !== "active") return { ok: false, error: "partner_inactive" };
  if (!input.companyName || input.companyName.trim().length < 2) return { ok: false, error: "company_required" };

  const fingerprint = companyFingerprint({ companyName: input.companyName, email: input.contactEmail ?? null });

  // Déjà soumise/active par CE cabinet ?
  const mine = await tx.query<{ id: string }>(
    `select id from clonestore_pp_introductions where partner_id=$1 and company_fingerprint=$2 and status in ('submitted','validated','matched') limit 1`,
    [partnerId, fingerprint],
  );
  if (mine.rows.length) return { ok: true, introductionId: mine.rows[0].id, duplicate: true };

  // Déjà protégée par un AUTRE cabinet ? (conflit d'attribution nominative)
  const other = await tx.query<{ id: string }>(
    `select id from clonestore_pp_introductions where company_fingerprint=$1 and status in ('validated','matched') and partner_id <> $2 limit 1`,
    [fingerprint, partnerId],
  );
  if (other.rows.length) return { ok: false, error: "company_already_protected" };

  const ins = await tx.query<{ id: string }>(
    `insert into clonestore_pp_introductions
       (partner_id, company_name, company_fingerprint, contact_name, contact_email, contact_email_normalized, note, status)
     values ($1,$2,$3,$4,$5,$6,$7,'submitted') returning id`,
    [
      partnerId, input.companyName.slice(0, 200), fingerprint, input.contactName?.slice(0, 160) ?? null,
      input.contactEmail?.slice(0, 200) ?? null, input.contactEmail ? normalizeEmail(input.contactEmail) : null,
      input.note?.slice(0, 1000) ?? null,
    ],
  );
  const introductionId = ins.rows[0].id;
  await enqueuePartnerEmailTx(tx, {
    partnerId, kind: "introduction_received", toEmail: partner.email_normalized,
    idempotencyKey: `pp-email:introduction_received:${introductionId}`, payload: { companyName: input.companyName },
  });
  return { ok: true, introductionId, duplicate: false };
}

/** Admin valide une introduction → pose la protection nominative (protection_window_days). */
export async function validateIntroduction(tx: SqlExecutor, introductionId: string, actor: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const settings = await getProgramSettings(tx);
  const rows = await tx.query<{ id: string; company_fingerprint: string; partner_id: string; status: string }>(
    `select id, company_fingerprint, partner_id, status from clonestore_pp_introductions where id=$1`,
    [introductionId],
  );
  const intro = rows.rows[0];
  if (!intro) return { ok: false, error: "not_found" };
  if (intro.status !== "submitted") return { ok: false, error: "not_submittable" };

  // Re-vérifie l'absence de protection concurrente au moment de valider.
  const other = await tx.query(
    `select 1 from clonestore_pp_introductions where company_fingerprint=$1 and status in ('validated','matched') and partner_id <> $2 limit 1`,
    [intro.company_fingerprint, intro.partner_id],
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

/** Admin refuse une introduction. */
export async function rejectIntroduction(tx: SqlExecutor, introductionId: string, actor: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const res = await tx.query(
    `update clonestore_pp_introductions set status='rejected', rejected_reason=$2, updated_at=now() where id=$1 and status='submitted' returning id`,
    [introductionId, reason],
  );
  if (!res.rows.length) return { ok: false, error: "not_submittable" };
  await recordAudit(tx, { actor, action: "introduction.rejected", entityType: "introduction", entityId: introductionId, reason });
  return { ok: true };
}

export type IntroductionLine = {
  id: string;
  companyName: string;
  status: string;
  submittedAt: string;
  protectedUntil: string | null;
};

/** Liste les introductions d'un cabinet (pour l'espace partenaire). */
export async function listIntroductions(tx: SqlExecutor, partnerId: string): Promise<IntroductionLine[]> {
  const { rows } = await tx.query<IntroductionLine>(
    `select id, company_name as "companyName", status, submitted_at as "submittedAt", protected_until as "protectedUntil"
     from clonestore_pp_introductions where partner_id=$1 order by submitted_at desc limit 200`,
    [partnerId],
  );
  return rows;
}
