// Cabinets Fondateurs — candidature + ADMISSION AUTOMATIQUE.
//
// PARCOURS CIBLE : la candidature provisionne DIRECTEMENT le partenaire (statut
// `onboarding_pending`), avec son slug public et son code de recommandation. Aucune
// validation humaine n'est requise. La revue humaine (`manual_review`) n'existe que
// par EXCEPTION, lorsqu'un risque réel et explicable est détecté.
//
// L'action admin « accepter » reste disponible pour les dossiers en revue et les
// anciens dossiers — elle n'est plus sur le chemin normal.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import {
  normalizeEmail, sha256, slugifyCabinet, generateReferralCode,
  emailDomain, normalizeDomain, encryptCode,
} from "./identity";
import { getProgramSettings } from "./settings";
import { recordAudit } from "./audit";
import { enqueuePartnerEmailTx } from "./emails";
import { getBaseUrl } from "@/lib/base-url";
import { classifyEmailDomain } from "@/lib/founder-access/validation";
import { evaluateApplicationRisk, BLOCKING_RISKS, type AdmissionDecision, type RiskFlag } from "../onboarding-rules";

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
  | { ok: true; applicationId: string; duplicate: true }
  | { ok: true; applicationId: string; duplicate: false; admitted: "auto"; partnerId: string; publicSlug: string; referralCode: string }
  | { ok: true; applicationId: string; duplicate: false; admitted: "manual_review"; blocking: string[] }
  | { ok: false; error: string };

/** Crée le slug public unique du cabinet (suffixe incrémental en cas de collision). */
async function uniqueSlug(tx: SqlExecutor, cabinetName: string): Promise<string> {
  const base = slugifyCabinet(cabinetName);
  let slug = base;
  for (let i = 2; i <= 60; i++) {
    const clash = await tx.query(`select 1 from clonestore_pp_partners where public_slug = $1`, [slug]);
    if (!clash.rows.length) break;
    slug = `${base}-${i}`;
  }
  return slug;
}

/** Émet un code de recommandation : hash (vérification) + chiffré (re-partage). */
async function issueCode(tx: SqlExecutor, partnerId: string, generation: number): Promise<string> {
  const code = generateReferralCode();
  const enc = encryptCode(code.code); // null si CLONESTORE_PP_CODE_KEY absent
  await tx.query(
    `insert into clonestore_pp_partner_codes
       (partner_id, code_hash, code_hint, generation, status, code_cipher, code_cipher_iv, code_cipher_tag)
     values ($1,$2,$3,$4,'active',$5,$6,$7)`,
    [partnerId, code.hash, code.hint, generation, enc?.cipher ?? null, enc?.iv ?? null, enc?.tag ?? null],
  );
  return code.code;
}

async function raiseFlags(tx: SqlExecutor, partnerId: string | null, applicationId: string, flags: RiskFlag[]): Promise<void> {
  for (const f of flags) {
    await tx.query(
      `insert into clonestore_pp_risk_flags (partner_id, entity_type, entity_id, kind, severity, explanation, evidence_safe, status)
       values ($1,'application',$2,$3,$4,$5,$6::jsonb,'open')`,
      [partnerId, applicationId, f.kind, f.severity, f.explanation, JSON.stringify({ blocking: BLOCKING_RISKS.has(f.kind) })],
    );
  }
}

/**
 * Rassemble les signaux de risque RÉELS depuis la base et applique les règles pures.
 * Partagé par la candidature (temps réel) et la reprise des dossiers existants.
 * `excludeApplicationId` évite qu'un dossier déjà enregistré ne se compte lui-même.
 */
