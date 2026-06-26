// CloneStory — couche d'accès aux données + services métier (SERVER-ONLY).
// Toutes les écritures passent en MODE SERVICE (validation applicative) ; la lecture
// « Mon Registre » passe en MODE MEMBRE (isolation RLS prouvée). Aucun chiffre n'est
// jamais accepté du navigateur : tout est dérivé d'événements/lignes serveur.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { isUniqueViolation, withUniqueViolationRetry } from "@/lib/pierre/v1/sql";
import { getClonestoryDb, withPartner, withService } from "./runtime";
import {
  buildPublicSlug,
  companyDedupKey,
  normalizeEmailForCompare,
} from "../normalize";
import {
  companyFingerprint,
  hashLinkToken,
  hashPartnerCode,
  issuePartnerCode,
  issuePartnerLinkToken,
  normalizeCode,
} from "../token";
import { checkSelfAttribution } from "../anti-fraud";
import { companySalt, publicBaseUrl } from "./config";
import { renderVerificationEmail, sendClonestoryEmail } from "./emails";
import { buildVerificationToken, isVerificationTokenExpired, parseVerificationToken } from "./verification-token";
import { buildActionToken, parseActionToken, isActionTokenExpired, type ActionPurpose } from "./action-token";
import { enqueueNotificationTx } from "./notifications";

const VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CONFIRM_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// ── Formes de lignes ─────────────────────────────────────────────────────────
export interface PartnerRow {
  id: string;
  status: string;
  email: string;
  email_normalized: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  introduced_by_partner_id: string | null;
  registry_number: number | null;
  public_slug: string | null;
  link_token: string | null;
  link_token_hash: string | null;
  link_revoked_at: string | null;
  personal_code: string | null;
  email_verified_at: string | null;
  identity_verified_at: string | null;
  joined_at: string;
  suspended_at: string | null;
}

export interface IntroductionRow {
  id: string;
  partner_id: string;
  method: string;
  status: string;
  prospect_first_name: string | null;
  prospect_company: string;
  prospect_email: string | null;
  note: string | null;
  declared_at: string;
  confirmed_at: string | null;
  verified_at: string | null;
  dispute_flag: boolean;
}

const PARTNER_COLS =
  "id, status, email, email_normalized, first_name, last_name, display_name, phone, company, role, " +
  "introduced_by_partner_id, registry_number, public_slug, link_token, link_token_hash, link_revoked_at, personal_code, " +
  "email_verified_at, identity_verified_at, joined_at, suspended_at";

// ── Recherches internes (prennent un tx déjà lié) ────────────────────────────
async function findByEmail(tx: SqlExecutor, emailNorm: string): Promise<PartnerRow | null> {
  const { rows } = await tx.query<PartnerRow>(
    `select ${PARTNER_COLS} from clonestory_fp_partners where email_normalized = $1`,
    [emailNorm],
  );
  return rows[0] ?? null;
}
async function findById(tx: SqlExecutor, id: string): Promise<PartnerRow | null> {
  const { rows } = await tx.query<PartnerRow>(`select ${PARTNER_COLS} from clonestory_fp_partners where id = $1`, [id]);
  return rows[0] ?? null;
}

// ── Recherches publiques (ouvrent leur transaction service) ──────────────────
/** Résolution du lien personnel par HASH du token brut reçu (jamais stocké en clair). */
export async function findPartnerByLinkToken(token: string): Promise<PartnerRow | null> {
  if (!token) return null;
  const hash = hashLinkToken(token);
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<PartnerRow>(
      `select ${PARTNER_COLS} from clonestory_fp_partners
        where link_token_hash = $1 and link_revoked_at is null and status not in ('suspended','withdrawn')`,
      [hash],
    );
    return rows[0] ?? null;
  });
}
/** Résolution par code personnel via code_lookup_hash (hash du code normalisé). */
export async function findPartnerByCode(code: string): Promise<PartnerRow | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const hash = hashPartnerCode(normalized);
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<PartnerRow>(
      `select ${PARTNER_COLS} from clonestory_fp_partners
        where code_lookup_hash = $1 and link_revoked_at is null and status not in ('suspended','withdrawn')`,
      [hash],
    );
    return rows[0] ?? null;
  });
}
export async function findPartnerBySlug(slug: string): Promise<PartnerRow | null> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<PartnerRow>(
      `select ${PARTNER_COLS} from clonestory_fp_partners where public_slug = $1`,
      [slug],
    );
    return rows[0] ?? null;
  });
}

// ── Inscription ──────────────────────────────────────────────────────────────
export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  displayName?: string | null;
  phone?: string | null;
  company?: string | null;
  role?: string | null;
}

const MAX_GENERATIONS = 6; // génération 1 + 5 renvois volontaires
const OUTBOX_LEASE_MIN = 5; // bail de worker (récupération des `sending` abandonnés)

