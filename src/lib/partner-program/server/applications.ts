// Programme partenaires — candidatures de cabinets + acceptation/refus + création du cabinet.
// SERVER-ONLY. Toutes les opérations en mode service (withService), écritures transactionnelles.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { normalizeEmail, sha256, slugifyCabinet, generateReferralCode } from "./identity";
import { getProgramSettings } from "./settings";
import { recordAudit } from "./audit";
import { enqueuePartnerEmailTx } from "./emails";
import { getBaseUrl } from "@/lib/base-url";

export type ApplicationInput = {
  cabinetName: string;
  firstName: string;
  lastName: string;
  roleTitle?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  country: string;
  cabinetType: string;
  clientsCountBucket?: string | null;
  services?: string[];
  message?: string | null;
  consentContact: boolean;
  consentPrivacy: boolean;
  ipHash?: string | null;
  uaSummary?: string | null;
};

export type CreateApplicationResult =
  | { ok: true; applicationId: string; duplicate: false }
  | { ok: true; applicationId: string; duplicate: true } // candidature déjà ouverte (réponse neutre)
  | { ok: false; error: string };

/**
 * Enregistre une candidature. Idempotent sur une candidature OUVERTE par email (l'index
 * partiel uq_pp_app_open_email empêche les doublons ouverts) — un second envoi renvoie la
 * candidature existante (réponse neutre côté route, ne révèle rien).
 */
export async function createApplication(tx: SqlExecutor, input: ApplicationInput): Promise<CreateApplicationResult> {
  const settings = await getProgramSettings(tx);
  if (settings.programStatus !== "open") return { ok: false, error: "program_closed" };

  const emailNorm = normalizeEmail(input.email);
  const dedupeKey = sha256(`${emailNorm}|${slugifyCabinet(input.cabinetName)}`);
  const services = Array.isArray(input.services) ? input.services.slice(0, 40).map((s) => String(s).slice(0, 80)) : [];

  // Candidature ouverte déjà présente ?
  const existing = await tx.query<{ id: string }>(
    `select id from clonestore_pp_applications where email_normalized = $1 and status in ('received','under_review') limit 1`,
    [emailNorm],
  );
  if (existing.rows.length) {
    return { ok: true, applicationId: existing.rows[0].id, duplicate: true };
  }

  const inserted = await tx.query<{ id: string }>(
    `insert into clonestore_pp_applications
       (cabinet_name, first_name, last_name, role_title, email, email_normalized, phone, website,
        country, cabinet_type, clients_count_bucket, services, message, consent_contact, consent_privacy,
        status, dedupe_key, ip_hash, ua_summary)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'received',$16,$17,$18)
     returning id`,
    [
      input.cabinetName.slice(0, 200), input.firstName.slice(0, 120), input.lastName.slice(0, 120),
      input.roleTitle?.slice(0, 120) ?? null, input.email.slice(0, 200), emailNorm,
      input.phone?.slice(0, 60) ?? null, input.website?.slice(0, 200) ?? null,
      input.country.slice(0, 8), input.cabinetType.slice(0, 60), input.clientsCountBucket?.slice(0, 40) ?? null,
      services, input.message?.slice(0, 2000) ?? null, input.consentContact === true, input.consentPrivacy === true,
      dedupeKey, input.ipHash ?? null, input.uaSummary?.slice(0, 300) ?? null,
    ],
  );
  const applicationId = inserted.rows[0].id;
  // Email « candidature reçue » enfilé dans la MÊME transaction (idempotent).
  await enqueuePartnerEmailTx(tx, {
    applicationId, kind: "application_received", toEmail: input.email,
    idempotencyKey: `pp-email:application_received:${applicationId}`,
  });
  return { ok: true, applicationId, duplicate: false };
}

/** Passe une candidature en revue (received → under_review). */
export async function markApplicationUnderReview(tx: SqlExecutor, applicationId: string, actor: string): Promise<void> {
  await tx.query(
    `update clonestore_pp_applications set status='under_review', reviewed_by=$2, updated_at=now()
     where id=$1 and status='received'`,
    [applicationId, actor],
  );
  await recordAudit(tx, { actor, action: "application.under_review", entityType: "application", entityId: applicationId, reason: "revue démarrée" });
}

export type AcceptResult =
  | { ok: true; partnerId: string; publicSlug: string; referralCode: string }
  | { ok: false; error: string };

