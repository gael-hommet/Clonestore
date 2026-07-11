// Programme partenaires — store des cabinets (lookup, code, contrat, activation, liaison compte).
// SERVER-ONLY. Mode service pour l'écriture ; la lecture « espace cabinet » passe par withPartner.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { sha256, generateReferralCode } from "./identity";
import { recordAudit } from "./audit";
import { enqueuePartnerEmailTx } from "./emails";

export type PartnerRow = {
  id: string;
  public_slug: string;
  display_name: string;
  email_normalized: string;
  status: "pending" | "contract_pending" | "stripe_pending" | "active" | "suspended" | "archived";
  account_user_id: string | null;
  commission_rate_bps: number;
  attribution_window_days: number;
  protection_window_days: number;
  reserve_days: number;
  payout_threshold_minor: number;
  payout_currency: string;
  stripe_connected_account_id: string | null;
  stripe_onboarding_status: "none" | "pending" | "complete" | "restricted";
  payouts_enabled: boolean;
  contract_accepted_at: string | null;
  activated_at: string | null;
  self_domains: string[];
};

const PARTNER_COLS =
  "id, public_slug, display_name, email_normalized, status, account_user_id, commission_rate_bps, attribution_window_days, protection_window_days, reserve_days, payout_threshold_minor, payout_currency, stripe_connected_account_id, stripe_onboarding_status, payouts_enabled, contract_accepted_at, activated_at, self_domains";

export async function getPartnerById(tx: SqlExecutor, id: string): Promise<PartnerRow | null> {
  const { rows } = await tx.query<PartnerRow>(`select ${PARTNER_COLS} from clonestore_pp_partners where id = $1`, [id]);
  return rows[0] ?? null;
}

/** Cabinet par slug public (utilisé au clic sur le lien). */
export async function getPartnerBySlug(tx: SqlExecutor, slug: string): Promise<PartnerRow | null> {
  const { rows } = await tx.query<PartnerRow>(`select ${PARTNER_COLS} from clonestore_pp_partners where public_slug = $1`, [slug]);
  return rows[0] ?? null;
}

/** Cabinet lié à un compte Supabase (espace partenaire authentifié). */
export async function getPartnerByAccount(tx: SqlExecutor, userId: string): Promise<PartnerRow | null> {
  const { rows } = await tx.query<PartnerRow>(`select ${PARTNER_COLS} from clonestore_pp_partners where account_user_id = $1`, [userId]);
  return rows[0] ?? null;
}

/**
 * Vérifie un code de recommandation saisi. Retourne le partenaire ACTIF correspondant, ou null.
 * Comparaison par hash (le code n'est jamais stocké en clair).
 */
export async function resolvePartnerByCode(tx: SqlExecutor, code: string): Promise<PartnerRow | null> {
  const normalized = code.trim().toUpperCase();
  const hash = sha256(normalized);
  const { rows } = await tx.query<{ partner_id: string }>(
    `select partner_id from clonestore_pp_partner_codes where code_hash = $1 and status = 'active' limit 1`,
    [hash],
  );
  if (!rows.length) return null;
  return getPartnerById(tx, rows[0].partner_id);
}

/** Rotation du code : révoque l'actif, en émet un nouveau (retourné en clair une fois). Audité. */
export async function rotateReferralCode(tx: SqlExecutor, partnerId: string, actor: string, reason: string): Promise<{ code: string }> {
  const cur = await tx.query<{ generation: number }>(
    `select generation from clonestore_pp_partner_codes where partner_id = $1 and status = 'active' order by generation desc limit 1`,
    [partnerId],
  );
  const nextGen = (cur.rows[0]?.generation ?? 0) + 1;
  await tx.query(
    `update clonestore_pp_partner_codes set status='revoked', revoked_at=now(), revoked_reason=$2 where partner_id=$1 and status='active'`,
    [partnerId, reason],
  );
  const code = generateReferralCode();
  await tx.query(
    `insert into clonestore_pp_partner_codes (partner_id, code_hash, code_hint, generation, status) values ($1,$2,$3,$4,'active')`,
    [partnerId, code.hash, code.hint, nextGen],
  );
  await recordAudit(tx, { actor, action: "partner.code_rotated", entityType: "partner", entityId: partnerId, reason, next: { generation: nextGen } });
  return { code: code.code };
}