export type RegisterResult =
  | {
      ok: true;
      partnerId: string;
      /** Token brut À ENVOYER MAINTENANT (jamais persisté ; reconstructible). null si plafond. */
      verificationToken: string | null;
      /** Ligne d'outbox (commande email logique). */
      outboxId: string | null;
      /** Génération d'email courante (retry technique = même génération). */
      generation: number;
      alreadyExisted: boolean;
      alreadyVerified: boolean;
    }
  | { ok: false; error: "invalid_input" };

/**
 * Crée (ou réarme la vérification d') un compte candidat de manière ATOMIQUE :
 * partenaire `registered` + token de vérification HASHÉ + commande email outbox
 * `pending` dans UNE SEULE transaction. Si l'une échoue, rien n'est créé. Le token
 * brut est renvoyé en mémoire pour l'envoi immédiat ; il n'est jamais stocké.
 * Réinscription idempotente : un seul partenaire, une seule commande email logique
 * (ON CONFLICT), plafond de renvoi. Mode service.
 */
export async function registerPartner(
  input: RegisterInput,
  opts: { introducerPartnerId?: string | null } = {},
): Promise<RegisterResult> {
  const email = (input.email ?? "").trim();
  const emailNorm = normalizeEmailForCompare(email);
  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const display = (input.displayName ?? `${firstName} ${lastName}`).trim();
  if (!emailNorm.includes("@") || !firstName || !lastName || !display) {
    return { ok: false, error: "invalid_input" };
  }

  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const existing = await findByEmail(tx, emailNorm);

    let partnerId: string;
    let alreadyExisted = false;
    let alreadyVerified = false;

    if (existing) {
      partnerId = existing.id;
      alreadyExisted = true;
      alreadyVerified = Boolean(existing.email_verified_at);
    } else {
      // Rattachement de branche : introducteur vérifié, différent de soi.
      let introducedBy: string | null = null;
      if (opts.introducerPartnerId) {
        const intro = await findById(tx, opts.introducerPartnerId);
        if (intro && intro.email_verified_at && intro.email_normalized !== emailNorm && intro.status !== "withdrawn") {
          introducedBy = intro.id;
        }
      }
      const { rows } = await tx.query<{ id: string }>(
        `insert into clonestory_fp_partners
           (email, email_normalized, first_name, last_name, display_name, phone, company, role,
            status, introduced_by_partner_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'registered',$9)
         on conflict (email_normalized) do nothing
         returning id`,
        [
          email, emailNorm, firstName, lastName, display,
          input.phone?.trim() || null, input.company?.trim() || null, input.role?.trim() || null,
          introducedBy,
        ],
      );
      if (rows[0]) {
        partnerId = rows[0].id;
      } else {
        // Course : un autre insert a gagné → on récupère et on traite comme existant.
        const race = await findByEmail(tx, emailNorm);
        if (!race) throw new Error("register_race");
        partnerId = race.id;
        alreadyExisted = true;
        alreadyVerified = Boolean(race.email_verified_at);
      }
    }

    // Arme une génération d'email (gén. 1 au premier, ou un VRAI renvoi en gén. n+1
    // sous plafond). Renvoie le token reconstructible de cette génération.
    const kind = alreadyVerified ? "access" : "verification";
    const arm = await armEmailGenerationTx(tx, partnerId, email, kind, !alreadyExisted && !existing);
    const verificationToken = arm.armed ? buildVerificationToken(partnerId, arm.generation, arm.expMs) : null;

    return { ok: true, partnerId, verificationToken, outboxId: arm.outboxId, generation: arm.generation, alreadyExisted, alreadyVerified };
  });
}

/**
 * Arme une génération d'email pour un partenaire (dans la transaction d'inscription).
 * - première commande → génération courante (1) ;
 * - existante sous plafond → nouvelle génération (renvoi volontaire) : incrémente la
 *   génération du partenaire (révoque les anciens tokens), supersede les lignes en vol,
 *   insère une nouvelle ligne d'outbox `pending` ;
 * - au plafond → non armée (aucun nouvel email), renvoie la génération courante.
 * Persiste seulement (generation, token_exp_ms) — JAMAIS le token brut.
 */