/**
 * Accepte une candidature : crée le cabinet partenaire (statut contract_pending), génère
 * un slug public unique, un code de recommandation à forte entropie (haché) et un lien.
 * Copie les paramètres commerciaux effectifs du programme sur le cabinet.
 */
export async function acceptApplication(
  tx: SqlExecutor,
  applicationId: string,
  actor: string,
  reason: string,
): Promise<AcceptResult> {
  const appRows = await tx.query<{
    id: string; cabinet_name: string; first_name: string; last_name: string; role_title: string | null;
    email: string; email_normalized: string; phone: string | null; website: string | null;
    country: string; cabinet_type: string; status: string; created_partner_id: string | null;
  }>(`select * from clonestore_pp_applications where id = $1`, [applicationId]);
  if (!appRows.rows.length) return { ok: false, error: "application_not_found" };
  const app = appRows.rows[0];
  if (app.status === "accepted" && app.created_partner_id) return { ok: false, error: "already_accepted" };
  if (app.status === "rejected" || app.status === "withdrawn") return { ok: false, error: "application_closed" };

  const settings = await getProgramSettings(tx);

  // Slug public unique (suffixe incrémental si collision).
  const baseSlug = slugifyCabinet(app.cabinet_name);
  let slug = baseSlug;
  for (let i = 2; i <= 50; i++) {
    const clash = await tx.query(`select 1 from clonestore_pp_partners where public_slug = $1`, [slug]);
    if (!clash.rows.length) break;
    slug = `${baseSlug}-${i}`;
  }

  const partnerRows = await tx.query<{ id: string }>(
    `insert into clonestore_pp_partners
       (application_id, email, email_normalized, display_name, legal_name, contact_first_name, contact_last_name,
        contact_role, phone, website, country, cabinet_type, public_slug, status,
        commission_rate_bps, attribution_window_days, protection_window_days, reserve_days,
        payout_threshold_minor, payout_currency)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'contract_pending',$14,$15,$16,$17,$18,$19)
     returning id`,
    [
      app.id, app.email, app.email_normalized, app.cabinet_name, app.cabinet_name, app.first_name, app.last_name,
      app.role_title, app.phone, app.website, app.country, app.cabinet_type, slug,
      settings.commissionRateBps, settings.attributionWindowDays, settings.protectionWindowDays, settings.reserveDays,
      settings.payoutThresholdMinor, settings.currency,
    ],
  );
  const partnerId = partnerRows.rows[0].id;

  // Code de recommandation (haché ; le clair n'est retourné qu'ici, une seule fois).
  const code = generateReferralCode();
  await tx.query(
    `insert into clonestore_pp_partner_codes (partner_id, code_hash, code_hint, generation, status)
     values ($1,$2,$3,1,'active')`,
    [partnerId, code.hash, code.hint],
  );
  await tx.query(
    `update clonestore_pp_applications set status='accepted', reviewed_by=$2, reviewed_at=now(), review_reason=$3, created_partner_id=$4, updated_at=now()
     where id=$1`,
    [applicationId, actor, reason, partnerId],
  );
  await recordAudit(tx, {
    actor, action: "application.accepted", entityType: "application", entityId: applicationId,
    reason, next: { partnerId, slug },
  });
  await enqueuePartnerEmailTx(tx, {
    partnerId, applicationId, kind: "application_accepted", toEmail: app.email,
    idempotencyKey: `pp-email:application_accepted:${partnerId}`,
    payload: { spaceUrl: `${getBaseUrl()}/partenaires/espace` },
  });
  return { ok: true, partnerId, publicSlug: slug, referralCode: code.code };
}

/** Refuse une candidature (raison obligatoire, auditée). */
export async function rejectApplication(tx: SqlExecutor, applicationId: string, actor: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const res = await tx.query(
    `update clonestore_pp_applications set status='rejected', reviewed_by=$2, reviewed_at=now(), review_reason=$3, updated_at=now()
     where id=$1 and status in ('received','under_review') returning id`,
    [applicationId, actor, reason],
  );
  if (!res.rows.length) return { ok: false, error: "not_reviewable" };
  await recordAudit(tx, { actor, action: "application.rejected", entityType: "application", entityId: applicationId, reason });
  const emailRow = await tx.query<{ email: string }>(`select email from clonestore_pp_applications where id=$1`, [applicationId]);
  if (emailRow.rows[0]) {
    await enqueuePartnerEmailTx(tx, { applicationId, kind: "application_rejected", toEmail: emailRow.rows[0].email, idempotencyKey: `pp-email:application_rejected:${applicationId}` });
  }
  return { ok: true };
}