export async function assessApplicationRisk(
  tx: SqlExecutor,
  input: { emailNormalized: string; website: string | null; country: string; ipHash: string | null; excludeApplicationId?: string },
): Promise<AdmissionDecision> {
  const domain = emailDomain(input.emailNormalized);
  const cls = classifyEmailDomain(input.emailNormalized);
  const websiteDomain = normalizeDomain(input.website);

  const priorSameDomain = domain
    ? Number(
        (await tx.query<{ n: number }>(
          `select count(*)::int n from clonestore_pp_applications
             where email_normalized like $1 and ($2::uuid is null or id <> $2::uuid)`,
          [`%@${domain}`, input.excludeApplicationId ?? null],
        )).rows[0]?.n ?? 0,
      )
    : 0;

  const partnerSameDomain = domain
    ? (await tx.query(
        `select 1 from clonestore_pp_partners
           where email_normalized like $1 and ($2::uuid is null or application_id is null or application_id <> $2::uuid) limit 1`,
        [`%@${domain}`, input.excludeApplicationId ?? null],
      )).rows.length > 0
    : false;

  const recentSameIp = input.ipHash
    ? Number(
        (await tx.query<{ n: number }>(
          `select count(*)::int n from clonestore_pp_applications
             where ip_hash = $1 and created_at > now() - interval '24 hours'
               and ($2::uuid is null or id <> $2::uuid)`,
          [input.ipHash, input.excludeApplicationId ?? null],
        )).rows[0]?.n ?? 0,
      )
    : 0;

  return evaluateApplicationRisk({
    emailDomain: domain,
    isDisposableDomain: cls === "disposable",
    isPersonalDomain: cls === "personal",
    websiteDomain,
    country: input.country,
    priorApplicationsSameDomain: priorSameDomain,
    partnerExistsWithDomain: partnerSameDomain,
    recentApplicationsSameIp: recentSameIp,
  });
}

/**
 * Enregistre une candidature et PROVISIONNE automatiquement le partenaire.
 * Idempotent sur une candidature ouverte (index partiel uq_pp_app_open_email).
 */