async function armEmailGenerationTx(
  tx: SqlExecutor,
  partnerId: string,
  email: string,
  kind: "verification" | "access",
  isNew: boolean,
): Promise<{ armed: boolean; generation: number; outboxId: string | null; expMs: number }> {
  const { rows: pr } = await tx.query<{ verification_generation: number }>(
    `select verification_generation from clonestory_fp_partners where id = $1`,
    [partnerId],
  );
  let gen = Number(pr[0]?.verification_generation ?? 1);

  if (!isNew) {
    const { rows: cnt } = await tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_email_outbox where partner_id = $1`,
      [partnerId],
    );
    const generationsSoFar = Number(cnt[0]?.n ?? 0);
    if (generationsSoFar >= MAX_GENERATIONS) {
      // Plafond de renvoi atteint : pas de nouvel email (réponse neutre côté route).
      const { rows: last } = await tx.query<{ id: string; token_exp_ms: string | null }>(
        `select id::text, token_exp_ms from clonestory_fp_email_outbox where partner_id = $1 and generation = $2 limit 1`,
        [partnerId, gen],
      );
      return { armed: false, generation: gen, outboxId: last[0]?.id ?? null, expMs: Number(last[0]?.token_exp_ms ?? Date.now()) };
    }
    // Vrai renvoi volontaire → nouvelle génération + révocation des précédentes.
    gen += 1;
    await tx.query(`update clonestory_fp_partners set verification_generation = $2, updated_at = now() where id = $1`, [partnerId, gen]);
    await tx.query(
      `update clonestory_fp_email_outbox set status = 'superseded', locked_at = null, updated_at = now()
        where partner_id = $1 and status in ('pending','sending','failed_retryable','delivery_unknown')`,
      [partnerId],
    );
  }

  const expMs = Date.now() + VERIFY_TTL_MS;
  const { rows: ox } = await tx.query<{ id: string }>(
    `insert into clonestory_fp_email_outbox
       (partner_id, kind, idempotency_key, status, to_email, generation, token_exp_ms, resend_count, next_attempt_at)
     values ($1,$2,$3,'pending',$4,$5,$6,$7, now())
     returning id::text`,
    [partnerId, kind, `csy-verification:${partnerId}:${gen}`, email, gen, expMs, gen - 1],
  );
  return { armed: true, generation: gen, outboxId: ox[0].id, expMs };
}

// ── Outbox email : transitions ───────────────────────────────────────────────
export async function markVerificationSent(outboxId: string, messageId?: string | null): Promise<void> {
  const db = await getClonestoryDb();
  await withService(db, (tx) =>
    tx.query(
      `update clonestory_fp_email_outbox
          set status = 'sent', last_error = null, locked_at = null,
              provider_message_id = coalesce($2, provider_message_id), updated_at = now()
        where id = $1`,
      [outboxId, messageId ?? null],
    ),
  );
}

/** Échec d'envoi (le fournisseur a refusé). Retourne true si la commande passe `dead`. */
export async function markVerificationFailed(outboxId: string, error: string): Promise<boolean> {
  return transitionOutbox(outboxId, "failed_retryable", error, null);
}

/** Envoi INCERTAIN (le fournisseur a peut-être accepté). Retry futur même token/clé. */
export async function markVerificationUnknown(outboxId: string, error: string, messageId?: string | null): Promise<boolean> {
  return transitionOutbox(outboxId, "delivery_unknown", error, messageId ?? null);
}

async function transitionOutbox(
  outboxId: string,
  retryStatus: "failed_retryable" | "delivery_unknown",
  error: string,
  messageId: string | null,
): Promise<boolean> {
  const db = await getClonestoryDb();
  const { rows } = await withService(db, (tx) =>
    tx.query<{ status: string; partner_id: string; attempts: number }>(
      `update clonestory_fp_email_outbox
          set status = case when attempts >= max_attempts then 'dead' else $2 end,
              last_error = $3,
              provider_message_id = coalesce($4, provider_message_id),
              locked_at = null,
              next_attempt_at = now() + (least(greatest(attempts, 1), 6) * interval '5 minutes'),
              updated_at = now()
        where id = $1
        returning status, partner_id::text, attempts`,
      [outboxId, retryStatus, (error ?? "").slice(0, 300), messageId],
    ),
  );
  const dead = rows[0]?.status === "dead";
  if (dead) {
    // Alerte exploitable — aucun email complet ni token.
    // eslint-disable-next-line no-console
    console.error("[clonestory-outbox] DEAD", JSON.stringify({ outboxId, partnerId: rows[0]?.partner_id, attempts: rows[0]?.attempts }));
  }
  return dead;
}

/**
 * WORKER DE REPRISE. Réclame les commandes dues via `FOR UPDATE SKIP LOCKED` (deux
 * workers ne traitent jamais la même ligne), récupère aussi les `sending` abandonnés
 * (bail expiré), reconstruit le MÊME token de la génération (jamais de régénération),
 * envoie avec la clé d'idempotence de la génération, puis marque sent / failed_retryable
 * / delivery_unknown / dead. À câbler à un cron sécurisé.
 */
export async function processVerificationOutbox(limit = 20): Promise<{ processed: number; sent: number; failed: number; unknown: number; dead: number }> {
  const db = await getClonestoryDb();
  const claimed = await withService(db, async (tx) => {
    const { rows } = await tx.query<{ id: string; partner_id: string; generation: number; token_exp_ms: string; to_email: string; idempotency_key: string }>(
      `update clonestory_fp_email_outbox o
          set status = 'sending', locked_at = now(), attempts = attempts + 1, updated_at = now()
        where o.id in (
          select c.id from clonestory_fp_email_outbox c
            join clonestory_fp_partners p on p.id = c.partner_id
           where c.generation = p.verification_generation
             and c.attempts < c.max_attempts
             and (
               (c.status in ('pending','failed_retryable','delivery_unknown') and c.next_attempt_at <= now())
               or (c.status = 'sending' and (c.locked_at is null or c.locked_at < now() - interval '${OUTBOX_LEASE_MIN} minutes'))
             )
           order by c.next_attempt_at
           for update skip locked
           limit $1
        )
        returning o.id::text, o.partner_id::text, o.generation, o.token_exp_ms, o.to_email, o.idempotency_key`,
      [limit],
    );
    return rows;
  });

  let sent = 0;
  let failed = 0;
  let unknown = 0;
  let dead = 0;
  for (const row of claimed) {
    // MÊME token (reconstruit) — jamais régénéré : un email déjà reçu reste valide.
    const token = buildVerificationToken(row.partner_id, Number(row.generation), Number(row.token_exp_ms));
    const verifyUrl = `${publicBaseUrl()}/founding-partners/verify?token=${encodeURIComponent(token)}`;
    const mail = renderVerificationEmail(verifyUrl);
    try {
      const res = await sendClonestoryEmail({
        to: row.to_email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        idempotencyKey: row.idempotency_key, // csy-verification:<pid>:<gen> → dédup fournisseur
      });
      if (res.ok) {
        await markVerificationSent(row.id, res.id ?? null);
        sent += 1;
      } else if (await markVerificationFailed(row.id, res.error ?? "send_failed")) {
        dead += 1;
      } else {
        failed += 1;
      }
    } catch (e) {
      // Incertain : le fournisseur a peut-être accepté → delivery_unknown, retry même token/clé.
      if (await markVerificationUnknown(row.id, e instanceof Error ? e.message : "send_error")) dead += 1;
      else unknown += 1;
    }
  }
  return { processed: claimed.length, sent, failed, unknown, dead };
}

// ── Vérification email + émission des identifiants ───────────────────────────
export type VerifyResult =
  | { ok: true; partner: PartnerRow; firstVerification: boolean }
  | { ok: false; error: "invalid_or_expired" };

export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  // Token STATELESS : on vérifie l'HMAC + l'expiration AVANT toute requête.
  const parsed = parseVerificationToken(token);
  if (!parsed || isVerificationTokenExpired(parsed.expMs)) return { ok: false, error: "invalid_or_expired" };

  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<PartnerRow & { verification_generation: number }>(
      `select ${PARTNER_COLS}, verification_generation from clonestory_fp_partners where id = $1`,
      [parsed.partnerId],
    );
    const partner = rows[0];
    if (!partner) return { ok: false, error: "invalid_or_expired" };
    // La génération du token doit être la génération COURANTE (révocation / renvoi
    // volontaire incrémentent la génération → les anciens tokens deviennent invalides).
    if (Number(partner.verification_generation) !== parsed.generation) return { ok: false, error: "invalid_or_expired" };
    if (partner.status === "withdrawn") return { ok: false, error: "invalid_or_expired" };

    const firstVerification = !partner.email_verified_at;
    // §3 — la confirmation email ne produit QUE email_verified.
    await tx.query(
      `update clonestory_fp_partners
          set status = case when status = 'registered' then 'email_verified' else status end,
              email_verified_at = coalesce(email_verified_at, now()),
              updated_at = now()
        where id = $1`,
      [partner.id],
    );
    // La commande email de cette génération est confirmée comme délivrée.
    await tx.query(
      `update clonestory_fp_email_outbox set status = 'sent', locked_at = null, updated_at = now()
        where partner_id = $1 and generation = $2 and status <> 'sent'`,
      [partner.id, parsed.generation],
    );
    await issueCredentialsTx(tx, partner.id, partner.display_name);
    // Email de bienvenue via OUTBOX robuste (une seule fois, idempotent).
    if (firstVerification && partner.email) {
      await enqueueNotificationTx(tx, {
        partnerId: partner.id, kind: "welcome", toEmail: partner.email,
        idempotencyKey: `csy-welcome:${partner.id}`,
      });
    }
    const refreshed = await findById(tx, partner.id);
    return { ok: true, partner: refreshed!, firstVerification };
  });
}

/**
 * Émet (idempotent) le CODE personnel (identifiant public stable + partageable) et son
 * code_lookup_hash, plus un slug. Le code n'est PAS un secret d'authentification : il
 * sert uniquement à l'attribution de branche via le lien `/r/<code>`. Aucune rotation
 * automatique. `link_token` reste null (un link_token_hash legacy éventuel est toléré
 * pour d'anciens liens `fp_…` déjà partagés).
 */
async function issueCredentialsTx(tx: SqlExecutor, partnerId: string, displayName: string): Promise<void> {
  const { rows: ex } = await tx.query<{ code_lookup_hash: string | null }>(
    `select code_lookup_hash from clonestory_fp_partners where id = $1`,
    [partnerId],
  );
  if (!ex[0]?.code_lookup_hash) {
    await withUniqueViolationRetry(async () => {
      const codeNorm = normalizeCode(issuePartnerCode().value);
      await tx.query(
        `update clonestory_fp_partners
            set link_token = null,
                personal_code = coalesce(personal_code, $2),
                code_lookup_hash = coalesce(code_lookup_hash, $3),
                link_rotated_at = coalesce(link_rotated_at, now()),
                updated_at = now()
          where id = $1`,
        [partnerId, codeNorm, hashPartnerCode(codeNorm)],
      );
    });
  }

  // Slug public stable (réservé même si le titre public n'est pas encore accordé).
  const slugBase = buildPublicSlug(displayName, 1).replace(/-001$/, "");
  await withUniqueViolationRetry(async () => {
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    await tx.query(
      `update clonestory_fp_partners set public_slug = coalesce(public_slug, $2) where id = $1`,
      [partnerId, `${slugBase}-${suffix}`],
    );
  });
}

/**
 * Révocation + renouvellement EXPLICITE des identifiants : génère un NOUVEAU code
 * (et son hash), invalidant réellement l'ancien lien `/r/<ancien-code>` ainsi que tout
 * lien legacy. Renvoie le nouveau code. Mode service. JAMAIS automatique.
 */
export async function regenerateCredentials(partnerId: string): Promise<string | null> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    let issued: string | null = null;
    await withUniqueViolationRetry(async () => {
      const codeNorm = normalizeCode(issuePartnerCode().value);
      await tx.query(
        `update clonestory_fp_partners
            set personal_code = $2, code_lookup_hash = $3, link_token = null, link_token_hash = null,
                link_revoked_at = null, link_rotated_at = now(), updated_at = now()
          where id = $1`,
        [partnerId, codeNorm, hashPartnerCode(codeNorm)],
      );
      issued = codeNorm;
    });
    return issued;
  });
}

// ── Mon Registre (lecture MODE MEMBRE) ───────────────────────────────────────
export interface RegistryView {
  partner: PartnerRow;
  introducerName: string | null;
  introductions: IntroductionRow[];
  recentEvents: { type: string; occurred_at: string }[];
  stats: {
    inProgress: number;
    confirmed: number;
    pendingValidation: number;
    verifiedDirect: number;
    networkConfirmed: number;
    networkVerified: number;
  };
  /** Lien personnel STABLE et partageable `/r/<code>` (pas un secret ; sans PII). */
  publicLink: string | null;
  /** Code personnel affichable (identifiant public stable). */
  personalCode: string | null;
}

export async function getMyRegistry(partnerId: string, origin: string): Promise<RegistryView | null> {
  const db = await getClonestoryDb();

  const own = await withPartner(db, partnerId, async (tx) => {
    const partner = await findById(tx, partnerId); // RLS → ne voit que la sienne
    if (!partner) return null;
    // AFFICHAGE : les 200 introductions les plus récentes (borné → tient à l'échelle).
    // Les compteurs ci-dessous viennent d'un AGRÉGAT exact (jamais de l'affichage borné).
    const { rows: introductions } = await tx.query<IntroductionRow>(
      `select id, partner_id, method, status, prospect_first_name, prospect_company, prospect_email, note,
              declared_at, confirmed_at, verified_at, dispute_flag
         from clonestory_fp_introductions where partner_id = $1 order by created_at desc limit 200`,
      [partnerId],
    );
    const { rows: agg } = await tx.query<{ inprogress: number; confirmed: number; pending: number; verified: number }>(
      `select
         count(*) filter (where status = 'declared')::int inprogress,
         count(*) filter (where status in ('prospect_confirmed','prospect_registered','company_created','purchase_captured','activation_completed','validation_pending'))::int confirmed,
         count(*) filter (where status in ('purchase_captured','activation_completed','validation_pending'))::int pending,
         count(*) filter (where status = 'verified')::int verified
       from clonestory_fp_introductions where partner_id = $1`,
      [partnerId],
    );
    const { rows: recentEvents } = await tx.query<{ type: string; occurred_at: string }>(
      `select type, occurred_at from clonestory_fp_contribution_events where partner_id = $1 order by occurred_at desc limit 25`,
      [partnerId],
    );
    return { partner, introductions, agg: agg[0] ?? { inprogress: 0, confirmed: 0, pending: 0, verified: 0 }, recentEvents };
  });
  if (!own) return null;

  // Agrégats de branche : MODE SERVICE (compte seul, aucune PII d'autrui exposée).
  const network = await withService(db, async (tx) => {
    // Branche RÉCURSIVE cycle-safe : `union` dédoublonne les partenaires (un
    // partenaire dupliqué/cyclique n'est visité qu'une fois) ; la profondeur est
    // bornée (garde anti-cycle / anti-profondeur excessive). Chaque introduction a
    // un seul partner_id → comptée une seule fois (aucune contribution doublée).
    const { rows } = await tx.query<{ confirmed: number; verified: number; introducer: string | null }>(
      `with recursive descendants as (
         select id, 1 as depth from clonestory_fp_partners where introduced_by_partner_id = $1
         union
         select p.id, d.depth + 1
           from clonestory_fp_partners p
           join descendants d on p.introduced_by_partner_id = d.id
          where d.depth < 64
       )
       select
         (select count(*)::int from clonestory_fp_introductions i
            where i.partner_id in (select id from descendants)
              and i.status in ('prospect_confirmed','prospect_registered','company_created','purchase_captured','activation_completed','validation_pending')) as confirmed,
         (select count(*)::int from clonestory_fp_introductions i
            where i.partner_id in (select id from descendants) and i.status = 'verified') as verified,
         (select display_name from clonestory_fp_partners p
            where p.id = (select introduced_by_partner_id from clonestory_fp_partners where id = $1)) as introducer`,
      [partnerId],
    );
    return rows[0] ?? { confirmed: 0, verified: 0, introducer: null };
  });

  const introductions = own.introductions;
  // Stats EXACTES via agrégat (indépendantes de l'affichage borné à 200).
  const stats = {
    inProgress: Number(own.agg.inprogress) || 0,
    confirmed: Number(own.agg.confirmed) || 0,
    pendingValidation: Number(own.agg.pending) || 0,
    verifiedDirect: Number(own.agg.verified) || 0,
    networkConfirmed: Number(network.confirmed) || 0,
    networkVerified: Number(network.verified) || 0,
  };

  // Lien stable dérivé du code (toujours visible, toujours copiable, sans PII).
  const code = own.partner.personal_code;
  const publicLink = code && !own.partner.link_revoked_at
    ? `${origin.replace(/\/$/, "")}/founding-partners/r/${code}`
    : null;

  return {
    partner: own.partner,
    introducerName: network.introducer ?? null,
    introductions,
    recentEvents: own.recentEvents,
    stats,
    publicLink,
    personalCode: code,
  };
}

// ── Faire une introduction ───────────────────────────────────────────────────
export interface IntroductionInput {
  prospectFirstName?: string | null;
  prospectCompany: string;
  prospectEmail: string;
  note?: string | null;
  method?: "link" | "code" | "declared";
}
export type IntroductionResult =
  | { ok: true; introductionId: string; confirmToken: string; refuseToken: string; prospectEmail: string }
  | { ok: false; error: "invalid_input" | "self_attribution" | "already_introduced" | "not_allowed" };

export async function createIntroduction(partnerId: string, input: IntroductionInput): Promise<IntroductionResult> {
  const company = (input.prospectCompany ?? "").trim();
  const prospectEmail = (input.prospectEmail ?? "").trim();
  const prospectNorm = normalizeEmailForCompare(prospectEmail);
  if (!company || !prospectNorm.includes("@")) return { ok: false, error: "invalid_input" };

  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const partner = await findById(tx, partnerId);
    if (!partner) return { ok: false, error: "not_allowed" };
    if (!partner.email_verified_at || partner.status === "suspended" || partner.status === "withdrawn") {
      return { ok: false, error: "not_allowed" };
    }
    // Anti auto-attribution.
    if (checkSelfAttribution({ partnerEmail: partner.email, prospectEmail }).decision === "reject") {
      return { ok: false, error: "self_attribution" };
    }

    const domain = prospectNorm.split("@")[1] ?? null;
    const fp = companyFingerprint(companyDedupKey({ name: company, domain }), companySalt());
    const expMs = Date.now() + CONFIRM_TTL_MS;
    const confirmExpires = new Date(expMs).toISOString();
    const method = input.method ?? "declared";

    try {
      // confirm_generation = 1 ; le token est STATELESS (reconstructible par le worker),
      // aucun token brut n'est stocké (confirm_token_hash reste null).
      const { rows } = await tx.query<{ id: string }>(
        `insert into clonestory_fp_introductions
           (partner_id, method, status, prospect_first_name, prospect_company, prospect_email,
            prospect_email_normalized, note, company_fingerprint, confirm_token_hash, confirm_expires_at, confirm_generation)
         values ($1,$2,'declared',$3,$4,$5,$6,$7,$8,null,$9,1)
         returning id`,
        [
          partnerId, method, input.prospectFirstName?.trim() || null, company, prospectEmail,
          prospectNorm, (input.note ?? "").trim().slice(0, 600) || null, fp, confirmExpires,
        ],
      );
      const introductionId = rows[0].id;
      const confirmToken = buildActionToken("introconfirm", introductionId, 1, expMs);
      const refuseToken = buildActionToken("introrefuse", introductionId, 1, expMs);
      await tx.query(
        `insert into clonestory_fp_contribution_events (partner_id, introduction_id, type, source, evidence_ref)
         values ($1,$2,'introduction_declared',$3,$4)`,
        [partnerId, introductionId, method, introductionId],
      );
      // Email prospect via OUTBOX robuste (plus d'envoi direct best-effort). Transactionnel :
      // l'email n'est jamais enfilé sans l'introduction, ni l'inverse.
      await enqueueNotificationTx(tx, {
        partnerId, introductionId, kind: "intro_confirm", toEmail: prospectEmail,
        idempotencyKey: `csy-intro-confirm:${introductionId}:1`, payload: { memberName: partner.display_name },
      });
      return { ok: true, introductionId, confirmToken, refuseToken, prospectEmail };
    } catch (e) {
      if (isUniqueViolation(e)) return { ok: false, error: "already_introduced" };
      throw e;
    }
  });
}

// ── Confirmation / refus par le prospect (token STATELESS, consommé par POST) ───
export type ConfirmResult =
  | { ok: true; disputed: boolean; partnerId: string; introductionId: string; already?: boolean }
  | { ok: false; error: "invalid_or_expired" };

const CONFIRMED_SET = [
  "prospect_confirmed", "prospect_registered", "company_created",
  "purchase_captured", "activation_completed", "validation_pending", "verified",
];

interface IntroLite { id: string; partner_id: string; company_fingerprint: string; status: string; confirm_generation: number; partner_email: string | null }
async function loadIntroForAction(tx: SqlExecutor, introId: string): Promise<IntroLite | null> {
  const { rows } = await tx.query<IntroLite>(
    `select i.id, i.partner_id, i.company_fingerprint, i.status, i.confirm_generation, p.email partner_email
       from clonestory_fp_introductions i join clonestory_fp_partners p on p.id = i.partner_id
      where i.id = $1`,
    [introId],
  );
  return rows[0] ?? null;
}

export async function confirmIntroduction(token: string): Promise<ConfirmResult> {
  const parsed = parseActionToken(token, "introconfirm");
  if (!parsed) return { ok: false, error: "invalid_or_expired" };
  if (isActionTokenExpired(parsed.expMs)) return { ok: false, error: "invalid_or_expired" };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const intro = await loadIntroForAction(tx, parsed.subjectId);
    if (!intro || Number(intro.confirm_generation) !== parsed.generation) return { ok: false, error: "invalid_or_expired" };

    // Idempotent : déjà consommée (re-POST / double-clic) → réponse propre, aucune mutation.
    if (intro.status !== "declared") {
      if (CONFIRMED_SET.includes(intro.status)) return { ok: true, disputed: false, partnerId: intro.partner_id, introductionId: intro.id, already: true };
      if (intro.status === "disputed") return { ok: true, disputed: true, partnerId: intro.partner_id, introductionId: intro.id, already: true };
      return { ok: false, error: "invalid_or_expired" }; // canceled / expired
    }

    // Pré-contrôle conflit entreprise (l'index unique partiel reste le filet anti-course).
    const { rows: conflict } = await tx.query<{ id: string }>(
      `select id from clonestory_fp_introductions
        where company_fingerprint = $1 and id <> $2 and status = any($3) limit 1`,
      [intro.company_fingerprint, intro.id, CONFIRMED_SET],
    );

    if (conflict.length > 0) {
      await tx.query(
        `update clonestory_fp_introductions set status = 'disputed', dispute_flag = true, confirm_token_hash = null, updated_at = now() where id = $1`,
        [intro.id],
      );
      await tx.query(
        `insert into clonestory_fp_contribution_events (partner_id, introduction_id, type, source, evidence_ref)
         values ($1,$2,'contribution_disputed','declared',$3)`,
        [intro.partner_id, intro.id, intro.id],
      );
      return { ok: true, disputed: true, partnerId: intro.partner_id, introductionId: intro.id };
    }

    await tx.query(
      `update clonestory_fp_introductions
          set status = 'prospect_confirmed', confirmed_at = now(), confirm_token_hash = null, updated_at = now()
        where id = $1`,
      [intro.id],
    );
    await tx.query(
      `insert into clonestory_fp_contribution_events (partner_id, introduction_id, type, source, evidence_ref)
       values ($1,$2,'introduction_confirmed','declared',$3)`,
      [intro.partner_id, intro.id, intro.id],
    );
    // Notifie le MEMBRE via l'outbox robuste (plus d'envoi direct).
    if (intro.partner_email) {
      await enqueueNotificationTx(tx, {
        partnerId: intro.partner_id, introductionId: intro.id, kind: "intro_confirmed_member",
        toEmail: intro.partner_email, idempotencyKey: `csy-intro-confirmed:${intro.id}`,
        payload: { prospectCompany: (await prospectCompanyOf(tx, intro.id)) ?? "une entreprise" },
      });
    }
    return { ok: true, disputed: false, partnerId: intro.partner_id, introductionId: intro.id };
  });
}

async function prospectCompanyOf(tx: SqlExecutor, introId: string): Promise<string | null> {
  return (await tx.query<{ prospect_company: string }>(`select prospect_company from clonestory_fp_introductions where id=$1`, [introId])).rows[0]?.prospect_company ?? null;
}

/** Refus du prospect : annule l'introduction + PURGE la PII (CNIL). Idempotent. */
export async function refuseIntroduction(token: string): Promise<{ ok: boolean; already?: boolean }> {
  const parsed = parseActionToken(token, "introrefuse");
  if (!parsed || isActionTokenExpired(parsed.expMs)) return { ok: false };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const intro = await loadIntroForAction(tx, parsed.subjectId);
    if (!intro || Number(intro.confirm_generation) !== parsed.generation) return { ok: false };
    if (intro.status === "canceled") return { ok: true, already: true }; // déjà refusée
    if (intro.status !== "declared") return { ok: false };
    await tx.query(
      `update clonestory_fp_introductions
          set status = 'canceled', canceled_at = now(), refused_at = now(), confirm_token_hash = null,
              prospect_email = null, prospect_email_normalized = null, prospect_first_name = null, note = null,
              updated_at = now()
        where id = $1`,
      [intro.id],
    );
    await tx.query(
      `insert into clonestory_fp_contribution_events (partner_id, introduction_id, type, source, evidence_ref)
       values ($1,$2,'contribution_canceled','declared','prospect_refused')`,
      [intro.partner_id, intro.id],
    );
    if (intro.partner_email) {
      await enqueueNotificationTx(tx, {
        partnerId: intro.partner_id, introductionId: intro.id, kind: "intro_refused_member",
        toEmail: intro.partner_email, idempotencyKey: `csy-intro-refused:${intro.id}`,
      });
    }
    return { ok: true };
  });
}

// ── PEEK non-destructif (pour l'interstitiel GET — ne consomme JAMAIS le token) ─
export type LinkActionState = "ready" | "expired" | "used" | "invalid";

/** Valide un token de confirmation/refus SANS muter. Pour la page intermédiaire. */
export async function peekIntroductionAction(token: string, purpose: ActionPurpose): Promise<{ state: LinkActionState; memberName?: string }> {
  const parsed = parseActionToken(token, purpose);
  if (!parsed) return { state: "invalid" };
  if (isActionTokenExpired(parsed.expMs)) return { state: "expired" };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ status: string; confirm_generation: number; display_name: string }>(
      `select i.status, i.confirm_generation, p.display_name
         from clonestory_fp_introductions i join clonestory_fp_partners p on p.id = i.partner_id
        where i.id = $1`,
      [parsed.subjectId],
    );
    const r = rows[0];
    if (!r || Number(r.confirm_generation) !== parsed.generation) return { state: "invalid" };
    if (r.status === "declared") return { state: "ready", memberName: r.display_name };
    if (r.status === "canceled" || r.status === "expired") return { state: purpose === "introrefuse" && r.status === "canceled" ? "used" : "used" };
    return { state: "used" }; // déjà confirmée/avancée
  });
}

/** Valide un token de vérification partenaire SANS muter. Pour la page intermédiaire. */
export async function peekVerification(token: string): Promise<{ state: LinkActionState; emailMasked?: string }> {
  const parsed = parseVerificationToken(token);
  if (!parsed) return { state: "invalid" };
  if (isVerificationTokenExpired(parsed.expMs)) return { state: "expired" };
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ status: string; verification_generation: number; email: string; email_verified_at: string | null }>(
      `select status, verification_generation, email, email_verified_at from clonestory_fp_partners where id = $1`,
      [parsed.partnerId],
    );
    const r = rows[0];
    if (!r || Number(r.verification_generation) !== parsed.generation || r.status === "withdrawn") return { state: "invalid" };
    if (r.email_verified_at) return { state: "used", emailMasked: maskEmail(r.email) };
    return { state: "ready", emailMasked: maskEmail(r.email) };
  });
}

function maskEmail(email: string | null): string {
  if (!email || !email.includes("@")) return "votre adresse";
  const [local, domain] = email.split("@");
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

// ── Journal d'usage lien/code (attribution de branche au landing) ────────────
export async function recordLinkUsage(
  partnerId: string,
  method: "link" | "code",
  outcome: "landed" | "attributed" | "invalid" | "revoked",
  hashedIp: string | null,
): Promise<void> {
  const db = await getClonestoryDb();
  await withService(db, async (tx) => {
    await tx.query(
      `insert into clonestory_fp_link_usage (partner_id, method, outcome, hashed_ip) values ($1,$2,$3,$4)`,
      [partnerId, method, outcome, hashedIp],
    );
  });
}

// ── Retrait RGPD ──────────────────────────────────────────────────────────────
export async function requestWithdrawal(email: string): Promise<{ ok: boolean }> {
  const emailNorm = normalizeEmailForCompare(email);
  if (!emailNorm.includes("@")) return { ok: false };
  const db = await getClonestoryDb();
  await withService(db, async (tx) => {
    const partner = await findByEmail(tx, emailNorm);
    await tx.query(
      `insert into clonestory_fp_withdrawals (partner_id, email_normalized) values ($1,$2)`,
      [partner?.id ?? null, emailNorm],
    );
    if (partner) {
      await tx.query(`update clonestory_fp_partners set withdrawal_requested_at = now(), updated_at = now() where id = $1`, [partner.id]);
    }
  });
  return { ok: true };
}