/** Enregistre l'acceptation électronique du contrat. */
export async function acceptContract(tx: SqlExecutor, partnerId: string, contractVersion: string): Promise<void> {
  await tx.query(
    `update clonestore_pp_partners
       set contract_accepted_at = now(), contract_version = $2,
           status = case when status = 'contract_pending' then 'stripe_pending' else status end,
           updated_at = now()
     where id = $1`,
    [partnerId, contractVersion],
  );
}

/** Lie un compte Supabase au cabinet (no-steal : jamais d'écrasement d'un lien existant). */
export async function linkPartnerAccount(tx: SqlExecutor, partnerId: string, accountUserId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await tx.query(
    `update clonestore_pp_partners set account_user_id = $2, updated_at = now()
     where id = $1 and account_user_id is null returning id`,
    [partnerId, accountUserId],
  );
  if (!res.rows.length) {
    const cur = await getPartnerById(tx, partnerId);
    if (cur?.account_user_id === accountUserId) return { ok: true };
    return { ok: false, error: "already_linked" };
  }
  return { ok: true };
}

/**
 * Active financièrement le cabinet — UNIQUEMENT si contrat accepté ET onboarding Stripe
 * complet ET payouts activés. Fail-closed : refuse sinon. Audité.
 */
export async function activatePartner(tx: SqlExecutor, partnerId: string, actor: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const p = await getPartnerById(tx, partnerId);
  if (!p) return { ok: false, error: "partner_not_found" };
  if (!p.contract_accepted_at) return { ok: false, error: "contract_not_accepted" };
  if (p.stripe_onboarding_status !== "complete" || !p.payouts_enabled) return { ok: false, error: "stripe_onboarding_incomplete" };
  await tx.query(`update clonestore_pp_partners set status='active', activated_at=coalesce(activated_at, now()), updated_at=now() where id=$1`, [partnerId]);
  await recordAudit(tx, { actor, action: "partner.activated", entityType: "partner", entityId: partnerId, reason });
  await enqueuePartnerEmailTx(tx, { partnerId, kind: "partner_activated", toEmail: p.email_normalized, idempotencyKey: `pp-email:partner_activated:${partnerId}` });
  return { ok: true };
}

/** Suspend un cabinet (raison obligatoire, auditée). Stoppe les attributions/versements futurs. */
export async function suspendPartner(tx: SqlExecutor, partnerId: string, actor: string, reason: string): Promise<void> {
  const p = await getPartnerById(tx, partnerId);
  await tx.query(`update clonestore_pp_partners set status='suspended', suspended_at=now(), suspended_reason=$2, updated_at=now() where id=$1`, [partnerId, reason]);
  await recordAudit(tx, { actor, action: "partner.suspended", entityType: "partner", entityId: partnerId, reason });
  if (p) await enqueuePartnerEmailTx(tx, { partnerId, kind: "partner_suspended", toEmail: p.email_normalized, idempotencyKey: `pp-email:partner_suspended:${partnerId}:${Date.now()}` });
}

/** Réintègre un cabinet suspendu. */
export async function reinstatePartner(tx: SqlExecutor, partnerId: string, actor: string, reason: string): Promise<void> {
  await tx.query(`update clonestore_pp_partners set status='active', suspended_at=null, suspended_reason=null, updated_at=now() where id=$1 and status='suspended'`, [partnerId]);
  await recordAudit(tx, { actor, action: "partner.reinstated", entityType: "partner", entityId: partnerId, reason });
}