export async function createApplication(tx: SqlExecutor, input: ApplicationInput): Promise<CreateApplicationResult> {
  const settings = await getProgramSettings(tx);
  if (settings.programStatus !== "open") return { ok: false, error: "program_closed" };

  const emailNorm = normalizeEmail(input.email);
  const dedupeKey = sha256(`${emailNorm}|${slugifyCabinet(input.cabinetName)}`);
  const services = Array.isArray(input.services) ? input.services.slice(0, 40).map((s) => String(s).slice(0, 80)) : [];

  // Candidature déjà en cours pour cet e-mail → réponse neutre, aucun doublon.
  const existing = await tx.query<{ id: string }>(
    `select id from clonestore_pp_applications where email_normalized = $1
       and status in ('received','under_review','manual_review','auto_approved','accepted') limit 1`,
    [emailNorm],
  );
  if (existing.rows.length) return { ok: true, applicationId: existing.rows[0].id, duplicate: true };

  // ── Signaux de risque (tous explicables) ───────────────────────────────────
  const decision = await assessApplicationRisk(tx, {
    emailNormalized: emailNorm, website: input.website ?? null, country: input.country, ipHash: input.ipHash ?? null,
  });

  const status = decision.admit === "auto" ? "auto_approved" : "manual_review";

  const inserted = await tx.query<{ id: string }>(
    `insert into clonestore_pp_applications
       (cabinet_name, first_name, last_name, role_title, email, email_normalized, phone, website,
        country, cabinet_type, clients_count_bucket, services, message, consent_contact, consent_privacy,
        status, dedupe_key, ip_hash, ua_summary)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     returning id`,
    [
      input.cabinetName.slice(0, 200), input.firstName.slice(0, 120), input.lastName.slice(0, 120),
      input.roleTitle?.slice(0, 120) ?? null, input.email.slice(0, 200), emailNorm,
      input.phone?.slice(0, 60) ?? null, input.website?.slice(0, 200) ?? null,
      input.country.slice(0, 8), input.cabinetType.slice(0, 60), input.clientsCountBucket?.slice(0, 40) ?? null,
      services, input.message?.slice(0, 2000) ?? null, input.consentContact === true, input.consentPrivacy === true,
      status, dedupeKey, input.ipHash ?? null, input.uaSummary?.slice(0, 300) ?? null,
    ],
  );
  const applicationId = inserted.rows[0].id;

  // ── REVUE HUMAINE (exception) : aucun partenaire créé, l'admin est saisi ────
  if (decision.admit === "manual_review") {
    await raiseFlags(tx, null, applicationId, decision.flags);
    await enqueuePartnerEmailTx(tx, {
      applicationId, kind: "manual_review_pending", toEmail: input.email,
      idempotencyKey: `pp-email:manual_review_pending:${applicationId}`,
    });
    await recordAudit(tx, {
      actor: "system", action: "application.manual_review", entityType: "application", entityId: applicationId,
      reason: `risques bloquants : ${decision.blocking.join(", ")}`, next: { blocking: decision.blocking },
    });
    return { ok: true, applicationId, duplicate: false, admitted: "manual_review", blocking: decision.blocking };
  }

  // ── ADMISSION AUTOMATIQUE : le partenaire est provisionné immédiatement ─────
  // Chemin de provisionnement UNIQUE (partagé avec l'acceptation d'exception et la reprise).
  const { partnerId, publicSlug: slug, referralCode } = await provisionPartnerFromApplication(tx, {
    id: applicationId, cabinet_name: input.cabinetName, first_name: input.firstName, last_name: input.lastName,
    role_title: input.roleTitle ?? null, email: input.email, email_normalized: emailNorm,
    phone: input.phone ?? null, website: input.website ?? null, country: input.country.toUpperCase(),
    cabinet_type: input.cabinetType, status, created_partner_id: null, ip_hash: input.ipHash ?? null,
  });

  // Les signaux NON bloquants restent visibles pour l'admin, sans freiner l'admission.
  if (decision.flags.length) await raiseFlags(tx, partnerId, applicationId, decision.flags);

  await tx.query(
    `update clonestore_pp_applications set created_partner_id=$2, reviewed_by='system', reviewed_at=now(), updated_at=now() where id=$1`,
    [applicationId, partnerId],
  );

  await recordAudit(tx, {
    actor: "system", action: "application.auto_approved", entityType: "application", entityId: applicationId,
    reason: "admission automatique — aucun risque bloquant", next: { partnerId, slug },
  });

  return { ok: true, applicationId, duplicate: false, admitted: "auto", partnerId, publicSlug: slug, referralCode };
}

// ── Actions admin (exception : dossiers en revue, anciens dossiers) ──────────

/** Passe une candidature en revue explicite (action admin). */
export async function markApplicationUnderReview(tx: SqlExecutor, applicationId: string, actor: string): Promise<void> {
  await tx.query(
    `update clonestore_pp_applications set status='under_review', reviewed_by=$2, updated_at=now()
     where id=$1 and status in ('received','manual_review')`,
    [applicationId, actor],
  );
  await recordAudit(tx, { actor, action: "application.under_review", entityType: "application", entityId: applicationId, reason: "revue démarrée" });
}

export type AcceptResult =
  | { ok: true; partnerId: string; publicSlug: string; referralCode: string }
  | { ok: false; error: string };

/** Ligne de candidature nécessaire au provisionnement. */
export type ApplicationRow = {
  id: string; cabinet_name: string; first_name: string; last_name: string; role_title: string | null;
  email: string; email_normalized: string; phone: string | null; website: string | null;
  country: string; cabinet_type: string; status: string; created_partner_id: string | null; ip_hash: string | null;
};

/**
 * Provisionne le partenaire à partir d'une candidature : partenaire `onboarding_pending`,
 * code de recommandation, e-mail d'accès (lien + code). Chemin UNIQUE, partagé par
 * l'admission automatique, l'acceptation manuelle d'exception et la reprise des dossiers.
 */
export async function provisionPartnerFromApplication(
  tx: SqlExecutor, app: ApplicationRow,
): Promise<{ partnerId: string; publicSlug: string; referralCode: string }> {
  const settings = await getProgramSettings(tx);
  const slug = await uniqueSlug(tx, app.cabinet_name);
  const domain = emailDomain(app.email_normalized);
  const websiteDomain = normalizeDomain(app.website);

  const partnerRows = await tx.query<{ id: string }>(
    `insert into clonestore_pp_partners
       (application_id, email, email_normalized, display_name, legal_name, contact_first_name, contact_last_name,
        contact_role, phone, website, country, cabinet_type, public_slug, status,
        commission_rate_bps, attribution_window_days, protection_window_days, reserve_days,
        payout_threshold_minor, payout_currency, self_domains)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'onboarding_pending',$14,$15,$16,$17,$18,$19,$20)
     returning id`,
    [
      app.id, app.email, app.email_normalized, app.cabinet_name, app.cabinet_name, app.first_name, app.last_name,
      app.role_title, app.phone, app.website, app.country, app.cabinet_type, slug,
      settings.commissionRateBps, settings.attributionWindowDays, settings.protectionWindowDays, settings.reserveDays,
      settings.payoutThresholdMinor, settings.currency,
      [domain, websiteDomain].filter((d): d is string => Boolean(d)),
    ],
  );
  const partnerId = partnerRows.rows[0].id;
  const referralCode = await issueCode(tx, partnerId, 1);

  // Clé d'idempotence par partenaire : jamais deux e-mails d'accès pour le même cabinet.
  await enqueuePartnerEmailTx(tx, {
    partnerId, applicationId: app.id, kind: "onboarding_access", toEmail: app.email,
    idempotencyKey: `pp-email:onboarding_access:${partnerId}`,
    payload: { spaceUrl: `${getBaseUrl()}/partenaires/espace`, referralUrl: `${getBaseUrl()}/partenaires/r/${slug}` },
  });

  return { partnerId, publicSlug: slug, referralCode };
}

/**
 * Accepte MANUELLEMENT une candidature en revue (exception). Provisionne le partenaire
 * exactement comme l'admission automatique. Les signaux de risque de la candidature sont
 * résolus, afin de ne pas bloquer l'activation automatique qui suivra.
 */
export async function acceptApplication(
  tx: SqlExecutor, applicationId: string, actor: string, reason: string,
): Promise<AcceptResult> {
  const appRows = await tx.query<ApplicationRow>(`select * from clonestore_pp_applications where id = $1`, [applicationId]);
  if (!appRows.rows.length) return { ok: false, error: "application_not_found" };
  const app = appRows.rows[0];
  if (app.created_partner_id) return { ok: false, error: "already_provisioned" };
  if (app.status === "rejected" || app.status === "withdrawn") return { ok: false, error: "application_closed" };

  const { partnerId, publicSlug: slug, referralCode } = await provisionPartnerFromApplication(tx, app);

  // L'admin lève les signaux de la candidature : l'activation automatique redevient possible.
  await tx.query(
    `update clonestore_pp_risk_flags set status='reviewed_ok', reviewed_by=$2, reviewed_at=now(), review_reason=$3
     where entity_type='application' and entity_id=$1 and status='open'`,
    [applicationId, actor, reason],
  );

  await tx.query(
    `update clonestore_pp_applications set status='accepted', reviewed_by=$2, reviewed_at=now(), review_reason=$3, created_partner_id=$4, updated_at=now()
     where id=$1`,
    [applicationId, actor, reason, partnerId],
  );
  await recordAudit(tx, {
    actor, action: "application.accepted_manually", entityType: "application", entityId: applicationId,
    reason, next: { partnerId, slug },
  });
  return { ok: true, partnerId, publicSlug: slug, referralCode };
}

/** Refuse une candidature (raison obligatoire, auditée). */
export async function rejectApplication(tx: SqlExecutor, applicationId: string, actor: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const res = await tx.query(
    `update clonestore_pp_applications set status='rejected', reviewed_by=$2, reviewed_at=now(), review_reason=$3, updated_at=now()
     where id=$1 and status in ('received','under_review','manual_review','auto_approved') returning id`,
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
